# FOMO Berlin — Event Calendar

A self-contained, ad-free events website for Berlin startup/tech/culture events.
Built as a static page whose event data can come from a local JSON file **or** live
from a Notion database, deployed to Cloudflare via GitHub Actions.

## Project structure

| Path | Purpose |
|------|---------|
| `index.html` | Page template. Contains all CSS + JS inline and the placeholder `/* FOMO_EVENTS_JSON */` where the events array is injected at build time. |
| `data/fomo_events.json` | The event database (site shape). Edit this to change the site when building locally. |
| `build-from-json.js` | Default build. Injects `data/fomo_events.json` into `index.html` → `public/index.html`. |
| `build.js` | Alternative build. Pulls events live from a Notion database via the Notion API. |
| `public/index.html` | The built, deployable site (data baked in). Generated — do not edit by hand. |
| `.github/workflows/deploy.yml` | CI: builds (Notion by default) and deploys to Cloudflare on push + every 30 min. |
| `wrangler.toml` | Cloudflare Workers static-assets config (serves `./public`). |
| `package.json` | Scripts: `build` (local) and `build:notion`. |

## Build & run

```bash
npm install
npm run build          # build from data/fomo_events.json
npm run build:notion   # build live from Notion (needs env vars below)
open public/index.html # preview
```

No build is strictly needed to preview — `public/index.html` already has data baked in.

## Event record schema (`data/fomo_events.json`)

`date` (YYYY-MM-DD) · `day` (mon..sun) · `monthKey` (jun..oct) · `dateLabel` ·
`time` · `title` · `host` · `desc` · `location` · `cat` (vibe key) · `catLabel` ·
`status` (open|invite|waitlist|soldout|paid) · `statusLabel` · `link` · `linkLabel` ·
`fomoHosted` (bool) · `source`.

The frontend (in `index.html`) groups by date into day-sections, filters by month tabs,
vibe chips and search, and **hides events before today automatically** (date filter in JS).

## Notion integration

- Notion database "FOMO Berlin — Event Calendar 2026" holds the events.
- `build.js` reads columns: Event Name, Datum, Start, Kategorie, Status,
  Veranstaltungsort, Beschreibung, Veranstalter, Link.
- Env vars (set as GitHub repo secrets): `NOTION_API_KEY`, `NOTION_DATABASE_ID`.
- KNOWN RISK: `build.js` uses `notion.databases.query`. If the Notion token enforces the
  newer "data source" API, this call may need updating to the data-sources endpoint.

## Deploy

GitHub Action deploys `public/` to Cloudflare Workers. Secrets:
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (plus the Notion ones above).

## Data caveats (important)
- 159 dated events (Jun–Oct 2026). Some entries are Instagram links without titles
  ("Instagram post (…)"). A few dates/locations are best-effort — confirm with hosts.

## Conventions
- Keep `index.html` as a single self-contained file (inline CSS/JS). No external build tooling.
- After changing data or template, run the appropriate build and verify `public/index.html`
  has no `/* FOMO_EVENTS_JSON */` placeholder left and the event count is correct.
- FOMO brand: navy/purple palette, Inter font. Logo SVG is inline in `index.html`.

## Roadmap ideas for a more powerful site (pick what you want)
- Add an `.ics` calendar feed + "Add to calendar" buttons per event.
- Per-event detail pages / shareable links; Open Graph preview images.
- Map view (cluster by venue) and neighbourhood filter.
- "This week" / "Today" quick views; saved favourites (localStorage).
- Submit-an-event form that writes to Notion.
- Migrate to a framework (Astro/Next.js) if dynamic features grow.
- Automated daily enrichment of new Notion rows (titles/dates from URLs).
