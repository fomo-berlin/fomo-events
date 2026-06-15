# Übergabe an Claude (anderes Konto / richtiger Notion-Workspace)

Kopiere den **Prompt** unten in Claude (in dem Konto, das mit deinem FOMO-Notion
verbunden ist). Lade dabei die Datei **`fomo_notion_import.csv`** mit hoch (liegt in
deinem Download-Ordner UND in `data/`). Sie hat bereits die exakten deutschen
Spaltennamen (Event Name, Datum, …) — deckungsgleich mit `build.js`. Damit hat Claude
sofort alle 159 Events.

---

## SCHNELLSTER WEG (ganz ohne Prompt): CSV direkt in Notion importieren
1. In Notion (richtiger Workspace) → linke Seitenleiste → **„+" → Import → CSV**.
2. Datei **`fomo_notion_import.csv`** wählen (deutsche Spalten passen schon zu den Skripten).
3. Notion legt automatisch eine Datenbank mit allen 159 Events an.
4. Danach nur die Spaltentypen anpassen: Datum → *Date*, Kategorie/Status/Quelle → *Select*, Link → *URL*.

---

## PROMPT zum Kopieren (für Claude im richtigen Konto)

> Ich habe eine Event-Liste für Berlin (Juni–Oktober 2026) als CSV (`fomo_events.csv`,
> hochgeladen). Bitte:
> 1. Verbinde dich mit meinem Notion (dieser Workspace) und lege eine neue Datenbank
>    **„FOMO Berlin — Event Calendar 2026"** an, mit genau diesen Spalten:
>    - Event Name (Title)
>    - Datum (Date)
>    - Start (Text)
>    - Kategorie (Select: Networking, Talk / Conf, Drinks, Party, Dinner, Breakfast, Lunch, Activity, Wellness, Festival)
>    - Status (Select: Open RSVP, Invite only, Waitlist, Sold out, Paid)
>    - Veranstaltungsort (Text)
>    - Beschreibung (Text)
>    - Veranstalter (Text)
>    - Quelle (Select: Luma, Meetup, Eventbrite, Instagram, Website, YouTube, LinkedIn, Google Forms, Tally, Rausgegangen, EventCreate)
>    - Link (URL)
> 2. Fülle die Datenbank mit allen Zeilen aus der CSV.
> 3. Sortiere nach Datum aufsteigend.
> Danach möchte ich daraus eine Website bauen und automatisiert über GitHub +
> Cloudflare veröffentlichen (Details liegen in CLAUDE.md und AUTOMATISIERUNG-Setup.md
> im selben Ordner).

---

## Was schon fertig in diesem Ordner liegt
- `fomo_events.csv` / `data/fomo_events.json` — die 159 Events (Datenbank-Inhalt).
- `index.html` + `public/index.html` — die fertige Website (Daten eingebettet).
- `build.js` (aus Notion) / `build-from-json.js` (aus Datei) — Build-Skripte.
- `.github/workflows/deploy.yml` + `wrangler.toml` — Auto-Deploy zu Cloudflare.
- `CLAUDE.md` — Projektkontext (Claude Code liest das automatisch).
- `AUTOMATISIERUNG-Setup.md` — alle Schritte für die Voll-Automatisierung.

## Hinweise
- Datenqualität: einige Einträge sind Instagram-Links ohne Titel; ein paar Daten sind
  geschätzt (steht in „Beschreibung"). Vor dem Veröffentlichen kurz prüfen.
- Tokens/Secrets (Notion-API-Key, Cloudflare) trägst immer du selbst ein.
