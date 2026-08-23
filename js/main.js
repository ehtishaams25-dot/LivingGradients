/* ============================================
   MAIN.JS — UI Logic & AE Bridge
   ============================================ */

// ── STATE ──
let selectedType = 'living';
const state = {
  colors: ['#FF6B35', '#FF3366', '#CC00FF', '#0033FF']
};

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

// ── CUSTOM PRESET STORAGE ──
// Uses localStorage in browser/CEP panel. Persists across sessions.
const PRESET_STORAGE_KEY = 'livingGradients_colorPresets';

function loadCustomPresets() {
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function saveCustomPresets(presets) {
  try { localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets)); } catch (e) { }
}

function refreshPresetDropdown() {
  const select = document.getElementById('custom-preset-select');
  if (!select) return;
  const presets = loadCustomPresets();
  // Clear all but the first placeholder
  while (select.options.length > 1) select.remove(1);
  Object.keys(presets).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
}

// Init presets dropdown on load
refreshPresetDropdown();

// ── SAVE PRESET ──
document.getElementById('save-preset-btn').addEventListener('click', function () {
  const nameInput = document.getElementById('preset-name-input');
  const name = (nameInput.value || '').trim();
  if (!name) { alert('Enter a preset name first.'); return; }

  const presets = loadCustomPresets();
  presets[name] = state.colors.slice(); // Save current 4 colors
  saveCustomPresets(presets);
  refreshPresetDropdown();

  // Select the newly saved item
  const select = document.getElementById('custom-preset-select');
  select.value = name;
  nameInput.value = '';
});

// ── LOAD PRESET ──
document.getElementById('load-preset-btn').addEventListener('click', function () {
  const select = document.getElementById('custom-preset-select');
  const name = select.value;
  if (!name) { alert('Select a preset to load.'); return; }

  const presets = loadCustomPresets();
  const colors = presets[name];
  if (!colors) { alert('Preset not found.'); return; }

  const pickers = document.querySelectorAll('.color-pick');
  pickers.forEach((p, i) => {
    p.value = colors[i] || colors[0];
    state.colors[i] = colors[i] || colors[0];
  });

  // Live update to AE
  triggerColorUpdate();
});

// ── DELETE PRESET ──
document.getElementById('delete-preset-btn').addEventListener('click', function () {
  const select = document.getElementById('custom-preset-select');
  const name = select.value;
  if (!name) { alert('Select a preset to delete.'); return; }

  if (!confirm('Delete preset "' + name + '"?')) return;

  const presets = loadCustomPresets();
  delete presets[name];
  saveCustomPresets(presets);
  refreshPresetDropdown();
});

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
        <div class="card-preview ${preset.cssClass}"></div>
        <span class="card-label">${preset.label}</span>
        <span class="batch-tick">✓</span>
      `;

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

        if (preset.defaultColors && preset.defaultColors.length === 4) {
          state.colors = [...preset.defaultColors];
          document.querySelectorAll('.color-pick').forEach((p, i) => {
            p.style.backgroundColor = state.colors[i];
          });
          if (typeof triggerColorUpdate === 'function') {
            triggerColorUpdate();
          }
        }

        if (inspectorPanel) {
          if (inspectorTitle) inspectorTitle.textContent = preset.label;
          if (inspectorPreviewMini) {
            inspectorPreviewMini.className = 'inspector-preview-mini ' + preset.cssClass;
          }
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
      colorQuality: document.getElementById('color-quality-toggle')?.checked !== false,
    bpmSync:  document.getElementById('bpm-sync-toggle')?.checked || false,
      bpmValue: parseFloat(document.getElementById('bpm-input')?.value) || 120
    };

    batchGenerateBtn.disabled = true;
    setStatus(batchStatus, `Building ${items.length} gradients…`, '');

    if (typeof CSInterface === 'undefined') {
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
    if (tabBrowse) tabBrowse.classList.remove('active');
    if (tabEdit) tabEdit.classList.remove('active');
    if (tabFluid) tabFluid.classList.remove('active');
    
    if (viewBrowse) viewBrowse.classList.remove('active');
    if (viewEdit) viewEdit.classList.remove('active');
    if (viewFluid) viewFluid.classList.remove('active');
    
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
       if (!liquidPollInterval && typeof CSInterface !== 'undefined') {
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

  tabBrowse.addEventListener('click', () => switchTab(tabBrowse, viewBrowse));
  tabEdit.addEventListener('click', () => switchTab(tabEdit, viewEdit));
  if (tabFluid) {
    tabFluid.addEventListener('click', () => switchTab(tabFluid, viewFluid));
  }
}

// ── TWO-WAY SYNC POLLING ──
let lastGradientState = '';
setInterval(() => {
  if (typeof CSInterface === 'undefined') return;
  const cs = new CSInterface();
  cs.evalScript('getSelectedGradientState()', (result) => {
    if (result && result !== 'undefined' && result !== '' && result !== lastGradientState) {
      lastGradientState = result;
      try {
        const stateObj = JSON.parse(result);
        if (stateObj.type) {
          selectedType = stateObj.type;
          
          if (stateObj.colors && stateObj.colors.length === 4) {
            state.colors = [...stateObj.colors];
            document.querySelectorAll('.color-pick').forEach((p, i) => {
              p.value = state.colors[i];
            });
            // Update css variables
            document.documentElement.style.setProperty('--c1', state.colors[0]);
            document.documentElement.style.setProperty('--c2', state.colors[1]);
            document.documentElement.style.setProperty('--c3', state.colors[2]);
            document.documentElement.style.setProperty('--c4', state.colors[3]);
          }

          // Render controls for this type
          renderControls(selectedType);

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
            setTimeout(() => {
              Object.keys(stateObj.controls).forEach(key => {
                const el = document.getElementById('ctrl-' + key);
                if (el) {
                  el.value = stateObj.controls[key];
                  const valSpan = document.getElementById('val-' + key);
                  if (valSpan) valSpan.textContent = el.value;
                }
              });
            }, 50); // small delay to allow renderControls to finish
          }

          // Switch to Edit tab
          if (!tabEdit.classList.contains('active')) {
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
document.querySelectorAll('.section-header').forEach(header => {
  header.style.cursor = 'pointer';
  header.style.userSelect = 'none';
  header.style.position = 'relative';
  
  // Add accordion arrow
  const arrow = document.createElement('span');
  arrow.innerHTML = '&#9660;'; // Down arrow
  arrow.style.position = 'absolute';
  arrow.style.right = '0';
  arrow.style.fontSize = '9px';
  arrow.style.transition = 'transform 0.2s';
  header.appendChild(arrow);

  header.addEventListener('click', function() {
    const section = this.parentElement;
    section.classList.toggle('collapsed');
    
    // Find content div or all subsequent siblings
    let content = section.querySelector('.section-content');
    if (!content) {
      // Wrap children (except header) in a content div on first click if not present
      content = document.createElement('div');
      content.className = 'section-content';
      while (this.nextSibling) {
        content.appendChild(this.nextSibling);
      }
      section.appendChild(content);
    }
    
    if (section.classList.contains('collapsed')) {
      content.style.display = 'none';
      arrow.style.transform = 'rotate(-90deg)';
    } else {
      content.style.display = 'block';
      arrow.style.transform = 'rotate(0deg)';
    }
  });
});

// ── BIND SLIDERS TO REALTIME ──
// Hook up any changes in the inspector to triggerRealtimeUpdate
viewEdit.addEventListener('input', (e) => {
  if (e.target.classList.contains('slider') || e.target.classList.contains('color-pick')) {
    if (typeof window.triggerRealtimeUpdate === 'function') {
      window.triggerRealtimeUpdate();
    }
  }
});


// ── GLOBAL CONTROLS (GRAIN & BPM) ──

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


const bpmToggle = document.getElementById('bpm-sync-toggle');
const bpmInputRow = document.getElementById('bpm-input-row');
if (bpmToggle && bpmInputRow) {
  bpmToggle.addEventListener('change', (e) => {
    bpmInputRow.style.display = e.target.checked ? 'flex' : 'none';
  });
}

const trackingToggle = document.getElementById('tracking-toggle');
const trackingInputRow = document.getElementById('tracking-input-row');
const trackPhysics = document.getElementById('track-physics');
if (trackingToggle && trackingInputRow) {
  trackingToggle.addEventListener('change', (e) => {
    trackingInputRow.style.display = e.target.checked ? 'flex' : 'none';
    if (trackPhysics) trackPhysics.classList.toggle('visible', e.target.checked);
    if (e.target.checked) refreshTrackingLayers();
  });
}

/* ── Tracking physics controls ──────────────────────────────────────── */

const TRACK_PARAMS = [
  'trackMode', 'trackRadius', 'trackForce',
  'trackTension', 'trackFriction', 'trackPersistence'
];

// Bind each physics slider to its number field, matching the behaviour
// renderControls gives the per-type sliders.
TRACK_PARAMS.forEach(id => {
  const range = document.getElementById('ctrl-' + id);
  const num = document.getElementById('num-' + id);
  if (!range) return;
  if (typeof paintRange === 'function') paintRange(range);
  if (!num) return;

  range.addEventListener('input', () => {
    num.value = range.value;
    if (typeof paintRange === 'function') paintRange(range);
  });
  num.addEventListener('input', () => {
    const v = parseFloat(num.value);
    if (isNaN(v)) return;
    range.value = Math.min(parseFloat(range.max), Math.max(parseFloat(range.min), v));
    if (typeof paintRange === 'function') paintRange(range);
  });
  num.addEventListener('blur', () => {
    let v = parseFloat(num.value);
    if (isNaN(v)) v = parseFloat(range.defaultValue);
    v = Math.min(parseFloat(range.max), Math.max(parseFloat(range.min), v));
    range.value = v;
    num.value = v;
    if (typeof paintRange === 'function') paintRange(range);
  });
});

/* Read the physics controls into the shape jsx/main.jsx expects — they live
   under `controls` alongside the per-type sliders, not at the top level. */
function getTrackingValues() {
  const out = {};
  TRACK_PARAMS.forEach(id => {
    const el = document.getElementById('ctrl-' + id);
    if (!el) return;
    out[id] = (el.tagName === 'SELECT') ? el.value : parseFloat(el.value);
  });
  return out;
}

const rebakeBtn = document.getElementById('rebake-btn');
if (rebakeBtn) {
  rebakeBtn.addEventListener('click', function () {
    const statusEl = document.getElementById('generate-status');
    const layerName = document.getElementById('tracking-layer-select')?.value || '';
    if (!layerName) {
      setStatus(statusEl, '✕ Pick a layer to track first.', 'error');
      return;
    }
    if (typeof CSInterface === 'undefined') {
      setStatus(statusEl, '✓ [Dev mode] Re-bake skipped.', 'success');
      return;
    }

    rebakeBtn.disabled = true;
    setStatus(statusEl, 'Re-running the simulation…', '');

    const payload = { trackingLayerName: layerName, controls: getTrackingValues() };
    new CSInterface().evalScript(`rebakeTracking(${esArg(payload)})`, function (result) {
      rebakeBtn.disabled = false;
      if (!result || result === 'EvalScript error.' || result === 'undefined') {
        setStatus(statusEl, '✕ Re-bake failed. Check the JSX.', 'error');
      } else if (result.indexOf('ERROR') !== -1) {
        setStatus(statusEl, '✕ ' + result.replace('ERROR:', '').trim(), 'error');
      } else if (result.indexOf('warning') !== -1) {
        const [done, detail] = result.split(' | ');
        setStatus(statusEl, '⚠ ' + done + ' — ' + detail, 'warn');
      } else {
        setStatus(statusEl, '✓ ' + result, 'success');
      }
    });
  });
}

const refreshLayersBtn = document.getElementById('refresh-layers-btn');
if (refreshLayersBtn) {
  refreshLayersBtn.addEventListener('click', refreshTrackingLayers);
}

function refreshTrackingLayers() {
  if (typeof CSInterface !== 'undefined') {
    const cs = new CSInterface();
    cs.evalScript('getCompLayers()', function(result) {
      const select = document.getElementById('tracking-layer-select');
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
      alert("No valid hex codes found in text.");
    }
  });
}

// ── EYEDROPPER API ──
const eyeBtn = document.getElementById('eyedropper-btn');
if (eyeBtn) {
  eyeBtn.addEventListener('click', async () => {
    if (typeof CSInterface !== 'undefined') {
      const cs = new CSInterface();
      cs.evalScript(`openNativeColorPicker('#FFFFFF')`, function(res) {
        if (res && res !== "-1") {
          state.colors.unshift(res.toUpperCase());
          state.colors.pop();
          document.querySelectorAll('.color-pick').forEach((p, i) => p.style.backgroundColor = state.colors[i]);
          triggerColorUpdate();
          if (typeof window.triggerRealtimeUpdate === 'function') {
            window.triggerRealtimeUpdate();
          }
        }
      });
    } else if (window.EyeDropper) {
      const eye = new EyeDropper();
      try {
        const result = await eye.open();
        // Shift colors right, insert new color at start
        state.colors.unshift(result.sRGBHex.toUpperCase());
        state.colors.pop();
        document.querySelectorAll('.color-pick').forEach((p, i) => p.style.backgroundColor = state.colors[i]);
        triggerColorUpdate();
      } catch (e) {
        // user canceled
      }
    } else {
      alert("Eyedropper API not supported in this version. Please use the color pickers.");
    }
  });
}

// ── EXPORT CSS & SVG ──
document.getElementById('export-css-btn')?.addEventListener('click', function () {
  const css = `background: linear-gradient(135deg, ${state.colors.join(', ')});`;
  navigator.clipboard.writeText(css);
  const btn = this;
  const originalText = btn.textContent;
  btn.textContent = "Copied CSS!";
  setTimeout(() => btn.textContent = originalText, 2000);
});

document.getElementById('export-svg-btn')?.addEventListener('click', function () {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
  <defs>
    <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${state.colors[0]}" />
      <stop offset="33%" stop-color="${state.colors[1]}" />
      <stop offset="66%" stop-color="${state.colors[2]}" />
      <stop offset="100%" stop-color="${state.colors[3]}" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#lg)" />
</svg>`;
  navigator.clipboard.writeText(svg);
  const btn = this;
  const originalText = btn.textContent;
  btn.textContent = "Copied SVG!";
  setTimeout(() => btn.textContent = originalText, 2000);
});

// Force load main.jsx to bypass AE manifest cache without restarting!
try {
  if (typeof CSInterface !== 'undefined') {
    const cs = new CSInterface();
    const extPath = cs.getSystemPath("extension").replace(/\\/g, '/');
    cs.evalScript('$.evalFile("' + extPath + '/jsx/main.jsx")');
  }
} catch (e) {
  console.error("Failed to evalFile main.jsx:", e);
}

// ── NATIVE COLOR PICKER LOGIC ──
document.querySelectorAll('.color-pick').forEach((picker, i) => {
  picker.addEventListener('click', function(e) {
    if (typeof CSInterface !== 'undefined') {
      e.preventDefault();
      const cs = new CSInterface();
      cs.evalScript(`openNativeColorPicker('${state.colors[i]}')`, function(res) {
        if (res && res !== "-1") {
          state.colors[i] = res;
          picker.style.backgroundColor = res;
          triggerColorUpdate();
          if (typeof window.triggerRealtimeUpdate === 'function') {
            window.triggerRealtimeUpdate();
          }
        }
      });
    }
  });

  picker.addEventListener('input', function (e) {
    state.colors[i] = e.target.value.toUpperCase();
    triggerColorUpdate();
  });
});

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
  for (let i = 0; i < 4; i++) {
    const rStr = picked[i].r.toString(16).padStart(2, '0');
    const gStr = picked[i].g.toString(16).padStart(2, '0');
    const bStr = picked[i].b.toString(16).padStart(2, '0');
    const hex = '#' + (rStr + gStr + bStr).toUpperCase();
    state.colors[i] = hex;
    const picker = document.getElementById('color' + (i + 1));
    if (picker) picker.style.backgroundColor = hex;
  }

  triggerColorUpdate();
}

// ── SHUFFLE ──
document.getElementById('shuffle-btn').addEventListener('click', function () {
  const pickers = document.querySelectorAll('.color-pick');
  pickers.forEach((p, i) => {
    const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    p.style.backgroundColor = randomColor;
    state.colors[i] = randomColor;
  });
  triggerColorUpdate();
});

// ── MOOD PRESETS ──
document.getElementById('mood-select').addEventListener('change', function () {
  const mood = this.value;
  if (!mood || !MOODS[mood]) return;

  const colors = MOODS[mood];
  const pickers = document.querySelectorAll('.color-pick');
  pickers.forEach((p, i) => {
    p.style.backgroundColor = colors[i] || colors[0];
    state.colors[i] = colors[i] || colors[0];
  });

  triggerColorUpdate();

  // Reset select
  setTimeout(() => { this.value = ''; }, 100);
});

/* Serialise an argument for evalScript.
   JSON.stringify twice: the inner pass encodes the payload, the outer pass
   produces a correctly quoted and escaped ExtendScript string literal.
   Hand-escaping quotes broke on any payload containing a newline — which is
   every AI Generated build, since customCode is arbitrary source. */
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
    controls: Object.assign(getControlValues(selectedType), getTrackingValues()),
    grain: parseFloat(document.getElementById('grain-slider')?.value) || 0,
    glow: parseFloat(document.getElementById('glow-slider')?.value) || 0,
    colorQuality: document.getElementById('color-quality-toggle')?.checked !== false,
    bpmSync: document.getElementById('bpm-sync-toggle')?.checked || false,
    bpmValue: parseFloat(document.getElementById('bpm-input')?.value) || 120,
    trackingEnabled: document.getElementById('tracking-toggle')?.checked || false,
    trackingLayerName: document.getElementById('tracking-layer-select')?.value || ''
  };

  if (selectedType === 'ai_custom' && window.lastAiCode) {
    params.customCode = window.lastAiCode;
  }
  if (selectedType === 'ai_image' && window.lastAiImagePath) {
    params.imagePath = window.lastAiImagePath;
  }

  btn.disabled = true;
  setStatus(statusEl, 'Sending to After Effects…', '');

  try {
    if (typeof CSInterface !== 'undefined') {
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

// ── REALTIME: SPEED + DIRECTION ──
window.triggerRealtimeUpdate = function () {
  const vals = getControlValues(selectedType);
  if (typeof CSInterface !== 'undefined') {
    const cs = new CSInterface();
    const fullParams = {
        type: selectedType,
        colors: state.colors,
        controls: vals,
        grain: parseFloat(document.getElementById('grain-slider')?.value) || 0,
        glow: parseFloat(document.getElementById('glow-slider')?.value) || 0,
        colorQuality: document.getElementById('color-quality-toggle')?.checked !== false,
        bpmSync: document.getElementById('bpm-sync-toggle')?.checked || false,
        bpmValue: parseFloat(document.getElementById('bpm-input')?.value) || 120,
        trackingEnabled: document.getElementById('tracking-toggle')?.checked || false,
        trackingLayerName: document.getElementById('tracking-layer-select')?.value || ''
    };
    cs.evalScript(`updateSilkFlareWave(${esArg(fullParams)})`);
  }
};

// ── REALTIME: COLORS ──
function triggerColorUpdate() {
  // Update CSS Variables for Live Previews
  document.documentElement.style.setProperty('--c1', state.colors[0]);
  document.documentElement.style.setProperty('--c2', state.colors[1]);
  document.documentElement.style.setProperty('--c3', state.colors[2]);
  document.documentElement.style.setProperty('--c4', state.colors[3]);

  if (typeof CSInterface !== 'undefined') {
    const cs = new CSInterface();
    cs.evalScript(`updateLiveColors(${esArg(state.colors)})`);
  }
}

// Initialize preview colors on load
triggerColorUpdate();


