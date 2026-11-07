import { appendFile, mkdir } from 'node:fs/promises';
import { createHmac, randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Logger } from '../core/logger';
import type { VortexStorageProvider } from '../core/types/storage.types';

/* ================================================================== *
 *  Event-Driven Webhooks                                              *
 *                                                                    *
 *  Every lifecycle occurrence (`upload.completed`, `file.deleted`,    *
 *  `transform.rendered`) is fanned out to registered endpoints as a   *
 *  cryptographically signed POST:                                     *
 *                                                                    *
 *    X-Vortex-Signature: t=<unix_ts>, v1=<HMAC_SHA256(ts.body)>       *
 *                                                                    *
 *  Deliveries retry with exponential backoff (1s → 4s → 16s → 64s)    *
 *  plus jitter; terminally failing deliveries land in a JSONL         *
 *  dead-letter file under vortex_data/.                               *
 * ================================================================== */

export const VORTEX_EVENT_TYPES = [
  'upload.completed',
  'file.deleted',
  'transform.rendered',
] as const;

export type VortexEventType = (typeof VORTEX_EVENT_TYPES)[number];

export interface VortexEvent {
  id: string;
  type: VortexEventType;
  occurredAt: string;
  provider: VortexStorageProvider;
  data: Record<string, unknown>;
}

export interface WebhookEndpointConfig {
  url: string;
  description?: string;
}

export interface DeliveryAttempt {
  eventId: string;
  eventType: VortexEventType;
  url: string;
  attempt: number;
  at: string;
  status: 'delivered' | 'retrying' | 'dead-lettered';
  httpStatus?: number;
  error?: string;
  nextRetryAt?: string;
}

interface WebhookServiceOptions {
  secret: string;
  endpoints: WebhookEndpointConfig[];
  dataDir: string;
  logger: Logger;
  maxAttempts?: number;
  baseDelayMs?: number;
}

const RING_LIMIT = 300;

export class WebhookService {
  private readonly secret: string;
  private endpoints: WebhookEndpointConfig[];
  private readonly logger: Logger;
  private readonly deadLetterPath: string;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly events: VortexEvent[] = [];
  private readonly attempts: DeliveryAttempt[] = [];

  constructor(options: WebhookServiceOptions) {
    this.secret = options.secret;
    this.endpoints = options.endpoints;
    this.logger = options.logger.child('webhooks');
    this.deadLetterPath = path.join(options.dataDir, 'webhook-deadletters.jsonl');
    this.maxAttempts = options.maxAttempts ?? 5;
    this.baseDelayMs = options.baseDelayMs ?? 1000;
  }

  /** Build the `X-Vortex-Signature` header value for a raw JSON body. */
  static signPayload(secret: string, timestamp: number, body: string): string {
    const v1 = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
    return `t=${timestamp},v1=${v1}`;
  }

  /** Verification helper exported for SDK consumers and tests. */
  static verifySignature(
    secret: string,
    signatureHeader: string,
    body: string,
    toleranceSeconds = 300,
  ): boolean {
    const parts = Object.fromEntries(
      signatureHeader.split(',').map((kv) => kv.split('=') as [string, string]),
    );
    const t = Number(parts['t']);
    if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > toleranceSeconds) return false;
    const expected = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
    return expected.length === (parts['v1'] ?? '').length && expected === parts['v1'];
  }

  setEndpoints(endpoints: WebhookEndpointConfig[]): void {
    this.endpoints = endpoints;
  }

  getEndpoints(): WebhookEndpointConfig[] {
    return this.endpoints;
  }

  recentEvents(): VortexEvent[] {
    return [...this.events].reverse();
  }

  recentAttempts(): DeliveryAttempt[] {
    return [...this.attempts].reverse();
  }

  /** Fan an event out to every registered endpoint with retries. */
  dispatch(
    type: VortexEventType,
    provider: VortexStorageProvider,
    data: Record<string, unknown>,
  ): VortexEvent {
    const event: VortexEvent = {
      id: `evt_${randomUUID().replace(/-/g, '')}`,
      type,
      occurredAt: new Date().toISOString(),
      provider,
      data,
    };
    this.push(this.events, event);
    this.logger.info(`event ${event.type} ${event.id}`, { provider });

    for (const endpoint of this.endpoints) {
      void this.deliver(endpoint, event, 1).catch((error: unknown) => {
        this.logger.error('unhandled delivery failure', error);
      });
    }
    return event;
  }

  private async deliver(
    endpoint: WebhookEndpointConfig,
    event: VortexEvent,
    attempt: number,
  ): Promise<void> {
    const body = JSON.stringify(event);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = WebhookService.signPayload(this.secret, timestamp, body);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'user-agent': 'Vortex-Webhooks/1.0',
            'x-vortex-event': event.type,
            'x-vortex-delivery': event.id,
            'x-vortex-signature': signature,
          },
          body,
          signal: controller.signal,
        });
        if (response.ok) {
          this.push(this.attempts, {
            eventId: event.id,
            eventType: event.type,
            url: endpoint.url,
            attempt,
            at: new Date().toISOString(),
            status: 'delivered',
            httpStatus: response.status,
          });
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt >= this.maxAttempts) {
        this.push(this.attempts, {
          eventId: event.id,
          eventType: event.type,
          url: endpoint.url,
          attempt,
          at: new Date().toISOString(),
          status: 'dead-lettered',
          error: message,
        });
        await this.deadLetter(event, endpoint, message);
        return;
      }
      const delayMs = this.backoffDelay(attempt);
      this.push(this.attempts, {
        eventId: event.id,
        eventType: event.type,
        url: endpoint.url,
        attempt,
        at: new Date().toISOString(),
        status: 'retrying',
        error: message,
        nextRetryAt: new Date(Date.now() + delayMs).toISOString(),
      });
      const timer = setTimeout(() => {
        void this.deliver(endpoint, event, attempt + 1);
      }, delayMs);
      timer.unref?.();
    }
  }

  /** Exponential backoff: base × 2^(attempt-1) + 0-250ms jitter, capped at 60s. */
  private backoffDelay(attempt: number): number {
    const expo = this.baseDelayMs * 2 ** (attempt - 1);
    const jitter = Math.floor(Math.random() * 250);
    return Math.min(expo + jitter, 60_000);
  }

  private async deadLetter(
    event: VortexEvent,
    endpoint: WebhookEndpointConfig,
    error: string,
  ): Promise<void> {
    try {
      await mkdir(path.dirname(this.deadLetterPath), { recursive: true });
      await appendFile(
        this.deadLetterPath,
        JSON.stringify({
          deadLetteredAt: new Date().toISOString(),
          endpoint: endpoint.url,
          error,
          event,
        }) + '\n',
      );
    } catch (writeError) {
      this.logger.error('failed to write dead-letter record', writeError);
    }
  }

  private push<T>(ring: T[], item: T): void {
    ring.push(item);
    if (ring.length > RING_LIMIT) ring.splice(0, ring.length - RING_LIMIT);
  }
}
