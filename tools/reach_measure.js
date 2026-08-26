/* REACH_MEASURE.JS — read the frames tools/reach_calibrate.jsx rendered and
 * report how far a Turbulent Displace actually reaches.
 *
 *   node tools/reach_measure.js
 *   node tools/reach_measure.js --json
 *
 * The other half of the calibration. After Effects can render a frame and
 * cannot read a pixel; Node can read a pixel and cannot render a frame. So the
 * .jsx renders a flat white solid exactly filling its comp, with a Turbulent
 * Displace on it, across a sweep of Amount, Size, mode and Evolution — and this
 * decodes each PNG and measures the deepest point at which transparency
 * reached in from an edge.
 *
 * That depth IS the reach. There is nothing outside the layer, so a transparent
 * pixel 700px in from the edge means the effect fetched from 700px past it.
 *
 * WHAT TO DO WITH THE ANSWER
 *
 * The fitted slope printed at the end is LG_REACH_PER_AMOUNT in jsx/main.jsx.
 * It is currently 3.2, inferred from three rendered frames and padded ~15%.
 * Replace it with (measured slope x 1.15) and the displacement budget stops
 * being an estimate.
 *
 * PNG decoding is done here rather than by pulling in a library: the frames are
 * 8-bit RGBA non-interlaced, which is two hundred lines with zlib, and a
 * diagnostic that needs an npm install is a diagnostic nobody runs.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'tools', 'reach');
const asJson = process.argv.indexOf('--json') !== -1;

/* ── PNG → { width, height, alpha: Uint8Array } ──────────────────────────── */

function readChunks(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) {
    throw new Error('not a PNG');
  }
  const chunks = [];
  let at = 8;
  while (at + 8 <= buf.length) {
    const len = buf.readUInt32BE(at);
    const type = buf.toString('ascii', at + 4, at + 8);
    chunks.push({ type, data: buf.slice(at + 8, at + 8 + len) });
    at += 12 + len;              // length + type + data + crc
    if (type === 'IEND') break;
  }
  return chunks;
}

function decodeAlpha(file) {
  const chunks = readChunks(fs.readFileSync(file));
  const ihdr = chunks.find((c) => c.type === 'IHDR');
  if (!ihdr) throw new Error('no IHDR');

  const width = ihdr.data.readUInt32BE(0);
  const height = ihdr.data.readUInt32BE(4);
  const depth = ihdr.data[8];
  const colour = ihdr.data[9];
  const interlace = ihdr.data[12];

  if (interlace !== 0) throw new Error('interlaced PNGs are not supported');
  if (depth !== 8 && depth !== 16) throw new Error('unsupported bit depth ' + depth);

  /* Colour types: 0 grey, 2 RGB, 3 palette, 4 grey+alpha, 6 RGBA. Only the two
     with an alpha channel can answer the question being asked; anything else
     means the render lost the alpha and the measurement is meaningless. */
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colour];
  if (channels === undefined) throw new Error('unknown colour type ' + colour);
  if (colour !== 4 && colour !== 6) {
    throw new Error('this frame has no alpha channel (colour type ' + colour + ') — ' +
                    're-render with an RGB+Alpha output module');
  }

  const bytesPerSample = depth / 8;
  const bpp = channels * bytesPerSample;          // bytes per pixel
  const stride = width * bpp;

  const idat = Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data));
  const raw = zlib.inflateSync(idat);

  const alpha = new Uint8Array(width * height);
  const prev = Buffer.alloc(stride);
  const line = Buffer.alloc(stride);
  let at = 0;

  for (let y = 0; y < height; y++) {
    const filter = raw[at++];
    raw.copy(line, 0, at, at + stride);
    at += stride;

    /* The five PNG filter types, straight from the spec. `bpp` is the
       "corresponding byte in the pixel to the left" distance. */
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      switch (filter) {
        case 0: break;
        case 1: line[x] = (line[x] + a) & 0xff; break;
        case 2: line[x] = (line[x] + b) & 0xff; break;
        case 3: line[x] = (line[x] + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          const pred = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
          line[x] = (line[x] + pred) & 0xff;
          break;
        }
        default: throw new Error('bad filter type ' + filter + ' on row ' + y);
      }
    }
    line.copy(prev, 0, 0, stride);

    const alphaOffset = (channels - 1) * bytesPerSample;
    for (let x = 0; x < width; x++) {
      alpha[y * width + x] = line[x * bpp + alphaOffset];   // high byte if 16-bit
    }
  }

  return { width, height, alpha };
}

/* ── how far in from each edge did transparency get? ─────────────────────── */

/* Anything below this is a hole. Not 255: displacement antialiasing leaves a
   one-pixel fringe of partial alpha along a perfectly healthy edge, and
   counting that as a tear would report a reach of 1 for every cell. */
const OPAQUE_ENOUGH = 250;

/* The reach is the distance from the nearest edge to the DEEPEST transparent
   pixel, and it has to be computed per pixel rather than per edge.

   Doing it per edge is wrong and quietly so: a hole confined to the top hundred
   rows sets a "distance from the bottom edge" of the full frame height, because
   the pixel at y=0 is indeed h away from the bottom. Every cell then reports a
   reach of h and the sweep is useless. A hole is only evidence of a reach as
   long as its shortest path out. */
function measure(img) {
  const { width: w, height: h, alpha } = img;
  let holes = 0;
  let deepest = 0;
  let at = null;

  for (let y = 0; y < h; y++) {
    const fromTop = y + 1;
    const fromBottom = h - y;
    const vert = fromTop < fromBottom ? fromTop : fromBottom;
    /* No pixel in this row can be deeper than its own distance to the top or
       bottom edge, so once that is under the best so far the row cannot beat
       it. On a clean frame this skips almost everything. */
    if (vert <= deepest) continue;

    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (alpha[row + x] >= OPAQUE_ENOUGH) continue;
      holes++;
      const fromLeft = x + 1;
      const fromRight = w - x;
      const horiz = fromLeft < fromRight ? fromLeft : fromRight;
      const d = vert < horiz ? vert : horiz;
      if (d > deepest) { deepest = d; at = [x, y]; }
    }
  }

  /* The early-exit above stops counting once it cannot improve the answer, so
     `holes` is a lower bound on the hole area rather than the total. It is only
     used as a yes/no, and the deepest point is what the sweep is measuring. */
  const half = Math.min(w, h) / 2;
  return {
    holes,
    reach: deepest,
    at,
    /* Tears from opposite edges have met in the middle: the layer was too
       small for this setting, so the answer is a floor, not a value. */
    saturated: deepest >= half - 2
  };
}

/* ── run ────────────────────────────────────────────────────────────────── */

if (!fs.existsSync(path.join(DIR, 'manifest.json'))) {
  console.error('No sweep found in tools/reach/.');
  console.error('Run tools/reach_calibrate.jsx from After Effects first:');
  console.error('  File > Scripts > Run Script File... > tools/reach_calibrate.jsx');
  process.exit(2);
}

const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));

/* Three evolutions per setting; the worst one is the answer, because a
   gradient that tears on one frame in three has torn. */
const worst = new Map();
const errors = [];

for (const cell of manifest.cells) {
  const file = path.join(DIR, cell.file);
  if (!fs.existsSync(file)) { errors.push(cell.file + ': missing'); continue; }
  let m;
  try {
    m = measure(decodeAlpha(file));
  } catch (e) {
    errors.push(cell.file + ': ' + e.message);
    continue;
  }
  const key = cell.mode + '/' + cell.amount + '/' + cell.size;
  const prevBest = worst.get(key);
  if (!prevBest || m.reach > prevBest.reach) {
    worst.set(key, Object.assign({}, cell, m));
  }
}

const rows = [...worst.values()].sort((a, b) =>
  a.mode - b.mode || a.size - b.size || a.amount - b.amount);

if (asJson) {
  process.stdout.write(JSON.stringify({ layer: manifest.layer, rows, errors }, null, 2));
  process.exit(errors.length ? 1 : 0);
}

const MODE = { 4: 'Turbulent Smoother', 6: 'Twist Smoother' };

console.log('Living Gradients — displacement reach');
console.log('rendered on AE ' + manifest.ae + ', ' + manifest.when);
console.log('layer ' + manifest.layer + 'x' + manifest.layer +
            ' (so anything past ' + (manifest.layer / 2) + 'px cannot be measured)');
console.log('worst of ' + [...new Set(manifest.cells.map((c) => c.evolution))].length +
            ' evolutions per setting');
console.log('');
console.log('  MODE                 AMOUNT   SIZE   REACH   REACH/AMOUNT');
console.log('  ' + '-'.repeat(60));

for (const r of rows) {
  const ratio = r.amount ? (r.reach / r.amount) : 0;
  console.log(
    '  ' + (MODE[r.mode] || ('mode ' + r.mode)).padEnd(20) +
    String(r.amount).padStart(6) +
    String(r.size).padStart(7) +
    String(r.reach).padStart(8) +
    (r.reach ? ratio.toFixed(2) : '   -').padStart(15) +
    (r.saturated ? '   SATURATED — layer too small to measure this' : '')
  );
}

/* Fit through the origin: reach = k x amount. Least squares on a line with no
   intercept is just sum(xy)/sum(xx), and forcing it through zero is right —
   an Amount of nothing reaches nowhere. Saturated rows are excluded because
   their reach is a floor rather than a value. */
function fit(subset) {
  let sxy = 0, sxx = 0, n = 0;
  for (const r of subset) {
    if (r.saturated || !r.reach) continue;
    sxy += r.amount * r.reach;
    sxx += r.amount * r.amount;
    n++;
  }
  return n ? { k: sxy / sxx, n } : null;
}

console.log('');

const passA = rows.filter((r) => r.mode === 4 && r.size === 620);
const a = fit(passA);
if (a) {
  console.log('Turbulent Smoother at Size 620: reach = ' + a.k.toFixed(2) +
              ' x Amount   (' + a.n + ' points)');
}

const passC = rows.filter((r) => r.mode === 6);
const c = fit(passC);
if (c) {
  console.log('Twist Smoother at Size 620:     reach = ' + c.k.toFixed(2) +
              ' x Amount   (' + c.n + ' points)');
}

const passB = rows.filter((r) => r.mode === 4 && r.amount === 150 && !r.saturated && r.reach);
if (passB.length > 1) {
  const lo = passB[0], hi = passB[passB.length - 1];
  const sizeRatio = hi.size / lo.size;
  const reachRatio = hi.reach / lo.reach;
  console.log('');
  console.log('Size sweep at Amount 150: Size x' + sizeRatio.toFixed(1) +
              ' changed the reach x' + reachRatio.toFixed(2) + '.');
  console.log(reachRatio > 1.6
    ? '  Size matters. The budget in jsx/main.jsx assumes it does not — it needs\n' +
      '  a reach(amount, size) function, not a single constant.'
    : '  Size barely matters, which is what the budget in jsx/main.jsx assumes.');
}

const k = Math.max(a ? a.k : 0, c ? c.k : 0);
if (k) {
  console.log('');
  console.log('  Set LG_REACH_PER_AMOUNT in jsx/main.jsx to ' + (k * 1.15).toFixed(2) +
              '   (measured ' + k.toFixed(2) + ', +15% margin)');
}

if (errors.length) {
  console.log('');
  console.log(errors.length + ' frame(s) could not be read:');
  for (const e of errors.slice(0, 10)) console.log('  ' + e);
}

process.exit(errors.length ? 1 : 0);
