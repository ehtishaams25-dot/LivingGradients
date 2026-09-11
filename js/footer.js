/* ============================================
   FOOTER.JS - local product actions
   ============================================

   The commercial panel is deliberately self-contained: presets, backups,
   settings and help work without a service endpoint. */

var LGFooter = (function () {
  'use strict';

  function cs() { return lgHostReady() ? new CSInterface() : null; }
  function panelVersion() { return lgPanelVersion(); }
  function openExternal(url) {
    var bridge = cs();
    if (bridge) bridge.openURLInDefaultBrowser(url);
    else window.open(url, '_blank');
  }

  function mount(container) {
    var bar = LGUI.el('footer', 'lg-footer');
    var left = LGUI.el('div', 'lg-footer-left');
    left.id = 'lg-footer-status';
    bar.appendChild(left);

    var right = LGUI.el('div', 'lg-footer-right');
    var menuBtn = LGUI.el('button', 'lg-icon-btn', LGUI.icon('menu', 15));
    menuBtn.type = 'button';
    menuBtn.title = 'Menu';
    menuBtn.addEventListener('click', function () { openMenu(menuBtn); });
    right.appendChild(menuBtn);
    bar.appendChild(right);
    container.appendChild(bar);

    LGLibrary.onChange(refresh);
    refresh();
  }

  function refresh() {
    var status = document.getElementById('lg-footer-status');
    if (!status) return;
    var lib = LGLibrary.data();
    var count = lib ? Object.keys(lib.presets).length : 0;
    var store = LGStore.describe();
    status.innerHTML =
      '<span class="lg-footer-count">' + count + ' preset' + (count === 1 ? '' : 's') + '</span>' +
      (store.writable ? '' : '<span class="lg-footer-warn">' + LGUI.icon('alert', 12) + ' not saving</span>');
  }

  /* WHY THIS OPENS A PAGE INSTEAD OF ASKING A SERVER.

     The panel used to have a bell driven by js/service.js, which called a
     Cloudflare Worker for /version, /messages and /feedback. The Worker is
     written and tested but has never been deployed, so every one of those calls
     went to a placeholder host - a bell that could never ring and a feedback
     button that could never send. Shipping that is worse than not having it.

     The product page is a real destination that already carries the current
     version and the changelog, so this is the honest version of the same
     affordance. server/worker.js stays in the repo; re-wiring it is a V2.3
     item, not a shipping one. */
  var PRODUCT_URL = 'https://ehtishaam.gumroad.com/l/livinggradients';

  function openProductPage() { openExternal(PRODUCT_URL); }

  function openMenu(anchor) {
    var col = LGLibrary.activeCollection();
    LGUI.menu(anchor, [
      { label: 'Import presets...', icon: 'upload', onClick: LGShelf.importFromDialog },
      { label: 'Export "' + col.name + '"...', icon: 'download', onClick: function () { LGShelf.exportBundle(LGLibrary.exportCollection(col.id), col.name); } },
      '-',
      { label: 'Back up everything...', icon: 'box', onClick: backupEverything },
      { label: 'Restore from backup...', icon: 'refresh', onClick: openRestore },
      { label: 'Reveal data folder', icon: 'external', onClick: revealFolder },
      '-',
      { label: 'Settings...', icon: 'settings', onClick: openSettings },
      { label: 'Help', icon: 'help', onClick: openHelp },
      { label: 'Check for updates', icon: 'refresh', onClick: openProductPage },
      { label: 'About Living Gradients', icon: 'droplet', onClick: openAbout }
    ], { alignRight: true });
  }

  function backupEverything() {
    var bundle = LGLibrary.backupEverything();
    var stamp = new Date().toISOString().slice(0, 10);
    LGShelf.exportBundle(bundle, 'Living Gradients backup ' + stamp, '.lgcollection');
  }

  function openRestore() {
    var backups = LGStore.listBackups();
    var body = LGUI.el('div');
    body.appendChild(LGUI.el('p', 'lg-modal-text',
      'Living Gradients keeps a copy of your library whenever it changes. Restore one, or open an exported backup.'));
    if (backups.length) {
      var list = LGUI.el('div', 'lg-picker-list');
      backups.forEach(function (backup) {
        var row = LGUI.el('button', 'lg-picker-row');
        row.type = 'button';
        row.innerHTML = '<span class="lg-picker-glyph">' + LGUI.icon('refresh', 13) + '</span>' +
          '<span class="lg-picker-name">' + LGUI.esc(backup.when) + '</span>';
        row.addEventListener('click', function () {
          LGUI.confirm('Restore the library from ' + backup.when + '?', {
            title: 'Restore library', detail: 'Your current library is backed up first.', confirmLabel: 'Restore'
          }).then(function (yes) {
            if (!yes) return;
            if (LGStore.restoreBackup(backup.file)) {
              LGLibrary.init(); LGShelf.render(); LGUI.toast('Library restored', 'success');
            } else LGUI.toast('That backup could not be read.', 'error');
          });
        });
        list.appendChild(row);
      });
      body.appendChild(list);
    } else {
      body.appendChild(LGUI.el('p', 'lg-modal-detail', 'No automatic backups yet. They begin after your first saved preset.'));
    }
    LGUI.modal({ title: 'Restore', body: body, actions: [
      { label: 'Open a backup file...', onClick: function (handle) { handle.close(); LGShelf.importFromDialog(); return false; } },
      { label: 'Close', primary: true }
    ]});
  }

  function revealFolder() {
    LGStore.ensureTree();
    var bridge = cs();
    if (!bridge) { LGUI.toast(LGStore.paths.root, null, 8000); return; }
    bridge.evalScript('lgRevealFolder("' + LGStore.paths.root.replace(/"/g, '\\"') + '")', function (result) {
      if (result && result.indexOf('ERROR') === 0) LGUI.toast(LGStore.paths.root, null, 8000);
    });
  }

  function openSettings() {
    var settings = LGLibrary.settings();
    var body = LGUI.el('div', 'lg-settings');
    function toggle(key, label, hint) {
      var row = LGUI.el('label', 'lg-setting-row');
      var input = LGUI.el('input');
      input.type = 'checkbox'; input.checked = !!settings[key];
      input.addEventListener('change', function () { LGLibrary.setSetting(key, this.checked); LGShelf.render(); });
      row.appendChild(LGUI.el('span', 'lg-setting-text', '<strong>' + LGUI.esc(label) + '</strong>' +
        (hint ? '<em>' + LGUI.esc(hint) + '</em>' : '')));
      row.appendChild(input);
      return row;
    }
    body.appendChild(LGUI.el('h4', 'lg-settings-head', 'Library'));
    body.appendChild(toggle('showFolders', 'Show folders', 'Off flattens saved presets into one grid.'));
    body.appendChild(toggle('showLabels', 'Show names under cards'));
    body.appendChild(toggle('confirmDelete', 'Ask before deleting a preset'));
    body.appendChild(LGUI.el('h4', 'lg-settings-head', 'Capture'));
    body.appendChild(toggle('captureThumbFromComp', 'Render thumbnails from the comp', 'Off uses the panel preview instead.'));

    var d = LGStore.describe();
    var where = LGUI.el('div', 'lg-settings-where');
    where.innerHTML = '<h4 class="lg-settings-head">Where your presets are kept</h4><code>' + LGUI.esc(d.root) +
      '</code><p class="lg-setting-hint">Outside the extension, so updates never cost you a preset. ' +
      (d.writable ? 'Writable.' : 'NOT writable - presets are not being saved.') + '</p>';
    var reveal = LGUI.el('button', 'lg-btn is-small', LGUI.icon('external', 13) + '<span>Open folder</span>');
    reveal.type = 'button'; reveal.addEventListener('click', revealFolder);
    where.appendChild(reveal); body.appendChild(where);
    LGUI.modal({ title: 'Settings', body: body, actions: [{ label: 'Done', primary: true }] });
  }

  function openHelp() {
    var d = LGStore.describe();
    var canWrite = !!(window.__lgHost && window.__lgHost.canWrite);
    var body = LGUI.el('div', 'lg-help');
    body.innerHTML =
      '<section><h4>The panel opened blank</h4><p>Close and reopen it from <em>Window &gt; Extensions</em>. Your presets are stored separately and untouched.</p></section>' +
      '<section><h4>Thumbnails are not appearing</h4><p>Enable <em>Preferences &gt; Scripting &amp; Expressions &gt; Allow Scripts to Write Files and Access Network</em>, then restart After Effects.</p><p class="lg-setting-hint">Right now: ' + (canWrite ? 'After Effects can write files.' : 'After Effects cannot write files.') + '</p></section>' +
      '<section><h4>Capture says there is nothing to capture</h4><p>Capture reads the recipe stored on gradients made by Living Gradients. It cannot reconstruct an arbitrary hand-built effect stack.</p></section>' +
      '<section><h4>Where are my presets?</h4><p><code>' + LGUI.esc(d.root) + '</code></p><p>Copy this folder to move your library, or use <em>Back up everything</em> for one portable file.</p></section>';
    LGUI.modal({ title: 'Help', body: body, wide: true, actions: [{ label: 'Close', primary: true }] });
  }

  function openAbout() {
    var d = LGStore.describe();
    var body = LGUI.el('div', 'lg-about');
    body.innerHTML = '<div class="lg-about-mark"><span class="logo-orb"></span></div><h3>Living Gradients</h3>' +
      '<p class="lg-about-version">Version ' + LGUI.esc(panelVersion()) + '</p><dl>' +
      '<dt>Gradients</dt><dd>' + (typeof GRADIENT_LIBRARY !== 'undefined' ? GRADIENT_LIBRARY.length : '-') + '</dd>' +
      '<dt>Your presets</dt><dd>' + Object.keys(LGLibrary.data().presets).length + '</dd>' +
      '<dt>Host</dt><dd>' + LGUI.esc((window.__lgHost && window.__lgHost.version) ? 'After Effects ' + window.__lgHost.version : 'unknown') + '</dd>' +
      '<dt>Storage</dt><dd>' + LGUI.esc(d.backend) + '</dd></dl>';
    LGUI.modal({ title: 'About', body: body, actions: [
      { label: 'Product page', onClick: function () { openProductPage(); return false; } },
      { label: 'Close', primary: true }
    ]});
  }

  return { mount: mount, refresh: refresh, openHelp: openHelp, openSettings: openSettings,
    openAbout: openAbout, openRestore: openRestore, backupEverything: backupEverything,
    openProductPage: openProductPage,
    /* Exported for the 2.3.0 folder-move banner in boot.js, which wants to
       show the user where their presets went. Same function the footer menu's
       "Reveal data folder" runs. */
    revealDataFolder: revealFolder };
}());
