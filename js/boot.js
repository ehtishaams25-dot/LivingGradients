/* ============================================
   BOOT.JS — start-up order
   ============================================

   Wires the new systems into the existing panel and, importantly, does it in
   an order that survives each piece being unavailable.

   START-UP HAS TO DEGRADE, NOT FAIL

   Four things here can independently be missing or broken: the filesystem, the
   host connection, the network, and the data folder's write permission. A
   panel that treats any of them as fatal is a panel that shows a blank
   rectangle to somebody whose antivirus is having an opinion about %APPDATA%.

   So: the gradient half of the panel comes up first and never depends on any
   of this. Then the library. Then the host probe. Then, four seconds later and
   entirely in the background, the network. Anything that fails leaves a banner
   explaining what stopped working and what still does.

   LOAD ORDER (index.html): store → library → ui → service → shelf → footer →
   controls/preview/main → boot. Boot is last because it assumes everything
   else has defined itself. */

(function () {
  'use strict';

  /* Errors from anywhere in the panel, kept for the feedback dialog to
     attach. The single most useful field in a bug report is the one the user
     did not know to include. */
  window.__lgLastError = null;
  window.addEventListener('error', function (e) {
    window.__lgLastError = (e.message || 'error') +
      (e.filename ? ' @ ' + String(e.filename).split('/').pop() + ':' + e.lineno : '');
  });
  window.addEventListener('unhandledrejection', function (e) {
    window.__lgLastError = 'unhandled: ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason));
  });

  function cs() { return (lgHostReady()) ? new CSInterface() : null; }

  /* ── 1. THE HOST SIDE ────────────────────────────────────────────────

     presets.jsx has to be loaded before anything calls into it. main.js
     already evalFiles main.jsx for the same reason — After Effects caches the
     manifest's ScriptPath and will happily keep running yesterday's build
     otherwise. */

  function loadHostScripts() {
    var bridge = cs();
    if (!bridge) return Promise.resolve(null);

    var extPath = bridge.getSystemPath('extension').replace(/\\/g, '/');

    return new Promise(function (resolve) {
      bridge.evalScript('$.evalFile("' + extPath + '/jsx/presets.jsx")', function () {
        bridge.evalScript('lgHostInfo()', function (raw) {
          var info = null;
          try { info = JSON.parse(raw); } catch (e) { }
          window.__lgHost = info;
          resolve(info);
        });
      });
    });
  }

  /* ── 2. THE LIBRARY ──────────────────────────────────────────────── */

  function bootLibrary() {
    var described = LGStore.describe();
    LGLibrary.init();
    return described;
  }

  /* ── 3. THE PRESETS TAB ──────────────────────────────────────────────

     Inserted rather than written into index.html, so that the tab and its view
     arrive together and cannot drift apart. The tab bar in a docked panel is
     narrow, so this sits third — after Browse and Edit, before Fluid — because
     that is the order of how often it is reached for. */

  function installTab() {
    var nav = document.querySelector('.tabs-nav');
    var body = document.querySelector('.app-body');
    if (!nav || !body) return null;

    var tab = document.createElement('button');
    tab.className = 'tab-btn';
    tab.id = 'tab-presets';
    tab.textContent = 'Presets';

    var fluidTab = document.getElementById('tab-fluid');
    if (fluidTab) nav.insertBefore(tab, fluidTab);
    else nav.appendChild(tab);

    var view = document.createElement('main');
    view.className = 'view-panel lg-shelf';
    view.id = 'presets-view';
    body.appendChild(view);

    tab.addEventListener('click', function () {
      if (typeof window.lgSwitchTab === 'function') window.lgSwitchTab(tab, view);
      LGShelf.render();
    });

    LGShelf.mount(view);
    return { tab: tab, view: view };
  }

  /* ── 4. THE BANNER HOST ──────────────────────────────────────────── */

  function installBanners() {
    var body = document.querySelector('.app-body');
    if (!body || document.getElementById('lg-banners')) return;
    var host = document.createElement('div');
    host.id = 'lg-banners';
    host.className = 'lg-banners';
    body.parentNode.insertBefore(host, body);
  }

  function installFooter() {
    var screen = document.getElementById('main-screen');
    if (!screen || document.querySelector('.lg-footer')) return;
    LGFooter.mount(screen);
  }

  /* ── 5. HOOKS THE NEW CODE NEEDS FROM THE OLD ────────────────────────

     shelf.js calls these rather than reaching into main.js's internals, so the
     coupling is one small documented surface instead of a dozen globals. */

  function installHooks() {
    /* Load a preset into the inspector without touching the comp. Goes through
       the card's own click handler rather than reimplementing it — that
       handler already sets the title, the mini preview, the control set and
       the tab, and a second copy of that would drift within a week. */
    window.lgSelectType = function (type, colors, controls) {
      var card = document.querySelector('.gradient-card[data-type="' + type + '"]');
      if (card) card.click();
      else if (typeof selectedType !== 'undefined') selectedType = type;

      if (colors && colors.length && typeof setColors === 'function') {
        setColors(colors, colors.length);
      }
      if (controls && typeof applyPolledControls === 'function') {
        /* After the card click has rebuilt the control set — otherwise the
           values land on controls that are about to be replaced. */
        setTimeout(function () { applyPolledControls(controls); }, 30);
      }
    };

    /* An image dropped anywhere on the panel means "take the colours out of
       this". main.js already has the extractor; this is the entry point for
       the drop handler in shelf.js. */
    window.lgExtractFromFile = function (file) {
      if (typeof extractColorsFromImage !== 'function') return;
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          try {
            var colors = extractColorsFromImage(img);
            if (colors && colors.length && typeof setColors === 'function') {
              setColors(colors, colors.length);
              LGUI.toast('Pulled ' + colors.length + ' colours from ' + file.name, 'success');
            }
          } catch (err) {
            LGUI.toast('Could not read colours from that image.', 'error');
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    };
  }

  /* ── 6. THE INSPECTOR'S SAVE BUTTONS ─────────────────────────────────

     The old Saved Presets section saved four hex values into localStorage and
     called it a preset. It is replaced in place: same corner of the inspector,
     but the buttons now write real records into the library, and the section
     explains the difference between saving a gradient and saving a palette —
     because that distinction is the whole feature and nobody will infer it. */

  function replaceSavedPresetsSection() {
    var select = document.getElementById('custom-preset-select');
    if (!select) return;

    var section = select.closest('.inspector-section');
    if (!section) return;

    section.innerHTML = '';
    section.classList.add('lg-save-section');

    var head = document.createElement('div');
    head.className = 'section-header';
    head.textContent = 'SAVE THIS';
    section.appendChild(head);

    var row = document.createElement('div');
    row.className = 'lg-save-row';

    var saveGradient = document.createElement('button');
    saveGradient.type = 'button';
    saveGradient.className = 'lg-btn is-primary is-block';
    saveGradient.innerHTML = LGUI.icon('box', 13) + '<span>Save as preset</span>';
    saveGradient.title = 'Saves the gradient, its settings and its palette';
    saveGradient.addEventListener('click', function () { LGShelf.saveCurrent(); });
    row.appendChild(saveGradient);

    var savePalette = document.createElement('button');
    savePalette.type = 'button';
    savePalette.className = 'lg-btn is-block';
    savePalette.innerHTML = LGUI.icon('droplet', 13) + '<span>Palette only</span>';
    savePalette.title = 'Saves just the colours';
    savePalette.addEventListener('click', function () { LGShelf.savePalette(); });
    row.appendChild(savePalette);

    section.appendChild(row);

    var capture = document.createElement('button');
    capture.type = 'button';
    capture.className = 'lg-btn is-block lg-capture-btn';
    capture.innerHTML = LGUI.icon('capture', 13) + '<span>Capture from comp</span>';
    capture.title = 'Save the gradient selected in After Effects, exactly as it is';
    capture.addEventListener('click', function () { LGShelf.captureFromComp(); });
    section.appendChild(capture);

    var hint = document.createElement('p');
    hint.className = 'ctrl-hint';
    hint.textContent =
      'A preset keeps the whole recipe — which gradient, every slider, the palette — so applying it rebuilds ' +
      'this exactly, at any comp size. A palette keeps only the colours, and recolours a gradient you have ' +
      'already built without rebuilding it.';
    section.appendChild(hint);

    var open = document.createElement('button');
    open.type = 'button';
    open.className = 'lg-link';
    open.innerHTML = 'Open your presets ' + LGUI.icon('chevronRight', 11);
    open.addEventListener('click', function () {
      var tab = document.getElementById('tab-presets');
      if (tab) tab.click();
    });
    section.appendChild(open);
  }

  /* ── 7. DIAGNOSTICS ──────────────────────────────────────────────────

     Two conditions, both silent otherwise, both with a fix the user can carry
     out. Said once, at the top, rather than as six confusing failures later. */

  function runDiagnostics(store, hostInfo) {
    if (!store.writable) {
      LGUI.banner('lg-banner-store', {
        kind: 'error',
        title: 'Presets are not being saved',
        body: 'Living Gradients cannot write to ' + store.root + '. Check that the folder is not read-only ' +
          'and that security software is not blocking it. Everything else works — nothing you save will survive.',
        dismissable: false,
        action: {
          label: 'Try again',
          onClick: function () {
            LGUI.clearBanner('lg-banner-store');
            runDiagnostics(LGStore.describe(), window.__lgHost);
          }
        }
      });
    }

    if (hostInfo && hostInfo.canWrite === false) {
      LGUI.banner('lg-banner-write', {
        kind: 'warn',
        title: 'Thumbnails are switched off',
        body: 'After Effects cannot write files, so preset thumbnails cannot be rendered. Turn on Preferences > ' +
          'Scripting & Expressions > Allow Scripts to Write Files and Access Network, then restart After ' +
          'Effects — the setting is not picked up until it restarts.',
        action: { label: 'How', onClick: function () { LGFooter.openHelp(); } }
      });
    }
  }

  /* ── 8. GO ───────────────────────────────────────────────────────── */

  function start() {
    if (typeof LGStore === 'undefined' || typeof LGLibrary === 'undefined') {
      console.error('[Living Gradients] store.js / library.js did not load — presets are unavailable.');
      return;
    }

    var store = bootLibrary();

    installBanners();
    installHooks();
    installTab();
    installFooter();
    replaceSavedPresetsSection();

    /* Settings that shape the panel rather than the library. Applied here so
       a restored backup brings the look back with it. */
    var s = LGLibrary.settings();
    document.documentElement.style.setProperty('--lg-radius', s.radius + 'px');

    LGShelf.render();

    loadHostScripts().then(function (info) {
      runDiagnostics(LGStore.describe(), info);
      /* Sweeping is cheap and only matters after a heavy session, so it goes
         last and its result is ignored. */
      var bridge = cs();
      if (bridge) bridge.evalScript('lgSweepTempThumbs()', function () { });
    });

    if (typeof LGService !== 'undefined') LGService.start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
