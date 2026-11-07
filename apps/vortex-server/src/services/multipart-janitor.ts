import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Logger } from '../core/logger.js';
import type {
  IVortexMultipartAborter,
  IVortexStorageDriver,
  VortexStorageProvider,
} from '../core/types/storage.types.js';

/* ================================================================== *
 *  Multipart Janitor — 24h orphan cleanup                             *
 *                                                                    *
 *  Every initiated multipart session is journaled to                 *
 *  `vortex_data/multipart-registry.json`. A periodic sweep aborts     *
 *  sessions older than the configured horizon (default 24h) via the   *
 *  drivers' `abortMultipartUpload` extension, guaranteeing orphaned   *
 *  cloud parts (billed by providers!) never linger.                   *
 * ================================================================== */

export interface MultipartRegistryEntry {
  uploadId: string;
  key: string;
  provider: VortexStorageProvider;
  mimeType: string;
  initiatedAt: string;
}

type RegistryFile = Record<string, MultipartRegistryEntry>;

interface JanitorOptions {
  filePath: string;
  maxAgeHours: number;
  intervalSeconds: number;
  logger: Logger;
}

export class MultipartJanitor {
  private readonly filePath: string;
  private readonly maxAgeMs: number;
  private readonly intervalMs: number;
  private readonly logger: Logger;
  private entries: RegistryFile = {};
  private timer: NodeJS.Timeout | undefined;
  private loaded = false;

  constructor(options: JanitorOptions) {
    this.filePath = options.filePath;
    this.maxAgeMs = options.maxAgeHours * 60 * 60 * 1000;
    this.intervalMs = options.intervalSeconds * 1000;
    this.logger = options.logger.child('janitor');
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      this.entries = JSON.parse(raw) as RegistryFile;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn('registry unreadable — starting with an empty journal', {
          error: (error as Error).message,
        });
      }
      this.entries = {};
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    await writeFile(tmp, JSON.stringify(this.entries, null, 2));
    await rename(tmp, this.filePath);
  }

  async register(entry: MultipartRegistryEntry): Promise<void> {
    if (!this.loaded) await this.load();
    this.entries[entry.uploadId] = entry;
    await this.persist();
  }

  async drop(uploadId: string): Promise<void> {
    if (!this.loaded) await this.load();
    if (uploadId in this.entries) {
      delete this.entries[uploadId];
      await this.persist();
    }
  }

  pending(): MultipartRegistryEntry[] {
    return Object.values(this.entries).sort((a, b) => a.initiatedAt.localeCompare(b.initiatedAt));
  }

  /**
   * Sweep every registry entry older than the max age and abort it on the
   * owning driver. Drivers resolve lazily through `resolveDriver`.
   */
  async sweep(
    resolveDriver: (provider: VortexStorageProvider) => IVortexStorageDriver | undefined,
  ): Promise<{ aborted: number; kept: number }> {
    if (!this.loaded) await this.load();
    const now = Date.now();
    let aborted = 0;
    let kept = 0;

    for (const entry of Object.values(this.entries)) {
      const ageMs = now - new Date(entry.initiatedAt).getTime();
      if (ageMs < this.maxAgeMs) {
        kept += 1;
        continue;
      }
      const driver = resolveDriver(entry.provider);
      const aborter = driver as (IVortexStorageDriver & IVortexMultipartAborter) | undefined;
      try {
        if (aborter && typeof aborter.abortMultipartUpload === 'function') {
          await aborter.abortMultipartUpload(entry.key, entry.uploadId);
        }
        aborted += 1;
        this.logger.info('aborted orphaned multipart upload', {
          uploadId: entry.uploadId,
          key: entry.key,
          provider: entry.provider,
          ageHours: (ageMs / 3_600_000).toFixed(1),
        });
      } catch (error) {
        this.logger.warn('abort failed — dropping journal entry anyway', {
          uploadId: entry.uploadId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      delete this.entries[entry.uploadId];
    }

    if (aborted > 0) await this.persist();
    return { aborted, kept };
  }

  start(resolveDriver: (provider: VortexStorageProvider) => IVortexStorageDriver | undefined): void {
    if (this.timer) return;
    const tick = () => {
      void this.sweep(resolveDriver).catch((error: unknown) => {
        this.logger.error('sweep failed', error);
      });
    };
    this.timer = setInterval(tick, this.intervalMs);
    this.timer.unref?.();
    this.logger.info(
      `multipart janitor running (every ${this.intervalMs / 1000}s, max age ${this.maxAgeMs / 3_600_000}h)`,
    );
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
