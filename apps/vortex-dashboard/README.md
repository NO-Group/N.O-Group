# @vortex/dashboard — Vortex Console

AMOLED-native React 18 console for the Vortex Storage Engine, built on the official
N.O Group design system (`src/styles/tokens.css` is the single source of truth).

## Surfaces

| Page | Contents |
|---|---|
| **Overview** | Spectrum hero, live stats (objects, engine, events, uptime), capability grid |
| **Storage** | **Multi-Cloud Selector** (6 provider cards, animated spectrum ring on the active engine), object browser with thumbnails, bulk purge, presigned-upload playground, multipart ingest demo |
| **Media Pipeline** | Edge render playground (w/h/fmt/q/fit) with `X-Vortex-Cache` verdicts |
| **Webhooks** | Signed-delivery contract, live event feed (3s poll), retry/dead-letter ledger |
| **Settings** | Provider env checklist, RLS rules, official palette + surface token showcase |

## Design tokens

- Canvas `#000000` (pure AMOLED black) · surfaces `#090C10` · borders `#161B22`
- 6-stop spectrum: `#004BFF → #A38CFF → #FFA1C5 → #00D2FF → #00E6A6 → #1BFF6B`
- Active cards use `GradientBorder`: 1.6px animated spectrum ring + tri-stop glow halo
- Glassmorphism: `--vtx-glass-bg` + `backdrop-filter: blur(18px)` on topbar/toasts/hero

## Networking & the preview sandbox

Browser code only ever calls same-origin relative `/api/*` URLs. In dev, Vite proxies
them to the engine on `127.0.0.1:8787`; `toBrowserUrl()` additionally rewrites
engine-local presigned URLs onto the proxy so direct-upload demos work from the
Arena preview host. Genuine cloud presign URLs (S3/R2/GCS/Azure) pass through
untouched.

## Scripts

| Command | Action |
|---|---|
| `npm run dev` | Vite dev server on :5173 (`0.0.0.0`, any host allowed) |
| `npm run build` | production bundle → `dist/` |
| `npm run preview` | serve the production build |
| `npm run typecheck` | strict `tsc` |
