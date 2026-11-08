# Correct Cloudflare Pages directories

This is the **new N.O Group web project**, not the removed Vortex dashboard.

## Recommended Pages configuration

| Setting | Value |
| --- | --- |
| Root directory | `apps/no-group-web` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | `22` (minimum 22.16) |

The complete output path relative to the repository root is **`apps/no-group-web/dist`**. When you set the root directory to `apps/no-group-web`, enter only **`dist`** in Cloudflare's output field.

Alternatively, if Cloudflare's root directory remains the repository root, use build command `npm run build` and output directory `apps/no-group-web/dist`; however, the recommended app-root setting also ensures Cloudflare discovers `apps/no-group-web/functions` for the API routes.

## Runtime configuration still required

- The Brave token is a runtime secret named **`BRAVE_SEARCH_API_KEY`**, not a `VITE_` build variable. Remove the old `VITE_BRAVE_SEARCH_API_KEY`; the build intentionally rejects it.
- The ignored local configuration is `apps/no-group-web/.env.local`. It is server-only and is not uploaded to Cloudflare.
- Bind quota database **`SEARCH_DB`**, apply `migrations/0001_quota.sql`, and set a strong **`QUOTA_HASH_KEY`** secret. Record the real D1 binding in `wrangler.toml` before a file-managed deployment.
- Live crawling additionally needs its authenticated Node host and gateway configuration. Cloudflare Pages alone does not run the Node crawler.

See [the full release runbook](CLOUDFLARE.md) for exact bindings, quota settings, crawler deployment, and release checks. The code can be built and tested without these credentials; live production search intentionally fails closed if runtime secrets or quota storage are missing.

For the weather/sports panels, also add encrypted runtime secrets `OPENWEATHERMAP_API_KEY` and `ALLSPORTS_API_KEY`, and apply `migrations/0002_widget_cache.sql` to the same `SEARCH_DB` D1 binding. These names never use `VITE_`. Coverage depends on the selected providers' subscription plans.
