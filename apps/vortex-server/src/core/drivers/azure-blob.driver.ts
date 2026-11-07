import {
  BlobSASPermissions,
  BlobServiceClient,
  SASProtocol,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  type BlockBlobClient,
  type ContainerClient,
} from '@azure/storage-blob';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import type { ReadableStream } from 'node:stream/web';
import {
  guessMimeType,
  isWebStream,
  nodeToWeb,
  sanitizeObjectKey,
  streamToBuffer,
  webToNode,
} from '../stream.utils.js';
import type {
  AzureDriverConfig,
  IVortexMultipartAborter,
  IVortexStorageDriver,
  MultipartUploadPart,
  PresignedUrlOptions,
  StorageObjectMetadata,
} from '../types/storage.types.js';

/**
 * Microsoft Azure Blob Storage — corporate enterprise IT tier.
 *
 * Azure does not expose an S3 API, so this adapter maps the Vortex
 * contract onto the native Block Blob surface:
 *
 *   IVortexStorageDriver          Azure Block Blob equivalent
 *   ──────────────────────────    ─────────────────────────────────────
 *   presigned URLs            →   User-delegation/Shared-Key SAS tokens
 *   multipart upload          →   stageBlock() + commitBlockList()
 *   deleteBulkObjects         →   bounded-parallel deleteIfExists()
 *
 * NOTE on multipart aborts: Azure garbage-collects uncommitted blocks
 * automatically (~7 days). `abortMultipartUpload` is therefore a
 * best-effort advisory no-op — the 24h janitor drops the registry entry
 * and Azure reclaims the staged blocks on its own schedule.
 */
export class AzureBlobDriver implements IVortexStorageDriver, IVortexMultipartAborter {
  readonly provider = 'azure_blob' as const;

  private readonly container: ContainerClient;
  private readonly credential: StorageSharedKeyCredential | undefined;
  private readonly containerName: string;

  constructor(config: AzureDriverConfig) {
    this.containerName = config.container;
    const service = config.connectionString
      ? BlobServiceClient.fromConnectionString(config.connectionString)
      : new BlobServiceClient(
          `https://${config.accountName}.blob.core.windows.net`,
          new StorageSharedKeyCredential(config.accountName, config.accountKey),
        );
    if (!config.connectionString) {
      this.credential = new StorageSharedKeyCredential(config.accountName, config.accountKey);
    }
    this.container = service.getContainerClient(config.container);
  }

  private blob(key: string): BlockBlobClient {
    return this.container.getBlockBlobClient(sanitizeObjectKey(key));
  }

  /** Multipart "uploadIds" are in-memory session tokens; block ids derive from them. */
  private static blockId(uploadId: string, partNumber: number): string {
    return Buffer.from(`${uploadId}:${partNumber}`).toString('base64url');
  }

  async uploadObject(
    key: string,
    body: Buffer | ReadableStream,
    mimeType: string,
  ): Promise<StorageObjectMetadata> {
    const safeKey = sanitizeObjectKey(key);
    const client = this.blob(safeKey);
    const headers = { blobContentType: mimeType };
    if (Buffer.isBuffer(body)) {
      await client.uploadData(body, { blobHTTPHeaders: headers });
    } else {
      await client.uploadStream(webToNode(body), 8 * 1024 * 1024, 4, {
        blobHTTPHeaders: headers,
      });
    }
    const props = await client.getProperties();
    return {
      key: safeKey,
      size: props.contentLength ?? 0,
      mimeType: props.contentType ?? mimeType,
      etag: (props.etag ?? '').replace(/^"|"$/g, ''),
      lastModified: props.lastModified ?? new Date(),
      ...(props.metadata ? { customMetadata: props.metadata } : {}),
    };
  }

  async downloadObject(
    key: string,
  ): Promise<{ stream: ReadableStream; metadata: StorageObjectMetadata }> {
    const safeKey = sanitizeObjectKey(key);
    const client = this.blob(safeKey);
    const response = await client.download(0);
    if (!response.readableStreamBody) throw new Error(`Azure returned no body for ${safeKey}`);
    return {
      stream: nodeToWeb(response.readableStreamBody as Readable),
      metadata: {
        key: safeKey,
        size: response.contentLength ?? 0,
        mimeType: response.contentType ?? guessMimeType(safeKey),
        etag: (response.etag ?? '').replace(/^"|"$/g, ''),
        lastModified: response.lastModified ?? new Date(),
        ...(response.metadata ? { customMetadata: response.metadata } : {}),
      },
    };
  }

  async downloadBuffer(key: string): Promise<{ buffer: Buffer; metadata: StorageObjectMetadata }> {
    const { stream, metadata } = await this.downloadObject(key);
    return { buffer: await streamToBuffer(stream), metadata };
  }

  async deleteObject(key: string): Promise<boolean> {
    const response = await this.blob(key).deleteIfExists();
    return response.succeeded;
  }

  async deleteBulkObjects(keys: string[]): Promise<{ deleted: string[]; failed: string[] }> {
    const deleted: string[] = [];
    const failed: string[] = [];
    const CONCURRENCY = 10;
    for (let i = 0; i < keys.length; i += CONCURRENCY) {
      const chunk = keys.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(chunk.map((k) => this.deleteObject(k)));
      settled.forEach((outcome, idx) => {
        const key = keys[i + idx]!;
        if (outcome.status === 'fulfilled') deleted.push(key);
        else failed.push(key);
      });
    }
    return { deleted, failed };
  }

  async generatePresignedUrl(options: PresignedUrlOptions): Promise<string> {
    if (!this.credential) {
      throw new Error(
        'Azure presigned URLs require account-name/account-key credentials (not a connection string)',
      );
    }
    const safeKey = sanitizeObjectKey(options.key);
    const startsOn = new Date();
    const expiresOn = new Date(startsOn.getTime() + options.expiresInSeconds * 1000);
    const sas = generateBlobSASQueryParameters(
      {
        containerName: this.containerName,
        blobName: safeKey,
        permissions: BlobSASPermissions.parse(options.action === 'read' ? 'r' : 'cw'),
        startsOn,
        expiresOn,
        protocol: SASProtocol.HttpsAndHttp,
        ...(options.action === 'write' && options.contentType
          ? { contentType: options.contentType }
          : {}),
      },
      this.credential,
    ).toString();
    return `${this.blob(safeKey).url}?${sas}`;
  }

  async initiateMultipartUpload(_key: string, _mimeType: string): Promise<{ uploadId: string }> {
    return { uploadId: `az_${randomUUID().replace(/-/g, '')}` };
  }

  async uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer,
  ): Promise<MultipartUploadPart> {
    const blockId = AzureBlobDriver.blockId(uploadId, partNumber);
    await this.blob(key).stageBlock(blockId, body, body.length);
    const etag = Buffer.from(`${uploadId}:${partNumber}:${body.length}`).toString('hex');
    return { partNumber, etag };
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: MultipartUploadPart[],
  ): Promise<StorageObjectMetadata> {
    const safeKey = sanitizeObjectKey(key);
    const blockIds = [...parts]
      .sort((a, b) => a.partNumber - b.partNumber)
      .map((p) => AzureBlobDriver.blockId(uploadId, p.partNumber));
    const client = this.blob(safeKey);
    await client.commitBlockList(blockIds, {
      blobHTTPHeaders: { blobContentType: guessMimeType(safeKey) },
    });
    const props = await client.getProperties();
    return {
      key: safeKey,
      size: props.contentLength ?? 0,
      mimeType: props.contentType ?? guessMimeType(safeKey),
      etag: (props.etag ?? '').replace(/^"|"$/g, ''),
      lastModified: props.lastModified ?? new Date(),
    };
  }

  async abortMultipartUpload(_key: string, _uploadId: string): Promise<void> {
    // See class-level NOTE: uncommitted Azure blocks are GC'd by the
    // platform. Nothing to call server-side; the janitor drops the registry
    // entry after invoking this advisory hook.
  }

  async listObjects(prefix?: string, limit?: number): Promise<StorageObjectMetadata[]> {
    const out: StorageObjectMetadata[] = [];
    const max = limit ?? 1000;
    for await (const blob of this.container.listBlobsFlat({
      ...(prefix ? { prefix } : {}),
    })) {
      out.push({
        key: blob.name,
        size: blob.properties.contentLength ?? 0,
        mimeType: blob.properties.contentType ?? guessMimeType(blob.name),
        etag: (blob.properties.etag ?? '').replace(/^"|"$/g, ''),
        lastModified: blob.properties.lastModified ?? new Date(0),
      });
      if (out.length >= max) break;
    }
    return out;
  }

  async objectExists(key: string): Promise<boolean> {
    return this.blob(key).exists();
  }
}
