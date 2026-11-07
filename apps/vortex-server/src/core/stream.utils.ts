import { createHash, randomUUID } from 'node:crypto';
import { PassThrough, Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

/** Narrow an unknown body to a web ReadableStream. */
export function isWebStream(body: unknown): body is WebReadableStream {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as { getReader?: unknown }).getReader === 'function'
  );
}

/** Web ReadableStream → Node Readable (for SDKs that want Node streams). */
export function webToNode(stream: WebReadableStream): Readable {
  return Readable.fromWeb(stream as Parameters<typeof Readable.fromWeb>[0]);
}

/** Node Readable → web ReadableStream (drivers honor the public contract). */
export function nodeToWeb(stream: Readable): WebReadableStream {
  return Readable.toWeb(stream) as unknown as WebReadableStream;
}

/** Fully drain a web or node stream into a Buffer. */
export async function streamToBuffer(stream: WebReadableStream | Readable): Promise<Buffer> {
  const nodeStream = isWebStream(stream) ? webToNode(stream) : stream;
  const chunks: Buffer[] = [];
  for await (const chunk of nodeStream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks);
}

/**
 * A PassThrough that incrementally computes an MD5 ETag of every byte it
 * forwards — used by the local-disk engine to tag files while streaming.
 */
export class HashingPassThrough extends PassThrough {
  private readonly hash = createHash('md5');

  override _transform(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null, data?: Buffer | string) => void,
  ): void {
    this.hash.update(chunk as Buffer);
    callback(null, chunk);
  }

  digest(): string {
    return this.hash.digest('hex');
  }
}

export function md5Of(buffer: Buffer): string {
  return createHash('md5').update(buffer).digest('hex');
}

export function newUploadId(): string {
  return `vtx_${randomUUID().replace(/-/g, '')}`;
}

/** POSIX-safe object key guard — blocks traversal outside the engine root. */
export function sanitizeObjectKey(key: string): string {
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('Object key must be a non-empty string');
  }
  if (key.length > 1024) throw new Error('Object key exceeds 1024 characters');
  const trimmed = key.replace(/^\/+/, '');
  const segments = trimmed.split('/');
  for (const segment of segments) {
    if (segment === '..' || segment === '.') {
      throw new Error(`Illegal path segment "${segment}" in object key`);
    }
  }
  if (/[\0\r\n]/.test(trimmed)) throw new Error('Object key contains illegal control characters');
  return trimmed;
}

/* ------------------------------------------------------------------ */
/*  Minimal MIME table — avoids a runtime dependency for a lookup.    */
/* ------------------------------------------------------------------ */

const MIME_TABLE: Record<string, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  pdf: 'application/pdf',
  json: 'application/json',
  xml: 'application/xml',
  zip: 'application/zip',
  gz: 'application/gzip',
  tar: 'application/x-tar',
  wasm: 'application/wasm',
  js: 'text/javascript',
  mjs: 'text/javascript',
  css: 'text/css',
  html: 'text/html',
  htm: 'text/html',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
};

export function guessMimeType(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  return MIME_TABLE[ext] ?? 'application/octet-stream';
}
