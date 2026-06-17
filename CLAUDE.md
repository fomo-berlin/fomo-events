# FOMO Berlin — Event Calendar

A self-contained, ad-free events website for Berlin startup/tech/culture events.
Built as a static page whose event data can come from a local JSON file **or** live
from a Notion database, deployed to Cloudflare via GitHub Actions.

## Project structure

| Path | Purpose |
|------|---------|
| `index.html` | Single self-contained page template: all CSS + JS inline. Placeholder `/* FOMO_EVENTS_JSON */` is where the events array is injected at build time. |
| `data/fomo_events.json` | The event database (site shape). Edit this to change the site when building locally. |
| `data/geo-cache.json` | Cached lat/lon per venue (keyed by normalized location). Written by `npm run geo`; merged into events at build. Commit it. |
| `lib/berlin-plz.js` | Berlin PLZ → Bezirk + Kiez lookup (offline, deterministic). |
| `lib/ics.js` | Node RFC-5545 generator for the `fomo-berlin.ics` feed. |
| `lib/emit.js` | Shared build: copy `static/`→`public/`, enrich events (geo+Bezirk/Kiez), inject, write `.ics` feed, stamp the service-worker build id. |
| `scripts/enrich-geo.js` | Geocodes venues with a PLZ via Nominatim (1 req/s, cached) → `data/geo-cache.json`. Run via `npm run geo`. |
| `static/` | Hand-authored assets copied verbatim into `public/`: `manifest.webmanifest`, `sw.js`, `_headers`, icons, `robots.txt`, `vendor/leaflet/` (self-hosted Leaflet 1.9.4 + markercluster). |
| `src/worker.js` | Cloudflare Worker: serves `./public` + handles `POST /api/submit-event` (writes to Notion). |
| `build-from-json.js` | Default build (`npm run build`). Local data → full `public/` via `lib/emit.js`. |
| `build.js` | Notion build (`npm run build:notion`). Pulls live via the data-sources API; falls back to local JSON on any error. |
| `public/` | Generated, deployable site (`index.html`, `fomo-berlin.ics`, icons, `sw.js`, `vendor/`…). Do not edit by hand. |
| `.github/workflows/deploy.yml` | CI: builds (Notion by default, falls back to local) and deploys to Cloudflare on push + every 30 min. |
| `wrangler.toml` | Cloudflare config: static assets `./public` + Worker (`run_worker_first = ["/api/*"]`) + rate-limit binding. |
| `package.json` | Scripts: `build`, `build:notion`, `geo`, `dev`. No runtime deps (Notion uses raw fetch). |

## Build & run

```bash
npm run build          # build from data/fomo_events.json → full public/
npm run build:notion   # build live from Notion (needs env vars below)
npm run geo            # (occasional) geocode new venues → data/geo-cache.json
npm run dev            # build + serve public/ on http://localhost:8765
```

No `npm install` needed (no runtime deps). Each build copies `static/`→`public/`,
enriches events with geo + Bezirk/Kiez, injects them, writes `fomo-berlin.ics`, and
stamps the service-worker cache id. Preview must be over **http** (service worker +
absolute `/…` paths), e.g. `npm run dev` — not `file://`.

## Event record schema (`data/fomo_events.json`)

`date` (YYYY-MM-DD) · `day` (mon..sun) · `monthKey` (jun..oct) · `dateLabel` ·
`time` · `title` · `host` · `desc` · `location` · `cat` (vibe key) · `catLabel` ·
`status` (open|invite|waitlist|soldout|paid) · `statusLabel` · `link` · `linkLabel` ·
`fomoHosted` (bool) · `source`.

The frontend (in `index.html`) groups by date into day-sections, filters by month tabs,
vibe chips and search, and **hides events before today automatically** (date filter in JS).

## Power features (all client-side except the submit form)

- **Add to calendar**: per-event `.ics` download + Google/Outlook/Apple deep links
  (RFC-5545: octet line-folding, non-inclusive `DTEND`, `TZID=Europe/Berlin` for
  timed events). Site-wide subscribe feed at `/fomo-berlin.ics`.
- **Quick filters**: Today / This week / Weekend, plus a live countdown to the next event.
- **Map & Kieze**: lazy-loaded self-hosted Leaflet + markercluster; venues geocoded at
  build time; filter by Bezirk. Only events with a PLZ get a pin (~55/128).
- **Favorites & share**: localStorage favorites (heart), shareable `?e=<id>` permalinks
  (deep-link scrolls + flashes the row), Web Share / copy link.
- **PWA**: installable + offline (`manifest.webmanifest`, `sw.js` — network-first HTML so
  events stay fresh, SWR for fonts/tiles, versioned cache busted by build id).
- **Submit an event**: modal form → `POST /api/submit-event` (Worker → Notion). Falls
  back to a prefilled email when the endpoint isn't configured. See `SETUP-SUBMIT-FORM.md`.
- **Newsletter signup**: prominent hero card + gradient footer band (both `form.subscribe-form`,
  one shared JS handler) → `POST /api/subscribe` (Worker → a separate Notion "subscribers"
  data source). Same hardening (origin/honeypot/rate-limit/validation); email fallback when
  unconfigured. Env: `NOTION_SUBSCRIBERS_DATA_SOURCE_ID`. See `SETUP-SUBMIT-FORM.md` §Newsletter.

## Notion integration

- Notion database "FOMO Berlin — Event Calendar 2026" holds the events.
- Columns: Event Name (title), Datum, Start, Kategorie, Status, Veranstaltungsort,
  Beschreibung, Veranstalter, Link.
- **Now uses the data-sources API** (`Notion-Version: 2026-03-11`). `build.js` resolves
  `data_source_id` from `NOTION_DATABASE_ID`, queries `POST /v1/data_sources/{id}/query`,
  and `src/worker.js` creates pages with `parent: {type:"data_source_id", data_source_id}`.
  The old `databases.query` / `{database_id}` parent are gone (this was the prior KNOWN RISK).
- Env: build needs `NOTION_API_KEY` + `NOTION_DATABASE_ID` (GitHub secrets). The Worker
  needs `NOTION_API_KEY` as a `wrangler secret` + `NOTION_DATA_SOURCE_ID` var (events) and,
  for newsletter signups, `NOTION_SUBSCRIBERS_DATA_SOURCE_ID` var (separate subscribers DB).

## Deploy

GitHub Action deploys `public/` to Cloudflare Workers. Secrets:
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (plus the Notion ones above).

## Data caveats (important)
- 128 dated events (Jun–Oct 2026). 33 dead rows were removed in the 2026-06-16 cleanup
  (32 bare-URL/Instagram-login-wall "titles" with no time/host/location + 1 duplicate stub).
  A render-time + build-time guard (`displayTitle` / `enrichEvents`) now falls back any future
  raw-URL title to "Event via <source>". A few dates/locations are best-effort — confirm with hosts.
- The frontend hides events before today automatically (`upcoming` is filtered to `e.date >= TODAY`).

## Conventions
- Keep `index.html` as a single self-contained file (inline CSS/JS). No external build tooling.
- After changing data or template, run the appropriate build and verify `public/index.html`
  has no `/* FOMO_EVENTS_JSON */` placeholder left and the event count is correct.
- FOMO brand: **light** theme (lilac-white bg `#f5f4fb`, ink text `#16132e`) with the FOMO
  blue→purple→magenta accent gradient; Inter font. All colors are CSS custom properties in
  `:root` (semantic `--text*/--line*/--surface*/--fill*` flip the whole theme). Active pills
  use `--fill`/`--fill-text` (dark on light); white text only sits on the accent gradient.
  Logo SVG is inline in `index.html` (fills `var(--ink)`). `body{overflow-x:clip}` keeps
  `<html>` the scroller so `window.scrollY` (back-to-top) works.

## Done (2026-06-15 build)
- ✅ `.ics` feed + per-event Add-to-calendar (Google/Outlook/Apple).
- ✅ Shareable `?e=<id>` permalinks + Web Share; OG/Twitter meta.
- ✅ Map view (clustered) + Bezirk/Kiez filter, build-time geocoding.
- ✅ Today/This week/Weekend quick views, countdown, localStorage favourites.
- ✅ Submit-an-event form → Notion Worker (`/api/submit-event`) with email fallback.
- ✅ PWA: installable + offline.

## Done (2026-06-16 audit + fixes)
- ✅ Bug: past events were rendering by default → `upcoming` now filtered to `e.date >= TODAY`.
- ✅ Bug: cross-midnight `.ics`/Google/Outlook end-time (e.g. 22:00–01:00) rolled to next day
  (`eventInstants`/`buildIcs` in index.html + `lib/ics.js`).
- ✅ Invisible footer logo (white-on-white) fixed (`fill:var(--ink)`).
- ✅ a11y: `prefers-reduced-motion` gate (CSS + JS scrolls); `aria-pressed` on month/vibe/quick
  filters; `role=columnheader`; darkened `--text-muted`/`--text-dim` to pass WCAG AA.
- ✅ i18n: stray German UI strings (share menu, toasts) → English.
- ✅ Data: removed 33 dead/duplicate rows (161→128); raw-URL-title guard added.
- ✅ SEO: schema.org JSON-LD (Org+WebSite+ItemList/Event) injected at build via `lib/emit.js`;
  `sitemap.xml`; real 1200×630 `og-image.png`; `twitter:card=summary_large_image`.
- ✅ Perf: self-hosted Inter (variable woff2, latin + latin-ext in `static/fonts/`), preload +
  `font-display:swap`, Google Fonts removed, CSP `font-src 'self'`; `background-attachment:scroll` on mobile.
- ✅ Security: Worker origin check fail-closed (`originAllowed`); HSTS header added.
- ✅ Design: honest hero CTAs (Browse / Newsletter, not fake Google login); dark→light hero seam
  fade; source moved from per-row pill to a quiet "via …" line; ~6KB dead CSS removed.

## Future ideas
- Per-PLZ centroid table to also place "Berlin (no PLZ)" events approximately.
- Per-event PNG OG share image (site-wide 1200×630 `og-image.png` done; per-event still TODO).
- Automated daily enrichment of new Notion rows (titles/dates from URLs).
- Migrate to a framework (Astro) only if dynamic features outgrow the single file.
