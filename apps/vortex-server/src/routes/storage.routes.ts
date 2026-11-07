import { Router, raw } from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { VortexEnv } from '../config/env.js';
import { HttpError, ah } from '../core/http.js';
import type { DriverRegistry } from '../core/factory/driver.registry.js';
import type { Logger } from '../core/logger.js';
import type { LocalDiskDriver } from '../core/drivers/local-disk.driver.js';
import { TransformService } from '../media/transform.service.js';
import type { MultipartJanitor } from '../services/multipart-janitor.js';
import { WebhookService } from '../webhooks/webhook.service.js';
import type { MultipartUploadPart, VortexStorageProvider } from '../core/types/storage.types.js';
import { VORTEX_PROVIDERS } from '../core/types/storage.types.js';
import { adminGuard } from '../guards/vortex-storage.guard.js';

export interface StorageRouterDeps {
  env: VortexEnv;
  logger: Logger;
  registry: DriverRegistry;
  webhooks: WebhookService;
  transformer: TransformService;
  janitor: MultipartJanitor;
  startedAt: number;
}

const MAX_BULK_KEYS = 1000;
const DEFAULT_PRESIGN_SECONDS = 900; // 15 minutes
const MAX_PRESIGN_SECONDS = 3600;

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw HttpError.badRequest(`"${field}" must be a non-empty string`);
  }
  return value;
}

function parseUploadId(value: unknown): string {
  const uploadId = requireString(value, 'uploadId');
  if (uploadId.length > 256) throw HttpError.badRequest('uploadId is too long');
  return uploadId;
}

function parseParts(value: unknown): MultipartUploadPart[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw HttpError.badRequest('"parts" must be a non-empty array');
  }
  return value.map((raw, index) => {
    const part = raw as Partial<MultipartUploadPart>;
    if (!Number.isInteger(part.partNumber) || typeof part.etag !== 'string') {
      throw HttpError.badRequest(`parts[${index}] requires integer partNumber and string etag`);
    }
    if (part.partNumber! < 1 || part.partNumber! > 10_000) {
      throw HttpError.badRequest(`parts[${index}].partNumber out of range 1–10,000`);
    }
    return { partNumber: part.partNumber!, etag: part.etag };
  });
}

export function createStorageRouter(deps: StorageRouterDeps): Router {
  const { env, logger, registry, webhooks, transformer, janitor } = deps;
  const router = Router();

  const local = (): LocalDiskDriver => registry.driver('local_disk') as LocalDiskDriver;

  /* =============== health & system =============== */

  router.get(
    '/health',
    ah(async () => ({
      status: 'ok',
      service: 'vortex-storage-engine',
      activeProvider: registry.active,
      uptimeSeconds: Math.floor((Date.now() - deps.startedAt) / 1000),
      time: new Date().toISOString(),
    })),
  );

  router.get(
    '/v1/system/info',
    ah(async () => ({
      service: 'vortex-storage-engine',
      vendor: 'N.O Group',
      domain: 'no-group.org',
      version: '1.0.0',
      region: process.env['VORTEX_REGION'] ?? 'local',
      activeProvider: registry.active,
      authDisabled: env.authDisabled,
      rlsRuleCount: deps.env.rlsRulesJson ? 'custom' : 'default',
      janitor: {
        intervalSeconds: env.janitor.intervalSeconds,
        maxAgeHours: env.janitor.maxAgeHours,
        pendingUploads: janitor.pending().length,
      },
      uptimeSeconds: Math.floor((Date.now() - deps.startedAt) / 1000),
    })),
  );

  /* =============== multi-cloud provider management =============== */

  router.get(
    '/v1/storage/providers',
    ah(async () => ({ providers: registry.descriptors() })),
  );

  router.get(
    '/v1/storage/providers/active',
    ah(async () => ({ active: registry.active })),
  );

  router.post(
    '/v1/storage/providers/active',
    adminGuard(env.adminKey),
    ah(async (req) => {
      const provider = requireString(req.body?.provider, 'provider') as VortexStorageProvider;
      if (!VORTEX_PROVIDERS.includes(provider)) {
        throw HttpError.badRequest(`Unknown provider "${provider}"`, { valid: VORTEX_PROVIDERS });
      }
      registry.setActive(provider);
      return { active: registry.active, providers: registry.descriptors() };
    }),
  );

  /* =============== presigned browser uploads (Cloudinary-style) =============== */

  router.post(
    '/v1/storage/presigned-upload',
    ah(async (req) => {
      const key = requireString(req.body?.key, 'key');
      const contentType =
        typeof req.body?.contentType === 'string' ? req.body.contentType : 'application/octet-stream';
      const action = req.body?.action === 'read' ? ('read' as const) : ('write' as const);
      const requested = Number(req.body?.expiresInSeconds ?? DEFAULT_PRESIGN_SECONDS);
      if (!Number.isFinite(requested) || requested <= 0 || requested > MAX_PRESIGN_SECONDS) {
        throw HttpError.badRequest(`expiresInSeconds must be 1–${MAX_PRESIGN_SECONDS}`);
      }
      const driver = registry.driver();
      const url = await driver.generatePresignedUrl({
        key,
        expiresInSeconds: requested,
        contentType,
        action,
      });
      logger.info('minted presigned url', { provider: driver.provider, key, action });
      return {
        url,
        method: action === 'write' ? 'PUT' : 'GET',
        provider: driver.provider,
        key,
        action,
        headers: action === 'write' ? { 'content-type': contentType } : {},
        expiresAt: new Date(Date.now() + requested * 1000).toISOString(),
      };
    }),
  );

  /**
   * Local-disk transfer endpoint: what `local_disk` presigned URLs point at.
   * Verified by the driver's HMAC transfer signature; streams the raw request
   * body straight to the volume (no API memory buffering).
   */
  router.put(
    '/v1/storage/local-transfer',
    ah(async (req, res) => {
      const key = requireString(req.query['key'], 'key');
      const exp = Number(req.query['exp']);
      const sig = requireString(req.query['sig'], 'sig');
      const driver = local();
      if (!driver.verifyTransferSignature(key, 'write', exp, sig)) {
        throw HttpError.forbidden('Invalid or expired transfer signature');
      }
      const mimeType = req.headers['content-type'] ?? 'application/octet-stream';
      const metadata = await driver.uploadObject(
        key,
        Readable.toWeb(req) as unknown as import('node:stream/web').ReadableStream,
        mimeType,
      );
      webhooks.dispatch('upload.completed', 'local_disk', {
        key: metadata.key,
        size: metadata.size,
        mimeType: metadata.mimeType,
        etag: metadata.etag,
        via: 'presigned',
      });
      res.status(201).json({ object: metadata });
    }),
  );

  router.get(
    '/v1/storage/local-transfer',
    ah(async (req, res) => {
      const key = requireString(req.query['key'], 'key');
      const exp = Number(req.query['exp']);
      const sig = requireString(req.query['sig'], 'sig');
      const driver = local();
      if (!driver.verifyTransferSignature(key, 'read', exp, sig)) {
        throw HttpError.forbidden('Invalid or expired transfer signature');
      }
      const { stream, metadata } = await driver.downloadObject(key);
      res.setHeader('content-type', metadata.mimeType);
      res.setHeader('content-length', metadata.size);
      res.setHeader('etag', metadata.etag);
      await pipeline(Readable.fromWeb(stream as never), res);
    }),
  );

  /* =============== direct server-mediated upload (small assets) =============== */

  router.post(
    '/v1/storage/upload',
    raw({ type: () => true, limit: '64mb' }),
    ah(async (req, res) => {
      const key = requireString(req.query['key'], 'key');
      const body = req.body as Buffer;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        throw HttpError.badRequest('Binary request body is required');
      }
      const mimeType =
        (req.headers['content-type'] !== 'application/octet-stream' && req.headers['content-type']) ||
        'application/octet-stream';
      const driver = registry.driver();
      const metadata = await driver.uploadObject(key, body, String(mimeType));
      webhooks.dispatch('upload.completed', driver.provider, {
        key: metadata.key,
        size: metadata.size,
        mimeType: metadata.mimeType,
        etag: metadata.etag,
        via: 'direct',
      });
      res.status(201).json({ object: metadata });
    }),
  );

  /* =============== object enumeration & transfer =============== */

  router.get(
    '/v1/storage/objects',
    ah(async (req) => {
      const prefix = typeof req.query['prefix'] === 'string' ? req.query['prefix'] : undefined;
      const limitRaw = Number(req.query['limit'] ?? 1000);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 5000) : 1000;
      const driver = registry.driver();
      const objects = await driver.listObjects(prefix, limit);
      return { provider: driver.provider, count: objects.length, objects };
    }),
  );

  router.get(
    '/v1/storage/object',
    ah(async (req, res) => {
      const key = requireString(req.query['key'], 'key');
      const driver = registry.driver();
      const { stream, metadata } = await driver.downloadObject(key);
      res.setHeader('content-type', metadata.mimeType);
      res.setHeader('content-length', metadata.size);
      res.setHeader('etag', metadata.etag);
      res.setHeader('last-modified', metadata.lastModified.toUTCString());
      if (req.query['download'] === '1') {
        const filename = key.split('/').pop() ?? 'download';
        res.setHeader('content-disposition', `attachment; filename="${filename}"`);
      }
      await pipeline(Readable.fromWeb(stream as never), res);
    }),
  );

  router.delete(
    '/v1/storage/object',
    ah(async (req) => {
      const key = requireString(req.query['key'], 'key');
      const driver = registry.driver();
      const existed = await driver.deleteObject(key);
      webhooks.dispatch('file.deleted', driver.provider, { key, existed });
      return { key, deleted: existed };
    }),
  );

  /* =============== bulk asset purging (≤ 1,000 keys) =============== */

  router.post(
    '/v1/storage/bulk-delete',
    ah(async (req) => {
      const rawKeys = req.body?.keys;
      if (!Array.isArray(rawKeys) || rawKeys.length === 0) {
        throw HttpError.badRequest('"keys" must be a non-empty string array');
      }
      if (rawKeys.length > MAX_BULK_KEYS) {
        throw HttpError.badRequest(`Bulk delete is capped at ${MAX_BULK_KEYS} keys per call`);
      }
      const keys = rawKeys.map((k, i) => requireString(k, `keys[${i}]`));
      const driver = registry.driver();
      const result = await driver.deleteBulkObjects(keys);
      webhooks.dispatch('file.deleted', driver.provider, {
        keys: result.deleted,
        failed: result.failed,
        count: result.deleted.length,
        bulk: true,
      });
      logger.info('bulk delete finished', {
        provider: driver.provider,
        deleted: result.deleted.length,
        failed: result.failed.length,
      });
      return result;
    }),
  );

  /* =============== chunked multipart ingest =============== */

  router.post(
    '/v1/storage/multipart/initiate',
    ah(async (req) => {
      const key = requireString(req.body?.key, 'key');
      const contentType =
        typeof req.body?.contentType === 'string'
          ? req.body.contentType
          : 'application/octet-stream';
      const driver = registry.driver();
      const session = await driver.initiateMultipartUpload(key, contentType);
      await janitor.register({
        uploadId: session.uploadId,
        key,
        provider: driver.provider,
        mimeType: contentType,
        initiatedAt: new Date().toISOString(),
      });
      return { uploadId: session.uploadId, key, provider: driver.provider };
    }),
  );

  router.put(
    '/v1/storage/multipart/upload-part',
    raw({ type: () => true, limit: '256mb' }),
    ah(async (req) => {
      const key = requireString(req.query['key'], 'key');
      const uploadId = parseUploadId(req.query['uploadId']);
      const partNumber = Number(req.query['partNumber']);
      if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000) {
        throw HttpError.badRequest('partNumber must be an integer between 1 and 10,000');
      }
      const body = req.body as Buffer;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        throw HttpError.badRequest('Binary part body is required');
      }
      const driver = registry.driver();
      return driver.uploadPart(key, uploadId, partNumber, body);
    }),
  );

  router.post(
    '/v1/storage/multipart/complete',
    ah(async (req) => {
      const key = requireString(req.body?.key, 'key');
      const uploadId = parseUploadId(req.body?.uploadId);
      const parts = parseParts(req.body?.parts);
      const driver = registry.driver();
      const metadata = await driver.completeMultipartUpload(key, uploadId, parts);
      await janitor.drop(uploadId);
      webhooks.dispatch('upload.completed', driver.provider, {
        key: metadata.key,
        size: metadata.size,
        mimeType: metadata.mimeType,
        etag: metadata.etag,
        parts: parts.length,
        via: 'multipart',
      });
      return { object: metadata };
    }),
  );

  router.post(
    '/v1/storage/multipart/abort',
    ah(async (req) => {
      const key = requireString(req.body?.key, 'key');
      const uploadId = parseUploadId(req.body?.uploadId);
      const driver = registry.driver();
      const aborter = driver as unknown as {
        abortMultipartUpload?: (k: string, u: string) => Promise<void>;
      };
      if (typeof aborter.abortMultipartUpload === 'function') {
        await aborter.abortMultipartUpload(key, uploadId);
      }
      await janitor.drop(uploadId);
      return { aborted: true, uploadId };
    }),
  );

  router.get(
    '/v1/storage/multipart/pending',
    ah(async () => ({ sessions: janitor.pending() })),
  );

  /* =============== dynamic edge image transformation =============== */

  router.get(
    '/v1/storage/render',
    ah(async (req, res) => {
      const params = TransformService.parseParams(req.query as Record<string, unknown>);
      const driver = registry.driver();
      const rendered = await transformer.render(driver, params);
      if (!rendered.cacheHit) {
        webhooks.dispatch('transform.rendered', driver.provider, {
          path: params.path,
          w: params.w ?? null,
          h: params.h ?? null,
          fmt: params.fmt ?? 'webp',
          q: params.q ?? 80,
          fit: params.fit ?? 'cover',
          bytes: rendered.buffer.length,
        });
      }
      res.setHeader('content-type', rendered.contentType);
      res.setHeader('content-length', rendered.buffer.length);
      res.setHeader('etag', rendered.etag);
      res.setHeader('x-vortex-cache', rendered.cacheHit ? 'HIT' : 'MISS');
      res.setHeader('cache-control', 'public, max-age=31536000, immutable');
      res.status(200).end(rendered.buffer);
    }),
  );

  /* =============== webhook observability =============== */

  router.get(
    '/v1/storage/webhooks/feed',
    ah(async () => ({
      endpoints: webhooks.getEndpoints().map((e) => ({ url: e.url, description: e.description })),
      events: webhooks.recentEvents().slice(0, 100),
      attempts: webhooks.recentAttempts().slice(0, 200),
      signature: {
        header: 'X-Vortex-Signature',
        scheme: 't=<unix_ts>,v1=HMAC_SHA256(secret, "<ts>.<raw_body>")',
        algorithm: 'HMAC-SHA256',
      },
    })),
  );

  router.post(
    '/v1/storage/webhooks/endpoints',
    adminGuard(env.adminKey),
    ah(async (req) => {
      const url = requireString(req.body?.url, 'url');
      if (!/^https?:\/\//.test(url)) throw HttpError.badRequest('url must be http(s)');
      const description =
        typeof req.body?.description === 'string' ? req.body.description : undefined;
      const endpoints = [
        ...webhooks.getEndpoints(),
        description ? { url, description } : { url },
      ];
      webhooks.setEndpoints(endpoints);
      return { registered: endpoints.length, endpoints };
    }),
  );

  router.delete(
    '/v1/storage/webhooks/endpoints',
    adminGuard(env.adminKey),
    ah(async () => {
      webhooks.setEndpoints([]);
      return { registered: 0, endpoints: [] };
    }),
  );

  return router;
}
