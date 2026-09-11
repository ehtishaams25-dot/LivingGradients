#!/usr/bin/env node
/* =====================================================================
   LIVING GRADIENTS - QA ANALYSE
   ---------------------------------------------------------------------
   Reads the frames tools/qa_sweep.jsx wrote and turns them into numbers,
   so that a library of forty-odd gradients across four comp sizes and
   five points in time can be reviewed without a human looking at eight
   hundred pictures to find the six that are wrong.

   It measures the things section 5 and section 6 of the V2.2 brief call
   out by name:

     holes      transparency ENCLOSED by opaque pixels, found by flood
                filling inward from the frame edge. The brief's
                zero-tolerance item. Transparency that reaches the edge is
                a matte and is reported separately as CLEAR%.
     biggest    the largest single enclosed region, in pixels. A handful of
                stray pixels is antialiasing; four hundred is a hole.
     voids      fully black opaque pixels. A hole that has been filled in
                by something black underneath is still a hole, and alpha
                cannot see it.
     clipping   crushed blacks and blown highlights, separately.
     banding    how much of the luma range between the darkest and
                lightest pixel actually has pixels in it. A smooth 8-bit
                ramp fills nearly every level; a banded one leaves gaps,
                and the gaps are what the eye reads as stepping.
     flatness   how much of the frame has no local variation at all.
                A large flat field is either a deliberate backdrop or a
                builder that gave up, and the row tells you which.
     chroma     mean saturation, which is how Molten Silver was caught
                rendering gold.
     motion     mean absolute luma change between consecutive samples.
                Zero motion is a static gradient, which the library's own
                rules forbid.
     seam       the change from the last sample back to the first. A loop
                that jumps has a large seam against small motion.

   Decoding goes through ffmpeg rather than a PNG decoder written here.
   After Effects writes 8- or 16-bit PNG depending on project depth and
   ffmpeg normalises both to rgba, which is one less thing to be wrong
   about.

     node tools/qa_analyse.js                    every frame on disk
     node tools/qa_analyse.js --size 1920x1080   one comp size
     node tools/qa_analyse.js --id Copper        one gradient
     node tools/qa_analyse.js --json out.json    machine-readable too
   ===================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FRAMES = path.join(ROOT, 'tools', 'qa', 'frames');

/* ---- argv ---------------------------------------------------------- */

const argv = process.argv.slice(2);
function flag(name, fallback) {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}
const WANT_SIZE = flag('size', null);
const WANT_ID = flag('id', null);
const JSON_OUT = flag('json', null);

/* ---- decode -------------------------------------------------------- */

function ffmpegPath() {
  for (const candidate of ['ffmpeg', 'C:\\ffmpeg\\bin\\ffmpeg.exe']) {
    try {
      execFileSync(candidate, ['-version'], { stdio: 'ignore' });
      return candidate;
    } catch (e) { /* try the next one */ }
  }
  throw new Error('ffmpeg not found on PATH. It decodes the frames; install it or edit ffmpegPath().');
}
const FFMPEG = ffmpegPath();

/* Raw RGBA, straight out of ffmpeg. maxBuffer is set for a 4K frame
   (3840*2160*4 = 33MB) with room over it, because the default 1MB silently
   truncates and a truncated frame measures as a frame full of holes. */
function decode(file) {
  const out = execFileSync(FFMPEG,
    ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
    { maxBuffer: 64 * 1024 * 1024 });
  return out;
}

function dimensions(file) {
  const out = execFileSync(FFMPEG, ['-v', 'error', '-i', file, '-f', 'null', '-'],
    { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  return out;
}

/* ---- measurement --------------------------------------------------- */

function measure(buf, w, h) {
  const n = w * h;
  let holes = 0, voids = 0, crushed = 0, blown = 0;
  let sumL = 0, sumL2 = 0, sumC = 0;
  const hist = new Uint32Array(256);
  const luma = new Uint8Array(n);
  const alpha = new Uint8Array(n);

  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = buf[p], g = buf[p + 1], b = buf[p + 2], a = buf[p + 3];
    alpha[i] = a;
    if (a < 250) holes++;

    /* Rec.709, integer, because this only has to rank frames against each
       other and a float luma costs 20% of the run for no extra truth. */
    const l = (r * 54 + g * 183 + b * 19) >> 8;
    luma[i] = l;
    hist[l]++;
    sumL += l;
    sumL2 += l * l;

    const mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
    const mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
    sumC += (mx - mn);

    if (a >= 250) {
      if (mx < 6) voids++;
      if (l < 3) crushed++;
      if (mn > 250) blown++;
    }
  }

  const meanL = sumL / n;
  const varL = Math.max(0, sumL2 / n - meanL * meanL);

  /* Banding. Over the range the frame actually occupies, how many levels
     have any pixels at all. A smooth ramp fills nearly all of them; a
     posterised one leaves the gaps the eye reads as steps.

     Levels holding fewer than one pixel in 100000 are counted as empty, so
     a handful of stray pixels cannot paper over a real gap. */
  let lo = 0; while (lo < 256 && hist[lo] === 0) lo++;
  let hi = 255; while (hi > lo && hist[hi] === 0) hi--;
  const floor = Math.max(1, Math.floor(n / 100000));
  let occupied = 0;
  for (let l = lo; l <= hi; l++) if (hist[l] >= floor) occupied++;
  const span = Math.max(1, hi - lo + 1);
  const fill = occupied / span;

  /* Flatness: the fraction of pixels identical to both the pixel to the
     right and the pixel below. Sampled on a grid rather than every pixel -
     the answer is stable to three decimals at 1 in 4 and costs a quarter as
     much. */
  let flat = 0, sampled = 0;
  for (let y = 0; y < h - 1; y += 2) {
    for (let x = 0; x < w - 1; x += 2) {
      const i = y * w + x;
      sampled++;
      if (luma[i] === luma[i + 1] && luma[i] === luma[i + w]) flat++;
    }
  }

  /* A HOLE IS NOT THE SAME THING AS TRANSPARENCY, and telling them apart
     took two goes.

     First problem: ten gradients came back at "100% holes" and every one was a
     SilkFlare-family look - a blurred colour field through a rotating shape
     matte, so most of the frame is transparent because that is the design.
     Transparency alone says nothing.

     Second problem, and this one hid a real defect. The fix for the first was
     to look for a transparent pixel with opaque pixels a fixed short distance
     away on all four sides. That finds a pinhole and CANNOT find anything
     bigger than twice the distance it looks: a 95x132 elliptical hole punched
     through the middle of Molten Copper at 1080x1920 measured 0.0000%, because
     every pixel inside it has more hole around it than the probe could reach.
     A detector that only sees small holes is worse than none, because it
     reports zero and is believed.

     So: flood-fill the transparent pixels that touch the frame edge. Those are
     the outside - a matte, a vignette, the empty half of a flare. Every
     transparent pixel the fill does not reach is enclosed by opaque pixels,
     which is what a tear is, at any size. No scale to tune and nothing to get
     wrong.

     Iterative, with an explicit stack rather than recursion: a 4K frame is
     8.3M pixels and ExtendScript is not the only runtime with a call-stack
     limit worth respecting. */
  const CLEAR = 250;
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  let sp = 0;

  function push(i) {
    if (seen[i] || alpha[i] >= CLEAR) return;
    seen[i] = 1;
    stack[sp++] = i;
  }

  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }

  while (sp > 0) {
    const i = stack[--sp];
    const x = i % w, y = (i / w) | 0;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }

  /* Enclosed transparency, and the largest single region of it - a thousand
     scattered pixels along an edge and one hole through the middle are not the
     same defect, and the maximum is what a person would notice. */
  let enclosed = 0;
  const region = new Uint8Array(n);
  let biggest = 0;
  for (let i = 0; i < n; i++) {
    if (alpha[i] >= CLEAR || seen[i] || region[i]) continue;
    let size = 0;
    sp = 0;
    region[i] = 1;
    stack[sp++] = i;
    while (sp > 0) {
      const j = stack[--sp];
      size++;
      const x = j % w, y = (j / w) | 0;
      const nb = [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1,
                  y > 0 ? j - w : -1, y < h - 1 ? j + w : -1];
      for (const k of nb) {
        if (k < 0 || region[k] || seen[k] || alpha[k] >= CLEAR) continue;
        region[k] = 1;
        stack[sp++] = k;
      }
    }
    enclosed += size;
    if (size > biggest) biggest = size;
  }

  return {
    pinholes: enclosed / n,
    biggestHole: biggest,
    holes: holes / n,
    voids: voids / n,
    crushed: crushed / n,
    blown: blown / n,
    meanLuma: meanL,
    stdLuma: Math.sqrt(varL),
    meanChroma: sumC / n,
    lumaLo: lo, lumaHi: hi,
    bandFill: fill,
    flat: flat / Math.max(1, sampled),
    luma
  };
}

function meanAbsDiff(a, b) {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]);
  return s / n;
}

/* ---- walk ---------------------------------------------------------- */

if (!fs.existsSync(FRAMES)) {
  console.error('No frames at ' + FRAMES + '. Run tools/qa_sweep.jsx first.');
  process.exit(1);
}

const ids = fs.readdirSync(FRAMES).filter((d) => {
  if (WANT_ID && d !== WANT_ID) return false;
  return fs.statSync(path.join(FRAMES, d)).isDirectory();
}).sort();

const report = [];

for (const id of ids) {
  const dir = path.join(FRAMES, id);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png'));

  /* <W>x<H>_t<pct>.png */
  const bySize = new Map();
  for (const f of files) {
    const m = /^(\d+)x(\d+)_t(\d+)\.png$/.exec(f);
    if (!m) continue;
    const size = m[1] + 'x' + m[2];
    if (WANT_SIZE && size !== WANT_SIZE) continue;
    if (!bySize.has(size)) bySize.set(size, []);
    bySize.get(size).push({ file: path.join(dir, f), w: +m[1], h: +m[2], pct: +m[3] });
  }

  for (const [size, list] of bySize) {
    list.sort((a, b) => a.pct - b.pct);
    const frames = [];
    let failed = null;

    for (const item of list) {
      try {
        const buf = decode(item.file);
        const expect = item.w * item.h * 4;
        if (buf.length < expect) {
          failed = 'decoded ' + buf.length + ' bytes, expected ' + expect;
          break;
        }
        frames.push(Object.assign({ pct: item.pct }, measure(buf, item.w, item.h)));
      } catch (e) {
        failed = e.message.split('\n')[0];
        break;
      }
    }

    if (failed || !frames.length) {
      report.push({ id, size, error: failed || 'no frames' });
      continue;
    }

    /* Worst case across time, not the average. A gradient that tears only at
       75% is a gradient that tears. */
    const worst = (key) => frames.reduce((m, f) => Math.max(m, f[key]), 0);
    const avg = (key) => frames.reduce((s, f) => s + f[key], 0) / frames.length;

    let motion = 0, motionN = 0;
    for (let i = 1; i < frames.length; i++) {
      motion += meanAbsDiff(frames[i - 1].luma, frames[i].luma);
      motionN++;
    }
    motion = motionN ? motion / motionN : 0;

    const seam = frames.length > 1
      ? meanAbsDiff(frames[frames.length - 1].luma, frames[0].luma)
      : 0;

    report.push({
      id, size,
      samples: frames.length,
      pinholes: worst('pinholes'),
      biggestHole: worst('biggestHole'),
      holes: worst('holes'),
      voids: worst('voids'),
      crushed: worst('crushed'),
      blown: worst('blown'),
      meanLuma: avg('meanLuma'),
      stdLuma: avg('stdLuma'),
      meanChroma: avg('meanChroma'),
      bandFill: Math.min(...frames.map((f) => f.bandFill)),
      flat: worst('flat'),
      motion,
      seam
    });
  }
}

/* ---- print --------------------------------------------------------- */

function pct(x) { return (x * 100).toFixed(3).padStart(8); }
function num(x, d) { return x.toFixed(d === undefined ? 2 : d); }

const FLAGS = (r) => {
  const out = [];
  /* A HOLE IS ENCLOSED TRANSPARENCY IN AN OTHERWISE OPAQUE FIELD, and that
     second half matters as much as the first.

     Prismatic Burst is a radial fan of rays on transparency - 88% of the frame
     is clear by design - and where two rays cross they close off a pocket of
     background. The flood fill calls that enclosed, correctly, and it is not a
     tear: it is a gap in a design made of gaps.

     Molten Copper at 1080x1920 is 99.5% opaque with one clean 10,709-pixel
     ellipse punched through it. Same measurement, entirely different defect.

     So the field has to be opaque for enclosure to mean damage. Ten percent
     clear is the line: above it the gradient is an element rather than a
     background, and its holes are its shape. */
  const opaqueField = r.holes < 0.10;
  if (r.biggestHole >= 400 && opaqueField) out.push('HOLES');
  else if (r.pinholes > 0.0002 && opaqueField) out.push('speckle');
  if (r.holes > 0.02) out.push('matte');
  if (r.voids > 0.005) out.push('VOIDS');
  if (r.crushed > 0.08) out.push('CRUSHED');
  if (r.blown > 0.08) out.push('BLOWN');
  if (r.bandFill < 0.55) out.push('BANDING');
  /* Flatness alone says nothing - a smooth 8-bit ramp is mostly pixels equal
     to their neighbours. It is only a defect when there is no tonal range
     either, which is what a builder that gave up actually produces. */
  if (r.flat > 0.88 && r.stdLuma < 14) out.push('FLAT');
  if (r.motion < 0.35) out.push('STATIC');
  if (r.motion > 0.5 && r.seam > r.motion * 1.8) out.push('SEAM');
  if (r.meanChroma < 4) out.push('GREY');
  return out;
};

console.log('Living Gradients - QA analysis');
console.log(new Date().toISOString().slice(0, 19).replace('T', ' '));
console.log('');
console.log('holes/voids/crushed/blown are percentages of the frame, worst sample.');
console.log('bandFill 1.00 = every luma level between darkest and lightest is used.');
console.log('motion/seam are mean absolute luma change, 0-255.');
console.log('');

const head = ['GRADIENT', 'SIZE', 'ENCL%', 'BIGGEST', 'CLEAR%', 'VOIDS%', 'CRUSH%', 'BLOWN%', 'BAND', 'FLAT', 'CHROMA', 'MOTION', 'SEAM', 'FLAGS'];
console.log(
  head[0].padEnd(17) + head[1].padEnd(11) +
  head[2].padStart(8) + head[3].padStart(9) +
  head[4].padStart(8) + head[5].padStart(8) + head[6].padStart(8) + head[7].padStart(8) +
  head[8].padStart(6) + head[9].padStart(6) + head[10].padStart(8) +
  head[11].padStart(8) + head[12].padStart(8) + '  ' + head[13]);
console.log('-'.repeat(130));

let flagged = 0;
for (const r of report) {
  if (r.error) {
    console.log(r.id.padEnd(17) + r.size.padEnd(11) + '  ERROR  ' + r.error);
    flagged++;
    continue;
  }
  const f = FLAGS(r);
  if (f.length) flagged++;
  console.log(
    r.id.padEnd(17) + r.size.padEnd(11) +
    (r.pinholes * 100).toFixed(4).padStart(8) +
    String(r.biggestHole).padStart(9) +
    pct(r.holes) + pct(r.voids) + pct(r.crushed) + pct(r.blown) +
    num(r.bandFill).padStart(6) + num(r.flat).padStart(6) +
    num(r.meanChroma, 1).padStart(8) +
    num(r.motion, 2).padStart(8) + num(r.seam, 2).padStart(8) +
    '  ' + f.join(' '));
}

console.log('-'.repeat(130));
console.log(report.length + ' rows, ' + flagged + ' flagged');

if (JSON_OUT) {
  fs.writeFileSync(path.resolve(JSON_OUT), JSON.stringify(report, null, 2));
  console.log('json -> ' + JSON_OUT);
}
