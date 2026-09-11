/* =====================================================================
   LIVING GRADIENTS — TRAIL LAB
   ---------------------------------------------------------------------
   Build ONE gradient of the Trail family at delivery size, freeze two
   frames of it to PNG, and report what the builder said while doing it.

   Not a contact sheet. The contact sheet builds all of them and takes
   minutes; this is driven one type at a time from the shell through the
   Flue bridge, which times out at thirty seconds, so it has to be able to
   answer one question per call.

   THE QUESTION IT EXISTS TO ANSWER is whether the frame is covered. Every
   trail ends in a Warp, and the Warp pinches the layer inside its own
   edges — so the failure mode of this whole family is black scoops at the
   frame edge where the bank ran out. That is not something a builder can
   report, because nothing threw: the effect applied, the values took, and
   the picture has a hole in it. It has to be looked at, and the looking is
   tools/trail_check.ps1 counting near-black pixels in the PNGs this
   writes.

   USAGE, from the bridge:

       $.evalFile(new File('…/tools/trail_lab.jsx'));
       LGTrailLab('TrailGradient');                     // defaults
       LGTrailLab('TrailGradient', { bend: 100 });      // an extreme

   Nothing here saves the project, and nothing removes an item it did not
   create. Everything it makes goes in an LGTRAIL folder — LGTrailClean()
   takes that folder away again.
   ===================================================================== */

/* main.jsx is evaluated HERE, at the top level of this file, and not inside
   the lab function below.

   $.evalFile defines into the scope that calls it. Called from inside the
   closure it filled the closure, $.global.dispatchBuild stayed at whatever a
   previous run had left in the engine's globals, and the first call reported
   "dispatchBuild missing" while every later one would have quietly rebuilt a
   STALE main.jsx and reported stale results. The contact sheet paid for this
   lesson once already; this is the same fix.

   It is re-read on every bridge call because this whole file is re-evaluated
   on every bridge call, which is what the loop needs: the point of the lab is
   to look at the effect of an edit, and a stale build looks exactly like a
   working one. */
var LG_TL_ROOT = new File($.fileName).parent.parent;    // …/LivingGradients
$.evalFile(new File(LG_TL_ROOT.fsName + '/jsx/main.jsx'));

$.global.LGTrailLab = (function () {

    var ROOT = LG_TL_ROOT;
    var BUILD_W = 1920, BUILD_H = 1080;
    var DUR = 6, FPS = 30;

    /* FOUR TIMES, AND ZERO IS ONE OF THEM ON PURPOSE.

       A trail that is bent wrong shows its hole at every frame. A trail
       whose scroll never landed looks perfect at one frame and identical at
       the next. And a trail can render black on ONE frame and be flawless
       either side of it — Motion Tile does exactly that when the tiling
       lands on a particular alignment, which the whole bank did at time zero
       until the standing offset went in.

       Two samples could not see that, and the frame it could not see is the
       first frame of every loop this thing renders. The times are spread and
       deliberately not round, so a fault that happens to sit on a whole
       second is not the one that gets missed. */
    var TIMES = [0.0, 1.37, 2.0, 3.73];

    function readFile(rel) {
        var f = new File(ROOT.fsName + '/' + rel);
        if (!f.exists) return null;
        f.encoding = 'UTF-8';
        f.open('r');
        var txt = f.read();
        f.close();
        return txt;
    }

    /* Regex over the sources rather than a copy of the list, for the reason
       the contact sheet gives: a second copy of the library is a second
       thing to forget to update. */
    function parseLibrary(src) {
        var out = [], re = /\{\s*id:\s*'([^']+)'[^}]*?defaultColors:\s*\[([^\]]*)\]/g, m;
        while ((m = re.exec(src)) !== null) {
            var cols = [], cm, cre = /'(#[0-9a-fA-F]{3,8})'/g;
            while ((cm = cre.exec(m[2])) !== null) cols.push(cm[1]);
            var lm = /label:\s*'([^']+)'/.exec(src.substring(m.index, m.index + 400));
            out.push({ id: m[1], label: lm ? lm[1] : m[1],
                       colors: cols.length ? cols : ['#FFFFFF', '#888888', '#222222', '#000000'] });
        }
        return out;
    }

    function parseControls(src) {
        var byType = {}, re = /\n  ([A-Za-z_]+):\s*\[/g, m;
        while ((m = re.exec(src)) !== null) {
            var name = m[1], from = m.index + m[0].length, depth = 1, i = from;
            while (i < src.length && depth > 0) {
                var ch = src.charAt(i);
                if (ch === '[') depth++; else if (ch === ']') depth--;
                i++;
            }
            var block = src.substring(from, i - 1), vals = {}, em, ere = /\{([^{}]*)\}/g;
            while ((em = ere.exec(block)) !== null) {
                var idm = /id:\s*'([^']+)'/.exec(em[1]);
                var dfm = /default:\s*('([^']*)'|[-0-9.]+)/.exec(em[1]);
                if (idm && dfm) vals[idm[1]] = (dfm[2] !== undefined) ? dfm[2] : parseFloat(dfm[1]);
            }
            byType[name] = vals;
        }
        return byType;
    }

    function labFolder() {
        var i;
        for (i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof FolderItem && it.name === 'LGTRAIL') return it;
        }
        return app.project.items.addFolder('LGTRAIL');
    }

    function esc(s) {
        return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    /* Removing the folder is not a complete clean. Each bank is built out of
       solids, and a removed comp leaves its solids behind as unused footage —
       fifty-five of them per trail, which is how one afternoon of rebuilds
       put sixteen hundred orphaned items in the project. The stroke names are
       this lab's own, and only items nothing still uses are taken, so the
       user's own unused footage is left alone. */
    var STROKE = /^(Trail|Horizon|Iris|Ripple|Molten|Haze|Signal|Lattice V|Lattice H) [0-9]+$/;

    /* The bank precomps, by name, as well as by folder. Adopting them into
       the LGTRAIL folder after the build is not reliable enough to be the
       only route — eight of them survived a clean that reported success —
       and a comp nothing uses, named exactly what this lab names its banks,
       is this lab's litter whether it made it into the folder or not. */
    var BANK = /^(Trail|Horizon|Iris|Ripple|Molten|Haze|Signal|Lattice V) Base$/;

    $.global.LGTrailClean = function () {
        var i, folders = 0, solids = 0;
        for (i = app.project.numItems; i >= 1; i--) {
            var it = app.project.item(i);
            if (it instanceof FolderItem && it.name === 'LGTRAIL') {
                try { it.remove(); folders++; } catch (e) { }
            }
        }
        var banks = 0;
        for (i = app.project.numItems; i >= 1; i--) {
            var b = app.project.item(i);
            if (!(b instanceof CompItem) || !BANK.test(b.name)) continue;
            if (b.usedIn.length === 0) { try { b.remove(); banks++; } catch (e) { } }
        }
        for (i = app.project.numItems; i >= 1; i--) {
            var f = app.project.item(i);
            if (!(f instanceof FootageItem) || !STROKE.test(f.name)) continue;
            if (f.usedIn.length === 0) { try { f.remove(); solids++; } catch (e) { } }
        }
        return '{"ok":true,"folders":' + folders + ',"banks":' + banks +
               ',"solids":' + solids + ',"items":' + app.project.numItems + '}';
    };

    return function (typeId, overrides, label) {
        var G = $.global;
        if (typeof G.dispatchBuild !== 'function') {
            return '{"ok":false,"error":"dispatchBuild missing after evalFile"}';
        }

        var library = parseLibrary(readFile('js/presets.js') || '');
        var defs    = parseControls(readFile('js/controls.js') || '');

        var g = null, i;
        for (i = 0; i < library.length; i++) if (library[i].id === typeId) { g = library[i]; break; }
        if (!g) return '{"ok":false,"error":"' + esc(typeId) + ' is not in the library"}';

        var ctrl = {}, k, src = defs[typeId] || {};
        for (k in src) if (src.hasOwnProperty(k)) ctrl[k] = src[k];
        if (overrides) for (k in overrides) if (overrides.hasOwnProperty(k)) ctrl[k] = overrides[k];

        var folder = labFolder();
        var tag = label ? (typeId + '_' + label) : typeId;
        var comp = app.project.items.addComp('LGTRAIL ' + tag, BUILD_W, BUILD_H, 1, DUR, FPS);
        comp.parentFolder = folder;
        comp.bgColor = [0, 0, 0];

        var out = { ok: true, type: typeId, label: g.label, tag: tag,
                    layers: 0, warnings: [], notes: [], pngs: [], error: null };

        try {
            var c = [];
            for (i = 0; i < g.colors.length; i++) c.push(G.hexRgb(g.colors[i]));
            if (G.LG && G.LG.reset) G.LG.reset();

            var t0 = new Date().getTime();
            var unknown = G.dispatchBuild(comp, typeId, c, ctrl, BUILD_W, BUILD_H, DUR);
            out.buildMs = new Date().getTime() - t0;
            out.layers = comp.numLayers;
            if (unknown) out.error = 'dispatchBuild did not handle it: ' + unknown;

            if (G.LG) {
                if (G.LG.report) out.warnings.push(G.LG.report());
                if (G.LG.notes)  out.notes = G.LG.notes();
            }

            /* THE BANK PRECOMPS LAND IN THE PROJECT ROOT, NOT IN THE COMP.

               app.project.items.addComp puts a new comp at the root wherever
               it is called from, so every trail built here left its "… Base"
               behind in the user's project and LGTrailClean, which only ever
               removed the LGTRAIL folder, never took them away. Twenty builds
               into an afternoon that is twenty orphaned precomps — and it
               made this lab lie once, because a probe that searched the
               project for "Trail Base" by name found the oldest one and
               reported settings from a build several edits ago.

               Anything this comp actually uses gets adopted into the folder,
               so the folder is the whole footprint and removing it is a
               complete clean. */
            for (i = 1; i <= comp.numLayers; i++) {
                var lsrc = comp.layer(i).source;
                if (lsrc && lsrc instanceof CompItem) {
                    try { lsrc.parentFolder = folder; } catch (e) { }
                }
            }

            /* Sweep the built layers into the precomp the panel would make,
               so what is frozen here is what the button produces and not a
               loose pile of layers. */
            if (!unknown && comp.numLayers > 0 && typeof G.groupGeneratedLayers === 'function') {
                try {
                    G.groupGeneratedLayers(comp, { type: typeId, colors: g.colors, controls: ctrl,
                                                   grain: 0, glow: 0, colorQuality: true,
                                                   posterize: false, posterizeFps: 12,
                                                   bpmSync: false }, comp.numLayers);
                } catch (e) { out.notes.push('groupGeneratedLayers: ' + e.toString()); }
            }

            var dir = new Folder(ROOT.fsName + '/tools/qa/trail');
            if (!dir.exists) dir.create();
            for (i = 0; i < TIMES.length; i++) {
                var png = new File(dir.fsName + '/' + tag + '_t' + i + '.png');
                if (png.exists) { try { png.remove(); } catch (e) { } }
                comp.saveFrameToPng(TIMES[i], png);
                out.pngs.push(png.name);

                /* NOT CHECKED HERE, AND THAT IS DELIBERATE.

                   saveFrameToPng returns nothing and throws nothing when the
                   render behind it produced no image — which is what happens
                   when an effect asks After Effects for a canvas larger than
                   it will build. So a check is genuinely needed.

                   It cannot be this one. File.exists on the path it was just
                   handed reads false even when the write succeeded: the frame
                   has not reached the disk by the time the next line of the
                   same script runs. Checking here reported eight failures
                   that were eight files sitting in the folder, and cost an
                   afternoon chasing a render bug that did not exist.

                   The check lives in tools/trail_check.ps1, in another
                   process, after this one has finished — where a missing file
                   means the render actually produced nothing. */
            }
        } catch (e) {
            out.ok = false;
            out.error = e.toString() + (e.line ? ' @line ' + e.line : '');
        }

        var parts = [];
        parts.push('"ok":' + (out.ok && !out.error));
        parts.push('"type":"' + esc(out.type) + '"');
        parts.push('"tag":"' + esc(out.tag) + '"');
        parts.push('"layers":' + out.layers);
        parts.push('"buildMs":' + (out.buildMs || 0));
        parts.push('"error":' + (out.error ? '"' + esc(out.error) + '"' : 'null'));
        var wl = [], nl = [];
        for (i = 0; i < out.warnings.length; i++) if (out.warnings[i]) wl.push('"' + esc(out.warnings[i]) + '"');
        for (i = 0; i < out.notes.length; i++)    nl.push('"' + esc(out.notes[i]) + '"');
        parts.push('"warnings":[' + wl.join(',') + ']');
        parts.push('"notes":[' + nl.join(',') + ']');
        var pl = [];
        for (i = 0; i < out.pngs.length; i++) pl.push('"' + esc(out.pngs[i]) + '"');
        parts.push('"pngs":[' + pl.join(',') + ']');
        return '{' + parts.join(',') + '}';
    };
})();

'trail lab ready';
