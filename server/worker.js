/* ============================================
   WORKER.JS — the three endpoints the panel talks to
   ============================================

   A Cloudflare Worker implementing exactly what js/service.js calls:

     GET  /version    { version, url, notes, critical }
     GET  /messages   { messages: [ { id, title, body, url, date, kind } ] }
     POST /feedback   accepts a report, forwards it, archives it

   plus one route the panel never touches:

     POST /admin/*    write the version record and post messages,
                      guarded by a bearer token

   WHY A WORKER

   This has to be up whenever somebody opens the panel and it costs nothing
   when nobody does. There is no database worth the name here — a version
   record and a handful of announcements — so KV is the whole storage layer and
   the free tier covers it several times over.

   DELIVERY OF FEEDBACK

   Feedback goes to a webhook you set as a secret: a Discord channel, a Slack
   incoming webhook, or an automation endpoint. Whatever it is, it should be
   somewhere you actually look, because the value of the feedback button is
   entirely in the reading. Every report is also archived to KV so nothing is
   lost if the webhook is down or misconfigured.

   DEPLOY

     cd server
     npx wrangler kv namespace create LG_KV
     # paste the returned id into wrangler.jsonc
     npx wrangler secret put ADMIN_TOKEN
     npx wrangler secret put FEEDBACK_WEBHOOK
     npx wrangler deploy

   Then set API in js/service.js to the deployed hostname. */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra }
  });
}

/* The panel is the only caller and it retries on its own schedule, so a
   rejected request is never fatal. This exists to make the feedback route
   uninteresting to abuse, not to police legitimate use — the limit is far
   above what a person clicking a button can reach. */
async function rateLimited(env, request, bucket, limit, windowSec) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  /* Hash the address rather than storing it. The key needs to be stable and
     unique, not reversible. */
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(bucket + ':' + ip)
  );
  const key = 'rl:' + [...new Uint8Array(digest)].slice(0, 8)
    .map(b => b.toString(16).padStart(2, '0')).join('');

  const current = parseInt((await env.LG_KV.get(key)) || '0', 10);
  if (current >= limit) return true;
  await env.LG_KV.put(key, String(current + 1), { expirationTtl: windowSec });
  return false;
}

function authorised(request, env) {
  const header = request.headers.get('Authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '');
  return !!env.ADMIN_TOKEN && token === env.ADMIN_TOKEN;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    /* ── GET /version ───────────────────────────────────────────────
       The panel compares this to its own version and shows a notice if it
       is behind. Cached at the edge for five minutes: a release does not
       need to propagate in seconds, and this is the most-hit route. */
    if (path === '/version' && request.method === 'GET') {
      const record = await env.LG_KV.get('version', 'json');
      return json(
        record || { version: '2.0.0', url: '', notes: '', critical: false },
        200,
        { 'Cache-Control': 'public, max-age=300' }
      );
    }

    /* ── GET /messages ──────────────────────────────────────────────
       Announcements, newest first, capped. `panel` lets a message be aimed
       at people on a particular build — "2.0.0 had a bug, here is what to
       do" should not be shown to anyone already on 2.0.1. */
    if (path === '/messages' && request.method === 'GET') {
      const panel = url.searchParams.get('panel') || '';
      const all = (await env.LG_KV.get('messages', 'json')) || [];

      const visible = all.filter(m => {
        if (m.expires && Date.parse(m.expires) < Date.now()) return false;
        if (m.onlyPanel && panel && m.onlyPanel !== panel) return false;
        return true;
      });

      visible.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      return json(
        { messages: visible.slice(0, 25) },
        200,
        { 'Cache-Control': 'public, max-age=300' }
      );
    }

    /* ── POST /feedback ─────────────────────────────────────────────
       Forward first, archive always. The archive is what makes a broken
       webhook a nuisance rather than a data loss. */
    if (path === '/feedback' && request.method === 'POST') {
      if (await rateLimited(env, request, 'feedback', 20, 3600)) {
        return json({ ok: false, error: 'Too many messages. Try again later.' }, 429);
      }

      let body;
      try { body = await request.json(); }
      catch { return json({ ok: false, error: 'Malformed request.' }, 400); }

      const message = String(body.message || '').slice(0, 8000).trim();
      if (!message) return json({ ok: false, error: 'Empty message.' }, 400);

      const record = {
        id: crypto.randomUUID(),
        received: new Date().toISOString(),
        kind: ['general', 'bug', 'feature'].includes(body.kind) ? body.kind : 'general',
        subject: String(body.subject || '').slice(0, 200),
        email: String(body.email || '').slice(0, 200),
        message,
        meta: body.meta || {},
        country: request.headers.get('CF-IPCountry') || ''
      };

      await env.LG_KV.put('feedback:' + record.received + ':' + record.id, JSON.stringify(record), {
        expirationTtl: 60 * 60 * 24 * 180
      });

      if (env.FEEDBACK_WEBHOOK) {
        /* Fire and forget — the sender should not wait on Discord, and a
           webhook failure must not turn into an error the user sees, since
           the message is already safely archived. */
        const label = { bug: '🐞 Bug', feature: '💡 Feature', general: '💬 Feedback' }[record.kind];
        const m = record.meta || {};
        const lines = [
          `**${label}** ${record.subject ? '— ' + record.subject : ''}`,
          record.message,
          '',
          '`' + [
            m.panel ? 'panel ' + m.panel : '',
            m.host || '',
            m.os || '',
            m.hostLanguage || '',
            m.storeBackend ? 'store:' + m.storeBackend : '',
            m.hostCanWriteFiles === false ? '⚠ cannot write files' : '',
            m.presetCount != null ? m.presetCount + ' presets' : ''
          ].filter(Boolean).join(' · ') + '`',
          record.email ? `reply to: ${record.email}` : '_no reply address_',
          m.lastError ? '```' + String(m.lastError).slice(0, 500) + '```' : ''
        ].filter(Boolean).join('\n');

        try {
          await fetch(env.FEEDBACK_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: m.length > 1900 ? lines.slice(0, 1900) : lines, text: lines })
          });
        } catch { /* archived already */ }
      }

      return json({ ok: true, id: record.id });
    }

    /* ── POST /admin/version ────────────────────────────────────────
         { "version": "2.1.0", "url": "...", "notes": "...", "critical": false } */
    if (path === '/admin/version' && request.method === 'POST') {
      if (!authorised(request, env)) return json({ ok: false }, 401);
      const body = await request.json();
      await env.LG_KV.put('version', JSON.stringify({
        version: String(body.version || ''),
        url: String(body.url || ''),
        notes: String(body.notes || ''),
        critical: !!body.critical
      }));
      return json({ ok: true });
    }

    /* ── POST /admin/message ────────────────────────────────────────
         { "title": "...", "body": "...", "url": "...", "kind": "news",
           "expires": "2026-12-01T00:00:00Z", "onlyPanel": "2.0.0" }
       Posting the same id twice replaces it, which is how a typo in an
       announcement gets fixed rather than duplicated. */
    if (path === '/admin/message' && request.method === 'POST') {
      if (!authorised(request, env)) return json({ ok: false }, 401);
      const body = await request.json();

      const list = (await env.LG_KV.get('messages', 'json')) || [];
      const entry = {
        id: body.id || crypto.randomUUID(),
        title: String(body.title || 'Living Gradients'),
        body: String(body.body || ''),
        url: body.url ? String(body.url) : null,
        kind: ['news', 'update', 'warning'].includes(body.kind) ? body.kind : 'news',
        date: body.date || new Date().toISOString(),
        expires: body.expires || null,
        onlyPanel: body.onlyPanel || null
      };

      const next = list.filter(m => m.id !== entry.id);
      next.unshift(entry);
      await env.LG_KV.put('messages', JSON.stringify(next.slice(0, 50)));
      return json({ ok: true, id: entry.id });
    }

    /* ── GET /admin/feedback ────────────────────────────────────────
       Read the archive without going to the dashboard. */
    if (path === '/admin/feedback' && request.method === 'GET') {
      if (!authorised(request, env)) return json({ ok: false }, 401);
      const list = await env.LG_KV.list({ prefix: 'feedback:', limit: 100 });
      const items = await Promise.all(
        list.keys.map(k => env.LG_KV.get(k.name, 'json'))
      );
      return json({ ok: true, count: items.length, items: items.filter(Boolean).reverse() });
    }

    return json({ ok: false, error: 'Not found' }, 404);
  }
};
