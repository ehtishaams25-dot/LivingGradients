/* ============================================================
   REACH_CALIBRATE.JSX — how far does a Turbulent Displace actually reach?

   THE QUESTION

   Turbulent Displace moves a pixel by fetching one from somewhere else on the
   layer. Past the layer's own edge there is nothing to fetch, so it fetches
   transparency, and a hole opens in an otherwise opaque surface. Every displaced
   gradient in this panel is therefore built oversized, with the overhang sized
   to the displacement's reach.

   "Amount" is not that reach. It has been assumed to be three times, and three
   times the holes came back — smaller each time, which says the direction was
   right and the magnitude was a guess. jsx/main.jsx now carries
   LG_REACH_PER_AMOUNT, fitted to three rendered observations and padded for
   safety. This script exists to replace that inference with a measurement.

   WHY IT TAKES TWO FILES

   ExtendScript cannot read a pixel. It can render one, and that is the half only
   After Effects can do — so this script renders, and tools/reach_measure.js
   decodes the PNGs in Node and reports the numbers. Run them in that order:

       File > Scripts > Run Script File... > tools/reach_calibrate.jsx
       node tools/reach_measure.js

   HOW THE MEASUREMENT WORKS

   A flat white solid exactly filling a square comp, so every rendered pixel is
   a layer pixel and any transparency in the frame came from a fetch past the
   edge. Sweep Amount, Size and Displacement mode; for each combination render
   three evolutions, because the field moves and the worst frame is the one that
   matters. The measurer then reports, for each cell, how far in from the edge
   transparency reached.

   Flat white rather than a ramp on purpose: a 2000px frame of one colour with
   some holes in it is a few kilobytes of PNG, so the whole sweep costs almost
   nothing on disk.

   The comp is removed afterwards. Nothing is left in the project.
   ============================================================ */

(function () {

    /* Half the layer is the most that can ever be measured — past that the
       tears from opposite edges meet and the answer is "at least this much".
       2000 leaves 1000px of headroom, comfortably past 3.2 x the largest
       Amount swept below. */
    var SIZE_PX = 2000;

    var EVOLUTIONS = [0, 90, 180];

    /* Pass A: does reach scale with Amount, and by how much? Size held at the
       620 the flow metals use. */
    var AMOUNTS_A = [25, 50, 100, 150, 200, 300];
    var SIZE_A    = 620;

    /* Pass B: does Size matter as well? Amount held. If reach were proportional
       to Amount x Size, the 1000 row would tear ten times as far as the 100
       row, and it is that ratio the budget in main.jsx is betting against. */
    var AMOUNT_B = 150;
    var SIZES_B  = [100, 300, 620, 1000];

    /* Pass C: Twist Smoother, which is what Metal Twist runs. A rotational
       displacement may not reach like a translational one. */
    var MODE_TWIST = 6, MODE_SMOOTH = 4;
    var AMOUNTS_C  = [50, 150, 300];

    var here = File($.fileName).parent;
    var outDir = new Folder(here.fsName + '/reach');
    if (!outDir.exists) outDir.create();

    var cells = [];        // {file, amount, size, mode, evolution}
    var comp = null;
    var failed = null;

    app.beginUndoGroup('Reach calibration');
    try {
        comp = app.project.items.addComp('LG_REACH_PROBE', SIZE_PX, SIZE_PX, 1, 1, 24);
        var solid = comp.layers.addSolid([1, 1, 1], 'Probe', SIZE_PX, SIZE_PX, 1);

        var td = null;
        try { td = solid.Effects.addProperty('ADBE Turbulent Displace'); } catch (e) { td = null; }
        if (!td) throw new Error('Turbulent Displace is not available on this host.');

        /* Everything except Amount, Size, mode and Evolution is pinned, so the
           only things varying across the sweep are the things being measured.
           Complexity 1 and Pinning at its default are what lgTurbSet sets. */
        set(td, 'Complexity', 5, 1);
        set(td, 'Pinning', 12, 1);
        set(td, 'Resize Layer', 13, false);

        var jobs = [];
        var i, j, k;
        for (i = 0; i < AMOUNTS_A.length; i++) {
            jobs.push({ amount: AMOUNTS_A[i], size: SIZE_A, mode: MODE_SMOOTH, pass: 'A' });
        }
        for (i = 0; i < SIZES_B.length; i++) {
            jobs.push({ amount: AMOUNT_B, size: SIZES_B[i], mode: MODE_SMOOTH, pass: 'B' });
        }
        for (i = 0; i < AMOUNTS_C.length; i++) {
            jobs.push({ amount: AMOUNTS_C[i], size: SIZE_A, mode: MODE_TWIST, pass: 'C' });
        }

        for (j = 0; j < jobs.length; j++) {
            var job = jobs[j];
            set(td, 'Displacement', 1, job.mode);
            set(td, 'Amount', 2, job.amount);
            set(td, 'Size', 3, job.size);

            for (k = 0; k < EVOLUTIONS.length; k++) {
                set(td, 'Evolution', 6, EVOLUTIONS[k]);

                var name = 'm' + job.mode + '_a' + pad(job.amount) + '_s' + pad(job.size) +
                           '_e' + pad(EVOLUTIONS[k]) + '.png';
                var file = new File(outDir.fsName + '/' + name);
                comp.saveFrameToPng(0, file);

                cells.push({
                    file: name, pass: job.pass, mode: job.mode,
                    amount: job.amount, size: job.size, evolution: EVOLUTIONS[k]
                });
            }
        }
    } catch (err) {
        failed = err.toString();
    } finally {
        /* The probe comp is scaffolding. Leaving a 2000px comp called
           LG_REACH_PROBE in someone's project is the kind of thing a
           diagnostic tool should never do. */
        if (comp) { try { comp.remove(); } catch (e) { } }
        app.endUndoGroup();
    }

    /* The manifest is what tools/reach_measure.js reads: it needs the layer
       size to know where the edges are, and the parameters to label the
       result. Written even on failure, so a partial sweep is still measurable. */
    var manifest = {
        layer: SIZE_PX,
        comp: SIZE_PX,
        ae: (app.version || '?'),
        when: new Date().toString(),
        cells: cells
    };
    var mf = new File(outDir.fsName + '/manifest.json');
    mf.encoding = 'UTF-8';
    mf.open('w');
    mf.write(stringify(manifest));
    mf.close();

    var msg = cells.length + ' frames written to:\n' + outDir.fsName + '\n\n' +
              'Now run, from the repo root:\n\n    node tools/reach_measure.js\n\n' +
              'It reads manifest.json, decodes each frame and reports how far\n' +
              'in from the edge transparency reached.';
    if (failed) msg = 'Stopped early: ' + failed + '\n\n' + msg;
    alert(msg);

    /* ── helpers ───────────────────────────────────────────────────── */

    /* Name first, index as the fallback — the same order LG.set uses in
       jsx/main.jsx, and for the same reason: an index that is wrong sets a
       different parameter instead of failing. */
    function set(fx, name, idx, value) {
        try { fx.property(name).setValue(value); return true; } catch (e) { }
        try { fx.property(idx).setValue(value); return true; } catch (e) { }
        return false;
    }

    function pad(n) {
        var s = String(Math.round(n));
        while (s.length < 4) s = '0' + s;
        return s;
    }

    /* ExtendScript's JSON is not guaranteed on every host this panel supports,
       and the manifest is a fixed shape, so it is written by hand. */
    function stringify(m) {
        var out = '{\n  "layer": ' + m.layer + ',\n  "comp": ' + m.comp +
                  ',\n  "ae": "' + m.ae + '",\n  "when": "' + m.when +
                  '",\n  "cells": [\n';
        for (var i = 0; i < m.cells.length; i++) {
            var c = m.cells[i];
            out += '    {"file": "' + c.file + '", "pass": "' + c.pass +
                   '", "mode": ' + c.mode + ', "amount": ' + c.amount +
                   ', "size": ' + c.size + ', "evolution": ' + c.evolution + '}';
            out += (i < m.cells.length - 1) ? ',\n' : '\n';
        }
        return out + '  ]\n}\n';
    }

})();
