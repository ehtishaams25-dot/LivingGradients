/* ============================================
   SERVICE.JS — updates, messages, feedback
   ============================================

   Three endpoints and no more. That is the whole cloud footprint of Code
   Runner, and it is the right size:

     GET  /version              is there a newer build
     GET  /messages             notices worth showing in the panel
     POST /feedback             a message that lands in a human's inbox

   WHAT THIS IS FOR

   The feedback button is not a support feature, it is a product feature. A
   panel that ships to a few thousand people generates bug reports whether or
   not you provide a way to send them; the only question is whether they arrive
   with the After Effects version, the panel version and the operating system
   attached, or as "it doesn't work" in a YouTube comment. Attaching the
   context automatically is the entire trick.

   The notification bell is the other half: a channel to the people who already
   have the panel. Without it, an update reaches whoever happens to revisit the
   product page.

   RULES THIS FOLLOWS

   1. Nothing here blocks the panel. Every call is fire-and-forget with a
      timeout; a dead network changes nothing about how the panel behaves.
   2. Nothing here is sent without the user doing something, except the version
      check and the message fetch — both of which send only the panel version,
      and both of which can be turned off in settings.
   3. The email field is optional and is only ever sent when the user typed it.
   4. No identifiers, no telemetry, no counting. If that changes, it changes in
      this file and it changes visibly.

   DEPENDS ON: store.js, library.js */

var LGService = (function () {
  'use strict';

  /* ── CONFIGURATION ───────────────────────────────────────────────── */

  /* Point this at your own deployment. server/worker.js in this repo is a
     Cloudflare Worker that implements all three routes; deploy it, put its
     hostname here, and the panel lights up. Until then every call fails
     quietly and the panel behaves exactly as it does today. */
  var API = 'https://api.digivero.dev/living-gradients';

  var PANEL_VERSION = '2.0.0';
  var PRODUCT_URL = 'https://digivero.gumroad.com/l/livinggradients';

  var CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;   /* twice a day at most */
  var TIMEOUT_MS = 6000;

  var inbox = null;
  var listeners = [];

  /* ── PLUMBING ────────────────────────────────────────────────────── */

  /* fetch with a hard timeout. Without this a hung connection leaves the
     bell spinning forever, which looks like a broken panel rather than a
     network that is down. */
  function request(url, options) {
    options = options || {};
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    if (controller) options.signal = controller.signal;

    var timer = setTimeout(function () {
      if (controller) controller.abort();
    }, TIMEOUT_MS);

    return fetch(url, options)
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .catch(function (err) {
        clearTimeout(timer);
        throw err;
      });
  }

  function emit() {
    var state = inboxState();
    listeners.forEach(function (fn) { try { fn(state); } catch (e) { } });
  }

  function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }

  /* ── INBOX STATE ─────────────────────────────────────────────────── */

  /* Which notices have been seen lives next to the library rather than in
     localStorage, for the same reason everything else does: clearing the CEF
     cache should not resurrect three months of read announcements. */
  function loadInbox() {
    if (inbox) return inbox;
    inbox = LGStore.available()
      ? LGStore.readJson(LGStore.paths.inbox, null)
      : null;
    if (!inbox || !inbox.messages) {
      inbox = { messages: [], read: {}, fetched: 0, update: null };
    }
    return inbox;
  }

  function saveInbox() {
    if (LGStore.available()) LGStore.writeJson(LGStore.paths.inbox, inbox);
    emit();
  }

  function inboxState() {
    var box = loadInbox();
    var unread = box.messages.filter(function (m) { return !box.read[m.id]; });
    return {
      messages: box.messages.slice().sort(function (a, b) {
        return (b.date || '').localeCompare(a.date || '');
      }),
      unread: unread.length,
      update: box.update,
      fetched: box.fetched
    };
  }

  function markRead(id) {
    var box = loadInbox();
    box.read[id] = Date.now();
    saveInbox();
  }

  function markAllRead() {
    var box = loadInbox();
    box.messages.forEach(function (m) { box.read[m.id] = Date.now(); });
    saveInbox();
  }

  /* ── VERSION ─────────────────────────────────────────────────────── */

  /* Numeric-segment comparison, so 2.10.0 is correctly newer than 2.9.0 —
     which a string compare gets wrong, and which is exactly the release
     where you find out. */
  function isNewer(remote, local) {
    var a = String(remote || '').split('.').map(Number);
    var b = String(local || '').split('.').map(Number);
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var x = a[i] || 0, y = b[i] || 0;
      if (x > y) return true;
      if (x < y) return false;
    }
    return false;
  }

  function checkForUpdate(force) {
    var settings = LGLibrary.settings();
    if (!settings.checkForUpdates && !force) return Promise.resolve(null);

    var since = settings.lastUpdateCheck || 0;
    if (!force && Date.now() - since < CHECK_INTERVAL_MS) {
      return Promise.resolve(loadInbox().update);
    }

    LGLibrary.setSetting('lastUpdateCheck', Date.now());

    return request(API + '/version?panel=' + encodeURIComponent(PANEL_VERSION))
      .then(function (data) {
        var box = loadInbox();
        if (data && data.version && isNewer(data.version, PANEL_VERSION)) {
          box.update = {
            version: data.version,
            url: data.url || PRODUCT_URL,
            notes: data.notes || '',
            critical: !!data.critical
          };
        } else {
          box.update = null;
        }
        saveInbox();
        return box.update;
      })
      .catch(function () { return null; });
  }

  /* ── MESSAGES ────────────────────────────────────────────────────── */

  function fetchMessages(force) {
    var settings = LGLibrary.settings();
    if (!settings.checkForUpdates && !force) return Promise.resolve(inboxState());

    var box = loadInbox();
    if (!force && Date.now() - (box.fetched || 0) < CHECK_INTERVAL_MS) {
      return Promise.resolve(inboxState());
    }

    return request(API + '/messages?panel=' + encodeURIComponent(PANEL_VERSION))
      .then(function (data) {
        var incoming = (data && data.messages) || [];
        var known = {};
        box.messages.forEach(function (m) { known[m.id] = m; });

        /* Merge rather than replace, so a message pulled from the server
           does not vanish from someone's panel before they read it. */
        incoming.forEach(function (m) {
          if (!m || !m.id) return;
          known[m.id] = {
            id: m.id,
            title: m.title || 'Living Gradients',
            body: m.body || '',
            url: m.url || null,
            date: m.date || new Date().toISOString(),
            kind: m.kind || 'news'
          };
        });

        box.messages = Object.keys(known).map(function (k) { return known[k]; });
        box.fetched = Date.now();
        saveInbox();
        return inboxState();
      })
      .catch(function () { return inboxState(); });
  }

  /* ── FEEDBACK ────────────────────────────────────────────────────── */

  /* The context block. This is the part that turns an unusable report into
     a fixable one, and it is assembled here rather than asked for, because
     nobody knows their CEP version and nobody should have to. */
  function context(extra) {
    var store = LGStore.describe();
    var lib = LGLibrary.data();

    var meta = {
      panel: PANEL_VERSION,
      host: (window.__lgHost && window.__lgHost.version) ? ('After Effects ' + window.__lgHost.version) : 'unknown',
      hostBuild: (window.__lgHost && window.__lgHost.build) || '',
      hostLanguage: (window.__lgHost && window.__lgHost.language) || '',
      hostCanWriteFiles: !!(window.__lgHost && window.__lgHost.canWrite),
      os: navigator.platform || '',
      userAgent: navigator.userAgent || '',
      cep: (window.__adobe_cep__ && typeof window.__adobe_cep__.getCurrentApiVersion === 'function')
        ? window.__adobe_cep__.getCurrentApiVersion() : '',
      storeBackend: store.backend,
      storeWritable: store.writable,
      presetCount: lib ? Object.keys(lib.presets).length : 0,
      collectionCount: lib ? lib.collections.length : 0,
      lastError: window.__lgLastError || null
    };

    if (extra) for (var k in extra) if (extra.hasOwnProperty(k)) meta[k] = extra[k];
    return meta;
  }

  function sendFeedback(payload) {
    if (!payload || !payload.message || !payload.message.trim()) {
      return Promise.resolve({ ok: false, error: 'Write a message first.' });
    }

    var body = {
      kind: payload.kind || 'general',
      message: payload.message.trim(),
      email: (payload.email || '').trim(),
      subject: (payload.subject || '').trim(),
      meta: payload.includeContext === false ? { panel: PANEL_VERSION } : context()
    };

    return request(API + '/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function () { return { ok: true }; })
      .catch(function (err) {
        /* A failed send should not lose what somebody just wrote. Park it on
           disk; the next successful send flushes the queue. */
        queueFeedback(body);
        return {
          ok: false,
          queued: true,
          error: 'Could not reach the server. Your message is saved and will be sent next time.'
        };
      });
  }

  function queueFeedback(body) {
    if (!LGStore.available()) return;
    var path = LGStore.join(LGStore.paths.root, 'outbox.json');
    var queue = LGStore.readJson(path, []);
    queue.push({ body: body, queued: new Date().toISOString() });
    while (queue.length > 20) queue.shift();
    LGStore.writeJson(path, queue);
  }

  function flushQueue() {
    if (!LGStore.available()) return Promise.resolve(0);
    var path = LGStore.join(LGStore.paths.root, 'outbox.json');
    var queue = LGStore.readJson(path, []);
    if (!queue.length) return Promise.resolve(0);

    var sent = 0;
    var chain = Promise.resolve();
    queue.forEach(function (entry) {
      chain = chain.then(function () {
        return request(API + '/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry.body)
        }).then(function () { sent++; });
      }).catch(function () { });
    });

    return chain.then(function () {
      if (sent >= queue.length) LGStore.writeJson(path, []);
      else LGStore.writeJson(path, queue.slice(sent));
      return sent;
    });
  }

  /* ── STARTUP ─────────────────────────────────────────────────────── */

  /* Deliberately late and deliberately quiet. The panel is fully usable
     before any of this runs, and if all of it fails nothing changes. */
  function start() {
    loadInbox();
    setTimeout(function () {
      checkForUpdate(false);
      fetchMessages(false);
      flushQueue();
    }, 4000);
  }

  return {
    version: PANEL_VERSION,
    productUrl: PRODUCT_URL,
    api: API,

    start: start,
    onChange: onChange,

    state: inboxState,
    markRead: markRead,
    markAllRead: markAllRead,

    checkForUpdate: checkForUpdate,
    fetchMessages: fetchMessages,
    sendFeedback: sendFeedback,
    context: context,
    isNewer: isNewer
  };
})();

if (typeof window !== 'undefined') {
  window.LGService = LGService;
  window.LG_PANEL_VERSION = LGService.version;
}
