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

  GRADIENT_LIBRARY.forEach((preset, index) => {
    const card = document.createElement('div');
    card.className = 'gradient-card' + (index === 0 ? ' selected' : '');
    card.dataset.type = preset.id;

    card.innerHTML = `
      <div class="card-preview ${preset.cssClass}"></div>
      <span class="card-label">${preset.label}</span>
    `;

    card.addEventListener('click', function () {
      document.querySelectorAll('.gradient-card').forEach(c => c.classList.remove('selected'));
      this.classList.add('selected');
      selectedType = preset.id;

      if (preset.defaultColors && preset.defaultColors.length === 4) {
        state.colors = [...preset.defaultColors];
        document.querySelectorAll('.color-pick').forEach((p, i) => {
          p.value = state.colors[i];
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
        inspectorPanel.classList.add('active');
      }
      renderControls(selectedType);
    });

    gradientGrid.appendChild(card);
  });
}

// Init library
renderLibrary();

if (closeInspectorBtn) {
  closeInspectorBtn.addEventListener('click', () => {
    if (inspectorPanel) inspectorPanel.classList.remove('active');
  });
}

// Init controls
renderControls(selectedType);

// ── GLOBAL CONTROLS (GRAIN & BPM) ──
const grainSlider = document.getElementById('grain-slider');
const grainVal = document.getElementById('grain-val');
if (grainSlider && grainVal) {
  grainSlider.addEventListener('input', (e) => {
    grainVal.textContent = e.target.value;
  });
}

const bpmToggle = document.getElementById('bpm-sync-toggle');
const bpmInputRow = document.getElementById('bpm-input-row');
if (bpmToggle && bpmInputRow) {
  bpmToggle.addEventListener('change', (e) => {
    bpmInputRow.style.display = e.target.checked ? 'flex' : 'none';
  });
}

const trackingToggle = document.getElementById('tracking-toggle');
const trackingInputRow = document.getElementById('tracking-input-row');
if (trackingToggle && trackingInputRow) {
  trackingToggle.addEventListener('change', (e) => {
    trackingInputRow.style.display = e.target.checked ? 'flex' : 'none';
    if (e.target.checked) refreshTrackingLayers();
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
      document.querySelectorAll('.color-pick').forEach((p, i) => p.value = state.colors[i]);
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
    if (window.EyeDropper) {
      const eye = new EyeDropper();
      try {
        const result = await eye.open();
        // Shift colors right, insert new color at start
        state.colors.unshift(result.sRGBHex.toUpperCase());
        state.colors.pop();
        document.querySelectorAll('.color-pick').forEach((p, i) => p.value = state.colors[i]);
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
    if (picker) picker.value = hex;
  }

  triggerColorUpdate();
}

// ── SHUFFLE ──
document.getElementById('shuffle-btn').addEventListener('click', function () {
  const pickers = document.querySelectorAll('.color-pick');
  pickers.forEach((p, i) => {
    const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    p.value = randomColor;
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
    p.value = colors[i] || colors[0];
    state.colors[i] = colors[i] || colors[0];
  });

  triggerColorUpdate();

  // Reset select
  setTimeout(() => { this.value = ''; }, 100);
});

// ── GENERATE ──
document.getElementById('generate-btn').addEventListener('click', function () {
  const btn = this;
  const statusEl = document.getElementById('generate-status');

  const params = {
    type: selectedType,
    colors: state.colors,
    controls: getControlValues(selectedType),
    grain: parseFloat(document.getElementById('grain-slider')?.value) || 0,
    bpmSync: document.getElementById('bpm-sync-toggle')?.checked || false,
    bpmValue: parseFloat(document.getElementById('bpm-input')?.value) || 120,
    trackingEnabled: document.getElementById('tracking-toggle')?.checked || false,
    trackingLayerName: document.getElementById('tracking-layer-select')?.value || ''
  };

  btn.disabled = true;
  setStatus(statusEl, 'Sending to After Effects…', '');

  try {
    if (typeof CSInterface !== 'undefined') {
      const cs = new CSInterface();
      const paramStr = JSON.stringify(params).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      cs.evalScript(`generateGradient('${paramStr}')`, function (result) {
        btn.disabled = false;
        if (result === 'EvalScript error.' || result === 'undefined') {
          setStatus(statusEl, '✕ Error in After Effects. Check the JSX.', 'error');
        } else if (result && result.indexOf('ERROR') !== -1) {
          setStatus(statusEl, '✕ ' + result.replace('ERROR:', '').trim(), 'error');
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

function setStatus(el, msg, type) {
  el.textContent = msg;
  el.className = 'generate-status ' + type;
}

// ── REALTIME: SPEED + DIRECTION ──
window.triggerRealtimeUpdate = function () {
  const vals = getControlValues(selectedType);
  if (typeof CSInterface !== 'undefined') {
    const cs = new CSInterface();
    const paramStr = JSON.stringify(Object.assign({ type: selectedType, controls: vals }, vals)).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    cs.evalScript(`updateSilkFlareWave('${paramStr}')`);
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
    const colorStr = JSON.stringify(state.colors).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    cs.evalScript(`updateLiveColors('${colorStr}')`);
  }
}

// Initialize preview colors on load
triggerColorUpdate();
