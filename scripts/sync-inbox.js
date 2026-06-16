#!/usr/bin/env node
/**
 * sync-inbox.js
 *
 * Liest neue Events aus der "📥 Event Inbox" Notion-Datenbank
 * und überträgt sie automatisch in die Hauptdatenbank
 * "FOMO Berlin — Event Calendar 2026".
 *
 * Ablauf:
 *   1. Alle Inbox-Einträge holen, bei denen "✅ In Datenbank übertragen" = false
 *   2. Für jeden Eintrag: neues Event in der Hauptdatenbank anlegen
 *   3. Inbox-Eintrag als "✅ übertragen" markieren
 *
 * Wird automatisch von GitHub Actions vor dem Build ausgeführt.
 *
 * Env vars:
 *   NOTION_API_KEY         — Notion Integration Token
 *   NOTION_INBOX_DS_ID     — Data Source ID der Inbox (fb561103-bc4d-44e2-822b-d84cd752af0e)
 *   NOTION_EVENTS_DS_ID    — Data Source ID der Hauptdatenbank (7e63e3e6-7276-4064-9a5c-5f13d4551bb7)
 */

const NOTION_VERSION = '2026-03-11';
const API_BASE = 'https://api.notion.com/v1';

const API_KEY      = process.env.NOTION_API_KEY;
const INBOX_DS_ID  = process.env.NOTION_INBOX_DS_ID  || 'fb561103-bc4d-44e2-822b-d84cd752af0e';
const EVENTS_DS_ID = process.env.NOTION_EVENTS_DS_ID || '7e63e3e6-7276-4064-9a5c-5f13d4551bb7';

if (!API_KEY) {
  console.error('[sync-inbox] ❌ NOTION_API_KEY fehlt. Setze die Env-Variable und starte neu.');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Notion-Version': NOTION_VERSION,
  'Content-Type': 'application/json',
};

// ─── Notion API Helpers ───────────────────────────────────────────────────────

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

/** Gibt die interne Notion collection_id (Block-ID der Datenbank) anhand der data_source_id zurück */
async function resolveCollectionId(dataSourceId) {
  const data = await notionFetch(`/data_sources/${dataSourceId}`);
  return data.id; // collection block ID
}

/** Holt alle Inbox-Einträge, bei denen "✅ In Datenbank übertragen" = false/unchecked */
async function fetchInboxPending() {
  const body = {
    filter: {
      property: '✅ In Datenbank übertragen',
      checkbox: { equals: false },
    },
    page_size: 100,
  };

  const results = [];
  let cursor = undefined;

  do {
    if (cursor) body.start_cursor = cursor;
    const data = await notionFetch(`/data_sources/${INBOX_DS_ID}/query`, 'POST', body);
    results.push(...(data.results || []));
    cursor = data.next_cursor;
  } while (cursor);

  return results;
}

/** Liest einen einzelnen Notion-Property-Wert aus dem Page-Objekt */
function getProp(page, name) {
  const prop = page.properties?.[name];
  if (!prop) return null;

  switch (prop.type) {
    case 'title':
      return prop.title?.map(t => t.plain_text).join('') || null;
    case 'rich_text':
      return prop.rich_text?.map(t => t.plain_text).join('') || null;
    case 'date':
      return prop.date?.start || null;
    case 'select':
      return prop.select?.name || null;
    case 'url':
      return prop.url || null;
    case 'checkbox':
      return prop.checkbox;
    default:
      return null;
  }
}

/** Baut Notion-Property-Objekte für die Hauptdatenbank */
function buildEventProperties(inboxPage) {
  const props = {};

  const title = getProp(inboxPage, 'Event Name');
  if (title) {
    props['Event Name'] = { title: [{ text: { content: title } }] };
  }

  const datum = getProp(inboxPage, 'Datum');
  if (datum) {
    props['Datum'] = { date: { start: datum } };
  }

  const uhrzeit = getProp(inboxPage, 'Uhrzeit');
  if (uhrzeit) {
    props['Start'] = { rich_text: [{ text: { content: uhrzeit } }] };
  }

  const ort = getProp(inboxPage, 'Ort / Venue');
  if (ort) {
    props['Veranstaltungsort'] = { rich_text: [{ text: { content: ort } }] };
  }

  const link = getProp(inboxPage, 'Link / RSVP');
  if (link) {
    props['Link'] = { url: link };
  }

  const kategorie = getProp(inboxPage, 'Kategorie');
  if (kategorie) {
    props['Kategorie'] = { select: { name: kategorie } };
  }

  const status = getProp(inboxPage, 'Status');
  if (status) {
    props['Status'] = { select: { name: status } };
  }

  const veranstalter = getProp(inboxPage, 'Veranstalter');
  if (veranstalter) {
    props['Veranstalter'] = { rich_text: [{ text: { content: veranstalter } }] };
  }

  const desc = getProp(inboxPage, 'Beschreibung');
  if (desc) {
    props['Beschreibung'] = { rich_text: [{ text: { content: desc } }] };
  }

  return props;
}

/** Erstellt ein neues Event in der Hauptdatenbank */
async function createEventInMainDB(properties) {
  return notionFetch('/pages', 'POST', {
    parent: { type: 'data_source_id', data_source_id: EVENTS_DS_ID },
    properties,
  });
}

/** Markiert den Inbox-Eintrag als "✅ In Datenbank übertragen" */
async function markAsTransferred(pageId) {
  return notionFetch(`/pages/${pageId}`, 'PATCH', {
    properties: {
      '✅ In Datenbank übertragen': { checkbox: true },
    },
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[sync-inbox] 🔍 Suche neue Events in der Inbox...');

  let pending;
  try {
    pending = await fetchInboxPending();
  } catch (err) {
    console.warn(`[sync-inbox] ⚠️  Konnte Inbox nicht lesen: ${err.message}`);
    console.warn('[sync-inbox] Build läuft trotzdem weiter (Inbox optional).');
    return;
  }

  if (pending.length === 0) {
    console.log('[sync-inbox] ✅ Keine neuen Events in der Inbox. Nichts zu tun.');
    return;
  }

  console.log(`[sync-inbox] 📋 ${pending.length} neue Event(s) gefunden. Übertrage...`);

  let transferred = 0;
  let errors = 0;

  for (const page of pending) {
    const title = getProp(page, 'Event Name') || '(kein Titel)';
    const pageId = page.id;

    try {
      const properties = buildEventProperties(page);

      if (!properties['Event Name']) {
        console.warn(`[sync-inbox] ⚠️  Überspringe "${title}" — kein Event Name.`);
        errors++;
        continue;
      }

      await createEventInMainDB(properties);
      await markAsTransferred(pageId);

      console.log(`[sync-inbox] ✅ Übertragen: "${title}"`);
      transferred++;

      // Notion Rate Limit: max ~3 req/s
      await new Promise(r => setTimeout(r, 350));

    } catch (err) {
      console.error(`[sync-inbox] ❌ Fehler bei "${title}": ${err.message}`);
      errors++;
    }
  }

  console.log(`[sync-inbox] 🎉 Fertig: ${transferred} übertragen, ${errors} Fehler.`);
}

main().catch(err => {
  console.error('[sync-inbox] ❌ Unerwarteter Fehler:', err);
  // Kein process.exit(1) — Build soll trotzdem laufen
});
