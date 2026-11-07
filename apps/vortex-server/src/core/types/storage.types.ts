import type { ReadableStream } from 'node:stream/web';

/* ================================================================== *
 *  VORTEX STORAGE ENGINE — CORE TYPE CONTRACTS                        *
 *                                                                    *
 *  Every provider adapter (Cloudflare R2, AWS S3, DigitalOcean       *
 *  Spaces, GCS, Azure Blob, Local Disk) MUST satisfy                  *
 *  `IVortexStorageDriver` exactly.                                    *
 * ================================================================== */

/** The six storage targets supported by the Vortex Storage Engine. */
export const VORTEX_PROVIDERS = [
  'cloudflare_r2',
  'aws_s3',
  'digitalocean_spaces',
  'gcs',
  'azure_blob',
  'local_disk',
] as const;

export type VortexStorageProvider = (typeof VORTEX_PROVIDERS)[number];

/** Normalized metadata returned by every driver for every object. */
export interface StorageObjectMetadata {
  key: string;
  size: number;
  mimeType: string;
  etag: string;
  lastModified: Date;
  customMetadata?: Record<string, string>;
}

/** Options accepted when minting a time-limited presigned URL. */
export interface PresignedUrlOptions {
  key: string;
  expiresInSeconds: number;
  contentType?: string;
  action: 'read' | 'write';
}

/** A single uploaded part handle inside a multipart session. */
export interface MultipartUploadPart {
  partNumber: number;
  etag: string;
}

/**
 * The strict driver contract.
 *
 * Implementations must be byte-for-byte consistent in behavior:
 * identical inputs produce identical normalized outputs regardless of
 * the backing cloud. All keys are POSIX-style relative paths
 * (e.g. `buckets/user-avatars/u-123/avatar.png`).
 */
export interface IVortexStorageDriver {
  readonly provider: VortexStorageProvider;

  uploadObject(
    key: string,
    body: Buffer | ReadableStream,
    mimeType: string,
  ): Promise<StorageObjectMetadata>;

  downloadObject(
    key: string,
  ): Promise<{ stream: ReadableStream; metadata: StorageObjectMetadata }>;

  deleteObject(key: string): Promise<boolean>;

  deleteBulkObjects(keys: string[]): Promise<{ deleted: string[]; failed: string[] }>;

  generatePresignedUrl(options: PresignedUrlOptions): Promise<string>;

  initiateMultipartUpload(key: string, mimeType: string): Promise<{ uploadId: string }>;

  uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer,
  ): Promise<MultipartUploadPart>;

  completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: MultipartUploadPart[],
  ): Promise<StorageObjectMetadata>;

  listObjects(prefix?: string, limit?: number): Promise<StorageObjectMetadata[]>;

  objectExists(key: string): Promise<boolean>;
}

/**
 * Optional capability implemented by all first-party drivers: aborting a
 * dangling multipart upload so the 24h janitor can reclaim storage.
 */
export interface IVortexMultipartAborter {
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;
}

/** Convenience helper consumed by the media pipeline. */
export interface IVortexBufferDownload {
  downloadBuffer(key: string): Promise<{ buffer: Buffer; metadata: StorageObjectMetadata }>;
}

/** Static catalogue metadata describing a provider for the dashboard. */
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

/** Runtime configuration blocks detected from the environment. */
export interface R2DriverConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export interface AwsS3DriverConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint?: string;
}

export interface DigitalOceanDriverConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint?: string;
}

export interface GcsDriverConfig {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint?: string;
}

export interface AzureDriverConfig {
  accountName: string;
  accountKey: string;
  container: string;
  connectionString?: string;
}

export interface LocalDiskDriverConfig {
  rootDir: string;
  publicBaseUrl: string;
  signingSecret: string;
}
