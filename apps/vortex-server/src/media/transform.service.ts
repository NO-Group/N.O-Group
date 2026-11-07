import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from '../core/http.js';
import type { Logger } from '../core/logger.js';
import type { IVortexStorageDriver } from '../core/types/storage.types.js';

/* ================================================================== *
 *  Dynamic Edge Image Transformation                                  *
 *                                                                    *
 *  `GET /v1/storage/render?path=…&w=…&h=…&fmt=…&q=…&fit=…`            *
 *                                                                    *
 *  Resizes/re-encodes originals on the fly (PNG → WebP/AVIF,           *
 *  cover/contain/… cropping) and caches every rendition on disk       *
 *  keyed by a sha256 of (provider, key, params). Sharp is loaded      *
 *  dynamically so the engine still boots if native binaries are       *
 *  unavailable — renders then answer 501 CAPABILITY_UNAVAILABLE.      *
 * ================================================================== */

export const RENDER_FORMATS = ['webp', 'avif', 'jpeg', 'png'] as const;
export const RENDER_FITS = ['cover', 'contain', 'fill', 'inside', 'outside'] as const;

export type RenderFormat = (typeof RENDER_FORMATS)[number];
export type RenderFit = (typeof RENDER_FITS)[number];

export interface RenderParams {
  path: string;
  w?: number;
  h?: number;
  fmt?: RenderFormat;
  q?: number;
  fit?: RenderFit;
}

export interface RenderedAsset {
  buffer: Buffer;
  contentType: string;
  etag: string;
  cacheHit: boolean;
  params: Required<Omit<RenderParams, 'w' | 'h' | 'fmt' | 'q' | 'fit'>> &
    Pick<RenderParams, 'w' | 'h' | 'fmt' | 'q' | 'fit'>;
}

import type { Sharp, SharpOptions } from 'sharp';

type SharpFactory = (input?: Buffer | string, options?: SharpOptions) => Sharp;

let sharpPromise: Promise<SharpFactory | null> | undefined;

/** Load sharp exactly once; resolves to null when native bindings missing. */
export function loadSharp(logger: Logger): Promise<SharpFactory | null> {
  sharpPromise ??= import('sharp')
    .then((module) => module.default as SharpFactory)
    .catch((error: unknown) => {
      logger.warn('sharp native module unavailable — /render will answer 501', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    });
  return sharpPromise;
}

export class TransformService {
  constructor(
    private readonly cacheDir: string,
    private readonly logger: Logger,
  ) {}

  /** Strictly parse and validate the render query string. */
  static parseParams(query: Record<string, unknown>): RenderParams {
    const rawPath = query['path'];
    if (typeof rawPath !== 'string' || rawPath.length === 0) {
      throw HttpError.badRequest('Query parameter "path" is required');
    }
    const params: RenderParams = { path: rawPath };

    const numeric = (name: string, min: number, max: number): number | undefined => {
      const raw = query[name];
      if (raw === undefined) return undefined;
      const value = Number.parseInt(String(raw), 10);
      if (!Number.isFinite(value) || value < min || value > max) {
        throw HttpError.badRequest(`Query parameter "${name}" must be an integer ${min}–${max}`);
      }
      return value;
    };

    const w = numeric('w', 1, 4096);
    const h = numeric('h', 1, 4096);
    const q = numeric('q', 1, 100);
    if (w !== undefined) params.w = w;
    if (h !== undefined) params.h = h;
    if (q !== undefined) params.q = q;

    if (query['fmt'] !== undefined) {
      const fmt = String(query['fmt']);
      if (!(RENDER_FORMATS as readonly string[]).includes(fmt)) {
        throw HttpError.badRequest(`"fmt" must be one of ${RENDER_FORMATS.join(', ')}`);
      }
      params.fmt = fmt as RenderFormat;
    }

    if (query['fit'] !== undefined) {
      const fit = String(query['fit']);
      if (!(RENDER_FITS as readonly string[]).includes(fit)) {
        throw HttpError.badRequest(`"fit" must be one of ${RENDER_FITS.join(', ')}`);
      }
      params.fit = fit as RenderFit;
    }

    return params;
  }

  private cacheKey(provider: string, params: RenderParams): string {
    const hash = createHash('sha256')
      .update(
        JSON.stringify({
          provider,
          path: params.path,
          w: params.w ?? 0,
          h: params.h ?? 0,
          fmt: params.fmt ?? 'orig',
          q: params.q ?? 0,
          fit: params.fit ?? 'cover',
        }),
      )
      .digest('hex')
      .slice(0, 32);
    return `${hash}.${params.fmt ?? 'bin'}`;
  }

  /**
   * Render (or fetch from cache) a transformed asset. Callers are
   * responsible for dispatching `transform.rendered` on cache misses.
   */
  async render(
    driver: IVortexStorageDriver & { downloadBuffer?(key: string): Promise<{ buffer: Buffer }> },
    params: RenderParams,
  ): Promise<RenderedAsset> {
    const file = this.cacheKey(driver.provider, params);
    const cachedPath = path.join(this.cacheDir, file);

    try {
      const info = await stat(cachedPath);
      const buffer = await readFile(cachedPath);
      return {
        buffer,
        contentType: `image/${params.fmt ?? 'png'}`,
        etag: createHash('md5').update(buffer).digest('hex'),
        cacheHit: true,
        params: { path: params.path, w: params.w, h: params.h, fmt: params.fmt, q: params.q, fit: params.fit },
      };
    } catch {
      /* cache miss — fall through */
    }

    const sharp = await loadSharp(this.logger);
    if (!sharp) {
      throw HttpError.unavailable(
        'Image transformation unavailable: sharp native bindings are not installed on this node',
      );
    }

    let source: Buffer;
    try {
      if (typeof driver.downloadBuffer !== 'function') {
        const { stream } = await driver.downloadObject(params.path);
        const { streamToBuffer } = await import('../core/stream.utils.js');
        source = await streamToBuffer(stream);
      } else {
        source = (await driver.downloadBuffer(params.path)).buffer;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        throw HttpError.notFound(`Original not found: ${params.path}`);
      }
      throw error;
    }

    let pipeline = sharp(source, { failOn: 'none' });
    if (params.w !== undefined || params.h !== undefined) {
      pipeline = pipeline.resize(params.w ?? null, params.h ?? null, {
        fit: params.fit ?? 'cover',
        withoutEnlargement: true,
      });
    }
    const quality = params.q ?? 80;
    const fmt = params.fmt ?? 'webp';
    switch (fmt) {
      case 'webp':
        pipeline = pipeline.webp({ quality });
        break;
      case 'avif':
        pipeline = pipeline.avif({ quality });
        break;
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        break;
      case 'png':
        pipeline = pipeline.png({ compressionLevel: 9 });
        break;
    }

    const buffer = await pipeline.toBuffer();
    await mkdir(this.cacheDir, { recursive: true });
    await writeFile(cachedPath, buffer);

    this.logger.info('rendered transform', {
      provider: driver.provider,
      path: params.path,
      file,
      bytes: buffer.length,
    });

    return {
      buffer,
      contentType: `image/${fmt}`,
      etag: createHash('md5').update(buffer).digest('hex'),
      cacheHit: false,
      params: { path: params.path, w: params.w, h: params.h, fmt: params.fmt, q: params.q, fit: params.fit },
    };
  }
}
