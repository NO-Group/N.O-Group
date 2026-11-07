import { useCallback, useEffect, useState } from 'react';
import { api } from './lib/api';
import { formatUptime } from './lib/format';
import type {
  ObjectsResponse,
  ProviderDescriptor,
  SystemInfo,
  WebhookFeed,
} from './lib/types';
import {
  IconMedia,
  IconOverview,
  IconSettings,
  IconShield,
  IconStorage,
  IconWebhook,
} from './components/icons';
import { OverviewPage } from './pages/OverviewPage';
import { StoragePage } from './pages/StoragePage';
import { MediaPage } from './pages/MediaPage';
import { WebhooksPage } from './pages/WebhooksPage';
import { SettingsPage } from './pages/SettingsPage';

type Page = 'overview' | 'storage' | 'media' | 'webhooks' | 'settings';

interface Toast {
  id: number;
  message: string;
  kind: 'error' | 'ok';
}

const NAV: Array<{ id: Page; label: string; icon: (p: { className?: string }) => JSX.Element }> = [
  { id: 'overview', label: 'Overview', icon: IconOverview },
  { id: 'storage', label: 'Storage', icon: IconStorage },
  { id: 'media', label: 'Media Pipeline', icon: IconMedia },
  { id: 'webhooks', label: 'Webhooks', icon: IconWebhook },
  { id: 'settings', label: 'Settings', icon: IconSettings },
];

const PAGE_TITLES: Record<Page, string> = {
  overview: 'Platform overview',
  storage: 'Storage console',
  media: 'Media pipeline',
  webhooks: 'Webhook events',
  settings: 'Engine settings',
};

export default function App(): JSX.Element {
  const [page, setPage] = useState<Page>('overview');
  const [providers, setProviders] = useState<ProviderDescriptor[]>([]);
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [objects, setObjects] = useState<ObjectsResponse | null>(null);
  const [feed, setFeed] = useState<WebhookFeed | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [engineUp, setEngineUp] = useState(true);

  const notify = useCallback((message: string, kind: 'error' | 'ok' = 'ok'): void => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, message, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5200);
  }, []);

  const refreshCore = useCallback(async (): Promise<void> => {
    try {
      const [infoRes, providersRes, objectsRes, feedRes] = await Promise.all([
        api.systemInfo(),
        api.providers(),
        api.listObjects(),
        api.webhookFeed(),
      ]);
      setInfo(infoRes);
      setProviders(providersRes.providers);
      setObjects(objectsRes);
      setFeed(feedRes);
      setEngineUp(true);
    } catch {
      setEngineUp(false);
    }
  }, []);

  useEffect(() => {
    void refreshCore();
    const interval = setInterval(() => void refreshCore(), 12_000);
    return () => clearInterval(interval);
  }, [refreshCore]);

  const onProvidersChanged = useCallback(
    (next: ProviderDescriptor[]): void => {
      setProviders(next);
      void refreshCore();
    },
    [refreshCore],
  );

  const active = providers.find((p) => p.active);

  return (
    <div className="shell">
      {/* ---------------- sidebar ---------------- */}
      <aside className="sidebar">
        <div className="sidebar__brand">
          <img src="/nogroup-logo.png" alt="N.O Group" />
          <div>
            <div className="sidebar__brand-name spectrum-text" style={{ backgroundSize: '300% 100%' }}>
              VORTEX
            </div>
            <div className="sidebar__brand-sub">N.O Group</div>
          </div>
        </div>

        <nav className="nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`nav__item ${page === item.id ? 'nav__item--active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              <item.icon />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar__foot">
          <div className="engine-chip">
            <div className="engine-chip__label">Active engine</div>
            <div className={`engine-chip__value vtx-stop-${active?.accentStop ?? 6}`}>
              <span className="engine-chip__dot" />
              {active?.label ?? 'loading…'}
            </div>
            <div className="engine-chip__health">
              <span>engine</span>
              <b className={engineUp ? '' : 'pulse-dot'} style={engineUp ? {} : { color: 'var(--vtx-stop-3)' }}>
                {engineUp ? '● online' : '○ offline'}
              </b>
              {info && <span>up {formatUptime(info.uptimeSeconds)}</span>}
            </div>
          </div>
        </div>
      </aside>

      {/* ---------------- main column ---------------- */}
      <div className="shell__main">
        <header className="topbar">
          <div>
            <div className="topbar__title">{PAGE_TITLES[page]}</div>
            <div className="topbar__crumb">no-group.org · vortex / {page}</div>
          </div>
          <div className="topbar__spacer" />
          <span className="badge">
            <IconShield style={{ width: 13, height: 13 }} />
            {info?.authDisabled === false ? 'JWT + RLS' : 'dev auth bypass'}
          </span>
          <span className="badge badge--gradient">
            <span className="badge__dot" />
            v1.0.0
          </span>
        </header>

        <main className="page">
          {page === 'overview' && (
            <OverviewPage
              info={info}
              providers={providers}
              objects={objects}
              feed={feed}
              onNavigate={(target) => setPage(target)}
            />
          )}
          {page === 'storage' && (
            <StoragePage
              providers={providers}
              onProvidersChanged={onProvidersChanged}
              notify={notify}
            />
          )}
          {page === 'media' && <MediaPage notify={notify} />}
          {page === 'webhooks' && <WebhooksPage />}
          {page === 'settings' && <SettingsPage providers={providers} info={info} />}
        </main>
      </div>

      {/* ---------------- toasts ---------------- */}
      <div>
        {toasts.map((toast, i) => (
          <div
            key={toast.id}
            className={`toast ${toast.kind === 'error' ? 'toast--error' : ''}`}
            style={{ bottom: 22 + i * 56 }}
          >
            {toast.kind === 'error' ? '⚠ ' : '✓ '}
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
