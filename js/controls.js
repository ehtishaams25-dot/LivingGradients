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
  ],
  Holographic: [
    { id: 'speed', label: 'Liquid Speed', min: 1, max: 100, step: 1, default: 50, type: 'slider' },
    { id: 'blur', label: 'Blur Radius', min: 0, max: 300, step: 5, default: 150, type: 'slider' }
  ],
  Grainy: [
    { id: 'noise', label: 'Grain Amount', min: 1, max: 100, step: 1, default: 25, type: 'slider' },
    { id: 'contrast', label: 'Contrast', min: 0, max: 200, step: 1, default: 120, type: 'slider' }
  ],
  Liquid: [
    { id: 'turbulence', label: 'Turbulence', min: 10, max: 500, step: 10, default: 150, type: 'slider' },
    { id: 'speed', label: 'Speed', min: 1, max: 100, step: 1, default: 30, type: 'slider' }
  ],
  Neon: [
    { id: 'glowRadius', label: 'Glow Radius', min: 5, max: 200, step: 1, default: 80, type: 'slider' },
    { id: 'intensity', label: 'Intensity', min: 0.1, max: 5, step: 0.1, default: 1.5, type: 'slider' }
  ],
  Topographic: [
    { id: 'lines', label: 'Line Density', min: 10, max: 200, step: 10, default: 80, type: 'slider' },
    { id: 'thickness', label: 'Line Thickness', min: 1, max: 10, step: 1, default: 2, type: 'slider' },
    { id: 'speed', label: 'Evolution Speed', min: 10, max: 150, step: 10, default: 50, type: 'slider' }
  ],
  Glass: [
    { id: 'softness', label: 'Frosted Softness', min: 5, max: 150, step: 5, default: 45, type: 'slider' },
    { id: 'refraction', label: 'Refraction Index', min: 10, max: 200, step: 10, default: 80, type: 'slider' },
    { id: 'speed', label: 'Wave Speed', min: 10, max: 150, step: 10, default: 40, type: 'slider' }
  ],
  Wireframe: [
    { id: 'gridSize', label: 'Grid Size', min: 20, max: 300, step: 10, default: 50, type: 'slider' },
    { id: 'thickness', label: 'Wire Thickness', min: 1, max: 20, step: 1, default: 3, type: 'slider' },
    { id: 'rotationX', label: 'Rotate X', min: -180, max: 180, step: 5, default: 45, type: 'slider' },
    { id: 'rotationY', label: 'Rotate Y', min: -180, max: 180, step: 5, default: -45, type: 'slider' }
  ],
  FigmaShader: [
    { id: 'fluidity', label: 'Fluidity (Speed)', min: 10, max: 150, step: 5, default: 60, type: 'slider' },
    { id: 'distortion', label: 'Distortion (Warp)', min: 50, max: 400, step: 10, default: 200, type: 'slider' },
    { id: 'glossiness', label: 'Glossiness (Light)', min: 10, max: 150, step: 5, default: 75, type: 'slider' },
    { id: 'height', label: 'Glass Height (3D)', min: 1, max: 100, step: 1, default: 40, type: 'slider' }
  ],
  Psychedelic: [
    { id: 'speed', label: 'Trippy Speed', min: 10, max: 200, step: 10, default: 80, type: 'slider' },
    { id: 'complexity', label: 'Complexity', min: 1, max: 10, step: 1, default: 5, type: 'slider' },
    { id: 'colorCycle', label: 'Color Cycle Speed', min: 0, max: 360, step: 10, default: 180, type: 'slider' }
  ],
  Heatmap: [
    { id: 'noiseScale', label: 'Thermal Scale', min: 10, max: 300, step: 10, default: 150, type: 'slider' },
    { id: 'speed', label: 'Thermal Shift', min: 10, max: 150, step: 5, default: 40, type: 'slider' },
    { id: 'contrast', label: 'Contrast', min: 20, max: 200, step: 5, default: 80, type: 'slider' }
  ],
  Halftone: [
    { id: 'shape', label: 'Dot Shape', options: ['Circle', 'Square', 'Triangle', 'Cross', 'Custom Text/Emoji'], default: 'Circle', type: 'select' },
    { id: 'customText', label: 'Custom Symbol', type: 'text', default: '💀' },
    { id: 'dotSize', label: 'Dot Size', min: 10, max: 200, step: 2, default: 40, type: 'slider' },
    { id: 'contrast', label: 'Contrast', min: 20, max: 255, step: 5, default: 128, type: 'slider' },
    { id: 'speed', label: 'Gradient Speed', min: 1, max: 100, step: 1, default: 30, type: 'slider' }
  ],
  AsciiMatrix: [
    { id: 'gridSize', label: 'Grid Size', min: 10, max: 150, step: 2, default: 40, type: 'slider' },
    { id: 'chars', label: 'Characters (Dark->Light)', type: 'text', default: ' .-+#@' },
    { id: 'speed', label: 'Gradient Speed', min: 1, max: 100, step: 1, default: 30, type: 'slider' },
    { id: 'colorize', label: 'Colorize Mode', options: ['Gradient Colors', 'Pure White', 'Matrix Green'], default: 'Gradient Colors', type: 'select' }
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
      const wrap = document.createElement('div');
      wrap.className = 'select-wrap';
      wrap.style.marginTop = '4px';
      
      const select = document.createElement('select');
      select.className = 'custom-select';
      select.id = 'ctrl-' + ctrl.id;
      ctrl.options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        select.appendChild(option);
      });
      select.value = ctrl.default;
      
      select.addEventListener('change', function() {
        // Toggle custom text input if it exists
        if (ctrl.id === 'shape') {
          const textItem = document.getElementById('ctrl-customText');
          if (textItem) {
            textItem.closest('.control-item').style.display = this.value === 'Custom Text/Emoji' ? 'block' : 'none';
          }
        }
        
        if (typeof window.triggerRealtimeUpdate === 'function') {
          window.triggerRealtimeUpdate();
        }
      });
      wrap.appendChild(select);
      
      item.appendChild(header);
      item.appendChild(wrap);
      
      // Initialize visibility for shape dropdowns
      if (ctrl.id === 'shape') {
        setTimeout(() => {
          const textItem = document.getElementById('ctrl-customText');
          if (textItem) {
            textItem.closest('.control-item').style.display = select.value === 'Custom Text/Emoji' ? 'block' : 'none';
          }
        }, 10);
      }
    } else if (ctrl.type === 'text') {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'custom-input';
      input.id = 'ctrl-' + ctrl.id;
      input.value = ctrl.default;
      input.style.marginTop = '4px';
      
      input.addEventListener('input', function() {
        if (typeof window.triggerRealtimeUpdate === 'function') {
          window.triggerRealtimeUpdate();
        }
      });
      item.appendChild(header);
      item.appendChild(input);
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
