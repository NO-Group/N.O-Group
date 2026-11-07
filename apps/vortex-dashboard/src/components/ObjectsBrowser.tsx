import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, objectUrl, renderUrl } from '../lib/api';
import { formatBytes, timeAgo } from '../lib/format';
import type { StorageObjectMetadata } from '../lib/types';
import { IconRefresh, IconTrash, IconUpload } from './icons';

type Notify = (message: string, kind?: 'error' | 'ok') => void;

const MAX_BULK = 1000;

export function ObjectsBrowser({ notify }: { notify: Notify }): JSX.Element {
  const [objects, setObjects] = useState<StorageObjectMetadata[] | null>(null);
  const [provider, setProvider] = useState('');
  const [prefix, setPrefix] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const res = await api.listObjects(prefix || undefined);
      setObjects(res.objects);
      setProvider(res.provider);
      setSelected(new Set());
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Failed to list objects', 'error');
    }
  }, [prefix, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const imageSet = useMemo(
    () => new Set((objects ?? []).filter((o) => o.mimeType.startsWith('image/')).map((o) => o.key)),
    [objects],
  );

  const toggle = (key: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = (): void => {
    if (!objects) return;
    setSelected((prev) => (prev.size === objects.length ? new Set() : new Set(objects.map((o) => o.key))));
  };

  const onUpload = async (file: File): Promise<void> => {
    setBusy(true);
    try {
      const key = `uploads/${file.name.replace(/\.\.\//g, '')}`;
      await api.upload(key, file, file.type || 'application/octet-stream');
      notify(`Uploaded ${key}`, 'ok');
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Upload failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (key: string): Promise<void> => {
    try {
      await api.deleteObject(key);
      notify(`Deleted ${key}`, 'ok');
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Delete failed', 'error');
    }
  };

  const onBulkDelete = async (): Promise<void> => {
    const keys = [...selected].slice(0, MAX_BULK);
    if (keys.length === 0) return;
    setBusy(true);
    try {
      const result = await api.bulkDelete(keys);
      notify(`Purged ${result.deleted.length} object(s)${result.failed.length ? ` · ${result.failed.length} failed` : ''}`, result.failed.length ? 'error' : 'ok');
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Bulk purge failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="row row--between">
        <div>
          <h3 className="card__title">Object Store</h3>
          <p className="card__hint">
            Live view of the active engine <span className="mono">{provider}</span>
          </p>
        </div>
        <div className="row">
          <input
            className="input input--mono"
            style={{ width: 210 }}
            placeholder="prefix filter (e.g. buckets/)"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
          />
          <button className="btn btn--sm" onClick={() => void load()}>
            <IconRefresh /> Refresh
          </button>
          <button className="btn btn--sm" onClick={() => fileInput.current?.click()} disabled={busy}>
            <IconUpload /> Upload
          </button>
          <input
            ref={fileInput}
            type="file"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onUpload(file);
              e.target.value = '';
            }}
          />
          <button
            className="btn btn--sm btn--danger"
            onClick={() => void onBulkDelete()}
            disabled={selected.size === 0 || busy}
          >
            <IconTrash /> Purge {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>

      {objects === null ? (
        <div className="skeleton" style={{ height: 220 }} />
      ) : objects.length === 0 ? (
        <div className="empty">No objects on this engine yet — upload something or run the seed script.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 30 }}>
                  <input
                    type="checkbox"
                    checked={selected.size === objects.length && objects.length > 0}
                    onChange={toggleAll}
                  />
                </th>
                <th style={{ width: 40 }} />
                <th>Key</th>
                <th>Type</th>
                <th>Size</th>
                <th>Modified</th>
                <th style={{ width: 130 }} />
              </tr>
            </thead>
            <tbody>
              {objects.map((object) => (
                <tr key={object.key}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(object.key)}
                      onChange={() => toggle(object.key)}
                    />
                  </td>
                  <td>
                    {imageSet.has(object.key) ? (
                      <img
                        className="thumb"
                        src={renderUrl({ path: object.key, w: 68, h: 68, fmt: 'webp', q: 60, fit: 'cover' })}
                        alt=""
                        loading="lazy"
                      />
                    ) : (
                      <span className="thumb" style={{ display: 'grid', placeItems: 'center' }}>
                        <span className="faint" style={{ fontSize: 9 }}>
                          {object.key.split('.').pop()?.slice(0, 4).toUpperCase() ?? 'FILE'}
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="key-cell" title={object.key}>
                    {object.key}
                  </td>
                  <td>
                    <span className={`mime-chip ${object.mimeType.startsWith('image/') ? 'mime-chip--image' : ''}`}>
                      {object.mimeType}
                    </span>
                  </td>
                  <td className="dim">{formatBytes(object.size)}</td>
                  <td className="faint">{timeAgo(object.lastModified)}</td>
                  <td>
                    <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                      <a className="btn btn--sm" href={objectUrl(object.key)} target="_blank" rel="noreferrer">
                        Open
                      </a>
                      <button
                        className="btn btn--sm btn--danger"
                        onClick={() => void onDelete(object.key)}
                        title="Delete object"
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
