/* ============================================
   CONTROLS.JS — Per-type slider configs
   ============================================ */

const GRADIENT_CONTROLS = {
  living: [
    { id: 'speed',    label: 'Shift Speed',  min: 1,   max: 60,  step: 1,   default: 10,  type: 'slider' },
    { id: 'softness', label: 'Turbulence',   min: 0,   max: 900, step: 1,   default: 250, type: 'slider' },
    { id: 'rotation', label: 'Evolution',    min: 0,   max: 250, step: 1,   default: 70,  type: 'slider' },
    { id: 'scale',    label: 'Scale',        min: 50,  max: 1200,step: 10,  default: 400, type: 'slider' },
    { id: 'opacity',  label: 'Opacity',      min: 10,  max: 100, step: 1,   default: 100, type: 'slider' }
  ],
  Silk: [
    { id: 'speed', label: 'Speed', min: 0.05, max: 3.0, step: 0.05, default: 0.3, type: 'slider' },
    { id: 'direction', label: 'Direction', min: 0, max: 360, step: 1, default: 163, type: 'slider' },
    { id: 'shape', label: 'Matte Shape', options: ['4-Point Star (Default)', '5-Point Star', 'Hexagon', 'Circle', 'Oval', 'Square', 'Rectangle'], default: '4-Point Star (Default)', type: 'select' }
  ],
  Aurora: [
    { id: 'speed', label: 'Speed', min: 0.05, max: 3.0, step: 0.05, default: 0.2, type: 'slider' },
    { id: 'direction', label: 'Direction', min: 0, max: 360, step: 1, default: 163, type: 'slider' },
    { id: 'shape', label: 'Matte Shape', options: ['4-Point Star (Default)', '5-Point Star', 'Hexagon', 'Circle', 'Oval', 'Square', 'Rectangle'], default: '4-Point Star (Default)', type: 'select' }
  ],
  Prism: [
    { id: 'speed', label: 'Speed', min: 0.05, max: 3.0, step: 0.05, default: 0.3, type: 'slider' },
    { id: 'direction', label: 'Direction', min: 0, max: 360, step: 1, default: 163, type: 'slider' },
    { id: 'shape', label: 'Matte Shape', options: ['4-Point Star (Default)', '5-Point Star', 'Hexagon', 'Circle', 'Oval', 'Square', 'Rectangle'], default: '4-Point Star (Default)', type: 'select' }
  ],
  Fiber: [
    { id: 'speed', label: 'Speed', min: 0.05, max: 3.0, step: 0.05, default: 1.4, type: 'slider' },
    { id: 'direction', label: 'Direction', min: 0, max: 360, step: 1, default: 163, type: 'slider' },
    { id: 'shape', label: 'Matte Shape', options: ['4-Point Star (Default)', '5-Point Star', 'Hexagon', 'Circle', 'Oval', 'Square', 'Rectangle'], default: '4-Point Star (Default)', type: 'select' }
  ],
  Veil: [
    { id: 'speed', label: 'Speed', min: 0.05, max: 3.0, step: 0.05, default: 0.15, type: 'slider' },
    { id: 'direction', label: 'Direction', min: 0, max: 360, step: 1, default: 163, type: 'slider' },
    { id: 'shape', label: 'Matte Shape', options: ['4-Point Star (Default)', '5-Point Star', 'Hexagon', 'Circle', 'Oval', 'Square', 'Rectangle'], default: '4-Point Star (Default)', type: 'select' }
  ],
  Pulse: [
    { id: 'speed', label: 'Speed', min: 0.05, max: 3.0, step: 0.05, default: 0.6, type: 'slider' },
    { id: 'direction', label: 'Direction', min: 0, max: 360, step: 1, default: 163, type: 'slider' },
    { id: 'shape', label: 'Matte Shape', options: ['4-Point Star (Default)', '5-Point Star', 'Hexagon', 'Circle', 'Oval', 'Square', 'Rectangle'], default: '4-Point Star (Default)', type: 'select' }
  ],
  Comet: [
    { id: 'speed', label: 'Speed', min: 0.05, max: 3.0, step: 0.05, default: 0.5, type: 'slider' },
    { id: 'direction', label: 'Direction', min: 0, max: 360, step: 1, default: 163, type: 'slider' },
    { id: 'shape', label: 'Matte Shape', options: ['4-Point Star (Default)', '5-Point Star', 'Hexagon', 'Circle', 'Oval', 'Square', 'Rectangle'], default: '4-Point Star (Default)', type: 'select' }
  ],
  ChromaFlare: [
    { id: 'rotationSpeed', label: 'Rotation Speed', min: 0, max: 120, step: 1, default: 50, type: 'slider' },
    { id: 'speed', label: 'Wave Speed', min: 0, max: 3, step: 0.05, default: 0.7, type: 'slider' },
    { id: 'direction', label: 'Wave Direction', min: 0, max: 360, step: 1, default: 140, type: 'slider' },
    { id: 'bend', label: 'Arc Bend', min: -100, max: 100, step: 1, default: 72, type: 'slider' },
    { id: 'horizontalDistort', label: 'Horiz Distort', min: -100, max: 100, step: 1, default: 94, type: 'slider' },
    { id: 'verticalDistort', label: 'Vert Distort', min: -100, max: 100, step: 1, default: -29, type: 'slider' },
    { id: 'star', label: 'Star', options: ['4-Point Star', '5-Point Star', '6-Point Star'], default: '4-Point Star', type: 'select' }
  ]
};

function renderControls(type) {
  const container = document.getElementById('controls-container');
  if (!container) return;
  const controls = GRADIENT_CONTROLS[type] || [];
  container.innerHTML = '';
  if (!controls.length) {
    container.innerHTML = '<div style="color:var(--text3);font-size:11px;">No settings for this type.</div>';
    return;
  }
  const group = document.createElement('div');
  group.className = 'control-group';
  controls.forEach(ctrl => {
    const item = document.createElement('div');
    item.className = 'control-item';
    const header = document.createElement('div');
    header.className = 'control-header';
    const label = document.createElement('span');
    label.className = 'control-label';
    label.textContent = ctrl.label;
    const valDisplay = document.createElement('span');
    valDisplay.className = 'control-value';
    valDisplay.id = 'val-' + ctrl.id;
    valDisplay.textContent = ctrl.default;
    
    header.appendChild(label);
    if (ctrl.type !== 'select') {
      header.appendChild(valDisplay);
    }
    
    if (ctrl.type === 'select') {
      const select = document.createElement('select');
      select.className = 'mood-select'; // Reuse the select styles
      select.style.marginTop = '4px';
      select.id = 'ctrl-' + ctrl.id;
      ctrl.options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        select.appendChild(option);
      });
      select.value = ctrl.default;
      
      select.addEventListener('change', function() {
        if (typeof window.triggerRealtimeUpdate === 'function') {
          window.triggerRealtimeUpdate();
        }
      });
      item.appendChild(header);
      item.appendChild(select);
    } else {
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'slider';
      slider.id = 'ctrl-' + ctrl.id;
      slider.min = ctrl.min;
      slider.max = ctrl.max;
      slider.step = ctrl.step;
      slider.value = ctrl.default;
      slider.addEventListener('input', function() {
        valDisplay.textContent = parseFloat(this.value).toFixed(ctrl.step < 1 ? 2 : 0);
        if (typeof window.triggerRealtimeUpdate === 'function') {
          window.triggerRealtimeUpdate();
        }
      });
      item.appendChild(header);
      item.appendChild(slider);
    }
    group.appendChild(item);
  });
  container.appendChild(group);
}

function getControlValues(type) {
  const controls = GRADIENT_CONTROLS[type] || [];
  const vals = {};
  controls.forEach(ctrl => {
    const el = document.getElementById('ctrl-' + ctrl.id);
    if (el) {
      vals[ctrl.id] = (ctrl.type === 'select') ? el.value : parseFloat(el.value);
    } else {
      vals[ctrl.id] = ctrl.default;
    }
  });
  return vals;
}
