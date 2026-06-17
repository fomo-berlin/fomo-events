# FOMO Berlin — Weg zu 100 % Automatisierung

Stand: was noch zu tun ist, in Reihenfolge. Hake jeden Schritt ab.

## Das Ziel (so läuft es danach von allein)
1. **Du** wirfst Roh-Links auf die Notion-Pipeline-Seite. *(einziger manueller Schritt — so gewollt)*
2. **Sync Seite → Events-DB:** 2×/Tag (Claude-Aufgabe, 12:00 & 21:00) **und** alle 10 Min (GitHub-Action).
3. **Bauen & Deployen** (Events-DB → Website → Cloudflare): alle 10 Min (GitHub-Action).
4. **Formulare** (Event einreichen + Newsletter) schreiben automatisch nach Notion.

Wichtige IDs:
- Events-Datenbank-ID (für `NOTION_DATABASE_ID`): `3812312d-f1b4-8079-88c7-ef2847b73493`
- Events-Data-Source: `3812312d-f1b4-803b-9b87-000be0bf8c81`
- Subscribers-Data-Source: `36ac4270-e27b-4cc3-b6bd-4863f1c75101`
- Worker-URL: `https://fomo-events.dariush-e51.workers.dev`

---

## Phase A — Code live bringen (Git)
- [ ] **A1. Müll-Dateien entfernen** (nicht committen):
  ```bash
  cd ~/Downloads/fomo-berlin-events
  rm -f *.bak scripts/*.bak .github/workflows/*.bak
  rm -f .fuse_hidden* scripts/.fuse_hidden* .github/workflows/.fuse_hidden*
  ```
- [ ] **A2. Letzte Änderung (ALLOWED_ORIGIN) committen & alles pushen:**
  ```bash
  git add wrangler.toml
  git commit -m "fix: ALLOWED_ORIGIN auf workers.dev"
  git push
  ```
- [ ] **A3. Prüfen:** GitHub → Repo `fomo-berlin/fomo-events` → **Actions** → letzter Lauf „Build & Deploy" ist **grün**.

## Phase B — Secrets setzen
- [ ] **B1. Worker-Secret (für die Formulare):**
  ```bash
  npx wrangler secret put NOTION_API_KEY
  # Notion-Integrationstoken einfügen
  ```
  *(Braucht Cloudflare-Login: ggf. vorher `npx wrangler login` oder `CLOUDFLARE_API_TOKEN` setzen.)*
- [ ] **B2. GitHub-Repo-Secrets prüfen** (Repo → Settings → Secrets and variables → Actions):
  - `NOTION_API_KEY` (gesetzt)
  - `NOTION_DATABASE_ID` = **`3812312d-f1b4-8079-88c7-ef2847b73493`** ← **kritisch**: muss die aktuelle Events-DB sein
  - `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (gesetzt)

## Phase C — Notion-Integration berechtigen
Dieselbe Integration (deren Token in B1/B2 steckt) muss Zugriff haben auf:
- [ ] **C1. Events-DB** „🗓️ FOMO Berlin – Events 2026"
- [ ] **C2. Subscribers-DB** „FOMO Berlin — Newsletter Subscribers"
- [ ] **C3. Pipeline-Seite** „📰 … Redaktions- & Event-Pipeline 2026"

  *(Jeweils in Notion: oben rechts „•••" → Connections/Verbindungen → Integration hinzufügen.)*

## Phase D — Sync-Aufgabe (Claude) scharf
- [ ] **D1.** In „Geplante Aufgaben" → „Fomo newsletter sync" → **„Jetzt ausführen"** → abgefragte Tools (**Notion** + **Web**) **erlauben**. → Die ⚠️ verschwindet nach dem sauberen Lauf; Berechtigungen gelten dann für alle Läufe.
- [ ] **D2.** Rechner um **12:00 / 21:00** aktiv halten (Toggle „Aktiv halten" ist an). *(Geplante Aufgaben laufen nur bei aktivem Computer.)*

## Phase E — End-to-End testen
- [ ] **E1. Website** öffnen → Events werden angezeigt.
- [ ] **E2. Newsletter-Formular** absenden → neue Zeile in **Subscribers-DB** (Status „New").
- [ ] **E3. „Event einreichen"** testen → neue Zeile in **Events-DB**.
- [ ] **E4. Pipeline-Test:** einen neuen Link auf die Pipeline-Seite setzen → nach dem nächsten Sync/Action steht er in der Events-DB (und ggf. auf der Website).

## Phase F — Sicherheit (offener Punkt)
- [ ] **F1.** Alten GitHub-Token **widerrufen** (GitHub → Settings → Developer settings → Personal access tokens). Falls Cloudflare-/Notion-Token exponiert waren: rotieren.

---

### Wenn etwas hakt
- **Formular zeigt „E-Mail-Fallback" / 503:** `NOTION_API_KEY`-Secret fehlt oder Integration hat keinen DB-Zugriff (B1/C).
- **Formular „Forbidden origin" / 403:** `ALLOWED_ORIGIN` ≠ aufgerufene URL (A2 deployt; bei Custom-Domain anpassen).
- **Website zeigt alte/falsche Daten:** `NOTION_DATABASE_ID`-Secret zeigt auf die falsche DB (B2).
- **Sync schreibt nichts:** Action-Logs ansehen (Schritte „Sync …" stehen auf `continue-on-error`).
