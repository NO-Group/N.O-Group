/**
 * Vortex demo seeder — puts a small, representative object set into the
 * active engine so the dashboard is alive on first boot:
 *
 *   buckets/user-avatars/dev-user/avatar.svg     (RLS-protected path)
 *   buckets/marketing/hero-gradient.svg          (gradient banner art)
 *   buckets/marketing/logo-mark.svg              (brand mark)
 *   docs/vortex/getting-started.md               (text asset)
 *
 * Run with the server up:  npm run seed --workspace apps/vortex-server
 */

const BASE = process.env['VORTEX_API'] ?? 'http://127.0.0.1:8787';
const ADMIN_KEY = process.env['VORTEX_ADMIN_KEY'] ?? 'vortex-dev-admin-key';

const GRADIENT = ['#004BFF', '#A38CFF', '#FFA1C5', '#00D2FF', '#00E6A6', '#1BFF6B'];

function heroGradientSvg(): string {
  const stops = GRADIENT.map(
    (color, i) => `<stop offset="${(i / (GRADIENT.length - 1)) * 100}%" stop-color="${color}"/>`,
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="spectrum" x1="0%" y1="0%" x2="100%" y2="100%">${stops}</linearGradient>
    <radialGradient id="glow" cx="30%" cy="20%" r="80%">
      <stop offset="0%" stop-color="#A38CFF" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#000000"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="60" y="60" width="1080" height="510" rx="40" fill="url(#spectrum)" opacity="0.9"/>
  <rect x="66" y="66" width="1068" height="498" rx="36" fill="#090C10"/>
  <text x="120" y="300" font-family="ui-sans-serif, system-ui, sans-serif" font-size="88" font-weight="800" fill="url(#spectrum)">VORTEX</text>
  <text x="120" y="370" font-family="ui-sans-serif, system-ui, sans-serif" font-size="30" fill="#8B949E">Multi-cloud storage engine · N.O Group</text>
</svg>`;
}

function avatarSvg(initials: string, hueA: string, hueB: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="512" y2="512">
    <stop offset="0%" stop-color="${hueA}"/><stop offset="100%" stop-color="${hueB}"/>
  </linearGradient></defs>
  <rect width="512" height="512" rx="128" fill="#090C10"/>
  <rect x="8" y="8" width="496" height="496" rx="120" fill="none" stroke="url(#g)" stroke-width="16"/>
  <text x="256" y="316" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="200" font-weight="800" fill="url(#g)">${initials}</text>
</svg>`;
}

function logoMarkSvg(): string {
  const stops = GRADIENT.map(
    (color, i) => `<stop offset="${(i / (GRADIENT.length - 1)) * 100}%" stop-color="${color}"/>`,
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="spectrum" x1="0%" y1="0%" x2="100%" y2="100%">${stops}</linearGradient></defs>
  <rect width="512" height="512" rx="96" fill="#000000"/>
  <path d="M128 128 L256 384 L384 128" fill="none" stroke="url(#spectrum)" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

const OBJECTS: Array<{ key: string; contentType: string; body: string | Buffer }> = [
  { key: 'buckets/user-avatars/dev-user/avatar.svg', contentType: 'image/svg+xml', body: avatarSvg('NO', '#00D2FF', '#1BFF6B') },
  { key: 'buckets/user-avatars/dev-user/banner.svg', contentType: 'image/svg+xml', body: heroGradientSvg() },
  { key: 'buckets/marketing/hero-gradient.svg', contentType: 'image/svg+xml', body: heroGradientSvg() },
  { key: 'buckets/marketing/logo-mark.svg', contentType: 'image/svg+xml', body: logoMarkSvg() },
  {
    key: 'docs/vortex/getting-started.md',
    contentType: 'text/markdown',
    body: '# Vortex Storage Engine\n\nSeeded by `scripts/seed-demo.ts`. Uploads, multipart ingest, bulk purge,\nsigned webhooks and edge renders all flow through the unified driver contract.\n',
  },
];

async function put(key: string, contentType: string, body: string | Buffer): Promise<void> {
  const res = await fetch(`${BASE}/v1/storage/upload?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
  });
  if (!res.ok) throw new Error(`upload ${key} → HTTP ${res.status}: ${await res.text()}`);
  console.log(`  ✓ ${key}`);
}

async function main(): Promise<void> {
  console.log(`Seeding Vortex engine at ${BASE} …`);
  const health = await fetch(`${BASE}/health`);
  if (!health.ok) throw new Error('engine not reachable — start it first (npm run dev:server)');
  for (const obj of OBJECTS) await put(obj.key, obj.contentType, obj.body);

  // Demonstrate one multipart session (3 chunks) end-to-end.
  const init = await fetch(`${BASE}/v1/storage/multipart/initiate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: 'datasets/ml/embeddings-sample.bin', contentType: 'application/octet-stream' }),
  }).then((r) => r.json() as Promise<{ uploadId: string }>);

  const parts: Array<{ partNumber: number; etag: string }> = [];
  for (let n = 1; n <= 3; n += 1) {
    const chunk = Buffer.alloc(64 * 1024, n); // 64 KiB patterned parts
    const res = await fetch(
      `${BASE}/v1/storage/multipart/upload-part?key=${encodeURIComponent('datasets/ml/embeddings-sample.bin')}&uploadId=${init.uploadId}&partNumber=${n}`,
      { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: chunk },
    ).then((r) => r.json() as Promise<{ partNumber: number; etag: string }>);
    parts.push(res);
  }
  const done = await fetch(`${BASE}/v1/storage/multipart/complete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: 'datasets/ml/embeddings-sample.bin', uploadId: init.uploadId, parts }),
  });
  if (!done.ok) throw new Error(`multipart complete → HTTP ${done.status}`);
  console.log('  ✓ datasets/ml/embeddings-sample.bin (multipart · 3 parts)');

  // Register a local echo webhook for the demo feed (delivery will retry
  // and dead-letter in the sandbox — which demonstrates backoff nicely).
  await fetch(`${BASE}/v1/storage/webhooks/endpoints`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-vortex-admin-key': ADMIN_KEY },
    body: JSON.stringify({ url: 'https://hooks.no-group.org/vortex/ingest', description: 'Demo endpoint (offline in dev)' }),
  });

  console.log('Seed complete.');
}

main().catch((error: unknown) => {
  console.error('seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
