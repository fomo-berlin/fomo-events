# „Mach dort weiter"-Prompt (in Claude Code, richtiges Konto)

Terminal: `cd ~/Downloads/fomo-berlin-events` → `claude`. Dann einfügen:

---

> Lies CLAUDE.md und START-HERE.md — das Projekt ist fertig gebaut (Website + Karte +
> PWA + .ics + Submit-Formular). Hilf mir jetzt, es scharf zu schalten. Arbeite diese
> Punkte der Reihe nach ab und frag bei jeder Stelle, an der du Login/Token/Account
> brauchst (die gebe ich selbst ein — zeig mir nur genau wo):
>
> 1) NOTION: Verbinde dich mit meinem Notion in DIESEM Workspace. Importiere
>    `data/fomo_notion_import.csv` als neue Datenbank „FOMO Berlin — Event Calendar 2026"
>    (oder fülle eine bestehende), Spaltentypen: Datum=Date, Kategorie/Status/Quelle=Select,
>    Link=URL. Teile die DB anschließend mit meiner Notion-Integration. Gib mir die
>    Database-ID und die Data-Source-ID aus.
> 2) NOTION-TOKEN: Sag mir Schritt für Schritt, wie ich auf notion.so/my-integrations
>    den Token (NOTION_API_KEY) erstelle und die DB dafür freigebe.
> 3) GITHUB: Pushe dieses bestehende Repo zu einem neuen GitHub-Repo `fomo-berlin-events`.
>    Sag mir, welche Secrets ich anlegen muss: NOTION_API_KEY, NOTION_DATABASE_ID,
>    CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID (und für das Submit-Formular die Worker-
>    Secrets aus SETUP-SUBMIT-FORM.md).
> 4) CLOUDFLARE: Führe mich durch Account-ID + API-Token (Edit Cloudflare Workers) und
>    passe `wrangler.toml` (name) an, falls nötig.
> 5) TEST & DEPLOY: Lass `npm run build:notion` einmal laufen und prüfe, dass es die
>    Events aus Notion zieht (data-sources API). Dann triggere das Deploy und zeig mir die
>    Live-URL. Mach am Ende `npm run dev` und prüfe Karte, Filter und Add-to-calendar.
>
> Halte index.html als eine eigenständige Datei, ändere die Event-Inhalte nicht, und
> committe nach jedem sinnvollen Schritt, damit ich zurückrollen kann.

---

Tipp: Falls Claude im anderen Konto **nicht** auf Notion zugreifen kann, zuerst den
Notion-Connector dort neu verbinden und beim Login den richtigen Workspace wählen.
