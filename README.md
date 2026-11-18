# N.O Group

A multi-page corporate website for **N.O Group**, a Nigerian technology holding company and innovation ecosystem founded by Jason N.O Jeremiah on 19 July 2025.

The public site presents the group’s infrastructure, artificial-intelligence, publishing, developer, and consumer ventures through a decisive, motion-led visual system. It preserves the N.O Group logo, cyan/lavender/pink/mint gradient, and original positioning: **“A new perspective starts here.”**

## Public information architecture

| Route | Purpose |
| --- | --- |
| `/` | Flagship corporate homepage |
| `/ecosystem` | Full venture directory |
| `/infrastructure` | Vortex, Tungsten, multi-cloud, and real-time foundations |
| `/intelligence` | Jeris AI initiative |
| `/ventures` | Publishing, consumer, and browser utility ventures |
| `/company` | Founder story and operating philosophy |
| `/contact` | Partnership, client, developer, and press contact paths |
| `/privacy` | Privacy Policy |
| `/terms` | Terms of Use |
| `/cookies` | Cookie and analytics notice |

The homepage and every page are responsive, keyboard-accessible, respect reduced-motion preferences, and support persistent light/dark theme switching. All interface and social icons are inline SVGs; no emoji icons are used.

## N.O Group ecosystem

- [Vortex](https://vortex.no-group.org) — developer cloud infrastructure
- [Tungsten](https://tungsten.no-group.org) — visual IDE
- [Jeris](https://jeris.no-group.org) — multimodal AI initiative
- [Graphene](https://graphene.no-group.org) — multi-cloud foundation
- [Tether](https://tether.no-group.org) — real-time connectivity
- [ToolsKit](https://toolskit.no-group.org) — browser-based utilities
- [KwikChat](https://kwikchat.no-group.org) — messaging concept
- [Link](https://link.no-group.org) — real-time social communication

## Local development

Requires Node 22.16+.

```sh
npm ci
npm run dev
```

The site is served by Vite on port 5173. It is intentionally a lean static corporate website with no public API, provider key, crawler, upload, or database requirement.

## Build and verify

```sh
npm run typecheck
npm run build
npx playwright install --with-deps chromium
npm test
```

The production build is written to `apps/no-group-web/dist`. `apps/no-group-web/public/sitemap.xml` and `robots.txt` are included in the static build. `public/_redirects` provides the SPA fallback required for the public routes on Cloudflare Pages.

## Deployment

Deploy from `apps/no-group-web` to Cloudflare Pages:

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Node:** 22.16 or newer

No runtime secrets or database bindings are required for this public corporate website.

## Contact

- General and partnerships: [contact@no-group.org](mailto:contact@no-group.org)
- Support: [support@no-group.org](mailto:support@no-group.org)
- Press: [press@no-group.org](mailto:press@no-group.org)
- Phone / WhatsApp: [+234 (0) 707 5536 341](tel:+2347075536341)
