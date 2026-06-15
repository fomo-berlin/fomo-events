# FOMO Berlin — Übergabe / Handoff

Dieses Projekt ist eine **fertige, funktionierende** Website: ein werbefreier
Veranstaltungskalender für Berlin (Startup / Tech / Kultur). Single-Page,
statisch, deployt zu Cloudflare. Alles liegt in **diesem einen Ordner**.

> Du wechselst gerade dein Claude-Konto? Kein Problem — das Projekt hängt nicht
> am Konto. Öffne einfach eine neue Claude-Code-Session **in diesem Ordner** und
> kopiere den Prompt aus `START-PROMPT.txt` als erste Nachricht hinein.

---

## In 30 Sekunden starten

```bash
cd ~/Downloads/fomo-berlin-events
npm run dev      # baut + serviert auf http://localhost:8765
```
Dann http://localhost:8765 im Browser öffnen. (Muss über http laufen — wegen
Service Worker + absoluten Pfaden; `file://` reicht nicht.)

Kein `npm install` nötig (keine Laufzeit-Abhängigkeiten).

---

## Was bereits gebaut & getestet ist

| Feature | Status |
|---------|--------|
| „Add to Calendar" pro Event (Google / Apple / Outlook / `.ics`) + Abo-Feed `/fomo-berlin.ics` | ✅ |
| Schnellfilter Heute / Diese Woche / Wochenende + Live-Countdown | ✅ |
| Interaktive Karte (Leaflet, selbst-gehostet) + Kiez/Bezirk-Filter | ✅ |
| Favoriten (localStorage), teilbare `?e=`-Links, Web-Share | ✅ |
| PWA: installierbar + offline | ✅ |
| Event-einreichen-Formular → Cloudflare Worker → Notion (+ E-Mail-Fallback) | ✅ |
| Vergangene Events fallen **automatisch** weg (Filter `date >= heute` im Browser) | ✅ |
| Sicherheits-/A11y-/Korrektheits-Review eingearbeitet | ✅ |

Alles ist in Git committet (`git log` zeigt die Historie).

---

## Wichtigste Dateien

- `index.html` — die ganze Seite (Inline-CSS/JS). **Bleibt eine selbst-enthaltene Datei.**
- `data/fomo_events.json` — die Events. Hier änderst du Inhalte.
- `data/geo-cache.json` — gecachte Koordinaten der Venues (für die Karte).
- `build-from-json.js` — Standard-Build (`npm run build`).
- `build.js` — Build live aus Notion (`npm run build:notion`), mit Fallback auf die lokale JSON.
- `lib/`, `scripts/`, `static/`, `src/worker.js` — Build-Logik, Geocoder, statische Assets, der Submit-Worker.
- `public/` — die generierte, deploybare Seite (**nicht** von Hand editieren).
- `CLAUDE.md` — ausführliche technische Doku (Architektur, Schema, Notion, Deploy).
- `START-HERE.md` — einfache Bedienungs-Anleitung für dich.
- `SETUP-SUBMIT-FORM.md` — optionales Setup, damit das Formular direkt nach Notion schreibt.

---

## Inhalte ändern

1. `data/fomo_events.json` bearbeiten.
2. `npm run build`
3. Bei **neuen** Venues einmalig `npm run geo` (geocodiert für die Karte).

---

## Veröffentlichen (Deploy)

Nach GitHub pushen → die Action (`.github/workflows/deploy.yml`) baut und deployt
automatisch zu Cloudflare. Nötige GitHub-Secrets: `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID` (für Notion zusätzlich `NOTION_API_KEY`, `NOTION_DATABASE_ID`).

---

## Optional / noch offen

- **Submit-Formular → Notion scharf schalten:** siehe `SETUP-SUBMIT-FORM.md`
  (10 Min, einmalig). Bis dahin öffnet das Formular automatisch eine vorbereitete E-Mail.
- **Echte Domain / Cloudflare-Secrets** setzen (falls noch nicht geschehen).
- Ideen für später stehen unten in `CLAUDE.md`.

---

## Für eine neue Claude-Session

Kopiere den Inhalt von **`START-PROMPT.txt`** als erste Nachricht. Claude liest
dann `CLAUDE.md` / `START-HERE.md` / `HANDOFF.md`, startet die Vorschau und ist
sofort im Bilde.
