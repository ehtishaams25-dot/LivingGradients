/* =====================================================================
   LIVING GRADIENTS — LUMINOUS LAB
   ---------------------------------------------------------------------
   Run on the working project:  File > Scripts > Run Script File…

   WHY THIS EXISTS

   The Grainient-style compositions were built once as live bridge calls —
   dozens of small scripts, with the builder functions living only in the
   ExtendScript session. After Effects then quit, and every one of them
   went with it: six compositions, nine glass variants, the lot. Nothing
   had ever been written down.

   So this file is the rule the rest of tools/ already follows and that
   round ignored: a composition that is worth looking at is worth being a
   script on disk. A crash should cost a re-run, not the work.

   WHAT IT MAKES

   Six compositions in GRADIENT_PLUGIN_DEV, all prefixed GPDEV_Cm_, plus a
   contact sheet. They are deliberately six different CONSTRUCTIONS rather
   than one construction in six palettes — a closed curve, a polar fan, a
   rotation field, a warped strand field, a horizon line, and a threshold
   filament field. The first attempt at this family was six recolours of a
   single blurred lobe, which is exactly what it looked like.

   THE ONE RULE THEY ALL OBEY

   Most of the frame stays near black.

   That is the whole character of the reference set: light lives in one
   region and the rest is ground. Every version of this that failed failed
   by filling the frame corner to corner. If you change these numbers,
   change them in the direction of less light, not more.

   MEASURED VALUES — do not "tidy" these
     Fractal Type 2, 6 and 10 render PURE BLACK on AE 26.0x67. Type 1 is
     the safe one. See the table in lgFractalSet in jsx/main.jsx.
     Polar Coordinates, Type of Conversion: 1 = Rect to Polar (the ray
     fan), 2 = Polar to Rect (arches). Swept 2026-09-05.
     Polar Coordinates, Interpolation: range is 0-1, NOT 0-100. Writing
     100 throws "value out of range".
     Levels (ADBE Easy Levels2) is likewise 0-1, not 0-255.
   ===================================================================== */

var LG_LL_ROOT = new File($.fileName).parent.parent;   // …/LivingGradients
var LG_LL_MAIN = new File(LG_LL_ROOT.fsName + '/jsx/main.jsx');

if (LG_LL_MAIN.exists) {
    try {
        $.evalFile(LG_LL_MAIN);
    } catch (LG_LL_ERR) {
        alert('jsx/main.jsx did not evaluate:\n' + LG_LL_ERR.toString());
    }
} else {
    alert('Could not find jsx/main.jsx next to tools/. Expected:\n' + LG_LL_MAIN.fsName);
}

(function luminousLab() {

    var W = 1920, H = 1080, DUR = 8, FPS = 30;
    var GROUND = [0.012, 0.012, 0.018];      // the near-black everything sits on

    /* ── plumbing ──────────────────────────────────────────────────── */

    function devFolder() {
        var i, it;
        for (i = 1; i <= app.project.numItems; i++) {
            it = app.project.item(i);
            if (it instanceof FolderItem && it.name === 'GRADIENT_PLUGIN_DEV') return it;
        }
        return app.project.items.addFolder('GRADIENT_PLUGIN_DEV');
    }

    function killComp(name) {
        var j, x;
        for (j = app.project.numItems; j >= 1; j--) {
            x = app.project.item(j);
            if (x instanceof CompItem && x.name === name) x.remove();
        }
    }

    function findComp(name) {
        var i, it;
        for (i = 1; i <= app.project.numItems; i++) {
            it = app.project.item(i);
            if (it instanceof CompItem && it.name === name) return it;
        }
        return null;
    }

    function newComp(id) {
        var name = 'GPDEV_Cm_' + id;
        killComp(name);
        var c = app.project.items.addComp(name, W, H, 1, DUR, FPS);
        c.parentFolder = devFolder();
        c.bgColor = [0, 0, 0];
        c.layers.addSolid(GROUND, 'ground', W, H, 1, DUR);
        return c;
    }

    /* Glow, with the two colour stops wired when a tint is wanted. Glow
       Colors option 2 is "A & B Colors" — see the note in tuneSilkFlare. */
    function glow(layer, threshold, radius, intensity, colA, colB) {
        var g = addFx(layer, ['ADBE Glo2']);
        if (!g) return null;
        LG.set(g, 'Glow Threshold', 2, threshold);
        LG.set(g, 'Glow Radius',    3, radius);
        LG.set(g, 'Glow Intensity', 4, intensity);
        if (colA) {
            LG.set(g, 'Glow Colors', 7, 2);
            LG.set(g, 'Color A', 12, colA);
            LG.set(g, 'Color B', 13, colB || colA);
        }
        return g;
    }

    function screenMode(layer) {
        try { layer.blendingMode = BlendingMode.SCREEN; } catch (e) { }
    }

    /* The house finish: soft focus, then monochrome grain, in that order.
       Grain belongs to the photograph, so it goes last — over everything,
       including the softening. */
    function finish(c, softenRadius, grainAmount) {
        var sf = c.layers.addSolid([1, 1, 1], 'soften', W, H, 1, DUR);
        sf.adjustmentLayer = true;
        var b = addFx(sf, ['ADBE Box Blur2']);
        LG.set(b, 'Blur Radius', 1, softenRadius);
        LG.set(b, 'Iterations',  2, 3);
        LG.set(b, 'Repeat Edge Pixels', 4, true);

        var gr = c.layers.addSolid([1, 1, 1], 'grain', W, H, 1, DUR);
        gr.adjustmentLayer = true;
        var nz = addFx(gr, ['ADBE Noise']);
        LG.set(nz, 'Amount of Noise', 1, grainAmount);
        LG.set(nz, 'Noise Type', 2, false);      // monochrome, always
        LG.set(nz, 'Clipping',   3, true);
    }

    /* ── A  ORBIT ──────────────────────────────────────────────────────
       A closed curve. Nothing else in the library is one, which is why it
       reads as a different object rather than a recolour. Stroke only, no
       fill, blurred until the stroke stops being a line and becomes light.
       Two rings: a wide soft halo and a tight hot core. */
    function buildOrbit() {
        var c = newComp('A');

        var halo = c.layers.addShape();
        halo.name = 'ring halo';
        var g1 = halo.property('Contents').addProperty('ADBE Vector Group');
        g1.property('Contents').addProperty('ADBE Vector Shape - Ellipse')
          .property('Size').setValue([760, 760]);
        var s1 = g1.property('Contents').addProperty('ADBE Vector Graphic - Stroke');
        s1.property('Color').setValue([0.45, 0.35, 1.0]);
        s1.property('Stroke Width').setValue(26);
        halo.property('Transform').property('Position').setValue([W / 2, H / 2]);
        halo.property('Transform').property('Scale').expression =
            'var s = 100 + Math.sin(time * 0.35 * Math.PI * 2) * 7; [s, s * 0.92]';
        lgBlur(halo, 30);
        screenMode(halo);
        glow(halo, 26, 150, 2.1, [0.55, 0.30, 1, 1], [0.30, 0.75, 1, 1]);

        var core = c.layers.addShape();
        core.name = 'ring core';
        var g2 = core.property('Contents').addProperty('ADBE Vector Group');
        g2.property('Contents').addProperty('ADBE Vector Shape - Ellipse')
          .property('Size').setValue([700, 700]);
        var s2 = g2.property('Contents').addProperty('ADBE Vector Graphic - Stroke');
        s2.property('Color').setValue([0.85, 0.80, 1.0]);
        s2.property('Stroke Width').setValue(5);
        core.property('Transform').property('Position').setValue([W / 2, H / 2]);
        lgBlur(core, 7);
        screenMode(core);

        finish(c, 14, 9);
        return c;
    }

    /* ── B  RAYS ───────────────────────────────────────────────────────
       Vertical stripes bent into a circle. Rect-to-Polar is the only thing
       that turns a stripe field into a fan of beams; you cannot get here by
       blurring a blob.

       FIXED FROM THE FIRST ATTEMPT. Conversion was set to 2, which is
       Polar-to-Rect, so it rendered the raw stripes as arches. And the
       whole frame was tinted bright, which threw away the dark ground. Now
       the noise sits mostly BELOW the glow threshold, so only the peaks
       light up and the rest stays ground. */
    function buildRays() {
        var c = newComp('B');
        var r = c.layers.addSolid([0, 0, 0], 'rays', 1920, 1920, 1, DUR);
        r.property('Transform').property('Position').setValue([W / 2, H / 2]);

        lgFractalSet(addFx(r, ['ADBE Fractal Noise']), {
            fractalType: 1,
            contrast:    300,
            brightness: -78,          // most of the field below the threshold
            overflow:    1,
            complexity:  3,
            scaleWidth:  8,
            scaleHeight: 4000,
            speed:       12
        });
        var pc = addFx(r, ['ADBE Polar Coordinates']);
        LG.set(pc, 'Interpolation',      1, 1);   // 0-1, not 0-100
        LG.set(pc, 'Type of Conversion', 2, 1);   // 1 = Rect to Polar
        lgBlur(r, 10);
        screenMode(r);
        glow(r, 34, 130, 1.6, [1, 0.66, 0.28, 1], [1, 0.30, 0.42, 1]);

        finish(c, 18, 10);
        return c;
    }

    /* ── C  VORTEX ─────────────────────────────────────────────────────
       A mass wound around a centre by Twirl. The spiral cannot come from a
       blur; it needs the rotation field.

       FIXED FROM THE FIRST ATTEMPT. It was a full-frame 4-colour gradient,
       so it filled the frame with saturated colour and lost the ground
       entirely — the single mistake this whole family keeps making. Now the
       colour is a BOUNDED lobe screened over black, and the twirl acts on
       that. */
    function buildVortex() {
        var c = newComp('C');

        var mass = c.layers.addShape();
        mass.name = 'mass';
        var g = mass.property('Contents').addProperty('ADBE Vector Group');
        g.property('Contents').addProperty('ADBE Vector Shape - Ellipse')
         .property('Size').setValue([1500, 900]);
        g.property('Contents').addProperty('ADBE Vector Graphic - Fill')
         .property('Color').setValue([0.85, 0.12, 0.60]);
        mass.property('Transform').property('Position').setValue([880, 560]);
        mass.property('Transform').property('Opacity').setValue(80);
        screenMode(mass);
        lgBlur(mass, 120);

        var second = c.layers.addShape();
        second.name = 'mass2';
        var g2 = second.property('Contents').addProperty('ADBE Vector Group');
        g2.property('Contents').addProperty('ADBE Vector Shape - Ellipse')
          .property('Size').setValue([1000, 700]);
        g2.property('Contents').addProperty('ADBE Vector Graphic - Fill')
          .property('Color').setValue([0.10, 0.55, 0.95]);
        second.property('Transform').property('Position').setValue([1180, 640]);
        second.property('Transform').property('Opacity').setValue(70);
        screenMode(second);
        lgBlur(second, 110);

        /* A TWIRL NEEDS SOMETHING TO WIND.

           Second pass. The first version twirled the two soft lobes and
           nothing happened, because a smooth field rotated is still the
           same smooth field — there is no detail for the rotation to carry
           round. It is the same mistake as blurring a smooth gradient and
           wondering why nine blurs looked identical.

           So: ridges first, screened over the lobes, and the twirl winds
           THOSE into a spiral. The strands are what you actually see
           turning. */
        var ridge = c.layers.addSolid([0, 0, 0], 'ridges', W, H, 1, DUR);
        lgFractalSet(addFx(ridge, ['ADBE Fractal Noise']), {
            fractalType: 1, contrast: 210, brightness: -58, overflow: 1,
            complexity: 5, scaleWidth: 24, scaleHeight: 1500, speed: 7
        });
        screenMode(ridge);
        ridge.property('Transform').property('Opacity').setValue(62);
        lgBlur(ridge, 6);

        /* Twirl on an adjustment layer so it winds the lobes AND the ridges
           together and they shear into each other, instead of each
           spinning alone. Radius is a percentage of the frame, so it has to
           be large enough to reach the colour. */
        var tw = c.layers.addSolid([1, 1, 1], 'twirl', W, H, 1, DUR);
        tw.adjustmentLayer = true;
        var t = addFx(tw, ['ADBE Twirl']);
        LG.set(t, 'Twirl Radius', 2, 95);
        LG.set(t, 'Twirl Center', 3, [980, 520]);
        t.property('Angle').expression = 'time * 14';

        finish(c, 18, 9);
        return c;
    }

    /* ── D  CURTAIN ────────────────────────────────────────────────────
       Aurora. Vertical strands bent side to side, hanging in the frame
       rather than filling it.

       FIXED FROM THE FIRST ATTEMPT. Wave Height 120 over Wave Width 420 is
       a bend so coarse relative to the strand spacing that the strands
       broke into repeating blobs. A curtain wants a LONG, shallow wave —
       tall wavelength, small amplitude — and a much softer top/bottom
       fade so it does not end in a hard line. */
    function buildCurtain() {
        var c = newComp('D');
        var cu = c.layers.addSolid([0, 0, 0], 'curtain', W, H, 1, DUR);

        lgFractalSet(addFx(cu, ['ADBE Fractal Noise']), {
            fractalType: 1,
            contrast:    170,
            brightness: -44,
            overflow:    1,
            complexity:  5,
            scaleWidth:  18,          // finer strands than before
            scaleHeight: 1800,
            speed:       9
        });
        var ww = addFx(cu, ['ADBE Wave Warp']);
        LG.set(ww, 'Wave Type',  1, 1);
        LG.set(ww, 'Wave Height', 2, 38);     // was 120 — far too deep
        LG.set(ww, 'Wave Width',  3, 1100);   // was 420 — far too tight
        LG.set(ww, 'Direction',   4, 90);
        LG.set(ww, 'Wave Speed',  5, 0.25);
        LG.set(ww, 'Pinning',     6, 11);     // Pin All — see the dropdown note
        var tn = addFx(cu, ['ADBE Tint']);
        LG.set(tn, 'Map Black To', 1, [0, 0, 0, 1]);
        LG.set(tn, 'Map White To', 2, [0.25, 1.0, 0.62, 1]);
        lgBlur(cu, 14);
        screenMode(cu);

        var mk = cu.property('Masks').addProperty('Mask');
        var sp = new Shape();
        sp.closed = true;
        sp.vertices = [[-300, 300], [W + 300, 240], [W + 300, 760], [-300, 820]];
        mk.property('maskShape').setValue(sp);
        mk.maskFeather.setValue([340, 340]);   // was 260 — still ended too hard

        glow(cu, 46, 120, 1.4, [0.30, 1, 0.70, 1], [0.20, 0.60, 1, 1]);
        finish(c, 16, 10);
        return c;
    }

    /* ── E  HORIZON ────────────────────────────────────────────────────
       The only one built on a straight line: a bright band low in frame,
       bloomed upward, reading as atmosphere rather than as an object. This
       one worked first time — the two hues meeting at the band are what
       give it depth, and that is the trick the others were missing. */
    function buildHorizon() {
        var c = newComp('E');

        var sky = c.layers.addSolid([0, 0, 0], 'sky', W, H, 1, DUR);
        var rp = addFx(sky, ['ADBE Ramp']);
        LG.set(rp, 'Start of Ramp', 1, [W / 2, 300]);
        LG.set(rp, 'Start Color',   2, [0.06, 0.03, 0.16, 1]);
        LG.set(rp, 'End of Ramp',   3, [W / 2, 760]);
        LG.set(rp, 'End Color',     4, [1.0, 0.42, 0.12, 1]);

        var band = c.layers.addSolid([1, 0.72, 0.35], 'band', W, 90, 1, DUR);
        band.property('Transform').property('Position').expression =
            '[' + (W / 2) + ', 700 + Math.sin(time * 0.18 * Math.PI * 2) * 22]';
        screenMode(band);
        lgBlur(band, 80);
        glow(band, 20, 200, 2.4, [1, 0.75, 0.35, 1], [1, 0.25, 0.35, 1]);

        /* Haze, so the sky is not a clean ramp. Wide and short, which is
           what stops it reading as a gradient swatch. */
        var hz = c.layers.addSolid([0, 0, 0], 'haze', W, H, 1, DUR);
        lgFractalSet(addFx(hz, ['ADBE Fractal Noise']), {
            fractalType: 1, contrast: 120, brightness: -30, overflow: 1,
            complexity: 3, scaleWidth: 900, scaleHeight: 180, speed: 5
        });
        screenMode(hz);
        hz.property('Transform').property('Opacity').setValue(28);
        lgBlur(hz, 40);

        finish(c, 18, 11);
        return c;
    }

    /* ── F  WISPS ──────────────────────────────────────────────────────
       Filaments, not a mass. Most of the frame stays empty.

       TUNED TWICE, AND THE SECOND TRY OVERSHOT.

         contrast 340 / brightness -88  -> isolated specks. The smear had
                                          nothing continuous to pull, so it
                                          read as scattered blobs.
         contrast 195 / brightness -40  -> the opposite failure: so much of
                                          the field survived that the glow
                                          blew it into one white mass and
                                          the dark ground was gone.

       The floor is what matters here, not the contrast. Brightness sets
       how much of the field clears zero and therefore how much material
       exists to be smeared; the glow then multiplies whatever is left.
       -66 leaves connected threads without leaving a sheet, and the glow
       intensity comes down because it was doing too much of the work. */
    function buildWisps() {
        var c = newComp('F');
        var w = c.layers.addSolid([0, 0, 0], 'wisp', W, H, 1, DUR);

        lgFractalSet(addFx(w, ['ADBE Fractal Noise']), {
            fractalType: 1,
            contrast:    230,
            brightness: -66,
            overflow:    1,
            complexity:  6,
            scale:       300,
            speed:       8
        });
        var db = addFx(w, ['ADBE Motion Blur']);
        LG.set(db, 'Direction',   1, 68);
        LG.set(db, 'Blur Length', 2, 240);
        var tn = addFx(w, ['ADBE Tint']);
        LG.set(tn, 'Map Black To', 1, [0, 0, 0, 1]);
        LG.set(tn, 'Map White To', 2, [0.62, 0.80, 1.0, 1]);
        screenMode(w);
        w.property('Transform').property('Opacity').setValue(80);
        lgBlur(w, 8);
        glow(w, 52, 110, 0.9, [0.55, 0.75, 1, 1], [0.85, 0.55, 1, 1]);

        finish(c, 12, 10);
        return c;
    }

    /* ── the sheet ─────────────────────────────────────────────────────
       Each composition is built at full 1920x1080 and only scaled down for
       the sheet, never built small. Builders carry absolute pixel values —
       noise scale, blur radius, stroke width — so a tile built at tile size
       is a different picture, not a smaller one. */
    function buildSheet(ids, labels) {
        var TW = 800, TH = 450, COLS = 3;
        var rows = Math.ceil(ids.length / COLS);
        killComp('GPDEV_LumSheet');
        var sheet = app.project.items.addComp('GPDEV_LumSheet',
                        TW * COLS, TH * rows, 1, DUR, FPS);
        sheet.parentFolder = devFolder();
        sheet.bgColor = [0, 0, 0];

        var n, src, col, row, L, t, td;
        for (n = ids.length - 1; n >= 0; n--) {
            src = findComp('GPDEV_Cm_' + ids[n]);
            if (!src) continue;
            col = n % COLS;
            row = Math.floor(n / COLS);
            L = sheet.layers.add(src);
            L.name = ids[n];
            L.property('Transform').property('Scale').setValue([TW / W * 100, TW / W * 100]);
            L.property('Transform').property('Position').setValue(
                [col * TW + TW / 2, row * TH + TH / 2]);

            t = sheet.layers.addText(labels[n]);
            td = t.property('Source Text').value;
            td.fontSize = 26;
            td.fillColor = [1, 1, 1];
            td.applyFill = true;
            td.applyStroke = true;
            td.strokeColor = [0, 0, 0];
            td.strokeWidth = 4;
            td.strokeOverFill = false;
            t.property('Source Text').setValue(td);
            t.property('Transform').property('Position').setValue(
                [col * TW + 20, row * TH + 36]);
        }
        return sheet;
    }

    /* ── run ───────────────────────────────────────────────────────── */

    app.beginUndoGroup('Luminous Lab');
    try {
        if (LG && LG.reset) LG.reset();

        buildOrbit();
        buildRays();
        buildVortex();
        buildCurtain();
        buildHorizon();
        buildWisps();

        buildSheet(['A', 'B', 'C', 'D', 'E', 'F'],
                   ['A  ORBIT', 'B  RAYS', 'C  VORTEX',
                    'D  CURTAIN', 'E  HORIZON', 'F  WISPS']);

        var warn = (LG && LG.warnings) ? LG.warnings() : [];
        if (warn && warn.length) {
            $.writeln('luminous_lab warnings:\n  ' + warn.join('\n  '));
        }
    } catch (e) {
        alert('luminous_lab failed: ' + e.toString() + ' @line ' + e.line);
    }
    app.endUndoGroup();

})();
