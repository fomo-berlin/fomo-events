# FOMO Event-Kalender — Automatisierung einrichten

Ziel: Du trägst Events **nur noch in Notion** ein. Alles andere — bauen,
vergangene Events ausblenden, veröffentlichen — läuft automatisch.

```
   NOTION                    GITHUB                       WEB
 ┌─────────┐   API-Token   ┌───────────────┐  Deploy   ┌──────────────┐
 │ Events- │ ───────────▶ │ GitHub Action  │ ───────▶ │ Öffentliche   │
 │ Datenbank│             │ baut die Seite │           │ Website (URL) │
 └─────────┘               └───────────────┘           └──────────────┘
   du pflegst              läuft per Zeitplan            sehen alle
```

---

## Baustein 1 — Notion

**1a. Datenbank mit festen Spalten.** Der Build-Code erwartet genau diese Spalten
(Name → Typ):

| Spalte | Typ |
|---|---|
| Event Name | Title |
| Datum | Date |
| Start | Text / Time |
| Kategorie | Select |
| Status | Select |
| Veranstaltungsort | Text |
| Beschreibung | Text |
| Veranstalter | Text |
| Link | URL |

**1b. Eine Notion-Integration (Token) erstellen.**
→ `notion.so/my-integrations` → „New integration" → Namen geben → **Secret kopieren**.
Dieses Secret = `NOTION_API_KEY`.
⚠️ Wichtig: Das ist **nicht** der Cowork-Connector. GitHub braucht diesen eigenen
Integrations-Token, sonst kommt die Automatisierung nicht an deine Daten.

**1c. Datenbank für die Integration freigeben.**
Datenbank öffnen → „•••" → **Connections / Verbindungen** → deine Integration hinzufügen.

**1d. Database-ID kopieren.** Steht in der Datenbank-URL (der 32-stellige Code) =
`NOTION_DATABASE_ID`.

> Was **ich** übernehmen kann: die bereits aufbereiteten **163 Events** in diese
> Notion-DB schreiben — sobald die DB existiert und der Cowork-Notion-Connector
> Zugriff auf den **FOMO-Workspace** hat (vorhin war er im falschen Workspace
> „dariush's Space HQ").

---

## Baustein 2 — GitHub

**2a.** GitHub-Account (falls noch keiner da ist).

**2b.** Repository anlegen, z. B. `fomo-berlin-events`, und die fertigen Projektdateien
hochladen. Liegen schon bereit im Ordner **`fomo-berlin-events/`**
(index.html, build.js, build-from-json.js, data/, .github/workflows/, …).

**2c.** Secrets hinterlegen: Repo → **Settings → Secrets and variables → Actions**:
- `NOTION_API_KEY`
- `NOTION_DATABASE_ID`
- (bei Cloudflare zusätzlich: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`)

**2d.** Zeitplan aktivieren. Der Workflow `.github/workflows/deploy.yml` ist fertig.
Für automatischen Abruf aus Notion den `schedule`-Block einkommentieren (z. B. alle
30 Min) und auf `npm run build:notion` umstellen.

---

## Baustein 3 — Veröffentlichen (zwei Optionen)

**Option A — GitHub Pages (empfohlen, am einfachsten).**
Kostenlos, kein Drittanbieter, keine Cloudflare-Tokens. Ich passe den Workflow dafür an.
Du bekommst eine URL wie `deinname.github.io/fomo-berlin-events`.

**Option B — Cloudflare Workers (wie deine alte Seite).**
Braucht einen Cloudflare-Account plus `CLOUDFLARE_API_TOKEN` und
`CLOUDFLARE_ACCOUNT_ID`. Dafür leicht eigene Domain anbindbar. `wrangler.toml` liegt bereit.

---

## Was ich JETZT von dir brauche

1. **Hosting:** GitHub Pages oder Cloudflare?
2. **Notion:** Gibt es die Ziel-Datenbank schon — oder soll ich sie (Struktur +
   163 Events) für dich anlegen? Falls ja: Cowork-Notion mit dem FOMO-Workspace
   verbinden bzw. die DB freigeben.
3. **GitHub:** Dein Account-Name — und willst du selbst hochladen, oder soll ich
   dich Klick für Klick durchführen?

> Die **Tokens/Secrets** (NOTION_API_KEY, Cloudflare-Token) erstellst und einträgst
> ausschließlich **du selbst** — ich sehe oder verwalte keine Passwörter/Tokens.
> Ich sage dir genau, wo es jeweils steht.

---

## So sieht der Alltag danach aus

Neues Event in Notion eintragen → innerhalb weniger Minuten automatisch auf der
Website. Vergangene Events verschwinden von selbst (Datumsfilter ist eingebaut).
