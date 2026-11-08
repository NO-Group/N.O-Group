# Cloudflare Pages release runbook

## Security migration (required)

The API key pasted in chat is compromised. Revoke it in Brave, create a replacement, and do not paste the new value into chat or a repository file. If a prior deployment contained `VITE_BRAVE_SEARCH_API_KEY`, rotation is required even after deleting that variable: old downloadable bundles may still contain it.

The application no longer reads a VITE key. React calls `POST /api/search`; a Pages Function adds the private token upstream. Vite refuses to start/build when the old VITE secret is configured.

## Pages settings

Use the actual Pages project serving `no-group.org` (the project name may differ from the package name):

- Repository: this repository; select the reviewed release branch/PR according to your deployment policy.
- Root directory: `apps/no-group-web`.
- Build command: `npm run build`.
- Output directory: `dist`.
- Node version: 22.16+ (set `NODE_VERSION=22`). React remains 18.3 and TypeScript 5.6; Vite/Vitest were upgraded to resolve known advisories.
- `functions/` must be discovered from this project root. A plain static upload of only `dist` does not deploy Functions. Use Pages Git integration or `wrangler pages deploy dist` from this directory.
- Compatibility date: `2026-11-01`, recorded in `wrangler.toml`.

Remove `VITE_BRAVE_SEARCH_API_KEY` in **both production and preview**. Add encrypted runtime secrets:

| Secret | Purpose |
| --- | --- |
| `BRAVE_SEARCH_API_KEY` | Replacement Brave token, never browser-exposed |
| `QUOTA_HASH_KEY` | At least 32 random characters; generate using a password manager or `openssl rand -hex 32` |

Add these through the dashboard's runtime secrets/variables interface. These values are not build-time client variables. Redeploy after binding changes.

## Durable quota database (required)

Create a D1 database named `no-group-search`, bind it to the Pages project as **`SEARCH_DB`**, and apply `apps/no-group-web/migrations/0001_quota.sql` through the D1 console or Wrangler.

For Wrangler-managed configuration, insert the actual database ID returned by creation into this application's `wrangler.toml`:

```toml
[[d1_databases]]
binding = "SEARCH_DB"
database_name = "no-group-search"
database_id = "<actual ID returned by Cloudflare>"
migrations_dir = "migrations"
```

Do not deploy the example placeholder. With a Wrangler configuration, keep bindings in the configuration file in sync with Cloudflare; dashboard-only settings may be overridden by file-managed configuration. From `apps/no-group-web` after adding the real binding:

```sh
npx wrangler d1 migrations apply no-group-search --remote
```

Preview should use a separate database and replacement/development key with a small quota, not the production quota database. Configure environment-specific bindings before enabling preview live search.

Current server defaults (adjust in `wrangler.toml`):

- 500 attempted Brave requests per UTC day across the deployment.
- 50 requests per IP per UTC day.
- 6 requests per IP in a rolling minute.
- One D1 atomic reservation per provider attempt; provider failures consume quota conservatively.
- Provider 429 cooldown is persisted/shared; requests during it do not hit Brave.
- IP identifiers are HMAC-hashed with a daily component; raw IPs and queries are not stored in quota records.
- Old reservations are removed opportunistically, retaining the current and previous UTC day.

The global limit bounds this application's attempts, not all uses of a shared Brave key. Use a dedicated key, provider alerts, and dashboard billing limits where available. D1/Workers invocations may still incur platform costs. Configure Cloudflare WAF/rate-limiting rules for `/api/*` to control anonymous abuse. Rotating QUOTA_HASH_KEY resets the effective per-IP identity, but does not reset the global cap.

## Result-storage permission

`SEARCH_RESULT_CACHE=false` by default. Do not change it until your Brave plan explicitly permits caching/storing returned results. When enabled, the server marks responses cacheable by the browser session cache for 15 minutes. No shared server result cache is currently used. In-flight request coalescing still reduces duplicate calls without retaining results after completion.

## Crawler deployment (required for live crawling)

Pages Functions do not directly run the Node DNS-pinned crawler. The Function proxies to a separately hosted, authenticated Node service. The function fails closed with HTTP 503 until it is configured; it does not silently pretend to crawl.

Build the provided container from repository root:

```sh
docker build -f apps/no-group-web/server/Dockerfile -t no-group-crawler .
```

Deploy on a Node/container host with HTTPS, private networking/egress controls, resource limits, and a restart policy. Configure:

- `NODE_ENV=production` (already set by the Dockerfile).
- `CRAWLER_SERVICE_TOKEN`: a separate secret of at least 32 random characters.
- `CRAWLER_ALLOWED_HOSTS`: exact comma-separated websites you own or are authorized to inspect. No wildcards.

Bind the same `CRAWLER_SERVICE_TOKEN` as an encrypted Pages secret. Add runtime configuration:

- `CRAWLER_SERVICE_URL`: the HTTPS service endpoint ending in `/api/crawl`.
- `CRAWLER_ALLOWED_HOSTS`: the same allowlist as the service.

Node rejects unauthenticated calls; Pages enforces persistent crawl quotas (100 global/day, 10/IP/day, 1/IP/minute). The service separately allows only two concurrent jobs and a per-connection cooldown. Direct service access must be restricted to the gateway where possible. Pages timeout is 90 seconds. The largest crawl can exceed that under slow networking; tune limits conservatively and use a proper job queue before increasing page count.

Public crawl requests are deliberately limited to approved hosts. Supporting arbitrary user-selected domains safely requires a separately reviewed egress-isolated crawler architecture; do not remove the allowlist casually.

## Verification and release gates

Locally/CI:

```sh
npm ci
npm audit --audit-level=moderate
npm run typecheck
npm test
npm run build
npm run pages:build --workspace @no-group/web
npx playwright install --with-deps chromium
npm run test:e2e
```

After deployment:

1. `GET /api/health` must return 200 `{"status":"ok"}`; missing secrets/storage/migrations return 503.
2. Run a live search with a small dedicated quota. Inspect browser Network: it must call your `/api/search`, never Brave, and must not contain a subscription header.
3. Check the deployed JS for the old key and remove/revoke historical leaked credentials. The local build checks known secret markers automatically.
4. Confirm invalid/cross-origin requests fail and quota exhaustion returns a styled 429. Use a staging environment with very small limits, not production quota consumption.
5. Test actual crawling on an approved site, barcode scanning on physical devices, and representative image fidelity/performance.
6. Verify domain TLS, CSP/response headers, mobile behavior, and screen-reader navigation on the deployed domain.
7. Enable Cloudflare Function error alerts, monitor health and D1 usage, configure Brave billing alerts, and retain an audited rollback deployment.

## Current access blockers

This coding session has no Cloudflare connector/credentials and outbound Brave API access is restricted. It cannot rotate the token, provision/bind the real D1 database, set runtime secrets, deploy the crawler host, or verify production live requests. Passing local tests does not constitute a deployed production sign-off. Real-device scanning and manual assistive-technology review also remain external release checks.

The public routes now include `POST /api/search`, `GET /api/thumbnail`, `GET /api/health`, and `POST /api/crawl`. The `_routes.json` configuration routes `/api/*` through Functions, including the optional restricted thumbnail proxy. Search filter/pagination options are validated server-side and do not require additional API keys.

## OpenWeather and AllSportsAPI panels

Optional runtime secrets (no `VITE_` prefix):

- `OPENWEATHERMAP_API_KEY`: the supplied OpenWeather key.
- `ALLSPORTS_API_KEY`: the supplied AllSportsAPI.com key.

These are configured only in ignored `apps/no-group-web/.env.local` locally. Set the same names as encrypted Cloudflare Pages runtime secrets for production/preview as appropriate; local files are not uploaded. No key appears in public assets or browser requests. The provider protocols require credentials in upstream query parameters; never enable logging of full upstream request URLs, traces, or environment values. Provider URLs and raw provider errors are not returned to the browser.

Apply **both** migrations, including the new `migrations/0002_widget_cache.sql`, to `SEARCH_DB`. Existing deployments with only the quota schema will fail closed for weather/sports until the cache table exists. Local development automatically applies all idempotent SQL migrations on startup.

Endpoints: `POST /api/weather` (`{"city":"Abuja,NG"}`) and `POST /api/sports` (`{"sport":"football"}`). The implementation targets OpenWeather's Current Weather API and AllSportsAPI v2 Livescore; a key for a different provider/product is not interchangeable. AllSportsAPI access to football, basketball, tennis, and cricket depends on the account's subscription. The code does not claim all sports/leagues are included in every plan.

The cards make **no requests on page load** and never auto-poll. Manual update requests reuse shared D1 cache entries for ten minutes (weather) or sixty seconds (sports), with in-flight coalescing within an isolate. Temperature unit conversion is browser-local. Normalized public observations/scores are cached, never tokens, request URLs, or raw upstream bodies. Cache retention/redistribution must conform to your provider subscriptions; attribution links are included in each panel.

`WEATHER_DAILY_LIMIT` and `SPORTS_DAILY_LIMIT` default to 500 attempted provider calls per UTC day each. Each service has its own persistent reservations; per-IP limits inherit the configured search IP daily/minute values (50/day and 6/minute by default). Cached data remains available during quota exhaustion or provider cooldown. Shared result-cache hits do not consume provider quota. These widget quotas are separate from the browser's **Search API saver** meter.

Provider 429s persist a cooldown. Missing configuration returns 503, unknown weather cities return 404, HTTP/account errors are sanitized, and an empty sports snapshot is distinguished from a network/account failure. Sports results represent in-progress events, not fixtures, and the UI shows the snapshot time rather than claiming continuously live updates.

Local fixtures and browser tests do not verify a real subscription. This sandbox's outbound allowlist excludes the two provider API hosts, so live account activation, key validity, and coverage must be checked from the deployed environment. Test current-weather city lookup and at least one subscribed sport after setting runtime secrets and applying migrations. A new or inactive provider key may require activation; consult its dashboard if authentication fails.

Provider references: https://openweathermap.org/current and https://allsportsapi.com/soccer-football-api-documentation (plus the corresponding basketball, tennis, and cricket documentation).
