/* ============================================
   PREVIEW.JS — What the gradient will actually look like
   ============================================

   The card previews used to be CSS approximations: a `repeating-conic-gradient`
   standing in for Sunburst, two `radial-gradient`s standing in for Cellular
   Mosaic. They shared a name with the thing they represented and nothing else,
   so the grid could not be used to choose a gradient — you picked one, built
   it, looked at the comp, and started again.

   These are drawn per pixel from the same description the builder works from.
   A preview will never be the After Effects render — there is no Fractal Noise
   here — but it is built on the same structure: Liquid Waves wraps a field
   back on itself into ribbons because that is what the builder does, Halftone
   thresholds a dot profile against a ramp because that is what the builder
   does. Choosing from the grid means something now.

   They are static. Thirty-odd animated canvases in a docked panel is not worth
   what it costs; the structure and the palette are what the choice turns on.
   ============================================ */

/* ── Colour ─────────────────────────────────────────────────────────── */

function pvHexToRgb(hex) {
  const h = String(hex || '#000000').replace('#', '');
  const n = h.length === 3
    ? h.split('').map(ch => ch + ch).join('')
    : h.padEnd(6, '0');
  return [
    parseInt(n.slice(0, 2), 16) / 255,
    parseInt(n.slice(2, 4), 16) / 255,
    parseInt(n.slice(4, 6), 16) / 255
  ];
}

const pvToLinear = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const pvToSrgb   = c => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

/* Oklab, so a red-to-cyan fade keeps its chroma instead of passing through the
   brown that the straight sRGB line between them goes through. The panel's
   whole complaint about muddy colour lives in that one detail. */
function pvToOklab(rgb) {
  const r = pvToLinear(rgb[0]), g = pvToLinear(rgb[1]), b = pvToLinear(rgb[2]);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  ];
}

function pvFromOklab(lab) {
  const l_ = lab[0] + 0.3963377774 * lab[1] + 0.2158037573 * lab[2];
  const m_ = lab[0] - 0.1055613458 * lab[1] - 0.0638541728 * lab[2];
  const s_ = lab[0] - 0.0894841775 * lab[1] - 1.2914855480 * lab[2];
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  const out = [
    pvToSrgb( 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    pvToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    pvToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
  ];
  return out.map(v => (v < 0 ? 0 : v > 1 ? 1 : v));
}

function pvMix(a, b, t) {
  const A = pvToOklab(a), B = pvToOklab(b);
  return pvFromOklab([
    A[0] + (B[0] - A[0]) * t,
    A[1] + (B[1] - A[1]) * t,
    A[2] + (B[2] - A[2]) * t
  ]);
}

/* Sample a palette at t (0..1) across all of its stops. */
function pvSample(pal, t) {
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const n = pal.length;
  if (n === 1) return pal[0];
  const seg = t * (n - 1);
  const i = Math.min(Math.floor(seg), n - 2);
  return pvMix(pal[i], pal[i + 1], seg - i);
}

/* Every painter samples the palette once per pixel, and an Oklab round trip is
   a cube root each way plus two matrix products. Resolving the ramp into 256
   entries up front turns that into an array index — the difference between a
   grid that takes half a second to appear and one that is simply there. */
function pvRamp(pal, n) {
  n = n || 256;
  const lut = new Array(n);
  for (let i = 0; i < n; i++) lut[i] = pvSample(pal, i / (n - 1));
  return lut;
}

function pvLut(lut, t) {
  const i = t <= 0 ? 0 : t >= 1 ? lut.length - 1 : (t * (lut.length - 1)) | 0;
  return lut[i];
}

/* Palette ordered dark to light, matching what the builders do before handing
   a palette to a gradient map. */
function pvByLuma(pal) {
  return pal.slice().sort((a, b) =>
    (0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]) -
    (0.2126 * b[0] + 0.7152 * b[1] + 0.0722 * b[2]));
}

/* ── Painters ───────────────────────────────────────────────────────── */
/* Each writes RGBA into `d` for a W x H image given a palette of [r,g,b]
   triples in 0..1. Coordinates are normalised so the same code renders a card
   thumbnail and the inspector's wide strip. */

function pvPut(d, i, rgb) {
  d[i]     = rgb[0] * 255;
  d[i + 1] = rgb[1] * 255;
  d[i + 2] = rgb[2] * 255;
  d[i + 3] = 255;
}

/* Soft overlapping blobs — the four-colour-gradient family. */
function pvMesh(d, W, H, pal) {
  const pts = [[0.18, 0.22], [0.84, 0.18], [0.22, 0.82], [0.80, 0.78]];
  const labs = pts.map((_, k) => pvToOklab(pal[k % pal.length]));
  for (let y = 0; y < H; y++) {
    const ny = y / H;
    for (let x = 0; x < W; x++) {
      const nx = x / W;
      let wsum = 0, l0 = 0, l1 = 0, l2 = 0;
      for (let k = 0; k < 4; k++) {
        const dx = nx - pts[k][0], dy = ny - pts[k][1];
        const wk = 1 / (0.02 + dx * dx + dy * dy);
        wsum += wk;
        l0 += labs[k][0] * wk; l1 += labs[k][1] * wk; l2 += labs[k][2] * wk;
      }
      pvPut(d, (y * W + x) * 4, pvFromOklab([l0 / wsum, l1 / wsum, l2 / wsum]));
    }
  }
}

/* Values that run past the top fold back down — the "Wrap Back" overflow the
   builders use to turn a smooth field into banded ribbons. */
function pvRibbons(d, W, H, pal, bands, stretch) {
  bands = bands || 2.4;
  stretch = stretch || 1;
  const lut = pvRamp(pal);
  for (let y = 0; y < H; y++) {
    const ny = y / H;
    for (let x = 0; x < W; x++) {
      const nx = (x / W) / stretch;
      const f = 0.6 * Math.sin(nx * 6.0 + ny * 2.6)
              + 0.4 * Math.sin(nx * 2.4 - ny * 7.4 + 1.3)
              + 0.2 * Math.sin(nx * 11.0 + ny * 4.0);
      const u = (f * 0.5 + 0.5) * bands * 2;
      const w = Math.abs(((u % 2) + 2) % 2 - 1);
      pvPut(d, (y * W + x) * 4, pvLut(lut, w));
    }
  }
}

/* A ramp folded by mirrored tiling, then bent — Metallic's construction. */
function pvChrome(d, W, H, pal) {
  const lut = pvRamp(pvByLuma(pal));
  for (let y = 0; y < H; y++) {
    const ny = y / H;
    for (let x = 0; x < W; x++) {
      const nx = x / W;
      const bend = 0.16 * Math.sin(ny * 5.2 + nx * 1.6)
                 + 0.07 * Math.sin(ny * 12.0 - nx * 3.0);
      const u = (nx + ny * 0.22 + bend) * 10;
      const w = Math.abs(((u % 2) + 2) % 2 - 1);
      pvPut(d, (y * W + x) * 4, pvLut(lut, w));
    }
  }
}

/* Dot profile against a ramp — the same comparison the builder makes. */
function pvHalftone(d, W, H, pal) {
  const inkLut = pvRamp([pal[0], pal[1 % pal.length]], 64);
  const paper = pal[2 % pal.length];
  const cell = Math.max(4, Math.round(W / 22));
  const cos = Math.cos(Math.PI / 4), sin = Math.sin(Math.PI / 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / W, ny = y / H;
      const field = Math.min(1, Math.max(0,
        nx * 0.75 + ny * 0.45 - 0.1 + 0.12 * Math.sin(ny * 5.0 + nx * 2.0)));
      // Rotate into the screen's own lattice before finding the cell.
      const rx = x * cos - y * sin, ry = x * sin + y * cos;
      const px = ((rx % cell) + cell) % cell / cell - 0.5;
      const py = ((ry % cell) + cell) % cell / cell - 0.5;
      const profile = 1 - Math.sqrt(px * px + py * py) / 0.72;
      const cut = (profile + field) * 0.5 - 0.5;
      const a = Math.min(1, Math.max(0, cut * 14 + 0.5));   // soft threshold
      const c = pvMix(paper, pvLut(inkLut, field), a);
      pvPut(d, (y * W + x) * 4, c);
    }
  }
}

/* Nearest-seed distance — Cellular Mosaic. */
function pvCells(d, W, H, pal) {
  const seeds = [];
  let r = 8;
  const rnd = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 26; i++) seeds.push([rnd(), rnd()]);
  const lut = pvRamp(pvByLuma(pal));
  for (let y = 0; y < H; y++) {
    const ny = y / H;
    for (let x = 0; x < W; x++) {
      const nx = x / W;
      let d1 = 9, d2 = 9;
      for (let i = 0; i < seeds.length; i++) {
        const dx = (nx - seeds[i][0]) * 1.6, dy = ny - seeds[i][1];
        const dd = dx * dx + dy * dy;
        if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) { d2 = dd; }
      }
      const edge = Math.min(1, (Math.sqrt(d2) - Math.sqrt(d1)) * 6);
      pvPut(d, (y * W + x) * 4, pvLut(lut, edge));
    }
  }
}

/* Hard wedges from a centre — Sunburst. */
function pvRays(d, W, H, pal) {
  const inkLut = pvRamp([pal[0], pal[1 % pal.length]], 64);
  const backdrop = pal[2 % pal.length];
  const rays = 16;
  const cx = 0.5, cy = 0.5;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / W - cx, ny = (y / H - cy) * (H / W);
      const ang = Math.atan2(ny, nx) / (Math.PI * 2) + 0.5;
      const t = ((ang * rays) % 1 + 1) % 1;
      const rad = Math.min(1, Math.sqrt(nx * nx + ny * ny) * 2.4);
      const c = (t < 0.5) ? pvLut(inkLut, rad) : backdrop;
      pvPut(d, (y * W + x) * 4, c);
    }
  }
}

/* Vertical flutes refracting the colour behind them — Reeded Glass. */
function pvFluted(d, W, H, pal) {
  const lut = pvRamp(pvByLuma(pal));
  const fw = Math.max(4, Math.round(W / 16));
  for (let y = 0; y < H; y++) {
    const ny = y / H;
    for (let x = 0; x < W; x++) {
      const f = (x % fw) / fw;                 // position across one flute
      const lens = (f - 0.5) * 2;              // -1..1
      const shift = lens * 0.16;
      const t = Math.min(1, Math.max(0,
        (x / W) * 0.55 + ny * 0.5 + shift + 0.1 * Math.sin(ny * 4.0)));
      let c = pvLut(lut, t);
      const sheen = Math.pow(Math.max(0, 1 - Math.abs(lens + 0.45) * 3), 2) * 0.45;
      c = pvMix(c, [1, 1, 1], sheen);
      pvPut(d, (y * W + x) * 4, c);
    }
  }
}

/* A quantised grid — ASCII Matrix and Stacked Squares. */
function pvGrid(d, W, H, pal) {
  const cell = Math.max(4, Math.round(W / 18));
  const sorted = pvByLuma(pal);
  const lut = pvRamp(sorted);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
      const nx = (gx * cell) / W, ny = (gy * cell) / H;
      let t = 0.5 + 0.5 * Math.sin(nx * 7.0 + ny * 3.0) * Math.cos(ny * 5.0 - nx * 2.0);
      t = Math.round(t * 4) / 4;
      const inset = (x % cell) < 1 || (y % cell) < 1;
      const c = inset ? sorted[0] : pvLut(lut, t);
      pvPut(d, (y * W + x) * 4, c);
    }
  }
}

/* Thin drifting strands — Trail, Web Threads, Waves. */
function pvThreads(d, W, H, pal) {
  const sorted = pvByLuma(pal);
  const lut = pvRamp(sorted);
  const bg = sorted[0];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / W, ny = y / H;
      let glow = 0;
      for (let k = 0; k < 5; k++) {
        const phase = k * 0.7;
        const line = 0.5 + 0.28 * Math.sin(nx * 6.0 + phase) + (k - 2) * 0.14;
        glow = Math.max(glow, Math.pow(Math.max(0, 1 - Math.abs(ny - line) * 26), 1.6));
      }
      pvPut(d, (y * W + x) * 4, pvMix(bg, pvLut(lut, 0.35 + nx * 0.65), glow));
    }
  }
}

/* ── Which painter belongs to which gradient ────────────────────────── */

const PREVIEW_FAMILY = {
  Halftone:       pvHalftone,
  CellularMosaic: pvCells,
  Sunburst:       pvRays,
  ReededGlass:    pvFluted,
  Metallic:       pvChrome,
  AsciiMatrix:    pvGrid,
  StackedSquares: pvGrid,
  TrailGradient:  pvThreads,
  WebThreads:     pvThreads,
  Waves:          pvThreads,
  Antigravity:    pvThreads,
  LiquidWaves:    (d, W, H, p) => pvRibbons(d, W, H, pvByLuma(p), 2.2, 1.4),
  Glass:          (d, W, H, p) => pvRibbons(d, W, H, pvByLuma(p), 2.8, 2.2),
  Heatmap:        (d, W, H, p) => pvRibbons(d, W, H, pvByLuma(p), 1.6, 1.0),
  Fiber:          (d, W, H, p) => pvRibbons(d, W, H, pvByLuma(p), 4.5, 3.0),
  Prism:          (d, W, H, p) => pvRibbons(d, W, H, pvByLuma(p), 3.2, 1.8)
};

function pvPainterFor(type) {
  return PREVIEW_FAMILY[type] || pvMesh;
}

/* ── Public entry ───────────────────────────────────────────────────── */

/* Backing size is fixed rather than tied to devicePixelRatio: the grid holds
   thirty-odd of these and repaints them all whenever the palette changes, so
   the cost of a repaint has to stay predictable. */
function paintPreview(canvas, type, colors) {
  if (!canvas || !canvas.getContext) return;
  const W = canvas.width, H = canvas.height;
  if (!W || !H) return;

  const pal = (colors && colors.length ? colors : ['#888888']).map(pvHexToRgb);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);

  try {
    pvPainterFor(type)(img.data, W, H, pal);
  } catch (e) {
    console.warn('[Living Gradients] preview failed for', type, e);
    return;
  }
  ctx.putImageData(img, 0, 0);
}
