// Build the site LIVE from a Notion database (CI default).
// Uses the current Notion "data sources" API (Notion-Version 2026-03-11) via
// raw fetch — no SDK. Required env: NOTION_API_KEY, NOTION_DATABASE_ID.
//
// Robust by design: if Notion env is missing or any call fails, it logs a
// warning and falls back to building from the committed data/fomo_events.json,
// so a deploy never hard-fails. Expected DB columns:
//   Event Name (title) · Datum (date) · Start · Kategorie · Status ·
//   Veranstaltungsort · Beschreibung · Veranstalter · Link
const fs = require('fs');
const path = require('path');
const { emit } = require('./lib/emit.js');

const ROOT = __dirname;
const NOTION_VERSION = '2026-03-11';
const API = 'https://api.notion.com/v1';
const TOKEN = process.env.NOTION_API_KEY;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

const headers = () => ({ Authorization: `Bearer ${TOKEN}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' });

const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONKEY = { 0:'jan',1:'feb',2:'mar',3:'apr',4:'may',5:'jun',6:'jul',7:'aug',8:'sep',9:'oct',10:'nov',11:'dec' };
const DAYKEY = ['sun','mon','tue','wed','thu','fri','sat'];

function getText(prop) {
  if (!prop) return '';
  if (prop.title) return prop.title.map((t) => t.plain_text).join('');
  if (prop.rich_text) return prop.rich_text.map((t) => t.plain_text).join('');
  if (prop.select) return prop.select.name || '';
  if (prop.multi_select) return prop.multi_select.map((s) => s.name).join(', ');
  if (prop.date) return prop.date.start || '';
  if (prop.url) return prop.url || '';
  if (prop.checkbox !== undefined) return prop.checkbox ? 'true' : '';
  return '';
}
function catKey(s){ s=(s||'').toLowerCase();
  if(/run|padel|yoga|fitness|pilates|sport|hike|walk/.test(s)) return 'activity';
  if(/wellness|meditation|retreat|mental|longevity/.test(s)) return 'wellness';
  if(/breakfast|brunch/.test(s)) return 'breakfast';
  if(/drinks|reception|cocktail|aperitivo|sundowner|wein/.test(s)) return 'drinks';
  if(/dinner/.test(s)) return 'dinner';
  if(/party|afterparty|rave|club/.test(s)) return 'party';
  if(/lunch/.test(s)) return 'lunch';
  if(/panel|roundtable|summit|conference|congress|hackathon|workshop|talk|speaker|pitch|meetup|festival/.test(s)) return 'panel';
  return 'networking';
}
function statusKey(s){ s=(s||'').toLowerCase();
  if(/invite|invitation|private|approval/.test(s)) return 'invite';
  if(/waitlist|wait list|full|closed/.test(s)) return 'waitlist';
  if(/sold out|cancel/.test(s)) return 'soldout';
  if(/paid|ticket|€/.test(s)) return 'paid';
  return 'open';
}

// database_id -> data_source_id (cached single source). New API: a database
// contains one or more data sources; pages live under a data source.
async function resolveDataSourceId() {
  const r = await fetch(`${API}/databases/${DATABASE_ID}`, { headers: headers() });
  if (!r.ok) throw new Error(`retrieve database ${r.status}: ${await r.text().catch(()=> '')}`);
  const db = await r.json();
  const ds = db.data_sources && db.data_sources[0] && db.data_sources[0].id;
  if (!ds) throw new Error('no data_sources on database (share the integration with the DB?)');
  return ds;
}
async function queryAll(dataSourceId) {
  let all = [], cursor = undefined, more = true;
  while (more) {
    const r = await fetch(`${API}/data_sources/${dataSourceId}/query`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ start_cursor: cursor, page_size: 100 }),
    });
    if (!r.ok) throw new Error(`query ${r.status}: ${await r.text().catch(()=> '')}`);
    const data = await r.json();
    all = all.concat(data.results || []);
    more = data.has_more; cursor = data.next_cursor;
  }
  return all;
}
function toEvent(page) {
  const p = page.properties || {};
  const title = getText(p['Event Name']) || getText(p['Name']) || getText(p['Title']);
  const datum = getText(p['Datum']) || getText(p['Date']);
  if (!title || !datum) return null;
  const d = new Date(datum + (datum.length === 10 ? 'T00:00:00Z' : ''));
  const kategorie = getText(p['Kategorie']);
  const status = getText(p['Status']);
  const notes = getText(p['Beschreibung']);
  const cat = catKey(`${title} ${kategorie} ${notes}`);
  const catLabelMap = { activity:'Activity', wellness:'Wellness', breakfast:'Breakfast', drinks:'Drinks', dinner:'Dinner', party:'Party', lunch:'Lunch', panel:'Talk / Conf', networking:'Networking' };
  return {
    date: datum.slice(0, 10),
    day: DAYKEY[d.getUTCDay()],
    monthKey: MONKEY[d.getUTCMonth()],
    dateLabel: `${WD[d.getUTCDay()]} · ${MON[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`,
    time: getText(p['Start']) || '',
    title,
    host: getText(p['Veranstalter']) || '',
    desc: notes || '',
    location: getText(p['Veranstaltungsort']) || '',
    cat,
    catLabel: kategorie || catLabelMap[cat],
    status: statusKey(status),
    statusLabel: status || 'Open RSVP',
    link: getText(p['Link']) || '',
    linkLabel: getText(p['Link']) ? 'Register ↗' : '',
    fomoHosted: /fomo/i.test(`${title} ${getText(p['Veranstalter'])}`),
    source: '',
  };
}

function buildFromLocal(reason) {
  console.warn(`⚠️  Falling back to local data (${reason}).`);
  const events = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fomo_events.json'), 'utf8'));
  const { mapped, buildId } = emit(ROOT, events);
  console.log(`🎉 Built public/ from data/fomo_events.json (${events.length} events · ${mapped} on map · ${buildId})`);
}

async function main() {
  if (!TOKEN || !DATABASE_ID) return buildFromLocal('NOTION_API_KEY / NOTION_DATABASE_ID not set');
  try {
    console.log('📡 Fetching events from Notion (data sources API)…');
    const dsId = await resolveDataSourceId();
    const pages = await queryAll(dsId);
    const events = pages.map(toEvent).filter(Boolean)
      .sort((a, b) => (a.date !== b.date ? a.date.localeCompare(b.date) : (a.time || '').localeCompare(b.time || '')));
    if (!events.length) return buildFromLocal('Notion returned 0 events');
    // refresh the committed data file too, so the next geo run + fallback stay current
    fs.writeFileSync(path.join(ROOT, 'data', 'fomo_events.json'), JSON.stringify(events, null, 2));
    const { mapped, buildId } = emit(ROOT, events);
    console.log(`🎉 Built public/ from Notion (${events.length} events · ${mapped} on map · ${buildId})`);
  } catch (e) {
    buildFromLocal(e.message);
  }
}
main();
