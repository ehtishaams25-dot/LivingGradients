#!/usr/bin/env node
/* =====================================================================
   LIVING GRADIENTS - LOOP SEAM CHECK
   ---------------------------------------------------------------------
   Section 22 of the V2.2 brief: a gradient loop must not jump, snap or
   visibly reset when it repeats. This measures whether it does.

   THE MEASUREMENT. A loop's seam is the step from its last frame back to
   its first. That number means nothing on its own - a fast gradient
   changes a lot between any two frames - so it is compared against the
   step between the two frames just before it. A closed loop has a seam
   about the size of an ordinary frame-to-frame step. A loop that jumps
   has a seam several times larger.

   That ratio is the whole check, and it is the same one the crossfade in
   tools/encode_loops.ps1 was verified against on a synthetic ramp before
   any real footage existed: the step across the seam came out at 1.00,
   the same as any ordinary frame.

     node tools/loop_seam_check.js
     node tools/loop_seam_check.js --id Copper
   ===================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PREVIEWS = path.join(ROOT, 'css', 'previews');
const argv = process.argv.slice(2);
const WANT = argv.indexOf('--id') >= 0 ? argv[argv.indexOf('--id') + 1] : null;

function ffmpeg() {
  for (const c of ['ffmpeg', 'C:\\ffmpeg\\bin\\ffmpeg.exe']) {
    try { execFileSync(c, ['-version'], { stdio: 'ignore' }); return c; } catch (e) { /* next */ }
  }
  throw new Error('ffmpeg not found on PATH.');
}
const FFMPEG = ffmpeg();

/* Decode the whole clip small and grey. The seam is a whole-frame question,
   so full resolution and colour buy nothing and cost a lot: 160x90 luma is
   about 14 KB a frame and 240 frames fit in memory without thinking about it. */
const W = 160, H = 90;
function frames(file) {
  const buf = execFileSync(FFMPEG,
    ['-v', 'error', '-i', file, '-vf', 'scale=' + W + ':' + H + ',format=gray',
     '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
    { maxBuffer: 256 * 1024 * 1024 });
  const size = W * H;
  const out = [];
  for (let o = 0; o + size <= buf.length; o += size) out.push(buf.subarray(o, o + size));
  return out;
}

function diff(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}

const files = fs.readdirSync(PREVIEWS)
  .filter((f) => f.endsWith('.webm'))
  .filter((f) => !WANT || f === WANT + '.webm')
  .sort();

if (!files.length) {
  console.error('No .webm in css/previews. Run tools/encode_loops.ps1 first.');
  process.exit(1);
}

console.log('Living Gradients - loop seam check');
console.log('');
console.log('seam  = mean luma step from the last frame back to the first');
console.log('step  = mean luma step between the two frames before it');
console.log('ratio = seam / step. A closed loop is around 1. Over 3 jumps.');
console.log('');
console.log('GRADIENT'.padEnd(18) + 'FRAMES'.padStart(7) + 'SEAM'.padStart(8) +
            'STEP'.padStart(8) + 'RATIO'.padStart(8) + '  VERDICT');
console.log('-'.repeat(64));

let bad = 0, checked = 0;
const rows = [];

for (const f of files) {
  const id = f.slice(0, -5);
  let fr;
  try { fr = frames(path.join(PREVIEWS, f)); }
  catch (e) { console.log(id.padEnd(18) + '  DECODE FAILED: ' + e.message.split('\n')[0]); bad++; continue; }

  if (fr.length < 4) { console.log(id.padEnd(18) + '  too few frames (' + fr.length + ')'); bad++; continue; }

  const seam = diff(fr[fr.length - 1], fr[0]);
  const step = diff(fr[fr.length - 3], fr[fr.length - 2]);
  /* A gradient that barely moves has a step near zero, and dividing by it
     turns rounding noise into a huge ratio. */
  const ratio = step < 0.02 ? 1 : seam / step;

  /* THE RATIO ALONE IS NOT ENOUGH, and the first run of this proved it.
     Six loops were flagged as jumping - Tiger, Snakeskin, Fur, Leopard, Cow,
     Brushed - and every one is a near-static gradient where an ordinary frame
     step is 0.07 to 0.4 of a luma level. A seam eight times that is still only
     1.3 levels out of 255, which is half a percent of the range. The
     filmstrips across those seams are continuous to the eye.

     So a jump has to be large BOTH relative to the motion and in absolute
     terms. Two luma levels is the floor: below it there is nothing to see
     however large the multiple. */
  const verdict = (ratio > 3 && seam > 2.0) ? 'JUMPS'
                : (ratio > 2 && seam > 1.0) ? 'watch' : 'closed';
  if (verdict === 'JUMPS') bad++;
  checked++;
  rows.push({ id, n: fr.length, seam, step, ratio, verdict });
}

rows.sort((a, b) => b.ratio - a.ratio);
for (const r of rows) {
  console.log(r.id.padEnd(18) + String(r.n).padStart(7) +
              r.seam.toFixed(2).padStart(8) + r.step.toFixed(2).padStart(8) +
              r.ratio.toFixed(2).padStart(8) + '  ' + r.verdict);
}

console.log('-'.repeat(64));
console.log(checked + ' loops checked, ' + bad + ' that jump');
process.exit(bad ? 1 : 0);
