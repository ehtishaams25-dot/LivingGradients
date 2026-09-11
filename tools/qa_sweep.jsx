/* =====================================================================
   LIVING GRADIENTS - QA SWEEP
   ---------------------------------------------------------------------
   The V2.2 review instrument. tools/contact_sheet.jsx gives you one still
   of the whole library at one moment; tools/hole_probe.jsx dumps the
   structure of one comp. Neither answers the question this pass has to
   answer, which is:

     does every gradient still look right at every size, all the way
     through its animation, and can that be checked without a human
     staring at 800 frames?

   So this builds a gradient, renders it at several points across its
   duration, and writes the frames to disk. tools/qa_analyse.js then reads
   the frames back and measures holes, banding, chroma, contrast and
   motion. Only the rows the measurement flags need a human eye, and the
   frames are already there when one is wanted.

   ISOLATION. Everything is created under GRADIENT_PLUGIN_DEV and every
   comp is named GPDEV_<id>_<W>x<H>, because another agent may be working
   in this application at the same time. Nothing outside that folder is
   read, moved, renamed or deleted, and the project is never saved.

   CONFIGURATION comes from tools/qa/config.json, so the caller can drive
   this in chunks without rewriting the script:

     { "ids": ["Copper","Gold"],   // omit for the whole library
       "from": 0, "count": 4,      // slice of the (filtered) library
       "width": 1920, "height": 1080,
       "fps": 30, "duration": 8,
       "times": [0, 0.25, 0.5, 0.75, 1.0],   // fractions of duration
       "keepComps": false,
       "force": false }

   BUILT AT DELIVERY SIZE, ALWAYS. Several builders carry hard-coded pixel
   values - a 700px directional blur, a 4000px RepeTile expansion - so a
   gradient rendered small is evidence about the render size and not about
   the gradient. The frames are written at whatever size was asked for and
   scaled afterwards, never built small.
   ===================================================================== */

var LG_QA_ROOT = new File($.fileName).parent.parent;   /* ...\LivingGradients */
var LG_QA_MAIN = new File(LG_QA_ROOT.fsName + '/jsx/main.jsx');

/* $.evalFile, not $.global.eval. ExtendScript's eval defines into the CALLING
   scope, so builders read from inside a closure land in that closure and the
   dispatch table keeps pointing at whatever a previous run left in globals -
   which means run two silently renders run one's code. */
if (LG_QA_MAIN.exists) { $.evalFile(LG_QA_MAIN); }

(function () {

    var root = LG_QA_ROOT;
    var G = $.global;

    function readFile(rel) {
        var f = new File(root.fsName + '/' + rel);
        if (!f.exists) return null;
        f.encoding = 'UTF-8';
        f.open('r');
        var t = f.read();
        f.close();
        return t;
    }

    function writeFile(rel, text) {
        var f = new File(root.fsName + '/' + rel);
        f.parent.create();
        f.encoding = 'UTF-8';
        f.open('w');
        f.write(text);
        f.close();
    }

    /* File.exists answers as of when the File object was constructed, and the
       object necessarily predates the frame being saved into it. Every check
       therefore needs a fresh File, and saveFrameToPng can return before the
       bytes land, so it also needs a moment. This cost a whole render run
       once: 300KB of perfectly good PNG on disk, every frame reported failed. */
    function wroteFile(path) {
        var tries = 0;
        /* Twenty seconds, not two. A 4K frame off a heavy stack - Snakeskin,
           Halftone, the shaded metals - takes several seconds to write, and a
           two-second budget reported four perfectly good gradients as having
           produced no frame at all. */
        /* A NON-ZERO LENGTH IS NOT A FINISHED FILE. saveFrameToPng returns
           before the bytes are all flushed, so the first size you can read is
           often a partial PNG - ffmpeg reported "chunk too big" and an invalid
           signature on one, which would have been measured as a frame full of
           holes rather than as a frame that was not there yet. Two consecutive
           reads at the same non-zero size is the check that means finished. */
        var lastSize = -1;
        while (tries < 200) {
            var probe = new File(path);
            if (probe.exists && probe.length > 0) {
                if (probe.length === lastSize) return probe.length;
                lastSize = probe.length;
            }
            $.sleep(100);
            tries++;
        }
        return 0;
    }

    /* ---- the library and its control defaults, read from source ---------
       Regex over js/presets.js and js/controls.js rather than a copy kept
       here. A second copy of the library is a second thing to forget. */

    function parseLibrary(src) {
        var out = [], re = /\{\s*id:\s*'([^']+)'[^}]*?defaultColors:\s*\[([^\]]*)\]/g, m;
        while ((m = re.exec(src)) !== null) {
            var cols = [], cm, cre = /'(#[0-9a-fA-F]{3,8})'/g;
            while ((cm = cre.exec(m[2])) !== null) cols.push(cm[1]);
            var head = src.substring(m.index, m.index + 400);
            var lm = /label:\s*'([^']+)'/.exec(head);
            var gm = /category:\s*'([^']+)'/.exec(head);
            out.push({
                id: m[1],
                label: lm ? lm[1] : m[1],
                category: gm ? gm[1] : '',
                colors: cols.length ? cols : ['#FFFFFF', '#888888', '#222222', '#000000']
            });
        }
        return out;
    }

    function parseControls(src) {
        var byType = {}, re = /\n  ([A-Za-z_]+):\s*\[/g, m;
        while ((m = re.exec(src)) !== null) {
            var name = m[1], from = m.index + m[0].length, depth = 1, i = from;
            while (i < src.length && depth > 0) {
                var ch = src.charAt(i);
                if (ch === '[') depth++;
                else if (ch === ']') depth--;
                i++;
            }
            var block = src.substring(from, i - 1), vals = {}, em, ere = /\{([^{}]*)\}/g;
            while ((em = ere.exec(block)) !== null) {
                var entry = em[1];
                var idm = /id:\s*'([^']+)'/.exec(entry);
                var dfm = /default:\s*('([^']*)'|\[([^\]]*)\]|[-0-9.]+)/.exec(entry);
                if (!idm || !dfm) continue;
                if (dfm[2] !== undefined) vals[idm[1]] = dfm[2];
                else if (dfm[3] !== undefined) {
                    var parts = dfm[3].split(','), arr = [], pi;
                    for (pi = 0; pi < parts.length; pi++) arr.push(parseFloat(parts[pi]));
                    vals[idm[1]] = arr;
                } else vals[idm[1]] = parseFloat(dfm[1]);
            }
            byType[name] = vals;
        }
        return byType;
    }

    /* ---- project furniture, all of it inside GRADIENT_PLUGIN_DEV -------- */

    function folderIn(name, parent) {
        var i, it;
        for (i = 1; i <= app.project.numItems; i++) {
            it = app.project.item(i);
            if (it instanceof FolderItem && it.name === name && it.parentFolder === parent) return it;
        }
        var f = app.project.items.addFolder(name);
        f.parentFolder = parent;
        return f;
    }

    /* ---- run ------------------------------------------------------------ */

    var cfgSrc = readFile('tools/qa/config.json');
    if (!cfgSrc) return JSON.stringify({ ok: false, err: 'tools/qa/config.json is missing' });

    var cfg;
    try { cfg = eval('(' + cfgSrc + ')'); }
    catch (e) { return JSON.stringify({ ok: false, err: 'config.json did not parse: ' + e.toString() }); }

    var W = cfg.width || 1920, H = cfg.height || 1080;
    var FPS = cfg.fps || 30, DUR = cfg.duration || 8;
    var TIMES = cfg.times || [0, 0.25, 0.5, 0.75, 1.0];

    if (typeof G.dispatchBuild !== 'function') {
        return JSON.stringify({ ok: false, err: 'jsx/main.jsx did not evaluate; dispatchBuild missing' });
    }

    /* applyGlobalPolish stamps the payload onto the layer with JSON.stringify,
       and ExtendScript does not always have JSON. Losing that stamp loses the
       ability to reopen a test comp in the panel. */
    if (typeof G.JSON === 'undefined') {
        G.JSON = { stringify: function (o) {
            if (o === null || o === undefined) return 'null';
            var t = typeof o;
            if (t === 'number' || t === 'boolean') return String(o);
            if (t === 'string') return '"' + o.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
            var parts = [], i, k;
            if (o instanceof Array) {
                for (i = 0; i < o.length; i++) parts.push(G.JSON.stringify(o[i]));
                return '[' + parts.join(',') + ']';
            }
            for (k in o) if (o.hasOwnProperty(k)) parts.push('"' + k + '":' + G.JSON.stringify(o[k]));
            return '{' + parts.join(',') + '}';
        } };
    }

    var presetsSrc = readFile('js/presets.js');
    var controlsSrc = readFile('js/controls.js');
    if (!presetsSrc) return JSON.stringify({ ok: false, err: 'js/presets.js unreadable' });

    var library = parseLibrary(presetsSrc);

    /* ---- variant tables --------------------------------------------------

       Some gradients' sliders are DERIVED at run time rather than written out:
       js/controls.js builds the SaaS family's control sets from SAAS_VARIANTS
       in js/presets.js. parseControls() above reads literal text, so it cannot
       see them, and every one of them would be built with the base SaaS
       defaults instead.

       That is not a hypothetical. Four SaaS presets were rendered, looked at
       and rejected on what turned out to be four renders of a fifth, because
       this gap was on the tooling side and nothing reported it.

       The table is literal text where it lives, so read it there. */
    function parseVariantTable(src, name) {
        var out = {};
        if (!src) return out;
        var block = new RegExp('var ' + name + '\\s*=\\s*\\{([\\s\\S]*?)\\n\\};').exec(src);
        if (!block) return out;
        var re = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\{([^{}]*)\}/g, m;
        while ((m = re.exec(block[1])) !== null) {
            var vals = {}, kv = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(-?[0-9.]+)/g, k;
            while ((k = kv.exec(m[2])) !== null) vals[k[1]] = parseFloat(k[2]);
            out[m[1]] = vals;
        }
        return out;
    }

    function mergeVariantDefaults(defaults, presetsSrc) {
        var v = parseVariantTable(presetsSrc, 'SAAS_VARIANTS'), id, k;
        for (id in v) {
            if (!v.hasOwnProperty(id)) continue;
            if (!defaults[id]) defaults[id] = {};
            /* The variant's own numbers win over anything inherited. */
            for (k in v[id]) if (v[id].hasOwnProperty(k)) defaults[id][k] = v[id][k];
        }
        return defaults;
    }
    var defaults = controlsSrc ? parseControls(controlsSrc) : {};
    defaults = mergeVariantDefaults(defaults, presetsSrc);

    /* ---- candidates ------------------------------------------------------

       js/candidates.js is the workshop: gradients that have a builder but no
       card, kept out of the panel entirely until they have been rendered and
       looked at. Appended to the library here so one sweep can mix shipped
       gradients and candidates in a single run, which is what comparing a new
       one against the thing it has to beat requires.

       Its entries carry their own `controls`, and that is not a convenience.
       parseControls() reads LITERAL TEXT out of js/controls.js, so a control
       set that is generated at run time -- as the SaaS variants' were -- is
       invisible to it, and the sweep silently built all four with the base
       defaults. Four gradients were reviewed, and rejected, on renders of a
       fifth. A candidate states its numbers here or it is not tested. */

    var candidatesSrc = readFile('js/candidates.js');
    if (candidatesSrc) {
        var candLib = parseLibrary(candidatesSrc);
        for (var qi = 0; qi < candLib.length; qi++) {
            candLib[qi].candidate = true;
            library.push(candLib[qi]);
        }
        /* The controls, per id, out of the same entries. eval on one object
           literal at a time rather than on the whole file: the file is a
           source file with comments and a module tail, and this only wants
           the data. */
        var cre = /id:\s*'([^']+)'[\s\S]{0,900}?controls:\s*(\{[^{}]*\})/g, cm;
        while ((cm = cre.exec(candidatesSrc)) !== null) {
            try { defaults[cm[1]] = eval('(' + cm[2] + ')'); }
            catch (e) { /* a malformed entry falls back to the builder's own defaults */ }
        }
    }

    if (cfg.ids && cfg.ids.length) {
        var want = {}, wi;
        for (wi = 0; wi < cfg.ids.length; wi++) want[cfg.ids[wi]] = true;
        var filtered = [], fi;
        for (fi = 0; fi < library.length; fi++) if (want[library[fi].id]) filtered.push(library[fi]);
        library = filtered;
    }

    var from = cfg.from || 0;
    var count = (cfg.count === undefined) ? library.length : cfg.count;
    var slice = library.slice(from, from + count);

    var devRoot = folderIn('GRADIENT_PLUGIN_DEV', app.project.rootFolder);
    var testFolder = folderIn('01_TEST_COMPS', devRoot);
    var qaFolder = folderIn('05_QA', devRoot);

    var frameDir = 'tools/qa/frames';
    var results = [];


    /* ---- WHAT WAS HERE BEFORE THIS SCRIPT RAN ------------------------------

       THIS REPLACES A SWEEP THAT COULD DELETE THE USER'S OWN WORK, and it did.

       All three render tools in this folder shared one pattern: record
       `beforeItems = app.project.numItems`, then afterwards walk
       `for (pi = numItems; pi > beforeItems; pi--)` and treat everything above
       that index as "mine, sweep it into my folder" - a folder which is then
       deleted whole at the end of the run.

       That test is not valid. `app.project.item(i)` enumerates in the Project
       panel's own order, which is not insertion order, and every removal
       shifts every index after it. Across forty-three gradients, each of which
       adds several items and then has them removed, the count falls below the
       indices of items that were in the project when the script started - and
       the descending loop reaches them, moves them into the tool's folder, and
       the folder is deleted with them inside it.

       Observed: a project holding one comp plus a folder tree came out of a
       full library render holding neither. Nothing in the script intends that
       and nothing in it reports it.

       Identity is the test that means what it says. Snapshot the items that
       exist before anything is built, and treat exactly the ones that are not
       in that list as this run's own. Comparing object references is O(n) per
       lookup against a list of tens, which costs nothing next to a render. */
    function lgSnapshotItems() {
        var seen = [], i;
        for (i = 1; i <= app.project.numItems; i++) seen.push(app.project.item(i));
        return seen;
    }

    function lgWasHereBefore(seen, item) {
        var i;
        for (i = 0; i < seen.length; i++) if (seen[i] === item) return true;
        return false;
    }

    app.beginUndoGroup('GPDEV QA sweep');

    var PRE_EXISTING = lgSnapshotItems();

    for (var i = 0; i < slice.length; i++) {
        var g = slice[i];
        var tag = cfg.variant ? ('__' + cfg.variant) : '';
        var stem = frameDir + '/' + g.id + tag + '/' + W + 'x' + H;
        var row = { id: g.id, label: g.label, category: g.category,
                    w: W, h: H, layers: 0, status: 'OK', detail: '', frames: [] };

        /* Resumable. A finished set is skipped outright, so a run that dies
           halfway costs only what it had not done. */
        var haveAll = true, ti;
        if (!cfg.force) {
            for (ti = 0; ti < TIMES.length; ti++) {
                var pct = Math.round(TIMES[ti] * 100);
                var probe = new File(root.fsName + '/' + stem + '_t' + pct + '.png');
                if (!probe.exists || probe.length === 0) { haveAll = false; break; }
            }
        } else haveAll = false;

        if (haveAll) {
            row.status = 'SKIP';
            row.detail = 'frames already on disk';
            results.push(row);
            continue;
        }

        var compName = 'GPDEV_' + g.id + tag + '_' + W + 'x' + H;
        var comp = null;

        try {
            comp = app.project.items.addComp(compName, W, H, 1, DUR, FPS);
            comp.parentFolder = testFolder;
            comp.bgColor = [0, 0, 0];

            var c = [], ci;
            for (ci = 0; ci < g.colors.length; ci++) c.push(G.hexRgb(g.colors[ci]));

            var ctrl = {}, srcCtrl = defaults[g.id] || {}, k;
            for (k in srcCtrl) if (srcCtrl.hasOwnProperty(k)) ctrl[k] = srcCtrl[k];

            /* A named variant overrides individual controls and renames the
               frames, so a sweep of one slider against the same measurement
               is one config file rather than an edit to this script. */
            if (cfg.controls) for (k in cfg.controls) if (cfg.controls.hasOwnProperty(k)) ctrl[k] = cfg.controls[k];

            /* Per-gradient overrides, applied last. cfg.controls above is one
               set applied to everything in the run, which is right for "sweep
               softness across the library" and useless for "build these six
               candidates, each with its own numbers". */
            if (cfg.controlsById && cfg.controlsById[g.id]) {
                var byId = cfg.controlsById[g.id];
                for (k in byId) if (byId.hasOwnProperty(k)) ctrl[k] = byId[k];
            }
            if (cfg.colors && cfg.colors.length) g.colors = cfg.colors;

            var payload = {
                type: g.id, colors: g.colors, controls: ctrl,
                grain: 0, glow: 0, colorQuality: true,
                posterize: false, posterizeFps: 12, bpmSync: false
            };

            if (G.LG && G.LG.reset) G.LG.reset();
            try { G.applyColorQuality(false); } catch (e) { }

            var unknown = G.dispatchBuild(comp, g.id, c, ctrl, W, H, DUR);
            row.layers = comp.numLayers;

            if (unknown) { row.status = 'SKIP'; row.detail = String(unknown); }
            else if (row.layers === 0) { row.status = 'EMPTY'; row.detail = 'builder ran and added no layers'; }
            else {
                var wrapper = G.groupGeneratedLayers(comp, payload, row.layers);
                G.applyGlobalPolish(comp, payload, wrapper);

                if (G.LG && G.LG.count && G.LG.count() > 0) {
                    row.status = 'WARN';
                    if (G.LG.report) row.detail = G.LG.report().replace(/^\s*\|\s*/, '');
                }

                /* Anything the builder left in the project root - Halftone
                   alone makes four precomps - is swept into the dev folder.
                   Never touches an item that was there before this gradient. */
                var pi;
                for (pi = app.project.numItems; pi >= 1; pi--) {
                    try {
                        var item = app.project.item(pi);
                        if (item.parentFolder === app.project.rootFolder &&
                            !lgWasHereBefore(PRE_EXISTING, item)) {
                            item.parentFolder = testFolder;
                        }
                    } catch (e2) { }
                }

                for (ti = 0; ti < TIMES.length; ti++) {
                    var frac = TIMES[ti];
                    var pct2 = Math.round(frac * 100);
                    /* The last frame, not one frame past the end - comp.duration
                       is exclusive and saveFrameToPng at exactly duration
                       renders nothing. */
                    var t = Math.min(frac * DUR, DUR - (1 / FPS));
                    var outPath = root.fsName + '/' + stem + '_t' + pct2 + '.png';
                    var outFile = new File(outPath);
                    outFile.parent.create();
                    comp.saveFrameToPng(t, outFile);
                    var bytes = wroteFile(outPath);
                    if (bytes === 0) {
                        row.status = 'NOFRAME';
                        row.detail = 'saveFrameToPng wrote nothing at t=' + t;
                    } else {
                        row.frames.push({ pct: pct2, t: t, bytes: bytes });
                    }
                }
            }
        } catch (err) {
            row.status = 'THREW';
            row.detail = err.toString() + (err.line ? ' (line ' + err.line + ')' : '');
        }

        /* The comps are the heavy part of a long run and the frames are the
           evidence, so they go unless the caller asked to keep them. Only ever
           items this loop created, and only inside 01_TEST_COMPS. */
        if (!cfg.keepComps) {
            try {
                for (var di = app.project.numItems; di >= 1; di--) {
                    var dead = app.project.item(di);
                    if (dead && dead.parentFolder === testFolder &&
                        !lgWasHereBefore(PRE_EXISTING, dead)) {
                        dead.remove();
                    }
                }
            } catch (e3) { }
        }

        results.push(row);
    }

    app.endUndoGroup();

    var out = {
        ok: true, ae: app.version, when: new Date().toString(),
        w: W, h: H, fps: FPS, duration: DUR, times: TIMES,
        total: library.length, from: from, done: results.length,
        bpc: app.project.bitsPerChannel,
        results: results
    };
    writeFile('tools/qa/last_sweep.json', G.JSON.stringify(out));
    return G.JSON.stringify(out);
})();
