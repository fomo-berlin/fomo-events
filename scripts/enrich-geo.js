// One-time / occasional geocoder. Reads data/fomo_events.json, geocodes every
// venue that has a Berlin PLZ via Nominatim (1 req/sec, custom UA, cached), and
// writes data/geo-cache.json. The build merges this cache offline — so normal
// builds and CI never hit the network.
//
// Usage:  node scripts/enrich-geo.js          (geocode new/unknown venues)
//         node scripts/enrich-geo.js --force   (also retry previous misses)
//
// Nominatim policy: https://operations.osmfoundation.org/policies/nominatim/
const fs = require('fs');
const path = require('path');
const { extractPlz } = require('../lib/berlin-plz.js');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'fomo_events.json');
const CACHE = path.join(ROOT, 'data', 'geo-cache.json');
const UA = 'FOMO-Berlin-Calendar/1.0 (+https://www.fomoberlin.com; contact qais.sadiq422@gmail.com)';
const RATE_MS = 1200; // > 1s to stay safely under the 1 req/s limit
const FORCE = process.argv.includes('--force');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const loadJson = (p, def) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return def; } };

async function geocode(q) {
  const params = new URLSearchParams({
    q, format: 'jsonv2', limit: '1', addressdetails: '0', countrycodes: 'de',
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'de' },
  });
  if (res.status === 403 || res.status === 429) throw new Error(`Nominatim throttled (${res.status})`);
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const d = await res.json();
  if (!Array.isArray(d) || !d.length) return null;
  const lat = +d[0].lat, lon = +d[0].lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

(async () => {
  const events = loadJson(DATA, []);
  const cache = loadJson(CACHE, {});
  let dirty = false, firstLive = true;
  let hit = 0, fromCache = 0, missed = 0, noPlz = 0;

  for (const e of events) {
    const loc = e.location || '';
    const plz = extractPlz(loc);
    if (!plz) { noPlz++; continue; }
    const key = norm(loc);
    const cached = cache[key];
    if (cached && cached.lat != null) { fromCache++; continue; }
    if (cached && cached.tried && !FORCE) { missed++; continue; }

    if (!firstLive) await sleep(RATE_MS);
    firstLive = false;

    const cleaned = loc.replace(/\s+/g, ' ').trim();
    const q1 = /berlin/i.test(cleaned) ? `${cleaned}, Germany` : `${cleaned}, Berlin, Germany`;
    let geo = null;
    try { geo = await geocode(q1); } catch (err) { console.warn('  ! ', err.message, '::', loc); }
    if (!geo) {
      await sleep(RATE_MS);
      try { geo = await geocode(`${plz} Berlin, Germany`); } catch { /* ignore */ }
    }

    cache[key] = geo ? { lat: geo.lat, lon: geo.lon } : { lat: null, lon: null, tried: true };
    dirty = true;
    if (geo) { hit++; console.log('  ✓', loc, '→', geo.lat.toFixed(5), geo.lon.toFixed(5)); }
    else { missed++; console.log('  ✗ no result ::', loc); }
  }

  if (dirty) fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2));
  console.log(`\ngeo done — ${hit} new, ${fromCache} cached, ${missed} missed, ${noPlz} no-PLZ. cache size: ${Object.keys(cache).length}`);
})().catch((e) => { console.error('enrich-geo failed:', e); process.exit(1); });
