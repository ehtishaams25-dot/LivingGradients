/* ============================================
   UI.JS — the panel's chrome
   ============================================

   Toasts, modals, confirmations, context menus, the footer, the notification
   bell, the settings sheet and the feedback dialog.

   WHY THIS FILE EXISTS AT ALL

   The panel currently reaches for `alert()` and `confirm()` in six places.
   Inside a CEP panel those are Chromium's own dialogs: they are centred on the
   whole screen rather than the panel, they are styled like a web page from
   2009, and they block the CEF thread — which in a docked panel reads as After
   Effects hanging. One `alert('Enter a preset name first.')` undoes an
   otherwise carefully built interface, and Code Runner has none of them.

   Everything here is built from the same tokens as the rest of the panel, is
   dismissible with Escape, traps focus while open, and returns a Promise so
   the calling code reads the way `confirm()` did.

   NO DEPENDENCIES. Deliberately: this panel has no build step, and adding one
   to get a dialog library would be a poor trade. */

/* ── IS THERE ACTUALLY A HOST? ───────────────────────────────────────

   `typeof CSInterface !== 'undefined'` is the guard this panel used everywhere,
   and it is wrong. CSInterface.js defines the class in any browser; what it
   cannot conjure is `window.__adobe_cep__`, the object every one of its methods
   delegates to. So outside After Effects the guard passes, the call is made,
   and it throws on the first property read — which is exactly what a plain
   browser load of this panel does today, six times before it finishes loading.

   Testing for the bridge itself is the honest check, and it makes opening
   index.html in a browser a usable way to work on the interface. */
function lgHostReady() {
  return typeof CSInterface !== 'undefined' &&
    typeof window !== 'undefined' && !!window.__adobe_cep__;
}
if (typeof window !== 'undefined') window.lgHostReady = lgHostReady;

var LGUI = (function () {
  'use strict';

  /* ── ICONS ───────────────────────────────────────────────────────────

     Code Runner ships a 2.3 MB searchable library of five thousand icons
     because its users draw from it — every button they make needs one. Ours
     does not: the icons are the panel's own furniture and there are about
     thirty. So they are inline strings rather than a library, and the panel
     stays a few hundred kilobytes rather than a few megabytes.

     All 24×24, all stroked, all inheriting currentColor, so one CSS rule
     colours every one of them. */

  var ICONS = {
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    menu: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    chevronRight: '<polyline points="9 18 15 12 9 6"/>',
    chevronDown: '<polyline points="6 9 12 15 18 9"/>',
    chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
    capture: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    play: '<polygon points="6 3 20 12 6 21"/>',
    replace: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    message: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/>',
    alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
    folderOpen: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H3z"/><path d="M3 10h18l-2 8a2 2 0 0 1-2 1.6H5A2 2 0 0 1 3 18z"/>',
    droplet: '<path d="M12 2.7l5.3 5.3a7.5 7.5 0 1 1-10.6 0z"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
    box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/>'
  };

  function icon(name, size) {
    var d = ICONS[name] || '';
    var s = size || 14;
    return '<svg class="lg-icon" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" ' +
      'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }

  function el(tag, className, html) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ── TOASTS ──────────────────────────────────────────────────────────

     Status that does not need acknowledging. Stacked bottom-right, above the
     footer, and they never take focus — a toast that steals focus mid-drag is
     worse than no toast. */

  var toastHost = null;

  function toast(message, kind, ms) {
    if (!toastHost) {
      toastHost = el('div', 'lg-toasts');
      document.body.appendChild(toastHost);
    }
    var t = el('div', 'lg-toast' + (kind ? ' is-' + kind : ''));
    var glyph = kind === 'error' ? 'alert' : (kind === 'success' ? 'check' : 'droplet');
    t.innerHTML = icon(glyph, 13) + '<span>' + esc(message) + '</span>';
    toastHost.appendChild(t);

    /* Force a reflow so the entry transition actually plays; adding the class
       in the same frame as the element is a no-op. */
    void t.offsetWidth;
    t.classList.add('is-in');

    var life = ms || (kind === 'error' ? 6000 : 3200);
    setTimeout(function () {
      t.classList.remove('is-in');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 260);
    }, life);

    return t;
  }

  /* ── MODALS ──────────────────────────────────────────────────────────

     One implementation. Escape closes, the backdrop closes, focus moves in on
     open and back to whatever had it on close, and Tab is trapped inside —
     which matters more here than on the web, because a panel that lets focus
     escape into After Effects behind it starts eating keystrokes as tool
     shortcuts. */

  var openModals = [];

  function modal(opts) {
    opts = opts || {};

    var previousFocus = document.activeElement;

    var backdrop = el('div', 'lg-modal-backdrop');
    var sheet = el('div', 'lg-modal' + (opts.wide ? ' is-wide' : ''));
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');

    var head = el('header', 'lg-modal-head');
    head.innerHTML = '<h3>' + esc(opts.title || '') + '</h3>';
    var closeBtn = el('button', 'lg-icon-btn', icon('close', 15));
    closeBtn.type = 'button';
    closeBtn.title = 'Close';
    head.appendChild(closeBtn);

    var bodyWrap = el('div', 'lg-modal-body');
    if (typeof opts.body === 'string') bodyWrap.innerHTML = opts.body;
    else if (opts.body) bodyWrap.appendChild(opts.body);

    sheet.appendChild(head);
    sheet.appendChild(bodyWrap);

    var footer = null;
    if (opts.actions && opts.actions.length) {
      footer = el('footer', 'lg-modal-foot');
      opts.actions.forEach(function (action) {
        var b = el('button', 'lg-btn' + (action.primary ? ' is-primary' : '') + (action.danger ? ' is-danger' : ''));
        b.type = 'button';
        b.textContent = action.label;
        b.addEventListener('click', function () {
          if (action.onClick) {
            var keep = action.onClick(handle);
            if (keep === false) return;
          }
          handle.close(action.value);
        });
        footer.appendChild(b);
      });
      sheet.appendChild(footer);
    }

    backdrop.appendChild(sheet);
    document.body.appendChild(backdrop);

    var resolveFn = null;
    var promise = new Promise(function (res) { resolveFn = res; });

    var handle = {
      root: sheet,
      body: bodyWrap,
      footer: footer,
      promise: promise,
      close: function (value) {
        if (!backdrop.parentNode) return;
        backdrop.classList.remove('is-in');
        document.removeEventListener('keydown', onKey, true);
        openModals = openModals.filter(function (m) { return m !== handle; });
        setTimeout(function () {
          if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        }, 200);
        try { if (previousFocus && previousFocus.focus) previousFocus.focus(); } catch (e) { }
        resolveFn(value);
      }
    };

    function focusables() {
      return Array.prototype.slice.call(sheet.querySelectorAll(
        'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
      )).filter(function (n) { return !n.disabled && n.offsetParent !== null; });
    }

    function onKey(e) {
      if (openModals[openModals.length - 1] !== handle) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handle.close(undefined);
        return;
      }

      /* Enter submits, but not from a textarea — where Enter is a newline and
         hijacking it loses the paragraph somebody was writing. */
      if (e.key === 'Enter' && !e.shiftKey && opts.actions) {
        var tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'textarea' || tag === 'button') return;
        var primary = opts.actions.filter(function (a) { return a.primary; })[0];
        if (primary) {
          e.preventDefault();
          if (primary.onClick && primary.onClick(handle) === false) return;
          handle.close(primary.value);
        }
        return;
      }

      if (e.key === 'Tab') {
        var nodes = focusables();
        if (!nodes.length) return;
        var first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    }

    closeBtn.addEventListener('click', function () { handle.close(undefined); });
    backdrop.addEventListener('mousedown', function (e) {
      if (e.target === backdrop && opts.dismissable !== false) handle.close(undefined);
    });
    document.addEventListener('keydown', onKey, true);

    openModals.push(handle);
    void backdrop.offsetWidth;
    backdrop.classList.add('is-in');

    setTimeout(function () {
      var target = sheet.querySelector('[data-autofocus]') || focusables()[0];
      if (target) { try { target.focus(); if (target.select) target.select(); } catch (e) { } }
    }, 60);

    return handle;
  }

  /* Replaces window.confirm. Returns a Promise<boolean>, so calling code that
     used to read `if (!confirm(...)) return;` becomes one `await`. */
  function confirmDialog(message, opts) {
    opts = opts || {};
    var h = modal({
      title: opts.title || 'Are you sure?',
      body: '<p class="lg-modal-text">' + esc(message) + '</p>' +
        (opts.detail ? '<p class="lg-modal-detail">' + esc(opts.detail) + '</p>' : ''),
      actions: [
        { label: opts.cancelLabel || 'Cancel', value: false },
        { label: opts.confirmLabel || 'Delete', value: true, primary: true, danger: opts.danger !== false }
      ]
    });
    return h.promise.then(function (v) { return v === true; });
  }

  /* Replaces window.prompt. */
  function promptDialog(opts) {
    opts = opts || {};
    var field = el('input', 'lg-input');
    field.type = 'text';
    field.value = opts.value || '';
    field.placeholder = opts.placeholder || '';
    field.setAttribute('data-autofocus', '');
    field.spellcheck = false;

    var wrap = el('div');
    if (opts.label) wrap.appendChild(el('label', 'lg-field-label', esc(opts.label)));
    wrap.appendChild(field);
    if (opts.hint) wrap.appendChild(el('p', 'lg-modal-detail', esc(opts.hint)));

    var h = modal({
      title: opts.title || 'Name',
      body: wrap,
      actions: [
        { label: 'Cancel', value: null },
        {
          label: opts.confirmLabel || 'Save', primary: true,
          onClick: function (handle) {
            var v = field.value.trim();
            if (!v) { field.classList.add('is-invalid'); field.focus(); return false; }
            handle.close(v);
            return false;
          }
        }
      ]
    });
    return h.promise.then(function (v) { return v || null; });
  }

  /* ── CONTEXT MENUS ───────────────────────────────────────────────────

     Right-click on a card, and the ⋮ button. Positioned against the viewport
     so a menu opened near the bottom of a short docked panel opens upward
     instead of off the edge — which is the single most common way a menu in a
     dockable panel goes wrong. */

  var activeMenu = null;

  function closeMenu() {
    if (activeMenu && activeMenu.parentNode) activeMenu.parentNode.removeChild(activeMenu);
    activeMenu = null;
    document.removeEventListener('mousedown', onDocDown, true);
    document.removeEventListener('keydown', onMenuKey, true);
  }

  function onDocDown(e) {
    if (activeMenu && !activeMenu.contains(e.target)) closeMenu();
  }

  function onMenuKey(e) {
    if (!activeMenu) return;
    var items = Array.prototype.slice.call(activeMenu.querySelectorAll('.lg-menu-item:not(.is-disabled)'));
    var idx = items.indexOf(document.activeElement);

    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); (items[idx + 1] || items[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (items[idx - 1] || items[items.length - 1]).focus(); }
  }

  function menu(anchor, items, options) {
    closeMenu();
    options = options || {};

    var m = el('div', 'lg-menu');

    items.forEach(function (item) {
      if (item === '-' || item.separator) {
        m.appendChild(el('div', 'lg-menu-sep'));
        return;
      }
      var b = el('button', 'lg-menu-item' + (item.danger ? ' is-danger' : '') + (item.disabled ? ' is-disabled' : ''));
      b.type = 'button';
      b.disabled = !!item.disabled;
      b.innerHTML =
        '<span class="lg-menu-glyph">' + (item.icon ? icon(item.icon, 14) : '') + '</span>' +
        '<span class="lg-menu-label">' + esc(item.label) + '</span>' +
        (item.hint ? '<span class="lg-menu-hint">' + esc(item.hint) + '</span>' : '');
      b.addEventListener('click', function () {
        closeMenu();
        if (item.onClick) item.onClick();
      });
      m.appendChild(b);
    });

    document.body.appendChild(m);

    var rect = options.at
      ? { left: options.at.x, top: options.at.y, right: options.at.x, bottom: options.at.y, width: 0, height: 0 }
      : anchor.getBoundingClientRect();

    var mw = m.offsetWidth, mh = m.offsetHeight;
    var vw = window.innerWidth, vh = window.innerHeight;

    var left = options.alignRight ? (rect.right - mw) : rect.left;
    if (left + mw > vw - 8) left = vw - mw - 8;
    if (left < 8) left = 8;

    var top = rect.bottom + 4;
    if (top + mh > vh - 8) {
      top = rect.top - mh - 4;             /* flip above */
      if (top < 8) top = Math.max(8, vh - mh - 8);
    }

    m.style.left = Math.round(left) + 'px';
    m.style.top = Math.round(top) + 'px';

    activeMenu = m;
    document.addEventListener('mousedown', onDocDown, true);
    document.addEventListener('keydown', onMenuKey, true);

    void m.offsetWidth;
    m.classList.add('is-in');

    var first = m.querySelector('.lg-menu-item:not(.is-disabled)');
    if (first) setTimeout(function () { try { first.focus(); } catch (e) { } }, 30);

    return m;
  }

  /* ── THE DIAGNOSTICS CARD ────────────────────────────────────────────

     Code Runner's best small idea. If After Effects cannot write files, every
     script button fails — so rather than letting each one fail with its own
     confusing error, it says so once, at the top, with the fix.

     Ours has two of these conditions: After Effects cannot write files (no
     thumbnails), and the panel cannot write to its own data folder (no
     presets at all). Both are silent otherwise, and both have a specific fix
     that the user can carry out. Saying nothing and letting the feature
     quietly not work is the thing to avoid. */

  function showBanner(id, opts) {
    var host = document.getElementById('lg-banners');
    if (!host) return;

    var existing = document.getElementById(id);
    if (existing) existing.parentNode.removeChild(existing);

    var card = el('div', 'lg-banner is-' + (opts.kind || 'warn'));
    card.id = id;
    card.innerHTML =
      '<div class="lg-banner-glyph">' + icon(opts.kind === 'error' ? 'alert' : 'alert', 16) + '</div>' +
      '<div class="lg-banner-text">' +
      '<strong>' + esc(opts.title) + '</strong>' +
      '<p>' + esc(opts.body) + '</p>' +
      '</div>';

    var tools = el('div', 'lg-banner-tools');
    if (opts.action) {
      var b = el('button', 'lg-btn is-small');
      b.type = 'button';
      b.textContent = opts.action.label;
      b.addEventListener('click', opts.action.onClick);
      tools.appendChild(b);
    }
    if (opts.dismissable !== false) {
      var x = el('button', 'lg-icon-btn', icon('close', 13));
      x.type = 'button';
      x.title = 'Dismiss';
      x.addEventListener('click', function () { card.parentNode.removeChild(card); });
      tools.appendChild(x);
    }
    card.appendChild(tools);

    host.appendChild(card);
    return card;
  }

  function clearBanner(id) {
    var n = document.getElementById(id);
    if (n && n.parentNode) n.parentNode.removeChild(n);
  }

  /* ── PUBLIC ──────────────────────────────────────────────────────── */

  return {
    icon: icon,
    el: el,
    esc: esc,
    toast: toast,
    modal: modal,
    confirm: confirmDialog,
    prompt: promptDialog,
    menu: menu,
    closeMenu: closeMenu,
    banner: showBanner,
    clearBanner: clearBanner
  };
})();

if (typeof window !== 'undefined') window.LGUI = LGUI;
