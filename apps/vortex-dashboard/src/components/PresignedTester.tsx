import { useRef, useState } from 'react';
import { api, toBrowserUrl } from '../lib/api';
import type { PresignResponse } from '../lib/types';
import { IconBolt, IconLink, IconUpload } from './icons';

type Notify = (message: string, kind?: 'error' | 'ok') => void;

/**
 * Presigned direct-upload playground: mints a time-limited signed URL
 * from POST /v1/storage/presigned-upload and can fire an actual
 * browser→storage PUT through it, bypassing API memory entirely.
 */
export function PresignedTester({ notify }: { notify: Notify }): JSX.Element {
  const [key, setKey] = useState('uploads/direct-from-browser.bin');
  const [contentType, setContentType] = useState('application/octet-stream');
  const [expires, setExpires] = useState(900);
  const [minted, setMinted] = useState<PresignResponse | null>(null);
  const [sent, setSent] = useState<null | { status: string; bytes: number }>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const mint = async (): Promise<void> => {
    setBusy(true);
    setSent(null);
    try {
      const res = await api.presign(key, contentType, 'write', expires);
      setMinted(res);
      notify(`Signed URL minted · expires ${new Date(res.expiresAt).toLocaleTimeString()}`, 'ok');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Failed to mint URL', 'error');
    } finally {
      setBusy(false);
    }
  };

  const sendThrough = async (file: File): Promise<void> => {
    if (!minted) return;
    setBusy(true);
    try {
      const url = toBrowserUrl(minted.url);
      const res = await fetch(url, {
        method: minted.method,
        headers: { 'content-type': file.type || contentType },
        body: file,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 160)}`);
      setSent({ status: `HTTP ${res.status}`, bytes: file.size });
      notify(`Direct upload landed (${file.name}) — API memory never touched`, 'ok');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Direct upload failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h3 className="card__title">Presigned Direct Upload</h3>
      <p className="card__hint">
        Issues a time-limited signed URL (default 15 min) so browsers PUT straight to the storage
        engine — no proxying through API memory.
      </p>

      <div className="form-row" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
        <div className="field">
          <label className="field__label">Object key</label>
          <input className="input input--mono" value={key} onChange={(e) => setKey(e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label">Content type</label>
          <input className="input input--mono" value={contentType} onChange={(e) => setContentType(e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label">TTL (seconds)</label>
          <input
            className="input input--mono"
            type="number"
            min={1}
            max={3600}
            value={expires}
            onChange={(e) => setExpires(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn btn--spectrum" onClick={() => void mint()} disabled={busy}>
          <IconBolt /> Mint signed URL
        </button>
        {minted && (
          <button className="btn" onClick={() => fileInput.current?.click()} disabled={busy}>
            <IconUpload /> Send a file through it
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void sendThrough(file);
            e.target.value = '';
          }}
        />
      </div>

      {minted && (
        <div style={{ marginTop: 16 }}>
          <div className="field__label" style={{ marginBottom: 6 }}>
            <IconLink style={{ width: 12, height: 12, verticalAlign: '-1px' }} /> Signed URL (
            {minted.method} · {minted.provider})
          </div>
          <div className="codeblock" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {minted.url}
          </div>
          {sent && (
            <p className="small dim" style={{ marginBottom: 0 }}>
              Transfer result: <b style={{ color: 'var(--vtx-stop-5)' }}>{sent.status}</b> ·{' '}
              {sent.bytes} bytes delivered direct-to-engine
            </p>
          )}
        </div>
      )}
    </div>
  );
}
