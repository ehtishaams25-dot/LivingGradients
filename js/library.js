/* ============================================
   LIBRARY.JS — presets, collections, folders
   ============================================

   THE MODEL, AND WHY IT IS THIS ONE

   The obvious design is a list of presets. Code Runner does not do that, and
   the reason is worth stealing wholesale: a preset lives in ONE library, and a
   collection merely holds a *reference* to it.

     library.presets[id]          the thing itself — one copy, one truth
     collection.items[]           { id, ref, folder } — a placement of it

   So the same "Molten Gold, tight bands" can sit in a Client Work collection
   and in a Reels collection at once. Edit it in one and it changes in both,
   because there is only one of it. Remove it from a collection and it is still
   in the library, ready to be placed again — which is a different, softer
   action than deleting it, and the panel says so.

   TWO KINDS OF PRESET

     kind: 'gradient'   the whole recipe — which builder, its controls, the
                        palette, grain/glow/posterize, the fluid trail. Applying
                        it builds the thing. This is the one that was missing.

     kind: 'palette'    colours only, which is all v1 could save. Applying it
                        recolours whatever is selected. Kept, and clearly
                        labelled, so the presets people already made still work.

   A gradient preset is exactly the payload generateGradient() takes. That is
   not a coincidence — applyGlobalPolish() already stamps that payload onto the
   generated layer as LIVING_GRADIENT_DATA, so "capture the selected layer" is
   a read of something we were already writing. The feature was ninety per cent
   built and nobody had picked it up.

   DEPENDS ON: store.js */

var LGLibrary = (function () {
  'use strict';

  var SCHEMA = 2;
  var LEGACY_KEY = 'livingGradients_colorPresets';

  var db = null;            /* the in-memory index */
  var saveTimer = null;
  var listeners = [];

  /* ── IDS ─────────────────────────────────────────────────────────── */

  function uid(prefix) {
    return (prefix || 'lg') + '_' +
      Date.now().toString(36) + '_' +
      Math.random().toString(36).slice(2, 8);
  }

  function nowIso() { return new Date().toISOString(); }

  /* ── DEFAULTS ────────────────────────────────────────────────────── */

  function blankCollection(name) {
    return {
      id: uid('col'),
      name: name || 'My Presets',
      created: nowIso(),
      folders: [],
      items: []
    };
  }

  function blankDb() {
    var first = blankCollection('My Presets');
    return {
      schema: SCHEMA,
      updated: nowIso(),
      activeCollection: first.id,
      presets: {},
      collections: [first],
      settings: defaultSettings()
    };
  }

  /* Panel preferences that should survive a reinstall. Code Runner keeps
     these next to the library rather than in the extension, and includes them
     in "back up everything" — so a restore puts the panel back exactly as it
     was, not just the content. */
  function defaultSettings() {
    return {
      view: 'grid',          /* grid | list */
      cardSize: 'md',        /* sm | md | lg */
      showLabels: true,
      showFolders: true,
      radius: 11,            /* the corner-roundness slider */
      accent: null,          /* null = the brand gold from styles.css */
      confirmDelete: true,
      captureThumbFromComp: true,
      checkForUpdates: true,
      lastSeenVersion: null,
      lastUpdateCheck: 0
    };
  }

  /* ── LOAD / SAVE ─────────────────────────────────────────────────── */

  function load() {
    if (!LGStore.available()) {
      /* No filesystem at all (a browser dev session). Run in memory so the
         panel still works; nothing persists, and the caller can say so. */
      db = blankDb();
      return db;
    }

    LGStore.ensureTree();
    var loaded = LGStore.readJson(LGStore.paths.library, null);

    if (!loaded || !loaded.presets || !loaded.collections) {
      /* Either a first run or a damaged index. Both are handled the same
         way: reconstruct from presets/, which is the durable copy. */
      var salvaged = rebuildFromDisk();
      db = salvaged || blankDb();
      migrateLegacy();
      save(true);
      return db;
    }

    db = normalise(loaded);
    migrateLegacy();
    return db;
  }

  /* Reconstruct the index from the per-preset files. Folder arrangement is
     gone — that only ever lived in the index — so everything lands in one
     recovered collection rather than being silently dropped. */
  function rebuildFromDisk() {
    var files = LGStore.readAllPresetFiles();
    if (!files.length) return null;

    var fresh = blankDb();
    fresh.collections[0].name = 'Recovered';
    files.forEach(function (rec) {
      fresh.presets[rec.id] = rec;
      fresh.collections[0].items.push({ id: uid('itm'), ref: rec.id, folder: null });
    });
    return fresh;
  }

  /* Tolerate an index written by an older build, or hand-edited. */
  function normalise(x) {
    x.schema = SCHEMA;
    x.presets = x.presets || {};
    x.collections = (x.collections && x.collections.length) ? x.collections : [blankCollection('My Presets')];

    x.collections.forEach(function (col) {
      col.id = col.id || uid('col');
      col.folders = col.folders || [];
      col.items = col.items || [];
      /* Drop placements whose preset no longer exists, or the panel renders
         empty cards for them. */
      col.items = col.items.filter(function (it) { return it && x.presets[it.ref]; });
      col.items.forEach(function (it) { it.id = it.id || uid('itm'); });
    });

    if (!x.activeCollection || !byId(x.collections, x.activeCollection)) {
      x.activeCollection = x.collections[0].id;
    }

    var s = defaultSettings();
    x.settings = x.settings || {};
    for (var k in s) if (!(k in x.settings)) x.settings[k] = s[k];

    return x;
  }

  /* v1 stored colour presets as { name: [hex, hex, ...] } in localStorage.
     Those are real work; they become palette presets rather than being
     abandoned in a cache the user cannot see. Runs once, then leaves a
     marker so a later reinstall does not resurrect deleted ones. */
  function migrateLegacy() {
    var done = false;
    try { done = localStorage.getItem(LEGACY_KEY + '_migrated') === '1'; } catch (e) { }
    if (done) return;

    var legacy = null;
    try { legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null'); } catch (e) { }

    if (legacy && typeof legacy === 'object') {
      var col = activeCollection();
      var folder = null;
      var names = Object.keys(legacy);

      if (names.length) {
        folder = { id: uid('fld'), name: 'From v1', parent: null, collapsed: false, accent: null };
        col.folders.push(folder);
      }

      names.forEach(function (name) {
        var colors = legacy[name];
        if (!colors || !colors.length) return;
        var rec = {
          id: uid('pal'),
          kind: 'palette',
          name: name,
          note: '',
          colors: colors.slice(),
          thumb: null,
          accent: null,
          tags: [],
          created: nowIso(),
          updated: nowIso(),
          source: 'migrated',
          origin: {}
        };
        db.presets[rec.id] = rec;
        LGStore.writePresetFile(rec);
        col.items.push({ id: uid('itm'), ref: rec.id, folder: folder ? folder.id : null });
      });
    }

    try { localStorage.setItem(LEGACY_KEY + '_migrated', '1'); } catch (e) { }
    save(true);
  }

  /* Writes are debounced: a drag-reorder fires dozens of mutations and each
     one would otherwise rotate a backup and rewrite the index. `immediate`
     is for the ones that must not be lost — a save, a delete, a shutdown. */
  function save(immediate) {
    if (!db) return;
    db.updated = nowIso();

    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }

    var flush = function () {
      saveTimer = null;
      if (!LGStore.available()) return;
      LGStore.rotateBackups();
      LGStore.writeJson(LGStore.paths.library, db);
      LGStore.writeJson(LGStore.paths.settings, db.settings);
    };

    if (immediate) flush(); else saveTimer = setTimeout(flush, 600);
    emit();
  }

  function emit() {
    listeners.forEach(function (fn) { try { fn(db); } catch (e) { } });
  }

  function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }

  /* ── HELPERS ─────────────────────────────────────────────────────── */

  function byId(arr, id) {
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  }

  function activeCollection() {
    return byId(db.collections, db.activeCollection) || db.collections[0];
  }

  function setActiveCollection(id) {
    if (byId(db.collections, id)) { db.activeCollection = id; save(); }
  }

  /* ── COLLECTIONS ─────────────────────────────────────────────────── */

  function createCollection(name) {
    var col = blankCollection(name);
    db.collections.push(col);
    db.activeCollection = col.id;
    save(true);
    return col;
  }

  function renameCollection(id, name) {
    var col = byId(db.collections, id);
    if (col) { col.name = name; save(); }
  }

  /* Deleting a collection deletes placements, never presets. Anything that
     was only in this collection becomes "unused" and is still recoverable
     from Add from library — which is exactly what Code Runner does, and the
     reason deleting a collection is not a scary action there. */
  function deleteCollection(id) {
    if (db.collections.length <= 1) return false;
    db.collections = db.collections.filter(function (c) { return c.id !== id; });
    if (db.activeCollection === id) db.activeCollection = db.collections[0].id;
    save(true);
    return true;
  }

  /* ── FOLDERS ─────────────────────────────────────────────────────── */

  function createFolder(collectionId, name, parentId) {
    var col = byId(db.collections, collectionId) || activeCollection();
    var f = {
      id: uid('fld'),
      name: name || 'New Folder',
      parent: parentId || null,
      collapsed: false,
      accent: null
    };
    col.folders.push(f);
    save();
    return f;
  }

  function renameFolder(collectionId, folderId, name) {
    var col = byId(db.collections, collectionId) || activeCollection();
    var f = byId(col.folders, folderId);
    if (f) { f.name = name; save(); }
  }

  function setFolderAccent(collectionId, folderId, accent) {
    var col = byId(db.collections, collectionId) || activeCollection();
    var f = byId(col.folders, folderId);
    if (f) { f.accent = accent || null; save(); }
  }

  function toggleFolder(collectionId, folderId) {
    var col = byId(db.collections, collectionId) || activeCollection();
    var f = byId(col.folders, folderId);
    if (f) { f.collapsed = !f.collapsed; save(); }
  }

  /* Deleting a folder moves its contents up rather than taking them with it.
     Losing a folder should cost you an arrangement, never a preset. */
  function deleteFolder(collectionId, folderId) {
    var col = byId(db.collections, collectionId) || activeCollection();
    var target = byId(col.folders, folderId);
    if (!target) return;

    col.folders.forEach(function (f) {
      if (f.parent === folderId) f.parent = target.parent;
    });
    col.items.forEach(function (it) {
      if (it.folder === folderId) it.folder = target.parent;
    });
    col.folders = col.folders.filter(function (f) { return f.id !== folderId; });
    save();
  }

  /* ── PRESETS ─────────────────────────────────────────────────────── */

  /* The canonical record. Anything that creates a preset — capture, save,
     import, duplicate — comes through here, so every record has the same
     shape and nothing downstream has to guess. */
  function makeRecord(input) {
    var kind = input.kind || (input.type ? 'gradient' : 'palette');
    var rec = {
      id: input.id || uid(kind === 'gradient' ? 'grd' : 'pal'),
      kind: kind,
      name: input.name || 'Untitled',
      note: input.note || '',
      colors: (input.colors || []).slice(),
      thumb: input.thumb || null,
      accent: input.accent || null,
      tags: input.tags || [],
      created: input.created || nowIso(),
      updated: nowIso(),
      source: input.source || 'panel',
      origin: input.origin || {}
    };

    if (kind === 'gradient') {
      rec.type = input.type;
      rec.controls = input.controls || {};
      rec.grain = input.grain || 0;
      rec.glow = input.glow || 0;
      rec.posterize = !!input.posterize;
      rec.posterizeFps = input.posterizeFps || 12;
      rec.colorQuality = !!input.colorQuality;
      rec.fluid = input.fluid || null;
    }
    return rec;
  }

  /* Add to the library and place it in a collection in one move — the
     common case. Pass collectionId: null to add to the library only, which
     is what an import of an unused preset does. */
  function addPreset(input, collectionId, folderId) {
    var rec = makeRecord(input);
    db.presets[rec.id] = rec;
    LGStore.writePresetFile(rec);

    if (collectionId !== null) {
      var col = collectionId ? (byId(db.collections, collectionId) || activeCollection()) : activeCollection();
      col.items.push({ id: uid('itm'), ref: rec.id, folder: folderId || null });
    }
    save(true);
    return rec;
  }

  function updatePreset(id, patch) {
    var rec = db.presets[id];
    if (!rec) return null;
    for (var k in patch) if (patch.hasOwnProperty(k)) rec[k] = patch[k];
    rec.updated = nowIso();
    LGStore.writePresetFile(rec);
    save();
    return rec;
  }

  function getPreset(id) { return db.presets[id] || null; }

  /* Delete for real: the record, its file, its thumbnail, and every
     placement of it in every collection. The panel warns first, because
     this is the one action in the whole model that loses work. */
  function deletePreset(id) {
    var rec = db.presets[id];
    if (!rec) return false;

    if (rec.thumb) LGStore.removeThumb(rec.thumb);
    LGStore.removePresetFile(id);
    delete db.presets[id];

    db.collections.forEach(function (col) {
      col.items = col.items.filter(function (it) { return it.ref !== id; });
    });
    save(true);
    return true;
  }

  function duplicatePreset(id, collectionId, folderId) {
    var rec = db.presets[id];
    if (!rec) return null;
    var copy = JSON.parse(JSON.stringify(rec));
    delete copy.id;
    copy.name = rec.name + ' copy';
    copy.created = nowIso();
    copy.source = 'panel';

    var made = addPreset(copy, collectionId, folderId);
    /* The thumbnail is a file keyed by id, so the copy needs its own. */
    if (rec.thumb) {
      var uri = LGStore.thumbUri(rec.thumb);
      if (uri) {
        var name = LGStore.saveThumb(made.id, uri);
        if (name) updatePreset(made.id, { thumb: name });
      }
    }
    return made;
  }

  /* ── PLACEMENTS ──────────────────────────────────────────────────── */

  function placeInCollection(presetId, collectionId, folderId) {
    if (!db.presets[presetId]) return null;
    var col = byId(db.collections, collectionId) || activeCollection();
    /* Placing the same preset in the same folder twice is always a misclick,
       never an intent. */
    var already = col.items.some(function (it) {
      return it.ref === presetId && (it.folder || null) === (folderId || null);
    });
    if (already) return null;

    var item = { id: uid('itm'), ref: presetId, folder: folderId || null };
    col.items.push(item);
    save();
    return item;
  }

  /* The soft removal. Takes it off this shelf; the library still has it. */
  function removeFromCollection(collectionId, itemId) {
    var col = byId(db.collections, collectionId) || activeCollection();
    col.items = col.items.filter(function (it) { return it.id !== itemId; });
    save();
  }

  function moveItem(collectionId, itemId, folderId, index) {
    var col = byId(db.collections, collectionId) || activeCollection();
    var idx = -1, i;
    for (i = 0; i < col.items.length; i++) if (col.items[i].id === itemId) { idx = i; break; }
    if (idx === -1) return;

    var item = col.items.splice(idx, 1)[0];
    item.folder = folderId || null;
    if (typeof index !== 'number' || index < 0 || index > col.items.length) {
      col.items.push(item);
    } else {
      col.items.splice(index, 0, item);
    }
    save();
  }

  /* Presets in the library that no collection currently shows. The panel
     surfaces these in Add from library with an "unused" badge, so nothing
     you made can quietly become unreachable. */
  function unusedPresets() {
    var used = {};
    db.collections.forEach(function (col) {
      col.items.forEach(function (it) { used[it.ref] = true; });
    });
    return Object.keys(db.presets)
      .filter(function (id) { return !used[id]; })
      .map(function (id) { return db.presets[id]; });
  }

  function allPresets() {
    return Object.keys(db.presets).map(function (id) { return db.presets[id]; });
  }

  /* ── SEARCH ──────────────────────────────────────────────────────── */

  /* Subsequence scoring rather than substring matching, so "molgld" finds
     "Molten Gold" — the behaviour that makes Code Runner's search feel like
     it understands what you meant. Consecutive hits and hits at a word
     boundary score higher, which keeps the ranking sane.

     Searches the name, the note, the tags and the gradient's own label, so
     typing "chrome" finds a preset called "Client hero" built on Polished
     Chrome. That is the "finds a button by what it does rather than what it
     is called" behaviour, and it is why the field earns its space. */
  function fuzzyScore(needle, hay) {
    if (!needle) return 1;
    needle = needle.toLowerCase();
    hay = String(hay || '').toLowerCase();
    if (!hay) return 0;

    var exact = hay.indexOf(needle);
    if (exact === 0) return 1000;
    if (exact > 0) return 700 - exact;

    var n = 0, score = 0, streak = 0;
    for (var h = 0; h < hay.length && n < needle.length; h++) {
      if (hay[h] === needle[n]) {
        streak++;
        score += 10 + streak * 4;
        if (h === 0 || /[\s\-_/]/.test(hay[h - 1])) score += 15;  /* word start */
        n++;
      } else {
        streak = 0;
      }
    }
    return n === needle.length ? score : 0;
  }

  function labelForType(type) {
    if (typeof GRADIENT_LIBRARY === 'undefined') return type || '';
    for (var i = 0; i < GRADIENT_LIBRARY.length; i++) {
      if (GRADIENT_LIBRARY[i].id === type) return GRADIENT_LIBRARY[i].label + ' ' + GRADIENT_LIBRARY[i].category;
    }
    return type || '';
  }

  function search(query, pool) {
    var list = pool || allPresets();
    if (!query || !query.trim()) return list;
    var q = query.trim();

    return list.map(function (rec) {
      var score = Math.max(
        fuzzyScore(q, rec.name) * 3,
        fuzzyScore(q, labelForType(rec.type)) * 2,
        fuzzyScore(q, (rec.tags || []).join(' ')) * 2,
        fuzzyScore(q, rec.note)
      );
      return { rec: rec, score: score };
    })
      .filter(function (x) { return x.score > 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .map(function (x) { return x.rec; });
  }

  /* ── EXPORT / IMPORT ─────────────────────────────────────────────── */

  /* A bundle is plain JSON with thumbnails inlined as data URIs.

     Code Runner uses a zip for this. We do not, deliberately: a single JSON
     file needs no zip library in a panel that currently has no build step, it
     can be inspected and diffed, and it drops onto the panel as one file. The
     cost is size — a thumbnail is ~10KB of base64 — which for a library of a
     few hundred presets is still under a couple of megabytes. */
  function exportPresets(ids, meta) {
    var bundle = {
      format: 'living-gradients-bundle',
      version: 1,
      kind: (ids && ids.length === 1) ? 'preset' : 'collection',
      name: (meta && meta.name) || 'Living Gradients presets',
      exported: nowIso(),
      by: (meta && meta.by) || '',
      panel: (typeof LG_PANEL_VERSION !== 'undefined') ? LG_PANEL_VERSION : '2.0.0',
      presets: [],
      folders: (meta && meta.folders) || [],
      items: (meta && meta.items) || []
    };

    (ids || []).forEach(function (id) {
      var rec = db.presets[id];
      if (!rec) return;
      var copy = JSON.parse(JSON.stringify(rec));
      copy.thumbData = rec.thumb ? LGStore.thumbUri(rec.thumb) : null;
      delete copy.thumb;
      bundle.presets.push(copy);
    });

    return bundle;
  }

  function exportCollection(collectionId, onlyItemIds) {
    var col = byId(db.collections, collectionId) || activeCollection();
    var items = col.items;
    if (onlyItemIds && onlyItemIds.length) {
      items = items.filter(function (it) { return onlyItemIds.indexOf(it.id) !== -1; });
    }
    var ids = items.map(function (it) { return it.ref; });
    /* Only carry folders that something exported actually sits in. */
    var usedFolders = {};
    items.forEach(function (it) { if (it.folder) usedFolders[it.folder] = true; });

    return exportPresets(ids, {
      name: col.name,
      folders: col.folders.filter(function (f) { return usedFolders[f.id]; }),
      items: items.map(function (it) { return { ref: it.ref, folder: it.folder }; })
    });
  }

  /* Importing never overwrites. A preset arriving with an id we already have
     is given a new one, because two people editing "the same" preset in two
     libraries is the normal case and silently replacing one with the other
     loses work. Same-name presets get a numbered suffix rather than merging. */
  function importBundle(bundle, targetCollectionId) {
    if (!bundle || bundle.format !== 'living-gradients-bundle') {
      return { ok: false, error: 'Not a Living Gradients preset file.' };
    }

    var col;
    if (targetCollectionId === 'new') {
      /* A bundle carries the name of the collection it was exported from, so
         importing your own export lands you with two collections called the
         same thing and no way to tell them apart in the picker. Disambiguate
         on the way in. */
      col = createCollection(uniqueCollectionName(bundle.name || 'Imported'));
    } else {
      col = byId(db.collections, targetCollectionId) || activeCollection();
    }

    var idMap = {}, folderMap = {}, added = 0;

    (bundle.folders || []).forEach(function (f) {
      var made = createFolder(col.id, f.name, null);
      folderMap[f.id] = made.id;
    });

    (bundle.presets || []).forEach(function (p) {
      var incoming = JSON.parse(JSON.stringify(p));
      var thumbData = incoming.thumbData;
      delete incoming.thumbData;
      delete incoming.id;

      incoming.name = uniqueName(incoming.name);
      incoming.source = 'import';

      var rec = makeRecord(incoming);
      db.presets[rec.id] = rec;

      if (thumbData) {
        var name = LGStore.saveThumb(rec.id, thumbData);
        if (name) rec.thumb = name;
      }
      LGStore.writePresetFile(rec);
      idMap[p.id] = rec.id;
      added++;
    });

    if (bundle.items && bundle.items.length) {
      bundle.items.forEach(function (it) {
        var ref = idMap[it.ref];
        if (!ref) return;
        col.items.push({ id: uid('itm'), ref: ref, folder: folderMap[it.folder] || null });
      });
    } else {
      /* A bundle with no placements (a single exported preset) still has to
         land somewhere the user can see it. */
      Object.keys(idMap).forEach(function (old) {
        col.items.push({ id: uid('itm'), ref: idMap[old], folder: null });
      });
    }

    db.activeCollection = col.id;
    save(true);
    return { ok: true, added: added, collection: col.name };
  }

  function uniqueCollectionName(name) {
    var taken = {};
    db.collections.forEach(function (c) { taken[c.name.toLowerCase()] = true; });
    if (!taken[(name || '').toLowerCase()]) return name || 'Imported';
    var n = 2;
    while (taken[(name + ' ' + n).toLowerCase()]) n++;
    return name + ' ' + n;
  }

  function uniqueName(name) {
    var taken = {};
    allPresets().forEach(function (r) { taken[r.name.toLowerCase()] = true; });
    if (!taken[(name || '').toLowerCase()]) return name || 'Untitled';
    var n = 2;
    while (taken[(name + ' ' + n).toLowerCase()]) n++;
    return name + ' ' + n;
  }

  /* Everything, including panel settings — the "back up everything" that is
     worth running once a library gets big. */
  function backupEverything() {
    var bundle = exportPresets(Object.keys(db.presets), { name: 'Full backup' });
    bundle.kind = 'full';
    bundle.collections = JSON.parse(JSON.stringify(db.collections));
    bundle.settings = JSON.parse(JSON.stringify(db.settings));
    bundle.activeCollection = db.activeCollection;
    return bundle;
  }

  /* A full restore replaces the library outright — that is what makes it a
     restore rather than an import — but rotates a backup first, so choosing
     the wrong file is not the end of the story. */
  function restoreEverything(bundle) {
    if (!bundle || bundle.format !== 'living-gradients-bundle' || bundle.kind !== 'full') {
      return { ok: false, error: 'Not a full Living Gradients backup.' };
    }
    LGStore.rotateBackups();

    var fresh = blankDb();
    fresh.collections = bundle.collections || fresh.collections;
    fresh.settings = bundle.settings || defaultSettings();
    fresh.activeCollection = bundle.activeCollection || fresh.collections[0].id;
    fresh.presets = {};

    (bundle.presets || []).forEach(function (p) {
      var incoming = JSON.parse(JSON.stringify(p));
      var thumbData = incoming.thumbData;
      delete incoming.thumbData;
      var rec = makeRecord(incoming);
      rec.id = p.id || rec.id;
      if (thumbData) {
        var name = LGStore.saveThumb(rec.id, thumbData);
        if (name) rec.thumb = name;
      }
      fresh.presets[rec.id] = rec;
      LGStore.writePresetFile(rec);
    });

    db = normalise(fresh);
    save(true);
    return { ok: true, count: Object.keys(db.presets).length };
  }

  /* ── SETTINGS ────────────────────────────────────────────────────── */

  function settings() { return db.settings; }

  function setSetting(key, value) {
    db.settings[key] = value;
    save();
    return value;
  }

  /* ── PUBLIC ──────────────────────────────────────────────────────── */

  return {
    init: load,
    data: function () { return db; },
    save: save,
    onChange: onChange,

    collections: function () { return db.collections; },
    activeCollection: activeCollection,
    setActiveCollection: setActiveCollection,
    createCollection: createCollection,
    renameCollection: renameCollection,
    deleteCollection: deleteCollection,

    createFolder: createFolder,
    renameFolder: renameFolder,
    deleteFolder: deleteFolder,
    toggleFolder: toggleFolder,
    setFolderAccent: setFolderAccent,

    addPreset: addPreset,
    getPreset: getPreset,
    updatePreset: updatePreset,
    deletePreset: deletePreset,
    duplicatePreset: duplicatePreset,
    allPresets: allPresets,
    unusedPresets: unusedPresets,

    placeInCollection: placeInCollection,
    removeFromCollection: removeFromCollection,
    moveItem: moveItem,

    search: search,
    labelForType: labelForType,

    exportPresets: exportPresets,
    exportCollection: exportCollection,
    importBundle: importBundle,
    backupEverything: backupEverything,
    restoreEverything: restoreEverything,

    settings: settings,
    setSetting: setSetting,

    uid: uid
  };
})();

if (typeof window !== 'undefined') window.LGLibrary = LGLibrary;
