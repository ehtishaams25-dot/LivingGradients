/* =====================================================================
   LIVING GRADIENTS — FLUID TRAIL LAB
   ---------------------------------------------------------------------
   Run once, on an empty project:  File > Scripts > Run Script File…

   The question this answers: can native After Effects effects be made to
   read as a fluid trail following a moving layer? If yes, the fluid feature
   is a handful of extra layers and a track matte, built once and reused by
   every gradient in the library — no simulation, no baking, no image
   sequences, nothing for the user to manage.

   It builds the same moving emitter eight times, puts a different candidate
   effect stack on each, and tiles them so they can be compared side by side.
   Three stills are written at different times, because a trail is a thing
   that happens over time and a single frame can flatter a stack that is
   actually just a blur.

   THE ARCHITECTURAL POINT THIS TESTS FIRST
   ----------------------------------------
   Effects render BEFORE a layer's own Transform. So Echo applied to a moving
   solid sees that solid at previous times in layer space — where it never
   moved — and produces no trail at all. This is the single fact that decides
   the whole design, and it is exactly the kind of thing this project has
   been burned by assuming.

   Recipes 2, 3 and 4 are the controlled test of it: the same Echo, applied
   directly, applied to an adjustment layer above, and applied to the emitter
   after precomposing. Whichever of those shows a trail is the one the real
   builder has to use.

   Read the picture, not the report. The report only says what applied.
   ===================================================================== */

var LG_FL_ROOT = new File($.fileName).parent.parent;   // …/LivingGradients
var LG_FL_MAIN = new File(LG_FL_ROOT.fsName + '/jsx/main.jsx');

if (LG_FL_MAIN.exists) {
    try {
        $.evalFile(LG_FL_MAIN);          // global scope; see contact_sheet.jsx
    } catch (LG_FL_ERR) {
        alert('jsx/main.jsx did not evaluate:\n' + LG_FL_ERR.toString());
    }
}

(function () {

    var BUILD_W = 1280, BUILD_H = 720;   // every pixel value below derives from these
    var CELL_W  = 480,  CELL_H  = 270;
    var COLS    = 4;
    var DUR     = 6;
    var FPS     = 30;
    var SAMPLES = [1.5, 3.0, 4.5];       // a trail is motion; look at more than one frame

    var G   = $.global;
    var log = [];

    function note(s) { log.push(s); }
    function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }

    if (typeof G.LG === 'undefined' || typeof G.addFx !== 'function') {
        alert('main.jsx loaded but its helpers are missing.');
        return;
    }

    /* ── Which of the candidates this host actually has ───────────────
       Availability first, parameters second. A recipe built on an effect
       that is not installed is not a failed recipe, it is a different
       machine, and the two must not be confused in the report. */
    var CANDIDATES = [
        ['Echo',            ['ADBE Echo', 'Echo']],
        ['CC Mr. Mercury',  ['CC Mr. Mercury']],
        ['CC Blobbylize',   ['CC Blobbylize']],
        ['CC Vector Blur',  ['CC Vector Blur']],
        ['CC Particle World', ['CC Particle World']],
        ['CC Wide Time',    ['CC Wide Time']],
        ['CC Liquify',      ['CC Liquify']],
        ['CC Smear',        ['CC Smear']],
        ['Simple Choker',   ['ADBE Simple Choker', 'Simple Choker']],
        ['Levels',          ['ADBE Easy Levels2', 'Levels']],
        ['Minimax',         ['ADBE Minimax', 'Minimax']],
        ['Roughen Edges',   ['ADBE Roughen Edges', 'Roughen Edges']],
        ['Compound Blur',   ['ADBE Compound Blur', 'Compound Blur']],
        ['Fast Box Blur',   ['ADBE Box Blur2', 'Fast Box Blur']],
        ['Turbulent Displace', ['ADBE Turbulent Displace']]
    ];

    function probeCandidates() {
        var probeComp = app.project.items.addComp('LG_FL_PROBE', 64, 64, 1, 1, 24);
        var temp = probeComp.layers.addSolid([0, 0, 0], 'probe', 64, 64, 1);
        var found = {};

        note('CANDIDATE EFFECTS ON THIS HOST');
        note(new Array(78).join('-'));

        for (var i = 0; i < CANDIDATES.length; i++) {
            var label = CANDIDATES[i][0], names = CANDIDATES[i][1];
            var ef = null, used = null, j;
            for (j = 0; j < names.length; j++) {
                try { ef = temp.Effects.addProperty(names[j]); } catch (x) { ef = null; }
                if (ef) { used = names[j]; break; }
            }
            if (!ef) {
                note(pad('  MISSING', 11) + label);
                continue;
            }
            found[label] = used;
            note(pad('  ok', 11) + pad(label, 22) + used);

            // Full parameter table, so the builder is never written from memory.
            var n = 0;
            try { n = ef.numProperties; } catch (x) { n = 0; }
            for (j = 1; j <= n; j++) {
                var q = null;
                try { q = ef.property(j); } catch (x) { continue; }
                if (!q) continue;
                var kind = '?';
                try {
                    kind = (q.propertyType === PropertyType.PROPERTY)
                         ? ('type ' + q.propertyValueType) : 'group';
                } catch (x) { }
                note('        ' + pad(j, 5) + pad(q.name, 34) + kind);
            }
            try { ef.remove(); } catch (x) { }
        }
        probeComp.remove();
        note('');
        return found;
    }

    /* ── The emitter every recipe shares ──────────────────────────────
       One moving white blob on a curved path. Curved on purpose: a straight
       line makes every trail look the same, and it is the corners that show
       whether a stack is smearing or actually following. */
    function makeEmitter(comp, w, h, dur) {
        var s = comp.layers.addShape();
        s.name = 'Emitter';
        var gc = s.property('Contents')
                  .addProperty('ADBE Vector Group').property('Contents');

        var el = gc.addProperty('ADBE Vector Shape - Ellipse');
        try { el.property('Size').setValue([w * 0.075, w * 0.075]); } catch (e) { }

        var fill = gc.addProperty('ADBE Vector Graphic - Fill');
        try { fill.property('Color').setValue([1, 1, 1]); } catch (e) { }

        try {
            s.property('Transform').property('Position').expression =
                'var t = time * 1.1;\n' +
                'var cx = ' + (w / 2).toFixed(1) + ', cy = ' + (h / 2).toFixed(1) + ';\n' +
                '[cx + Math.sin(t) * ' + (w * 0.32).toFixed(1) + ', ' +
                ' cy + Math.sin(t * 1.63) * ' + (h * 0.30).toFixed(1) + ']';
        } catch (e) { LG.warn('emitter: could not drive position'); }

        return s;
    }

    function setEcho(fx, w) {
        if (!fx) return;
        /* Names first, indices as the fallback they are meant to be. The
           parameter dump above is what confirms these. */
        LG.set(fx, 'Echo Time (seconds)', 1, -0.035);
        LG.set(fx, 'Number Of Echoes',    2, 30);
        LG.set(fx, 'Starting Intensity',  3, 1);
        LG.set(fx, 'Decay',               4, 0.92);
        LG.set(fx, 'Echo Operator',       5, 3);        // Maximum — trails add up
    }

    /* Blur wide, then re-harden the edge. This is what turns a row of
       separate copies into one continuous body that merges and splits, which
       is the read we are after — it is the classic metaball trick and the
       only part of any of this that behaves like a liquid rather than a
       smear. */
    function gooify(layer, w, chokeAmount) {
        var blur = G.addFx(layer, ['ADBE Box Blur2']);
        if (blur) {
            LG.set(blur, 'Blur Radius', 1, w * 0.022);
            LG.set(blur, 'Iterations',  2, 3);
            LG.set(blur, 'Repeat Edge Pixels', 4, true);
        }
        var lev = G.addFx(layer, ['ADBE Easy Levels2']);
        if (lev) {
            LG.set(lev, 'Input Black', 3, 0.32);
            LG.set(lev, 'Input White', 4, 0.46);
        }
        if (chokeAmount) {
            var ch = G.addFx(layer, ['ADBE Simple Choker']);
            if (ch) LG.set(ch, 'Choke Matte', 2, chokeAmount);
        }
    }

    function organic(layer, w, amount) {
        var td = G.addFx(layer, ['ADBE Turbulent Displace']);
        if (td) {
            G.lgTurbSet(td, { mode: 1, amount: amount, size: w * 0.10, speed: 12 });
        }
    }

    function adjustmentAbove(comp, w, h, dur, name) {
        var a = comp.layers.addSolid([1, 1, 1], name, w, h, 1, dur);
        a.adjustmentLayer = true;
        try { a.moveToBeginning(); } catch (e) { }
        return a;
    }

    function precomposeEmitter(comp, name) {
        try {
            comp.layers.precompose([1], name, true);
            return comp.layer(1);
        } catch (e) {
            LG.warn('could not precompose: ' + e.message);
            return comp.layer(1);
        }
    }

    // ── The recipes ──────────────────────────────────────────────────

    var RECIPES = [
        ['1 Emitter only', function (comp, w, h, dur) {
            makeEmitter(comp, w, h, dur);
        }],

        ['2 Echo direct', function (comp, w, h, dur) {
            // Expected to show NO trail. That is the point of including it.
            var e = makeEmitter(comp, w, h, dur);
            setEcho(G.addFx(e, ['ADBE Echo']), w);
        }],

        ['3 Echo adjustment', function (comp, w, h, dur) {
            makeEmitter(comp, w, h, dur);
            var a = adjustmentAbove(comp, w, h, dur, 'Echo Adj');
            setEcho(G.addFx(a, ['ADBE Echo']), w);
        }],

        ['4 Echo precomp', function (comp, w, h, dur) {
            makeEmitter(comp, w, h, dur);
            var p = precomposeEmitter(comp, 'Emitter Precomp 4');
            setEcho(G.addFx(p, ['ADBE Echo']), w);
        }],

        ['5 Goo trail', function (comp, w, h, dur) {
            makeEmitter(comp, w, h, dur);
            var p = precomposeEmitter(comp, 'Emitter Precomp 5');
            setEcho(G.addFx(p, ['ADBE Echo']), w);
            gooify(p, w, 0);
            organic(p, w, w * 0.03);
        }],

        ['6 Goo + choke', function (comp, w, h, dur) {
            makeEmitter(comp, w, h, dur);
            var p = precomposeEmitter(comp, 'Emitter Precomp 6');
            setEcho(G.addFx(p, ['ADBE Echo']), w);
            gooify(p, w, -2);
            organic(p, w, w * 0.05);
        }],

        ['7 Mr. Mercury', function (comp, w, h, dur) {
            var e = makeEmitter(comp, w, h, dur);
            var m = comp.layers.addSolid([0, 0, 0], 'Mercury', w, h, 1, dur);
            var fx = G.addFx(m, ['CC Mr. Mercury']);
            if (fx) {
                /* Its producer follows the emitter, so the two are driven by
                   one motion rather than two that have to agree. */
                LG.expr(fx, 'Producer', 1,
                        'thisComp.layer("Emitter").transform.position');
                LG.set(fx, 'Radius X',       2, w * 0.02);
                LG.set(fx, 'Radius Y',       3, w * 0.02);
                LG.set(fx, 'Birth Rate',     5, 3);
                LG.set(fx, 'Longevity (sec)', 6, 1.6);
                LG.set(fx, 'Gravity',        8, 0.2);
                LG.set(fx, 'Resistance',     9, 3);
                LG.set(fx, 'Blob Influence', 14, 60);
            }
            try { e.enabled = false; } catch (x) { }   // it is the driver, not the picture
        }],

        ['8 Echo + vector blur', function (comp, w, h, dur) {
            makeEmitter(comp, w, h, dur);
            var p = precomposeEmitter(comp, 'Emitter Precomp 8');
            setEcho(G.addFx(p, ['ADBE Echo']), w);
            var vb = G.addFx(p, ['CC Vector Blur']);
            if (vb) {
                LG.set(vb, 'Type',   1, 2);
                LG.set(vb, 'Amount', 2, w * 0.05);
            }
            gooify(p, w, 0);
        }]
    ];

    // ── Build ────────────────────────────────────────────────────────

    app.beginUndoGroup('Living Gradients — Fluid Lab');

    note('Living Gradients — fluid trail lab');
    note('AE ' + app.version + '   ' + new Date().toString());
    note('recipes built at ' + BUILD_W + 'x' + BUILD_H + ', scaled into ' +
         CELL_W + 'x' + CELL_H + ' tiles');
    note('project: ' + app.project.bitsPerChannel + ' bpc');
    note('');

    var folder = app.project.items.addFolder('LG FLUID LAB');
    var found  = probeCandidates();

    var rows   = Math.ceil(RECIPES.length / COLS);
    var sheet  = app.project.items.addComp('LG FLUID LAB', COLS * CELL_W, rows * CELL_H,
                                           1, DUR, FPS);
    sheet.parentFolder = folder;
    sheet.bgColor = [0.05, 0.05, 0.05];

    note('RECIPES');
    note(new Array(78).join('-'));

    for (var i = 0; i < RECIPES.length; i++) {
        var name = RECIPES[i][0], fn = RECIPES[i][1];
        var col = i % COLS, row = Math.floor(i / COLS);

        var cell = app.project.items.addComp(name, BUILD_W, BUILD_H, 1, DUR, FPS);
        cell.parentFolder = folder;
        cell.bgColor = [0, 0, 0];

        var before = app.project.numItems;
        var detail = '';

        LG.reset();
        try {
            fn(cell, BUILD_W, BUILD_H, DUR);
            detail = LG.report().replace(/^\s*\|\s*/, '');
        } catch (err) {
            detail = 'THREW ' + err.toString() + (err.line ? ' (line ' + err.line + ')' : '');
        }

        note('  ' + pad(name, 22) + detail);

        // Sweep any precomps the recipe made into the folder.
        for (var pi = app.project.numItems; pi > before; pi--) {
            try {
                var item = app.project.item(pi);
                if (item !== folder && item.parentFolder === app.project.rootFolder) {
                    item.parentFolder = folder;
                }
            } catch (e) { }
        }

        var layer = sheet.layers.add(cell);
        try {
            layer.property('Transform').property('Position')
                 .setValue([col * CELL_W + CELL_W / 2, row * CELL_H + CELL_H / 2]);
            layer.property('Transform').property('Scale')
                 .setValue([CELL_W / BUILD_W * 100, CELL_H / BUILD_H * 100]);
        } catch (e) { }

        var t = sheet.layers.addText(name);
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

    note(new Array(78).join('-'));
    note('');
    note('WHAT TO LOOK FOR');
    note('  Recipe 2 should show no trail at all. If it does show one, then');
    note('  effects do not render before Transform on this host and the whole');
    note('  precompose step below is unnecessary — say so, it makes the real');
    note('  builder much simpler.');
    note('  Between 3 and 4: whichever trails is the cheaper architecture.');
    note('  Between 5, 6 and 8: which one reads as liquid rather than smear.');
    note('  7 is the only one that is a particle system rather than a trail,');
    note('  so it will look different in kind, not just in degree.');

    // ── Stills, one per sample time ──────────────────────────────────
    var written = [];
    for (var si = 0; si < SAMPLES.length; si++) {
        var pngPath = LG_FL_ROOT.fsName + '/tools/fluid_lab_t' +
                      String(SAMPLES[si]).replace('.', '') + '.png';
        try {
            sheet.saveFrameToPng(SAMPLES[si], new File(pngPath));
            written.push(pngPath);
        } catch (e) {
            note('could not write ' + pngPath + ': ' + e.toString());
        }
    }

    var out = new File(LG_FL_ROOT.fsName + '/tools/fluid_lab_report.txt');
    out.encoding = 'UTF-8';
    out.open('w');
    out.write(log.join('\n'));
    out.close();

    app.endUndoGroup();
    try { sheet.openInViewer(); } catch (e) { }

    alert('Fluid lab done.\n\n' +
          RECIPES.length + ' recipes built.\n\n' +
          (written.length ? written.length + ' stills written to tools/\n' : 'No stills written.\n') +
          'Report: ' + out.fsName + '\n\n' +
          'Send the stills and the report. Scrub the LG FLUID LAB comp too —\n' +
          'a trail is motion and a still can flatter a stack that is just a blur.');

})();
