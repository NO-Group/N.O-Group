import type { ProviderDescriptor, SystemInfo } from '../lib/types';

const PALETTE = [
  { name: 'Anchor Blue', hex: '#004BFF', stop: 1 },
  { name: 'Iridescent Lavender', hex: '#A38CFF', stop: 2 },
  { name: 'Coral Pink', hex: '#FFA1C5', stop: 3 },
  { name: 'Cyber Cyan', hex: '#00D2FF', stop: 4 },
  { name: 'Neon Mint', hex: '#00E6A6', stop: 5 },
  { name: 'Flagship Tech Green', hex: '#1BFF6B', stop: 6 },
] as const;

const SURFACES = [
  { name: 'Canvas Background', hex: '#000000', token: '--vtx-canvas', note: 'Pure AMOLED black — every layout layer' },
  { name: 'Elevated Card', hex: '#090C10', token: '--vtx-surface', note: 'Dark neutral container surface' },
  { name: 'Structural Border', hex: '#161B22', token: '--vtx-border', note: 'Crisp divider lines' },
] as const;

const DEFAULT_RLS_RULES = [
  { name: 'user-avatars-owner', pattern: '^buckets/user-avatars/([^/]+)(?:/|$)', claim: 'sub' },
  { name: 'tenant-private-docs', pattern: '^buckets/tenant-docs/([^/]+)(?:/|$)', claim: 'tenant_id' },
] as const;

interface SettingsPageProps {
  providers: ProviderDescriptor[];
  info: SystemInfo | null;
}

export function SettingsPage({ providers, info }: SettingsPageProps): JSX.Element {
  return (
    <div className="section-stack">
      <div>
        <span className="eyebrow">ENGINE CONFIGURATION</span>
        <h2 className="page__title">Settings</h2>
        <p className="page__subtitle">
          Credentials per provider are environment-driven, never stored client-side. The RLS guard
          and signature secrets rotate through the engine's environment.
        </p>
      </div>

      <div className="card">
        <div className="row row--between">
          <h3 className="card__title">Engine status</h3>
          {info && (
            <span className={`badge ${info.authDisabled ? '' : 'badge--gradient'}`}>
              <span className="badge__dot" />
              auth <b>{info.authDisabled ? 'DEV BYPASS' : 'JWT + RLS enforced'}</b>
            </span>
          )}
        </div>
        <p className="card__hint">
          Auth bypass is the documented local-dev default. Set VORTEX_AUTH_DISABLED=false and mint HS256
          JWTs (iss = vortex.no-group.org) to enforce row-level security.
        </p>
        <div className="codeblock">
{`# enforce RLS
VORTEX_AUTH_DISABLED=false
VORTEX_JWT_SECRET=<hs256-secret>
VORTEX_JWT_ISSUER=vortex.no-group.org

# object paths then bind to claims, e.g.
#   buckets/user-avatars/{user_id}/*  requires  jwt.sub == user_id`}
        </div>
      </div>

      <div className="card">
        <h3 className="card__title">Row-level security rules</h3>
        <p className="card__hint">
          Regex group 1 extracts the owner segment; the named JWT claim must equal it.
        </p>
        <div className="grid grid--2">
          {DEFAULT_RLS_RULES.map((rule) => (
            <div className="codeblock" key={rule.name}>
{`"${rule.name}"
  pattern → ${rule.pattern}
  claim   → jwt.${rule.claim}`}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="card__title">Provider credentials checklist</h3>
        <p className="card__hint">
          Live from GET /v1/storage/providers — green means all env vars present for that engine.
        </p>
        <div className="grid grid--2">
          {providers.map((provider) => (
            <div key={provider.id} className={`card vtx-stop-${provider.accentStop}`} style={{ padding: 16 }}>
              <div className="row row--between" style={{ marginBottom: 8 }}>
                <b className="small">{provider.label}</b>
                <span className={`chip ${provider.configured ? '' : 'vtx-stop-3'}`}>
                  <i /> {provider.configured ? 'configured' : 'missing vars'}
                </span>
              </div>
              <div className="provider__missing" style={{ borderTop: 'none', paddingTop: 0 }}>
                {(provider.configured ? providerEnvNames(provider.id) : provider.missingEnv).map((name) => (
                  <code
                    key={name}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      padding: '2px 7px',
                      borderRadius: 6,
                    }}
                  >
                    {provider.configured ? '✓ ' : ''}{name}
                  </code>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="card__title">N.O Group design tokens</h3>
        <p className="card__hint">
          The official 6-stop spectrum gradient and AMOLED surface stack driving this console.
        </p>
        <div className="spectrum-strip" style={{ marginBottom: 16 }} />
        <div className="grid grid--3" style={{ marginBottom: 16 }}>
          {PALETTE.map((stop) => (
            <div className="swatch" key={stop.hex}>
              <div className="swatch__color" style={{ background: stop.hex }} />
              <div className="swatch__meta">
                <div className="swatch__name">
                  {stop.stop}. {stop.name}
                </div>
                <div className="swatch__hex">{stop.hex}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid--3">
          {SURFACES.map((surface) => (
            <div className="swatch" key={surface.hex}>
              <div className="swatch__color" style={{ background: surface.hex, borderBottom: '1px solid var(--vtx-border)' }} />
              <div className="swatch__meta">
                <div className="swatch__name">{surface.name}</div>
                <div className="swatch__hex">
                  {surface.hex} · {surface.token}
                </div>
                <div className="swatch__hex" style={{ marginTop: 3 }}>{surface.note}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function providerEnvNames(id: string): string[] {
  switch (id) {
    case 'cloudflare_r2':
      return ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
    case 'aws_s3':
      return ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_BUCKET'];
    case 'digitalocean_spaces':
      return ['DO_SPACES_REGION', 'DO_SPACES_KEY', 'DO_SPACES_SECRET', 'DO_SPACES_BUCKET'];
    case 'gcs':
      return ['GCS_HMAC_ACCESS_KEY', 'GCS_HMAC_SECRET', 'GCS_BUCKET'];
    case 'azure_blob':
      return ['AZURE_STORAGE_ACCOUNT', 'AZURE_STORAGE_KEY', 'AZURE_STORAGE_CONTAINER'];
    default:
      return ['(volume ./vortex_data/storage — always ready)'];
  }
}
