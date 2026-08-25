/* ============================================
   STORE.JS — the panel's data directory
   ============================================

   Everything a user makes lives OUTSIDE the extension folder.

   This is the single most important thing Code Runner does that we did not.
   Our presets lived in `localStorage`, which means:

     - they are scoped to the extension's CEF cache, so clearing that cache
       (the standard fix for a blank panel) destroyed every preset;
     - they are invisible — nobody can find, back up, or send them;
     - reinstalling over the top could lose them;
     - there is a hard size ceiling, and a thumbnail blows through it.

   So the library lives on disk beside the application's other support files:

     Windows   %APPDATA%\Digivero\LivingGradients\v2
     macOS     ~/Library/Application Support/Digivero/LivingGradients/v2

   and the layout inside it is deliberate:

     library.json       the index — collections, folders, and every preset
     presets/<id>.json  one file per preset, the same record again
     thumbs/<id>.png    the picture of what that preset makes
     backups/           rolling copies of library.json
     inbox.json         message state (which notices have been read)
     settings.json      panel preferences that outlive a reinstall

   The per-preset files are not redundancy for its own sake. If library.json
   is ever truncated mid-write, rebuilding walks presets/ and reconstructs the
   index from the files themselves — the user loses their folder arrangement,
   not their work. Code Runner does exactly this with its code/ directory, and
   it is the reason a corrupted index is an inconvenience rather than a
   catastrophe.

   FS BACKEND
   The manifest already asks for --enable-nodejs, so Node's `fs` is normally
   there and it is the better API (recursive mkdir, rename, copyFile). When it
   is not — a locked-down host, or nodejs quietly failing to initialise — this
   falls back to CEP's own `window.cep.fs`, which is always present. Callers
   never learn which one they got. */

var LGStore = (function () {
  'use strict';

  var VENDOR = 'Digivero';
  var PRODUCT = 'LivingGradients';
  var SCHEMA = 'v2';
  var BACKUP_KEEP = 8;

  /* ── FS ADAPTER ──────────────────────────────────────────────────── */

  var nodeFs = null, nodeOs = null;
  try {
    if (typeof require === 'function') {
      nodeFs = require('fs');
      nodeOs = require('os');
    }
  } catch (e) { nodeFs = null; }

  var cepFs = (typeof window !== 'undefined' && window.cep && window.cep.fs) ? window.cep.fs : null;

  function encUTF8() {
    return (window.cep && window.cep.encoding) ? window.cep.encoding.UTF8 : 'UTF-8';
  }
  function encB64() {
    return (window.cep && window.cep.encoding) ? window.cep.encoding.Base64 : 'Base64';
  }

  function haveFs() { return !!(nodeFs || cepFs); }

  /* CEP's fs reports success as err === 0. Node throws. One shape out. */
  function readText(path) {
    try {
      if (nodeFs) return nodeFs.readFileSync(path, 'utf8');
      if (cepFs) {
        var r = cepFs.readFile(path, encUTF8());
        return (r && r.err === 0) ? r.data : null;
      }
    } catch (e) { }
    return null;
  }

  function writeText(path, text) {
    try {
      if (nodeFs) { nodeFs.writeFileSync(path, text, 'utf8'); return true; }
      if (cepFs) {
        var r = cepFs.writeFile(path, text, encUTF8());
        return !!r && r.err === 0;
      }
    } catch (e) { }
    return false;
  }

  function writeBase64(path, b64) {
    try {
      if (nodeFs) { nodeFs.writeFileSync(path, Buffer.from(b64, 'base64')); return true; }
      if (cepFs) {
        var r = cepFs.writeFile(path, b64, encB64());
        return !!r && r.err === 0;
      }
    } catch (e) { }
    return false;
  }

  function readBase64(path) {
    try {
      if (nodeFs) return nodeFs.readFileSync(path).toString('base64');
      if (cepFs) {
        var r = cepFs.readFile(path, encB64());
        return (r && r.err === 0) ? r.data : null;
      }
    } catch (e) { }
    return null;
  }

  function exists(path) {
    try {
      if (nodeFs) return nodeFs.existsSync(path);
      if (cepFs) { var r = cepFs.stat(path); return !!r && r.err === 0; }
    } catch (e) { }
    return false;
  }

  function isDir(path) {
    try {
      if (nodeFs) return nodeFs.existsSync(path) && nodeFs.statSync(path).isDirectory();
      if (cepFs) {
        var r = cepFs.stat(path);
        return !!r && r.err === 0 && !!r.data && r.data.isDirectory();
      }
    } catch (e) { }
    return false;
  }

  /* mkdir -p. cep.fs.makedir does one level only, so walk the segments. */
  function mkdirp(path) {
    if (isDir(path)) return true;
    try {
      if (nodeFs) { nodeFs.mkdirSync(path, { recursive: true }); return true; }
      if (cepFs) {
        var parts = String(path).replace(/\\/g, '/').split('/');
        var acc = '';
        for (var i = 0; i < parts.length; i++) {
          if (!parts[i]) { acc = acc || '/'; continue; }
          acc = acc ? (acc.replace(/\/+$/, '') + '/' + parts[i]) : parts[i];
          if (/^[A-Za-z]:$/.test(acc)) continue;   /* a drive letter is not a directory */
          if (!isDir(acc)) cepFs.makedir(acc);
        }
        return isDir(path);
      }
    } catch (e) { }
    return false;
  }

  function listDir(path) {
    try {
      if (nodeFs) return nodeFs.readdirSync(path);
      if (cepFs) { var r = cepFs.readdir(path); return (r && r.err === 0) ? r.data : []; }
    } catch (e) { }
    return [];
  }

  function removeFile(path) {
    try {
      if (nodeFs) { if (nodeFs.existsSync(path)) nodeFs.unlinkSync(path); return true; }
      if (cepFs) { cepFs.deleteFile(path); return true; }
    } catch (e) { }
    return false;
  }

  function renameFile(from, to) {
    try {
      if (nodeFs) { nodeFs.renameSync(from, to); return true; }
      if (cepFs) { var r = cepFs.rename(from, to); return !!r && r.err === 0; }
    } catch (e) { }
    return false;
  }

  function copyFile(from, to) {
    var b64 = readBase64(from);
    if (b64 === null) return false;
    return writeBase64(to, b64);
  }

  /* ── PATHS ───────────────────────────────────────────────────────── */

  function homeDir() {
    try { if (nodeOs) return nodeOs.homedir(); } catch (e) { }
    if (typeof process !== 'undefined' && process.env) {
      return process.env.HOME || process.env.USERPROFILE || '';
    }
    return '';
  }

  function envVar(name) {
    try {
      if (typeof process !== 'undefined' && process.env) return process.env[name] || '';
    } catch (e) { }
    return '';
  }

  function isWin() {
    if (typeof process !== 'undefined' && process.platform) return process.platform === 'win32';
    return /win/i.test((typeof navigator !== 'undefined' && navigator.platform) || '');
  }

  function join() {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) {
      if (arguments[i]) parts.push(String(arguments[i]).replace(/[\\/]+$/, ''));
    }
    return parts.join('/').replace(/\\/g, '/');
  }

  /* The support root, matching where the host application keeps its own
     per-user data on each platform. Not Documents: this is application state,
     and Documents is the user's own space.

     CEP is asked first, and that ordering is the point. SystemPath.USER_DATA
     resolves to %APPDATA% on Windows and ~/Library/Application Support on
     macOS — the correct base on both, with no branching and no environment
     variables. The Node route below only exists for the case where nodejs
     failed to initialise, and process.env is exactly what is missing in that
     case, which is how you end up computing a *relative* path and writing the
     library into whatever directory After Effects happened to start in. */
  function supportRoot() {
    var base = '';

    try {
      if (typeof CSInterface !== 'undefined' && window.__adobe_cep__ && typeof SystemPath !== 'undefined') {
        base = new CSInterface().getSystemPath(SystemPath.USER_DATA) || '';
      }
    } catch (e) { base = ''; }

    if (!base) {
      if (isWin()) {
        base = envVar('APPDATA') || join(homeDir(), 'AppData/Roaming');
      } else {
        base = join(homeDir(), 'Library/Application Support');
      }
    }

    /* Still nothing — no host, no Node. That is a browser dev session, and
       an absolute-looking path would be a lie. Say so instead: available()
       is already false, so nothing will be written either way. */
    if (!base) return '(no filesystem)';

    return join(base, VENDOR, PRODUCT, SCHEMA);
  }

  var ROOT = supportRoot();
  var P = {
    root: ROOT,
    library: join(ROOT, 'library.json'),
    presets: join(ROOT, 'presets'),
    thumbs: join(ROOT, 'thumbs'),
    backups: join(ROOT, 'backups'),
    inbox: join(ROOT, 'inbox.json'),
    settings: join(ROOT, 'settings.json'),
    exports: join(ROOT, 'exports')
  };

  function ensureTree() {
    if (!haveFs()) return false;
    mkdirp(P.root);
    mkdirp(P.presets);
    mkdirp(P.thumbs);
    mkdirp(P.backups);
    mkdirp(P.exports);
    return isDir(P.root);
  }

  /* ── ATOMIC JSON ─────────────────────────────────────────────────── */

  /* Write to a sibling temp file, then rename over the target. A rename
     within one filesystem is atomic, so a crash mid-write leaves the old
     file intact rather than a half-written one. Writing in place is how
     libraries get truncated. */
  function writeJson(path, value) {
    if (!haveFs()) return false;
    var text;
    try { text = JSON.stringify(value, null, 2); }
    catch (e) { return false; }

    var tmp = path + '.tmp';
    if (!writeText(tmp, text)) return false;

    /* Windows will not always rename onto an existing file, so clear the
       target first. The window this opens is one syscall wide, and the
       backup directory covers it. */
    if (exists(path)) removeFile(path);
    if (!renameFile(tmp, path)) {
      /* Rename refused — write directly rather than lose the data, and let
         the rotated backup carry the risk. */
      var ok = writeText(path, text);
      removeFile(tmp);
      return ok;
    }
    return true;
  }

  function readJson(path, fallback) {
    var raw = readText(path);
    if (raw === null || raw === '') return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }

  /* ── BACKUPS ─────────────────────────────────────────────────────── */

  /* Rotate before every index write. Cheap — the index is small — and it
     turns "I deleted the wrong folder" into something recoverable without
     a support ticket. */
  function rotateBackups() {
    if (!exists(P.library)) return;
    var stamp = new Date().toISOString().replace(/[:.]/g, '-');
    copyFile(P.library, join(P.backups, 'library-' + stamp + '.json'));

    var files = listDir(P.backups).filter(function (f) {
      return /^library-.*\.json$/.test(f);
    }).sort();
    while (files.length > BACKUP_KEEP) {
      removeFile(join(P.backups, files.shift()));
    }
  }

  function listBackups() {
    return listDir(P.backups)
      .filter(function (f) { return /^library-.*\.json$/.test(f); })
      .sort()
      .reverse()
      .map(function (f) {
        var iso = f.replace(/^library-/, '').replace(/\.json$/, '');
        /* library-2026-08-25T11-04-07-123Z → a readable local time */
        var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/.exec(iso);
        var when = iso;
        if (m) {
          var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
          when = d.toLocaleString();
        }
        return { file: f, path: join(P.backups, f), when: when };
      });
  }

  function restoreBackup(file) {
    var path = join(P.backups, file);
    if (!exists(path)) return false;
    rotateBackups();
    return copyFile(path, P.library);
  }

  /* ── THUMBNAILS ──────────────────────────────────────────────────── */

  /* A thumbnail arrives either as a canvas data URI from preview.js or as a
     PNG After Effects rendered from the real comp. Both land here as a plain
     file: base64 inside the index would bloat the one file everything else
     depends on. */
  function saveThumb(id, dataUri) {
    if (!haveFs() || !dataUri) return null;
    var m = /^data:image\/(png|jpeg);base64,([\s\S]*)$/.exec(dataUri);
    if (!m) return null;
    ensureTree();
    var name = id + (m[1] === 'png' ? '.png' : '.jpg');
    return writeBase64(join(P.thumbs, name), m[2]) ? name : null;
  }

  /* Import a PNG that already exists on disk (the frame After Effects
     rendered) into the thumbs folder under this preset's id. */
  function adoptThumb(id, sourcePath) {
    if (!haveFs() || !sourcePath || !exists(sourcePath)) return null;
    ensureTree();
    var ext = /\.jpe?g$/i.test(sourcePath) ? '.jpg' : '.png';
    var name = id + ext;
    return copyFile(sourcePath, join(P.thumbs, name)) ? name : null;
  }

  function thumbUri(name) {
    if (!name) return null;
    var b64 = readBase64(join(P.thumbs, name));
    if (!b64) return null;
    var mime = /\.jpe?g$/i.test(name) ? 'image/jpeg' : 'image/png';
    return 'data:' + mime + ';base64,' + b64;
  }

  function removeThumb(name) {
    if (name) removeFile(join(P.thumbs, name));
  }

  /* ── PRESET FILES ────────────────────────────────────────────────── */

  function writePresetFile(rec) {
    if (!rec || !rec.id) return false;
    return writeJson(join(P.presets, rec.id + '.json'), rec);
  }

  function removePresetFile(id) {
    removeFile(join(P.presets, id + '.json'));
  }

  function readAllPresetFiles() {
    var out = [];
    listDir(P.presets).forEach(function (f) {
      if (!/\.json$/i.test(f)) return;
      var rec = readJson(join(P.presets, f), null);
      if (rec && rec.id) out.push(rec);
    });
    return out;
  }

  /* ── PUBLIC ──────────────────────────────────────────────────────── */

  return {
    paths: P,
    available: haveFs,
    ensureTree: ensureTree,
    join: join,

    readJson: readJson,
    writeJson: writeJson,
    readText: readText,
    writeText: writeText,
    readBase64: readBase64,
    writeBase64: writeBase64,
    exists: exists,
    isDir: isDir,
    listDir: listDir,
    removeFile: removeFile,
    copyFile: copyFile,
    mkdirp: mkdirp,

    rotateBackups: rotateBackups,
    listBackups: listBackups,
    restoreBackup: restoreBackup,

    saveThumb: saveThumb,
    adoptThumb: adoptThumb,
    thumbUri: thumbUri,
    removeThumb: removeThumb,

    writePresetFile: writePresetFile,
    removePresetFile: removePresetFile,
    readAllPresetFiles: readAllPresetFiles,

    /* For the diagnostics card. When an install misbehaves, "which backend
       answered and where is the folder" is always the first question. */
    describe: function () {
      return {
        backend: nodeFs ? 'node' : (cepFs ? 'cep' : 'none'),
        root: P.root,
        writable: ensureTree()
      };
    }
  };
})();

if (typeof window !== 'undefined') window.LGStore = LGStore;
