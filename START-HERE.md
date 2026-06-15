# So machst du in Claude Code weiter

Alles für die Website liegt schon als Code in diesem Ordner. Du musst es nur in
Claude Code öffnen und loslegen.

## 1. Claude Code installieren (macOS, einmalig)
Terminal öffnen und einfügen:
```bash
curl -fsSL https://claude.ai/install.sh | bash
```
Danach prüfen:
```bash
claude --version
```

## 2. In dieses Projekt wechseln
```bash
cd ~/Downloads/fomo-berlin-events
```

## 3. Claude Code starten
```bash
claude
```
Beim ersten Mal öffnet sich der Browser zum Anmelden (mit deinem Claude-Konto).

## 4. Projekt verstehen lassen
Es liegt bereits eine `CLAUDE.md` im Ordner — Claude Code liest sie automatisch.
Optional kannst du sie aktualisieren lassen mit:
```
/init
```

## 5. Erster Auftrag (Beispiel — anpassen/kürzen wie du willst)
Kopiere so etwas in Claude Code:

> Lies CLAUDE.md. Das ist eine statische Event-Website für Berlin (Daten in
> data/fomo_events.json, Template in index.html). Ich möchte daraus eine mächtigere
> Website machen. Baue als Erstes: (1) "Add to calendar"/.ics pro Event,
> (2) eine Kartenansicht der Venues, (3) eine "Heute/Diese Woche"-Schnellansicht.
> Halte index.html als eine eigenständige Datei, ändere die Daten nicht inhaltlich,
> und baue nach jeder Änderung neu (npm run build) und zeige mir das Ergebnis.

## Nützliche Befehle in Claude Code
- `/help` — alle Befehle
- `/init` — CLAUDE.md (neu) generieren
- `/memory` — Projektgedächtnis bearbeiten

Tipp: Mach vorher eine Kopie des Ordners oder nutze Git, damit du Änderungen
jederzeit zurücknehmen kannst.
