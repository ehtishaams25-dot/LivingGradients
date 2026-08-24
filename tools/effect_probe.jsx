/* =====================================================================
   LIVING GRADIENTS — EFFECT PROBE
   ---------------------------------------------------------------------
   Run once: File > Scripts > Run Script File… > this file.

   The panel sets dropdown parameters by number, because scripting has no
   way to ask an effect what its options are called. Those numbers have
   been guesses, and a wrong one does not fail — it silently picks a
   different option, which is how Metallic ended up a flat yellow frame
   and Sunburst ended up as diagonal stripes.

   This resolves them. It produces two things:

     1. tools/effect_probe_report.txt — every property of every effect the
        panel touches: index, display name, matchName, value type, and for
        the numeric ones the value the parameter clamps to. A parameter
        that clamps at a small number is a dropdown, and that number is how
        many options it has.

     2. A set of "LG PROBE" comps in the project, one per dropdown that
        matters, laid out as a labelled grid — every option rendered side
        by side with its number on it. Screenshot those and every guess in
        the codebase becomes a fact.

   Nothing here touches your comps. Everything it makes lives in an
   "LG PROBE" folder and can be deleted in one go afterwards.
   ===================================================================== */

(function () {

    var EFFECTS = [
        ['Fractal Noise',       'ADBE Fractal Noise'],
        ['Turbulent Displace',  'ADBE Turbulent Displace'],
        ['CC Toner',            'CC Toner'],
        ['Cell Pattern',        'ADBE Cell Pattern'],
        ['Gradient Ramp',       'ADBE Ramp'],
        ['Motion Tile',         'ADBE Tile'],
        ['Fast Box Blur',       'ADBE Box Blur2'],
        ['Glow',                'ADBE Glo2'],
        ['Extract',             'ADBE Extract'],
        ['Displacement Map',    'ADBE Displacement Map'],
        ['CC RepeTile',         'CC RepeTile'],
        ['Polar Coordinates',   'ADBE Polar Coordinates'],
        ['Venetian Blinds',     'ADBE Venetian Blinds'],
        ['Posterize Time',      'ADBE Posterize Time'],
        ['4-Color Gradient',    'ADBE 4ColorGradient'],
        ['Levels',              'ADBE Easy Levels2'],
        ['Noise',               'ADBE Noise'],
        ['Tint',                'ADBE Tint'],
        /* The shaders. CC Glass drives every metal and the frosted glass
           now, and it was the one effect in the whole stack whose indices
           had never been dumped — they were reasoned from CC Blobbylize's,
           which is the same parameter block in the same order. Both are
           here so that assumption is either confirmed or killed. */
        ['CC Glass',            'CC Glass'],
        ['CC Blobbylize',       'CC Blobbylize'],
        ['CC Mr. Mercury',      'CC Mr. Mercury']
    ];

    /* Grids to render. Each is [comp name, matchName, property, option count,
       a setup function that makes the differences visible]. The option counts
       are deliberately generous — an option past the end renders the same as
       the last real one, which is itself the answer. */
    var GRIDS = [
        ['LG PROBE 1 - Fractal Type',   'ADBE Fractal Noise',      'Fractal Type', 16, setupFractal],
        ['LG PROBE 2 - Overflow',       'ADBE Fractal Noise',      'Overflow',      5, setupOverflow],
        ['LG PROBE 3 - Noise Type',     'ADBE Fractal Noise',      'Noise Type',    5, setupFractal],
        ['LG PROBE 4 - Toner Tones',    'CC Toner',                'Tones',         5, setupToner],
        ['LG PROBE 5 - Cell Pattern',   'ADBE Cell Pattern',       'Cell Pattern', 14, setupCell],
        ['LG PROBE 6 - Displacement',   'ADBE Turbulent Displace', 'Displacement', 10, setupTurb],
        ['LG PROBE 7 - Ramp Shape',     'ADBE Ramp',               'Ramp Shape',    3, setupRamp],
        ['LG PROBE 8 - Blur Dimensions','ADBE Box Blur2',          'Blur Dimensions', 4, setupBlurDims]
    ];

    var TILE_W = 300, TILE_H = 170, GAP = 8, COLS = 4, FPS = 24, DUR = 4;

    var folder = null, lines = [], probeComp = null, probeSolid = null;

    // ── helpers ──────────────────────────────────────────────────────

    function pad(s, n) {
        s = String(s);
        while (s.length < n) s += ' ';
        return s;
    }

    function typeName(prop) {
        try {
            switch (prop.propertyValueType) {
                case PropertyValueType.NO_VALUE:        return 'group/none';
                case PropertyValueType.OneD:            return '1D';
                case PropertyValueType.TwoD:            return '2D';
                case PropertyValueType.TwoD_SPATIAL:    return '2D spatial';
                case PropertyValueType.ThreeD:          return '3D';
                case PropertyValueType.ThreeD_SPATIAL:  return '3D spatial';
                case PropertyValueType.COLOR:           return 'colour';
                case PropertyValueType.CUSTOM_VALUE:    return 'custom';
                case PropertyValueType.MARKER:          return 'marker';
                case PropertyValueType.LAYER_INDEX:     return 'layer';
                case PropertyValueType.MASK_INDEX:      return 'mask';
                case PropertyValueType.SHAPE:           return 'shape';
                case PropertyValueType.TEXT_DOCUMENT:   return 'text';
            }
        } catch (e) { }
        return '?';
    }

    /* Push values into a 1D parameter until it stops accepting them. A
       dropdown clamps at its option count; a slider clamps at its maximum.
       A small number here means "dropdown, and this is how many options". */
    function clampCeiling(prop) {
        var original, i, probe = 0;
        try { original = prop.value; } catch (e) { return null; }
        if (prop.numKeys > 0) return null;
        try { if (prop.expression) return null; } catch (e) { }

        for (i = 1; i <= 64; i++) {
            try { prop.setValue(i); } catch (e) { break; }
            var got = null;
            try { got = prop.value; } catch (e) { break; }
            if (got !== i) break;
            probe = i;
        }
        try { prop.setValue(original); } catch (e) { }
        return probe;
    }

    function dumpEffect(label, matchName) {
        var fx = null;
        try { fx = probeSolid.Effects.addProperty(matchName); } catch (e) { fx = null; }

        if (!fx) {
            lines.push('');
            lines.push('### ' + label + '  {' + matchName + '}   NOT AVAILABLE ON THIS MACHINE');
            return;
        }

        lines.push('');
        lines.push('### ' + label + '  {' + fx.matchName + '}');
        lines.push('    idx  ' + pad('name', 34) + pad('matchName', 34) + pad('type', 13) + 'clamps at');
        lines.push('    ' + new Array(100).join('-'));

        var i, prop, ceiling, note;
        for (i = 1; i <= fx.numProperties; i++) {
            prop = null;
            try { prop = fx.property(i); } catch (e) { continue; }
            if (!prop) continue;

            ceiling = '';
            try {
                if (prop.propertyValueType === PropertyValueType.OneD) {
                    var c = clampCeiling(prop);
                    if (c !== null && c > 0) {
                        ceiling = String(c);
                        if (c <= 24) ceiling += '   <-- dropdown, ' + c + ' options';
                    }
                }
            } catch (e) { }

            lines.push('    ' + pad(i, 5) +
                       pad(prop.name, 34) +
                       pad(prop.matchName, 34) +
                       pad(typeName(prop), 13) +
                       ceiling);

            // One level into groups — Fractal Noise hides Scale Width in there.
            if (prop.propertyValueType === PropertyValueType.NO_VALUE) {
                var j, sub;
                for (j = 1; j <= prop.numProperties; j++) {
                    sub = null;
                    try { sub = prop.property(j); } catch (e) { continue; }
                    if (!sub) continue;
                    lines.push('      ' + pad(i + '.' + j, 5) +
                               pad('  ' + sub.name, 32) +
                               pad(sub.matchName, 34) +
                               pad(typeName(sub), 13));
                }
            }
        }

        try { fx.remove(); } catch (e) { }
    }

    // ── grid setups ──────────────────────────────────────────────────
    // Each one dials the effect so that changing the probed dropdown
    // produces an obviously different picture.

    function setupFractal(fx) {
        try { fx.property('Contrast').setValue(180); } catch (e) { }
        try { fx.property('Transform').property('Scale').setValue(120); } catch (e) { }
    }

    function setupOverflow(fx) {
        // High contrast is what makes the four overflow modes diverge: this is
        // exactly the setting that produced the flat frame.
        try { fx.property('Contrast').setValue(420); } catch (e) { }
        try { fx.property('Transform').property('Scale').setValue(150); } catch (e) { }
    }

    function setupToner(fx) {
        try { fx.property('Highlights').setValue([1, 1, 1]); } catch (e) { }
        try { fx.property('Brights').setValue([1, 0.2, 0]); } catch (e) { }
        try { fx.property('Midtones').setValue([0, 0.9, 0.4]); } catch (e) { }
        try { fx.property('Darktones').setValue([0.2, 0.2, 1]); } catch (e) { }
        try { fx.property('Shadows').setValue([0, 0, 0]); } catch (e) { }
    }

    function setupCell(fx) {
        try { fx.property('Size').setValue(60); } catch (e) { }
    }

    function setupTurb(fx) {
        try { fx.property('Amount').setValue(200); } catch (e) { }
        try { fx.property('Size').setValue(90); } catch (e) { }
    }

    function setupRamp(fx) { }

    function setupBlurDims(fx) {
        try { fx.property('Blur Radius').setValue(40); } catch (e) { }
    }

    /* Toner and Blur Dimensions need something underneath them to act on;
       everything else generates its own image. */
    function underlay(layer, matchName) {
        if (matchName === 'CC Toner' || matchName === 'ADBE Box Blur2') {
            var fn = null;
            try { fn = layer.Effects.addProperty('ADBE Fractal Noise'); } catch (e) { }
            if (fn) {
                try { fn.property('Contrast').setValue(150); } catch (e) { }
                try { fn.property('Transform').property('Scale').setValue(90); } catch (e) { }
            }
        }
    }

    function label(comp, text, x, y) {
        var t = comp.layers.addText(text);
        try {
            var doc = t.property('Source Text').value;
            doc.fontSize = 34;
            doc.fillColor = [1, 1, 0];
            doc.applyFill = true;
            doc.applyStroke = true;
            doc.strokeColor = [0, 0, 0];
            doc.strokeWidth = 4;
            t.property('Source Text').setValue(doc);
        } catch (e) { }
        try { t.property('Transform').property('Position').setValue([x, y]); } catch (e) { }
        return t;
    }

    function buildGrid(name, matchName, propName, count, setup) {
        var rows = Math.ceil(count / COLS);
        var cw = COLS * TILE_W + (COLS + 1) * GAP;
        var ch = rows * TILE_H + (rows + 1) * GAP;

        var comp = app.project.items.addComp(name, cw, ch, 1, DUR, FPS);
        comp.parentFolder = folder;
        comp.bgColor = [0.1, 0.1, 0.12];

        var missing = false;
        for (var i = 1; i <= count; i++) {
            var col = (i - 1) % COLS, row = Math.floor((i - 1) / COLS);
            var x = GAP + col * (TILE_W + GAP) + TILE_W / 2;
            var y = GAP + row * (TILE_H + GAP) + TILE_H / 2;

            var tile = comp.layers.addSolid([0.5, 0.5, 0.5], propName + ' ' + i, TILE_W, TILE_H, 1, DUR);
            try { tile.property('Transform').property('Position').setValue([x, y]); } catch (e) { }

            underlay(tile, matchName);

            var fx = null;
            try { fx = tile.Effects.addProperty(matchName); } catch (e) { fx = null; }
            if (!fx) { missing = true; break; }

            if (setup) setup(fx);
            try { fx.property(propName).setValue(i); } catch (e) { }

            label(comp, String(i), x - TILE_W / 2 + 14, y - TILE_H / 2 + 40);
        }

        if (missing) {
            try { comp.remove(); } catch (e) { }
            lines.push('    (grid skipped — ' + matchName + ' is not installed)');
            return null;
        }
        return comp;
    }

    // ── run ──────────────────────────────────────────────────────────

    app.beginUndoGroup('Living Gradients — Effect Probe');

    try {
        folder = app.project.items.addFolder('LG PROBE');

        probeComp = app.project.items.addComp('LG PROBE scratch', 64, 64, 1, 1, FPS);
        probeComp.parentFolder = folder;
        probeSolid = probeComp.layers.addSolid([0, 0, 0], 'scratch', 64, 64, 1);

        lines.push('Living Gradients — effect probe');
        lines.push('AE version : ' + app.version);
        lines.push('Language   : ' + $.locale);
        lines.push('Date       : ' + new Date().toString());
        lines.push('');
        lines.push('"clamps at" is the highest value the parameter accepted. A small');
        lines.push('number means the parameter is a dropdown and that is its option');
        lines.push('count. A large one means it is an ordinary slider.');

        var i;
        for (i = 0; i < EFFECTS.length; i++) {
            dumpEffect(EFFECTS[i][0], EFFECTS[i][1]);
        }

        lines.push('');
        lines.push('');
        lines.push('=== OPTION GRIDS ===');
        lines.push('One comp per dropdown, every option rendered with its number on it.');
        lines.push('');

        var made = [];
        for (i = 0; i < GRIDS.length; i++) {
            var g = GRIDS[i];
            var comp = buildGrid(g[0], g[1], g[2], g[3], g[4]);
            if (comp) { made.push(g[0]); lines.push('  ' + g[0]); }
        }

        try { probeComp.remove(); } catch (e) { }

        // ── write the report ──
        var out = new File($.fileName).parent.fsName + '/effect_probe_report.txt';
        var f = new File(out);
        f.encoding = 'UTF-8';
        f.open('w');
        f.write(lines.join('\n'));
        f.close();

        app.endUndoGroup();

        alert('Effect probe done.\n\n' +
              'Report written to:\n' + out + '\n\n' +
              made.length + ' option grids are in the "LG PROBE" folder in your project.\n' +
              'Open each one, screenshot it, and send those along with the report.\n\n' +
              'Delete the LG PROBE folder when you are finished with it.');

    } catch (err) {
        try { app.endUndoGroup(); } catch (e) { }
        alert('Effect probe failed:\n' + err.toString() +
              (err.line ? '\nline ' + err.line : ''));
    }
})();
