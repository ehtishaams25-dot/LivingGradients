/* INDEX_AUDIT.JS — are the index fallbacks in jsx/main.jsx actually right?
 *
 * Run with Node on the dev machine. Nothing here touches After Effects.
 *
 *   node tools/index_audit.js
 *   node tools/index_audit.js --json      (machine-readable, for build.ps1)
 *
 * WHY THIS EXISTS
 *
 * Every property write in jsx/main.jsx goes through LG.set / LG.expr, which
 * resolve a property three ways in order: the display name, a normalised scan
 * of the effect's own properties, then the 1-based index. On an English host
 * the name wins and the index is never consulted, so a wrong index is
 * invisible — it sits in the file looking correct for years.
 *
 * On a host in another language the name and the scan both miss and the index
 * is all there is. A wrong index does not fail; it sets a DIFFERENT parameter.
 * `safeEx(turb, "Evolution", 5, ...)` puts a time expression on Turbulent
 * Displace's Complexity, which is a dropdown. That is worse than not writing
 * at all, and it only ever happens to customers, never here.
 *
 * tools/effect_probe_report.txt is a real dump from an installed After Effects
 * and is the ground truth. This walks every call site, works out which effect
 * the variable holds, and compares.
 *
 * WHAT IT CAN AND CANNOT SEE
 *
 * It binds a variable to an effect when it is assigned from addFx / lgFx /
 * lgFxNamed / findFx / LG.add with a literal name list, within the same
 * function. That covers essentially every call site in this file. Anything it
 * cannot resolve is reported as "unresolved" rather than guessed at, and
 * effects missing from the probe report are counted separately — an audit that
 * quietly skips what it does not understand is not an audit.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PROBE = path.join(ROOT, 'tools', 'effect_probe_report.txt');
const SOURCE = path.join(ROOT, 'jsx', 'main.jsx');

const asJson = process.argv.indexOf('--json') !== -1;

/* ── 1. the probe dump → { matchName: { normalisedPropName: index } } ────── */

function parseProbe(text) {
  const byMatch = {};
  const titleOf = {};
  let current = null;

  for (const raw of text.split(/\r?\n/)) {
    const head = raw.match(/^###\s+(.*?)\s+\{(.+?)\}\s*$/);
    if (head) {
      current = head[2];
      titleOf[current] = head[1];
      byMatch[current] = {};
      continue;
    }
    if (!current) continue;

    /* "    2    Amount       ADBE Turbulent Displace-0002    1D    64"
       The name can contain spaces, so anchor on the matchName column. */
    const row = raw.match(/^\s{2,}(\d+)\s+(.*?)\s{2,}(\S.*?)\s{2,}/);
    if (!row) continue;
    const idx = parseInt(row[1], 10);
    const name = row[2].trim();
    if (!name) continue; // unnamed group placeholders
    /* First occurrence wins, because that is what LG.find does: its scan runs
       1..numProperties and returns the first normalised match. 4-Color
       Gradient has two properties called "Color 4" — the colour at 9 and a
       group at 10 — and only the one the resolver would actually reach is the
       right answer here. */
    if (byMatch[current][norm(name)] === undefined) byMatch[current][norm(name)] = idx;
  }
  return { byMatch, titleOf };
}

function norm(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/* ── 2. logical name → matchName, mirroring LG's own table ───────────────── */

/* Read straight out of the source so the two can never drift. */
function parseAliasTable(src) {
  const alias = {};   // any string a call site might pass -> canonical matchName

  const fxBlock = src.match(/var FX = \{([\s\S]*?)\n    \};/);
  if (fxBlock) {
    const entryRe = /^\s*(\w+):\s*\[([^\]]*)\]/gm;
    let m;
    while ((m = entryRe.exec(fxBlock[1]))) {
      const names = m[2].match(/"([^"]+)"/g) || [];
      const clean = names.map((n) => n.slice(1, -1));
      if (!clean.length) continue;
      const canonical = clean[0];
      for (const n of clean) alias[n] = canonical;
    }
  }

  const aliasBlock = src.match(/var ALIASES = \{([\s\S]*?)\n    \};/);
  if (aliasBlock && fxBlock) {
    /* ALIASES maps a legacy string to a logical key; resolve the key through
       FX to get the matchName. */
    const keyToMatch = {};
    const entryRe = /^\s*(\w+):\s*\[\s*"([^"]+)"/gm;
    let m;
    while ((m = entryRe.exec(fxBlock[1]))) keyToMatch[m[1]] = m[2];

    const aliasRe = /"([^"]+)":\s*"(\w+)"/g;
    while ((m = aliasRe.exec(aliasBlock[1]))) {
      if (keyToMatch[m[2]]) alias[m[1]] = keyToMatch[m[2]];
    }
  }
  return alias;
}

/* ── 3. walk the source ─────────────────────────────────────────────────── */

const probeText = fs.readFileSync(PROBE, 'utf8');
const src = fs.readFileSync(SOURCE, 'utf8');
const lines = src.split(/\r?\n/);

const { byMatch, titleOf } = parseProbe(probeText);
const alias = parseAliasTable(src);

/* Any name a call site passes -> the matchName the probe knows it by. */
function toMatchName(name) {
  if (byMatch[name]) return name;
  if (alias[name] && byMatch[alias[name]]) return alias[name];
  /* Display names as they appear in the probe headings ("Motion Tile"). */
  for (const mn in titleOf) if (titleOf[mn] === name) return mn;
  if (alias[name]) return alias[name];   // known, but not in the dump
  return null;
}

const ASSIGN = new RegExp(
  '(?:var\\s+)?(\\w+)\\s*=\\s*' +
  '(?:addFx|lgFx|lgFxNamed|findFx|LG\\.add)\\s*\\(\\s*[\\w.()\\[\\]\'"\\s]+?,\\s*(\\[[^\\]]*\\]|\'[^\']*\'|"[^"]*")'
);

const CALL = new RegExp(
  '(?:LG\\.(set|expr)|safeSet|safeEx)\\s*\\(\\s*(\\w+)\\s*,\\s*' +
  '([\'"])((?:(?!\\3).)*)\\3\\s*,\\s*([0-9]+|null|undefined)\\s*,'
);

const findings = [];
const stats = { checked: 0, ok: 0, wrong: 0, unresolved: 0, noProbe: 0, nullIdx: 0 };

let scope = {};        // variable -> matchName, reset at every function boundary
let fnName = '(top level)';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  const fn = line.match(/^\s*function\s+(\w+)/);
  if (fn) { scope = {}; fnName = fn[1]; }

  /* An explicit binding, for the helpers that take their effect as an
     argument. `lgTurbSet(td, o)` cannot be resolved by reading the line that
     assigns `td` — there isn't one in that function — so the helper declares
     what it operates on:  @effect td = ADBE Turbulent Displace  */
  const ann = line.match(/@effect\s+(\w+)\s*=\s*(.+?)\s*(?:\*\/|$)/);
  if (ann) {
    const mn = toMatchName(ann[2]);
    if (mn) scope[ann[1]] = mn;
    else console.error('index_audit: @effect on line ' + (i + 1) +
                       ' names an effect nothing knows: ' + ann[2]);
  }

  const a = line.match(ASSIGN);
  if (a) {
    const first = (a[2].match(/['"]([^'"]+)['"]/) || [])[1];
    if (first) {
      const mn = toMatchName(first);
      if (mn) scope[a[1]] = mn;
      else delete scope[a[1]];
    }
  }

  const c = line.match(CALL);
  if (!c) continue;

  const propName = c[4];
  const idxRaw = c[5];
  const where = { file: 'jsx/main.jsx', line: i + 1, fn: fnName, text: line.trim() };

  if (idxRaw === 'null' || idxRaw === 'undefined') { stats.nullIdx++; continue; }
  stats.checked++;

  const mn = scope[c[2]];
  if (!mn) {
    stats.unresolved++;
    findings.push(Object.assign({ kind: 'unresolved', prop: propName, idx: +idxRaw, effect: c[2] }, where));
    continue;
  }
  if (!byMatch[mn]) {
    stats.noProbe++;
    findings.push(Object.assign({ kind: 'no-probe-data', prop: propName, idx: +idxRaw, effect: mn }, where));
    continue;
  }

  const want = byMatch[mn][norm(propName)];
  if (want === undefined) {
    findings.push(Object.assign({ kind: 'no-such-property', prop: propName, idx: +idxRaw, effect: mn }, where));
    stats.wrong++;
    continue;
  }
  if (want !== +idxRaw) {
    /* Name the parameter the wrong index actually lands on — that is the
       damage, and it is what makes the fix obvious. */
    let hits = null;
    for (const p in byMatch[mn]) if (byMatch[mn][p] === +idxRaw) hits = p;
    findings.push(Object.assign({
      kind: 'wrong-index', prop: propName, idx: +idxRaw, want, effect: mn, lands: hits
    }, where));
    stats.wrong++;
    continue;
  }
  stats.ok++;
}

/* ── 4. report ──────────────────────────────────────────────────────────── */

if (asJson) {
  process.stdout.write(JSON.stringify({ stats, findings }, null, 2));
  process.exit(stats.wrong > 0 ? 1 : 0);
}

const bad = findings.filter((f) => f.kind === 'wrong-index' || f.kind === 'no-such-property');

console.log('Living Gradients — effect index audit');
console.log('ground truth : tools/effect_probe_report.txt (' +
            Object.keys(byMatch).length + ' effects)');
console.log('source       : jsx/main.jsx (' + lines.length + ' lines)');
console.log('');
console.log('  ' + stats.checked + ' indexed writes checked');
console.log('  ' + stats.ok + ' correct');
console.log('  ' + bad.length + ' WRONG');
console.log('  ' + stats.unresolved + ' on a variable this audit cannot bind to an effect');
console.log('  ' + stats.noProbe + ' on an effect the probe report does not cover');
console.log('  ' + stats.nullIdx + ' name-only writes (no index to be wrong)');
console.log('');

if (bad.length) {
  console.log('WRONG INDICES — each of these sets the named parameter on an English');
  console.log('host and a different one everywhere else.');
  console.log('');
  for (const f of bad) {
    if (f.kind === 'wrong-index') {
      console.log('  main.jsx:' + f.line + '  ' + titleOf[f.effect] + " '" + f.prop + "'");
      console.log('      has ' + f.idx + ', should be ' + f.want +
                  (f.lands ? '   (' + f.idx + ' is "' + f.lands + '")' : '   (' + f.idx + ' is out of range)'));
    } else {
      console.log('  main.jsx:' + f.line + '  ' + titleOf[f.effect] + " has no property '" + f.prop + "'");
    }
    console.log('      in ' + f.fn + '()');
  }
  console.log('');
}

const other = findings.filter((f) => f.kind === 'unresolved' || f.kind === 'no-probe-data');
if (other.length) {
  console.log('NOT CHECKED (' + other.length + ') — extend the probe, or bind the variable');
  console.log('to its effect on the line that creates it, and these go away.');
  const byEffect = {};
  for (const f of other) {
    const k = f.kind === 'unresolved' ? 'unresolved: ' + f.effect : 'no probe data: ' + titleOf[f.effect] || f.effect;
    (byEffect[k] = byEffect[k] || []).push(f.line);
  }
  for (const k of Object.keys(byEffect).sort()) {
    console.log('  ' + k + '  — lines ' + byEffect[k].join(', '));
  }
  console.log('');
}

console.log(bad.length ? 'FAIL' : 'PASS');
process.exit(bad.length ? 1 : 0);
