/* ============================================
   SHELF.JS — the preset library view
   ============================================

   The Presets tab: collections, folders, cards, search, capture, apply.

   WHAT A CARD SHOWS, AND WHY

   A gradient preset is not a colour swatch — it is a whole recipe, and the
   only honest way to show a recipe is a picture of what it makes. So a card
   leads with a thumbnail, and the thumbnail is the real thing: one frame that
   After Effects actually rendered from the comp the preset was captured out
   of. The canvas painters in preview.js are the fallback for presets saved
   from the panel rather than captured, and they are a second implementation of
   each look, so they drift. A rendered frame cannot drift.

   THREE WAYS IN, WHICH IS THE POINT

   Code Runner's best interaction lesson is that the way you add something
   should match what you already have in your hand:

     Capture from the comp    you built it in After Effects and want it back
     Save current settings    you dialled it in the panel and never applied it
     Drop a file on the panel  somebody sent it to you

   Any one of these alone leaves a gap somebody falls into. All three are here.

   DEPENDS ON: store.js, library.js, ui.js, presets.js, preview.js
   TALKS TO:   jsx/presets.jsx over CSInterface */

var LGShelf = (function () {
  'use strict';

  var root = null;          /* the view container */
  var listEl = null;
  var searchTerm = '';

  function cs() {
    return (lgHostReady()) ? new CSInterface() : null;
  }

  /* Every call into the host returns a JSON string or an ExtendScript error
     string. One place to turn both into an object, so no caller has to
     remember that 'EvalScript error.' is a thing that happens. */
  function host(call) {
    return new Promise(function (resolve) {
      var bridge = cs();
      if (!bridge) { resolve({ ok: false, error: 'Not running inside After Effects.' }); return; }

      bridge.evalScript(call, function (raw) {
        if (!raw || raw === 'EvalScript error.' || raw === 'undefined') {
          resolve({ ok: false, error: 'After Effects could not run that. Reopen the panel and try again.' });
          return;
        }
        if (raw.indexOf('ERROR:') === 0) {
          resolve({ ok: false, error: raw.replace('ERROR:', '').trim() });
          return;
        }
        try { resolve(JSON.parse(raw)); }
        catch (e) { resolve({ ok: true, raw: raw }); }
      });
    });
  }

  function esArgLocal(value) {
    return JSON.stringify(JSON.stringify(value));
  }

  /* ── THUMBNAILS ──────────────────────────────────────────────────────

     Two sources, one destination.

     The rendered path asks After Effects for a PNG of the current comp, then
     scales it down HERE rather than in the host — ExtendScript has no image
     scaling, and shipping a full 4K frame into every card would make the panel
     crawl. The canvas does the scaling and the crop to card aspect in one
     drawImage, which is also where a tall comp gets centre-cropped instead of
     squashed. */

  var THUMB_W = 480, THUMB_H = 270;

  function scaleToThumb(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = THUMB_W;
        canvas.height = THUMB_H;
        var ctx = canvas.getContext('2d');

        /* Cover, not contain: a card with letterbox bars around a gradient
           looks like a bug. Crop the overflowing axis from the centre. */
        var scale = Math.max(THUMB_W / img.width, THUMB_H / img.height);
        var w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (THUMB_W - w) / 2, (THUMB_H - h) / 2, w, h);

        try { resolve(canvas.toDataURL('image/jpeg', 0.86)); }
        catch (e) { resolve(null); }
      };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function renderedThumb() {
    return host('lgRenderThumb()').then(function (res) {
      if (!res.ok || !res.path) return null;
      /* file:// so CEF will load it. The path is already forward-slashed by
         the host side; a Windows drive letter needs the extra slash. */
      var url = 'file:///' + res.path.replace(/^\/+/, '');
      return scaleToThumb(url);
    });
  }

  function paintedThumb(type, colors) {
    if (typeof paintPreview !== 'function') return null;
    var canvas = document.createElement('canvas');
    canvas.width = THUMB_W;
    canvas.height = THUMB_H;
    try {
      paintPreview(canvas, type, colors);
      return canvas.toDataURL('image/jpeg', 0.86);
    } catch (e) { return null; }
  }

  /* ── CAPTURE ─────────────────────────────────────────────────────────

     The feature this whole file exists for. "I made this in After Effects,
     keep it" — one button, no selection ritual, no naming ceremony unless the
     user wants one. */

  function captureFromComp() {
    return host('lgCapture("selection")').then(function (res) {
      if (!res.ok) { LGUI.toast(res.error, 'error'); return null; }

      var payload = res.payload;
      var origin = res.origin || {};

      return maybeRenderThumb(payload).then(function (thumbUri) {
        var rec = LGLibrary.addPreset({
          kind: 'gradient',
          name: suggestName(payload, origin),
          type: payload.type,
          colors: payload.colors || [],
          controls: payload.controls || {},
          grain: payload.grain,
          glow: payload.glow,
          posterize: payload.posterize,
          posterizeFps: payload.posterizeFps,
          colorQuality: payload.colorQuality,
          fluid: payload.fluidEnabled ? {
            enabled: true,
            layerName: payload.fluidLayerName,
            length: payload.fluidLength,
            thickness: payload.fluidThickness,
            wobble: payload.fluidWobble,
            softness: payload.fluidSoftness,
            size: payload.fluidSize
          } : null,
          source: 'capture',
          origin: origin
        });

        if (thumbUri) {
          var name = LGStore.saveThumb(rec.id, thumbUri);
          if (name) LGLibrary.updatePreset(rec.id, { thumb: name });
        }

        render();
        LGUI.toast('Captured "' + rec.name + '"', 'success');
        return rec;
      });
    });
  }

  /* Every gradient in the comp, in one pass. The comp becomes a collection —
     which is what somebody means when they say "turn this project into
     presets".

     Thumbnails are skipped here on purpose: rendering one frame per gradient
     across a comp of twelve is a visible stall, and the panel-painted preview
     is a fair stand-in until somebody opens a card and asks for the real one. */
  function captureWholeComp() {
    return host('lgCaptureAll()').then(function (res) {
      if (!res.ok) { LGUI.toast(res.error, 'error'); return; }
      if (!res.count) {
        LGUI.toast('No Living Gradients layers in this comp.', 'error');
        return;
      }

      var folder = LGLibrary.createFolder(
        LGLibrary.activeCollection().id,
        res.comp || 'Captured',
        null
      );

      res.captures.forEach(function (capture) {
        var payload = capture.payload;
        var rec = LGLibrary.addPreset({
          kind: 'gradient',
          name: suggestName(payload, capture.origin),
          type: payload.type,
          colors: payload.colors || [],
          controls: payload.controls || {},
          grain: payload.grain,
          glow: payload.glow,
          posterize: payload.posterize,
          posterizeFps: payload.posterizeFps,
          source: 'capture',
          origin: capture.origin
        }, LGLibrary.activeCollection().id, folder.id);

        var painted = paintedThumb(payload.type, payload.colors || []);
        if (painted) {
          var name = LGStore.saveThumb(rec.id, painted);
          if (name) LGLibrary.updatePreset(rec.id, { thumb: name });
        }
      });

      render();
      LGUI.toast('Captured ' + res.count + ' gradient' + (res.count === 1 ? '' : 's') +
        ' into "' + folder.name + '"', 'success');
    });
  }

  function maybeRenderThumb(payload) {
    var settings = LGLibrary.settings();
    if (!settings.captureThumbFromComp) {
      return Promise.resolve(paintedThumb(payload.type, payload.colors || []));
    }
    return renderedThumb().then(function (uri) {
      return uri || paintedThumb(payload.type, payload.colors || []);
    });
  }

  /* A name somebody would have typed. The layer name if it is not just the
     generated default, otherwise the gradient's own label — never "Untitled",
     which is the name that guarantees a library nobody can navigate. */
  function suggestName(payload, origin) {
    var label = LGLibrary.labelForType(payload.type).split('  ')[0] ||
      payload.type || 'Gradient';
    label = label.replace(/\s+(Waves & Flow|Metal|Glass|Print & Pattern|Light & Energy|Ambient & Organic|Animal Prints|Anime & 2D|SilkFlare Engine|Liquid Metal)$/, '');

    var layerName = (origin && origin.layer) || '';
    var generated = /^(.*) Gradient$/.test(layerName);
    if (layerName && !generated) return layerName;

    return LGLibrary.search(label).length ? label + ' ' + shortStamp() : label;
  }

  function shortStamp() {
    var d = new Date();
    return ('0' + d.getDate()).slice(-2) + ' ' +
      ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  }

  /* Save what the inspector currently has, without going near After Effects.
     The path for "I built this in the panel and have not applied it yet",
     which is otherwise a dead end. */
  function saveCurrent() {
    var type = (typeof selectedType !== 'undefined') ? selectedType : null;
    if (!type) { LGUI.toast('Pick a gradient first.', 'error'); return Promise.resolve(); }

    var colors = (typeof state !== 'undefined' && state.colors) ? state.colors.slice() : [];
    var controls = (typeof getControlValues === 'function') ? getControlValues(type) : {};

    return LGUI.prompt({
      title: 'Save preset',
      label: 'Name',
      value: LGLibrary.labelForType(type).split('  ')[0] || type,
      hint: 'Saves the gradient, its settings and its palette — not just the colours.',
      confirmLabel: 'Save'
    }).then(function (name) {
      if (!name) return;

      var num = function (id, fallback) {
        var node = document.getElementById(id);
        var v = node ? parseFloat(node.value) : NaN;
        return isNaN(v) ? fallback : v;
      };
      var checked = function (id) {
        var node = document.getElementById(id);
        return !!(node && node.checked);
      };

      var rec = LGLibrary.addPreset({
        kind: 'gradient',
        name: name,
        type: type,
        colors: colors,
        controls: controls,
        grain: num('grain-slider', 0),
        glow: num('glow-slider', 0),
        posterize: checked('posterize-toggle'),
        posterizeFps: num('posterize-fps', 12),
        source: 'panel'
      });

      var painted = paintedThumb(type, colors);
      if (painted) {
        var thumb = LGStore.saveThumb(rec.id, painted);
        if (thumb) LGLibrary.updatePreset(rec.id, { thumb: thumb });
      }

      render();
      LGUI.toast('Saved "' + name + '"', 'success');
    });
  }

  /* Colours only. Kept because recolouring a gradient you already built is the
     most common edit there is, and rebuilding to do it throws away everything
     you hand-tweaked afterwards. */
  function savePalette() {
    var colors = (typeof state !== 'undefined' && state.colors) ? state.colors.slice() : [];
    if (!colors.length) { LGUI.toast('No colours to save.', 'error'); return Promise.resolve(); }

    return LGUI.prompt({
      title: 'Save palette',
      label: 'Name',
      placeholder: 'Warm client palette',
      hint: 'Colours only. Applying it recolours the selected gradient without rebuilding it.',
      confirmLabel: 'Save'
    }).then(function (name) {
      if (!name) return;
      LGLibrary.addPreset({ kind: 'palette', name: name, colors: colors, source: 'panel' });
      render();
      LGUI.toast('Saved palette "' + name + '"', 'success');
    });
  }

  /* ── APPLYING ────────────────────────────────────────────────────── */

  function payloadOf(rec) {
    var p = {
      type: rec.type,
      colors: rec.colors,
      controls: rec.controls || {},
      grain: rec.grain || 0,
      glow: rec.glow || 0,
      posterize: !!rec.posterize,
      posterizeFps: rec.posterizeFps || 12,
      colorQuality: !!rec.colorQuality
    };
    if (rec.fluid && rec.fluid.enabled) {
      p.fluidEnabled = true;
      p.fluidLayerName = rec.fluid.layerName;
      p.fluidLength = rec.fluid.length;
      p.fluidThickness = rec.fluid.thickness;
      p.fluidWobble = rec.fluid.wobble;
      p.fluidSoftness = rec.fluid.softness;
      p.fluidSize = rec.fluid.size;
    }
    return p;
  }

  function applyPreset(rec, replace) {
    if (rec.kind === 'palette') {
      return host('lgApplyPalette(' + esArgLocal(rec.colors) + ')').then(function (res) {
        if (res.ok === false) { LGUI.toast(res.error, 'error'); return; }
        if (typeof setColors === 'function') setColors(rec.colors);
        LGUI.toast('Recoloured with "' + rec.name + '"', 'success');
      });
    }

    LGUI.toast('Building "' + rec.name + '"…');
    return host('lgApplyPreset(' + esArgLocal(payloadOf(rec)) + ', ' + (replace ? 'true' : 'false') + ')')
      .then(function (res) {
        if (res.ok === false) { LGUI.toast(res.error, 'error'); return; }
        LGUI.toast('Applied "' + rec.name + '"', 'success');
      });
  }

  /* Load a preset into the inspector without touching the comp — the "show me
     what this is before I commit to it" path. */
  function loadIntoInspector(rec) {
    if (rec.kind === 'gradient' && typeof window.lgSelectType === 'function') {
      window.lgSelectType(rec.type, rec.colors, rec.controls);
      LGUI.toast('Loaded "' + rec.name + '" into Edit', 'success');
    } else if (typeof setColors === 'function') {
      setColors(rec.colors);
      LGUI.toast('Loaded palette "' + rec.name + '"', 'success');
    }
  }

  /* ── RENDERING ───────────────────────────────────────────────────── */

  function mount(container) {
    root = container;
    root.innerHTML = '';
    root.appendChild(buildToolbar());

    listEl = LGUI.el('div', 'lg-shelf-list');
    root.appendChild(listEl);

    installDropTarget();
    render();
  }

  function buildToolbar() {
    var bar = LGUI.el('div', 'lg-shelf-bar');

    /* Collection selector. Code Runner puts this at the top and it is right:
       it is the widest-scope control on the screen, and everything below it is
       a view of what it selects. */
    var picker = LGUI.el('button', 'lg-collection-picker');
    picker.type = 'button';
    picker.id = 'lg-collection-picker';
    picker.addEventListener('click', function () { openCollectionMenu(picker); });
    bar.appendChild(picker);

    var search = LGUI.el('div', 'lg-search');
    search.innerHTML = LGUI.icon('search', 13);
    var field = LGUI.el('input', 'lg-search-input');
    field.type = 'text';
    field.placeholder = 'Search presets…';
    field.spellcheck = false;
    field.addEventListener('input', function () {
      searchTerm = this.value;
      renderList();
    });
    /* Escape clears rather than closing anything — inside a panel there is
       nothing to close, and a stuck filter looks like an empty library. */
    field.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && this.value) {
        e.stopPropagation();
        this.value = '';
        searchTerm = '';
        renderList();
      }
    });
    search.appendChild(field);
    bar.appendChild(search);

    var tools = LGUI.el('div', 'lg-shelf-tools');

    var capture = LGUI.el('button', 'lg-btn is-primary is-small',
      LGUI.icon('capture', 13) + '<span>Capture</span>');
    capture.type = 'button';
    capture.title = 'Save the gradient selected in After Effects as a preset';
    capture.addEventListener('click', function () { captureFromComp(); });
    capture.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      LGUI.menu(capture, [
        { label: 'Capture selected gradient', icon: 'capture', onClick: captureFromComp },
        { label: 'Capture every gradient in this comp', icon: 'layers', onClick: captureWholeComp },
        '-',
        { label: 'Save current panel settings', icon: 'plus', onClick: saveCurrent },
        { label: 'Save palette only', icon: 'droplet', onClick: savePalette }
      ]);
    });
    tools.appendChild(capture);

    var add = LGUI.el('button', 'lg-icon-btn', LGUI.icon('plus', 15));
    add.type = 'button';
    add.title = 'Add';
    add.addEventListener('click', function () {
      LGUI.menu(add, [
        { label: 'Capture selected gradient', icon: 'capture', onClick: captureFromComp },
        { label: 'Capture every gradient in comp', icon: 'layers', onClick: captureWholeComp },
        '-',
        { label: 'Save current settings', icon: 'plus', onClick: saveCurrent },
        { label: 'Save palette only', icon: 'droplet', onClick: savePalette },
        '-',
        { label: 'New folder', icon: 'folder', onClick: newFolder },
        { label: 'Add from library…', icon: 'box', onClick: openAddFromLibrary }
      ], { alignRight: true });
    });
    tools.appendChild(add);

    var view = LGUI.el('button', 'lg-icon-btn');
    view.type = 'button';
    view.id = 'lg-view-toggle';
    view.title = 'Switch between grid and list';
    view.addEventListener('click', function () {
      var next = LGLibrary.settings().view === 'grid' ? 'list' : 'grid';
      LGLibrary.setSetting('view', next);
      render();
    });
    tools.appendChild(view);

    bar.appendChild(tools);
    return bar;
  }

  function refreshToolbar() {
    var picker = document.getElementById('lg-collection-picker');
    if (picker) {
      var col = LGLibrary.activeCollection();
      var count = col.items.length;
      picker.innerHTML =
        '<span class="lg-collection-name">' + LGUI.esc(col.name) + '</span>' +
        '<span class="lg-collection-count">' + count + '</span>' +
        LGUI.icon('chevronDown', 13);
    }
    var view = document.getElementById('lg-view-toggle');
    if (view) {
      var mode = LGLibrary.settings().view;
      view.innerHTML = LGUI.icon(mode === 'grid' ? 'list' : 'grid', 15);
    }
  }

  function render() {
    if (!root) return;
    refreshToolbar();
    renderList();
  }

  function renderList() {
    if (!listEl) return;

    var col = LGLibrary.activeCollection();
    var settings = LGLibrary.settings();

    listEl.className = 'lg-shelf-list is-' + settings.view + ' is-' + settings.cardSize;
    listEl.style.setProperty('--lg-card-radius', settings.radius + 'px');
    listEl.innerHTML = '';

    /* Searching flattens. Folders are an arrangement, and while you are
       looking for something an arrangement is in the way — Code Runner does
       the same, and it is why its search feels fast rather than like a
       filtered tree. */
    if (searchTerm.trim()) {
      var pool = col.items.map(function (it) { return LGLibrary.getPreset(it.ref); }).filter(Boolean);
      var hits = LGLibrary.search(searchTerm, pool);

      if (!hits.length) {
        listEl.appendChild(emptyState(
          'Nothing matches “' + searchTerm + '”',
          'Search looks at names, notes, tags and which gradient a preset is built on.'
        ));
        return;
      }

      var results = LGUI.el('div', 'lg-cards');
      hits.forEach(function (rec) {
        var item = col.items.filter(function (it) { return it.ref === rec.id; })[0];
        results.appendChild(buildCard(rec, item));
      });
      listEl.appendChild(results);
      return;
    }

    if (!col.items.length) {
      listEl.appendChild(emptyState(
        'No presets in ' + col.name,
        'Build a gradient, then press Capture to keep it. Or drop a .lgrad file straight onto this panel.',
        [
          { label: 'Capture from comp', icon: 'capture', onClick: captureFromComp },
          { label: 'Save current settings', icon: 'plus', onClick: saveCurrent }
        ]
      ));
      return;
    }

    var loose = col.items.filter(function (it) { return !it.folder; });
    if (loose.length) {
      var cards = LGUI.el('div', 'lg-cards');
      loose.forEach(function (it) {
        var rec = LGLibrary.getPreset(it.ref);
        if (rec) cards.appendChild(buildCard(rec, it));
      });
      listEl.appendChild(cards);
    }

    if (settings.showFolders) {
      renderFolders(col, null, listEl, 0);
    } else {
      var all = LGUI.el('div', 'lg-cards');
      col.items.filter(function (it) { return it.folder; }).forEach(function (it) {
        var rec = LGLibrary.getPreset(it.ref);
        if (rec) all.appendChild(buildCard(rec, it));
      });
      if (all.children.length) listEl.appendChild(all);
    }
  }

  function renderFolders(col, parentId, host, depth) {
    col.folders.filter(function (f) { return (f.parent || null) === parentId; }).forEach(function (folder) {
      var items = col.items.filter(function (it) { return it.folder === folder.id; });
      var children = col.folders.filter(function (f) { return f.parent === folder.id; });

      var wrap = LGUI.el('section', 'lg-folder' + (folder.collapsed ? ' is-collapsed' : ''));
      wrap.style.setProperty('--lg-folder-depth', depth);
      if (folder.accent) wrap.style.setProperty('--lg-folder-accent', folder.accent);

      var head = LGUI.el('button', 'lg-folder-head');
      head.type = 'button';
      head.innerHTML =
        '<span class="lg-folder-caret">' + LGUI.icon(folder.collapsed ? 'chevronRight' : 'chevronDown', 12) + '</span>' +
        '<span class="lg-folder-glyph">' + LGUI.icon(folder.collapsed ? 'folder' : 'folderOpen', 14) + '</span>' +
        '<span class="lg-folder-name">' + LGUI.esc(folder.name) + '</span>' +
        '<span class="lg-folder-count">' + items.length + '</span>';
      head.addEventListener('click', function () {
        LGLibrary.toggleFolder(col.id, folder.id);
        renderList();
      });
      head.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        folderMenu(col, folder, { x: e.clientX, y: e.clientY });
      });

      /* Folders are drop targets, which is the whole point of having them. */
      head.addEventListener('dragover', function (e) {
        if (!dragging) return;
        e.preventDefault();
        head.classList.add('is-drop');
      });
      head.addEventListener('dragleave', function () { head.classList.remove('is-drop'); });
      head.addEventListener('drop', function (e) {
        head.classList.remove('is-drop');
        if (!dragging) return;
        e.preventDefault();
        e.stopPropagation();
        LGLibrary.moveItem(col.id, dragging, folder.id, null);
        renderList();
      });

      wrap.appendChild(head);

      if (!folder.collapsed) {
        var body = LGUI.el('div', 'lg-folder-body');
        if (items.length) {
          var cards = LGUI.el('div', 'lg-cards');
          items.forEach(function (it) {
            var rec = LGLibrary.getPreset(it.ref);
            if (rec) cards.appendChild(buildCard(rec, it));
          });
          body.appendChild(cards);
        } else if (!children.length) {
          body.appendChild(LGUI.el('p', 'lg-folder-empty', 'Empty — drag a preset in.'));
        }
        renderFolders(col, folder.id, body, depth + 1);
        wrap.appendChild(body);
      }

      host.appendChild(wrap);
    });
  }

  function emptyState(title, body, actions) {
    var box = LGUI.el('div', 'lg-empty');
    box.innerHTML =
      '<div class="lg-empty-glyph">' + LGUI.icon('box', 26) + '</div>' +
      '<h4>' + LGUI.esc(title) + '</h4>' +
      '<p>' + LGUI.esc(body) + '</p>';

    if (actions && actions.length) {
      var row = LGUI.el('div', 'lg-empty-actions');
      actions.forEach(function (a) {
        var b = LGUI.el('button', 'lg-btn is-small', LGUI.icon(a.icon, 13) + '<span>' + LGUI.esc(a.label) + '</span>');
        b.type = 'button';
        b.addEventListener('click', a.onClick);
        row.appendChild(b);
      });
      box.appendChild(row);
    }
    return box;
  }

  /* ── CARDS ───────────────────────────────────────────────────────── */

  var dragging = null;

  function buildCard(rec, item) {
    var card = LGUI.el('article', 'lg-card is-' + rec.kind);
    card.dataset.id = rec.id;
    if (item) card.dataset.item = item.id;
    if (rec.accent) card.style.setProperty('--lg-card-accent', rec.accent);

    /* The picture. A saved thumbnail if there is one, otherwise the canvas
       painter, otherwise the palette as bare stripes — always something,
       because a card with a grey rectangle on it teaches nothing. */
    var art = LGUI.el('div', 'lg-card-art');
    var uri = rec.thumb ? LGStore.thumbUri(rec.thumb) : null;

    if (uri) {
      var img = new Image();
      img.src = uri;
      img.alt = '';
      img.loading = 'lazy';
      art.appendChild(img);
    } else if (rec.kind === 'gradient' && typeof paintPreview === 'function') {
      var canvas = document.createElement('canvas');
      canvas.width = 240; canvas.height = 135;
      try { paintPreview(canvas, rec.type, rec.colors); } catch (e) { }
      art.appendChild(canvas);
    } else {
      var strip = LGUI.el('div', 'lg-card-strip');
      rec.colors.forEach(function (c) {
        var chip = LGUI.el('span');
        chip.style.background = c;
        strip.appendChild(chip);
      });
      art.appendChild(strip);
    }

    if (rec.kind === 'palette') {
      art.appendChild(LGUI.el('span', 'lg-card-kind', 'Palette'));
    }

    /* Hover actions, over the art rather than beside it — the card stays the
       size it was, so a grid does not reflow when the pointer moves across it. */
    var quick = LGUI.el('div', 'lg-card-quick');

    var applyBtn = LGUI.el('button', 'lg-quick-btn is-primary', LGUI.icon('play', 13));
    applyBtn.type = 'button';
    applyBtn.title = rec.kind === 'palette' ? 'Recolour the selected gradient' : 'Build this in the comp';
    applyBtn.addEventListener('click', function (e) { e.stopPropagation(); applyPreset(rec, false); });
    quick.appendChild(applyBtn);

    if (rec.kind === 'gradient') {
      var replaceBtn = LGUI.el('button', 'lg-quick-btn', LGUI.icon('replace', 13));
      replaceBtn.type = 'button';
      replaceBtn.title = 'Replace the selected gradient with this one';
      replaceBtn.addEventListener('click', function (e) { e.stopPropagation(); applyPreset(rec, true); });
      quick.appendChild(replaceBtn);
    }

    var moreBtn = LGUI.el('button', 'lg-quick-btn', LGUI.icon('menu', 13));
    moreBtn.type = 'button';
    moreBtn.title = 'More';
    moreBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      cardMenu(rec, item, moreBtn);
    });
    quick.appendChild(moreBtn);

    art.appendChild(quick);
    card.appendChild(art);

    var meta = LGUI.el('div', 'lg-card-meta');
    meta.innerHTML =
      '<span class="lg-card-name" title="' + LGUI.esc(rec.name) + '">' + LGUI.esc(rec.name) + '</span>' +
      (rec.kind === 'gradient'
        ? '<span class="lg-card-type">' + LGUI.esc(typeLabel(rec.type)) + '</span>'
        : '<span class="lg-card-type">' + rec.colors.length + ' colours</span>');
    card.appendChild(meta);

    /* Double-click applies. Single click selects and loads into the inspector,
       which is the non-destructive default — clicking around a library should
       never be the thing that fills a comp with layers. */
    card.addEventListener('click', function () { loadIntoInspector(rec); });
    card.addEventListener('dblclick', function () { applyPreset(rec, false); });
    card.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      cardMenu(rec, item, null, { x: e.clientX, y: e.clientY });
    });

    /* Alt-click opens the editor, exactly as Code Runner does — once you know
       the shortcut it removes a menu trip from every edit. */
    card.addEventListener('mousedown', function (e) {
      if (e.altKey) { e.preventDefault(); openEditor(rec); }
    });

    if (item) {
      card.draggable = true;
      card.addEventListener('dragstart', function (e) {
        dragging = item.id;
        card.classList.add('is-dragging');
        try { e.dataTransfer.setData('text/plain', rec.id); } catch (err) { }
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', function () {
        dragging = null;
        card.classList.remove('is-dragging');
      });
      card.addEventListener('dragover', function (e) {
        if (!dragging || dragging === item.id) return;
        e.preventDefault();
        card.classList.add('is-drop');
      });
      card.addEventListener('dragleave', function () { card.classList.remove('is-drop'); });
      card.addEventListener('drop', function (e) {
        card.classList.remove('is-drop');
        if (!dragging || dragging === item.id) return;
        e.preventDefault();
        e.stopPropagation();

        var col = LGLibrary.activeCollection();
        var index = -1;
        for (var i = 0; i < col.items.length; i++) if (col.items[i].id === item.id) { index = i; break; }
        LGLibrary.moveItem(col.id, dragging, item.folder, index);
        renderList();
      });
    }

    return card;
  }

  function typeLabel(type) {
    if (typeof GRADIENT_LIBRARY === 'undefined') return type || '';
    for (var i = 0; i < GRADIENT_LIBRARY.length; i++) {
      if (GRADIENT_LIBRARY[i].id === type) return GRADIENT_LIBRARY[i].label;
    }
    return type || '';
  }

  /* ── MENUS ───────────────────────────────────────────────────────── */

  function cardMenu(rec, item, anchor, at) {
    var col = LGLibrary.activeCollection();
    var others = LGLibrary.collections().filter(function (c) { return c.id !== col.id; });

    var items = [
      {
        label: rec.kind === 'palette' ? 'Recolour selection' : 'Build in comp',
        icon: 'play',
        onClick: function () { applyPreset(rec, false); }
      }
    ];

    if (rec.kind === 'gradient') {
      items.push({
        label: 'Replace selected gradient', icon: 'replace',
        onClick: function () { applyPreset(rec, true); }
      });
    }

    items.push(
      { label: 'Load into Edit', icon: 'edit', onClick: function () { loadIntoInspector(rec); } },
      '-',
      { label: 'Edit preset…', icon: 'settings', hint: 'Alt-click', onClick: function () { openEditor(rec); } },
      { label: 'Duplicate', icon: 'copy', onClick: function () { LGLibrary.duplicatePreset(rec.id, col.id, item ? item.folder : null); render(); } }
    );

    if (rec.kind === 'gradient') {
      items.push({
        label: 'Re-render thumbnail', icon: 'refresh',
        hint: 'from current comp',
        onClick: function () { rethumb(rec); }
      });
    }

    if (others.length) {
      items.push({
        label: 'Add to another collection…', icon: 'box',
        onClick: function () {
          LGUI.menu(anchor || document.body, others.map(function (c) {
            return {
              label: c.name, icon: 'folder',
              onClick: function () {
                var made = LGLibrary.placeInCollection(rec.id, c.id, null);
                LGUI.toast(made ? 'Added to ' + c.name : 'Already in ' + c.name, made ? 'success' : null);
              }
            };
          }), { at: at });
        }
      });
    }

    items.push(
      { label: 'Export preset…', icon: 'download', onClick: function () { exportOne(rec); } },
      '-'
    );

    if (item) {
      items.push({
        label: 'Remove from ' + col.name, icon: 'close',
        hint: 'keeps it in the library',
        onClick: function () {
          LGLibrary.removeFromCollection(col.id, item.id);
          render();
          LGUI.toast('Removed from ' + col.name + ' — still in your library');
        }
      });
    }

    items.push({
      label: 'Delete preset', icon: 'trash', danger: true,
      onClick: function () { deleteWithConfirm(rec); }
    });

    LGUI.menu(anchor || document.body, items, { at: at, alignRight: true });
  }

  function folderMenu(col, folder, at) {
    LGUI.menu(document.body, [
      {
        label: 'Rename folder', icon: 'edit',
        onClick: function () {
          LGUI.prompt({ title: 'Rename folder', label: 'Name', value: folder.name })
            .then(function (name) { if (name) { LGLibrary.renameFolder(col.id, folder.id, name); renderList(); } });
        }
      },
      {
        label: 'New subfolder', icon: 'folder',
        onClick: function () {
          LGUI.prompt({ title: 'New folder', label: 'Name', placeholder: 'Client work' })
            .then(function (name) { if (name) { LGLibrary.createFolder(col.id, name, folder.id); renderList(); } });
        }
      },
      {
        label: 'Export folder…', icon: 'download',
        onClick: function () {
          var ids = col.items.filter(function (it) { return it.folder === folder.id; })
            .map(function (it) { return it.id; });
          exportBundle(LGLibrary.exportCollection(col.id, ids), folder.name);
        }
      },
      '-',
      {
        label: 'Delete folder', icon: 'trash', danger: true,
        hint: 'presets move up',
        onClick: function () {
          LGUI.confirm('Delete the folder “' + folder.name + '”?', {
            title: 'Delete folder',
            detail: 'The presets inside it move up a level. Nothing is deleted.',
            confirmLabel: 'Delete folder'
          }).then(function (yes) {
            if (yes) { LGLibrary.deleteFolder(col.id, folder.id); renderList(); }
          });
        }
      }
    ], { at: at });
  }

  function openCollectionMenu(anchor) {
    var active = LGLibrary.activeCollection();
    var items = LGLibrary.collections().map(function (c) {
      return {
        label: c.name,
        icon: c.id === active.id ? 'check' : null,
        hint: String(c.items.length),
        onClick: function () { LGLibrary.setActiveCollection(c.id); render(); }
      };
    });

    items.push(
      '-',
      {
        label: 'New collection…', icon: 'plus',
        onClick: function () {
          LGUI.prompt({ title: 'New collection', label: 'Name', placeholder: 'Client work' })
            .then(function (name) { if (name) { LGLibrary.createCollection(name); render(); } });
        }
      },
      {
        label: 'Rename “' + active.name + '”', icon: 'edit',
        onClick: function () {
          LGUI.prompt({ title: 'Rename collection', label: 'Name', value: active.name })
            .then(function (name) { if (name) { LGLibrary.renameCollection(active.id, name); render(); } });
        }
      },
      {
        label: 'Export “' + active.name + '”…', icon: 'download',
        onClick: function () { exportBundle(LGLibrary.exportCollection(active.id), active.name); }
      },
      {
        label: 'Add from library…', icon: 'box',
        onClick: openAddFromLibrary
      },
      '-',
      {
        label: 'Delete collection', icon: 'trash', danger: true,
        disabled: LGLibrary.collections().length <= 1,
        hint: 'keeps presets',
        onClick: function () {
          LGUI.confirm('Delete the collection “' + active.name + '”?', {
            title: 'Delete collection',
            detail: 'The presets in it stay in your library and can be added back from Add from library.',
            confirmLabel: 'Delete collection'
          }).then(function (yes) {
            if (yes) { LGLibrary.deleteCollection(active.id); render(); }
          });
        }
      }
    );

    LGUI.menu(anchor, items);
  }

  /* ── ADD FROM LIBRARY ────────────────────────────────────────────────

     Straight from Code Runner, and worth copying exactly: a searchable list of
     everything you have ever made, with the ones no collection currently shows
     flagged as unused. It is what stops "removed from a collection" from being
     a quiet way to lose things. */

  function openAddFromLibrary() {
    var col = LGLibrary.activeCollection();
    var inHere = {};
    col.items.forEach(function (it) { inHere[it.ref] = true; });

    var unused = {};
    LGLibrary.unusedPresets().forEach(function (r) { unused[r.id] = true; });

    var body = LGUI.el('div', 'lg-picker');
    var field = LGUI.el('input', 'lg-input');
    field.type = 'text';
    field.placeholder = 'Search your library…';
    field.setAttribute('data-autofocus', '');
    body.appendChild(field);

    var list = LGUI.el('div', 'lg-picker-list');
    body.appendChild(list);

    function draw() {
      var pool = LGLibrary.search(field.value, LGLibrary.allPresets());
      list.innerHTML = '';

      if (!pool.length) {
        list.appendChild(LGUI.el('p', 'lg-modal-detail', 'Nothing in your library matches that.'));
        return;
      }

      pool.forEach(function (rec) {
        var row = LGUI.el('button', 'lg-picker-row');
        row.type = 'button';

        var swatch = LGUI.el('span', 'lg-picker-swatch');
        swatch.style.background = 'linear-gradient(120deg,' + (rec.colors || ['#333']).join(',') + ')';

        row.appendChild(swatch);
        row.appendChild(LGUI.el('span', 'lg-picker-name', LGUI.esc(rec.name)));
        row.appendChild(LGUI.el('span', 'lg-picker-type',
          rec.kind === 'palette' ? 'Palette' : LGUI.esc(typeLabel(rec.type))));

        if (unused[rec.id]) row.appendChild(LGUI.el('span', 'lg-badge is-quiet', 'unused'));
        if (inHere[rec.id]) row.appendChild(LGUI.el('span', 'lg-badge', 'in here'));

        row.addEventListener('click', function () {
          var made = LGLibrary.placeInCollection(rec.id, col.id, null);
          if (made) {
            inHere[rec.id] = true;
            delete unused[rec.id];
            draw();
            render();
            LGUI.toast('Added "' + rec.name + '"', 'success');
          }
        });
        list.appendChild(row);
      });
    }

    field.addEventListener('input', draw);
    draw();

    LGUI.modal({
      title: 'Add from library',
      body: body,
      wide: true,
      actions: [{ label: 'Done', primary: true }]
    });
  }

  /* ── THE PRESET EDITOR ───────────────────────────────────────────── */

  function openEditor(rec) {
    var body = LGUI.el('div', 'lg-editor');

    var nameField = LGUI.el('input', 'lg-input');
    nameField.type = 'text';
    nameField.value = rec.name;
    nameField.setAttribute('data-autofocus', '');

    var noteField = LGUI.el('textarea', 'lg-input lg-textarea');
    noteField.rows = 3;
    noteField.value = rec.note || '';
    noteField.placeholder = 'What is this for? Searchable.';

    var tagField = LGUI.el('input', 'lg-input');
    tagField.type = 'text';
    tagField.value = (rec.tags || []).join(', ');
    tagField.placeholder = 'hero, warm, client';

    var accentField = LGUI.el('input', 'lg-color-field');
    accentField.type = 'color';
    accentField.value = rec.accent || '#DCB558';

    var accentOn = LGUI.el('input');
    accentOn.type = 'checkbox';
    accentOn.checked = !!rec.accent;

    body.appendChild(LGUI.el('label', 'lg-field-label', 'Name'));
    body.appendChild(nameField);
    body.appendChild(LGUI.el('label', 'lg-field-label', 'Note'));
    body.appendChild(noteField);
    body.appendChild(LGUI.el('label', 'lg-field-label', 'Tags'));
    body.appendChild(tagField);

    var accentRow = LGUI.el('div', 'lg-editor-row');
    accentRow.appendChild(LGUI.el('span', 'lg-field-label', 'Custom colour'));
    accentRow.appendChild(accentOn);
    accentRow.appendChild(accentField);
    body.appendChild(accentRow);

    var facts = LGUI.el('div', 'lg-editor-facts');
    var origin = rec.origin || {};
    facts.innerHTML =
      '<dl>' +
      (rec.kind === 'gradient' ? '<dt>Gradient</dt><dd>' + LGUI.esc(typeLabel(rec.type)) + '</dd>' : '') +
      '<dt>Colours</dt><dd>' + (rec.colors || []).length + '</dd>' +
      '<dt>Saved</dt><dd>' + LGUI.esc(new Date(rec.created).toLocaleDateString()) + '</dd>' +
      (origin.comp ? '<dt>From</dt><dd>' + LGUI.esc(origin.comp) + (origin.layer ? ' · ' + LGUI.esc(origin.layer) : '') + '</dd>' : '') +
      (origin.host ? '<dt>Built in</dt><dd>' + LGUI.esc(origin.host) + '</dd>' : '') +
      '</dl>';
    body.appendChild(facts);

    LGUI.modal({
      title: 'Edit preset',
      body: body,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Save', primary: true,
          onClick: function (handle) {
            LGLibrary.updatePreset(rec.id, {
              name: nameField.value.trim() || rec.name,
              note: noteField.value.trim(),
              tags: tagField.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean),
              accent: accentOn.checked ? accentField.value : null
            });
            render();
            handle.close();
            return false;
          }
        }
      ]
    });
  }

  function rethumb(rec) {
    LGUI.toast('Rendering a frame…');
    renderedThumb().then(function (uri) {
      if (!uri) { LGUI.toast('Could not render a frame from the active comp.', 'error'); return; }
      if (rec.thumb) LGStore.removeThumb(rec.thumb);
      var name = LGStore.saveThumb(rec.id, uri);
      if (name) LGLibrary.updatePreset(rec.id, { thumb: name });
      render();
      LGUI.toast('Thumbnail updated', 'success');
    });
  }

  function newFolder() {
    LGUI.prompt({ title: 'New folder', label: 'Name', placeholder: 'Client work' })
      .then(function (name) {
        if (!name) return;
        LGLibrary.createFolder(LGLibrary.activeCollection().id, name, null);
        renderList();
      });
  }

  function deleteWithConfirm(rec) {
    var uses = 0;
    LGLibrary.collections().forEach(function (c) {
      c.items.forEach(function (it) { if (it.ref === rec.id) uses++; });
    });

    LGUI.confirm('Delete “' + rec.name + '” for good?', {
      title: 'Delete preset',
      detail: uses > 1
        ? 'It appears in ' + uses + ' collections and will be removed from all of them. This cannot be undone.'
        : 'This removes the preset, its thumbnail and its file. This cannot be undone.',
      confirmLabel: 'Delete'
    }).then(function (yes) {
      if (!yes) return;
      LGLibrary.deletePreset(rec.id);
      render();
      LGUI.toast('Deleted "' + rec.name + '"');
    });
  }

  /* ── EXPORT / IMPORT ─────────────────────────────────────────────── */

  function exportOne(rec) {
    exportBundle(LGLibrary.exportPresets([rec.id], { name: rec.name }), rec.name, '.lgrad');
  }

  /* CEP's own save dialog rather than a download: a panel is not a web page,
     the user has a filesystem, and a browser download lands in a folder they
     did not choose. */
  function exportBundle(bundle, suggestedName, extension) {
    var ext = extension || '.lgcollection';
    var safe = (suggestedName || 'Living Gradients').replace(/[\\/:*?"<>|]/g, '-');

    if (window.cep && window.cep.fs && window.cep.fs.showSaveDialogEx) {
      var res = window.cep.fs.showSaveDialogEx(
        'Export presets', LGStore.paths.exports,
        [ext.replace('.', '')], safe + ext, ''
      );
      if (!res || res.err !== 0 || !res.data) return;

      var path = res.data;
      if (path.indexOf(ext) === -1) path += ext;

      if (LGStore.writeJson(path, bundle)) {
        LGUI.toast('Exported ' + bundle.presets.length + ' preset' +
          (bundle.presets.length === 1 ? '' : 's'), 'success');
      } else {
        LGUI.toast('Could not write that file.', 'error');
      }
      return;
    }

    /* No dialog available — write into the exports folder and say where. */
    var fallback = LGStore.join(LGStore.paths.exports, safe + ext);
    if (LGStore.writeJson(fallback, bundle)) {
      LGUI.toast('Exported to ' + fallback, 'success', 7000);
    } else {
      LGUI.toast('Could not export.', 'error');
    }
  }

  function importFromDialog() {
    if (!(window.cep && window.cep.fs && window.cep.fs.showOpenDialogEx)) {
      LGUI.toast('Drop the file onto the panel instead.', 'error');
      return;
    }
    var res = window.cep.fs.showOpenDialogEx(
      false, false, 'Import presets', LGStore.paths.exports,
      ['lgcollection', 'lgrad', 'json'], ''
    );
    if (!res || res.err !== 0 || !res.data || !res.data.length) return;
    importPath(res.data[0]);
  }

  function importPath(path) {
    var bundle = LGStore.readJson(path, null);
    if (!bundle) { LGUI.toast('That file could not be read.', 'error'); return; }

    if (bundle.kind === 'full') {
      LGUI.confirm('Restore this full backup?', {
        title: 'Restore backup',
        detail: 'This replaces your entire library with the contents of the backup. A copy of your current library is saved first.',
        confirmLabel: 'Restore'
      }).then(function (yes) {
        if (!yes) return;
        var out = LGLibrary.restoreEverything(bundle);
        if (out.ok) { render(); LGUI.toast('Restored ' + out.count + ' presets', 'success'); }
        else LGUI.toast(out.error, 'error');
      });
      return;
    }

    var out = LGLibrary.importBundle(bundle, LGLibrary.activeCollection().id);
    if (out.ok) {
      render();
      LGUI.toast('Imported ' + out.added + ' preset' + (out.added === 1 ? '' : 's'), 'success');
    } else {
      LGUI.toast(out.error, 'error');
    }
  }

  /* Drag a .lgrad onto the panel and it is in your library. This is the
     interaction Code Runner leans on hardest — "believe it or not, none of
     those ways are my favourite way to add buttons" — and it is worth having
     because it is the only one that costs zero clicks. */
  function installDropTarget() {
    var body = document.body;

    ['dragenter', 'dragover'].forEach(function (type) {
      body.addEventListener(type, function (e) {
        if (!e.dataTransfer || !e.dataTransfer.types) return;
        var hasFiles = Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') !== -1;
        if (!hasFiles) return;
        e.preventDefault();
        body.classList.add('lg-dropping');
      });
    });

    ['dragleave', 'dragend'].forEach(function (type) {
      body.addEventListener(type, function (e) {
        if (e.relatedTarget) return;
        body.classList.remove('lg-dropping');
      });
    });

    body.addEventListener('drop', function (e) {
      if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
      e.preventDefault();
      body.classList.remove('lg-dropping');

      var handled = 0;
      Array.prototype.forEach.call(e.dataTransfer.files, function (file) {
        var path = file.path || '';
        if (/\.(lgrad|lgcollection|json)$/i.test(file.name)) {
          if (path) { importPath(path); handled++; }
        } else if (/\.(png|jpe?g|gif|webp)$/i.test(file.name)) {
          /* An image dropped on the panel means "take the colours out of
             this", which the panel already knows how to do. */
          if (typeof window.lgExtractFromFile === 'function') {
            window.lgExtractFromFile(file);
            handled++;
          }
        }
      });

      if (!handled) {
        LGUI.toast('Drop a .lgrad or .lgcollection file, or an image to pull colours from.', 'error');
      }
    });
  }

  /* ── PUBLIC ──────────────────────────────────────────────────────── */

  return {
    mount: mount,
    render: render,
    captureFromComp: captureFromComp,
    captureWholeComp: captureWholeComp,
    saveCurrent: saveCurrent,
    savePalette: savePalette,
    importFromDialog: importFromDialog,
    importPath: importPath,
    exportBundle: exportBundle,
    openAddFromLibrary: openAddFromLibrary
  };
})();

if (typeof window !== 'undefined') window.LGShelf = LGShelf;
