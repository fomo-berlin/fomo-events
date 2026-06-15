// Build the site from the local data file (no Notion needed).
// Usage: node build-from-json.js   ->   writes public/index.html
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'data', 'fomo_events.json');
const tmplPath = path.join(__dirname, 'index.html');

const events = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const template = fs.readFileSync(tmplPath, 'utf8');
const out = template.replace('/* FOMO_EVENTS_JSON */', JSON.stringify(events, null, 2));

fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'public', 'index.html'), out);
console.log(`🎉 Built public/index.html from data/fomo_events.json (${events.length} events)`);
