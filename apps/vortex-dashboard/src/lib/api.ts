import type {
  BulkDeleteResponse,
  MultipartSession,
  ObjectsResponse,
  PresignResponse,
  ProviderDescriptor,
  SystemInfo,
  VortexStorageProvider,
  WebhookFeed,
} from './types';

/**
 * The dashboard talks to the engine via same-origin relative `/api/*`
 * URLs only. In dev, Vite proxies them to the Vortex server; in
 * production the console is served behind the engine's ingress.
 */
const API_ROOT = '/api';

/** Dev-only admin key (matches the engine's documented default). */
const DEV_ADMIN_KEY = 'vortex-dev-admin-key';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & { json?: unknown; admin?: boolean },
): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  let body = init?.body;
  if (init?.json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(init.json);
  }
  if (init?.admin) headers['x-vortex-admin-key'] = DEV_ADMIN_KEY;

  const res = await fetch(`${API_ROOT}${path}`, { ...init, headers, body });
  if (!res.ok) {
    let code = 'HTTP_ERROR';
    let message = `Request failed with HTTP ${res.status}`;
    try {
      const parsed = (await res.json()) as { error?: { code?: string; message?: string } };
      code = parsed.error?.code ?? code;
      message = parsed.error?.message ?? message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

/**
 * Presigned URLs minted by the `local_disk` engine point at the engine's
 * raw origin (http://127.0.0.1:8787). The browser must never call that
 * origin directly in the sandbox preview, so same-engine URLs are
 * rewritten onto the same-origin `/api` proxy. Genuine cloud presigns
 * (S3/R2/GCS/Azure) keep their absolute https URLs untouched.
 */
export function toBrowserUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const engineHosts = new Set(['127.0.0.1', 'localhost', '0.0.0.0', '::1']);
    if (engineHosts.has(parsed.hostname) || parsed.origin === window.location.origin) {
      return `${API_ROOT}${parsed.pathname}${parsed.search}`;
    }
    return url;
  } catch {
    return url;
  }
}

export const api = {
  systemInfo: () => request<SystemInfo>('/v1/system/info'),
  providers: () => request<{ providers: ProviderDescriptor[] }>('/v1/storage/providers'),
  setActiveProvider: (provider: VortexStorageProvider) =>
    request<{ active: VortexStorageProvider; providers: ProviderDescriptor[] }>(
      '/v1/storage/providers/active',
      { method: 'POST', json: { provider }, admin: true },
    ),
  listObjects: (prefix?: string, limit = 500) =>
    request<ObjectsResponse>(
      `/v1/storage/objects?${new URLSearchParams({
        ...(prefix ? { prefix } : {}),
        limit: String(limit),
      })}`,
    ),
  upload: (key: string, body: Blob | string, contentType: string) =>
    fetch(`${API_ROOT}/v1/storage/upload?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'content-type': contentType },
      body,
    }).then(async (res) => {
      if (!res.ok) throw new ApiError(res.status, 'UPLOAD_FAILED', await res.text());
      return res.json() as Promise<{ object: { etag: string; size: number } }>;
    }),
  deleteObject: (key: string) =>
    request<{ key: string; deleted: boolean }>(
      `/v1/storage/object?key=${encodeURIComponent(key)}`,
      { method: 'DELETE' },
    ),
  bulkDelete: (keys: string[]) =>
    request<BulkDeleteResponse>('/v1/storage/bulk-delete', {
      method: 'POST',
      json: { keys },
    }),
  presign: (key: string, contentType: string, action: 'read' | 'write', expiresInSeconds: number) =>
    request<PresignResponse>('/v1/storage/presigned-upload', {
      method: 'POST',
      json: { key, contentType, action, expiresInSeconds },
    }),
  multipartInitiate: (key: string, contentType: string) =>
    request<{ uploadId: string; key: string; provider: string }>('/v1/storage/multipart/initiate', {
      method: 'POST',
      json: { key, contentType },
    }),
  multipartUploadPart: (key: string, uploadId: string, partNumber: number, chunk: Blob) =>
    fetch(
      `${API_ROOT}/v1/storage/multipart/upload-part?${new URLSearchParams({
        key,
        uploadId,
        partNumber: String(partNumber),
      })}`,
      { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: chunk },
    ).then(async (res) => {
      if (!res.ok) throw new ApiError(res.status, 'PART_FAILED', await res.text());
      return res.json() as Promise<{ partNumber: number; etag: string }>;
    }),
  multipartComplete: (key: string, uploadId: string, parts: { partNumber: number; etag: string }[]) =>
    request<{ object: { etag: string; size: number } }>('/v1/storage/multipart/complete', {
      method: 'POST',
      json: { key, uploadId, parts },
    }),
  multipartAbort: (key: string, uploadId: string) =>
    request<{ aborted: boolean }>('/v1/storage/multipart/abort', {
      method: 'POST',
      json: { key, uploadId },
    }),
  multipartPending: () =>
    request<{ sessions: MultipartSession[] }>('/v1/storage/multipart/pending'),
  webhookFeed: () => request<WebhookFeed>('/v1/storage/webhooks/feed'),
};

/** Stable download URL for an object (auth-bypassed dev mode streams direct). */
export function objectUrl(key: string): string {
  return `${API_ROOT}/v1/storage/object?key=${encodeURIComponent(key)}`;
}

/** Stable render URL for the transformation pipeline. */
export function renderUrl(params: {
  path: string;
  w?: number;
  h?: number;
  fmt?: string;
  q?: number;
  fit?: string;
}): string {
  const qs = new URLSearchParams({ path: params.path });
  if (params.w) qs.set('w', String(params.w));
  if (params.h) qs.set('h', String(params.h));
  if (params.fmt) qs.set('fmt', params.fmt);
  if (params.q) qs.set('q', String(params.q));
  if (params.fit) qs.set('fit', params.fit);
  return `${API_ROOT}/v1/storage/render?${qs.toString()}`;
}
