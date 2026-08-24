/* =====================================================================
   LIVING GRADIENTS — SHADER LAB
   ---------------------------------------------------------------------
   Run once, on an empty project:  File > Scripts > Run Script File…

   WHY THIS EXISTS

   The contact sheet answers "is this gradient right?" and it answers it
   well. What it cannot answer is "which stage made it wrong", and for the
   shaded builds — the eight metals and the frosted glass — that is the only
   question worth asking, because they are six or seven effects deep with a
   second layer feeding them.

   Two rounds were lost to guessing at that. The metals came back covered in
   hairline contour rings and the diagnosis (Wrap Back folding the field far
   more times than intended) was reasoned from the picture rather than seen.
   The frosted glass came back with a hard horizontal seam and the diagnosis
   is still, honestly, a hypothesis. That is the gap this closes.

   WHAT IT MAKES

   For each build listed below, one row of tiles:

     • the height map on its own, as an image, so you can see whether the
       tooling exists at all and whether it is smooth enough to differentiate
       into normals without breaking up;
     • then the picture layer with its effects switched on one at a time —
       stage 1 alone, stages 1-2, stages 1-3, and so on to the finished
       frame.

   Read it left to right and the stage where it goes wrong is the stage that
   is wrong. No reasoning required.

   Nothing here re-implements the builders. It calls dispatchBuild, exactly
   as the panel does, then walks the effects on what came back.
   ===================================================================== */

var LG_SL_ROOT = new File($.fileName).parent.parent;   // …/LivingGradients
var LG_SL_MAIN = new File(LG_SL_ROOT.fsName + '/jsx/main.jsx');

if (LG_SL_MAIN.exists) {
    try {
        $.evalFile(LG_SL_MAIN);
    } catch (LG_SL_ERR) {
        alert('jsx/main.jsx did not evaluate:\n' + LG_SL_ERR.toString() +
              (LG_SL_ERR.line ? '\nline ' + LG_SL_ERR.line : ''));
    }
}

(function () {

    /* Built at delivery size and scaled into the tile, for the same reason
       the contact sheet does it: several builders carry hard-coded pixel
       values, and a tile-sized build is evidence about the tile. */
    var BUILD_W = 1920, BUILD_H = 1080;
    var CELL_W  = 400,  CELL_H = 225;
    var DUR = 6, FPS = 30, SAMPLE_TIME = 2.0;

    /* Which builds to take apart. Defaults come from js/controls.js the same
       way the contact sheet reads them, so a row shows what the panel builds
       rather than a builder's internal fallback. */
    var SUBJECTS = ['Gold', 'Polished', 'Mercury', 'Brushed', 'Hammered', 'Glass'];

    var root = LG_SL_ROOT;
    var log  = [];
    function note(s) { log.push(s); }
    function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }

    function readFile(rel) {
        var f = new File(root.fsName + '/' + rel);
        if (!f.exists) return null;
        f.encoding = 'UTF-8';
        f.open('r');
        var t = f.read();
        f.close();
        return t;
    }

    /* Regex over the source rather than a copy of the list — a second copy is
       a second thing to forget to update. Same approach as contact_sheet.jsx. */
    function parsePalettes(src) {
        var out = {}, re = /\{\s*id:\s*'([^']+)'[^}]*?defaultColors:\s*\[([^\]]*)\]/g, m;
        while ((m = re.exec(src)) !== null) {
            var cols = [], cm, cre = /'(#[0-9a-fA-F]{3,8})'/g;
            while ((cm = cre.exec(m[2])) !== null) cols.push(cm[1]);
            out[m[1]] = cols;
        }
        return out;
    }

    function parseControls(src) {
        var byType = {}, re = /\n  ([A-Za-z_]+):\s*\[/g, m;
        while ((m = re.exec(src)) !== null) {
            var name = m[1], from = m.index + m[0].length, depth = 1, i = from;
            while (i < src.length && depth > 0) {
                if (src.charAt(i) === '[') depth++;
                else if (src.charAt(i) === ']') depth--;
                i++;
            }
            var body = src.substring(from, i - 1), o = {}, dm;
            var dre = /\{\s*id:\s*'([^']+)'[^}]*?default:\s*('([^']*)'|[-0-9.]+)/g;
            while ((dm = dre.exec(body)) !== null) {
                o[dm[1]] = (dm[3] !== undefined) ? dm[3] : parseFloat(dm[2]);
            }
            byType[name] = o;
        }
        return byType;
    }

    var palettes = parsePalettes(readFile('js/presets.js')  || '');
    var controls = parseControls(readFile('js/controls.js') || '');

    function hexToRgb(h) {
        h = String(h).replace('#', '');
        if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
        return [parseInt(h.substr(0, 2), 16) / 255,
                parseInt(h.substr(2, 2), 16) / 255,
                parseInt(h.substr(4, 2), 16) / 255];
    }

    /* ── Taking a build apart ─────────────────────────────────────────

       The picture layer's effects are switched on cumulatively. Everything
       else about the build — the second layer, its own effects, the bump
       reference between them — is left exactly as the builder made it, so a
       tile is the real stack with a real prefix of it enabled and not a
       reconstruction of one.

       Effects that a builder deliberately disabled stay disabled at every
       stage. An effect that is off because its slider is at zero is not a
       stage, and showing it as one would invent a step that never runs. */
    function effectNames(layer) {
        var out = [], fx = null, i, e;
        try { fx = layer.property('Effects'); } catch (x) { return out; }
        for (i = 1; i <= fx.numProperties; i++) {
            e = null;
            try { e = fx.property(i); } catch (x) { continue; }
            var on = true;
            try { on = e.enabled; } catch (x) { }
            out.push({ index: i, name: e.name, enabled: on });
        }
        return out;
    }

    function enableUpTo(layer, n, stages) {
        var fx = layer.property('Effects'), i;
        for (i = 0; i < stages.length; i++) {
            try {
                // A stage the builder switched off never comes back on.
                fx.property(stages[i].index).enabled = stages[i].enabled && (i < n);
            } catch (x) { }
        }
    }

    /* The layer a build's picture lives on. Every shaded build names it, and
       the bump layer is the disabled one. */
    function findPicture(comp) {
        var i, l, best = null;
        for (i = 1; i <= comp.numLayers; i++) {
            l = comp.layer(i);
            var on = true;
            try { on = l.enabled; } catch (x) { }
            if (on && !best) best = l;
        }
        return best;
    }

    function findBump(comp) {
        var i, l;
        for (i = 1; i <= comp.numLayers; i++) {
            l = comp.layer(i);
            var on = true;
            try { on = l.enabled; } catch (x) { }
            if (!on) return l;
        }
        return null;
    }

    // ── Build the sheet ──────────────────────────────────────────────
    app.beginUndoGroup('Living Gradients — shader lab');

    var rows = [];      // { label, tiles: [ {title, comp} ] }

    for (var si = 0; si < SUBJECTS.length; si++) {
        var type = SUBJECTS[si];
        var pal  = palettes[type] || ['#FFFFFF', '#888888', '#222222', '#000000'];
        var ctrl = controls[type] || {};
        var cols = [], ci;
        for (ci = 0; ci < pal.length; ci++) cols.push(hexToRgb(pal[ci]));

        var tiles = [];

        var src = app.project.items.addComp('LAB ' + type, BUILD_W, BUILD_H, 1, DUR, FPS);
        var built = true;
        try {
            if (typeof LG !== 'undefined' && LG.reset) LG.reset();
            dispatchBuild(src, type, cols, ctrl, BUILD_W, BUILD_H, DUR);
        } catch (e) {
            note('  ' + pad(type, 12) + 'THREW: ' + e.toString());
            built = false;
        }
        if (!built || src.numLayers === 0) { continue; }

        var picture = findPicture(src);
        var bump    = findBump(src);

        /* The height map, shown as an image. A bump layer that is flat, or
           full of pixel-level grain, tells you the answer before any of the
           shading tiles do — normals are a derivative, so both of those
           failure modes are invisible until they are looked at directly. */
        if (bump) {
            var bcomp = app.project.items.addComp('LAB ' + type + ' 0 height', BUILD_W, BUILD_H, 1, DUR, FPS);
            var copy = null;
            try {
                bump.copyToComp(bcomp);
                copy = bcomp.layer(1);
                copy.enabled = true;
            } catch (e) { }
            if (copy) tiles.push({ title: '0 height map', comp: bcomp });
            else { try { bcomp.remove(); } catch (e) { } }
        }

        var stages = effectNames(picture);
        note('');
        note('  ' + type + ' — ' + stages.length + ' stages on "' + picture.name + '"' +
             (bump ? ', bump layer "' + bump.name + '"' : ', no bump layer'));

        for (var st = 1; st <= stages.length; st++) {
            var scomp = app.project.items.addComp(
                'LAB ' + type + ' ' + st, BUILD_W, BUILD_H, 1, DUR, FPS);
            var ok = false;
            try {
                // The whole build, so the bump reference survives.
                for (var li = src.numLayers; li >= 1; li--) src.layer(li).copyToComp(scomp);
                ok = true;
            } catch (e) {
                note('    stage ' + st + ' could not be copied: ' + e.toString());
            }
            if (!ok) { try { scomp.remove(); } catch (e) { } continue; }

            var pic2 = findPicture(scomp);
            if (pic2) enableUpTo(pic2, st, effectNames(pic2));
            tiles.push({ title: st + ' ' + stages[st - 1].name, comp: scomp });
            note('    ' + pad(st, 3) + stages[st - 1].name +
                 (stages[st - 1].enabled ? '' : '   (builder had this OFF)'));
        }

        rows.push({ label: type, tiles: tiles, source: src });
    }

    // ── Lay it out ───────────────────────────────────────────────────
    var maxCols = 0, r;
    for (r = 0; r < rows.length; r++) maxCols = Math.max(maxCols, rows[r].tiles.length);
    if (maxCols === 0) { app.endUndoGroup(); alert('Shader lab: nothing built.'); return; }

    var sheet = app.project.items.addComp(
        'LG SHADER LAB', maxCols * CELL_W, rows.length * CELL_H, 1, DUR, FPS);
    sheet.bgColor = [0.08, 0.08, 0.09];

    for (r = 0; r < rows.length; r++) {
        for (var c = 0; c < rows[r].tiles.length; c++) {
            var t = rows[r].tiles[c];
            var l = sheet.layers.add(t.comp);
            l.property('Transform').property('Position')
             .setValue([c * CELL_W + CELL_W / 2, r * CELL_H + CELL_H / 2]);
            l.property('Transform').property('Scale')
             .setValue([CELL_W / BUILD_W * 100, CELL_H / BUILD_H * 100]);

            var tx = sheet.layers.addText(rows[r].label + '  ·  ' + t.title);
            var td = tx.property('Source Text').value;
            td.fontSize = 15;
            td.applyStroke = true;
            td.strokeColor = [0, 0, 0];
            td.strokeWidth = 3;
            td.fillColor = [1, 1, 1];
            tx.property('Source Text').setValue(td);
            tx.property('Transform').property('Position')
              .setValue([c * CELL_W + 10, r * CELL_H + 22]);
        }
    }

    try { sheet.time = SAMPLE_TIME; } catch (e) { }
    sheet.openInViewer();

    // Tidy the working comps out of the way.
    try {
        var folder = app.project.items.addFolder('LG SHADER LAB');
        for (r = 0; r < rows.length; r++) {
            for (var k = 0; k < rows[r].tiles.length; k++) rows[r].tiles[k].comp.parentFolder = folder;
            rows[r].source.parentFolder = folder;
        }
    } catch (e) { }

    app.endUndoGroup();

    // ── Report ───────────────────────────────────────────────────────
    var head = [];
    head.push('Living Gradients — shader lab');
    head.push('AE ' + app.version.split('x')[0] + '   ' + new Date().toString());
    head.push('built at ' + BUILD_W + 'x' + BUILD_H + ', scaled into ' + CELL_W + 'x' + CELL_H + ' tiles');
    head.push('');
    head.push('One row per build. Column 0 is the height map as an image;');
    head.push('after that the picture layer\'s effects are switched on one at');
    head.push('a time, cumulatively. The stage where the row goes wrong is the');
    head.push('stage that is wrong.');
    head.push('');
    head.push('Stages marked "builder had this OFF" stay off in every tile —');
    head.push('an effect disabled because its slider is at zero is not a step.');

    var out = new File(root.fsName + '/tools/shader_lab_report.txt');
    out.encoding = 'UTF-8';
    out.open('w');
    out.write(head.join('\n') + '\n' + log.join('\n') + '\n');
    out.close();

    alert('Shader lab done.\n\n' +
          rows.length + ' builds taken apart, ' + maxCols + ' columns at the widest.\n\n' +
          'Comp: LG SHADER LAB\n' +
          'Report: ' + out.fsName + '\n\n' +
          'Screenshot the sheet and send it with the report.\n' +
          'Delete the LG SHADER LAB folder when you are done.');
})();
