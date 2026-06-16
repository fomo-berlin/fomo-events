# FOMO Berlin — Deployment Anleitung

Alles was du brauchst, um das Projekt live zu schalten. Drei Schritte: GitHub, Cloudflare, fertig.

---

## Schritt 1 — GitHub Repository erstellen & Code hochladen

1. Gehe zu [github.com](https://github.com) → **New repository**
2. Name: `fomo-berlin-events` | Visibility: **Private** | kein README
3. Klick **Create repository**
4. Lade den Ordner `/fomo-berlin-events` hoch:

```bash
cd /Users/sadiqqais/Downloads/fomo-berlin-events
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/DEIN-USERNAME/fomo-berlin-events.git
git push -u origin main
```

---

## Schritt 2 — GitHub Secrets setzen

Gehe im Repository zu **Settings → Secrets and variables → Actions → New repository secret**.

Füge diese 4 Secrets ein (Zugangsdaten NIEMALS in Chat oder Code schreiben — nur hier):

| Secret Name | Wert |
|---|---|
| `NOTION_API_KEY` | Dein Notion Integration Token (`secret_…`) |
| `NOTION_DATABASE_ID` | `38f9977b97f348bb9a7158f2eb420640` |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token (siehe Schritt 3) |
| `CLOUDFLARE_ACCOUNT_ID` | Deine Cloudflare Account ID |

**Wo bekomme ich `NOTION_API_KEY`?**
→ [notion.so/my-integrations](https://www.notion.so/my-integrations) → Integration öffnen → "Internal Integration Token" kopieren

**Wichtig:** Die Integration muss Zugriff auf die Datenbank haben:
→ Notion Datenbank öffnen → `···` oben rechts → **Connections** → deine Integration hinzufügen

---

## Schritt 3 — Cloudflare einrichten

### 3a. Cloudflare Account ID finden
→ [dash.cloudflare.com](https://dash.cloudflare.com) → rechte Spalte → **Account ID** kopieren

### 3b. API Token erstellen
→ [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
→ **Create Token** → Template **"Edit Cloudflare Workers"** → Continue → Create Token → kopieren

### 3c. Wrangler Variablen setzen (einmalig, lokal)

Die `wrangler.toml` enthält zwei Variablen die du befüllen musst:

```bash
cd /Users/sadiqqais/Downloads/fomo-berlin-events

# Data Source ID der Events-Datenbank:
npx wrangler vars set NOTION_DATA_SOURCE_ID "7e63e3e6-7276-4064-9a5c-5f13d4551bb7"

# Notion API Key als Secret im Worker:
npx wrangler secret put NOTION_API_KEY
```

Alternativ: Die `wrangler.toml` direkt editieren:
```toml
[vars]
NOTION_DATA_SOURCE_ID = "7e63e3e6-7276-4064-9a5c-5f13d4551bb7"
NOTION_SUBSCRIBERS_DATA_SOURCE_ID = ""   # falls Newsletter-DB vorhanden
ALLOWED_ORIGIN = "https://www.fomoberlin.com"
```

---

## Schritt 4 — Ersten Deploy auslösen

Nach dem Push aus Schritt 1 startet GitHub Actions automatisch. Alternativ:

→ GitHub → **Actions** → **Build & Deploy FOMO Event Calendar** → **Run workflow**

Der Build dauert ca. 1–2 Minuten. Danach ist die Seite live unter:
```
https://fomo-berlin-events.<DEIN-ACCOUNT>.workers.dev
```

---

## Automatisierung

Der Workflow läuft **alle 30 Minuten** automatisch (Cron: `*/30 * * * *`).
Neue Events in Notion erscheinen innerhalb von maximal 30 Minuten auf der Live-Seite.

Trigger:
- Jeder Push auf `main`
- Manuell via GitHub Actions → "Run workflow"
- Automatisch alle 30 Minuten

---

## Notion Datenbank (Referenz)

| Eigenschaft | Wert |
|---|---|
| Datenbankname | FOMO Berlin — Event Calendar 2026 |
| Database ID | `38f9977b97f348bb9a7158f2eb420640` |
| Data Source ID | `7e63e3e6-7276-4064-9a5c-5f13d4551bb7` |
| Einträge | 159 Events (Jun–Okt 2026) |
| URL | https://app.notion.com/p/38f9977b97f348bb9a7158f2eb420640 |

---

## Troubleshooting

| Problem | Lösung |
|---|---|
| Build schlägt fehl: "Invalid API key" | Notion API Key in GitHub Secrets prüfen |
| Build schlägt fehl: "Database not found" | Notion Integration hat keinen Zugriff auf DB → Connections prüfen |
| Cloudflare Deploy schlägt fehl | API Token Berechtigungen prüfen (muss "Edit Cloudflare Workers" haben) |
| Website zeigt 0 Events | `NOTION_DATABASE_ID` in Secrets prüfen: muss `38f9977b97f348bb9a7158f2eb420640` sein |
| Submit-Formular sendet nur E-Mail | `NOTION_DATA_SOURCE_ID` im Worker setzen (siehe Schritt 3c) |
