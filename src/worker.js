// Cloudflare Worker: static assets (./public) + POST /api/submit-event.
// Only /api/* reaches this Worker (run_worker_first in wrangler.toml); every
// other path is served directly from static assets.
//
// The submit endpoint writes a new page into a Notion database using the
// 2025-09-03+ "data sources" model (current Notion-Version 2026-03-11). It is
// hardened with: same-origin check, honeypot, per-IP rate limit, strict
// validation and whitelisted select values. Secrets:
//   NOTION_API_KEY        (wrangler secret put)  — integration token
//   NOTION_DATA_SOURCE_ID (var or secret)        — resolved data source id
//   ALLOWED_ORIGIN        (var)                  — your site origin
// See SETUP-SUBMIT-FORM.md.

const NOTION_VERSION = '2026-03-11';
const NOTION_PAGES_URL = 'https://api.notion.com/v1/pages';

// Whitelists so public input can't create junk Notion select options.
const CATEGORIES = new Set(['Networking', 'Talk / Conf', 'Drinks', 'Party', 'Dinner', 'Breakfast', 'Activity', 'Wellness']);
const ACCESS = new Set(['Open RSVP', 'Invite only', 'Waitlist', 'Paid']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/submit-event') return handleSubmit(request, env);
    // Defensive fallthrough (rarely reached given run_worker_first scoping).
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
  },
};

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', ...extra },
  });
}

const str = (v, max) => (v == null ? '' : String(v)).trim().slice(0, max);

async function handleSubmit(request, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405, { Allow: 'POST' });

  // Same-origin guard (the form posts from our own page; no CORS needed).
  // When ALLOWED_ORIGIN is configured, require an exact match — a MISSING Origin
  // header is rejected too (don't let a stripped header bypass the check).
  const origin = request.headers.get('Origin');
  if (env.ALLOWED_ORIGIN && origin !== env.ALLOWED_ORIGIN) {
    return json({ ok: false, error: 'Forbidden origin' }, 403);
  }

  let data;
  try {
    const ct = request.headers.get('Content-Type') || '';
    data = ct.includes('application/json') ? await request.json() : Object.fromEntries((await request.formData()).entries());
  } catch {
    return json({ ok: false, error: 'Invalid body' }, 400);
  }

  // Honeypot: a hidden field only bots fill. Silently accept so they learn nothing.
  if (data.website_url) return json({ ok: true });

  // Per-IP rate limit (lightweight; binding is optional).
  if (env.SUBMIT_LIMITER) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const { success } = await env.SUBMIT_LIMITER.limit({ key: `submit:${ip}` });
    if (!success) return json({ ok: false, error: 'Too many submissions, please slow down.' }, 429);
  }

  // Validate at the boundary.
  const title = str(data.title, 160);
  const date = str(data.date, 10);
  const email = str(data.email, 160);
  if (!title) return json({ ok: false, error: 'Event name is required.' }, 422);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ ok: false, error: 'A valid date is required.' }, 422);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: 'A valid email is required.' }, 422);

  if (!env.NOTION_API_KEY || !env.NOTION_DATA_SOURCE_ID) {
    // Not configured yet — tell the client so it can fall back to email.
    return json({ ok: false, error: 'Submissions are not configured yet.' }, 503);
  }

  const category = CATEGORIES.has(str(data.category, 40)) ? str(data.category, 40) : null;
  const access = ACCESS.has(str(data.status, 40)) ? str(data.status, 40) : null;
  const link = str(data.link, 500);
  // Only the columns documented for this DB are sent (Event Name, Datum, Start,
  // Kategorie, Status, Veranstaltungsort, Beschreibung, Veranstalter, Link).
  // Access + submitter contact go into the description so no extra column is needed.
  const desc = [
    str(data.description, 600),
    access && `Access: ${access}`,
    `— submitted via website by ${email}`,
  ].filter(Boolean).join('\n');

  const properties = {
    'Event Name': { title: [{ text: { content: title } }] },
    'Datum': { date: { start: date } },
    'Status': { select: { name: 'Pending review' } },
    'Veranstaltungsort': { rich_text: [{ text: { content: str(data.location, 200) } }] },
    'Beschreibung': { rich_text: [{ text: { content: desc } }] },
    'Veranstalter': { rich_text: [{ text: { content: str(data.host, 160) } }] },
  };
  if (str(data.time, 20)) properties['Start'] = { rich_text: [{ text: { content: str(data.time, 20) } }] };
  if (category) properties['Kategorie'] = { select: { name: category } };
  if (link && /^https?:\/\//i.test(link)) properties['Link'] = { url: link };

  const body = { parent: { type: 'data_source_id', data_source_id: env.NOTION_DATA_SOURCE_ID }, properties };

  let res;
  try {
    res = await fetch(NOTION_PAGES_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.NOTION_API_KEY}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error('Notion fetch failed', e && e.message);
    return json({ ok: false, error: 'Could not reach the database. Try again later.' }, 502);
  }
  if (!res.ok) {
    console.error('Notion error', res.status, await res.text().catch(() => ''));
    return json({ ok: false, error: 'Could not save the event. Try again later.' }, 502);
  }
  return json({ ok: true });
}
