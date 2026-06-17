# Deploy → GitHub + Cloudflare Workers (volle Variante)

Prinzip (wie bei `fomo-berlin/fomo-side-events`, nur erweitert): **GitHub-Repo → GitHub Action → Cloudflare Workers**.
Der Worker liefert die statische Seite aus `public/` **und** verarbeitet `POST /api/submit-event` + `/api/subscribe` (→ Notion).
Bei jedem Push auf `main` (und alle 30 Min) baut die Action aus Notion und deployt automatisch.

> Was Claude schon erledigt hat: Code committet, `wrangler.toml` + `.github/workflows/deploy.yml` fertig,
> Git-Remote auf `https://github.com/fomo-berlin/fomo-events.git` gesetzt, Notion-Sync-Schritte non-fatal.
> Die folgenden Schritte brauchen **deine Zugangsdaten** — die kann/darf ich nicht eingeben.

## 1. GitHub-Repo anlegen + pushen
1. Auf github.com einloggen (Account **fomo-berlin**) → **New repository** → Name **`fomo-events`** → *Private* oder *Public* → **ohne** README/gitignore anlegen → **Create**.
2. Im Terminal:
   ```bash
   cd ~/Downloads/fomo-berlin-events
   git push -u origin main
   ```
   (Remote ist schon gesetzt. Falls GitHub nach Login fragt: Personal Access Token als Passwort, oder `gh auth login` / SSH.)

## 2. Cloudflare-Zugangsdaten holen
- **Account ID:** Cloudflare-Dashboard → rechte Seitenleiste → *Account ID* kopieren.
- **API-Token:** Dashboard → *My Profile → API Tokens → Create Token* → Template **„Edit Cloudflare Workers"** → erstellen → kopieren.

## 3. GitHub-Secrets setzen
Repo → **Settings → Secrets and variables → Actions → New repository secret** — vier Stück:

| Secret | Wert |
|---|---|
| `CLOUDFLARE_API_TOKEN` | dein API-Token aus Schritt 2 |
| `CLOUDFLARE_ACCOUNT_ID` | deine Account ID aus Schritt 2 |
| `NOTION_API_KEY` | Token deiner Notion-Integration „fomo-berlim" |
| `NOTION_DATABASE_ID` | `3812312d-f1b4-8079-88c7-ef2847b73493` (deine Events-DB) |

## 4. Worker-Runtime-Secret (für die Formulare zur Laufzeit)
Die GitHub-Secrets gelten nur beim **Bauen**. Damit die Formulare **zur Laufzeit** in Notion schreiben,
einmal das Worker-Secret setzen:
```bash
cd ~/Downloads/fomo-berlin-events
npx wrangler secret put NOTION_API_KEY    # denselben fomo-berlim-Token einfügen
```
(Oder im Cloudflare-Dashboard → Worker `fomo-berlin-events` → Settings → Variables → Secret.)

## 5. Origin auf die echte URL setzen
In [`wrangler.toml`](wrangler.toml) steht `ALLOWED_ORIGIN = "https://www.fomoberlin.com"`.
Setze das auf die URL, unter der die Seite **wirklich** läuft, sonst blockt der Origin-Schutz die Formulare
(sie fallen dann auf E-Mail zurück):
- erst mal: `https://fomo-berlin-events.<dein-subdomain>.workers.dev`
- später, mit eigener Domain: deine Domain.
Optional die Submitted-Events-DB setzen: `NOTION_DATA_SOURCE_ID` (Events-Data-Source `3812312d-f1b4-803b-9b87-000be0bf8c81`)
oder eine Inbox-DB. `NOTION_SUBSCRIBERS_DATA_SOURCE_ID` ist schon gesetzt (Newsletter-DB).

## 6. Deploy auslösen + prüfen
- Push aus Schritt 1 startet die Action automatisch. Oder Repo → **Actions → Build & Deploy → Run workflow**.
- Action grün? → Worker-URL aus dem Cloudflare-Dashboard öffnen.
- Testen: Seite lädt, Events da, Newsletter-Anmeldung → neue Zeile in der Notion-„Subscribers"-DB.

## Alternative ohne Worker (nur statisch)
Wenn du erstmal nur die Seite live willst: `public/`-Ordner (oder die ZIP) bei **Cloudflare Pages** hochladen.
Dann gibt es keinen Worker → Formulare fallen auf E-Mail zurück. (Du hast die volle Variante gewählt — obige Schritte.)
