/* =====================================================================
   LIVING GRADIENTS — RECIPE DUMP
   ---------------------------------------------------------------------
   Run: File > Scripts > Run Script File… > this file.

   WHAT IT IS FOR. When a gradient is tuned by hand in After Effects until
   it finally looks right, the numbers that made it right live in the
   project and nowhere else. Reading them off a screenshot gets the big
   ones and loses the small ones — and it loses the two that decide the
   most: whether an effect is switched ON, and what a dropdown is actually
   set to. A menu that reads "Turbulent" and a menu that reads "Turbulent
   Smoother" look nearly the same in a screenshot and are a different
   surface.

   So this writes the whole recipe out as text: every effect on every
   selected layer, in stack order, with its enabled flag, and every
   property with its index, its display name, its match name, and its
   value — dropdowns as the NUMBER the panel would have to write, colours
   as hex, expressions verbatim.

   WHAT TO SELECT. Select the layers you want dumped and run it. With
   nothing selected it dumps every layer of the active comp. Either way it
   follows precomps one level down, so selecting "Gold Metal" also brings
   its "Gold Height" map along — which is where half of any metal recipe
   lives.

   It reads. It changes nothing, adds nothing, and opens no undo group.

   Output: tools/recipe_dump.txt, next to this file.
   ===================================================================== */

(function () {

    var lines = [];
    var seenComps = {};

    function pad(s, n) {
        s = String(s);
        while (s.length < n) s += ' ';
        return s;
    }

    function hex2(v) {
        var n = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).toUpperCase();
        return n.length < 2 ? '0' + n : n;
    }

    /* A property's value, written the way the panel would have to write it.

       The point of the round brackets is that a dropdown's *number* is what
       jsx/main.jsx sets, and the number is the thing a screenshot cannot
       show. Printing the number and the option name together means the dump
       can be read by a person and used by the code. */
    function valueOf(p) {
        try {
            if (p.propertyValueType === PropertyValueType.NO_VALUE) return '(no value)';

            var v = p.value;

            if (p.propertyValueType === PropertyValueType.COLOR) {
                return '#' + hex2(v[0]) + hex2(v[1]) + hex2(v[2]) +
                       '   [' + v[0].toFixed(4) + ', ' + v[1].toFixed(4) + ', ' + v[2].toFixed(4) + ']';
            }

            if (v instanceof Array) {
                var parts = [], i;
                for (i = 0; i < v.length; i++) parts.push(Number(v[i]).toFixed(1));
                return '[' + parts.join(', ') + ']';
            }

            if (typeof v === 'boolean') return v ? 'true' : 'false';

            /* A one-based integer on a property that clamps to a small range
               is a dropdown. Say so, and say what it is showing. */
            if (typeof v === 'number') {
                var extra = '';
                try {
                    if (p.isDropdownEffect || (p.hasMax && p.maxValue <= 40 && v === Math.round(v))) {
                        extra = '   (dropdown)';
                    }
                } catch (e) { }
                return String(v) + extra;
            }

            return String(v);
        } catch (e) {
            return '(unreadable: ' + e.toString() + ')';
        }
    }

    function dumpProperty(p, index, indent) {
        var head = indent + pad(index, 4) + pad(p.name, 30) + pad(p.matchName, 34);

        var expr = '';
        try {
            if (p.canSetExpression && p.expressionEnabled && p.expression) {
                expr = '   EXPR: ' + p.expression.replace(/[\r\n]+/g, ' ');
            }
        } catch (e) { }

        var keys = '';
        try { if (p.numKeys > 0) keys = '   (' + p.numKeys + ' keys)'; } catch (e) { }

        lines.push(head + valueOf(p) + keys + expr);
    }

    /* Effects nest — Evolution Options, Sub Settings, Transform. One level of
       recursion covers everything in this panel's stack. */
    function dumpGroup(group, indent) {
        var i, p;
        for (i = 1; i <= group.numProperties; i++) {
            try { p = group.property(i); } catch (e) { continue; }
            if (!p) continue;

            if (p.propertyType === PropertyType.INDEXED_GROUP ||
                p.propertyType === PropertyType.NAMED_GROUP) {
                lines.push(indent + pad(i, 4) + p.name + '   <group>');
                dumpGroup(p, indent + '    ');
            } else {
                dumpProperty(p, i, indent);
            }
        }
    }

    function dumpLayer(layer, indent, followPrecomps) {
        lines.push('');
        lines.push(indent + '── LAYER ' + layer.index + ': "' + layer.name + '"' +
                   (layer.enabled ? '' : '   [LAYER DISABLED]'));

        try {
            lines.push(indent + '   size ' + layer.width + ' x ' + layer.height +
                       '   blend mode ' + layer.blendingMode +
                       (layer.adjustmentLayer ? '   [adjustment]' : ''));
        } catch (e) { }

        var fx = null;
        try { fx = layer.property('ADBE Effect Parade'); } catch (e) { }

        if (!fx || fx.numProperties === 0) {
            lines.push(indent + '   (no effects)');
        } else {
            var i;
            for (i = 1; i <= fx.numProperties; i++) {
                var e = fx.property(i);
                lines.push('');
                lines.push(indent + '  [' + i + '] ' + e.name +
                           '   (' + e.matchName + ')' +
                           (e.enabled ? '   ON' : '   *** OFF ***'));
                lines.push(indent + '      ' + pad('idx', 4) + pad('property', 30) +
                           pad('matchName', 34) + 'value');
                dumpGroup(e, indent + '      ');
            }
        }

        /* One level down into a precomp, because a metal's height map is a
           comp of its own and the recipe is meaningless without it. */
        if (followPrecomps) {
            try {
                var src = layer.source;
                if (src && (src instanceof CompItem) && !seenComps[src.id]) {
                    seenComps[src.id] = true;
                    lines.push('');
                    lines.push(indent + '   ┌─ inside precomp "' + src.name + '" (' +
                               src.width + ' x ' + src.height + ')');
                    var k;
                    for (k = 1; k <= src.numLayers; k++) {
                        dumpLayer(src.layer(k), indent + '   │ ', false);
                    }
                    lines.push(indent + '   └─ end of "' + src.name + '"');
                }
            } catch (e) { }
        }
    }

    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert('Open the comp you want dumped first, then run this again.');
            return;
        }

        var targets = comp.selectedLayers;
        if (!targets || targets.length === 0) {
            targets = [];
            var n;
            for (n = 1; n <= comp.numLayers; n++) targets.push(comp.layer(n));
        }

        lines.push('LIVING GRADIENTS — RECIPE DUMP');
        lines.push('==============================');
        lines.push('');
        lines.push('project : ' + (app.project.file ? app.project.file.fsName : '(unsaved)'));
        lines.push('comp    : "' + comp.name + '"   ' + comp.width + ' x ' + comp.height +
                   '   ' + comp.frameRate + ' fps   ' + comp.duration.toFixed(2) + 's');
        lines.push('time    : ' + comp.time.toFixed(3) + 's  ' +
                   '(values below are read at this time — park the playhead at 0 ' +
                   'if you want the un-animated numbers)');
        lines.push('layers  : ' + targets.length + ' dumped' +
                   (comp.selectedLayers.length ? ' (selection)' : ' (whole comp)'));
        lines.push('host    : After Effects ' + app.version);

        var t;
        for (t = 0; t < targets.length; t++) dumpLayer(targets[t], '', true);

        lines.push('');
        lines.push('— end —');

        var out = new File($.fileName).parent.fsName + '/recipe_dump.txt';
        var f = new File(out);
        f.encoding = 'UTF-8';
        f.open('w');
        f.write(lines.join('\n'));
        f.close();

        alert('Recipe dump written to:\n\n' + out + '\n\n' +
              targets.length + ' layer(s), precomps followed one level down.\n' +
              'Nothing in your project was changed.');

    } catch (err) {
        alert('Recipe dump failed:\n' + err.toString() +
              (err.line ? '\nline ' + err.line : ''));
    }
})();
