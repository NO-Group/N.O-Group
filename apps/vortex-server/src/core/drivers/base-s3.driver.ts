import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
  UploadPartCommand,
  type CompletedPart,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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
  IVortexMultipartAborter,
  IVortexStorageDriver,
  MultipartUploadPart,
  PresignedUrlOptions,
  StorageObjectMetadata,
  VortexStorageProvider,
} from '../types/storage.types.js';

export interface BaseS3DriverOptions {
  bucket: string;
  client: S3Client;
}

function cleanEtag(etag: string | undefined): string {
  return (etag ?? '').replace(/^"|"$/g, '');
}

function isNotFound(error: unknown): boolean {
  if (error instanceof S3ServiceException) {
    return (
      error.name === 'NotFound' ||
      error.name === 'NoSuchKey' ||
      error.$metadata?.httpStatusCode === 404
    );
  }
  return false;
}

/**
 * Abstract S3-compatible engine. Cloudflare R2, AWS S3, DigitalOcean
 * Spaces and Google Cloud Storage (S3 Interoperability XML API) all speak
 * this dialect — subclasses only configure the client endpoint/credentials.
 */
export abstract class BaseS3Driver
  implements IVortexStorageDriver, IVortexMultipartAborter
{
  abstract readonly provider: VortexStorageProvider;

  protected readonly bucket: string;
  protected readonly client: S3Client;

  protected constructor(options: BaseS3DriverOptions) {
    this.bucket = options.bucket;
    this.client = options.client;
  }

  async uploadObject(
    key: string,
    body: Buffer | ReadableStream,
    mimeType: string,
  ): Promise<StorageObjectMetadata> {
    const safeKey = sanitizeObjectKey(key);
    const payload = isWebStream(body) ? webToNode(body) : body;
    const result = await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: safeKey,
        Body: payload,
        ContentType: mimeType,
      }),
    );
    return {
      key: safeKey,
      size: result.Size ?? 0,
      mimeType,
      etag: cleanEtag(result.ETag),
      lastModified: new Date(),
    };
  }

  async downloadObject(
    key: string,
  ): Promise<{ stream: ReadableStream; metadata: StorageObjectMetadata }> {
    const safeKey = sanitizeObjectKey(key);
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: safeKey }),
    );
    const nodeStream = result.Body as Readable;
    return {
      stream: nodeToWeb(nodeStream),
      metadata: {
        key: safeKey,
        size: result.ContentLength ?? 0,
        mimeType: result.ContentType ?? guessMimeType(safeKey),
        etag: cleanEtag(result.ETag),
        lastModified: result.LastModified ?? new Date(),
        ...(result.Metadata ? { customMetadata: result.Metadata } : {}),
      },
    };
  }

  /** Helper consumed by the media pipeline (not part of the public contract). */
  async downloadBuffer(key: string): Promise<{ buffer: Buffer; metadata: StorageObjectMetadata }> {
    const { stream, metadata } = await this.downloadObject(key);
    return { buffer: await streamToBuffer(stream), metadata };
  }

  async deleteObject(key: string): Promise<boolean> {
    const safeKey = sanitizeObjectKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: safeKey }));
    return true;
  }

  /**
   * Batched purge (S3 `DeleteObjects` accepts up to 1,000 keys per call).
   * Falls back to bounded-parallel single deletes if the batch call fails
   * or the provider returns per-key errors that we can retry individually.
   */
  async deleteBulkObjects(keys: string[]): Promise<{ deleted: string[]; failed: string[] }> {
    const safeKeys = keys.map(sanitizeObjectKey);
    const deleted: string[] = [];
    const failed: string[] = [];

    const CHUNK = 1000;
    for (let i = 0; i < safeKeys.length; i += CHUNK) {
      const chunk = safeKeys.slice(i, i + CHUNK);
      try {
        const result = await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: false },
          }),
        );
        const okKeys = new Set((result.Deleted ?? []).map((d) => d.Key ?? ''));
        const erroredKeys = new Set((result.Errors ?? []).map((e) => e.Key ?? ''));
        for (const key of chunk) {
          if (erroredKeys.has(key)) failed.push(key);
          else if (okKeys.has(key) || erroredKeys.size === 0) deleted.push(key);
        }
      } catch {
        // Batch endpoint rejected — fallback: bounded parallel single deletes.
        const CONCURRENCY = 10;
        for (let j = 0; j < chunk.length; j += CONCURRENCY) {
          const slice = chunk.slice(j, j + CONCURRENCY);
          const settled = await Promise.allSettled(slice.map((k) => this.deleteObject(k)));
          settled.forEach((outcome, idx) => {
            const key = slice[idx]!;
            if (outcome.status === 'fulfilled') deleted.push(key);
            else failed.push(key);
          });
        }
      }
    }
    return { deleted, failed };
  }

  async generatePresignedUrl(options: PresignedUrlOptions): Promise<string> {
    const safeKey = sanitizeObjectKey(options.key);
    const command =
      options.action === 'write'
        ? new PutObjectCommand({
            Bucket: this.bucket,
            Key: safeKey,
            ...(options.contentType ? { ContentType: options.contentType } : {}),
          })
        : new GetObjectCommand({ Bucket: this.bucket, Key: safeKey });
    return getSignedUrl(this.client, command, { expiresIn: options.expiresInSeconds });
  }

  async initiateMultipartUpload(key: string, mimeType: string): Promise<{ uploadId: string }> {
    const safeKey = sanitizeObjectKey(key);
    const result = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: safeKey,
        ContentType: mimeType,
      }),
    );
    return { uploadId: result.UploadId ?? '' };
  }

  async uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer,
  ): Promise<MultipartUploadPart> {
    const safeKey = sanitizeObjectKey(key);
    const result = await this.client.send(
      new UploadPartCommand({
        Bucket: this.bucket,
        Key: safeKey,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: body,
        ContentLength: body.length,
      }),
    );
    return { partNumber, etag: cleanEtag(result.ETag) };
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: MultipartUploadPart[],
  ): Promise<StorageObjectMetadata> {
    const safeKey = sanitizeObjectKey(key);
    const sorted: CompletedPart[] = [...parts]
      .sort((a, b) => a.partNumber - b.partNumber)
      .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag }));
    const result = await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: safeKey,
        UploadId: uploadId,
        MultipartUpload: { Parts: sorted },
      }),
    );
    const head = await this.headMetadata(safeKey).catch(() => null);
    return (
      head ?? {
        key: safeKey,
        size: 0,
        mimeType: guessMimeType(safeKey),
        etag: cleanEtag(result.ETag),
        lastModified: new Date(),
      }
    );
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    const safeKey = sanitizeObjectKey(key);
    await this.client.send(
      new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: safeKey, UploadId: uploadId }),
    );
  }

  /**
   * NOTE: the S3 List API does not return Content-Type per object, so the
   * mime type for listed entries is inferred from the key extension.
   */
  async listObjects(prefix?: string, limit?: number): Promise<StorageObjectMetadata[]> {
    const out: StorageObjectMetadata[] = [];
    let continuationToken: string | undefined;
    const max = limit ?? 1000;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          ...(prefix ? { Prefix: prefix } : {}),
          MaxKeys: Math.min(1000, max - out.length),
          ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
        }),
      );
      for (const obj of page.Contents ?? []) {
        if (!obj.Key) continue;
        out.push({
          key: obj.Key,
          size: obj.Size ?? 0,
          mimeType: guessMimeType(obj.Key),
          etag: cleanEtag(obj.ETag),
          lastModified: obj.LastModified ?? new Date(0),
        });
        if (out.length >= max) return out;
      }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);
    return out;
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: sanitizeObjectKey(key) }),
      );
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }

  protected async headMetadata(key: string): Promise<StorageObjectMetadata> {
    const head = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return {
      key,
      size: head.ContentLength ?? 0,
      mimeType: head.ContentType ?? guessMimeType(key),
      etag: cleanEtag(head.ETag),
      lastModified: head.LastModified ?? new Date(),
      ...(head.Metadata ? { customMetadata: head.Metadata } : {}),
    };
  }
}
