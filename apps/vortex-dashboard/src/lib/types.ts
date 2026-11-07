/* Wire-format mirrors of the vortex-server DTOs. */

export type VortexStorageProvider =
  | 'cloudflare_r2'
  | 'aws_s3'
  | 'digitalocean_spaces'
  | 'gcs'
  | 'azure_blob'
  | 'local_disk';

export interface ProviderDescriptor {
  id: VortexStorageProvider;
  label: string;
  tier: string;
  tagline: string;
  description: string;
  endpointHint: string;
  accentStop: 1 | 2 | 3 | 4 | 5 | 6;
  configured: boolean;
  active: boolean;
  missingEnv: string[];
}

export interface StorageObjectMetadata {
  key: string;
  size: number;
  mimeType: string;
  etag: string;
  lastModified: string;
  customMetadata?: Record<string, string>;
}

export interface SystemInfo {
  service: string;
  vendor: string;
  version: string;
  activeProvider: VortexStorageProvider;
  authDisabled: boolean;
  uptimeSeconds: number;
  janitor: { intervalSeconds: number; maxAgeHours: number; pendingUploads: number };
}

export interface PresignResponse {
  url: string;
  method: 'PUT' | 'GET';
  provider: VortexStorageProvider;
  key: string;
  action: 'read' | 'write';
  headers: Record<string, string>;
  expiresAt: string;
}

export type VortexEventType = 'upload.completed' | 'file.deleted' | 'transform.rendered';

export interface VortexEvent {
  id: string;
  type: VortexEventType;
  occurredAt: string;
  provider: VortexStorageProvider;
  data: Record<string, unknown>;
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

export interface WebhookFeed {
  endpoints: { url: string; description?: string }[];
  events: VortexEvent[];
  attempts: DeliveryAttempt[];
  signature: { header: string; scheme: string; algorithm: string };
}

export interface MultipartSession {
  uploadId: string;
  key: string;
  provider: VortexStorageProvider;
  mimeType: string;
  initiatedAt: string;
}

export interface ObjectsResponse {
  provider: VortexStorageProvider;
  count: number;
  objects: StorageObjectMetadata[];
}

export interface BulkDeleteResponse {
  deleted: string[];
  failed: string[];
}
