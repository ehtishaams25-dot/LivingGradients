/* ============================================
   FOOTER.JS — the bell, the menu, and everything behind them
   ============================================

   Code Runner's footer is a thin strip carrying a notification bell and a
   menu, and between them they hold the entire support surface of the product:
   updates, announcements, feedback, import, export, backup, restore, settings
   and help. None of it is in the way, all of it is one click deep.

   That arrangement is worth copying wholesale, and not because it is pretty.
   A panel that ships to strangers needs somewhere to put the things that are
   not the main task, and the alternatives are worse — a settings tab that eats
   a third of a narrow panel's tab bar, or no home at all, which is how
   products end up with no feedback channel and no way to tell anyone about an
   update.

   DEPENDS ON: store.js, library.js, ui.js, service.js, shelf.js */

var LGFooter = (function () {
  'use strict';

  var bar = null;

  function cs() { return (lgHostReady()) ? new CSInterface() : null; }

  function openExternal(url) {
    var bridge = cs();
    if (bridge) bridge.openURLInDefaultBrowser(url);
    else window.open(url, '_blank');
  }

  /* ── THE BAR ─────────────────────────────────────────────────────── */

  function mount(container) {
    bar = LGUI.el('footer', 'lg-footer');

    var left = LGUI.el('div', 'lg-footer-left');
    left.id = 'lg-footer-status';
    bar.appendChild(left);

    var right = LGUI.el('div', 'lg-footer-right');

    var bell = LGUI.el('button', 'lg-icon-btn lg-bell');
    bell.type = 'button';
    bell.id = 'lg-bell';
    bell.title = 'Messages';
    bell.innerHTML = LGUI.icon('bell', 15) + '<span class="lg-bell-dot" hidden></span>';
    bell.addEventListener('click', openMessages);
    right.appendChild(bell);

    var menuBtn = LGUI.el('button', 'lg-icon-btn', LGUI.icon('menu', 15));
    menuBtn.type = 'button';
    menuBtn.title = 'Menu';
    menuBtn.addEventListener('click', function () { openMenu(menuBtn); });
    right.appendChild(menuBtn);

    bar.appendChild(right);
    container.appendChild(bar);

    LGService.onChange(refresh);
    LGLibrary.onChange(refresh);
    refresh();
  }

  function refresh() {
    var status = document.getElementById('lg-footer-status');
    if (status) {
      var lib = LGLibrary.data();
      var count = lib ? Object.keys(lib.presets).length : 0;
      var store = LGStore.describe();

      status.innerHTML =
        '<span class="lg-footer-count">' + count + ' preset' + (count === 1 ? '' : 's') + '</span>' +
        (store.writable ? '' : '<span class="lg-footer-warn">' + LGUI.icon('alert', 12) + ' not saving</span>');
    }

    var bell = document.getElementById('lg-bell');
    if (bell) {
      var state = LGService.state();
      var dot = bell.querySelector('.lg-bell-dot');
      var pending = state.unread + (state.update ? 1 : 0);
      if (dot) {
        dot.hidden = pending === 0;
        /* Cleared rather than left at "0" behind the hidden attribute — a
           screen reader reads the text, not the attribute's intent. */
        dot.textContent = pending === 0 ? '' : (pending > 9 ? '9+' : String(pending));
      }
      bell.classList.toggle('has-news', pending > 0);
    }
  }

  /* ── MENU ────────────────────────────────────────────────────────── */

  function openMenu(anchor) {
    var col = LGLibrary.activeCollection();

    LGUI.menu(anchor, [
      { label: 'Import presets…', icon: 'upload', onClick: LGShelf.importFromDialog },
      {
        label: 'Export “' + col.name + '”…', icon: 'download',
        onClick: function () { LGShelf.exportBundle(LGLibrary.exportCollection(col.id), col.name); }
      },
      '-',
      { label: 'Back up everything…', icon: 'box', onClick: backupEverything },
      { label: 'Restore from backup…', icon: 'refresh', onClick: openRestore },
      { label: 'Reveal data folder', icon: 'external', onClick: revealFolder },
      '-',
      { label: 'Settings…', icon: 'settings', onClick: openSettings },
      { label: 'Help', icon: 'help', onClick: openHelp },
      { label: 'Send feedback…', icon: 'message', onClick: openFeedback },
      '-',
      { label: 'Check for updates', icon: 'refresh', onClick: manualUpdateCheck },
      { label: 'About Living Gradients', icon: 'droplet', onClick: openAbout }
    ], { alignRight: true });
  }

  /* ── BACKUP AND RESTORE ──────────────────────────────────────────── */

  function backupEverything() {
    var bundle = LGLibrary.backupEverything();
    var stamp = new Date().toISOString().slice(0, 10);
    LGShelf.exportBundle(bundle, 'Living Gradients backup ' + stamp, '.lgcollection');
  }

  /* The rolling backups store.js keeps of the index itself. Separate from a
     user-made backup file, and the thing that saves somebody who deleted a
     collection an hour ago and only just noticed. */
  function openRestore() {
    var backups = LGStore.listBackups();

    var body = LGUI.el('div');
    body.appendChild(LGUI.el('p', 'lg-modal-text',
      'Living Gradients keeps a copy of your library every time it changes. Restore one, or open a backup file you exported yourself.'));

    if (backups.length) {
      var list = LGUI.el('div', 'lg-picker-list');
      backups.forEach(function (b) {
        var row = LGUI.el('button', 'lg-picker-row');
        row.type = 'button';
        row.innerHTML =
          '<span class="lg-picker-glyph">' + LGUI.icon('refresh', 13) + '</span>' +
          '<span class="lg-picker-name">' + LGUI.esc(b.when) + '</span>';
        row.addEventListener('click', function () {
          LGUI.confirm('Restore the library from ' + b.when + '?', {
            title: 'Restore library',
            detail: 'Your current library is backed up first, so this is reversible.',
            confirmLabel: 'Restore'
          }).then(function (yes) {
            if (!yes) return;
            if (LGStore.restoreBackup(b.file)) {
              LGLibrary.init();
              LGShelf.render();
              LGUI.toast('Library restored', 'success');
            } else {
              LGUI.toast('That backup could not be read.', 'error');
            }
          });
        });
        list.appendChild(row);
      });
      body.appendChild(list);
    } else {
      body.appendChild(LGUI.el('p', 'lg-modal-detail', 'No automatic backups yet — they start once you save your first preset.'));
    }

    LGUI.modal({
      title: 'Restore',
      body: body,
      actions: [
        { label: 'Open a backup file…', onClick: function (h) { h.close(); LGShelf.importFromDialog(); return false; } },
        { label: 'Close', primary: true }
      ]
    });
  }

  function revealFolder() {
    LGStore.ensureTree();
    var bridge = cs();
    if (!bridge) { LGUI.toast(LGStore.paths.root, null, 8000); return; }
    bridge.evalScript('lgRevealFolder("' + LGStore.paths.root.replace(/"/g, '\\"') + '")', function (res) {
      if (res && res.indexOf('ERROR') === 0) LGUI.toast(LGStore.paths.root, null, 8000);
    });
  }

  /* ── SETTINGS ────────────────────────────────────────────────────── */

  function openSettings() {
    var s = LGLibrary.settings();
    var body = LGUI.el('div', 'lg-settings');

    function toggle(key, label, hint) {
      var row = LGUI.el('label', 'lg-setting-row');
      var input = LGUI.el('input');
      input.type = 'checkbox';
      input.checked = !!s[key];
      input.addEventListener('change', function () {
        LGLibrary.setSetting(key, this.checked);
        LGShelf.render();
      });
      var text = LGUI.el('span', 'lg-setting-text',
        '<strong>' + LGUI.esc(label) + '</strong>' +
        (hint ? '<em>' + LGUI.esc(hint) + '</em>' : ''));
      row.appendChild(text);
      row.appendChild(input);
      return row;
    }

    function slider(key, label, min, max, step, hint) {
      var row = LGUI.el('div', 'lg-setting-row is-column');
      var head = LGUI.el('div', 'lg-setting-head');
      head.innerHTML = '<strong>' + LGUI.esc(label) + '</strong><span class="lg-setting-value">' + s[key] + '</span>';

      var input = LGUI.el('input', 'lg-range');
      input.type = 'range';
      input.min = min; input.max = max; input.step = step;
      input.value = s[key];
      input.addEventListener('input', function () {
        head.querySelector('.lg-setting-value').textContent = this.value;
        LGLibrary.setSetting(key, parseFloat(this.value));
        LGShelf.render();
      });
      /* Double-click resets, exactly as Code Runner's sliders do. Once you
         have moved a slider you cannot remember where it started, and the
         alternative is a Reset button beside every one of them. */
      input.addEventListener('dblclick', function () {
        this.value = 11;
        this.dispatchEvent(new Event('input'));
      });

      row.appendChild(head);
      row.appendChild(input);
      if (hint) row.appendChild(LGUI.el('p', 'lg-setting-hint', LGUI.esc(hint)));
      return row;
    }

    body.appendChild(LGUI.el('h4', 'lg-settings-head', 'Library'));
    body.appendChild(toggle('showFolders', 'Show folders', 'Off flattens every preset into one grid.'));
    body.appendChild(toggle('showLabels', 'Show names under cards'));
    body.appendChild(toggle('confirmDelete', 'Ask before deleting a preset'));
    body.appendChild(slider('radius', 'Corner roundness', 0, 24, 1, 'Double-click the slider to reset it.'));

    body.appendChild(LGUI.el('h4', 'lg-settings-head', 'Capture'));
    body.appendChild(toggle('captureThumbFromComp', 'Render thumbnails from the comp',
      'Off uses the panel’s own preview instead — faster, less accurate.'));

    body.appendChild(LGUI.el('h4', 'lg-settings-head', 'Updates'));
    body.appendChild(toggle('checkForUpdates', 'Check for updates and messages',
      'Sends only the panel version. Nothing else leaves this machine.'));

    var where = LGUI.el('div', 'lg-settings-where');
    var d = LGStore.describe();
    where.innerHTML =
      '<h4 class="lg-settings-head">Where your presets are kept</h4>' +
      '<code>' + LGUI.esc(d.root) + '</code>' +
      '<p class="lg-setting-hint">Outside the extension, so updating or reinstalling never costs you a preset. ' +
      (d.writable ? 'Writable.' : 'NOT writable — presets are not being saved.') + '</p>';
    var reveal = LGUI.el('button', 'lg-btn is-small', LGUI.icon('external', 13) + '<span>Open folder</span>');
    reveal.type = 'button';
    reveal.addEventListener('click', revealFolder);
    where.appendChild(reveal);
    body.appendChild(where);

    LGUI.modal({ title: 'Settings', body: body, actions: [{ label: 'Done', primary: true }] });
  }

  /* ── MESSAGES ────────────────────────────────────────────────────── */

  function openMessages() {
    var state = LGService.state();
    var body = LGUI.el('div', 'lg-messages');

    if (state.update) {
      var card = LGUI.el('div', 'lg-update-card' + (state.update.critical ? ' is-critical' : ''));
      card.innerHTML =
        '<div class="lg-update-head">' + LGUI.icon('download', 15) +
        '<strong>Version ' + LGUI.esc(state.update.version) + ' is out</strong></div>' +
        (state.update.notes ? '<p>' + LGUI.esc(state.update.notes) + '</p>' : '') +
        '<p class="lg-setting-hint">You are on ' + LGUI.esc(LGService.version) +
        '. Installing over the top keeps every preset — they live outside the extension.</p>';

      var get = LGUI.el('button', 'lg-btn is-primary is-small', 'Get the update');
      get.type = 'button';
      get.addEventListener('click', function () { openExternal(state.update.url || LGService.productUrl); });
      card.appendChild(get);
      body.appendChild(card);
    }

    if (!state.messages.length) {
      body.appendChild(LGUI.el('p', 'lg-modal-detail',
        state.update ? 'No other messages.' : 'No messages. New releases and notices show up here.'));
    } else {
      state.messages.forEach(function (m) {
        var item = LGUI.el('article', 'lg-message is-' + m.kind);
        item.innerHTML =
          '<header><strong>' + LGUI.esc(m.title) + '</strong>' +
          '<time>' + LGUI.esc(new Date(m.date).toLocaleDateString()) + '</time></header>' +
          '<p>' + LGUI.esc(m.body) + '</p>';

        if (m.url) {
          var link = LGUI.el('button', 'lg-link', 'Open' + ' ' + LGUI.icon('external', 11));
          link.type = 'button';
          link.addEventListener('click', function () { openExternal(m.url); });
          item.appendChild(link);
        }
        body.appendChild(item);
      });
    }

    LGService.markAllRead();

    LGUI.modal({
      title: 'Messages',
      body: body,
      actions: [
        { label: 'Check now', onClick: function () { manualUpdateCheck(); return false; } },
        { label: 'Close', primary: true }
      ]
    });
  }

  function manualUpdateCheck() {
    LGUI.toast('Checking…');
    Promise.all([
      LGService.checkForUpdate(true),
      LGService.fetchMessages(true)
    ]).then(function (results) {
      var update = results[0];
      refresh();
      if (update) LGUI.toast('Version ' + update.version + ' is available', 'success');
      else LGUI.toast('You are up to date', 'success');
    });
  }

  /* ── FEEDBACK ────────────────────────────────────────────────────────

     The context block is shown, not hidden. A user who can see exactly what is
     attached is a user who will leave it attached — and a report with the
     After Effects version, the language and whether file writing is on is
     worth ten without. */

  function openFeedback() {
    var body = LGUI.el('div', 'lg-feedback');

    var kinds = [
      { id: 'bug', label: 'Something is broken', icon: 'alert' },
      { id: 'feature', label: 'I want a feature', icon: 'plus' },
      { id: 'general', label: 'General feedback', icon: 'message' }
    ];
    var chosen = 'bug';

    var picker = LGUI.el('div', 'lg-kind-picker');
    kinds.forEach(function (k) {
      var b = LGUI.el('button', 'lg-kind' + (k.id === chosen ? ' is-on' : ''),
        LGUI.icon(k.icon, 14) + '<span>' + LGUI.esc(k.label) + '</span>');
      b.type = 'button';
      b.addEventListener('click', function () {
        chosen = k.id;
        picker.querySelectorAll('.lg-kind').forEach(function (n) { n.classList.remove('is-on'); });
        b.classList.add('is-on');
      });
      picker.appendChild(b);
    });
    body.appendChild(picker);

    var subject = LGUI.el('input', 'lg-input');
    subject.type = 'text';
    subject.placeholder = 'One line: what happened, or what you want';
    subject.setAttribute('data-autofocus', '');
    body.appendChild(LGUI.el('label', 'lg-field-label', 'Summary'));
    body.appendChild(subject);

    var message = LGUI.el('textarea', 'lg-input lg-textarea');
    message.rows = 6;
    message.placeholder = 'What were you doing, what did you expect, and what happened instead?';
    body.appendChild(LGUI.el('label', 'lg-field-label', 'Details'));
    body.appendChild(message);

    var email = LGUI.el('input', 'lg-input');
    email.type = 'email';
    email.placeholder = 'you@example.com';
    body.appendChild(LGUI.el('label', 'lg-field-label', 'Your email (optional — so you can be replied to)'));
    body.appendChild(email);

    var ctx = LGService.context();
    var details = LGUI.el('details', 'lg-context');
    details.innerHTML =
      '<summary>' + LGUI.icon('box', 12) + ' What gets attached</summary>' +
      '<dl>' +
      '<dt>Panel</dt><dd>' + LGUI.esc(ctx.panel) + '</dd>' +
      '<dt>After Effects</dt><dd>' + LGUI.esc(ctx.host) + (ctx.hostLanguage ? ' (' + LGUI.esc(ctx.hostLanguage) + ')' : '') + '</dd>' +
      '<dt>System</dt><dd>' + LGUI.esc(ctx.os) + '</dd>' +
      '<dt>Can write files</dt><dd>' + (ctx.hostCanWriteFiles ? 'yes' : 'no') + '</dd>' +
      '<dt>Presets</dt><dd>' + ctx.presetCount + '</dd>' +
      (ctx.lastError ? '<dt>Last error</dt><dd>' + LGUI.esc(String(ctx.lastError).slice(0, 200)) + '</dd>' : '') +
      '</dl>' +
      '<p class="lg-setting-hint">No project files, no layer names, no identifiers.</p>';
    body.appendChild(details);

    LGUI.modal({
      title: 'Send feedback',
      body: body,
      wide: true,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Send', primary: true,
          onClick: function (handle) {
            if (!message.value.trim()) {
              message.classList.add('is-invalid');
              message.focus();
              return false;
            }
            handle.close();
            LGService.sendFeedback({
              kind: chosen,
              subject: subject.value,
              message: message.value,
              email: email.value
            }).then(function (res) {
              if (res.ok) LGUI.toast('Sent — thank you. You will get a reply if you left an email.', 'success', 6000);
              else LGUI.toast(res.error, res.queued ? null : 'error', 7000);
            });
            return false;
          }
        }
      ]
    });
  }

  /* ── HELP ────────────────────────────────────────────────────────────

     The three things that actually go wrong, with the fix for each. Written
     for somebody who is annoyed, so the fix comes first and the explanation
     second. */

  function openHelp() {
    var d = LGStore.describe();
    var canWrite = !!(window.__lgHost && window.__lgHost.canWrite);

    var body = LGUI.el('div', 'lg-help');
    body.innerHTML =
      '<section><h4>The panel opened blank</h4>' +
      '<p>Close it and open it again from <em>Window &gt; Extensions</em>. That is almost always a stale ' +
      'browser cache inside After Effects rather than lost work — your presets are on disk and untouched.</p></section>' +

      '<section><h4>Thumbnails are not appearing</h4>' +
      '<p>Turn on <em>Preferences &gt; Scripting &amp; Expressions &gt; Allow Scripts to Write Files and Access ' +
      'Network</em>, then <strong>restart After Effects</strong> — the setting is not picked up until it restarts. ' +
      'Rendering a thumbnail writes one frame to a temporary file, so it needs that permission.</p>' +
      '<p class="lg-setting-hint">Right now: ' + (canWrite ? 'After Effects can write files.' : 'After Effects cannot write files.') + '</p></section>' +

      '<section><h4>Capture says there is nothing to capture</h4>' +
      '<p>Capture reads settings this panel wrote onto the layer when it built the gradient, so it only works on ' +
      'gradients Living Gradients made. A gradient built by hand has nothing to read. Every gradient this panel ' +
      'generates can be captured, including ones nested inside precomps.</p></section>' +

      '<section><h4>Where are my presets?</h4>' +
      '<p><code>' + LGUI.esc(d.root) + '</code></p>' +
      '<p>Outside the extension on purpose. Installing an update over the top never touches them. Copy that ' +
      'folder to move your library to another machine, or use <em>Back up everything</em> for a single file.</p></section>' +

      '<section><h4>Still stuck</h4>' +
      '<p>Use <em>Send feedback</em> in this menu. It attaches your After Effects and panel versions ' +
      'automatically, which is usually the difference between a fixable report and a guess.</p></section>';

    LGUI.modal({
      title: 'Help',
      body: body,
      wide: true,
      actions: [
        { label: 'Send feedback', onClick: function (h) { h.close(); openFeedback(); return false; } },
        { label: 'Close', primary: true }
      ]
    });
  }

  function openAbout() {
    var d = LGStore.describe();
    var body = LGUI.el('div', 'lg-about');
    body.innerHTML =
      '<div class="lg-about-mark"><span class="logo-orb"></span></div>' +
      '<h3>Living Gradients</h3>' +
      '<p class="lg-about-version">Version ' + LGUI.esc(LGService.version) + '</p>' +
      '<dl>' +
      '<dt>Gradients</dt><dd>' + (typeof GRADIENT_LIBRARY !== 'undefined' ? GRADIENT_LIBRARY.length : '—') + '</dd>' +
      '<dt>Your presets</dt><dd>' + Object.keys(LGLibrary.data().presets).length + '</dd>' +
      '<dt>Host</dt><dd>' + LGUI.esc((window.__lgHost && window.__lgHost.version) ? 'After Effects ' + window.__lgHost.version : 'unknown') + '</dd>' +
      '<dt>Storage</dt><dd>' + LGUI.esc(d.backend) + '</dd>' +
      '</dl>';

    LGUI.modal({
      title: 'About',
      body: body,
      actions: [
        { label: 'Product page', onClick: function () { openExternal(LGService.productUrl); return false; } },
        { label: 'Close', primary: true }
      ]
    });
  }

  return {
    mount: mount,
    refresh: refresh,
    openFeedback: openFeedback,
    openHelp: openHelp,
    openSettings: openSettings,
    openMessages: openMessages,
    openAbout: openAbout,
    openRestore: openRestore,
    backupEverything: backupEverything,
    revealFolder: revealFolder,
    checkForUpdates: manualUpdateCheck
  };
})();

if (typeof window !== 'undefined') window.LGFooter = LGFooter;
