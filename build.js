// Build the site LIVE from a Notion database (for later automation).
// Required env: NOTION_API_KEY, NOTION_DATABASE_ID
// Expected Notion columns (rename in getText() if yours differ):
//   Event Name (title) · Datum (date) · Start · Ende · Kategorie · Status ·
//   Veranstaltungsort · Beschreibung · Veranstalter · Link
const { Client } = require('@notionhq/client');
const fs = require('fs');

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;
if (!NOTION_API_KEY || !DATABASE_ID) {
  console.error('❌ NOTION_API_KEY und NOTION_DATABASE_ID müssen gesetzt sein.');
  process.exit(1);
}
const notion = new Client({ auth: NOTION_API_KEY });

function getText(prop) {
  if (!prop) return '';
  if (prop.title) return prop.title.map(t => t.plain_text).join('');
  if (prop.rich_text) return prop.rich_text.map(t => t.plain_text).join('');
  if (prop.select) return prop.select.name || '';
  if (prop.multi_select) return prop.multi_select.map(s => s.name).join(', ');
  if (prop.date) return prop.date.start || '';
  if (prop.url) return prop.url || '';
  if (prop.checkbox !== undefined) return prop.checkbox ? 'true' : '';
  return '';
}

const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WD  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONKEY = {0:'jan',1:'feb',2:'mar',3:'apr',4:'may',5:'jun',6:'jul',7:'aug',8:'sep',9:'oct',10:'nov',11:'dec'};
const DAYKEY = ['sun','mon','tue','wed','thu','fri','sat'];

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

async function fetchAll(){
  let all=[], cursor=undefined, more=true;
  while(more){
    const r = await notion.databases.query({ database_id: DATABASE_ID, start_cursor: cursor, page_size: 100 });
    all = all.concat(r.results); more = r.has_more; cursor = r.next_cursor;
  }
  return all;
}

async function build(){
  console.log('📡 Rufe Events aus Notion ab ...');
  const pages = await fetchAll();
  const events = [];
  for (const page of pages){
    const p = page.properties;
    const title = getText(p['Event Name']) || getText(p['Name']) || getText(p['Title']);
    const datum = getText(p['Datum']) || getText(p['Date']);
    if (!title || !datum) continue;
    const d = new Date(datum + (datum.length === 10 ? 'T00:00:00Z' : ''));
    const kategorie = getText(p['Kategorie']);
    const status = getText(p['Status']);
    const notes = getText(p['Beschreibung']);
    const start = getText(p['Start']);
    const cat = catKey(`${title} ${kategorie} ${notes}`);
    events.push({
      date: datum.slice(0,10),
      day: DAYKEY[d.getUTCDay()],
      monthKey: MONKEY[d.getUTCMonth()],
      dateLabel: `${WD[d.getUTCDay()]} · ${MON[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`,
      time: start || '',
      title,
      host: getText(p['Veranstalter']) || '',
      desc: notes || '',
      location: getText(p['Veranstaltungsort']) || '',
      cat,
      catLabel: kategorie || ({activity:'Activity',wellness:'Wellness',breakfast:'Breakfast',drinks:'Drinks',dinner:'Dinner',party:'Party',lunch:'Lunch',panel:'Talk / Conf',networking:'Networking'})[cat],
      status: statusKey(status),
      statusLabel: status || 'Open RSVP',
      link: getText(p['Link']) || '',
      linkLabel: getText(p['Link']) ? 'Register ↗' : '',
      fomoHosted: /fomo/i.test(`${title} ${getText(p['Veranstalter'])}`),
      source: ''
    });
  }
  events.sort((a,b)=> a.date!==b.date ? a.date.localeCompare(b.date) : (a.time||'').localeCompare(b.time||''));
  const template = fs.readFileSync('index.html','utf8');
  const out = template.replace('/* FOMO_EVENTS_JSON */', JSON.stringify(events, null, 2));
  fs.mkdirSync('public', { recursive: true });
  fs.writeFileSync('public/index.html', out);
  // also refresh the local data file
  fs.writeFileSync('data/fomo_events.json', JSON.stringify(events, null, 2));
  console.log(`🎉 Seite gebaut → public/index.html (${events.length} Events aus Notion)`);
}
build().catch(e => { console.error('Fehler:', e); process.exit(1); });
