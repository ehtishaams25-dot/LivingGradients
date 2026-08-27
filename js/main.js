/* ============================================
   MAIN.JS — UI Logic & AE Bridge
   ============================================ */

// ── STATE ──
let selectedType = 'living';
const state = {
  colors: ['#FF6B35', '#FF3366', '#CC00FF', '#0033FF']
};

/* ── COLOUR SLOTS ────────────────────────────────────────────────────
   The number of swatches is a property of the gradient, not of the panel.
   Everything below goes through setColors()/renderColorSlots() so that a
   three-colour gradient never leaves a stale fourth swatch on screen, and
   nothing has to know the count in advance. */

function colorCountFor(type) {
  const preset = (typeof GRADIENT_LIBRARY !== 'undefined')
    ? GRADIENT_LIBRARY.find(g => g.id === type) : null;
  if (preset && preset.defaultColors && preset.defaultColors.length) {
    return preset.defaultColors.length;
  }
  return 4;
}

function renderColorSlots(type) {
  const row = document.getElementById('color-row');
  if (!row) return;

  const roles = (typeof colorRolesFor === 'function') ? colorRolesFor(type) : [null, null, null, null];
  const count = colorCountFor(type);

  /* One row per colour: role on the left, swatch and hex on the right, in the
     same capsule the sliders use. The four big swatches side by side could not
     show a hex, could not show a role without a caption strip underneath, and
     got narrower every time a gradient wanted more of them. */
  row.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const hex = (state.colors[i] || '#000000').toUpperCase();

    const item = document.createElement('div');
    item.className = 'ctrl-row color-item';

    const label = document.createElement('span');
    label.className = 'ctrl-label';
    label.textContent = roles[i] || ('Colour ' + (i + 1));
    item.appendChild(label);

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'color-pick';
    chip.id = 'color' + (i + 1);
    chip.dataset.index = String(i);
    chip.style.backgroundColor = hex;
    chip.title = 'Pick ' + (roles[i] || ('colour ' + (i + 1)));
    item.appendChild(chip);

    const field = document.createElement('input');
    field.type = 'text';
    field.className = 'color-hex';
    field.dataset.index = String(i);
    field.value = hex;
    field.spellcheck = false;
    field.maxLength = 7;
    item.appendChild(field);

    row.appendChild(item);
  }
}

/* Replace the palette. Extra values are dropped, missing ones are filled by
   cycling what was given, so a mood preset built for four still reads sensibly
   on a three-slot gradient. */
/* True once the user has chosen a palette themselves — a swatch, the picker,
   a mood, a shuffle, an extracted image, a saved preset. Browsing the library
   must not throw that away; see the card click handler. Reset when they load
   a gradient's own colours deliberately. */
let paletteIsCustom = false;

function setColors(colors, count) {
  paletteIsCustom = true;
  const n = count || state.colors.length || 4;
  const next = [];
  for (let i = 0; i < n; i++) {
    next.push((colors && colors.length) ? (colors[i] || colors[i % colors.length]) : '#000000');
  }
  state.colors = next;
  paintColorSlots();
  triggerColorUpdate();
}

function paintColorSlots() {
  const row = document.getElementById('color-row');
  if (!row) return;
  const picks = row.querySelectorAll('.color-pick');
  if (picks.length !== state.colors.length) { renderColorSlots(selectedType); return; }
  picks.forEach((p, i) => { p.style.backgroundColor = state.colors[i]; });
  row.querySelectorAll('.color-hex').forEach((f, i) => {
    if (f !== document.activeElement) f.value = (state.colors[i] || '').toUpperCase();
  });
}

// ── MOOD PRESETS ──
const MOODS = {
  sunset: ['#FF6B35', '#FF3366', '#FF8C00', '#FF4500'],
  ocean: ['#006994', '#0099CC', '#00CED1', '#003366'],
  neon: ['#FF00FF', '#00FFFF', '#FF00AA', '#00FF88'],
  aurora: ['#00FF99', '#00AAFF', '#AA00FF', '#001133'],
  gold: ['#FFD700', '#FFA500', '#B8860B', '#4A3800'],
  pastel: ['#FFB3C6', '#BDE0FE', '#CAFFBF', '#FDFFB6'],
  void: ['#111111', '#1a1a2e', '#16213e', '#0f3460'],
  fire: ['#FF4500', '#FF6B00', '#CC2200', '#440000']
};

/* ── CUSTOM PRESET STORAGE ────────────────────────────────────────────
   Moved out. Presets used to be four hex strings in localStorage, which put
   them inside the extension's browser cache — so clearing that cache, the
   standard fix for a panel that opens blank, destroyed every one of them.

   They now live on disk in the panel's own data folder, they carry the whole
   gradient rather than just its colours, and they can be exported, shared and
   backed up. See js/store.js for the folder, js/library.js for the model and
   js/shelf.js for the interface. The old localStorage entries are migrated on
   first run by migrateLegacy() in library.js; nothing anybody saved is lost.

   The Saved Presets section of the inspector is rebuilt by boot.js. */

// ── GRADIENT CARDS LIBRARY ──
const gradientGrid = document.getElementById('gradient-grid');
const inspectorPanel = document.getElementById('inspector-panel');
const inspectorTitle = document.getElementById('inspector-title');
const inspectorPreviewMini = document.getElementById('inspector-preview-mini');
const closeInspectorBtn = document.getElementById('close-inspector-btn');

function renderLibrary() {
  if (!gradientGrid || typeof GRADIENT_LIBRARY === 'undefined') return;
  gradientGrid.innerHTML = '';

  const categories = {};
  GRADIENT_LIBRARY.forEach(preset => {
    const cat = preset.category || 'Other';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(preset);
  });

  let firstItem = true;

  Object.keys(categories).forEach(cat => {
    // Styling lives in css/styles.css — see .category-header
    const catHeader = document.createElement('div');
    catHeader.className = 'category-header';
    catHeader.textContent = cat;
    gradientGrid.appendChild(catHeader);

    categories[cat].forEach(preset => {
      const card = document.createElement('div');
      card.className = 'gradient-card' + (firstItem ? ' selected' : '');
      if (firstItem) { selectedType = preset.id; firstItem = false; }
      card.dataset.type = preset.id;

      card.innerHTML = `
        <div class="card-preview">
          <canvas class="card-canvas" width="168" height="120" data-preview-type="${preset.id}"></canvas>
        </div>
        <span class="card-label">${preset.label}</span>
        <span class="batch-tick">✓</span>
      `;

      /* Each card previews its own palette rather than the one currently in
         the inspector — the grid is for choosing between gradients, and they
         do not all mean the same thing by "colour 3".

         `live: true` means "do not swap the render in yourself". It used to be
         the inspector's flag alone; the cards want it now too, because the
         render arrives as a real <img> on top rather than as a drawImage into
         this canvas. Without it the same PNG is fetched and decoded twice for
         every card. The canvas underneath is the last fallback — what a
         gradient with nothing rendered shows, forever. */
      const cardCanvas = card.querySelector('.card-canvas');
      if (typeof paintPreview === 'function') {
        paintPreview(cardCanvas, preset.id, preset.defaultColors, { live: true });
      }
      attachCardRender(card, preset.id);

      card.addEventListener('click', function () {
        // In batch mode a click adds to the set rather than switching the
        // inspector, so the user can sweep the grid without losing the
        // selection they have built up.
        if (batchMode) {
          this.classList.toggle('batch-selected');
          updateBatchCount();
          return;
        }
        document.querySelectorAll('.gradient-card').forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');
        selectedType = preset.id;

        /* Not `=== 4`. Halftone has three slots and Sunburst three, and
           testing for exactly four meant clicking either card loaded no
           palette at all and left the previous gradient's swatches on screen.

           A palette the user chose themselves survives browsing. Clicking
           through the library used to overwrite the swatches every single
           time, so picking colours and then looking for a gradient to put
           them on — which is the obvious way to work — threw the colours away
           at the moment of choosing. Their palette is kept whenever the new
           gradient takes the same number of slots; when it does not, there is
           nothing sensible to carry over and the preset's own colours load. */
        if (preset.defaultColors && preset.defaultColors.length) {
          const keep = paletteIsCustom &&
                       state.colors.length === preset.defaultColors.length;
          if (!keep) {
            state.colors = [...preset.defaultColors];
            paletteIsCustom = false;
          }
          renderColorSlots(selectedType);
          if (typeof triggerColorUpdate === 'function') {
            triggerColorUpdate();
          }
        }

        if (inspectorPanel) {
          if (inspectorTitle) inspectorTitle.textContent = preset.label;
          if (inspectorPreviewMini) {
            inspectorPreviewMini.className = 'inspector-preview-mini ' + preset.cssClass;
          }
          paintInspectorPreview();
          if (typeof tabEdit !== 'undefined' && tabEdit) {
             tabEdit.click();
          }
        }
        renderControls(selectedType);
      });

      gradientGrid.appendChild(card);
    });
  });
}

/* ── Card renders: the poster, and the loop on hover ─────────────────

   Three layers in every .card-preview, and which of them you see depends
   entirely on what has been rendered:

     canvas   the painter. Always drawn, always underneath. An imitation of
              the builder, and the only thing a gradient with no render has.
     img      the poster still, if css/previews/index.json names it. A frame
              of the real gradient, so it covers the imitation.
     video    the 8s loop, created on first hover and never before.

   Poster and video are both 16:9 and both cropped by the same object-fit
   rule, so the video landing on top of the poster changes what is moving and
   nothing else. They were not always the same shape — the stills this replaced
   were 336x240 — and a card whose picture jumps sideways the instant you point
   at it reads as a glitch, not as a preview. */

function attachCardRender(card, type) {
  if (typeof previewIndex !== 'function') return;
  previewIndex().then((have) => {
    if (!have.cards.has(type)) return;
    const shell = card.querySelector('.card-preview');
    if (!shell || card.querySelector('.card-poster')) return;
    const img = document.createElement('img');
    img.className = 'card-poster';
    img.alt = '';
    /* Decoded off the main thread. Forty-three of these arriving at once
       otherwise lands as one long jank while the grid is being scrolled. */
    img.decoding = 'async';
    img.src = previewPosterSrc(type);
    shell.appendChild(img);
  });
}

/* Motion is a preference, and one the OS is allowed to have an opinion about.
   Read once: it is not going to change while the panel is open, and the hover
   path should not be doing matchMedia on every pointer move. */
const lgWantsMotion = !(window.matchMedia &&
                        window.matchMedia('(prefers-reduced-motion: reduce)').matches);

let lgHoverCard = null;

function lgStartLoop(card) {
  if (!lgWantsMotion) return;
  if (typeof previewCanPlayLoops !== 'function' || !previewCanPlayLoops()) return;

  const type = card.dataset.type;
  previewIndex().then((have) => {
    if (!have.loops.has(type)) return;
    /* The index resolves a tick later than the pointer moves. Sweeping across
       the grid queues one of these per card passed over, and without this every
       one of them would start playing behind whichever card the pointer
       actually stopped on. */
    if (lgHoverCard !== card) return;

    let vid = card._lgLoop;
    if (!vid) {
      vid = document.createElement('video');
      vid.className = 'card-loop';
      vid.muted = true;
      vid.loop = true;
      vid.playsInline = true;
      /* Attributes as well as properties: muted in particular is only honoured
         as an autoplay condition when it is on the element. */
      vid.setAttribute('muted', '');
      vid.setAttribute('playsinline', '');
      /* Nothing is fetched until the first hover. Forty-three loops
         preloading when the panel opens is several megabytes to look at a
         grid the user may not touch. */
      vid.preload = 'none';
      vid.addEventListener('playing', () => {
        /* Faded in only once there is a frame to show, so a slow first load
           shows the poster rather than a black rectangle. */
        if (lgHoverCard === card) vid.classList.add('is-playing');
      });
      vid.src = previewLoopSrc(type);
      card.querySelector('.card-preview').appendChild(vid);
      card._lgLoop = vid;
    }

    const p = vid.play();
    /* play() rejects if the pointer left before the first frame decoded, and an
       unhandled rejection here is a red line in the console for a non-event. */
    if (p && p.catch) p.catch(() => {});
  });
}

function lgStopLoop(card) {
  const vid = card && card._lgLoop;
  if (!vid) return;
  vid.pause();
  /* currentTime is left alone on purpose. Coming back to a card you were just
     looking at should carry on, not start over. */
  vid.classList.remove('is-playing');
}

if (gradientGrid) {
  /* Delegated. mouseenter does not bubble, so this is mouseover plus a record
     of which card is current — which is needed anyway to stop the previous one.
     One card plays at a time: forty-three video decoders in a docked panel is
     not something to find out about the hard way. */
  gradientGrid.addEventListener('mouseover', (e) => {
    const card = e.target.closest ? e.target.closest('.gradient-card') : null;
    if (card === lgHoverCard) return;
    if (lgHoverCard) lgStopLoop(lgHoverCard);
    lgHoverCard = card;
    if (card) lgStartLoop(card);
  });

  /* Leaving the grid entirely — out of the panel, or into the toolbar — fires
     no mouseover, so without this the last card hovered keeps playing
     underneath a pointer that is somewhere else. */
  gradientGrid.addEventListener('mouseleave', () => {
    if (lgHoverCard) lgStopLoop(lgHoverCard);
    lgHoverCard = null;
  });
}

/* ── Batch selection ───────────────────────────────────────────────── */

let batchMode = false;

const batchToggle  = document.getElementById('batch-toggle');
const batchActions = document.getElementById('batch-actions');
const batchCountEl = document.getElementById('batch-count');
const batchStatus  = document.getElementById('batch-status');

function selectedBatchCards() {
  return Array.from(document.querySelectorAll('.gradient-card.batch-selected'));
}

function updateBatchCount() {
  const n = selectedBatchCards().length;
  if (batchCountEl) batchCountEl.textContent = n;
  const btn = document.getElementById('batch-generate-btn');
  if (btn) btn.disabled = n === 0;
}

if (batchToggle) {
  batchToggle.addEventListener('change', function () {
    batchMode = this.checked;
    document.body.classList.toggle('batch-mode', batchMode);
    if (batchActions) batchActions.classList.toggle('visible', batchMode);
    if (!batchMode) {
      selectedBatchCards().forEach(c => c.classList.remove('batch-selected'));
      if (batchStatus) { batchStatus.textContent = ''; batchStatus.className = 'batch-status'; }
    }
    updateBatchCount();
  });
}

const batchClearBtn = document.getElementById('batch-clear');
if (batchClearBtn) {
  batchClearBtn.addEventListener('click', function () {
    selectedBatchCards().forEach(c => c.classList.remove('batch-selected'));
    updateBatchCount();
  });
}

const batchGenerateBtn = document.getElementById('batch-generate-btn');
if (batchGenerateBtn) {
  batchGenerateBtn.addEventListener('click', function () {
    const cards = selectedBatchCards();
    if (!cards.length) return;

    /* Each type carries its own colours and control defaults. Using the
       library's per-type palette rather than the current pickers is what
       makes a batch look like a set of finished presets instead of the same
       four colours applied thirty ways. */
    const items = cards.map(card => {
      const preset = GRADIENT_LIBRARY.find(g => g.id === card.dataset.type);
      const controls = {};
      (GRADIENT_CONTROLS[card.dataset.type] || []).forEach(c => { controls[c.id] = c.default; });
      return {
        type:     card.dataset.type,
        label:    preset ? preset.label : card.dataset.type,
        colors:   (preset && preset.defaultColors && preset.defaultColors.length === 4)
                    ? preset.defaultColors
                    : state.colors,
        controls
      };
    });

    const payload = {
      items,
      grain:    parseFloat(document.getElementById('grain-slider')?.value) || 0,
      glow:     parseFloat(document.getElementById('glow-slider')?.value) || 0,
      posterize: document.getElementById('posterize-toggle')?.checked || false,
      posterizeFps: parseFloat(document.getElementById('posterize-fps')?.value) || 12,
    };
    /* No fluid on a batch: the trail follows one layer, and a dozen gradients
       all matted to the same motion is not something anyone wants. */

    batchGenerateBtn.disabled = true;
    setStatus(batchStatus, `Building ${items.length} gradients…`, '');

    if (!lgHostReady()) {
      console.log('BATCH PAYLOAD:', payload);
      batchGenerateBtn.disabled = false;
      setStatus(batchStatus, '✓ [Dev mode] Payload logged to console.', 'success');
      return;
    }

    new CSInterface().evalScript(`generateBatch(${esArg(payload)})`, function (result) {
      batchGenerateBtn.disabled = false;
      if (!result || result === 'EvalScript error.' || result === 'undefined') {
        setStatus(batchStatus, '✕ Batch failed. Check the JSX.', 'error');
      } else if (result.indexOf('ERROR') !== -1) {
        setStatus(batchStatus, '✕ ' + result.replace('ERROR:', '').trim(), 'error');
      } else if (result.indexOf('warning') !== -1 || result.indexOf('failed:') !== -1) {
        setStatus(batchStatus, '⚠ ' + result, 'warn');
        console.warn('[Living Gradients] batch:', result);
      } else {
        setStatus(batchStatus, '✓ ' + result, 'success');
      }
    });
  });
}

// Init library
renderLibrary();
updateBatchCount();

// Init controls
renderControls(selectedType);

/* The starting palette belongs to the starting gradient. Reading it from the
   library rather than hard-coding four hexes in `state` is what lets the count
   differ per type without the panel and the builder disagreeing. */
(function initColors() {
  const preset = GRADIENT_LIBRARY.find(g => g.id === selectedType);
  if (preset && preset.defaultColors && preset.defaultColors.length) {
    state.colors = [...preset.defaultColors];
  }
  renderColorSlots(selectedType);
  paintInspectorPreview();
})();

const backToBrowseBtn = document.getElementById('back-to-browse-btn');

// ── TABS NAVIGATION ──
const tabBrowse = document.getElementById('tab-browse');
const tabEdit = document.getElementById('tab-edit');
const tabFluid = document.getElementById('tab-fluid');
const viewBrowse = document.getElementById('browser-view');
const viewEdit = document.getElementById('inspector-panel');
const viewFluid = document.getElementById('fluid-view');

if (backToBrowseBtn) {
  backToBrowseBtn.addEventListener('click', () => {
    if (tabBrowse) tabBrowse.click();
  });
}

// Global reference for LiquidEther
window.liquidEtherInst = null;
let liquidPollInterval = null;

if (tabBrowse && tabEdit) {
  function switchTab(activeTab, activeView) {
    /* Query rather than name the three we happened to have. boot.js adds a
       fourth tab at run time, and a switchTab that only knows about the
       original three leaves it stuck on while another view is showing. */
    document.querySelectorAll(".tab-btn").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".view-panel").forEach(v => v.classList.remove("active"));
    
    if (activeTab) activeTab.classList.add('active');
    if (activeView) activeView.classList.add('active');

    // Manage Liquid Ether polling
    if (activeView === viewFluid) {
       if (!window.liquidEtherInst) {
          const wrap = document.getElementById('sim-wrap');
          if (wrap && typeof LiquidEther !== 'undefined') {
             window.liquidEtherInst = new LiquidEther(wrap);
             window.liquidEtherInst.start();
          }
       }
       if (!liquidPollInterval && lgHostReady()) {
          const cs = new CSInterface();
          liquidPollInterval = setInterval(() => {
             cs.evalScript('getLayerInfo()', (res) => {
                if (!res || res === "undefined") return;
                try {
                   const data = JSON.parse(res);
                   if (data.error) {
                      window.liquidEtherInst.clearLayerInput();
                   } else {
                      window.liquidEtherInst.setLayerInput(data.nx, data.ny, data.width, data.height);
                   }
                } catch(e) {}
             });
          }, 1000 / 30); // ~30fps tracking
       }
    } else {
       if (liquidPollInterval) {
          clearInterval(liquidPollInterval);
          liquidPollInterval = null;
       }
       if (window.liquidEtherInst) {
          window.liquidEtherInst.clearLayerInput();
       }
    }
  }

  /* boot.js adds the Presets tab after this file has run, so it needs a way
     to reach the same switcher rather than reimplementing it. */
  window.lgSwitchTab = switchTab;

  tabBrowse.addEventListener('click', () => switchTab(tabBrowse, viewBrowse));
  tabEdit.addEventListener('click', () => switchTab(tabEdit, viewEdit));
  if (tabFluid) {
    tabFluid.addEventListener('click', () => switchTab(tabFluid, viewFluid));
  }
}

// ── TWO-WAY SYNC POLLING ──
/* This poller reads the selected layer every 400ms and mirrors it into the
   inspector. Two things made it fight the user for the panel.

   The state it compares is the JSON stamped on the layer, and a live update
   rewrites that JSON on every slider move. So the poller saw "the layer
   changed", tore down the controls and built new ones — while the pointer was
   still holding one of them. That is the jumpiness: the element being dragged
   stops existing halfway through the drag.

   Two guards. `inspectorBusy` says hands off while the user is actually
   touching something, and `lastSentState` lets the poller recognise its own
   echo. On top of that the controls are only rebuilt when the gradient *type*
   changes; a change of values now writes into the existing inputs instead of
   replacing them. */
let lastGradientState = '';
let lastRenderedType = null;

let inspectorBusy = false;
let inspectorIdleTimer = null;

function markInspectorBusy() {
  inspectorBusy = true;
  if (inspectorIdleTimer) clearTimeout(inspectorIdleTimer);
}

function markInspectorIdle(delay) {
  if (inspectorIdleTimer) clearTimeout(inspectorIdleTimer);
  inspectorIdleTimer = setTimeout(() => {
    inspectorIdleTimer = null;
    inspectorBusy = false;
  }, delay || 700);
}

['pointerdown', 'focusin', 'keydown'].forEach(evt =>
  viewEdit.addEventListener(evt, markInspectorBusy));
['pointerup', 'pointercancel', 'focusout', 'keyup'].forEach(evt =>
  viewEdit.addEventListener(evt, () => markInspectorIdle()));

/* Push polled values into the controls that are already on screen. Replacing
   the inputs is what broke dragging, so nothing here creates an element. */
function applyPolledControls(controls) {
  if (!controls) return;
  Object.keys(controls).forEach(key => {
    const el = document.getElementById('ctrl-' + key);
    if (!el || el === document.activeElement) return;
    el.value = controls[key];
    if (el.type === 'range') {
      if (typeof paintRange === 'function') paintRange(el);
      const num = document.getElementById('num-' + key);
      if (num && num !== document.activeElement) num.value = el.value;
    }
  });
}

/* How long the poller stays quiet after we write. Comfortably longer than a
   round trip to After Effects, short enough that a real edit made in AE still
   shows up promptly. */
const LIVE_ECHO_QUIET_MS = 1500;

setInterval(() => {
  if (!lgHostReady()) return;
  if (inspectorBusy || liveInFlight || livePending) return;

  /* The seizure.

     Dragging a slider writes to AE continuously. This poller reads the layer
     back and pushes what it finds into the controls. The `lastSentState`
     guard below was meant to catch our own echo, but it compares our payload
     string against the JSON the layer carries, and those are never byte
     identical — different key order, different number formatting, fields the
     layer does not store. So the guard never fired, every read looked like an
     external edit, and the poller kept slamming stale values back into the
     slider the user was still holding. The slider fought the pointer, and the
     shaking fed itself.

     Comparing strings was never going to work. Time does: for a moment after
     we write, anything read back is our own echo by definition, so do not
     read at all. */
  if (Date.now() - lastLiveSentAt < LIVE_ECHO_QUIET_MS) return;
  const cs = new CSInterface();
  cs.evalScript('getSelectedGradientState()', (result) => {
    if (inspectorBusy) return;
    if (result === lastSentState) return;      // our own echo, not a real change
    if (result && result !== 'undefined' && result !== '' && result !== lastGradientState) {
      lastGradientState = result;
      try {
        const stateObj = JSON.parse(result);
        if (stateObj.type) {
          const typeChanged = stateObj.type !== lastRenderedType;
          selectedType = stateObj.type;
          
          if (stateObj.colors && stateObj.colors.length) {
            /* These belong to the layer the user selected in AE, so they are
               not a custom palette to protect — browsing away from here should
               load the next gradient's own colours. */
            state.colors = [...stateObj.colors];
            paletteIsCustom = false;
            if (typeChanged) renderColorSlots(selectedType);
            else paintColorSlots();
            paintPreviewVars();
          }

          /* Only a different gradient needs a different set of controls.
             Rebuilding them for a value change is what threw the drag away. */
          if (typeChanged) {
            renderControls(selectedType);
            lastRenderedType = selectedType;
            paintInspectorPreview();
          }

          // Update UI title and class based on library preset
          const preset = GRADIENT_LIBRARY.find(p => p.id === selectedType);
          if (preset) {
             if (inspectorTitle) inspectorTitle.textContent = preset.label;
             if (inspectorPreviewMini) inspectorPreviewMini.className = 'inspector-preview-mini ' + preset.cssClass;
          } else {
             if (inspectorTitle) inspectorTitle.textContent = 'Editing Gradient';
          }

          // Set control values
          if (stateObj.controls) {
            if (typeChanged) {
              // renderControls has just replaced the DOM; let it settle first.
              setTimeout(() => applyPolledControls(stateObj.controls), 50);
            } else {
              applyPolledControls(stateObj.controls);
            }
          }

          // Switch to Edit tab — only when the selection genuinely changed.
          if (typeChanged && !tabEdit.classList.contains('active')) {
             tabEdit.click();
             const dot = document.getElementById('edit-indicator');
             if (dot) {
               dot.classList.add('visible');
               setTimeout(() => dot.classList.remove('visible'), 2000);
             }
          }
        }
      } catch(e) { console.error('Parse err:', e); }
    } else if (result === '' && lastGradientState !== '') {
      lastGradientState = '';
      if (inspectorTitle) inspectorTitle.textContent = 'No Layer Selected';
    }
  });
}, 400);

// ── ACCORDION BEHAVIOR ──
/* The wrapper is built once, at load, from the section's element children.
   Building it on the first click - and dragging the whitespace text nodes
   along with it - is what made the first collapse reflow the inspector. */
document.querySelectorAll('.section-header').forEach(header => {
  const section = header.parentElement;
  if (!section) return;

  header.style.cursor = 'pointer';
  header.style.userSelect = 'none';
  header.style.position = 'relative';

  const arrow = document.createElement('span');
  arrow.innerHTML = '&#9660;';
  arrow.style.position = 'absolute';
  arrow.style.right = '0';
  arrow.style.fontSize = '9px';
  arrow.style.transition = 'transform 0.2s';
  header.appendChild(arrow);

  let content = null;
  for (let i = 0; i < section.children.length; i++) {
    if (section.children[i].classList.contains('section-content')) {
      content = section.children[i];
      break;
    }
  }
  if (!content) {
    content = document.createElement('div');
    content.className = 'section-content';
    Array.prototype.slice.call(section.children).forEach(child => {
      if (child !== header) content.appendChild(child);
    });
    section.appendChild(content);
  }

  /* Only the chevron is set from here. The panel's height is animated in CSS
     off the `collapsed` class, so nothing writes an inline display. */
  const paint = () => {
    const collapsed = section.classList.contains('collapsed');
    arrow.style.transform = collapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
  };
  paint();

  header.addEventListener('click', () => {
    section.classList.toggle('collapsed');
    paint();
  });
});

// ── BIND CONTROLS TO REALTIME ──
/* This used to test for a `.slider` class that nothing in the panel has ever
   carried, so the global sliders and the toggles pushed nothing to After
   Effects at all. Match the classes that actually exist, and listen for
   `change` too so selects and checkboxes count.

   renderControls also calls triggerRealtimeUpdate directly for the per-type
   sliders, so a drag can raise both; the debounce inside it collapses them
   into one trip. */
const LIVE_CLASSES = ['ctrl-range', 'ctrl-num', 'custom-select', 'custom-input', 'color-pick'];

function isLiveControl(el) {
  if (!el || !el.classList) return false;
  if (el.type === 'checkbox') return true;
  return LIVE_CLASSES.some(cls => el.classList.contains(cls));
}

['input', 'change'].forEach(evt => {
  viewEdit.addEventListener(evt, (e) => {
    if (!isLiveControl(e.target)) return;
    if (typeof window.triggerRealtimeUpdate === 'function') window.triggerRealtimeUpdate();
  });
});


// ── GLOBAL CONTROLS (GRAIN) ──

/* Two-way bind a range input to a number field and keep the track fill in
   sync. The per-type controls get this from renderControls; these two live
   in static markup, so they wire it here. */
function bindRangeAndNumber(rangeId, numId) {
  const range = document.getElementById(rangeId);
  const num = document.getElementById(numId);
  if (!range) return;
  if (typeof paintRange === 'function') paintRange(range);
  if (!num) return;

  const lo = parseFloat(range.min), hi = parseFloat(range.max);
  range.addEventListener('input', () => {
    num.value = range.value;
    if (typeof paintRange === 'function') paintRange(range);
  });
  num.addEventListener('input', () => {
    const v = parseFloat(num.value);
    if (isNaN(v)) return;
    range.value = Math.min(hi, Math.max(lo, v));
    if (typeof paintRange === 'function') paintRange(range);
  });
  num.addEventListener('blur', () => {
    let v = parseFloat(num.value);
    if (isNaN(v)) v = lo;
    v = Math.min(hi, Math.max(lo, v));
    range.value = v;
    num.value = v;
    if (typeof paintRange === 'function') paintRange(range);
  });
}

bindRangeAndNumber('grain-slider', 'num-grain');
bindRangeAndNumber('glow-slider', 'num-glow');


const posterizeToggle = document.getElementById('posterize-toggle');
const posterizeRow = document.getElementById('posterize-input-row');
if (posterizeToggle && posterizeRow) {
  posterizeToggle.addEventListener('change', (e) => {
    posterizeRow.style.display = e.target.checked ? 'flex' : 'none';
  });
}


/* ── Fluid trail ─────────────────────────────────────────────────────
   Tracking is gone. It and the fluid trail were the same feature wearing two
   names — pick a layer, make the gradient react to it — and keeping both
   meant two target pickers, two sets of physics, and no way for a user to
   tell which one they wanted. */

const fluidToggle = document.getElementById('fluid-toggle');
const fluidSettings = document.getElementById('fluid-settings');
if (fluidToggle && fluidSettings) {
  const syncFluid = () => {
    fluidSettings.classList.toggle('visible', fluidToggle.checked);
    if (fluidToggle.checked) refreshFluidLayers();
  };
  fluidToggle.addEventListener('change', () => {
    syncFluid();
    if (typeof window.triggerRealtimeUpdate === 'function') window.triggerRealtimeUpdate();
  });
  syncFluid();
}

const FLUID_PARAMS = ['fluidLength', 'fluidThickness', 'fluidWobble',
                      'fluidSoftness', 'fluidSize'];

/* Same binding the per-type sliders get from renderControls, including the
   push to After Effects on every move — without that last part the sliders
   only did something when the gradient was re-applied. */
FLUID_PARAMS.forEach(id => {
  const range = document.getElementById('ctrl-' + id);
  const num = document.getElementById('num-' + id);
  if (!range) return;
  if (typeof paintRange === 'function') paintRange(range);

  const push = () => {
    if (typeof paintRange === 'function') paintRange(range);
    if (typeof window.triggerRealtimeUpdate === 'function') window.triggerRealtimeUpdate();
  };

  range.addEventListener('input', () => { if (num) num.value = range.value; push(); });
  if (!num) return;
  num.addEventListener('input', () => {
    const v = parseFloat(num.value);
    if (isNaN(v)) return;
    range.value = Math.min(parseFloat(range.max), Math.max(parseFloat(range.min), v));
    push();
  });
  num.addEventListener('blur', () => {
    let v = parseFloat(num.value);
    if (isNaN(v)) v = parseFloat(range.defaultValue);
    v = Math.min(parseFloat(range.max), Math.max(parseFloat(range.min), v));
    range.value = v;
    num.value = v;
    push();
  });
});

function fluidValue(id, fallback) {
  const el = document.getElementById('ctrl-' + id);
  const v = el ? parseFloat(el.value) : NaN;
  return isNaN(v) ? fallback : v;
}

function getFluidParams() {
  return {
    fluidEnabled: document.getElementById('fluid-toggle')?.checked || false,
    fluidLayerName: document.getElementById('fluid-layer-select')?.value || '',
    fluid: {
      length:    fluidValue('fluidLength', 60),
      thickness: fluidValue('fluidThickness', 100),
      wobble:    fluidValue('fluidWobble', 45),
      softness:  fluidValue('fluidSoftness', 25),
      size:      fluidValue('fluidSize', 7.5)
    }
  };
}

const refreshLayersBtn = document.getElementById('refresh-layers-btn');
if (refreshLayersBtn) {
  refreshLayersBtn.addEventListener('click', refreshFluidLayers);
}

function refreshFluidLayers() {
  if (lgHostReady()) {
    const cs = new CSInterface();
    cs.evalScript('getCompLayers()', function(result) {
      const select = document.getElementById('fluid-layer-select');
      if (!select) return;
      
      // Save current selection
      const currentVal = select.value;
      
      // Clear options except placeholder
      while (select.options.length > 1) {
        select.remove(1);
      }
      
      if (result && result !== 'undefined' && result.indexOf('ERROR') === -1) {
        try {
          const layers = JSON.parse(result);
          layers.forEach(layer => {
            const opt = document.createElement('option');
            opt.value = layer;
            opt.textContent = layer;
            select.appendChild(opt);
          });
          
          // Restore selection if it still exists
          if (layers.includes(currentVal)) {
            select.value = currentVal;
          }
        } catch(e) {
          console.error('Failed to parse layers', e);
        }
      }
    });
  }
}

// ── IMPORT PALETTE MODAL ──
const importModal = document.getElementById('import-modal');
const importBtn = document.getElementById('import-palette-btn');
const closeImportBtn = document.getElementById('close-import-btn');
const applyImportBtn = document.getElementById('apply-import-btn');
const importText = document.getElementById('import-text');

if (importBtn && importModal) {
  importBtn.addEventListener('click', () => {
    importModal.classList.add('active');
    importText.value = '';
    importText.focus();
  });
  closeImportBtn.addEventListener('click', () => importModal.classList.remove('active'));
  applyImportBtn.addEventListener('click', () => {
    const text = importText.value;
    const hexRegex = /#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})\b/g;
    const matches = text.match(hexRegex);
    if (matches && matches.length > 0) {
      for (let i = 0; i < 4; i++) {
        if (matches[i]) {
          let hex = matches[i].toUpperCase();
          if (!hex.startsWith('#')) hex = '#' + hex;
          if (hex.length === 4) { // Convert #RGB to #RRGGBB
            hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
          }
          state.colors[i] = hex;
        }
      }
      document.querySelectorAll('.color-pick').forEach((p, i) => p.style.backgroundColor = state.colors[i]);
      triggerColorUpdate();
      importModal.classList.remove('active');
    } else {
      LGUI.toast("No hex codes in that text. Paste something like #FF6B35, #FF3366 — or a Coolors URL.", "error");
    }
  });
}

// ── EYEDROPPER ──
/* Chromium's EyeDropper FIRST, the host second. The order used to be the other
   way round, which meant that inside After Effects — the only place this panel
   ever runs — the eyedropper button opened a colour dialog instead of sampling
   a pixel. The two are not the same tool: EyeDropper reads a colour from
   anywhere on screen in one click, which is the whole point of the button, and
   a picker is a dialog that happens to return a colour.

   The host picker is still the fallback, because EyeDropper needs Chromium 95
   and older builds of After Effects ship less than that — and it does at least
   carry an eyedropper of its own inside the dialog. */
const eyeBtn = document.getElementById('eyedropper-btn');
if (eyeBtn) {
  function adoptSampledColour(hex) {
    const clean = LGPicker.parseHex(hex);
    if (!clean) return;
    const value = LGPicker.toHex(clean);
    // Shift right, newest first — the sampled colour becomes Colour 1.
    state.colors.unshift(value);
    state.colors.pop();
    paletteIsCustom = true;
    LGPicker.remember(value);
    paintColorSlots();
    triggerColorUpdate();
    if (typeof window.triggerRealtimeUpdate === 'function') window.triggerRealtimeUpdate();
  }

  eyeBtn.addEventListener('click', async () => {
    if (window.EyeDropper) {
      try {
        const result = await new EyeDropper().open();
        adoptSampledColour(result.sRGBHex);
      } catch (e) {
        /* Cancelled. Not an error and not worth a toast. */
      }
      return;
    }

    if (lgHostReady()) {
      new CSInterface().evalScript(`openNativeColorPicker('${state.colors[0] || '#FFFFFF'}')`,
        function (res) { if (res && res !== '-1') adoptSampledColour(res); });
      return;
    }

    LGUI.toast('This build of After Effects has no screen eyedropper. ' +
               'Click a swatch and type a hex instead.', 'error');
  });
}

// ── EXPORT CSS & SVG ──
/* Copy, then say so — in that order, and only if it worked.

   Both buttons used to fire navigator.clipboard.writeText() and change their
   own label on the next line without waiting for it. writeText returns a
   promise and it does reject: the Clipboard API needs the document focused,
   and a CEP panel loses focus to the application constantly — clicking into
   the comp, a modal opening, the panel being docked but not frontmost. Every
   one of those produced a button that said "Copied CSS!" over an unchanged
   clipboard, which is the one failure a user cannot see.

   The fallback is the old execCommand path. It is deprecated and it still
   works everywhere this panel runs, and between a deprecated copy and no copy
   the deprecated one is better. */
function lgCopyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(function () {
      return lgCopyFallback(text);
    });
  }
  return lgCopyFallback(text);
}

function lgCopyFallback(text) {
  return new Promise(function (resolve, reject) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    ok ? resolve() : reject(new Error('copy failed'));
  });
}

/* The button says what happened, and puts its own label back either way. */
function lgCopyButton(btn, text, done) {
  const original = btn.textContent;
  lgCopyToClipboard(text).then(function () {
    btn.textContent = done;
  }, function () {
    btn.textContent = 'Copy failed';
    LGUI.toast('After Effects would not let the panel reach the clipboard. ' +
               'Click inside the panel and try again.', 'error');
  }).then(function () {
    setTimeout(function () { btn.textContent = original; }, 2000);
  });
}

document.getElementById('export-css-btn')?.addEventListener('click', function () {
  const css = `background: linear-gradient(135deg, ${state.colors.join(', ')});`;
  lgCopyButton(this, css, 'Copied CSS!');
});

document.getElementById('export-svg-btn')?.addEventListener('click', function () {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
  <defs>
    <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%">
      ${state.colors.map((c, i) => {
        const at = state.colors.length > 1 ? (i / (state.colors.length - 1)) * 100 : 0;
        return `<stop offset="${at.toFixed(0)}%" stop-color="${c}" />`;
      }).join('')}
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#lg)" />
</svg>`;
  lgCopyButton(this, svg, 'Copied SVG!');
});

// Force load main.jsx to bypass AE manifest cache without restarting!
try {
  if (lgHostReady()) {
    const cs = new CSInterface();
    const extPath = cs.getSystemPath("extension").replace(/\\/g, '/');
    cs.evalScript('$.evalFile("' + extPath + '/jsx/main.jsx")');
  }
} catch (e) {
  console.error("Failed to evalFile main.jsx:", e);
}

// ── COLOUR PICKER ──
/* Delegated from the row rather than bound to each swatch: the swatches are
   rebuilt every time the gradient changes, and per-element listeners would go
   with them.

   INSIDE AFTER EFFECTS, THE PICKER IS AFTER EFFECTS'. A swatch opens the
   host's own colour picker — the current one, with the eyedropper, the colour
   fields and the project's working space — because that is the picker every
   other colour in the application uses, and a panel that invents its own asks
   the user to learn a second one for no gain. openNativeColorPicker() in
   jsx/main.jsx is how, and its header explains why that stopped being
   dangerous.

   The panel's own HTML picker is still here and still shipped. It runs when
   there is no host at all, which is a plain browser — the only place the panel
   is ever developed. See js/colorpicker.js.

   WHAT THE SWAP COSTS. The host dialog is modal, so the comp cannot follow the
   drag any more: one colour arrives when the dialog closes instead of a
   continuous stream while the pointer moves. The live path underneath is
   unchanged, so a colour that arrives this way still updates the comp without
   a rebuild — it just arrives once. */
const colorRowEl = document.getElementById('color-row');
if (colorRowEl) {

  /* One place where a picked colour lands, whichever picker produced it. */
  function adoptPickedColour(i, hex, live) {
    const rgb = LGPicker.parseHex(hex);
    if (!rgb) return;
    state.colors[i] = LGPicker.toHex(rgb);
    paletteIsCustom = true;
    const c = colorRowEl.querySelector('.color-pick[data-index="' + i + '"]');
    if (c) c.style.backgroundColor = state.colors[i];
    const f = colorRowEl.querySelector('.color-hex[data-index="' + i + '"]');
    if (f && f !== document.activeElement) f.value = state.colors[i];
    if (!live) paintColorSlots();
    triggerColorUpdate();
    if (typeof window.triggerRealtimeUpdate === 'function') window.triggerRealtimeUpdate();
  }

  /* The host's picker. evalScript is asynchronous from this side, and the
     dialog is modal on the other, so the callback fires whenever the user is
     done — seconds later is normal and is not a hang.

     Cancel is not distinguishable from picking the colour it opened on: the
     dialog does not say which button closed it. Both come back as the starting
     colour, so both leave the swatch where it was, which is what cancel should
     do anyway. */
  function openHostPickerFor(i) {
    const before = state.colors[i] || '#FFFFFF';
    const chip = colorRowEl.querySelector('.color-pick[data-index="' + i + '"]');
    if (chip) chip.classList.add('is-picking');

    new CSInterface().evalScript(
      "openNativeColorPicker('" + before + "')",
      function (res) {
        if (chip) chip.classList.remove('is-picking');
        if (!res || res === '-1' || res === 'EvalScript error.' || res === 'undefined') return;
        if (res.toUpperCase() === before.toUpperCase()) return;
        adoptPickedColour(i, res, false);
        LGPicker.remember(state.colors[i]);
      }
    );
  }

  function openPickerFor(i) {
    if (lgHostReady()) { openHostPickerFor(i); return; }
    openPanelPickerFor(i);
  }

  function openPanelPickerFor(i) {
    const chip = colorRowEl.querySelector('.color-pick[data-index="' + i + '"]');
    if (!chip) return;
    const roles = (typeof colorRolesFor === 'function')
      ? colorRolesFor(selectedType) : [];

    LGPicker.open({
      anchor: chip,
      hex: state.colors[i],
      index: i,
      label: (roles && roles[i]) || ('Colour ' + (i + 1)),
      palette: state.colors.slice(0),
      roles: roles || [],

      /* Continuous. Everything downstream of here is already coalesced —
         triggerColorUpdate repaints the previews and sends updateLiveColors,
         and triggerRealtimeUpdate keeps at most one evalScript in flight — so
         firing on every pointer move makes the comp track the drag instead of
         queueing behind it. */
      onChange: function (hex) { adoptPickedColour(i, hex, true); },

      onCommit: function (hex) {
        state.colors[i] = hex;
        paintColorSlots();
      },

      /* Clicking another role in the picker's own palette column moves to that
         slot rather than closing — picking a four-colour palette is one task,
         not four. */
      onSlot: function (next) { openPanelPickerFor(next); }
    });
  }

  colorRowEl.addEventListener('click', function (e) {
    const picker = e.target.closest('.color-pick');
    if (!picker) return;
    e.preventDefault();
    const i = parseInt(picker.dataset.index, 10);
    if (isNaN(i)) return;
    openPickerFor(i);
  });

  /* Typing a hex is often faster than opening the host's picker, and it is the
     only way to paste a value from somewhere else. */
  colorRowEl.addEventListener('input', function (e) {
    const field = e.target.closest('.color-hex');
    if (!field) return;
    const i = parseInt(field.dataset.index, 10);
    if (isNaN(i)) return;

    /* One hex parser for the panel, in js/colorpicker.js. It also accepts the
       three-digit form, which is what people paste out of CSS. Anything it
       cannot read is treated as mid-typing rather than corrected — "#F" is an
       unfinished thought, not an error. */
    const rgb = LGPicker.parseHex(field.value);
    if (!rgb) return;

    state.colors[i] = LGPicker.toHex(rgb);
    const chip = colorRowEl.querySelector('.color-pick[data-index="' + i + '"]');
    if (chip) chip.style.backgroundColor = state.colors[i];
    triggerColorUpdate();
    if (typeof window.triggerRealtimeUpdate === 'function') window.triggerRealtimeUpdate();
  });

  // Snap a half-typed hex back to the real value when focus leaves.
  colorRowEl.addEventListener('focusout', function (e) {
    const field = e.target.closest('.color-hex');
    if (!field) return;
    const i = parseInt(field.dataset.index, 10);
    if (!isNaN(i)) field.value = (state.colors[i] || '').toUpperCase();
  });
}

// ── EXTRACT FROM IMAGE ──
const uploadImageBtn = document.getElementById('upload-image-btn');
const imageUploadInput = document.getElementById('image-upload');

if (uploadImageBtn && imageUploadInput) {
  uploadImageBtn.addEventListener('click', () => imageUploadInput.click());

  imageUploadInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
      const img = new Image();
      img.onload = function () {
        extractColorsFromImage(img);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be uploaded again if needed
    e.target.value = '';
  });
}

function extractColorsFromImage(img) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Scale down for fast processing
  const maxDim = 50;
  let w = img.width, h = img.height;
  if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
  else { w = Math.round(w * maxDim / h); h = maxDim; }

  if (w === 0 || h === 0) return;

  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);

  const data = ctx.getImageData(0, 0, w, h).data;
  const buckets = {};

  // Bin colors to find distinct dominant groups
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) continue; // skip transparent
    let r = Math.round(data[i] / 32) * 32;
    let g = Math.round(data[i + 1] / 32) * 32;
    let b = Math.round(data[i + 2] / 32) * 32;
    if (r > 255) r = 255; if (g > 255) g = 255; if (b > 255) b = 255;
    const key = r + ',' + g + ',' + b;
    if (!buckets[key]) buckets[key] = { r, g, b, count: 0 };
    buckets[key].count++;
  }

  const sorted = Object.values(buckets).sort((a, b) => b.count - a.count);
  let picked = [];

  // Pick up to 4 visually distinct prominent colors
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    let distinct = true;
    for (let p of picked) {
      const dist = Math.abs(c.r - p.r) + Math.abs(c.g - p.g) + Math.abs(c.b - p.b);
      if (dist < 60) { distinct = false; break; }
    }
    if (distinct) {
      picked.push(c);
      if (picked.length === 4) break;
    }
  }

  // Fallback if less than 4 distinct colors found
  while (picked.length < 4) {
    if (sorted[picked.length]) picked.push(sorted[picked.length]);
    else picked.push({ r: 255, g: 255, b: 255 });
  }

  // Apply to UI
  const extracted = [];
  for (let i = 0; i < picked.length; i++) {
    const rStr = picked[i].r.toString(16).padStart(2, '0');
    const gStr = picked[i].g.toString(16).padStart(2, '0');
    const bStr = picked[i].b.toString(16).padStart(2, '0');
    extracted.push('#' + (rStr + gStr + bStr).toUpperCase());
  }
  setColors(extracted);
}

// ── SHUFFLE ──
document.getElementById('shuffle-btn').addEventListener('click', function () {
  const shuffled = state.colors.map(() =>
    '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0').toUpperCase());
  setColors(shuffled);
});

// ── MOOD PRESETS ──
document.getElementById('mood-select').addEventListener('change', function () {
  const mood = this.value;
  if (!mood || !MOODS[mood]) return;

  setColors(MOODS[mood]);

  // Reset select
  setTimeout(() => { this.value = ''; }, 100);
});

/* Serialise an argument for evalScript.
   JSON.stringify twice: the inner pass encodes the payload, the outer pass
   produces a correctly quoted and escaped ExtendScript string literal.
   Hand-escaping quotes broke on any payload containing a newline. */
function esArg(value) {
  return JSON.stringify(JSON.stringify(value));
}

// ── GENERATE ──
document.getElementById('generate-btn').addEventListener('click', function () {
  const btn = this;
  const statusEl = document.getElementById('generate-status');

  const params = {
    type: selectedType,
    colors: state.colors,
    controls: getControlValues(selectedType),
    grain: parseFloat(document.getElementById('grain-slider')?.value) || 0,
    glow: parseFloat(document.getElementById('glow-slider')?.value) || 0,
    posterize: document.getElementById('posterize-toggle')?.checked || false,
    posterizeFps: parseFloat(document.getElementById('posterize-fps')?.value) || 12,
    ...getFluidParams()
  };

  btn.disabled = true;
  setStatus(statusEl, 'Sending to After Effects…', '');

  try {
    if (lgHostReady()) {
      const cs = new CSInterface();
      cs.evalScript(`generateGradient(${esArg(params)})`, function (result) {
        btn.disabled = false;
        if (result === 'EvalScript error.' || result === 'undefined') {
          setStatus(statusEl, '✕ Error in After Effects. Check the JSX.', 'error');
        } else if (result && result.indexOf('ERROR') !== -1) {
          setStatus(statusEl, '✕ ' + result.replace('ERROR:', '').trim(), 'error');
        } else if (result && result.indexOf('warning') !== -1) {
          // Built, but some effects or properties could not be applied.
          const [done, detail] = result.split(' | ');
          setStatus(statusEl, '⚠ ' + done + ' — ' + detail, 'warn');
          console.warn('[Living Gradients]', detail);
        } else {
          setStatus(statusEl, '✓ ' + (result || 'Gradient created!'), 'success');
        }
      });
    } else {
      // Dev/browser mode
      console.log('GENERATE PARAMS:', params);
      setTimeout(() => {
        btn.disabled = false;
        setStatus(statusEl, '✓ [Dev mode] Params logged to console.', 'success');
      }, 600);
    }
  } catch (e) {
    btn.disabled = false;
    setStatus(statusEl, '✕ Could not reach After Effects.', 'error');
  }
});

/* Two status lines share this (the generate footer and the batch toolbar),
   so remember each element's base class instead of hard-coding one. */
function setStatus(el, msg, type) {
  if (!el) return;
  if (!el.dataset.baseClass) el.dataset.baseClass = el.className.split(' ')[0];
  el.textContent = msg;
  el.className = el.dataset.baseClass + (type ? ' ' + type : '');
}

// ── REALTIME ──
/* Dragging a slider fires `input` on every pixel of travel. Sending each one
   straight down evalScript queues them faster than After Effects can drain
   the queue, and the comp ends up seconds behind the pointer - which is what
   "the changes aren't real time" actually was.

   So: coalesce. At most one call is in flight; while it is, only the newest
   parameter set is remembered, and it goes out the moment the previous call
   returns. The comp tracks the slider instead of replaying it. */
let liveInFlight = false;
let livePending = false;
let liveTimer = null;
/* Exactly what the JSX stamps onto the layer, so the sync poller can tell our
   own write apart from a real edit made in After Effects. */
let lastSentState = '';
/* When we last wrote to After Effects. The poller below refuses to read back
   for a moment afterwards — see the comment there. */
let lastLiveSentAt = 0;

function collectLiveParams() {
  return {
    type: selectedType,
    colors: state.colors,
    controls: getControlValues(selectedType),
    grain: parseFloat(document.getElementById('grain-slider')?.value) || 0,
    glow: parseFloat(document.getElementById('glow-slider')?.value) || 0,
    posterize: document.getElementById('posterize-toggle')?.checked || false,
    posterizeFps: parseFloat(document.getElementById('posterize-fps')?.value) || 12,
    ...getFluidParams()
  };
}

function sendLiveUpdate() {
  if (!lgHostReady()) {
    console.log('LIVE PARAMS:', collectLiveParams());
    return;
  }
  if (liveInFlight) { livePending = true; return; }

  liveInFlight = true;
  const payload = collectLiveParams();
  lastSentState = JSON.stringify(payload);
  lastLiveSentAt = Date.now();
  new CSInterface().evalScript(`updateGradientLive(${esArg(payload)})`, function () {
    liveInFlight = false;
    if (livePending) { livePending = false; sendLiveUpdate(); }
  });
}

window.triggerRealtimeUpdate = function () {
  if (liveTimer) clearTimeout(liveTimer);
  liveTimer = setTimeout(() => { liveTimer = null; sendLiveUpdate(); }, 60);
};

// ── REALTIME: COLORS ──
/* The card previews are CSS and always want four stops. A palette with fewer
   cycles to fill them rather than leaving a variable undefined, which would
   render the preview transparent. */
function paintPreviewVars() {
  const c = state.colors;
  if (!c.length) return;
  for (let i = 0; i < 4; i++) {
    document.documentElement.style.setProperty('--c' + (i + 1), c[i % c.length]);
  }
}

/* The inspector's own preview, which follows the live palette rather than the
   library defaults the cards show. */
function paintInspectorPreview() {
  const cv = document.getElementById('inspector-preview');
  if (cv && typeof paintPreview === 'function') {
    /* live: this one follows the swatches, so it must stay painted. The card
       renders in css/previews are of each gradient's default palette. */
    paintPreview(cv, selectedType, state.colors, { live: true });
  }
}

function triggerColorUpdate() {
  paintPreviewVars();
  paintInspectorPreview();

  if (lgHostReady()) {
    const cs = new CSInterface();
    cs.evalScript(`updateLiveColors(${esArg(state.colors)})`);
  }
}

// Initialize preview colors on load
triggerColorUpdate();


