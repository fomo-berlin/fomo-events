// Shared build steps used by both build-from-json.js (local) and build.js (Notion).
// Produces a complete ./public from ./static + the events array.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { withDistrict } = require('./berlin-plz.js');
const { buildFeed } = require('./ics.js');

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Attach lat/lon (from data/geo-cache.json) + bezirk/kiez (from PLZ, offline).
function enrichEvents(root, events) {
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(path.join(root, 'data', 'geo-cache.json'), 'utf8')); } catch { /* none yet */ }
  return events.map((e) => {
    const d = withDistrict(e);
    const geo = cache[norm(e.location)];
    // Never let a bare URL be the title (e.g. a raw Instagram link from Notion):
    // fall back to "Event via <source>" so the row, .ics SUMMARY and share text stay readable.
    const rawTitle = String(d.title || '').trim();
    const title = /^https?:\/\//i.test(rawTitle) ? `Event${d.source ? ` via ${d.source}` : ''}` : d.title;
    return { ...d, title, lat: geo && geo.lat != null ? geo.lat : null, lon: geo && geo.lon != null ? geo.lon : null };
  });
}

// Copy everything in ./static into ./public (vendor libs, icons, manifest, sw, _headers…).
function copyStatic(root) {
  const src = path.join(root, 'static');
  const dst = path.join(root, 'public');
  fs.mkdirSync(dst, { recursive: true });
  if (fs.existsSync(src)) fs.cpSync(src, dst, { recursive: true });
}

// Stamp a content-based build id into public/sw.js (cache-busting for the PWA).
function stampServiceWorker(root, buildId) {
  const swPath = path.join(root, 'public', 'sw.js');
  if (!fs.existsSync(swPath)) return;
  const sw = fs.readFileSync(swPath, 'utf8').replace(/__BUILD_ID__/g, buildId);
  fs.writeFileSync(swPath, sw);
}

// Make the events JSON safe to inline inside a <script>: escape every "<" so a
// value containing "</script>" can't break out of the inline script (stored-XSS
// guard for publicly-submitted, curated content). "<" -> "<" is valid JSON
// inside a JS string and renders identically.
function safeInlineJson(events) {
  return JSON.stringify(events, null, 2).replace(/</g, '\\u003c');
}

const SITE_URL = 'https://www.fomoberlin.com/';

// A location is concrete enough for schema.org Event (skip "Berlin"/"invite-only"/TBA).
function isConcreteLocation(loc) {
  const s = String(loc || '').trim();
  if (!s) return false;
  return !/^(disclosed|visible|hidden|invite|invitation|tba|—|berlin$|berlin,? germany$)/i.test(s);
}

// Berlin UTC offset ("+02:00"/"+01:00") for a given YYYY-MM-DD (handles CET/CEST).
function berlinOffset(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const part = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', timeZoneName: 'shortOffset' })
    .formatToParts(dt).find((p) => p.type === 'timeZoneName');
  const mt = ((part && part.value) || 'GMT+1').match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/);
  const h = mt ? parseInt(mt[1], 10) : 1;
  const mm = mt && mt[2] ? parseInt(mt[2], 10) : 0;
  return `${h < 0 ? '-' : '+'}${String(Math.abs(h)).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function startDateIso(e) {
  const m = String(e.time || '').match(/(\d{1,2}):(\d{2})/);
  if (!m) return e.date; // date-only
  return `${e.date}T${String(+m[1]).padStart(2, '0')}:${m[2]}:00${berlinOffset(e.date)}`;
}

// schema.org JSON-LD graph (Organization + WebSite + ItemList of concrete-location Events).
function buildJsonLd(events) {
  const org = { '@type': 'Organization', '@id': `${SITE_URL}#org`, name: 'FOMO Berlin', url: SITE_URL, logo: `${SITE_URL}icon-512.png`, sameAs: ['https://www.instagram.com/fomoberlin247', 'https://www.linkedin.com/company/fomo-fearofmissingout/'] };
  const website = { '@type': 'WebSite', '@id': `${SITE_URL}#website`, name: 'FOMO Berlin — Event Calendar', url: SITE_URL, publisher: { '@id': `${SITE_URL}#org` } };
  const concrete = events.filter((e) => e.date && isConcreteLocation(e.location));
  const itemList = {
    '@type': 'ItemList',
    name: 'FOMO Berlin — upcoming events',
    numberOfItems: concrete.length,
    itemListElement: concrete.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Event',
        name: String(e.title || '').slice(0, 200),
        startDate: startDateIso(e),
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        location: { '@type': 'Place', name: String(e.location).slice(0, 120), address: { '@type': 'PostalAddress', addressLocality: 'Berlin', addressCountry: 'DE' } },
        organizer: e.host ? { '@type': 'Organization', name: String(e.host).slice(0, 120) } : { '@id': `${SITE_URL}#org` },
        ...(e.desc ? { description: String(e.desc).slice(0, 300) } : {}),
        ...(e.link && /^https?:\/\//i.test(e.link) ? { url: e.link } : {}),
      },
    })),
  };
  const graph = { '@context': 'https://schema.org', '@graph': [org, website, itemList] };
  // Escape "<" so the JSON-LD can't break out of the <script> element.
  return `<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>`;
}

// Inject the events JSON + structured data into the template at their placeholders.
function writeIndex(root, template, events) {
  const json = safeInlineJson(events);
  // Replacer FUNCTION so "$" sequences in the data (e.g. "$20,000") are NOT
  // interpreted as String.replace special patterns ($&, $1, …).
  let out = template.replace('/* FOMO_EVENTS_JSON */', () => json);
  if (out.includes('/* FOMO_EVENTS_JSON */')) throw new Error('events placeholder not replaced');
  out = out.replace('<!-- FOMO_JSONLD -->', () => buildJsonLd(events));
  fs.writeFileSync(path.join(root, 'public', 'index.html'), out);
}

// Write the subscribe-able all-events calendar feed.
function writeIcsFeed(root, events) {
  fs.writeFileSync(path.join(root, 'public', 'fomo-berlin.ics'), buildFeed(events));
}

// Full build: static -> public, enrich, inject, ics feed, sw stamp. Returns enriched events.
function emit(root, rawEvents) {
  const template = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const events = enrichEvents(root, rawEvents);
  const buildId = crypto.createHash('sha256')
    .update(template).update(JSON.stringify(events)).digest('hex').slice(0, 12);

  copyStatic(root);
  writeIndex(root, template, events);
  writeIcsFeed(root, events);
  stampServiceWorker(root, buildId);

  const mapped = events.filter((e) => e.lat != null).length;
  return { events, buildId, mapped };
}

module.exports = { emit, enrichEvents };
