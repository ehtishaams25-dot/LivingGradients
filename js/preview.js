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

/* SaaS: a near-flat backdrop with one big soft bloom off to a side and a
   quieter second one balancing it.

   Composited the way the real build does -- each bloom laid over what is
   already there with its own falloff as the alpha -- rather than by
   interpolating between palette entries. Mixing the blooms with each other
   in one pass would let two saturated colours meet at a muddy midpoint,
   which is the failure this whole look is trying to avoid.

   The falloff is smoothstep cubed. Squared still shows an edge on a light
   backdrop, which is exactly where this gradient is normally used. */
function pvSaaS(d, W, H, pal) {
  const bg = pal[0] || [1, 1, 1];

  /* Matches buildSaaS's default pad position and its first offset, so the
     card is a fair likeness of what applying it actually produces. */
  const blooms = [
    { x: 0.30, y: 0.35, r: 0.62, a: 0.85, c: pal[1] || pal[0] },
    { x: 0.30 + 0.34, y: 0.35 + 0.23, r: 0.45, a: 0.61, c: pal[2] || pal[1] || pal[0] }
  ];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const u = x / W, v = y / H;

      let r = bg[0], g = bg[1], b = bg[2];

      for (let k = 0; k < blooms.length; k++) {
        const s = blooms[k];
        /* Distance in units of the shorter axis, so the bloom stays round
           on a 16:9 card instead of stretching with it. */
        const dx = (u - s.x) * (W / Math.min(W, H));
        const dy = (v - s.y) * (H / Math.min(W, H));
        const dist = Math.sqrt(dx * dx + dy * dy) / s.r;
        if (dist >= 1) continue;

        const t = 1 - dist;
        const a = t * t * t * s.a;
        r += (s.c[0] - r) * a;
        g += (s.c[1] - g) * a;
        b += (s.c[2] - b) * a;
      }

      pvPut(d, i, [pvClamp(r), pvClamp(g), pvClamp(b)]);
    }
  }
}

/* Soft overlapping blobs -- the four-colour-gradient family. */
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

/* ── A field to threshold, and a surface to light ───────────────────── */

/* Value noise. Everything below needs a field with the same character as
   Fractal Noise's Basic type — smooth, symmetric about the middle, and the
   same every time it is drawn — and there is no such thing in a canvas. */
function pvHash(a, b, seed) {
  let n = (a * 1619 + b * 31337 + (seed | 0) * 6971) & 0x7fffffff;
  n = (n >> 13) ^ n;
  return ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 0x7fffffff;
}

function pvNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return pvHash(xi, yi, seed) * (1 - u) * (1 - v)
       + pvHash(xi + 1, yi, seed) * u * (1 - v)
       + pvHash(xi, yi + 1, seed) * (1 - u) * v
       + pvHash(xi + 1, yi + 1, seed) * u * v;
}

/* Octaves, which is what Fractal Noise calls Complexity. */
function pvFbm(x, y, oct, seed) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < (oct || 3); i++) {
    sum += amp * pvNoise(x * freq, y * freq, (seed | 0) + i * 17);
    norm += amp;
    amp *= 0.5; freq *= 2;
  }
  return sum / norm;
}

const pvClamp = v => (v < 0 ? 0 : v > 1 ? 1 : v);

/* ── Animal prints ──────────────────────────────────────────────────── */

/* One painter for all five, because there is one builder for all five: a
   noise field cut at a threshold, and the threshold is where Coverage puts
   it. The arithmetic is the same as lgPrintBias in jsx/main.jsx — a card that
   worked out its threshold some other way would be a different picture from
   the one the button makes, which is the whole failure these previews exist
   to stop. */
function pvPrint(d, W, H, pal, o) {
  const coat = pal[0];
  const mark = pal[1 % pal.length];
  const core = pal[2 % pal.length];
  const thr  = 0.5 + (0.5 - o.coverage) * 0.55;
  const edge = o.sharp || 60;

  for (let y = 0; y < H; y++) {
    const ny = y / H;
    for (let x = 0; x < W; x++) {
      const nx = x / W;
      // The wobble, so the markings read as grown rather than printed.
      const wx = nx + o.warp * (pvFbm(nx * 5, ny * 5, 2, 91) - 0.5);
      const wy = ny + o.warp * (pvFbm(nx * 5 + 9, ny * 5 + 4, 2, 91) - 0.5);
      const f  = pvFbm(wx * o.sx, wy * o.sy, o.oct, o.seed || 3);

      let c;
      if (o.rosette) {
        // Ring at the blob's shoulder, core at its peak.
        const ring = pvClamp((f - thr) * edge + 0.5);
        const cen  = pvClamp((f - thr - 0.13) * edge + 0.5);
        c = pvMix(pvMix(coat, mark, ring), core, cen);
      } else {
        c = pvMix(coat, mark, pvClamp((f - thr) * edge + 0.5));
      }
      pvPut(d, (y * W + x) * 4, c);
    }
  }
}

/* Giraffe is the one that tiles rather than thresholds: interlocking plates
   with a thin coat line between them. Nearest-seed distance gives the plates,
   the gap between the two nearest gives the line. */
function pvPlates(d, W, H, pal) {
  const coat = pal[0], patch = pal[1 % pal.length];
  const seeds = [];
  let r = 21;
  const rnd = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 22; i++) seeds.push([rnd(), rnd()]);

  for (let y = 0; y < H; y++) {
    const ny = y / H;
    for (let x = 0; x < W; x++) {
      const nx = x / W;
      const wx = nx + 0.05 * (pvFbm(nx * 6, ny * 6, 2, 7) - 0.5);
      const wy = ny + 0.05 * (pvFbm(nx * 6 + 3, ny * 6, 2, 7) - 0.5);
      let d1 = 9, d2 = 9;
      for (let i = 0; i < seeds.length; i++) {
        const dx = (wx - seeds[i][0]) * 1.6, dy = wy - seeds[i][1];
        const dd = dx * dx + dy * dy;
        if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) { d2 = dd; }
      }
      const gap = (Math.sqrt(d2) - Math.sqrt(d1)) * 14;
      pvPut(d, (y * W + x) * 4, pvMix(coat, patch, pvClamp((gap - 0.45) * 2.5)));
    }
  }
}

/* ── Lit surfaces ───────────────────────────────────────────────────── */

/* The height field, per finish. These are the canvas equivalents of the
   layers METAL_SURFACES builds: brushed is grain stretched along one axis,
   hammered is dimples, foil is ridges, mercury is blobs. */
function pvHeight(kind, x, y) {
  switch (kind) {
    case 'Brushed':  return pvFbm(x * 2.5, y * 70, 3, 11);
    case 'Gunmetal': return pvFbm(x * 26, y * 26, 3, 12);
    case 'Hammered': {
      // Dimples on a jittered lattice.
      const g = 7;
      const cx = Math.floor(x * g), cy = Math.floor(y * g);
      let best = 9;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const px = (cx + i + pvHash(cx + i, cy + j, 5)) / g;
          const py = (cy + j + pvHash(cx + i, cy + j, 6)) / g;
          const dx = x - px, dy = y - py;
          const dd = dx * dx + dy * dy;
          if (dd < best) best = dd;
        }
      }
      return pvClamp(Math.sqrt(best) * g * 1.4);
    }
    case 'Foil':     return 1 - Math.abs(2 * pvFbm(x * 4.5, y * 4.5, 3, 13) - 1);
    case 'Mercury':  {
      const f = pvFbm(x * 2.8, y * 2.8, 2, 14);
      return pvClamp((f - 0.44) * 5.5);          // rounded droplets
    }
    case 'Gold':
    case 'Copper':   return pvFbm(x * 4.5, y * 4.5, 3, 15);
    default:         return pvFbm(x * 2.2, y * 2.2, 2, 16);   // Polished
  }
}

/* A real, if small, Blinn–Phong pass — the same model CC Glass runs in the
   comp. Normals come from the height field by finite difference, the
   environment is a mirrored triangle wave rather than noise (see the note in
   main.jsx about why that matters), and the specular takes the surface's own
   colour because Metal is at full. Getting gold to look like gold instead of
   like a yellow gradient is entirely that last detail. */
function pvShade(d, W, H, pal, o) {
  const lut = pvRamp(pal);
  const bands = o.bands || 5;
  const relief = o.relief === undefined ? 0.4 : o.relief;
  const shine = o.shine === undefined ? 40 : o.shine;
  const eps = 1 / Math.max(W, H);

  // Light: up and to the left, at the elevation the panel's default asks for.
  const ang = (o.lightAngle === undefined ? 315 : o.lightAngle) * Math.PI / 180;
  const el = (o.lightHeight === undefined ? 0.5 : o.lightHeight) * (Math.PI / 2);
  const lx = Math.cos(ang) * Math.cos(el);
  const ly = Math.sin(ang) * Math.cos(el);
  const lz = Math.sin(el);
  // Half-vector against a viewer straight on.
  const hl = Math.sqrt(lx * lx + ly * ly + (lz + 1) * (lz + 1));
  const hx = lx / hl, hy = ly / hl, hz = (lz + 1) / hl;

  for (let y = 0; y < H; y++) {
    const ny = y / H;
    for (let x = 0; x < W; x++) {
      const nx = x / W;

      const h  = pvHeight(o.kind, nx, ny);
      const hX = pvHeight(o.kind, nx + eps, ny);
      const hY = pvHeight(o.kind, nx, ny + eps);
      // Surface normal from the slope of the height field.
      const gx = (hX - h) / eps * relief * 0.02;
      const gy = (hY - h) / eps * relief * 0.02;
      const nl = Math.sqrt(gx * gx + gy * gy + 1);
      const Nx = -gx / nl, Ny = -gy / nl, Nz = 1 / nl;

      /* The environment this surface reflects, displaced by its own
         normals. Two kinds, and which one a finish gets is the single
         biggest thing that separates a poured metal from a plate:

           flow    a noise field folded back on itself — closed organic
                   ribbons, twisted so they pour.
           plate   a ramp folded by mirrored tiling — straight bands, a
                   flat surface reflecting a room. */
      /* Both are the same triangle wave; flow is the one that gets bent
         hard, at a size much larger than the bands themselves. Bending at a
         size SMALLER than the bands shreds them into hairlines instead —
         which is the mistake the first metals shipped with. */
      const bend = (o.env === 'flow') ? 0.75 : 0.06;
      const bx = nx + bend * (pvFbm(nx * 0.9, ny * 0.9, 2, 41) - 0.5)
                    + bend * 0.4 * (pvFbm(nx * 2.1, ny * 2.1, 2, 43) - 0.5);
      const by = ny + bend * (pvFbm(nx * 0.9 + 5, ny * 0.9, 2, 41) - 0.5);
      const u = (bx + by * (o.tilt || 0.14) + Nx * 0.35 + Ny * 0.2) * bands * 2;
      const env = Math.abs(((u % 2) + 2) % 2 - 1);
      const body = pvLut(lut, env);

      const diff = Math.max(0, Nx * lx + Ny * ly + Nz * lz);
      const spec = Math.pow(Math.max(0, Nx * hx + Ny * hy + Nz * hz), shine);

      const amb = o.ambient === undefined ? 0.55 : o.ambient;
      const k = amb + (1 - amb) * diff;
      const sc = o.metal === false ? [1, 1, 1] : pal[pal.length - 1];
      const g = spec * (o.specular === undefined ? 0.9 : o.specular);
      pvPut(d, (y * W + x) * 4, [
        pvClamp(body[0] * k + sc[0] * g),
        pvClamp(body[1] * k + sc[1] * g),
        pvClamp(body[2] * k + sc[2] * g)
      ]);
    }
  }
}

/* Frosted glass: a soft colour field, bent by the surface in front of it,
   with a white specular on the ridges. Metal is off, so the highlight is the
   light's colour rather than the glass's — which is the one-line difference
   between glass and chrome. */
function pvGlass(d, W, H, pal) {
  const lut = pvRamp(pal);
  const eps = 1 / Math.max(W, H);
  const surf = (x, y) => pvFbm(x * 3.4, y * 2.2, 3, 23);

  for (let y = 0; y < H; y++) {
    const ny = y / H;
    for (let x = 0; x < W; x++) {
      const nx = x / W;
      const h = surf(nx, ny);
      const gx = (surf(nx + eps, ny) - h) / eps;
      const gy = (surf(nx, ny + eps) - h) / eps;

      // Refraction: sample the field behind the glass, offset by the slope.
      const field = pvFbm((nx - gx * 0.06) * 2.6, (ny - gy * 0.06) * 2.0, 3, 29);
      let c = pvLut(lut, pvClamp(field * 1.4 - 0.2));

      const nl = Math.sqrt(gx * gx + gy * gy + 1);
      const Nz = 1 / nl;
      const spec = Math.pow(Math.max(0, (-gx / nl) * 0.5 + (-gy / nl) * -0.5 + Nz * 0.7), 26);
      c = pvMix(c, [1, 1, 1], pvClamp(spec * 0.9));
      pvPut(d, (y * W + x) * 4, c);
    }
  }
}

/* Fur: a two-tone coat, then shredded.

   The displacement noise is deliberately far finer than the shapes it is
   pushing, which is what turns an edge into filaments instead of bending it —
   the same trick the builder pulls with a Turbulent Displace at Size 3 and
   Amount 900. Drawn here by sampling the coat at a coordinate pushed along a
   high-frequency field. */
function pvFur(d, W, H, pal) {
  const under = pal[0];
  const guard = pal[1 % pal.length];
  for (let y = 0; y < H; y++) {
    const ny = y / H;
    for (let x = 0; x < W; x++) {
      const nx = x / W;
      // The shred. High frequency, large amplitude, leaning one way.
      const fx = nx + 0.075 * (pvFbm(nx * 90, ny * 90, 2, 61) - 0.5)
                    + 0.02  * (pvFbm(nx * 20, ny * 20, 2, 62) - 0.5);
      const fy = ny + 0.055 * (pvFbm(nx * 90 + 7, ny * 90, 2, 61) - 0.5);
      const coat = pvFbm(fx * 5.0, fy * 4.4, 3, 63);
      let c = pvMix(under, guard, pvClamp((coat - 0.5) * 3.2 + 0.5));
      // A little sheen along the lie of the hair.
      const sheen = pvClamp((pvFbm(fx * 90, fy * 90, 1, 61) - 0.55) * 3);
      c = pvMix(c, [1, 1, 1], sheen * 0.18);
      pvPut(d, (y * W + x) * 4, c);
    }
  }
}

/* ── Which painter belongs to which gradient ──
/* ── Which painter belongs to which gradient ────────────────────────── */

/* A shaded metal card is drawn with the metal's own height field and its own
   default light, so Brushed Steel and Hammered Metal are visibly different
   cards rather than the same chrome swirl with two labels. */
function pvMetalCard(kind, o) {
  return (d, W, H, p) => pvShade(d, W, H, p, {
    kind: kind, env: o.env,
    bands: o.bands, relief: o.relief, shine: o.shine,
    lightAngle: o.lightAngle, lightHeight: o.lightHeight,
    ambient: o.ambient, specular: o.specular, tilt: o.tilt
  });
}

/* Coverage, sharpness and warp match each preset's defaults in
   js/controls.js — the card is the build, at its own settings. */
function pvPrintCard(o) {
  return (d, W, H, p) => pvPrint(d, W, H, p, o);
}

const PREVIEW_FAMILY = {
  SaaS:           pvSaaS,
  Halftone:       pvHalftone,
  CellularMosaic: pvCells,
  AnimeWater:     pvCells,   // same engine, so the card shows the same shape
  AnimeCells:     pvCells,

  Giraffe:        pvPlates,
  Tiger:          pvPrintCard({ sx: 22, sy: 1.1, oct: 3, coverage: 0.34, sharp: 70, warp: 0.05, seed: 3 }),
  Zebra:          pvPrintCard({ sx: 13, sy: 0.9, oct: 2, coverage: 0.45, sharp: 90, warp: 0.08, seed: 5 }),
  Leopard:        pvPrintCard({ sx: 5.5, sy: 5.5, oct: 3, coverage: 0.34, sharp: 18, warp: 0.03, seed: 9, rosette: true }),
  Fur:            pvFur,
  Cow:            pvPrintCard({ sx: 4.2, sy: 3.6, oct: 2, coverage: 0.42, sharp: 90, warp: 0.04, seed: 4 }),

  Sunburst:       pvRays,
  ReededGlass:    pvFluted,
  Glass:          pvGlass,

  Metallic:       pvChrome,   // Liquid Chrome is still ribbons, not a plate

  Polished:       pvMetalCard('Polished', { env: 'flow', bands: 5, relief: 0.12, shine: 90, lightAngle: 315, lightHeight: 0.55, ambient: 0.5,  specular: 1.0, tilt: 0.14 }),
  Brushed:        pvMetalCard('Brushed',  { env: 'plate', bands: 3, relief: 0.30, shine: 22, lightAngle: 300, lightHeight: 0.32, ambient: 0.55, specular: 0.6, tilt: 0.10 }),
  Gold:           pvMetalCard('Gold',     { env: 'flow', bands: 4, relief: 0.26, shine: 70, lightAngle: 320, lightHeight: 0.45, ambient: 0.5,  specular: 1.1, tilt: 0.18 }),
  Copper:         pvMetalCard('Copper',   { env: 'flow', bands: 4, relief: 0.22, shine: 60, lightAngle: 330, lightHeight: 0.48, ambient: 0.5,  specular: 0.95, tilt: 0.16 }),
  Gunmetal:       pvMetalCard('Gunmetal', { env: 'plate', bands: 6, relief: 0.34, shine: 12, lightAngle: 290, lightHeight: 0.26, ambient: 0.62, specular: 0.4, tilt: 0.12 }),
  Snakeskin:      pvMetalCard('Hammered', { env: 'plate', bands: 3, relief: 0.74, shine: 22, lightAngle: 305, lightHeight: 0.42, ambient: 0.62, specular: 0.38, tilt: 0.30 }),
  Hammered:       pvMetalCard('Hammered', { env: 'plate', bands: 4, relief: 0.55, shine: 55, lightAngle: 310, lightHeight: 0.38, ambient: 0.5,  specular: 0.9, tilt: 0.16 }),
  Foil:           pvMetalCard('Foil',     { env: 'flow', bands: 8, relief: 0.70, shine: 80, lightAngle: 305, lightHeight: 0.30, ambient: 0.45, specular: 1.2, tilt: 0.22 }),
  Mercury:        pvMetalCard('Mercury',  { env: 'flow', bands: 3, relief: 0.85, shine: 110, lightAngle: 315, lightHeight: 0.60, ambient: 0.4, specular: 1.3, tilt: 0.10 }),

  AsciiMatrix:    pvGrid,
  StackedSquares: pvGrid,
  TrailGradient:  pvThreads,
  WebThreads:     pvThreads,
  Waves:          pvThreads,
  Antigravity:    pvThreads,
  LiquidWaves:    (d, W, H, p) => pvRibbons(d, W, H, pvByLuma(p), 2.2, 1.4),
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
