#!/usr/bin/env node
/* =====================================================================
   LIVING GRADIENTS - DROPDOWN VALUE AUDIT
   ---------------------------------------------------------------------
   The fourth audit, and it exists because the other three all passed in
   green through the two worst bugs this product has had.

     `Pinning` was written as option 1 for the entire library. Pin All is
     option 11. index_audit.js checks that property 12 IS Pinning - and it
     is - so the index was right, the audit was clean, and every Turbulent
     Displace in the product ran unpinned. The symptom was hard-edged
     holes, and it looked different every time it was chased because it
     was in everything that displaces.

     CC Toner's `Tones` mode 3 was documented in one place as Tritone and
     in another as Pentone. It is Pentone. Acting on the wrong reading let
     lgToneTri() fill three of five stops and leave two at CC Toner's own
     defaults - #c0aa78 and #40320a, a tan and a dark olive - so Molten
     Silver rendered visibly gold off a palette of three neutrals.

   A WRONG DROPDOWN VALUE HIDES IN EXACTLY THE PLACE A WRONG INDEX CANNOT.
   The property resolves, the write succeeds, the audit is happy, and the
   effect does something else. So this checks the values.

   Two checks, and they are different in kind:

     RANGE   Every numeric literal written to a property the probe report
             marks as a dropdown must be within 1..N for that dropdown.
             Mechanical, and it needs no knowledge of what the options
             mean.

     KNOWN   A small table of semantics this project has already paid to
             learn, each with the value it must have and the reason. This
             is a regression guard: these are facts that were wrong once,
             and being wrong again would be silent.

   Ground truth for the ranges is tools/effect_probe_report.txt, the same
   host dump index_audit.js uses. Extend it by re-running
   tools/effect_probe.jsx.

     node tools/dropdown_audit.js
   ===================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'jsx', 'main.jsx');
const PROBE = path.join(ROOT, 'tools', 'effect_probe_report.txt');

/* ---- the facts worth guarding ---------------------------------------

   `property` is the display name the code asks for. `value` is what it
   must be. `why` is printed on failure, because a bare "expected 11" is
   the kind of message that gets an assertion deleted rather than fixed. */
const KNOWN = [
  {
    property: 'Pinning',
    effect: 'ADBE Turbulent Displace',
    value: 11,
    label: 'Pin All',
    why: 'Anything else lets the displacement fetch from beyond the layer bounds, ' +
         'which returns transparency and punches hard-edged holes through the surface. ' +
         'Measured over all seventeen options on a 5376x3024 copper: option 11 is the ' +
         'only one that tears nowhere. Option 1 left 6.64% of the frame as voids.'
  },
  {
    property: 'Tones',
    effect: 'CC Toner',
    value: 3,
    label: 'Pentone',
    why: 'Mode 3 is Pentone and all five stops are live. Reading it as Tritone is what ' +
         'let three stops be filled and two left at CC Toner\'s tan defaults, which is ' +
         'why Molten Silver rendered gold.'
  }
];

/* ---- the probe report: which properties are dropdowns, and how wide -- */

function readDropdowns() {
  if (!fs.existsSync(PROBE)) {
    console.error('No ' + PROBE + '. Run tools/effect_probe.jsx on a host first.');
    process.exit(2);
  }
  const lines = fs.readFileSync(PROBE, 'utf8').split(/\r?\n/);
  const byEffect = new Map();    // matchName -> Map(propertyName -> option count)

  /* The matchName column carries the effect AND the index - "ADBE Turbulent
     Displace-0012" - so the effect never has to be inferred from the nearest
     heading, and a property name that appears on two effects stays two
     separate facts. Pinning is on Turbulent Displace with 17 options and on
     Wave Warp with 10, and conflating them is the first thing this audit did
     wrong. */
  for (const line of lines) {
    if (line.indexOf('<-- dropdown') < 0) continue;
    const m = /^\s*(\d+)\s+(.+?)\s{2,}(.+?)-(\d+)\s+\S+\s+(\d+)\s+<--/.exec(line);
    if (!m) continue;
    const effect = m[3].trim();
    const name = m[2].trim();
    const count = parseInt(m[5], 10);
    /* A "dropdown" with one option is not one. The probe marks Cell Pattern's
       Disperse that way and it is a 0-1 slider, so range-checking it against
       1..1 fails a perfectly good 0.55. Two or more, or it is not a menu. */
    if (count < 2) continue;
    if (!byEffect.has(effect)) byEffect.set(effect, new Map());
    byEffect.get(effect).set(name, count);
  }
  return byEffect;
}

/* ---- which variable is which effect ---------------------------------
   A write is only checkable once it is attached to an effect, and the file
   already says so in three ways: an explicit `@effect td = ADBE Turbulent
   Displace` annotation, and the addFx/lgFx/findFx call that created the
   variable in the first place. The nearest preceding binding wins, which is
   how these are written - one variable, one effect, a few lines apart. */
function readBindings(lines) {
  const bindings = [];   // { line, name, effect }
  const annot = /@effect\s+([A-Za-z_$][\w$]*)\s*=\s*(.+?)\s*\*\//;
  const created = /\b(?:var\s+)?([A-Za-z_$][\w$]*)\s*=\s*(?:lgFxNamed|lgFx|addFx|findFx)\s*\(\s*[^,]+,\s*\[\s*['"]([^'"]+)['"]/;
  lines.forEach((line, i) => {
    let m = annot.exec(line);
    if (m) { bindings.push({ line: i + 1, name: m[1], effect: m[2].trim() }); return; }
    m = created.exec(line);
    if (m) bindings.push({ line: i + 1, name: m[1], effect: m[2].trim() });
  });
  return bindings;
}

function effectFor(bindings, varName, atLine) {
  let best = null;
  for (const b of bindings) {
    if (b.name !== varName) continue;
    if (b.line > atLine) break;
    best = b.effect;
  }
  return best;
}

/* ---- the writes ------------------------------------------------------
   LG.set(fx, 'Name', idx, value), safeSet(fx, 'Name', idx, value) and
   setFxValue(fx, idx, 'Name', value) are the three shapes in this file.
   Only literal numbers are checkable; a variable is reported as such
   rather than guessed at. */

function readWrites() {
  const src = fs.readFileSync(SRC, 'utf8');
  const lines = src.split(/\r?\n/);
  const out = [];

  const shapes = [
    /\b(?:LG\.set|safeSet)\s*\(\s*([A-Za-z_$][\w$]*)\s*,\s*['"]([^'"]+)['"]\s*,\s*(?:\d+|null)\s*,\s*([^),]+)\)/g,
    /\bsetFxValue\s*\(\s*([A-Za-z_$][\w$]*)\s*,\s*\d+\s*,\s*['"]([^'"]+)['"]\s*,\s*([^),]+)\)/g,
    /\b([A-Za-z_$][\w$]*)\.property\(\s*['"]([^'"]+)['"]\s*\)\s*\.setValue\(\s*([^)]+)\)/g
  ];

  lines.forEach((line, i) => {
    for (const re of shapes) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line)) !== null) {
        out.push({ line: i + 1, varName: m[1], property: m[2].trim(), raw: m[3].trim(), text: line.trim() });
      }
    }
  });
  return { writes: out, lines };
}

/* ---- run ------------------------------------------------------------ */

const byEffect = readDropdowns();
const parsed = readWrites();
const writes = parsed.writes;
const bindings = readBindings(parsed.lines);

let dropdownCount = 0;
for (const m of byEffect.values()) dropdownCount += m.size;

console.log('Living Gradients - dropdown value audit');
console.log('source : jsx/main.jsx');
console.log('probe  : tools/effect_probe_report.txt (' + dropdownCount + ' dropdowns across ' +
            byEffect.size + ' effects)');
console.log('');

const problems = [];
let ranged = 0, unbound = 0, variable = 0;

for (const w of writes) {
  const effect = effectFor(bindings, w.varName, w.line);
  const table = effect ? byEffect.get(effect) : null;
  if (!table || !table.has(w.property)) {
    /* Either not a dropdown, or the variable could not be bound to an effect.
       Only the second is worth counting, and only for properties that are a
       dropdown on SOME effect - otherwise every colour and slider lands here. */
    let isDropdownSomewhere = false;
    for (const t of byEffect.values()) if (t.has(w.property)) { isDropdownSomewhere = true; break; }
    if (isDropdownSomewhere && !effect) unbound++;
    continue;
  }
  if (!/^-?\d+(\.\d+)?$/.test(w.raw)) { variable++; continue; }

  ranged++;
  const literal = Number(w.raw);
  const max = table.get(w.property);
  if (literal < 1 || literal > max) {
    problems.push({
      kind: 'RANGE', line: w.line,
      msg: effect + ' ' + w.property + ' = ' + literal + ', but it has ' + max +
           ' option' + (max === 1 ? '' : 's') + ' (1..' + max + ')',
      text: w.text
    });
  }

  for (const k of KNOWN) {
    if (k.property !== w.property || k.effect !== effect) continue;
    if (literal !== k.value) {
      problems.push({
        kind: 'KNOWN', line: w.line,
        msg: effect + ' ' + k.property + ' = ' + literal + ', must be ' + k.value +
             ' (' + k.label + ')',
        text: k.why
      });
    }
  }
}

for (const k of KNOWN) {
  const seen = writes.filter((w) => w.property === k.property &&
                                    effectFor(bindings, w.varName, w.line) === k.effect &&
                                    /^-?\d+(\.\d+)?$/.test(w.raw));
  console.log('  ' + (k.effect + ' ' + k.property).padEnd(38) + '= ' + k.value +
              '  (' + k.label + ')  ' + seen.length + ' write' +
              (seen.length === 1 ? '' : 's') + ' checked');
  if (!seen.length) {
    problems.push({
      kind: 'MISSING', line: 0,
      msg: 'nothing writes ' + k.effect + ' ' + k.property + ' as a literal any more',
      text: 'If that is deliberate, remove it from KNOWN. If the write moved behind a ' +
            'variable, this audit can no longer see it, and that is worth knowing.'
    });
  }
}

console.log('');
console.log('  ' + ranged + ' literal dropdown writes checked against their own effect');
console.log('  ' + variable + ' written from a variable, which this cannot check');
console.log('  ' + unbound + ' on a dropdown name this could not bind to an effect');
console.log('');

if (problems.length) {
  console.log('PROBLEMS');
  for (const p of problems) {
    console.log('  [' + p.kind + '] ' + (p.line ? 'line ' + p.line + ': ' : '') + p.msg);
    console.log('        ' + p.text.slice(0, 160));
  }
  console.log('');
  console.log('FAIL');
  process.exit(1);
}

console.log('PASS');
