import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import type { VortexEventType, WebhookFeed as WebhookFeedData } from '../lib/types';

const EVENT_STOP: Record<VortexEventType, 3 | 4 | 5> = {
  'upload.completed': 5,
  'file.deleted': 3,
  'transform.rendered': 4,
};

const STATUS_STYLE: Record<string, { color: string; label: string }> = {
  delivered: { color: 'var(--vtx-stop-6)', label: 'delivered' },
  retrying: { color: 'var(--vtx-stop-4)', label: 'retrying · backoff' },
  'dead-lettered': { color: 'var(--vtx-stop-3)', label: 'dead-lettered' },
};

/** Live event-driven webhook console — signed dispatches + retry ledger. */
export function WebhookFeed(): JSX.Element {
  const [feed, setFeed] = useState<WebhookFeedData | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async (): Promise<void> => {
      try {
        const data = await api.webhookFeed();
        if (alive) setFeed(data);
      } catch {
        /* engine may briefly be unreachable during restart */
      }
    };
    void tick();
    const interval = setInterval(() => void tick(), 3000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  if (!feed) return <div className="skeleton" style={{ height: 280 }} />;

  return (
    <div className="grid grid--2" style={{ alignItems: 'start' }}>
      {/* -------- signed dispatch scheme -------- */}
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <h3 className="card__title">Signed Delivery Contract</h3>
        <p className="card__hint">
          Every webhook POST is cryptographically signed; receivers verify with the shared
          webhook secret.
        </p>
        <div className="grid grid--2">
          <div className="codeblock">
{`POST <endpoint>  HTTP/1.1
content-type: application/json
x-vortex-event: upload.completed
x-vortex-delivery: evt_f3a1…
x-vortex-signature: t=1731000000, v1=9b7c…

body → raw JSON of the event envelope`}
          </div>
          <div className="codeblock">
{`# receiver-side verification (node)
const [t, v1] = header.split(',').map(p => p.split('=')[1])
const expect = createHmac('sha256', WEBHOOK_SECRET)
  .update(\`\${t}.\${rawBody}\`)
  .digest('hex')
assert(timingSafeEqual(Buffer.from(v1), Buffer.from(expect)))
assert(Math.abs(now() - t) < 300)  # 5-min freshness window`}
          </div>
        </div>
      </div>

      {/* -------- live event feed -------- */}
      <div className="card">
        <div className="row row--between">
          <h3 className="card__title">Engine Events</h3>
          <span className="chip"><i className="pulse-dot" style={{ background: 'var(--stop, var(--vtx-stop-4))' }} /> live · 3s poll</span>
        </div>
        <p className="card__hint">
          upload.completed · file.deleted · transform.rendered — fanned out on every engine mutation.
        </p>
        {feed.events.length === 0 ? (
          <div className="empty">No events yet — upload, delete or render something.</div>
        ) : (
          <div className="feed">
            {feed.events.slice(0, 24).map((event) => (
              <div className="feed__row" key={event.id}>
                <span className={`chip vtx-stop-${EVENT_STOP[event.type]}`}>
                  <i /> {event.type}
                </span>
                <span className="feed__data" title={JSON.stringify(event.data)}>
                  {String(event.data['key'] ?? event.data['path'] ?? JSON.stringify(event.data))}
                </span>
                <span className="feed__meta">
                  <span className="feed__time">{timeAgo(event.occurredAt)}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* -------- delivery attempts -------- */}
      <div className="card">
        <h3 className="card__title">Delivery Ledger</h3>
        <p className="card__hint">
          Exponential backoff (1s → 4s → 16s → 64s + jitter), terminal deliveries dead-lettered to
          <span className="mono"> vortex_data/webhook-deadletters.jsonl</span>.
        </p>
        {feed.endpoints.length === 0 ? (
          <div className="empty">
            No endpoints registered. Set VORTEX_WEBHOOK_ENDPOINTS or POST
            /v1/storage/webhooks/endpoints.
          </div>
        ) : (
          <>
            <p className="small dim">
              <b>{feed.endpoints.length}</b> endpoint(s):{' '}
              {feed.endpoints.map((e) => e.url).join(', ')}
            </p>
            <div>
              {feed.attempts.slice(0, 20).map((attempt, idx) => (
                <div className="attempt" key={`${attempt.eventId}-${attempt.attempt}-${idx}`}>
                  <span className="attempt__url" title={attempt.url}>
                    #{attempt.attempt} · {attempt.url}
                    {attempt.error ? ` — ${attempt.error}` : ''}
                  </span>
                  <b style={{ color: STATUS_STYLE[attempt.status]?.color }}>
                    {STATUS_STYLE[attempt.status]?.label ?? attempt.status}
                  </b>
                </div>
              ))}
              {feed.attempts.length === 0 && (
                <div className="empty">Endpoints registered — no deliveries yet.</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
