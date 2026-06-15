# FOMO Berlin — Event Calendar (Summer 2026)

A self-contained, ad-free events website for Berlin startup/tech/culture events,
June–October 2026. Same design system as the SuperReturn side-events page,
extended to span four months with month tabs.

## What's here

| File | Purpose |
|------|---------|
| `index.html` | Page template (contains the `/* FOMO_EVENTS_JSON */` placeholder + all CSS/JS) |
| `data/fomo_events.json` | The event database (163 dated events) — edit this to change the site |
| `build-from-json.js` | Default build: injects `data/fomo_events.json` into the template → `public/index.html` |
| `build.js` | Optional build: pulls live from a Notion database instead |
| `public/index.html` | The built, ready-to-open site (data baked in) |
| `.github/workflows/deploy.yml` | CI: build on push + deploy to Cloudflare |
| `wrangler.toml` | Cloudflare static-assets config |

## Build locally

```bash
npm install
npm run build          # from data/fomo_events.json  → public/index.html
# or
npm run build:notion   # from Notion (needs env vars, see below)
open public/index.html
```

No build step is strictly required to preview — `public/index.html` already has the
data embedded; just open it in a browser.

## Two ways to update the data

1. **Local file (default):** edit `data/fomo_events.json`, run `npm run build`, commit. CI redeploys.
2. **Notion (optional):** set repo secrets `NOTION_API_KEY` and `NOTION_DATABASE_ID`,
   switch the workflow to `npm run build:notion`. Your Notion DB needs columns:
   `Event Name, Datum, Start, Kategorie, Status, Veranstaltungsort, Beschreibung, Veranstalter, Link`
   (adjust names in `build.js → getText()` if yours differ).

## Deploy (Cloudflare)

Add repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, then push to `main`.
`npx wrangler deploy` serves the `public/` folder.

## Event record schema (`data/fomo_events.json`)

`date` (YYYY-MM-DD) · `day` · `monthKey` · `dateLabel` · `time` · `title` · `host` ·
`desc` · `location` · `cat` (vibe) · `catLabel` · `status` · `statusLabel` · `link` ·
`linkLabel` · `fomoHosted` · `source`

## Notes on the data
- 163 dated events (Jun 6 – Oct 9, 2026). Undated newsletter items (sponsors, intro) were left out of the calendar.
- ~33 source links (mostly Instagram) could not be auto-enriched with a title; those were excluded from the dated set.
- Dates/locations are best-effort from public event pages — confirm with the host before relying on them.
