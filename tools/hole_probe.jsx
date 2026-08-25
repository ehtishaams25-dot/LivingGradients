/* ============================================================
   HOLE_PROBE.JSX — where does the transparency come from?

   The metals render with hard-edged transparent regions. The checkerboard
   confirms it is genuine alpha rather than a dark shade, and it appears inside
   the *height map* comp — which is the one place in this build where a layer
   exactly fills its own comp, so any effect that samples outside the layer
   bounds tears a visible hole.

   Deduction has now been wrong twice about which effect that is, so this
   reads the truth off the project instead:

     - every comp and layer in the tree, with the layer's size next to its
       comp's size, because "layer exactly fills comp" is the precondition for
       the whole failure
     - every effect, in order, with enabled state
     - every parameter that is not at its default, with its VALUE AS SET —
       so a write that silently failed shows up as the default it fell back to

   Run it with a gradient comp open (or selected in the Project panel):
   File > Scripts > Run Script File... > tools/hole_probe.jsx

   Writes tools/hole_probe_report.txt next to this file and opens it.
   ============================================================ */

(function () {

    var LINES = [];
    function say(s) { LINES.push(s === undefined ? '' : String(s)); }

    function pad(s, n) {
        s = String(s);
        while (s.length < n) s += ' ';
        return s;
    }

    /* A property's value, rendered short enough to read in a column. */
    function valueOf(p) {
        try {
            if (p.expression) return 'expr: ' + p.expression.replace(/\s+/g, ' ');
        } catch (e) { }
        try {
            var v = p.value;
            if (v instanceof Array) {
                var out = [], i;
                for (i = 0; i < v.length; i++) out.push(Math.round(v[i] * 1000) / 1000);
                return '[' + out.join(', ') + ']';
            }
            if (typeof v === 'number') return String(Math.round(v * 1000) / 1000);
            return String(v);
        } catch (e) {
            return '<unreadable>';
        }
    }

    function dumpEffects(layer, indent) {
        var fx = null;
        try { fx = layer.property('Effects'); } catch (e) { return; }
        if (!fx || fx.numProperties === 0) {
            say(indent + '(no effects)');
            return;
        }

        for (var i = 1; i <= fx.numProperties; i++) {
            var e = null;
            try { e = fx.property(i); } catch (err) { continue; }
            if (!e) continue;

            var state = '';
            try { state = e.enabled ? '' : '  [DISABLED]'; } catch (err) { }

            var mn = '';
            try { mn = e.matchName; } catch (err) { }

            say(indent + i + '. ' + e.name + '   {' + mn + '}' + state);

            /* Every parameter, with its index, so a value can be checked
               against tools/effect_probe_report.txt directly. */
            for (var j = 1; j <= e.numProperties; j++) {
                var p = null;
                try { p = e.property(j); } catch (err) { continue; }
                if (!p) continue;

                var isGroup = false;
                try { isGroup = (p.numProperties !== undefined && p.numProperties > 0 && p.value === undefined); } catch (err) { }
                if (isGroup) continue;

                var nm = '';
                try { nm = p.name; } catch (err) { nm = '?'; }
                if (nm === '') continue;

                say(indent + '     ' + pad(j, 4) + pad(nm, 34) + valueOf(p));
            }
        }
    }

    var seen = {};

    function dumpComp(comp, depth) {
        if (!comp || !(comp instanceof CompItem)) return;
        if (depth > 6) return;
        if (seen[comp.id]) {
            say(new Array(depth * 2 + 1).join(' ') + '(already listed: ' + comp.name + ')');
            return;
        }
        seen[comp.id] = true;

        var ind = new Array(depth * 2 + 1).join(' ');
        say('');
        say(ind + '=== COMP: ' + comp.name + '   ' + comp.width + 'x' + comp.height +
            '   ' + comp.numLayers + ' layers');

        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);

            var size = '?';
            var fills = '';
            try {
                if (l.width !== undefined && l.height !== undefined) {
                    size = l.width + 'x' + l.height;
                    /* The precondition for edge tearing: a layer with no room
                       around it inside its own comp. Flagged loudly because it
                       is the thing worth looking at first. */
                    if (l.width === comp.width && l.height === comp.height) {
                        fills = '   <-- EXACTLY FILLS COMP (no overhang to displace into)';
                    }
                }
            } catch (e) { }

            var en = '';
            try { en = l.enabled ? '' : ' [eye off]'; } catch (e) { }

            say('');
            say(ind + '  --- LAYER ' + i + ': ' + l.name + '   ' + size + en + fills);

            try {
                if (l.blendingMode !== undefined) {
                    say(ind + '      blend: ' + l.blendingMode +
                        '   opacity: ' + valueOf(l.property('Transform').property('Opacity')));
                }
            } catch (e) { }

            try {
                var masks = l.property('Masks');
                if (masks && masks.numProperties > 0) {
                    say(ind + '      masks: ' + masks.numProperties);
                }
            } catch (e) { }

            dumpEffects(l, ind + '      ');

            try {
                if (l.source && l.source instanceof CompItem) dumpComp(l.source, depth + 1);
            } catch (e) { }
        }
    }

    // ---- go ------------------------------------------------------------
    var target = app.project.activeItem;
    if (!target || !(target instanceof CompItem)) {
        var sel = app.project.selection;
        for (var s = 0; s < sel.length; s++) {
            if (sel[s] instanceof CompItem) { target = sel[s]; break; }
        }
    }
    if (!target || !(target instanceof CompItem)) {
        alert('Open or select a composition first, then run this again.');
        return;
    }

    say('Living Gradients — hole probe');
    say('AE      : ' + app.version);
    say('Date    : ' + new Date().toString());
    say('Root    : ' + target.name);
    say('');
    say('Looking for: a layer that EXACTLY FILLS COMP and carries an effect');
    say('that samples elsewhere on the layer (Turbulent Displace, CC Glass,');
    say('CC Blobbylize, Directional Blur). That combination is what tears');
    say('transparency in from beyond the edge.');
    say('');
    say('Check Turbulent Displace "Pinning" and "Resize Layer" below against');
    say('what the build tried to set — a value still at its default means the');
    say('write never landed.');
    say(new Array(78).join('='));

    dumpComp(target, 0);

    var f = new File(File($.fileName).parent.fsName + '/hole_probe_report.txt');
    f.open('w');
    f.encoding = 'UTF-8';
    f.write(LINES.join('\n'));
    f.close();

    f.execute();
    alert('Wrote ' + f.fsName);

})();
