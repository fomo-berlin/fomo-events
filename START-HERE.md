# FOMO Berlin — start here

Your event site is now a **full web app**. Everything runs from this folder.

## Run it locally
```bash
cd ~/Downloads/fomo-berlin-events
npm run dev          # builds + serves at http://localhost:8765
```
Open http://localhost:8765 in your browser. (Use this, not the file directly —
the map, install/offline and absolute links need a real http server.)

## What it can do now
- **Add to calendar** on every event — Google, Apple, Outlook, or `.ics` download.
  Whole-calendar subscribe button (`Subscribe (.ics)`) in the hero.
- **Today / This week / Weekend** quick filters + a live **countdown** to the next event.
- **Map view** (top-right toggle): all venues on a Berlin map, filterable by **Kiez**.
- **Favorites** (the heart) saved in your browser, plus a Favorites-only filter.
- **Share** any event with a link (`?e=…`) that opens straight to it.
- **Install it** like an app (works offline) — your browser's "Install" / "Add to Home Screen".
- **Submit an event** form (footer button) → goes to your Notion as "Pending review".

## Change the events
Edit `data/fomo_events.json`, then:
```bash
npm run build        # rebuild public/
npm run geo          # only when you add NEW venues — geocodes them for the map
```

## Make the submit form save to Notion
It already works (falls back to email). To save directly into Notion, follow
**SETUP-SUBMIT-FORM.md** (10 minutes, one time).

## Deploy
Push to GitHub — the existing Action builds and deploys to Cloudflare automatically.

## Useful Claude Code commands
- `/init` — regenerate the project memory (`CLAUDE.md`)
- `/memory` — edit project memory

Tip: this folder is a git repo now (`git log` shows the history) — you can always roll back.
