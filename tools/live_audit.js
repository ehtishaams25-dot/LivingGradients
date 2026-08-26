/* LIVE_AUDIT.JS — does every gradient in the library have a live tuner?
 *
 *   node tools/live_audit.js
 *   node tools/live_audit.js --json
 *
 * WHY THIS EXISTS
 *
 * A slider that does nothing is the worst kind of bug in a panel like this,
 * because it looks like it works. Twelve gradients shipped that way: the type
 * fell past every branch of updateGradientLive() and landed in SilkFlare's
 * code, which touched layers those gradients do not have and reported success.
 *
 * The guard added for that reports it at run time, which means somebody has to
 * build the gradient and drag the slider to find out. This asks the same
 * question statically, so the answer arrives at build time and stays answered.
 *
 * It also checks the other half: that every tuner the dispatch names is a
 * function that actually exists, and that every layer name a tuner is
 * registered against is a name some builder assigns. A tuner wired to
 * "Snakeskin Metal" when the builder makes "Hammered Metal" is a silent no-op
 * of exactly the kind this is here to prevent.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const jsx = fs.readFileSync(path.join(ROOT, 'jsx', 'main.jsx'), 'utf8');
const presets = fs.readFileSync(path.join(ROOT, 'js', 'presets.js'), 'utf8');

const asJson = process.argv.indexOf('--json') !== -1;

/* ── the library ────────────────────────────────────────────────────────── */

const libBlock = presets.match(/const GRADIENT_LIBRARY\s*=\s*\[([\s\S]*?)\n\];/);
if (!libBlock) {
  console.error('live_audit: could not find GRADIENT_LIBRARY in js/presets.js');
  process.exit(2);
}
const types = [];
const idRe = /\bid:\s*'([A-Za-z0-9_]+)'/g;
let m;
while ((m = idRe.exec(libBlock[1]))) types.push(m[1]);

/* ── what the live path handles ─────────────────────────────────────────── */

const liveFn = jsx.match(/function updateGradientLive\(paramsStr\)\s*\{([\s\S]*?)\n\}/);
if (!liveFn) {
  console.error('live_audit: could not find updateGradientLive in jsx/main.jsx');
  process.exit(2);
}
const live = liveFn[1];

function keysOfObject(src, name) {
  /* Non-greedy to the first closing brace-semicolon. These tables are written
     both ways in this file — some close on their own line, some at the end of
     the last entry — and an audit that only understands one of the two reports
     everything in the other as unhandled, which is a false alarm that trains
     people to ignore it. */
  const block = src.match(new RegExp('var ' + name + '\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*;'));
  if (!block) return [];
  const out = [];
  const re = /(?:^|[\n,{])\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g;
  let k;
  while ((k = re.exec(block[1]))) out.push(k[1]);
  return out;
}

const tunerKeys = keysOfObject(live, 'LIVE_TUNERS');
const aliasKeys = keysOfObject(live, 'LIVE_ALIAS');
const shadedKeys = keysOfObject(live, 'SHADED');
const silkKeys = keysOfObject(live, 'SILKFLARE');

/* Types handled by an explicit branch rather than a table. */
const branchKeys = [];
const branchRe = /ctrl\.type\s*===\s*['"]([A-Za-z0-9_]+)['"]/g;
while ((m = branchRe.exec(live))) branchKeys.push(m[1]);

/* Registered by loop — the animal prints. */
const loopKeys = [];
const loopRe = /var names = \[([^\]]*)\]/g;
while ((m = loopRe.exec(live))) {
  const names = m[1].match(/'([^']+)'/g) || [];
  for (const n of names) loopKeys.push(n.slice(1, -1));
}

const handled = new Set(
  [].concat(tunerKeys, aliasKeys, shadedKeys, silkKeys, branchKeys, loopKeys)
);

/* Animal prints inside LIVE_TUNERS are added at run time; the loop scrape
   above covers them, but only if that loop is still the shape it was. Flag it
   rather than assume. */
const loopStillThere = /LIVE_TUNERS\[names\[i\]\]/.test(live);

/* ── every tuner named must exist, and every layer name must be built ───── */

const declared = new Set();
const declRe = /^function\s+(\w+)/gm;
while ((m = declRe.exec(jsx))) declared.add(m[1]);

const namedTuners = [];
const fnRe = /\bfn:\s*(\w+)\s*[},]/g;
while ((m = fnRe.exec(live))) namedTuners.push(m[1]);
const missingTuners = namedTuners.filter((t) => !declared.has(t));

/* Layer names the dispatch expects. A name is "built" if it appears as a
   string anywhere in main.jsx outside updateGradientLive — every builder
   assigns them as literals. */
const outsideLive = jsx.replace(live, '');
const expectedLayers = [];
const layerRe = /\b(?:layer|name):\s*'([^']+)'/g;
while ((m = layerRe.exec(live))) expectedLayers.push(m[1]);
/* Several builders assemble a name rather than writing it out — "Square " + j,
   "Trail " + i. So a name counts as built if the whole string is in the source,
   or if the part before its trailing number is. */
function isBuilt(n) {
  if (outsideLive.indexOf("'" + n + "'") !== -1) return true;
  if (outsideLive.indexOf('"' + n + '"') !== -1) return true;
  const stem = n.replace(/\s*[0-9]+$/, ' ');
  if (stem !== n && stem.length > 1) {
    if (outsideLive.indexOf("'" + stem + "'") !== -1) return true;
    if (outsideLive.indexOf('"' + stem + '"') !== -1) return true;
  }
  return false;
}
const orphanLayers = expectedLayers.filter((n) => !isBuilt(n));

/* ── report ─────────────────────────────────────────────────────────────── */

const unhandled = types.filter((t) => !handled.has(t));

if (asJson) {
  process.stdout.write(JSON.stringify({
    total: types.length, unhandled, missingTuners, orphanLayers, loopStillThere
  }, null, 2));
  process.exit(unhandled.length || missingTuners.length || orphanLayers.length ? 1 : 0);
}

console.log('Living Gradients — live update audit');
console.log('library : js/presets.js (' + types.length + ' gradients)');
console.log('dispatch: updateGradientLive() in jsx/main.jsx');
console.log('');
console.log('  ' + (types.length - unhandled.length) + ' of ' + types.length +
            ' have a live path');

if (!loopStillThere) {
  console.log('');
  console.log('  NOTE: the animal-print registration loop has changed shape.');
  console.log('  This audit scrapes it by pattern; re-check it by hand.');
}

if (unhandled.length) {
  console.log('');
  console.log('NO LIVE TUNER — these fall through the dispatch, so their');
  console.log('sliders only take effect when the gradient is re-applied:');
  for (const t of unhandled) console.log('  ' + t);
}

if (missingTuners.length) {
  console.log('');
  console.log('TUNER NAMED BUT NOT DEFINED — this throws at run time:');
  for (const t of missingTuners) console.log('  ' + t);
}

if (orphanLayers.length) {
  console.log('');
  console.log('LAYER NAME NO BUILDER ASSIGNS — the tuner will never match,');
  console.log('which is the exact failure Snakeskin had:');
  for (const n of orphanLayers) console.log('  "' + n + '"');
}

console.log('');
const bad = unhandled.length || missingTuners.length || orphanLayers.length;
console.log(bad ? 'FAIL' : 'PASS');
process.exit(bad ? 1 : 0);
