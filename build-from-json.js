// Build the site from the local data file (no Notion needed).
// Usage: node build-from-json.js   ->   writes a complete ./public
//
// Pipeline (see lib/emit.js): copy ./static -> ./public, enrich events with
// geo + bezirk/kiez, inject events into index.html, emit the .ics feed, and
// stamp the service-worker build id.
const fs = require('fs');
const path = require('path');
const { emit } = require('./lib/emit.js');

const root = __dirname;
const events = JSON.parse(fs.readFileSync(path.join(root, 'data', 'fomo_events.json'), 'utf8'));

const { events: built, buildId, mapped } = emit(root, events);

console.log(`🎉 Built public/ from data/fomo_events.json`);
console.log(`   events: ${built.length} · on map: ${mapped} · build: ${buildId}`);
