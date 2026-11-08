# Release verification — 2026-11-07

## Scope and results

- TypeScript validation, production client build and Cloudflare Pages Functions compilation passed.
- 64 unit/integration tests passed, including private provider boundaries, quota persistence, malformed/oversized upstream responses, safe URLs and reading-list import.
- 52 Chromium browser tests passed across desktop and mobile, including accessibility scans, navigation, request deduplication, quotas, widgets, tools, saved-link import/export, keyboard focus, and responsive layouts.
- Full npm dependency audit: zero reported vulnerabilities at audit time.
- Release-tree audit compares actual local/runtime secret values against source and compiled artifacts without printing secrets; private local configuration is ignored by Git. No configured secrets found in scanned files.
- Search now has a 4 MiB decoded upstream response limit, including streamed responses without trustworthy content-length. Weather/sports share the same bounded reader.
- Reading-list backup import validates the version, URL safety, entry/file limits and timestamps; merges preserve existing notes. Layout selection persists on the device.

## Release caveats — not a claim of zero risk

These tests use controlled provider fixtures; real Brave/OpenWeather/AllSports account validity and subscription coverage are not verified. Sandbox outbound access does not permit those APIs. Production Cloudflare headers, secrets, D1 bindings/migrations, domain and crawler hosting must be configured and smoke-tested in the target deployment. No Cloudflare configuration was changed by this release audit. The audit scans current source/build files, not every historical Git commit or hosting-provider log.

The lazy-loaded barcode library still produces a bundle-size warning; it is separate from the initial app bundle. Physical scanners, color profiles, manual assistive-technology use and production load/operations require separate verification. User notes/reading lists are unencrypted browser-local data, not account-synced storage. Shared search URLs expose their query/filter values to recipients and browser history by design.

## Deployment paths

Cloudflare Pages root: `apps/no-group-web`; build: `npm run build`; output: `dist`; Node: 22 (at least 22.16). Follow `deployment/CLOUDFLARE.md` for runtime secrets, D1 migrations 0001/0002 and crawler setup. Merging source is not proof of a successful production deployment.
