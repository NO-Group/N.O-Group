import { useRef, useState } from 'react';
import { api } from '../lib/api';
import { formatBytes } from '../lib/format';
import { IconLayers, IconTrash, IconUpload } from './icons';

type Notify = (message: string, kind?: 'error' | 'ok') => void;

const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MiB demo chunks

interface MultipartProgress {
  uploadId: string;
  key: string;
  totalParts: number;
  doneParts: number;
  bytes: number;
  status: 'in-flight' | 'completed' | 'aborted' | 'failed';
}

/**
 * Chunked multipart ingest demo: slices any file into 2 MiB parts and
 * pushes them through initiate → upload-part ×N → complete, with live
 * per-part progress. Orphans older than 24h are swept by the janitor.
 */
export function MultipartDemo({ notify }: { notify: Notify }): JSX.Element {
  const [progress, setProgress] = useState<MultipartProgress | null>(null);
  const abortRef = useRef<{ key: string; uploadId: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const run = async (file: File): Promise<void> => {
    const key = `uploads/multipart/${file.name.replace(/\.\.\//g, '')}`;
    try {
      const session = await api.multipartInitiate(key, file.type || 'application/octet-stream');
      abortRef.current = { key, uploadId: session.uploadId };

      const totalParts = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
      setProgress({
        uploadId: session.uploadId,
        key,
        totalParts,
        doneParts: 0,
        bytes: file.size,
        status: 'in-flight',
      });

      const parts: { partNumber: number; etag: string }[] = [];
      for (let n = 1; n <= totalParts; n += 1) {
        const chunk = file.slice((n - 1) * CHUNK_SIZE, n * CHUNK_SIZE);
        const part = await api.multipartUploadPart(key, session.uploadId, n, chunk);
        parts.push(part);
        setProgress((prev) => (prev ? { ...prev, doneParts: n } : prev));
      }

      await api.multipartComplete(key, session.uploadId, parts);
      abortRef.current = null;
      setProgress((prev) => (prev ? { ...prev, status: 'completed' } : prev));
      notify(`Multipart ingest completed — ${file.name}`, 'ok');
    } catch (error) {
      setProgress((prev) => (prev ? { ...prev, status: 'failed' } : prev));
      notify(error instanceof Error ? error.message : 'Multipart ingest failed', 'error');
    }
  };

  const abort = async (): Promise<void> => {
    const session = abortRef.current;
    if (!session) return;
    try {
      await api.multipartAbort(session.key, session.uploadId);
      abortRef.current = null;
      setProgress((prev) => (prev ? { ...prev, status: 'aborted' } : prev));
      notify('Multipart session aborted', 'ok');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Abort failed', 'error');
    }
  };

  const pct = progress ? Math.round((progress.doneParts / progress.totalParts) * 100) : 0;

  return (
    <div className="card">
      <div className="row row--between">
        <div>
          <h3 className="card__title">Chunked Multipart Ingest</h3>
          <p className="card__hint">
            initiate → upload-part → complete, with orphaned sessions auto-swept after 24h.
          </p>
        </div>
        <div className="row">
          <button className="btn btn--sm" onClick={() => fileInput.current?.click()}>
            <IconLayers /> Ingest a file
          </button>
          {progress?.status === 'in-flight' && (
            <button className="btn btn--sm btn--danger" onClick={() => void abort()}>
              <IconTrash /> Abort
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void run(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {!progress ? (
        <div className="empty">
          Drop any file to stream it through the chunked pipeline (2 MiB parts).
        </div>
      ) : (
        <div>
          <dl className="kv" style={{ marginBottom: 14 }}>
            <dt>key</dt>
            <dd>{progress.key}</dd>
            <dt>uploadId</dt>
            <dd>{progress.uploadId}</dd>
            <dt>size</dt>
            <dd>{formatBytes(progress.bytes)}</dd>
            <dt>parts</dt>
            <dd>
              {progress.doneParts} / {progress.totalParts}
            </dd>
          </dl>
          <div className="stat__bar" style={{ height: 6 }}>
            <i style={{ transform: `scaleX(${pct / 100})`, transition: 'transform 220ms' }} />
          </div>
          <p className="small dim" style={{ marginBottom: 0, marginTop: 10 }}>
            {progress.status === 'in-flight' && (
              <>
                <IconUpload style={{ width: 12, height: 12, verticalAlign: '-1px' }} /> streaming…{' '}
                {pct}%
              </>
            )}
            {progress.status === 'completed' && (
              <b style={{ color: 'var(--vtx-stop-6)' }}>✓ committed to the active engine</b>
            )}
            {progress.status === 'aborted' && <b style={{ color: 'var(--vtx-stop-3)' }}>aborted</b>}
            {progress.status === 'failed' && <b style={{ color: '#ff8a8a' }}>failed</b>}
          </p>
        </div>
      )}
    </div>
  );
}
