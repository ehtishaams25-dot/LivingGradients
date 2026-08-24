/* =====================================================================
   LIVING GRADIENTS — CONTACT SHEET
   ---------------------------------------------------------------------
   Run once, on an empty project:  File > Scripts > Run Script File…

   Builds every gradient in the library into its own comp, at its own
   default palette and default controls, and tiles them into one comp you
   can take in at a glance.

   Why this exists: twenty-five of the thirty-two gradients had never been
   rendered and looked at. Every one of them was written the same way the
   broken ones were — from memory, against parameters that turned out not to
   exist, with the failure swallowed by a try/catch. Fixing them one at a
   time from a verbal description of what looks wrong is the slowest possible
   way to work, and it is what we had been doing.

   Two outputs:

     • LG CONTACT SHEET — every gradient, tiled and labelled.
     • tools/contact_sheet_report.txt — which builders threw, which warned,
       what the warnings said, and how many layers each one actually made.

   The tiles go through the SAME pipeline the panel uses — dispatchBuild,
   then groupGeneratedLayers, then applyGlobalPolish — at the panel's own
   default global settings (grain 0, glow 0, colour quality on, posterize
   off). Anything less and the sheet would be showing something the panel
   never builds, which would make the audit worthless.

   Palettes come from js/presets.js and control defaults from js/controls.js,
   read at run time rather than copied here, so this can never drift.
   ===================================================================== */

/* main.jsx is loaded here, at the top level of the file, with $.evalFile.

   It used to be `$.global.eval(mainSrc)` from inside the closure below, and
   that silently did the wrong thing: ExtendScript's eval defines into the
   CALLING scope, so the freshly-read builders landed in the closure and were
   never called, while $.global.dispatchBuild still pointed at whatever a
   previous run had left in the engine's globals. The second contact sheet
   therefore rendered a stale main.jsx and reported stale warnings, with
   nothing in the output to show that it had.

   $.evalFile defines globally, and the report now prints the size and date of
   the file it actually evaluated, so a stale run cannot pass unnoticed. */
var LG_CS_ROOT = new File($.fileName).parent.parent;   // …/LivingGradients
var LG_CS_MAIN = new File(LG_CS_ROOT.fsName + '/jsx/main.jsx');

if (LG_CS_MAIN.exists) {
    try {
        $.evalFile(LG_CS_MAIN);
    } catch (LG_CS_ERR) {
        alert('jsx/main.jsx did not evaluate:\n' + LG_CS_ERR.toString() +
              (LG_CS_ERR.line ? '\nline ' + LG_CS_ERR.line : ''));
    }
}

(function () {

    var CELL_W = 480, CELL_H = 270;   // one tile on the sheet

    /* Every gradient is BUILT at delivery size and then scaled down into its
       tile. It is not built at tile size.

       This matters more than it sounds. A good number of these builders carry
       hard-coded pixel values — a 700px directional blur, a 4000px RepeTile
       expansion, a 285px star radius — with no relation to the comp they are
       given. At 480x270 a 700px blur is wider than the frame and twenty stars
       smear into flat mush, so the tile shows a broken gradient that is not
       broken at all at 1920x1080. The first sheet was read that way and it
       cost a wrong diagnosis.

       Building at 1920x1080 and scaling the result is the only way the tile
       is evidence about the gradient rather than about the tile size. */
    var BUILD_W = 1920, BUILD_H = 1080;

    var COLS   = 6;
    var DUR    = 6;
    var FPS    = 30;
    var SAMPLE_TIME = 2.0;            // where to freeze the sheet's still

    /* Nothing is excluded any more — the one entry that was (the AI preset,
       which needed code supplied at run time) is gone from the library. Kept
       as a hook in case a future entry needs it. */
    var EXCLUDE = {};

    var root = LG_CS_ROOT;
    var log  = [];

    function note(s) { log.push(s); }
    function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }

    function readFile(relPath) {
        var f = new File(root.fsName + '/' + relPath);
        if (!f.exists) return null;
        f.encoding = 'UTF-8';
        f.open('r');
        var txt = f.read();
        f.close();
        return txt;
    }

    /* ── Reading the library ──────────────────────────────────────────
       Deliberately regex over the source rather than a copy of the list. A
       second copy of the library is a second thing to forget to update, and
       this script exists precisely to stop us trusting stale copies. */

    function parseLibrary(src) {
        var out = [], re = /\{\s*id:\s*'([^']+)'[^}]*?defaultColors:\s*\[([^\]]*)\]/g, m;
        while ((m = re.exec(src)) !== null) {
            var cols = [], cm, cre = /'(#[0-9a-fA-F]{3,8})'/g;
            while ((cm = cre.exec(m[2])) !== null) cols.push(cm[1]);
            var lm = /label:\s*'([^']+)'/.exec(src.substring(m.index, m.index + 400));
            out.push({
                id: m[1],
                label: lm ? lm[1] : m[1],
                colors: cols.length ? cols : ['#FFFFFF', '#888888', '#222222', '#000000']
            });
        }
        return out;
    }

    /* Control defaults, so a tile shows what the panel would build and not
       whatever internal fallback each builder happens to carry. */
    function parseControls(src) {
        var byType = {};
        var re = /\n  ([A-Za-z_]+):\s*\[/g, m;
        while ((m = re.exec(src)) !== null) {
            var name = m[1];
            var from = m.index + m[0].length;
            var depth = 1, i = from;
            while (i < src.length && depth > 0) {
                var ch = src.charAt(i);
                if (ch === '[') depth++;
                else if (ch === ']') depth--;
                i++;
            }
            var block = src.substring(from, i - 1);
            var vals = {}, em, ere = /\{([^{}]*)\}/g;
            while ((em = ere.exec(block)) !== null) {
                var entry = em[1];
                var idm = /id:\s*'([^']+)'/.exec(entry);
                var dfm = /default:\s*('([^']*)'|[-0-9.]+)/.exec(entry);
                if (idm && dfm) {
                    vals[idm[1]] = (dfm[2] !== undefined) ? dfm[2] : parseFloat(dfm[1]);
                }
            }
            byType[name] = vals;
        }
        return byType;
    }

    function countKeys(o) { var n = 0, k; for (k in o) if (o.hasOwnProperty(k)) n++; return n; }

    // ── Load the sources ─────────────────────────────────────────────

    var presetsSrc  = readFile('js/presets.js');
    var controlsSrc = readFile('js/controls.js');
    var mainSrc     = readFile('jsx/main.jsx');

    if (!presetsSrc) { alert('Could not read js/presets.js — is this script still in tools/?'); return; }
    if (!mainSrc)    { alert('Could not read jsx/main.jsx.'); return; }

    var library  = parseLibrary(presetsSrc);
    var defaults = controlsSrc ? parseControls(controlsSrc) : {};
    if (!library.length) { alert('Could not parse any gradients out of js/presets.js.'); return; }

    var G = $.global;   // main.jsx was evaluated into here at the top of this file.
    if (typeof G.dispatchBuild !== 'function') {
        alert('main.jsx loaded but dispatchBuild is missing.');
        return;
    }

    /* applyGlobalPolish stores the settings on the layer comment through
       JSON.stringify. ExtendScript does not always have JSON, and losing that
       comment loses the ability to reopen a tile in the panel. */
    if (typeof G.JSON === 'undefined') {
        G.JSON = {
            stringify: function (o) {
                if (o === null || o === undefined) return 'null';
                var t = typeof o;
                if (t === 'number' || t === 'boolean') return String(o);
                if (t === 'string') return '"' + o.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
                var parts = [], i, k;
                if (o instanceof Array) {
                    for (i = 0; i < o.length; i++) parts.push(G.JSON.stringify(o[i]));
                    return '[' + parts.join(',') + ']';
                }
                for (k in o) {
                    if (o.hasOwnProperty(k)) parts.push('"' + k + '":' + G.JSON.stringify(o[k]));
                }
                return '{' + parts.join(',') + '}';
            }
        };
    }

    // ── Build ────────────────────────────────────────────────────────

    var queue = [];
    for (var qi = 0; qi < library.length; qi++) {
        if (!EXCLUDE[library[qi].id]) queue.push(library[qi]);
    }

    app.beginUndoGroup('Living Gradients — Contact Sheet');

    var rows   = Math.ceil(queue.length / COLS);
    var sheetW = COLS * CELL_W;
    var sheetH = rows * CELL_H;

    var folder = app.project.items.addFolder('LG CONTACT SHEET');
    var sheet  = app.project.items.addComp('LG CONTACT SHEET', sheetW, sheetH, 1, DUR, FPS);
    sheet.parentFolder = folder;
    sheet.bgColor = [0.06, 0.06, 0.06];

    /* The panel's own colour setup, once, before anything is built. Passing
       false on purpose: High Colour Fidelity is opt-in and off by default, so
       forcing 16-bit here would render the sheet at a quality the user does
       not get. The report prints the depth the project actually ran at. */
    if (G.LG && G.LG.reset) G.LG.reset();
    try { G.applyColorQuality(false); } catch (e) { }

    note('Living Gradients — contact sheet');
    note('AE ' + app.version + '   ' + new Date().toString());
    note(queue.length + ' gradients, ' + COLS + ' x ' + rows + ' grid');
    note('built at ' + BUILD_W + 'x' + BUILD_H + ', scaled into ' +
         CELL_W + 'x' + CELL_H + ' tiles');
    note('project: ' + app.project.bitsPerChannel + ' bpc, linear blending ' +
         (app.project.linearBlending ? 'on' : 'off'));

    /* Which copy of the code this actually is. There are two — the repo and
       the synced one under Adobe/CEP/extensions — and running the sheet from
       the wrong one gives a report that looks current and is not. */
    note('');
    note('ran from : ' + root.fsName);
    /* String() is not decoration: ExtendScript will not coerce a Date inside a
       concatenation chain, it throws. */
    note('builders : jsx/main.jsx, ' + mainSrc.length + ' chars, modified ' +
         String(LG_CS_MAIN.modified));
    note('globals: grain 0, glow 0, posterize off, 16-bit off — the panel defaults');
    note('');
    note('Control defaults read from js/controls.js for ' + countKeys(defaults) +
         ' types. Anything not listed there uses the builder fallbacks.');
    note('');
    note('Read OK with care. Thirteen of these builders never call LG or');
    note('safeSet - living, Oklab Smooth, the seven SilkFlare presets,');
    note('ChromaFlare, Sunburst and Liquid Waves - so a failed property');
    note('write inside them is swallowed by a bare catch and cannot reach');
    note('the WARN column. For those rows the LAYERS count and the picture');
    note('are the only evidence. Re-derive the list with:');
    note('  grep -n "safeSet|LG[.]" jsx/main.jsx, counted per builder.');
    note('');
    note(pad('STATUS', 8) + pad('GRADIENT', 20) + pad('LAYERS', 7) + 'NOTES');
    note(new Array(96).join('-'));

    var built = 0, threw = 0, warned = 0, thin = [];

    for (var i = 0; i < queue.length; i++) {
        var g = queue[i];
        var col = i % COLS, row = Math.floor(i / COLS);

        var cell = app.project.items.addComp(g.label, BUILD_W, BUILD_H, 1, DUR, FPS);
        cell.parentFolder = folder;
        cell.bgColor = [0, 0, 0];

        var beforeItems = app.project.numItems;
        var status = 'OK';
        var detail = '';
        var madeLayers = 0;

        try {
            var c = [];
            for (var ci = 0; ci < g.colors.length; ci++) c.push(G.hexRgb(g.colors[ci]));

            var ctrl = {};
            var srcCtrl = defaults[g.id] || {};
            for (var k in srcCtrl) {
                if (srcCtrl.hasOwnProperty(k)) ctrl[k] = srcCtrl[k];
            }

            /* The payload the panel would send with every global left alone. */
            var p = {
                type: g.id,
                colors: g.colors,
                controls: ctrl,
                grain: 0,
                glow: 0,
                colorQuality: true,
                posterize: false,
                posterizeFps: 12,
                bpmSync: false
            };

            if (G.LG && G.LG.reset) G.LG.reset();

            var unknown = G.dispatchBuild(cell, g.id, c, ctrl, BUILD_W, BUILD_H, DUR);
            madeLayers = cell.numLayers;

            if (unknown) {
                status = 'SKIP';
                detail = String(unknown);
            } else if (madeLayers === 0) {
                status = 'EMPTY';
                detail = 'builder ran and added no layers';
            } else {
                // The same two steps the panel runs after every build.
                var wrapper = G.groupGeneratedLayers(cell, p, madeLayers);
                G.applyGlobalPolish(cell, p, wrapper);

                built++;
                if (madeLayers === 1) thin.push(g.label);

                if (G.LG && G.LG.count && G.LG.count() > 0) {
                    status = 'WARN';
                    warned++;
                }
                if (G.LG && G.LG.report) {
                    detail = G.LG.report().replace(/^\s*\|\s*/, '');
                }
            }
        } catch (err) {
            status = 'THREW';
            threw++;
            detail = err.toString() + (err.line ? '  (line ' + err.line + ')' : '');
        }

        note(pad('  ' + status, 8) + pad(g.label, 20) + pad(madeLayers, 7) + detail);

        /* Anything a builder left in the project root — Halftone alone makes
           four precomps — gets swept into the folder, or the project is
           unusable by the thirty-first gradient. */
        for (var pi = app.project.numItems; pi > beforeItems; pi--) {
            try {
                var item = app.project.item(pi);
                if (item !== folder && item.parentFolder === app.project.rootFolder) {
                    item.parentFolder = folder;
                }
            } catch (e) { }
        }

        // Place the tile, scaled from delivery size down into its cell.
        var layer = sheet.layers.add(cell);
        try {
            layer.property('Transform').property('Position')
                 .setValue([col * CELL_W + CELL_W / 2, row * CELL_H + CELL_H / 2]);
            layer.property('Transform').property('Scale')
                 .setValue([CELL_W / BUILD_W * 100, CELL_H / BUILD_H * 100]);
        } catch (e) { }

        // Label it, or a sheet of thirty-one tiles is a puzzle.
        var t = sheet.layers.addText(g.label);
        try {
            var doc = t.property('Source Text').value;
            doc.fontSize = 22;
            doc.fillColor = [1, 1, 1];
            doc.applyFill = true;
            doc.applyStroke = true;
            doc.strokeColor = [0, 0, 0];
            doc.strokeWidth = 4;
            doc.strokeOverFill = false;
            t.property('Source Text').setValue(doc);
            t.property('Transform').property('Position')
             .setValue([col * CELL_W + 14, row * CELL_H + 30]);
        } catch (e) { }
    }

    note(new Array(96).join('-'));
    note('built ' + built + '   threw ' + threw + '   warned ' + warned);

    if (thin.length) {
        note('');
        note('Single-layer builds. Worth a hard look — a gradient made of one');
        note('layer is usually a builder that gave up early:');
        note('  ' + thin.join(', '));
    }

    var deadCtl = [];
    for (var ck in defaults) {
        if (!defaults.hasOwnProperty(ck)) continue;
        var live = false;
        for (var li = 0; li < library.length; li++) {
            if (library[li].id === ck) { live = true; break; }
        }
        if (!live) deadCtl.push(ck);
    }
    if (deadCtl.length) {
        note('');
        note('Control blocks in js/controls.js with no gradient in the library.');
        note('Nothing can reach these; they are dead weight:');
        note('  ' + deadCtl.join(', '));
    }

    // ── A still, so it can be sent without recording the screen ──────
    var pngPath = root.fsName + '/tools/contact_sheet.png';
    var pngOk = false;
    try {
        sheet.saveFrameToPng(SAMPLE_TIME, new File(pngPath));
        pngOk = true;
    } catch (e) {
        note('');
        note('Could not write the PNG: ' + e.toString());
        note('Open LG CONTACT SHEET and screenshot it instead.');
    }

    var out = new File(root.fsName + '/tools/contact_sheet_report.txt');
    out.encoding = 'UTF-8';
    out.open('w');
    out.write(log.join('\n'));
    out.close();

    app.endUndoGroup();

    try { sheet.openInViewer(); } catch (e) { }

    alert('Contact sheet done.\n\n' +
          built + ' built, ' + threw + ' threw, ' + warned + ' warned.\n\n' +
          (pngOk ? 'Image:  ' + pngPath + '\n' : 'No image written — screenshot the comp instead.\n') +
          'Report: ' + out.fsName + '\n\n' +
          'Send both. Delete the LG CONTACT SHEET folder when you are done.');

})();
