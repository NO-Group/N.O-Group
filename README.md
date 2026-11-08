# N.O Group · Search & tools

AMOLED-native React 18.3 / TypeScript 5.6 website with a secure server-side search boundary, frosted-glass workbenches, and Cloudflare Pages Functions. Vite and Vitest have been upgraded from the original requested versions to address security advisories.

## Local development

Requires Node 22.16+. From repository root:

```sh
npm ci
test -f apps/no-group-web/.env.local || cp apps/no-group-web/.env.example apps/no-group-web/.env.local
npm run dev
```

Configure `BRAVE_SEARCH_API_KEY` directly to the ignored `.env.local` file for live local search. Do not use a VITE prefix, commit keys, or paste them into chat. No key means explicitly labeled local demo results. Production never silently falls back to demo.

`npm run dev` starts the website on 5173 and a local API on 8788. All browser API calls are relative same-origin URLs. Local quotas use SQLite in ignored `.data/`; Cloudflare uses durable D1. Local live search is subject to your network's access policy.

## Search and cost controls

- Native React result cards; no iframes, injected provider HTML, or external search viewers.
- Server-only Brave token, query/body limits, same-origin checks, provider timeout, sanitized errors, and persisted 429 cooldown.
- Atomic global/per-IP daily and minute quotas; fail closed when quota storage is unavailable.
- Optional session cache (15 minutes / 20 entries), **only when server configuration confirms result-storage permission**.
- In-flight deduplication, whitespace normalization, 400 ms opt-in auto-search debounce, manual Enter search, Back/Forward navigation, and local request controls.
- Request counters represent attempted requests, not actual billed currency. Browser caps supplement server limits, not replace them.
- Search text appears in URL history; session results may be stored if allowed. Clear cached searches from the API saver panel. No third-party analytics is included.

## Tools

- JSON formatting/minification, UUID generation, Unicode-safe Base64, and browser-local autosaved notes. Local storage is not encrypted; don't keep secrets in notes.
- QR / Code 128 generation with SVG download. QR supports Unicode; linear Code 128 accepts printable ASCII. The encoder is lazy-loaded in a separate bundle.
- Image-to-SVG: pixel-run vector paths preserve decoded canvas colors/alpha without palette reduction or embedded raster data. This is **not smooth contour tracing** or a guarantee of original color-profile fidelity. Inputs: PNG/JPEG/WebP up to 15 MB / 2 million pixels; output capped at 64 MB and worker execution at 30 seconds. Large-file previews are omitted.
- Bounded robots-aware same-origin web crawler with JSON export. Production uses an authenticated, approved-host Node service behind a Pages Function; local development runs it directly. It is not a JavaScript-rendering browser crawler.

## Verify

```sh
npm run typecheck
npm test
npm run build
npm run pages:build --workspace @no-group/web
npx playwright install --with-deps chromium
npm run test:e2e
```

Unit/integration tests cover the search boundary, real SQLite quota statements, cooldowns, cache/deduplication, barcode creation, pixel-vector logic, and crawler address validation. Browser tests cover desktop/mobile interactions, auto-search, history, rate-limit states, tools, downloads, QR decoding, and automated accessibility. Mocked browser endpoints do not verify a deployed Brave subscription or live crawler host. CI runs these checks and dependency auditing.

Build output: `apps/no-group-web/dist`. Deploy Functions as well as static output. See **[Cloudflare deployment and remaining release gates](docs/deployment/CLOUDFLARE.md)** for secrets, D1, quotas, crawler hosting, monitoring, and verification. Do not deploy the complete repository as the public web root.

## Preserved uploads

- `assets/brand/`: unchanged original N.O Group and Vortex logos.
- `apps/no-group-web/public/nogroup-logo.png`: public deployment copy of the official logo.
- `docs/legal/no-group.org_ownership_letter.pdf`: unchanged ownership letter, never public web assets (not a TLS certificate).

Company journal entries are static introductory editorial copy, not a live CMS feed. Automated accessibility scans do not replace manual assistive-technology review. Production sign-off requires the external checks listed in the release runbook.


## Full web-results experience

The web engine supports explicit Next/Previous pages (up to the provider's first ten pages), freshness filters, worldwide/NG/US/GB region selection, and off/moderate/strict SafeSearch. Filters are validated server-side and applied only when the user submits them. Query, page, and filter state are shareable in the URL and restored by browser Back/Forward. Session cache keys include all options, so one region or page cannot return another's cached results.

Provider HTML snippets are converted to plain text and highlighted with native React elements, never injected as HTML. Cards can display site names, URL breadcrumbs, timestamps, same-site sitelinks, and expandable extra snippets when Brave supplies them. Empty snippets and empty result sets have explicit fallback states. Query corrections appear only when the provider supplies one. Counts describe this page, not invented index-wide totals.

Page previews are opt-in and lazy-loaded. `/api/thumbnail` only retrieves HTTPS images hosted by `imgs.search.brave.com`, never forwards the subscription token or browser cookies, refuses redirects/SVG/HTML, and caps downloads at 2 MB with a five-second timeout. Previews use same-origin URLs so they work with the site's restrictive CSP. Source web pages open on their own websites in new tabs, not embedded or restyled third-party viewers.

All Brave web-search calls use the same server-only `BRAVE_SEARCH_API_KEY` runtime setting. The local server reads it from the ignored `.env.local`; Cloudflare Pages reads the runtime secret with that name. No key is required for local converters, result links, or public Brave-hosted thumbnails. Do not duplicate the token into frontend code or downloads.

## On-demand weather & sports

The homepage includes native AMOLED/glass **OpenWeather** and **AllSportsAPI.com** cards. Configure server-only `OPENWEATHERMAP_API_KEY` and `ALLSPORTS_API_KEY` in ignored `.env.local` and restart `npm run dev`; set equivalent runtime secrets in Cloudflare. Apply migration `0002_widget_cache.sql` to production D1 in addition to the quota migration.

Weather defaults to an editable Abuja,NG city query, without geolocation permissions. Conditions, temperature, feels-like, humidity, wind, and observation time are normalized server-side. Celsius/Fahrenheit toggling is local and costs no extra request. Sports offers football, basketball, tennis, and cricket in-progress snapshots, with honest empty/error states and subscription-dependent coverage. Both show provider attribution.

No page-load requests or polling: users explicitly request data. Shared server caches last ten minutes for weather and sixty seconds for sports; updates cannot force bypass them. Keys never reach the browser. Quotas, bounded/time-limited provider downloads, redirect refusal, input validation, and sanitized failures protect the endpoints. The Search API saver meter still counts only search endpoint attempts. See the deployment runbook for separate weather/sports budgets and production verification requirements.

### Search workspace and saved references

After searching, N.O Explorer provides a sticky compact search bar, focus mode, cards/compact/grid layouts, a source explorer, and text/source filtering and source sorting of the **currently loaded page only**. These view operations do not call Brave. Provider freshness/region/SafeSearch filters, pagination, site searches, and submitting the query builder are explicit new searches and can consume provider quota. Original result rankings remain visible when locally filtering/sorting. Optional page previews still use the restricted image proxy.

Use **Save link** to keep up to 100 URL references on this device. The reading list stores only the selected URL, a hostname-derived or user-written label, your personal note, and a save timestamp—not provider titles, snippets, or page content. Edit/remove entries or export JSON. Storage is unencrypted browser-local storage, not account sync; blocked/full storage produces an in-memory-only warning. Clear browser site data to erase all entries. The homepage **Open your reading list** button requires no search/API request, including when live search is unavailable. Exported JSON may contain sensitive URLs and personal notes; keep it private.

**Ctrl/⌘ J** opens the keyboard command menu; arrows/Enter choose an action and Escape closes it. **Ctrl/⌘ K** focuses search, including from the menu. Focus workspace hides discovery panels without making tool/weather navigation inaccessible: header links or menu actions reveal the relevant panels. Share search copies the URL (including the query/provider filters), not provider response content. Local layouts, filters, focus state, and saved notes are not embedded in shared URLs.

Reading-list JSON exports can be restored using **Import JSON** (version 1, up to 100 links, 1 MiB file limit). Imports validate URLs and fields, merge without overwriting existing notes, skip duplicates/invalid/over-limit entries, and never call a provider. Result layout choices are remembered locally on this device. `npm run security:audit` scans source and release files against configured local/runtime secret values without logging those values, and rejects embedded private keys/provider tokens or tracked private configuration. Build both client and Functions before running it; CI enforces the same gate.
