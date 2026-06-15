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
    return { ...d, lat: geo && geo.lat != null ? geo.lat : null, lon: geo && geo.lon != null ? geo.lon : null };
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

// Inject the events JSON into the template at the placeholder.
function writeIndex(root, template, events) {
  const out = template.replace('/* FOMO_EVENTS_JSON */', JSON.stringify(events, null, 2));
  if (out.includes('/* FOMO_EVENTS_JSON */')) throw new Error('events placeholder not replaced');
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
