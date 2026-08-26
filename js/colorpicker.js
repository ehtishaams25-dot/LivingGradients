/* ============================================
   COLORPICKER.JS — the panel's fallback colour picker
   ============================================

   WHAT THIS IS NOW, AND WHAT IT USED TO BE

   For a while this was the panel's colour picker: click a swatch inside After
   Effects and this opened. It no longer is. A swatch now opens After Effects'
   own picker — see the COLOUR PICKER section of js/main.js and
   openNativeColorPicker() in jsx/main.jsx — because the host's picker is the
   one the rest of the application uses and the one the user already knows.

   This is the fallback, and it runs when there is no host: a plain browser,
   which is where the panel's interface is developed (`python -m http.server`
   and open index.html). Everything below still works, and it is worth keeping
   working — it is the only way to see this half of the panel without After
   Effects, and if the host path ever has to be pulled again it is one line in
   js/main.js to make this the picker again.

   The rest of the file is unchanged: a saturation field, a hue rail, hex and
   RGB fields, a row of recents and the palette's other slots down the side,
   all of it divs and gradients because this panel is Chromium.

   HOW IT TALKS TO THE REST OF THE PANEL

   Two callbacks, deliberately separate:

     onChange   fires continuously while dragging. Wired to the coalesced live
                update path, which is what makes the comp track the pointer.
     onCommit   fires once, when the picker closes with a colour kept.

   Escape reverts to the colour the picker opened on and calls onChange one
   last time, so a cancelled edit leaves the comp exactly as it was rather
   than wherever the pointer happened to stop.

   DEPENDS ON: nothing. LGStore is used for the recents list if it is there,
   and the picker works without it.
*/

var LGPicker = (function () {
  'use strict';

  /* ── COLOUR MATHS ─────────────────────────────────────────────────
     Kept local. jsx/main.jsx has its own conversions because ExtendScript
     cannot see this file, and js/main.js has none — putting them here means
     the panel side has exactly one implementation. */

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* Accepts #abc, #aabbcc, abc, aabbcc. Returns null for anything else rather
     than a plausible-looking wrong answer: hexRgb() returning [NaN,NaN,NaN]
     for a bad swatch is what blacked out a whole gradient once, because After
     Effects accepts NaN and renders it as black. */
  function parseHex(str) {
    if (typeof str !== 'string') return null;
    var s = str.trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(s)) {
      s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    }
    if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
    return [
      parseInt(s.slice(0, 2), 16),
      parseInt(s.slice(2, 4), 16),
      parseInt(s.slice(4, 6), 16)
    ];
  }

  function toHex(rgb) {
    var out = '#';
    for (var i = 0; i < 3; i++) {
      var v = clamp(Math.round(rgb[i]), 0, 255).toString(16);
      out += v.length === 1 ? '0' + v : v;
    }
    return out.toUpperCase();
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var d = max - min, h = 0;
    if (d !== 0) {
      if (max === r)      h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else                h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return [h, max === 0 ? 0 : d / max, max];
  }

  function hsvToRgb(h, s, v) {
    h = ((h % 360) + 360) % 360;
    var c = v * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = v - c;
    var t = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]];
    var seg = t[Math.floor(h / 60) % 6];
    return [(seg[0] + m) * 255, (seg[1] + m) * 255, (seg[2] + m) * 255];
  }

  /* Shown, not used for anything — but it is the notation a lot of brand
     guidelines are written in, and reading it off saves a conversion. */
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var l = (max + min) / 2, d = max - min, s = 0, h = 0;
    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === r)      h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else                h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
  }

  /* Which way a label on top of this colour has to go. Used for the check mark
     on the selected recent swatch — a dark tick on a dark swatch is invisible,
     and this is the one place in the panel where the background is arbitrary. */
  function isLight(rgb) {
    return (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) > 150;
  }

  /* ── RECENTS ──────────────────────────────────────────────────────
     On disk beside the presets, not in localStorage. Clearing the extension's
     browser cache is the standard fix for a CEP panel that opens blank, and it
     is exactly what destroyed every saved preset before those moved out. A
     recent-colours list is a small thing to lose, but it is the same mistake. */

  var RECENT_MAX = 14;
  var recents = null;

  function recentFile() {
    /* available() is a function, not a flag — it asks whether a filesystem
       backend actually answered. Reading it as a property is always truthy and
       would send every write down a path that cannot work. */
    if (typeof LGStore === 'undefined' || typeof LGStore.available !== 'function') return null;
    if (!LGStore.available()) return null;
    try { return LGStore.join(LGStore.paths.root, 'recent-colors.json'); }
    catch (e) { return null; }
  }

  function loadRecents() {
    if (recents) return recents;
    recents = [];
    var f = recentFile();
    if (f) {
      var data = null;
      try { data = LGStore.readJson(f, null); } catch (e) { data = null; }
      if (data && data.colors && data.colors.length) {
        for (var i = 0; i < data.colors.length; i++) {
          if (parseHex(data.colors[i])) recents.push(data.colors[i].toUpperCase());
        }
      }
    }
    return recents;
  }

  function rememberColour(hex) {
    var list = loadRecents();
    hex = hex.toUpperCase();
    for (var i = list.length - 1; i >= 0; i--) if (list[i] === hex) list.splice(i, 1);
    list.unshift(hex);
    while (list.length > RECENT_MAX) list.pop();

    var f = recentFile();
    if (f) {
      try { LGStore.writeJson(f, { colors: list }); } catch (e) { /* not fatal */ }
    }
  }

  /* ── STATE ────────────────────────────────────────────────────────── */

  var root = null;        // the popover element, built once and reused
  var els = {};           // its parts
  var cfg = null;         // the open() options
  var hsv = [0, 0, 1];    // the working colour
  var opening = null;     // what it was when the picker opened, for Escape
  var dragging = null;    // 'sv' | 'hue' | null
  var suppressField = false;

  /* ── BUILD ────────────────────────────────────────────────────────── */

  function build() {
    if (root) return root;

    root = document.createElement('div');
    root.className = 'lgp';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Choose a colour');
    root.hidden = true;

    root.innerHTML =
      '<div class="lgp-head">' +
        '<span class="lgp-title"></span>' +
        '<button type="button" class="lgp-x" aria-label="Close">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
          'stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/>' +
          '<line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
      '</div>' +

      '<div class="lgp-body">' +
        '<div class="lgp-main">' +
          '<div class="lgp-sv" tabindex="0" role="slider" aria-label="Saturation and brightness">' +
            '<div class="lgp-sv-white"></div>' +
            '<div class="lgp-sv-black"></div>' +
            '<div class="lgp-knob lgp-sv-knob"></div>' +
          '</div>' +
          '<div class="lgp-hue" tabindex="0" role="slider" aria-label="Hue" ' +
               'aria-valuemin="0" aria-valuemax="359">' +
            '<div class="lgp-knob lgp-hue-knob"></div>' +
          '</div>' +
        '</div>' +
        '<div class="lgp-roles"></div>' +
      '</div>' +

      '<div class="lgp-fields">' +
        '<label class="lgp-f lgp-f-hex"><span>HEX</span>' +
          '<input type="text" spellcheck="false" maxlength="7" inputmode="text"></label>' +
        '<label class="lgp-f"><span>R</span>' +
          '<input type="number" min="0" max="255" step="1"></label>' +
        '<label class="lgp-f"><span>G</span>' +
          '<input type="number" min="0" max="255" step="1"></label>' +
        '<label class="lgp-f"><span>B</span>' +
          '<input type="number" min="0" max="255" step="1"></label>' +
        '<button type="button" class="lgp-eye" title="Sample a colour from the screen">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
          'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M12 2l-3 3-5-5-2 2 5 5-3 3v2h2l3-3 5 5 2-2-5-5 3-3-2-2z"/>' +
          '<path d="M15 15l4 4-2 2-4-4"/></svg>' +
        '</button>' +
      '</div>' +

      '<div class="lgp-hsl"></div>' +

      '<div class="lgp-recent-wrap">' +
        '<div class="lgp-eyebrow">RECENT</div>' +
        '<div class="lgp-recent"></div>' +
      '</div>';

    document.body.appendChild(root);

    els.title  = root.querySelector('.lgp-title');
    els.close  = root.querySelector('.lgp-x');
    els.sv     = root.querySelector('.lgp-sv');
    els.svKnob = root.querySelector('.lgp-sv-knob');
    els.hue    = root.querySelector('.lgp-hue');
    els.hueKnob= root.querySelector('.lgp-hue-knob');
    els.roles  = root.querySelector('.lgp-roles');
    els.hsl    = root.querySelector('.lgp-hsl');
    els.recent = root.querySelector('.lgp-recent');
    els.eye    = root.querySelector('.lgp-eye');

    var inputs = root.querySelectorAll('.lgp-f input');
    els.hex = inputs[0];
    els.r   = inputs[1];
    els.g   = inputs[2];
    els.b   = inputs[3];

    wire();
    return root;
  }

  /* ── EVENTS ───────────────────────────────────────────────────────── */

  function wire() {
    els.close.addEventListener('click', function () { close(true); });

    /* Pointer events rather than mouse events, and setPointerCapture rather
       than a document-level mousemove listener: capture keeps the drag alive
       when the pointer leaves the field, which is how every other colour
       picker behaves and what people expect when they slam the cursor to the
       edge to get pure saturation. */
    els.sv.addEventListener('pointerdown', function (e) {
      dragging = 'sv';
      try { els.sv.setPointerCapture(e.pointerId); } catch (x) { }
      els.sv.focus();
      trackSV(e);
      e.preventDefault();
    });
    els.sv.addEventListener('pointermove', function (e) {
      if (dragging === 'sv') trackSV(e);
    });
    els.sv.addEventListener('pointerup', endDrag);
    els.sv.addEventListener('pointercancel', endDrag);

    els.hue.addEventListener('pointerdown', function (e) {
      dragging = 'hue';
      try { els.hue.setPointerCapture(e.pointerId); } catch (x) { }
      els.hue.focus();
      trackHue(e);
      e.preventDefault();
    });
    els.hue.addEventListener('pointermove', function (e) {
      if (dragging === 'hue') trackHue(e);
    });
    els.hue.addEventListener('pointerup', endDrag);
    els.hue.addEventListener('pointercancel', endDrag);

    /* Keyboard on both rails. A colour picker that can only be driven by
       dragging is unusable for fine work — one step is 1% here and 10% with
       Shift, which is the same convention as the sliders. */
    els.sv.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 0.1 : 0.01;
      var s = hsv[1], v = hsv[2], used = true;
      if (e.key === 'ArrowLeft')       s -= step;
      else if (e.key === 'ArrowRight') s += step;
      else if (e.key === 'ArrowUp')    v += step;
      else if (e.key === 'ArrowDown')  v -= step;
      else used = false;
      if (!used) return;
      e.preventDefault();
      hsv[1] = clamp(s, 0, 1);
      hsv[2] = clamp(v, 0, 1);
      paint(true);
    });

    els.hue.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 15 : 1;
      var used = true;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown')       hsv[0] -= step;
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp')    hsv[0] += step;
      else used = false;
      if (!used) return;
      e.preventDefault();
      hsv[0] = ((hsv[0] % 360) + 360) % 360;
      paint(true);
    });

    /* Typing a hex. Mid-typing values are ignored rather than corrected —
       correcting as you type fights the user, and "#F" is not an error, it is
       an unfinished thought. */
    els.hex.addEventListener('input', function () {
      if (suppressField) return;
      var rgb = parseHex(els.hex.value);
      if (!rgb) return;
      hsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);
      paint(true, 'hex');
    });
    els.hex.addEventListener('blur', function () { paint(false); });
    els.hex.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); close(true); }
    });

    function fromRgbFields() {
      if (suppressField) return;
      var rgb = [parseFloat(els.r.value), parseFloat(els.g.value), parseFloat(els.b.value)];
      for (var i = 0; i < 3; i++) {
        if (isNaN(rgb[i])) return;          // half-typed
        rgb[i] = clamp(rgb[i], 0, 255);
      }
      hsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);
      paint(true, 'rgb');
    }
    els.r.addEventListener('input', fromRgbFields);
    els.g.addEventListener('input', fromRgbFields);
    els.b.addEventListener('input', fromRgbFields);

    els.eye.addEventListener('click', sampleScreen);

    /* Escape reverts, Enter keeps. Both close. */
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
      else if (e.key === 'Enter' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        close(true);
      }
    });

    /* Clicking anywhere else keeps the colour and closes, which is what a
       popover is for. The capture phase matters: the click must not also land
       on whatever is underneath and open a second picker. */
    document.addEventListener('pointerdown', function (e) {
      if (root.hidden) return;
      if (root.contains(e.target)) return;
      if (cfg && cfg.anchor && cfg.anchor.contains(e.target)) return;
      close(true);
    }, true);

    window.addEventListener('resize', function () { if (!root.hidden) place(); });
    window.addEventListener('scroll', function () { if (!root.hidden) place(); }, true);
  }

  function endDrag(e) {
    if (!dragging) return;
    dragging = null;
    /* One commit at the end of a drag, so the undo stack gets a single entry
       rather than one per pixel of travel. */
    if (cfg && cfg.onCommit) cfg.onCommit(currentHex());
  }

  function trackSV(e) {
    var r = els.sv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    hsv[1] = clamp((e.clientX - r.left) / r.width, 0, 1);
    hsv[2] = clamp(1 - (e.clientY - r.top) / r.height, 0, 1);
    paint(true);
  }

  function trackHue(e) {
    var r = els.hue.getBoundingClientRect();
    if (!r.width) return;
    hsv[0] = clamp((e.clientX - r.left) / r.width, 0, 1) * 359.99;
    paint(true);
  }

  /* ── SCREEN SAMPLE ────────────────────────────────────────────────
     The one thing left that the host does better, and only because it can see
     outside the panel's own window. */
  function sampleScreen() {
    if (window.EyeDropper) {
      var eye = new window.EyeDropper();
      eye.open().then(function (result) {
        var rgb = parseHex(result.sRGBHex);
        if (!rgb) return;
        hsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);
        paint(true);
        if (cfg && cfg.onCommit) cfg.onCommit(currentHex());
      })['catch'](function () { /* cancelled */ });
      return;
    }

    /* No EyeDropper on this build of After Effects. The host's picker is not
       a screen sampler either, but it has an eyedropper of its own inside the
       dialog, so the button still leads somewhere rather than nowhere. */
    if (typeof lgHostReady === 'function' && lgHostReady()) {
      var cs = new CSInterface();
      cs.evalScript("openNativeColorPicker('" + currentHex() + "')", function (res) {
        if (!res || res === '-1') return;
        var rgb = parseHex(res);
        if (!rgb) return;
        hsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);
        paint(true);
        if (cfg && cfg.onCommit) cfg.onCommit(currentHex());
      });
      return;
    }

    if (typeof LGUI !== 'undefined') {
      LGUI.toast('This build of After Effects has no screen eyedropper. ' +
                 'Type a hex instead.', 'error');
    }
  }

  /* ── RENDER ───────────────────────────────────────────────────────── */

  function currentRgb() { return hsvToRgb(hsv[0], hsv[1], hsv[2]); }
  function currentHex() { return toHex(currentRgb()); }

  /* `live` says whether the comp should follow this change. `source` names the
     field the change came from, so that field is not rewritten underneath the
     cursor while somebody is typing in it. */
  function paint(live, source) {
    var rgb = currentRgb();
    var hex = toHex(rgb);
    var pure = toHex(hsvToRgb(hsv[0], 1, 1));

    els.sv.style.backgroundColor = pure;
    els.svKnob.style.left = (hsv[1] * 100) + '%';
    els.svKnob.style.top  = ((1 - hsv[2]) * 100) + '%';
    els.svKnob.style.backgroundColor = hex;

    els.hueKnob.style.left = (hsv[0] / 359.99 * 100) + '%';
    els.hueKnob.style.backgroundColor = pure;

    els.sv.setAttribute('aria-valuetext',
      Math.round(hsv[1] * 100) + '% saturation, ' + Math.round(hsv[2] * 100) + '% brightness');
    els.hue.setAttribute('aria-valuenow', Math.round(hsv[0]));

    /* `source` is the only guard needed, and it used to be doubled up with a
       check on document.activeElement. That second check was the bug: the hex
       field takes focus when the picker opens, so it then refused every update
       that did not come from itself — arrow-keying the saturation field moved
       the colour and the number on screen stayed put. Nothing but the user can
       change this colour, so knowing which control they used is enough. */
    suppressField = true;
    if (source !== 'hex') els.hex.value = hex;
    if (source !== 'rgb') {
      els.r.value = Math.round(rgb[0]);
      els.g.value = Math.round(rgb[1]);
      els.b.value = Math.round(rgb[2]);
    }
    suppressField = false;

    var hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    els.hsl.textContent = 'HSL ' + hsl[0] + '° ' + hsl[1] + '% ' + hsl[2] + '%';

    if (cfg && cfg.index !== undefined) markRole(cfg.index, hex);

    if (live && cfg && cfg.onChange) cfg.onChange(hex);
  }

  function markRole(i, hex) {
    var chip = els.roles.querySelector('.lgp-role[data-index="' + i + '"] .lgp-role-chip');
    if (chip) chip.style.backgroundColor = hex;
  }

  /* The palette's other slots, down the side. The whole reason the host dialog
     was the wrong tool: choosing one colour in a four-colour gradient is not a
     decision you make with the other three out of sight. Clicking one moves
     the picker to it without closing. */
  function renderRoles() {
    els.roles.innerHTML = '';
    var palette = (cfg && cfg.palette) || [];
    if (palette.length < 2) { els.roles.hidden = true; return; }
    els.roles.hidden = false;

    for (var i = 0; i < palette.length; i++) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lgp-role' + (i === cfg.index ? ' is-current' : '');
      btn.dataset.index = String(i);
      btn.title = (cfg.roles && cfg.roles[i]) || ('Colour ' + (i + 1));

      var chip = document.createElement('span');
      chip.className = 'lgp-role-chip';
      chip.style.backgroundColor = palette[i];
      btn.appendChild(chip);

      var name = document.createElement('span');
      name.className = 'lgp-role-name';
      name.textContent = btn.title;
      btn.appendChild(name);

      els.roles.appendChild(btn);
    }

    els.roles.onclick = function (e) {
      var b = e.target.closest ? e.target.closest('.lgp-role') : null;
      if (!b) return;
      var i = parseInt(b.dataset.index, 10);
      if (isNaN(i) || i === cfg.index) return;
      /* Keep what is on screen before moving on, then hand the caller the new
         slot so it can reopen against the right swatch. */
      if (cfg.onCommit) cfg.onCommit(currentHex());
      rememberColour(currentHex());
      if (cfg.onSlot) cfg.onSlot(i);
    };
  }

  function renderRecents() {
    var list = loadRecents();
    els.recent.innerHTML = '';
    if (!list.length) {
      var empty = document.createElement('span');
      empty.className = 'lgp-recent-empty';
      empty.textContent = 'Colours you pick show up here.';
      els.recent.appendChild(empty);
      return;
    }
    for (var i = 0; i < list.length; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'lgp-swatch';
      b.style.backgroundColor = list[i];
      b.title = list[i];
      b.dataset.hex = list[i];
      els.recent.appendChild(b);
    }
    els.recent.onclick = function (e) {
      var b = e.target.closest ? e.target.closest('.lgp-swatch') : null;
      if (!b) return;
      var rgb = parseHex(b.dataset.hex);
      if (!rgb) return;
      hsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);
      paint(true);
      if (cfg && cfg.onCommit) cfg.onCommit(currentHex());
    };
  }

  /* ── PLACEMENT ────────────────────────────────────────────────────
     Fixed, anchored to the swatch, flipped or nudged so it is always fully on
     screen. The panel is often docked narrow and short, which is the case that
     matters: a picker that opens half off the bottom of a 300px-tall panel is
     no better than the dialog it replaced. */
  function place() {
    if (!cfg || !cfg.anchor) return;
    var a = cfg.anchor.getBoundingClientRect();
    var pad = 8;

    root.style.left = '0px';
    root.style.top = '0px';
    var box = root.getBoundingClientRect();
    var w = box.width, h = box.height;

    var left = a.left;
    if (left + w > window.innerWidth - pad) left = window.innerWidth - w - pad;
    if (left < pad) left = pad;

    var top = a.bottom + 6;
    if (top + h > window.innerHeight - pad) {
      var above = a.top - h - 6;
      top = above >= pad ? above : Math.max(pad, window.innerHeight - h - pad);
    }

    root.style.left = Math.round(left) + 'px';
    root.style.top = Math.round(top) + 'px';
  }

  /* ── OPEN / CLOSE ─────────────────────────────────────────────────── */

  function open(options) {
    build();
    cfg = options || {};

    var rgb = parseHex(cfg.hex) || [128, 128, 128];
    hsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);
    opening = toHex(rgb);

    els.title.textContent = cfg.label || 'Colour';
    renderRoles();
    renderRecents();

    root.hidden = false;
    paint(false);
    place();

    /* The hex field, not the saturation field. Most picks in practice are a
       pasted brand hex, and focusing the field means paste-and-enter works
       without touching the mouse. */
    els.hex.focus();
    els.hex.select();
  }

  /* `keep` false means Escape: put the opening colour back, tell the comp, and
     leave nothing behind. */
  function close(keep) {
    if (!root || root.hidden) return;
    dragging = null;

    var hex = currentHex();
    if (!keep) {
      var rgb = parseHex(opening);
      if (rgb) {
        hsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);
        hex = opening;
        if (cfg && cfg.onChange) cfg.onChange(hex);
      }
    } else if (hex !== opening) {
      rememberColour(hex);
    }

    if (cfg && cfg.onCommit) cfg.onCommit(hex);

    root.hidden = true;
    var anchor = cfg && cfg.anchor;
    cfg = null;
    /* Focus back where it came from, so keyboard navigation is not dumped at
       the top of the document every time a colour is picked. */
    if (anchor && anchor.focus) { try { anchor.focus(); } catch (e) { } }
  }

  return {
    open: open,
    close: function () { close(true); },
    isOpen: function () { return !!(root && !root.hidden); },

    /* Exported because js/main.js validates typed hexes in the colour row too,
       and two hex parsers in one panel is one too many. */
    parseHex: parseHex,
    toHex: toHex,
    isLight: isLight,
    remember: rememberColour
  };
})();

if (typeof window !== 'undefined') window.LGPicker = LGPicker;
