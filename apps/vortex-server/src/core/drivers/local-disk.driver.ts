import { createHmac, timingSafeEqual } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream } from 'node:stream/web';
import {
  HashingPassThrough,
  guessMimeType,
  isWebStream,
  md5Of,
  newUploadId,
  nodeToWeb,
  sanitizeObjectKey,
  streamToBuffer,
  webToNode,
} from '../stream.utils';
import type {
  IVortexMultipartAborter,
  IVortexStorageDriver,
  LocalDiskDriverConfig,
  MultipartUploadPart,
  PresignedUrlOptions,
  StorageObjectMetadata,
} from '../types/storage.types';

interface MultipartMeta {
  key: string;
  mimeType: string;
  initiatedAt: string;
}

/**
 * Local Server Filesystem — zero-cost dev / Docker single-node engine.
 *
 * Reads and writes straight to a persistent volume (default
 * `./vortex_data/storage/`). Multipart sessions spill to
 * `.vortex-multipart/<uploadId>/` next to the data, and "presigned URLs"
 * are HMAC-SHA256-signed transfer URLs served by the Vortex API itself
 * (`/v1/storage/local-transfer`) — same developer ergonomics as cloud
 * presigns, with no cloud attached.
 */
export class LocalDiskDriver implements IVortexStorageDriver, IVortexMultipartAborter {
  readonly provider = 'local_disk' as const;

  private readonly rootDir: string;
  private readonly multipartRoot: string;
  private readonly publicBaseUrl: string;
  private readonly signingSecret: string;

  constructor(config: LocalDiskDriverConfig) {
    this.rootDir = path.resolve(config.rootDir);
    this.multipartRoot = path.join(this.rootDir, '.vortex-multipart');
    this.publicBaseUrl = config.publicBaseUrl.replace(/\/+$/, '');
    this.signingSecret = config.signingSecret;
  }

  /* ---------------- path safety ---------------- */

  get storageRoot(): string {
    return this.rootDir;
  }

  private resolve(key: string): string {
    const safeKey = sanitizeObjectKey(key);
    const resolved = path.resolve(this.rootDir, safeKey);
    if (!resolved.startsWith(this.rootDir + path.sep)) {
      throw new Error(`Object key escapes storage root: ${key}`);
    }
    return resolved;
  }

  private sessionDir(uploadId: string): string {
    if (!/^[\w-]+$/.test(uploadId)) throw new Error('Malformed uploadId');
    return path.join(this.multipartRoot, uploadId);
  }

  /* ---------------- signature machinery ---------------- */

  private sign(key: string, action: 'read' | 'write', exp: number): string {
    return createHmac('sha256', this.signingSecret)
      .update(`${action}.${key}.${exp}`)
      .digest('hex');
  }

  /** Constant-time verification used by the /local-transfer route. */
  verifyTransferSignature(
    key: string,
    action: 'read' | 'write',
    exp: number,
    sig: string,
  ): boolean {
    if (exp < Math.floor(Date.now() / 1000)) return false;
    const expected = Buffer.from(this.sign(key, action, exp));
    const provided = Buffer.from(sig);
    if (expected.length !== provided.length) return false;
    return timingSafeEqual(expected, provided);
  }

  /* ---------------- contract ---------------- */

  async uploadObject(
    key: string,
    body: Buffer | ReadableStream,
    mimeType: string,
  ): Promise<StorageObjectMetadata> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });

    const source: Readable = Buffer.isBuffer(body)
      ? Readable.from([body])
      : isWebStream(body)
        ? webToNode(body)
        : Readable.from(body as AsyncIterable<Buffer>);

    const hashing = new HashingPassThrough();
    await pipeline(source, hashing, createWriteStream(target));

    const info = await stat(target);
    return {
      key: sanitizeObjectKey(key),
      size: info.size,
      mimeType: mimeType || guessMimeType(key),
      etag: hashing.digest(),
      lastModified: info.mtime,
    };
  }

  async downloadObject(
    key: string,
  ): Promise<{ stream: ReadableStream; metadata: StorageObjectMetadata }> {
    const target = this.resolve(key);
    const info = await stat(target); // ENOENT bubbles up → mapped to 404
    if (!info.isFile()) throw new Error(`Not a file: ${key}`);
    const buffer = await readFile(target);
    const metadata: StorageObjectMetadata = {
      key: sanitizeObjectKey(key),
      size: info.size,
      mimeType: guessMimeType(key),
      etag: md5Of(buffer),
      lastModified: info.mtime,
    };
    return { stream: nodeToWeb(createReadStream(target)), metadata };
  }

  /** Helper consumed by the media pipeline (not part of the public contract). */
  async downloadBuffer(key: string): Promise<{ buffer: Buffer; metadata: StorageObjectMetadata }> {
    const { stream, metadata } = await this.downloadObject(key);
    return { buffer: await streamToBuffer(stream), metadata };
  }

  async deleteObject(key: string): Promise<boolean> {
    const target = this.resolve(key);
    try {
      await rm(target, { force: false });
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  }

  async deleteBulkObjects(keys: string[]): Promise<{ deleted: string[]; failed: string[] }> {
    const deleted: string[] = [];
    const failed: string[] = [];
    const CONCURRENCY = 16;
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
    const safeKey = sanitizeObjectKey(options.key);
    const exp = Math.floor(Date.now() / 1000) + options.expiresInSeconds;
    const sig = this.sign(safeKey, options.action, exp);
    const params = new URLSearchParams({
      key: safeKey,
      action: options.action,
      exp: String(exp),
      sig,
    });
    if (options.contentType) params.set('contentType', options.contentType);
    return `${this.publicBaseUrl}/v1/storage/local-transfer?${params.toString()}`;
  }

  /* ---------------- multipart ---------------- */

  async initiateMultipartUpload(key: string, mimeType: string): Promise<{ uploadId: string }> {
    const uploadId = newUploadId();
    const dir = path.join(this.sessionDir(uploadId), 'parts');
    await mkdir(dir, { recursive: true });
    const meta: MultipartMeta = {
      key: sanitizeObjectKey(key),
      mimeType,
      initiatedAt: new Date().toISOString(),
    };
    await writeFile(path.join(this.sessionDir(uploadId), 'meta.json'), JSON.stringify(meta));
    return { uploadId };
  }

  async uploadPart(
    _key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer,
  ): Promise<MultipartUploadPart> {
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000) {
      throw new Error('partNumber must be an integer between 1 and 10,000');
    }
    const partPath = path.join(this.sessionDir(uploadId), 'parts', String(partNumber));
    await stat(path.dirname(partPath)); // throws if session never started
    await writeFile(partPath, body);
    return { partNumber, etag: md5Of(body) };
  }

  async completeMultipartUpload(
    _key: string,
    uploadId: string,
    parts: MultipartUploadPart[],
  ): Promise<StorageObjectMetadata> {
    const dir = this.sessionDir(uploadId);
    const meta = JSON.parse(await readFile(path.join(dir, 'meta.json'), 'utf8')) as MultipartMeta;
    const target = this.resolve(meta.key);
    await mkdir(path.dirname(target), { recursive: true });

    const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    const hashing = new HashingPassThrough();
    const writer = createWriteStream(target);
    const flushed = pipeline(hashing, writer);
    for (const part of sorted) {
      const chunk = await readFile(path.join(dir, 'parts', String(part.partNumber)));
      if (!hashing.write(chunk)) {
        await new Promise<void>((resolvePromise) => hashing.once('drain', () => resolvePromise()));
      }
    }
    hashing.end();
    await flushed;
    await rm(dir, { recursive: true, force: true });

    const info = await stat(target);
    return {
      key: meta.key,
      size: info.size,
      mimeType: meta.mimeType || guessMimeType(meta.key),
      etag: hashing.digest(),
      lastModified: info.mtime,
    };
  }

  async abortMultipartUpload(_key: string, uploadId: string): Promise<void> {
    await rm(this.sessionDir(uploadId), { recursive: true, force: true });
  }

  /* ---------------- enumeration ---------------- */

  async listObjects(prefix?: string, limit?: number): Promise<StorageObjectMetadata[]> {
    const out: StorageObjectMetadata[] = [];
    const max = limit ?? 1000;
    const walk = async (dir: string): Promise<void> => {
      const entries = await readdir(dir, { withFileTypes: true }).catch(
        () => [] as import('node:fs').Dirent[],
      );
      for (const entry of entries) {
        if (out.length >= max) return;
        if (entry.name === '.vortex-multipart') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
          continue;
        }
        const key = path.relative(this.rootDir, full).split(path.sep).join('/');
        if (prefix && !key.startsWith(prefix)) continue;
        const info = await stat(full);
        out.push({
          key,
          size: info.size,
          mimeType: guessMimeType(key),
          etag: '',
          lastModified: info.mtime,
        });
      }
    };
    await walk(this.rootDir);
    out.sort((a, b) => a.key.localeCompare(b.key));
    return out;
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      const info = await stat(this.resolve(key));
      return info.isFile();
    } catch {
      return false;
    }
  }
}
