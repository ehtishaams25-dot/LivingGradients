/* PANEL_AUDIT.JS — the mistakes that only exist because js/*.js share one scope
 *
 *   node tools/panel_audit.js
 *   node tools/panel_audit.js --json
 *
 * WHY
 *
 * index.html loads fourteen plain <script> tags. There are no modules and no
 * bundler, so every top-level name in js/*.js is a property of the same window
 * object, and the last file to define one wins. That is a completely reasonable
 * architecture for a panel this size — it is also a place where two independent
 * files can each define `setStatus` and neither author ever finds out.
 *
 * WHAT IT CHECKS
 *
 *   1. DUPLICATE TOP-LEVEL NAMES. Two `function setStatus` in one scope is a
 *      silent replacement. Two `const` of the same name is a hard SyntaxError
 *      that only appears at run time, in After Effects, as a blank panel.
 *
 *   2. LGStore.available USED AS A PROPERTY. It is a function — haveFs — so
 *      `if (LGStore.available)` is always true and sends a write down a path
 *      that cannot work. Same for any other exported predicate that is a
 *      function in store.js.
 *
 *   3. SCRIPTS THAT DO NOT EXIST, and files that exist but nothing loads. A
 *      typo in a <script src> is a panel that opens blank with one undefined
 *      global; a file nobody loads is dead weight in the package.
 *
 * None of these are style. Every one of them is something that looks fine here
 * and fails on a customer's machine.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JSDIR = path.join(ROOT, 'js');
const asJson = process.argv.indexOf('--json') !== -1;

const findings = [];

/* ── strip comments and strings so declarations are not found inside them ── */

function decode(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    if (c === '/' && d === '*') {
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out += (src[i] === '\n' ? '\n' : ' '); i++; }
      out += '  '; i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += ' '; i++;
      while (i < n) {
        if (src[i] === '\\') { out += '  '; i += 2; continue; }
        if (src[i] === quote) { out += ' '; i++; break; }
        out += (src[i] === '\n' ? '\n' : ' ');
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/* ── 1. duplicate top-level names ───────────────────────────────────────── */

const files = fs.readdirSync(JSDIR).filter((f) => f.endsWith('.js')).sort();
const declared = new Map();   // name -> [{file, line, kind}]

for (const f of files) {
  const src = fs.readFileSync(path.join(JSDIR, f), 'utf8');
  const clean = decode(src);
  const lines = clean.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    /* Top level only: column zero. Anything indented is inside a function, an
       IIFE or an object literal, and is not a global. */
    let m = line.match(/^(function)\s+([A-Za-z_$][\w$]*)/);
    if (!m) m = line.match(/^(const|let|var)\s+([A-Za-z_$][\w$]*)/);
    if (!m) continue;
    const name = m[2];
    if (!declared.has(name)) declared.set(name, []);
    declared.get(name).push({ file: 'js/' + f, line: i + 1, kind: m[1] });
  }
}

for (const [name, sites] of declared) {
  if (sites.length < 2) continue;
  /* Two `var` of the same name in one scope is legal and harmless — it is one
     variable. A function or a const is not. */
  if (sites.every((s) => s.kind === 'var')) continue;
  const fatal = sites.some((s) => s.kind === 'const' || s.kind === 'let');
  findings.push({
    kind: fatal ? 'duplicate-lexical' : 'duplicate-function',
    name,
    sites,
    why: fatal
      ? 'redeclaring a const/let in the shared scope is a SyntaxError at load — the panel opens blank'
      : 'the file loaded last silently replaces the other definition for every caller'
  });
}

/* ── 2. store predicates read instead of called ─────────────────────────── */

/* Read the shape out of store.js rather than hard-coding it: which exports are
   functions is store.js's business and it may add more. */
const storeSrc = decode(fs.readFileSync(path.join(JSDIR, 'store.js'), 'utf8'));
const fnNames = new Set();
{
  const re = /^\s*function\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(storeSrc))) fnNames.add(m[1]);
}
const exportedFns = new Set();
{
  /* The module's own public return, anchored on its two-space indent. Matching
     the first `return {` in the file instead picks up one inside a helper —
     listBackups returns `{ file, path, when }` — and `path` then looks like an
     exported predicate, which put thirteen false positives in this report the
     first time it ran. */
  const block = storeSrc.match(/\n  return \{([\s\S]*?)\n  \};/);
  if (block) {
    const re = /([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)/g;
    let m;
    while ((m = re.exec(block[1]))) {
      if (fnNames.has(m[2])) exportedFns.add(m[1]);
    }
  } else {
    console.error('panel_audit: could not find the public return block in js/store.js');
  }
}

for (const f of files) {
  const src = fs.readFileSync(path.join(JSDIR, f), 'utf8');
  const clean = decode(src);
  clean.split('\n').forEach((line, i) => {
    for (const name of exportedFns) {
      /* LGStore.<fn> not followed by "(", with a word boundary after the name
         so `paths` does not match the export called `path`. `typeof LGStore.x
         === 'function'` is a legitimate read and is excluded below. */
      const re = new RegExp('LGStore\\.' + name + '\\b(?!\\s*\\()', 'g');
      let m;
      while ((m = re.exec(line))) {
        const before = line.slice(Math.max(0, m.index - 24), m.index);
        if (/typeof\s+$/.test(before)) continue;
        findings.push({
          kind: 'store-predicate-not-called',
          name: 'LGStore.' + name,
          sites: [{ file: 'js/' + f, line: i + 1, kind: 'read' }],
          why: 'store.js exports this as a function, so reading it is always truthy'
        });
      }
    }
  });
}

/* ── 3. index.html script tags vs the files on disk ─────────────────────── */

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const loaded = [];
{
  const re = /<script[^>]*\ssrc="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) loaded.push(m[1]);
}

const localLoaded = loaded
  .filter((s) => !/^https?:/.test(s))
  .map((s) => s.split('?')[0]);

for (const rel of localLoaded) {
  if (!fs.existsSync(path.join(ROOT, rel))) {
    findings.push({
      kind: 'script-missing',
      name: rel,
      sites: [{ file: 'index.html', line: 0, kind: 'src' }],
      why: 'index.html loads a file that is not there — the panel opens with an undefined global'
    });
  }
}

for (const f of files) {
  if (!localLoaded.includes('js/' + f)) {
    findings.push({
      kind: 'script-not-loaded',
      name: 'js/' + f,
      sites: [{ file: 'index.html', line: 0, kind: 'absent' }],
      why: 'the file exists and ships, and nothing loads it'
    });
  }
}

/* ── report ─────────────────────────────────────────────────────────────── */

const fatalKinds = new Set(['duplicate-lexical', 'store-predicate-not-called', 'script-missing']);
const fatal = findings.filter((f) => fatalKinds.has(f.kind));
const warn = findings.filter((f) => !fatalKinds.has(f.kind));

if (asJson) {
  process.stdout.write(JSON.stringify({ fatal, warn }, null, 2));
  process.exit(fatal.length ? 1 : 0);
}

console.log('Living Gradients — panel audit');
console.log(files.length + ' files in js/, all sharing one global scope');
console.log('');
console.log('  ' + declared.size + ' top-level names');
console.log('  ' + fatal.length + ' problems');
console.log('  ' + warn.length + ' worth a look');
console.log('');

function show(list, heading) {
  if (!list.length) return;
  console.log(heading);
  for (const f of list) {
    console.log('  ' + f.name + '  (' + f.kind + ')');
    console.log('      ' + f.why);
    for (const s of f.sites) {
      console.log('      ' + s.file + (s.line ? ':' + s.line : '') +
                  (s.kind ? '  ' + s.kind : ''));
    }
  }
  console.log('');
}

show(fatal, 'PROBLEMS');
show(warn, 'WORTH A LOOK');

console.log(fatal.length ? 'FAIL' : 'PASS');
process.exit(fatal.length ? 1 : 0);
