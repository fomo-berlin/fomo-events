# Setup: the "Submit an event" form → Notion

The submit form works **immediately without any setup** — until it's configured,
submissions open a prefilled email to `hi@fomoberlin.com` (nothing is lost).

To have submissions land **directly in your Notion database** as "Pending review"
rows, do this one-time setup. It uses Cloudflare Workers (already your host) and the
current Notion **data sources** API (`Notion-Version: 2026-03-11`).

## 1. Create a Notion integration
1. Go to https://www.notion.so/my-integrations → **New integration**.
2. Name it (e.g. "FOMO website"), pick the workspace, capability **Insert content**.
3. Copy the **Internal Integration Token** (starts `ntn_…`). This is `NOTION_API_KEY`.
4. Open your "FOMO Berlin — Event Calendar 2026" database → **⋯ → Connections →**
   add your integration. (Without this, the API returns 404.)

## 2. Get the data source id (NOT the database id)
A Notion database now contains one or more *data sources*; pages live under the
data source. Get the id either way:

- **UI:** open the DB as a full page → database **⋯ → Manage data sources →** (⋯ on the
  source) → **Copy data source ID**.
- **API:** `GET https://api.notion.com/v1/databases/<DATABASE_ID>` with headers
  `Authorization: Bearer <token>` and `Notion-Version: 2026-03-11`, then read
  `data_sources[0].id`.

Paste it into `wrangler.toml` → `[vars] NOTION_DATA_SOURCE_ID`, and set
`ALLOWED_ORIGIN` to your deployed site origin (e.g. `https://www.fomoberlin.com`).

## 3. Store the token as a Worker secret
```bash
npx wrangler secret put NOTION_API_KEY
# paste the ntn_… token when prompted
```
The token is encrypted on the Worker — never put it in `wrangler.toml` or git.

## 4. Deploy
```bash
npm run build          # or build:notion
npx wrangler deploy     # uploads ./public AND src/worker.js together
```
Your existing GitHub Action already runs `wrangler deploy`, so pushes keep working.
Just ensure the secret exists on the Worker (step 3) before the first submission.

## How it maps to your columns
The Worker writes these columns (must match your DB exactly):
`Event Name` (title) · `Datum` (date) · `Start` · `Kategorie` (select) ·
`Status` (select, set to **Pending review**) · `Veranstaltungsort` ·
`Beschreibung` (incl. access + submitter email) · `Veranstalter` · `Link` (url).

If a column name differs, edit `src/worker.js` → `properties`.

## Safety built in
- Same-origin check (`ALLOWED_ORIGIN`), honeypot field, per-IP rate limit (5/min).
- Server-side validation; category/access values are whitelisted.
- New rows land as **Pending review** so you curate before they appear.

## Local testing
```bash
# .dev.vars (gitignored): NOTION_API_KEY=ntn_xxx
npx wrangler dev        # serves ./public AND /api/* locally
```
