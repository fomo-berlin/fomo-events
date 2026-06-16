// One-off / repeatable importer: a Notion CSV export → data/fomo_events.json.
// Usage:  node scripts/import-notion-csv.js "<path to ..._all.csv>"
// Columns expected (Notion "🗓️ FOMO Berlin – Events 2026"):
//   Name, Adresse, Art, Ausgabe, Beschreibung, Datum, Ende, Im Newsletter,
//   Kategorie, Link, Ort, Preis, Quelle, Status, Uhrzeit, Veranstalter
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const csvPath = process.argv[2];
if (!csvPath) { console.error('Usage: node scripts/import-notion-csv.js <export_all.csv>'); process.exit(1); }

// ---- robust RFC-4180 CSV parser (handles quotes, commas + newlines in fields) ----
function parseCsv(text) {
  text = text.replace(/^﻿/, '');           // strip BOM
  const rows = []; let row = []; let field = ''; let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* ignore */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// ---- German date "18. Juni 2026" → "2026-06-18" (also accepts ISO) ----
const DE_MONTHS = { januar:1, februar:2, 'märz':3, maerz:3, april:4, mai:5, juni:6, juli:7,
  august:8, september:9, oktober:10, november:11, dezember:12 };
function toIsoDate(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);            // already ISO?
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = s.match(/(\d{1,2})\.?\s*([A-Za-zäöüÄÖÜ]+)\.?\s+(\d{4})/); // "18. Juni 2026"
  if (m) {
    const mo = DE_MONTHS[m[2].toLowerCase()];
    if (mo) return `${m[3]}-${String(mo).padStart(2,'0')}-${String(+m[1]).padStart(2,'0')}`;
  }
  return '';
}

const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONKEY = {0:'jan',1:'feb',2:'mar',3:'apr',4:'may',5:'jun',6:'jul',7:'aug',8:'sep',9:'oct',10:'nov',11:'dec'};
const DAYKEY = ['sun','mon','tue','wed','thu','fri','sat'];

// Kategorie → site "vibe" key (the site only has these 8 chips).
const CAT_MAP = {
  'networking':'networking', 'talk / conf':'panel', 'talk/conf':'panel', 'drinks':'drinks',
  'party':'party', 'dinner':'dinner', 'breakfast':'breakfast', 'activity':'activity',
  'wellness':'wellness', 'festival':'party', 'hackathon':'panel', 'pitch / demo':'panel',
  'pitch/demo':'panel', 'workshop':'panel', 'sonstige':'networking',
};
const CAT_LABEL = { networking:'Networking', panel:'Talk / Conf', drinks:'Drinks', party:'Party',
  dinner:'Dinner', breakfast:'Breakfast', activity:'Activity', wellness:'Wellness' };

// Editorial rows that are not calendar events.
const NON_EVENT_ART = new Set(['Intro','Shout-out','Sponsor','Spotlight','Opportunity','Carve Out']);
const STATUS_LABELS = { open:'Open RSVP', invite:'Invite only', waitlist:'Waitlist', soldout:'Sold out', paid:'Paid' };

// RSVP access status from price + description (Notion "Status" is a workflow status, unused here).
function accessStatus(preis, blob) {
  const t = `${preis} ${blob}`.toLowerCase();
  if (/ausverkauft|sold[\s-]?out/.test(t)) return 'soldout';
  if (/warteliste|wait[\s-]?list/.test(t)) return 'waitlist';
  if (/invite|einladung|auf einladung|nur investor|investors only|geschlossen|private|approval|geheim/.test(t)) return 'invite';
  // paid only when the PRICE actually carries a number or currency (not "Anmeldung erforderlich")
  const p = String(preis || '').toLowerCase();
  if (/(\d|€|eur|chf|usd|\$)/.test(p) && !/kostenlos|gratis|free|frei|^0\b/.test(p)) return 'paid';
  return 'open';
}

// Newsletter-section prefixes that leak into the event Name — strip for clean titles.
const TITLE_PREFIX = /^(Top Event|Carve Out|Spotlight|Intro|Shout[- ]?out|Main Sponsor|Sponsor|Opportunity)\s*:\s*/i;

function toEvent(rec) {
  const title = (rec['Name'] || '').trim().replace(TITLE_PREFIX, '').trim();
  const date = toIsoDate(rec['Datum']);
  if (!title || !date) return null;
  if (NON_EVENT_ART.has((rec['Art'] || '').trim())) return null;

  const d = new Date(date + 'T00:00:00Z');
  const kategorie = (rec['Kategorie'] || '').trim();
  const desc = (rec['Beschreibung'] || '').trim();
  const host = (rec['Veranstalter'] || '').trim();
  const source = (rec['Quelle'] || '').trim();
  const preis = (rec['Preis'] || '').trim();
  const link = (rec['Link'] || '').trim();
  const hasLink = /^https?:\/\//i.test(link);

  const start = (rec['Uhrzeit'] || '').trim();
  const ende = (rec['Ende'] || '').trim();
  const time = start ? (ende ? `${start} – ${ende}` : start) : '';

  const location = (rec['Adresse'] || '').trim() || (rec['Ort'] || '').trim();

  const cat = CAT_MAP[kategorie.toLowerCase()] || 'networking';
  const status = accessStatus(preis, `${title} ${desc} ${location}`);

  return {
    date,
    day: DAYKEY[d.getUTCDay()],
    monthKey: MONKEY[d.getUTCMonth()],
    dateLabel: `${WD[d.getUTCDay()]} · ${MON[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`,
    time,
    title,
    host,
    desc,
    location,
    cat,
    catLabel: kategorie === 'Sonstige' ? 'Other' : (kategorie || CAT_LABEL[cat] || 'Event'),
    status,
    statusLabel: STATUS_LABELS[status],
    link: hasLink ? link : '',
    linkLabel: hasLink ? 'Register ↗' : '',
    fomoHosted: /fomo/i.test(`${title} ${host}`),
    source,
  };
}

// ---- run ----
const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
const header = rows.shift().map((h) => h.replace(/^﻿/, '').trim());
const records = rows
  .filter((r) => r.some((c) => c && c.trim()))                  // drop blank lines
  .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));

let skipped = 0;
const events = records.map((rec) => { const e = toEvent(rec); if (!e) skipped++; return e; })
  .filter(Boolean)
  .sort((a, b) => (a.date !== b.date ? a.date.localeCompare(b.date) : (a.time || '').localeCompare(b.time || '')));

fs.writeFileSync(path.join(ROOT, 'data', 'fomo_events.json'), JSON.stringify(events, null, 2) + '\n');

// summary
const dates = events.map((e) => e.date).sort();
const byCat = {}; events.forEach((e) => (byCat[e.cat] = (byCat[e.cat] || 0) + 1));
const byStatus = {}; events.forEach((e) => (byStatus[e.status] = (byStatus[e.status] || 0) + 1));
const TODAY = new Date().toISOString().slice(0, 10);
console.log(`CSV rows: ${records.length}  →  events written: ${events.length}  (skipped: ${skipped})`);
console.log(`date range: ${dates[0]} … ${dates[dates.length - 1]}   future (>= ${TODAY}): ${events.filter((e) => e.date >= TODAY).length}`);
console.log(`with time: ${events.filter((e) => e.time).length}   with location: ${events.filter((e) => e.location).length}   with link: ${events.filter((e) => e.link).length}`);
console.log(`cat:`, JSON.stringify(byCat));
console.log(`status:`, JSON.stringify(byStatus));
console.log(`no-date skips (sample):`, records.filter((r) => r['Name'] && !toIsoDate(r['Datum'])).slice(0, 5).map((r) => `${r['Name']} [${r['Datum']}]`));
