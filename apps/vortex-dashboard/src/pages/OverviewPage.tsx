import type { ObjectsResponse, ProviderDescriptor, SystemInfo, WebhookFeed } from '../lib/types';
import { formatBytes, formatUptime } from '../lib/format';

interface OverviewPageProps {
  info: SystemInfo | null;
  providers: ProviderDescriptor[];
  objects: ObjectsResponse | null;
  feed: WebhookFeed | null;
  onNavigate: (page: 'storage' | 'media' | 'webhooks' | 'settings') => void;
}

const CAPABILITIES: Array<{ title: string; body: string; stop: number }> = [
  { title: 'Presigned direct uploads', body: 'Time-limited signed URLs let browsers PUT straight to cloud — API memory never in the path.', stop: 1 },
  { title: 'Chunked multipart ingest', body: 'Initiate / upload-part / complete with orphaned sessions auto-aborted after 24h.', stop: 2 },
  { title: 'Bulk asset purging', body: 'Batch-delete up to 1,000 keys per call with automatic parallel fallback execution.', stop: 3 },
  { title: 'Signed event webhooks', body: 'HMAC-SHA256 X-Vortex-Signature headers with exponential-backoff delivery.', stop: 4 },
  { title: 'Edge image transforms', body: 'On-the-fly WebP/AVIF resize & re-encode with immutable renditions caching.', stop: 5 },
  { title: 'Row-level access (RLS)', body: 'JWT claims verified against object paths — buckets/user-avatars/{sub}/* enforced.', stop: 6 },
];

export function OverviewPage({ info, providers, objects, feed, onNavigate }: OverviewPageProps): JSX.Element {
  const totalBytes = (objects?.objects ?? []).reduce((acc, o) => acc + o.size, 0);
  const active = providers.find((p) => p.active);
  const configured = providers.filter((p) => p.configured).length;

  return (
    <div className="section-stack">
      <div className="hero glass">
        <span className="eyebrow">N.O GROUP · NO-GROUP.ORG</span>
        <h1 className="hero__title">
          <span className="spectrum-text">Vortex</span> Storage Engine
        </h1>
        <p className="hero__sub">
          One strict driver contract — six targets. Cloudflare R2, AWS S3, DigitalOcean Spaces,
          Google Cloud Storage, Azure Blob and local disk, unified behind a single S3-compatible
          surface with Cloudinary-style media pipelines on top.
        </p>
        <div className="hero__actions">
          <button className="btn btn--spectrum" onClick={() => onNavigate('storage')}>
            Open storage console
          </button>
          <button className="btn" onClick={() => onNavigate('media')}>
            Try edge rendering
          </button>
        </div>
      </div>

      <div className="grid grid--4">
        <div className="card stat">
          <span className="stat__label">Objects stored</span>
          <span className="stat__value">{objects ? objects.count.toLocaleString() : '—'}</span>
          <span className="stat__sub">{objects ? formatBytes(totalBytes) : 'loading…'} on {active?.label ?? '…'}</span>
          <div className="stat__bar"><i /></div>
        </div>
        <div className="card stat">
          <span className="stat__label">Active engine</span>
          <span className="stat__value" style={{ fontSize: 19 }}>
            {active?.label ?? '—'}
          </span>
          <span className="stat__sub">{configured} / {providers.length} providers configured</span>
          <div className="stat__bar"><i style={{ width: `${(configured / Math.max(providers.length, 1)) * 100}%` }} /></div>
        </div>
        <div className="card stat">
          <span className="stat__label">Webhook events</span>
          <span className="stat__value">{feed ? feed.events.length.toLocaleString() : '—'}</span>
          <span className="stat__sub">{feed?.endpoints.length ?? 0} endpoint(s) registered</span>
          <div className="stat__bar"><i /></div>
        </div>
        <div className="card stat">
          <span className="stat__label">Engine uptime</span>
          <span className="stat__value">{info ? formatUptime(info.uptimeSeconds) : '—'}</span>
          <span className="stat__sub">
            {info ? `${info.janitor.pendingUploads} multipart session(s) pending` : 'loading…'}
          </span>
          <div className="stat__bar"><i /></div>
        </div>
      </div>

      <div>
        <div className="row row--between" style={{ marginBottom: 14 }}>
          <span className="eyebrow">PIPELINE CAPABILITIES</span>
          <hr className="divider-spectrum" style={{ flex: 1, marginLeft: 14 }} />
        </div>
        <div className="grid grid--3">
          {CAPABILITIES.map((cap) => (
            <div className={`card vtx-stop-${cap.stop}`} key={cap.title}>
              <div
                style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: 'var(--stop)', boxShadow: '0 0 12px var(--stop)',
                  marginBottom: 12,
                }}
              />
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{cap.title}</div>
              <div className="small dim">{cap.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
