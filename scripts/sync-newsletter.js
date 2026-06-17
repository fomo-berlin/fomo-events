#!/usr/bin/env node
/**
 * sync-newsletter.js
 *
 * Liest die Newsletter-Draft-Seite in Notion,
 * extrahiert alle Events (To-Do-Einträge mit Datum-Kontext)
 * und überträgt neue Events — dedupliziert per URL — in die Hauptdatenbank.
 *
 * Ablauf:
 *   1. Alle existierenden Links aus der Hauptdatenbank holen (Set, 1 Abfrage)
 *   2. Alle Blöcke der Newsletter-Seite abrufen
 *   3. Datum-Kontext aus h2/h3-Überschriften extrahieren
 *   4. Jeden To-Do-Eintrag mit Link prüfen: bereits vorhanden? → skip
 *   5. Neue Events anlegen (350ms Rate-Limit-Pause)
 *
 * Env vars:
 *   NOTION_API_KEY               — Notion Integration Token
 *   NOTION_NEWSLETTER_PAGE_ID    — ID der Newsletter-Seite (default unten)
 *   NOTION_EVENTS_DS_ID          — Data Source ID der Hauptdatenbank
 */

const NOTION_VERSION      = '2026-03-11';
const API_BASE            = 'https://api.notion.com/v1';

const API_KEY              = process.env.NOTION_API_KEY;
const NEWSLETTER_PAGE_ID   = process.env.NOTION_NEWSLETTER_PAGE_ID
                             || '3802312d-f1b4-81da-aab8-d4e1eb54acd5';
const EVENTS_DS_ID         = process.env.NOTION_EVENTS_DS_ID
                             || '3812312d-f1b4-803b-9b87-000be0bf8c81';

if (!API_KEY) {
  console.error('[sync-newsletter] ❌ NOTION_API_KEY fehlt. Skript wird übersprungen.');
  // Kein process.exit(1) — Build soll trotzdem laufen
  process.exit(0);
}

const headers = {
  'Authorization':  `Bearer ${API_KEY}`,
  'Notion-Version': NOTION_VERSION,
  'Content-Type':   'application/json',
};

// ─── Notion API Helper ────────────────────────────────────────────────────────

async function notionFetch(path, method = 'GET', body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion ${method} ${path} → ${res.status}: ${err}`);
  }
  return res.json();
}

// ─── Schritt 1: Existierende URLs aus Hauptdatenbank holen ───────────────────

/**
 * Holt ALLE Links aus der Hauptdatenbank in einem Set.
 * Viel effizienter als pro Event eine einzelne Abfrage zu machen.
 */
async function fetchExistingUrls() {
  const urls = new Set();
  let cursor;

  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const data = await notionFetch(
      `/data_sources/${EVENTS_DS_ID}/query`, 'POST', body
    );

    for (const page of data.results || []) {
      const link = page.properties?.Link?.url;
      if (link) urls.add(link);
    }

    cursor = data.next_cursor;
  } while (cursor);

  return urls;
}

// ─── Schritt 2: Newsletter-Seite lesen ───────────────────────────────────────

/** Holt alle Blöcke einer Seite (paginiert) */
async function fetchAllBlocks(pageId) {
  const blocks = [];
  let cursor;

  do {
    const params = cursor ? `?start_cursor=${cursor}` : '';
    const data   = await notionFetch(`/blocks/${pageId}/children${params}`);
    blocks.push(...(data.results || []));
    cursor = data.next_cursor;
  } while (cursor);

  return blocks;
}

// ─── Schritt 3: Parsen ───────────────────────────────────────────────────────

/** Extrahiert plain_text und erste URL aus einem Notion rich_text-Array */
function extractTextAndUrl(richText = []) {
  if (richText.length === 0) return { text: null, url: null };

  const text    = richText.map(t => t.plain_text).join('').trim();
  const urlPart = richText.find(t => t.href || t.text?.link?.url);
  const url     = urlPart?.href || urlPart?.text?.link?.url || null;

  return { text: text || null, url };
}

/**
 * Parst Datum aus Überschriften wie "Dienstag 9.6", "Freitag 25.7", "5.10"
 * → ISO-String "2026-MM-DD"
 */
function parseDateFromHeading(heading) {
  const match = heading.match(/(\d{1,2})\.(\d{1,2})/);
  if (!match) return null;

  const day   = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  return `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ─── Schritt 4 + 5: Events anlegen ───────────────────────────────────────────

async function createEvent(title, url, date) {
  const properties = {
    'Event Name': { title: [{ text: { content: title } }] },
  };

  if (date) properties['Datum'] = { date: { start: date } };
  if (url)  properties['Link']  = { url };

  return notionFetch('/pages', 'POST', {
    parent: { type: 'data_source_id', data_source_id: EVENTS_DS_ID },
    properties,
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[sync-newsletter] 📰 Starte Newsletter → Datenbank Sync...');

  // 1. Existierende URLs vorladen (ein Durchlauf, kein API-Call pro Event)
  let existingUrls;
  try {
    existingUrls = await fetchExistingUrls();
    console.log(`[sync-newsletter] 🔗 ${existingUrls.size} Links bereits in der Datenbank.`);
  } catch (err) {
    console.warn(`[sync-newsletter] ⚠️  Konnte Hauptdatenbank nicht lesen: ${err.message}`);
    console.warn('[sync-newsletter] Build läuft trotzdem weiter.');
    return;
  }

  // 2. Newsletter-Seite lesen
  let blocks;
  try {
    blocks = await fetchAllBlocks(NEWSLETTER_PAGE_ID);
    console.log(`[sync-newsletter] 📋 ${blocks.length} Blöcke in der Newsletter-Seite.`);
  } catch (err) {
    console.warn(`[sync-newsletter] ⚠️  Konnte Newsletter-Seite nicht lesen: ${err.message}`);
    console.warn('[sync-newsletter] Build läuft trotzdem weiter.');
    return;
  }

  // 3. Blöcke durchlaufen, Datum-Kontext tracken, Events anlegen
  let currentDate = null;
  let created     = 0;
  let skipped     = 0;
  let errors      = 0;

  for (const block of blocks) {

    // h2 / h3 → Datum-Kontext aktualisieren (h1 = Monatsname, ignorieren)
    if (block.type === 'heading_2' || block.type === 'heading_3') {
      const rt   = block[block.type]?.rich_text || [];
      const { text } = extractTextAndUrl(rt);
      if (text) {
        const parsed = parseDateFromHeading(text);
        if (parsed) {
          currentDate = parsed;
        }
      }
      continue;
    }

    // To-Do-Einträge verarbeiten
    if (block.type === 'to_do') {
      const rt          = block.to_do?.rich_text || [];
      const { text, url } = extractTextAndUrl(rt);

      // Ohne Link überspringen (Instagram-Posts ohne URL, TBD-Einträge, etc.)
      if (!text || !url) continue;

      // Dedup-Check
      if (existingUrls.has(url)) {
        skipped++;
        continue;
      }

      try {
        await createEvent(text, url, currentDate);
        existingUrls.add(url); // Lokal merken, falls doppelter Eintrag auf der Seite
        console.log(`[sync-newsletter] ✅ Neu: "${text}" (${currentDate || 'kein Datum'})`);
        created++;

        // Notion Rate-Limit: max ~3 req/s
        await new Promise(r => setTimeout(r, 350));

      } catch (err) {
        console.error(`[sync-newsletter] ❌ Fehler bei "${text}": ${err.message}`);
        errors++;
      }
    }
  }

  console.log(
    `[sync-newsletter] 🎉 Fertig: ${created} neu angelegt, ` +
    `${skipped} bereits vorhanden, ${errors} Fehler.`
  );
}

main().catch(err => {
  console.error('[sync-newsletter] ❌ Unerwarteter Fehler:', err);
  // Kein process.exit(1) — Build soll trotzdem laufen
});
