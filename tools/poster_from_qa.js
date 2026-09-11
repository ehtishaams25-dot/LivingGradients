#!/usr/bin/env node
/* =====================================================================
   LIVING GRADIENTS - POSTERS FROM THE QA FRAMES
   ---------------------------------------------------------------------
   Writes css/previews/<id>.png for every gradient that has QA frames but
   no rendered loop yet, and rewrites css/previews/index.json.

   WHY THIS EXISTS ALONGSIDE tools/encode_loops.ps1

   The canonical pipeline is render -> encode -> index, and the poster it
   produces comes out of frame 0 of the *encoded* loop. That is not a
   detail: the encoder crossfades a one-second tail over the head to close
   the loop, so frame 0 of the encode is not frame 0 of the source, and a
   poster taken from the source would jump the instant a card was hovered.

   But the whole library is roughly three hours of rendering, and until it
   is done thirty-nine of the forty-three cards fall back to a canvas
   painter that this project's own record calls a known-wrong imitation -
   three metals that look nothing alike drawn as one shape in three tints.
   The QA sweep has already built and rendered every gradient at 1920x1080
   for the visual pass, so the frames to fix that are sitting on disk.

   THE JUMP CANNOT HAPPEN FOR THESE, because a gradient with a poster and
   no loop has nothing to switch to on hover. index.json carries `cards`
   and `loops` as separate lists for exactly this case. So:

     - a gradient that already has a .webm is LEFT ALONE. Its poster came
       from its loop and must keep coming from its loop.
     - a gradient with no .webm gets a poster from its QA frame.
     - when the loop is eventually rendered, encode_loops.ps1 overwrites
       the poster from the encode, and correctness is restored by
       construction rather than by remembering to do it.

   The crop matches too. Loops are 1920x1080 scaled to cover 640x360; both
   are 16:9, so scaling the same source frame to 480x270 is the identical
   framing.

     node tools/poster_from_qa.js            write posters and the index
     node tools/poster_from_qa.js --dry      say what it would do
   ===================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FRAMES = path.join(ROOT, 'tools', 'qa', 'frames');
const PREVIEWS = path.join(ROOT, 'css', 'previews');
const DRY = process.argv.includes('--dry');

/* Same width the encoder uses, so a poster written here and a poster written
   there are interchangeable. */
const POSTER_W = 480;
const POSTER_H = 270;

/* Halfway through the animation, not frame 0. Several gradients ease in from
   a flat field, so their first frame is the least representative one they
   have - and a card is a picture of what the gradient IS. */
const PREFERRED = ['50', '25', '75', '0', '100'];

function ffmpeg() {
  for (const c of ['ffmpeg', 'C:\\ffmpeg\\bin\\ffmpeg.exe']) {
    try { execFileSync(c, ['-version'], { stdio: 'ignore' }); return c; } catch (e) { /* next */ }
  }
  throw new Error('ffmpeg not found on PATH.');
}
const FFMPEG = ffmpeg();

if (!fs.existsSync(FRAMES)) {
  console.error('No QA frames at ' + FRAMES + '. Run tools/qa_sweep.jsx first.');
  process.exit(1);
}
fs.mkdirSync(PREVIEWS, { recursive: true });

const ids = fs.readdirSync(FRAMES)
  .filter((d) => fs.statSync(path.join(FRAMES, d)).isDirectory() && d.indexOf('__') < 0)
  .sort();

let wrote = 0, kept = 0, missed = 0;

for (const id of ids) {
  const dir = path.join(FRAMES, id);
  const webm = path.join(PREVIEWS, id + '.webm');

  if (fs.existsSync(webm)) {
    console.log(id.padEnd(18) + 'has a loop - poster left alone');
    kept++;
    continue;
  }

  const files = fs.readdirSync(dir);
  let src = null;
  for (const pct of PREFERRED) {
    const hit = files.find((f) => /^\d+x\d+_t/.test(f) && f.endsWith('_t' + pct + '.png'));
    if (hit) { src = path.join(dir, hit); break; }
  }
  if (!src) {
    console.log(id.padEnd(18) + 'NO USABLE FRAME');
    missed++;
    continue;
  }

  const out = path.join(PREVIEWS, id + '.png');
  if (DRY) {
    console.log(id.padEnd(18) + 'would write from ' + path.basename(src));
    wrote++;
    continue;
  }

  /* Scaled to cover and centre-cropped, so a source that is not 16:9 - a
     portrait QA sweep, say - still frames the same way the loop would. */
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', src,
    '-vf', 'scale=' + POSTER_W + ':' + POSTER_H + ':force_original_aspect_ratio=increase,' +
           'crop=' + POSTER_W + ':' + POSTER_H,
    '-frames:v', '1', out]);
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(id.padEnd(18) + 'poster from ' + path.basename(src) + '  (' + kb + ' KB)');
  wrote++;
}

/* ---- index.json ----------------------------------------------------
   Same shape and same rule as the encoder's: the index is the allowlist for
   the panel and for tools/build.ps1 alike, and it is derived from what is
   actually on disk rather than from the library list. A name in the index
   with no file behind it is a 404 in a customer's console. */
if (!DRY) {
  const onDisk = fs.readdirSync(PREVIEWS);
  const cards = onDisk.filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)).sort();
  const loops = onDisk.filter((f) => f.endsWith('.webm')).map((f) => f.slice(0, -5)).sort();
  const index = {
    rendered: new Date().toISOString().slice(0, 19).replace('T', ' '),
    cards, loops
  };
  fs.writeFileSync(path.join(PREVIEWS, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  console.log('');
  console.log('index.json  ' + cards.length + ' cards, ' + loops.length + ' loops');
}

console.log('');
console.log(wrote + ' written, ' + kept + ' left alone, ' + missed + ' with no frame');
