import { useState } from 'react';
import { renderUrl } from '../lib/api';
import { formatBytes } from '../lib/format';
import { IconMedia } from './icons';

type Notify = (message: string, kind?: 'error' | 'ok') => void;

interface ProbeResult {
  blobUrl: string;
  cache: string;
  contentType: string;
  bytes: number;
  etag: string;
  url: string;
}

/**
 * Dynamic edge transformation playground — hits GET /v1/storage/render
 * with w/h/fmt/q/fit and shows the rendition plus the engine's cache
 * verdict (X-Vortex-Cache MISS renders & caches; HIT serves instantly).
 */
export function RenderPlayground({ notify }: { notify: Notify }): JSX.Element {
  const [path, setPath] = useState('buckets/marketing/hero-gradient.svg');
  const [w, setW] = useState(480);
  const [h, setH] = useState(0);
  const [fmt, setFmt] = useState('webp');
  const [q, setQ] = useState(80);
  const [fit, setFit] = useState('cover');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);

  const render = async (): Promise<void> => {
    setBusy(true);
    try {
      const url = renderUrl({
        path,
        w: w || undefined,
        h: h || undefined,
        fmt,
        q,
        fit,
      });
      const res = await fetch(url);
      if (!res.ok) {
        const parsed = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(parsed?.error?.message ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.blobUrl);
        return {
          blobUrl: URL.createObjectURL(blob),
          cache: res.headers.get('x-vortex-cache') ?? '—',
          contentType: res.headers.get('content-type') ?? blob.type,
          bytes: blob.size,
          etag: res.headers.get('etag') ?? '—',
          url,
        };
      });
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Render failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h3 className="card__title">Edge Image Transformation</h3>
      <p className="card__hint">
        PNG → WebP/AVIF re-encoding, cover/contain cropping and graduated quality — rendered
        on the fly, cached immutably.
      </p>

      <div className="form-row" style={{ gridTemplateColumns: '2.4fr 1fr 1fr 1fr' }}>
        <div className="field">
          <label className="field__label">Source path</label>
          <input className="input input--mono" value={path} onChange={(e) => setPath(e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label">Width</label>
          <input className="input input--mono" type="number" min={0} max={4096} value={w} onChange={(e) => setW(Number(e.target.value))} />
        </div>
        <div className="field">
          <label className="field__label">Height</label>
          <input className="input input--mono" type="number" min={0} max={4096} value={h} onChange={(e) => setH(Number(e.target.value))} />
        </div>
        <div className="field">
          <label className="field__label">Quality</label>
          <input className="input input--mono" type="number" min={1} max={100} value={q} onChange={(e) => setQ(Number(e.target.value))} />
        </div>
      </div>

      <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 2fr', marginTop: 12 }}>
        <div className="field">
          <label className="field__label">Format</label>
          <select className="select" value={fmt} onChange={(e) => setFmt(e.target.value)}>
            <option value="webp">webp</option>
            <option value="avif">avif</option>
            <option value="jpeg">jpeg</option>
            <option value="png">png</option>
          </select>
        </div>
        <div className="field">
          <label className="field__label">Fit</label>
          <select className="select" value={fit} onChange={(e) => setFit(e.target.value)}>
            <option value="cover">cover</option>
            <option value="contain">contain</option>
            <option value="fill">fill</option>
            <option value="inside">inside</option>
            <option value="outside">outside</option>
          </select>
        </div>
        <div className="field" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn--spectrum" onClick={() => void render()} disabled={busy}>
            <IconMedia /> Render at the edge
          </button>
        </div>
      </div>

      {result && (
        <div className="render-result" style={{ marginTop: 18 }}>
          <img src={result.blobUrl} alt="rendered asset" />
          <div>
            <dl className="kv">
              <dt>cache verdict</dt>
              <dd>
                <b style={{ color: result.cache === 'HIT' ? 'var(--vtx-stop-5)' : 'var(--vtx-stop-4)' }}>
                  X-Vortex-Cache: {result.cache}
                </b>
              </dd>
              <dt>content-type</dt>
              <dd>{result.contentType}</dd>
              <dt>payload</dt>
              <dd>{formatBytes(result.bytes)}</dd>
              <dt>etag</dt>
              <dd>{result.etag}</dd>
              <dt>request</dt>
              <dd>{result.url}</dd>
            </dl>
            <p className="small faint" style={{ marginBottom: 0, marginTop: 12 }}>
              Repeating this exact parameter set flips the next response to a cached HIT and fires no
              second <span className="mono">transform.rendered</span> webhook.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
