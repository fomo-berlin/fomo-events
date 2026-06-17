// RFC 5545 iCalendar generation for the build-time .ics feed (Node).
// Mirrors the browser-side builder inlined in index.html. Correctness notes:
//  - line folding counts OCTETS (UTF-8), never splits a multibyte char
//  - escape order: backslash FIRST, then ; , and newlines; colon NOT escaped
//  - DTEND is NON-INCLUSIVE (all-day end = start + 1 day)
//  - timed events use TZID=Europe/Berlin local wall time (no Z)

const BERLIN_TZ = 'Europe/Berlin';

function icsEscape(value) {
  if (value == null) return '';
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

function foldLine(line) {
  const MAX = 75; // octets, excluding CRLF
  let out = '';
  let curBytes = 0;
  let first = true;
  for (const ch of line) {
    const chBytes = Buffer.byteLength(ch, 'utf8');
    const limit = first ? MAX : MAX - 1;
    if (curBytes + chBytes > limit) {
      out += '\r\n ';
      curBytes = 1;
      first = false;
    }
    out += ch;
    curBytes += chBytes;
  }
  return out;
}

const pad = (n) => String(n).padStart(2, '0');

function utcStamp(date) {
  return (
    date.getUTCFullYear() + pad(date.getUTCMonth() + 1) + pad(date.getUTCDate()) + 'T' +
    pad(date.getUTCHours()) + pad(date.getUTCMinutes()) + pad(date.getUTCSeconds()) + 'Z'
  );
}

const dateOnly = (ymd) => ymd.replace(/-/g, '');
function nextDay(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.getUTCFullYear() + pad(dt.getUTCMonth() + 1) + pad(dt.getUTCDate());
}

// "18:00" / "18:00–20:00" -> { start:"180000", end:"200000"|null }
function parseTime(time) {
  const t = String(time || '').trim();
  if (!t) return null;
  const parts = t.split(/[–-]/).map((s) => s.trim());
  const toHMS = (s) => {
    const m = s.match(/(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return pad(+m[1]) + pad(+m[2]) + '00';
  };
  const start = toHMS(parts[0]);
  if (!start) return null;
  const end = parts[1] ? toHMS(parts[1]) : null;
  return { start, end };
}

const BERLIN_VTIMEZONE = [
  'BEGIN:VTIMEZONE', 'TZID:Europe/Berlin',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST',
  'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET',
  'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE',
];

function slugId(ev) {
  const base = `${ev.date}-${ev.title || ''}`.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return base || ev.date;
}

function veventLines(ev, stamp) {
  const lines = ['BEGIN:VEVENT', `UID:${slugId(ev)}@fomoberlin.com`, `DTSTAMP:${stamp}`];
  const tm = parseTime(ev.time);
  if (tm) {
    const dt = dateOnly(ev.date);
    lines.push(`DTSTART;TZID=${BERLIN_TZ}:${dt}T${tm.start}`);
    // explicit end, else a 2h default DURATION (avoids a zero-length event)
    if (tm.end) {
      // cross-midnight (e.g. 22:00–01:00): roll the end date forward a day
      const endDate = tm.end <= tm.start ? nextDay(ev.date) : dt;
      lines.push(`DTEND;TZID=${BERLIN_TZ}:${endDate}T${tm.end}`);
    } else lines.push('DURATION:PT2H');
  } else {
    lines.push(`DTSTART;VALUE=DATE:${dateOnly(ev.date)}`);
    lines.push(`DTEND;VALUE=DATE:${nextDay(ev.date)}`);
  }
  lines.push(`SUMMARY:${icsEscape(ev.title)}`);
  const desc = [ev.host && `Host: ${ev.host}`, ev.desc, ev.source && `via ${ev.source}`]
    .filter(Boolean).join(' — ');
  if (desc) lines.push(`DESCRIPTION:${icsEscape(desc)}`);
  if (ev.location) lines.push(`LOCATION:${icsEscape(ev.location)}`);
  if (ev.link) lines.push(`URL:${icsEscape(ev.link)}`);
  lines.push('END:VEVENT');
  return lines;
}

// Build a full multi-event calendar feed (Europe/Berlin VTIMEZONE included once).
function buildFeed(events, stamp = utcStamp(new Date())) {
  let lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0',
    'PRODID:-//FOMO Berlin//Event Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:FOMO Berlin — Events', 'X-WR-TIMEZONE:Europe/Berlin',
  ];
  lines = lines.concat(BERLIN_VTIMEZONE);
  for (const ev of events) lines = lines.concat(veventLines(ev, stamp));
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

module.exports = { buildFeed, slugId };
