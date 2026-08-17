/**
 * PROXIMITY ANIMATION — Living Gradients (Digivero)
 *
 * HOW TO USE:
 *  1. Run this script
 *  2. Click "Setup Proximity" — a null is created and ALL layers get expressions
 *  3. SELECT THE NULL and MOVE IT around the canvas
 *  4. Layers nearby will push away from the null
 *  5. Parent any emoji/shape/text to a reactive layer to inherit the movement
 */

(function (thisObj) {

    var CTRL = "PROXIMITY NULL";

    // ── UI ──────────────────────────────────────────────────────────────────
    var win = (thisObj instanceof Panel)
        ? thisObj
        : new Window("dialog", "Proximity Animation");

    win.orientation   = "column";
    win.alignChildren = ["fill","top"];
    win.margins       = 16;
    win.spacing       = 8;

    win.add("statictext", undefined, "PROXIMITY ANIMATION").graphics.font =
        ScriptUI.newFont("dialog","BOLD",12);

    win.add("panel").alignment = "fill";

    function row(label, val) {
        var g = win.add("group");
        g.add("statictext", [0,0,90,20], label);
        var e = g.add("edittext", [0,0,70,20], String(val));
        return e;
    }

    var rIn = row("Radius (px):", 300);
    var fIn = row("Force (px):",   80);

    win.add("panel").alignment = "fill";

    var setupBtn  = win.add("button", undefined, "Setup Proximity on All Layers");
    var removeBtn = win.add("button", undefined, "Remove Expressions");
    var msgEl     = win.add("statictext", undefined, "");
    msgEl.alignment = "center";

    setupBtn.onClick = function () {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) { alert("Open a comp first."); return; }
        setup(comp, +rIn.text || 300, +fIn.text || 80);
    };

    removeBtn.onClick = function () {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) { alert("Open a comp first."); return; }
        removeAll(comp);
    };

    if (win instanceof Window) { win.center(); win.show(); }
    else win.layout.layout(true);

    // ── SETUP ────────────────────────────────────────────────────────────────
    function setup(comp, radius, force) {
        app.beginUndoGroup("Proximity Setup");
        try {
            // Remove old null if exists
            for (var i = comp.layers.length; i >= 1; i--) {
                try { if (comp.layers[i].name === CTRL) comp.layers[i].remove(); } catch(e) {}
            }

            // Create null at comp centre
            var nl = comp.layers.addNull(comp.duration);
            nl.name  = CTRL;
            nl.label = 4;
            nl.property("ADBE Transform Group").property("ADBE Position")
              .setValue([comp.width / 2, comp.height / 2]);

            // Add Radius + Force sliders
            var fx = nl.property("ADBE Effect Parade");
            addSlider(fx, "Radius", radius);
            addSlider(fx, "Force",  force);

            // Apply expression to every layer in the comp
            var expr = buildExpr();
            var n = 0;
            for (var j = 1; j <= comp.layers.length; j++) {
                var layer = comp.layers[j];
                if (layer === nl) continue;
                try {
                    layer.property("ADBE Transform Group")
                         .property("ADBE Position").expression = expr;
                    n++;
                } catch(e) {}
            }

            msgEl.text = "Done! Move the null to see " + n + " layer(s) react.";
        } catch(e) { msgEl.text = "Error: " + e.toString(); }
        app.endUndoGroup();
    }

    // ── REMOVE ───────────────────────────────────────────────────────────────
    function removeAll(comp) {
        app.beginUndoGroup("Remove Proximity");
        var n = 0;
        for (var i = 1; i <= comp.layers.length; i++) {
            try {
                var pos = comp.layers[i].property("ADBE Transform Group").property("ADBE Position");
                if (pos.expression.indexOf(CTRL) !== -1) { pos.expression = ""; n++; }
            } catch(e) {}
        }
        msgEl.text = "Removed from " + n + " layer(s).";
        app.endUndoGroup();
    }

    // ── HELPERS ──────────────────────────────────────────────────────────────
    function addSlider(fx, name, val) {
        var s = fx.addProperty("ADBE Slider Control");
        s.name = name;
        s.property("ADBE Slider Control-0001").setValue(val);
    }

    // Expression: layers repel from the null based on distance.
    // 'value' = the layer's natural position (without expression) = rest point.
    function buildExpr() {
        var c = CTRL.replace(/"/g, '\\"');
        return [
            'var ctrl   = thisComp.layer("' + c + '");',
            'var radius = ctrl.effect("Radius")("Slider");',
            'var force  = ctrl.effect("Force")("Slider");',
            'var src    = ctrl.transform.position;',
            'var rest   = value;',
            'var dx = rest[0] - src[0];',
            'var dy = rest[1] - src[1];',
            'var dist = Math.sqrt(dx*dx + dy*dy);',
            'if (dist > 0.001 && dist < radius) {',
            '  var t  = 1.0 - dist/radius;',
            '  var s  = t * t * force;',
            '  var rx = rest[0] + (dx/dist)*s;',
            '  var ry = rest[1] + (dy/dist)*s;',
            '  (rest.length===3) ? [rx,ry,rest[2]] : [rx,ry];',
            '} else { rest; }'
        ].join("\n");
    }

}(this));
