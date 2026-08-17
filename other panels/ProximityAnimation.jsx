/**
 * ═══════════════════════════════════════════════════════════
 *  PROXIMITY ANIMATION  —  Standalone After Effects Script
 *  For Living Gradients plugin by Digivero
 * ═══════════════════════════════════════════════════════════
 *
 *  WHAT IT DOES
 *  ────────────
 *  Creates a "PROXIMITY CONTROLLER" null layer at the comp centre.
 *  Any layer with an expression applied will be *repelled* (or attracted)
 *  based on how close it sits to the null.
 *
 *  WORKFLOW
 *  ────────
 *  1.  Select the layers you want to be reactive.
 *  2.  Run script → "Create & Apply".
 *  3.  Move the null around — reactive layers push away (or pull in).
 *  4.  Parent any object (emoji, shape, text) to a reactive layer and
 *      it will inherit the proximity movement automatically.
 *
 *  NULL CONTROLS  (Effect Controls panel)
 *  ────────────────────────────────────────
 *  • Radius   — influence distance in pixels  (default 300)
 *  • Force    — push/pull strength in pixels  (default 80)
 *  • Falloff  — curve of the strength fall-off (higher = sharper edge)
 *  • Mode     — 0 = Repel  |  1 = Attract
 */

(function proximityAnimation(thisObj) {

    // ── CONSTANTS ────────────────────────────────────────────────────────────

    var CTRL_NAME    = "● PROXIMITY CONTROLLER";
    var DEFAULTS     = { radius: 300, force: 80, falloff: 1.5, mode: 0 };
    var LABEL_COLOUR = 4;   // AE label: teal / cyan

    // ── UI ───────────────────────────────────────────────────────────────────

    function buildUI(host) {
        var isDocked = host instanceof Panel;
        var win = isDocked
            ? host
            : new Window("dialog", "Proximity Animation", undefined, { resizeable: false });

        win.orientation   = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing       = 10;
        win.margins       = [16, 14, 16, 14];

        // ── Header ──
        var hdr = win.add("group");
        hdr.alignment = "center";
        var lbl = hdr.add("statictext", undefined, "PROXIMITY ANIMATION");
        lbl.graphics.font = ScriptUI.newFont("dialog", "BOLD", 12);

        win.add("panel").alignment = "fill"; // divider

        // ── Parameter rows ──
        function row(parent, label, defVal, w) {
            var g = parent.add("group");
            g.alignment = "fill";
            var st = g.add("statictext", [0,0,100,20], label);
            var et = g.add("edittext",   [0,0, w || 65, 20], String(defVal));
            return et;
        }

        var radiusIn  = row(win, "Radius (px):", DEFAULTS.radius);
        var forceIn   = row(win, "Force (px):",  DEFAULTS.force);
        var falloffIn = row(win, "Falloff:",      DEFAULTS.falloff);

        // Mode dropdown
        var modeGrp = win.add("group");
        modeGrp.alignment = "fill";
        modeGrp.add("statictext", [0,0,100,20], "Mode:");
        var modeDD = modeGrp.add("dropdownlist", [0,0,110,20], ["Repel", "Attract"]);
        modeDD.selection = 0;

        win.add("panel").alignment = "fill"; // divider

        // ── Buttons ──
        var btnRow = win.add("group");
        btnRow.alignment = "center";
        btnRow.spacing   = 6;
        var createBtn = btnRow.add("button", undefined, "Create & Apply");
        var applyBtn  = btnRow.add("button", undefined, "Apply to Selected");
        var clearBtn  = btnRow.add("button", undefined, "Remove Exprs");

        // ── Status line ──
        var statusLbl = win.add("statictext", undefined, "");
        statusLbl.alignment = "center";

        // ── Wire buttons ──
        createBtn.onClick = function () {
            var o = collectOptions();
            if (o) createAndApply(o, statusLbl);
        };

        applyBtn.onClick = function () {
            var o = collectOptions();
            if (o) applyOnly(o, statusLbl);
        };

        clearBtn.onClick = function () {
            var o = collectOptions();
            if (o) removeExpressions(o, statusLbl);
        };

        function collectOptions() {
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) {
                alert("Please open a composition and try again.");
                return null;
            }
            return {
                comp:    comp,
                radius:  parseFloat(radiusIn.text)  || DEFAULTS.radius,
                force:   parseFloat(forceIn.text)   || DEFAULTS.force,
                falloff: parseFloat(falloffIn.text) || DEFAULTS.falloff,
                mode:    modeDD.selection ? modeDD.selection.index : 0
            };
        }

        if (!isDocked) {
            win.center();
            win.show();
        } else {
            win.layout.layout(true);
        }
    }

    // ── CORE — CREATE CONTROLLER NULL ────────────────────────────────────────

    function createAndApply(opts, statusEl) {
        var comp = opts.comp;
        app.beginUndoGroup("Proximity: Create & Apply");

        try {
            // Remove stale controller if present
            for (var i = comp.layers.length; i >= 1; i--) {
                try { if (comp.layers[i].name === CTRL_NAME) { comp.layers[i].remove(); break; } } catch(e) {}
            }

            // Create null
            var nl = comp.layers.addNull(comp.duration);
            nl.name  = CTRL_NAME;
            nl.label = LABEL_COLOUR;

            // Centre it
            nl.property("ADBE Transform Group")
              .property("ADBE Position")
              .setValue([comp.width / 2, comp.height / 2]);

            // Add expression-control sliders
            var fx = nl.property("ADBE Effect Parade");
            addSlider(fx, "Radius",  opts.radius);
            addSlider(fx, "Force",   opts.force);
            addSlider(fx, "Falloff", opts.falloff);
            addSlider(fx, "Mode",    opts.mode);   // 0=repel  1=attract

            // Apply to selected layers (skip the null itself)
            var n = applyExpressionsToSelected(comp, nl);

            status(statusEl, "✓ Controller created. Expressions on " + n + " layer(s).");

        } catch (e) {
            status(statusEl, "✕ Error: " + e.toString());
        }

        app.endUndoGroup();
    }

    // ── CORE — APPLY TO EXISTING CONTROLLER ─────────────────────────────────

    function applyOnly(opts, statusEl) {
        var comp = opts.comp;
        app.beginUndoGroup("Proximity: Apply to Selected");

        try {
            var nl = findController(comp);
            if (!nl) {
                status(statusEl, "✕ No controller found — create one first.");
                return;
            }
            var n = applyExpressionsToSelected(comp, nl);
            status(statusEl, "✓ Expressions applied to " + n + " layer(s).");
        } catch (e) {
            status(statusEl, "✕ Error: " + e.toString());
        }

        app.endUndoGroup();
    }

    // ── CORE — REMOVE EXPRESSIONS ────────────────────────────────────────────

    function removeExpressions(opts, statusEl) {
        var comp = opts.comp;
        app.beginUndoGroup("Proximity: Remove Expressions");

        try {
            var sel = comp.selectedLayers;
            var n   = 0;
            for (var i = 0; i < sel.length; i++) {
                try {
                    var pos = sel[i].property("ADBE Transform Group").property("ADBE Position");
                    if (pos.expression.indexOf("PROXIMITY CONTROLLER") !== -1) {
                        pos.expression = "";
                        n++;
                    }
                } catch(e) {}
            }
            status(statusEl, "✓ Expressions removed from " + n + " layer(s).");
        } catch (e) {
            status(statusEl, "✕ Error: " + e.toString());
        }

        app.endUndoGroup();
    }

    // ── HELPERS ──────────────────────────────────────────────────────────────

    function applyExpressionsToSelected(comp, nullLayer) {
        var sel   = comp.selectedLayers;
        var count = 0;
        var expr  = buildExpression();

        for (var i = 0; i < sel.length; i++) {
            var layer = sel[i];
            if (layer === nullLayer) continue;
            try {
                var pos = layer.property("ADBE Transform Group").property("ADBE Position");
                // Store current baked value before adding expression
                // so 'value' (the no-expression value) stays intact.
                pos.expression = expr;
                count++;
            } catch (e) {
                // Layer may use separated dimensions — try per-axis fallback
                try {
                    var tg = layer.property("ADBE Transform Group");
                    tg.property("ADBE Position_0").expression = buildAxisExpression("x");
                    tg.property("ADBE Position_1").expression = buildAxisExpression("y");
                    count++;
                } catch (e2) { /* unsupported layer type — skip silently */ }
            }
        }
        return count;
    }

    function findController(comp) {
        for (var i = 1; i <= comp.layers.length; i++) {
            try { if (comp.layers[i].name === CTRL_NAME) return comp.layers[i]; } catch(e) {}
        }
        return null;
    }

    function addSlider(fx, name, val) {
        var s = fx.addProperty("ADBE Slider Control");
        s.name = name;
        s.property("ADBE Slider Control-0001").setValue(val);
        return s;
    }

    function status(el, msg) {
        if (el) el.text = msg;
    }

    // ── EXPRESSION BUILDER ───────────────────────────────────────────────────
    //
    //  Uses:
    //    value  → the property's natural (keyframed) position; no recursion.
    //    ctrl.transform.position → null's comp-space position.
    //
    //  Handles both 2D [x,y] and 3D [x,y,z] layers transparently.

    function buildExpression() {
        var n = CTRL_NAME.replace(/"/g, '\\"'); // escape for JS string literal
        return [
            "// ─── Proximity Reaction — Living Gradients (Digivero) ───────────",
            "var ctrl    = thisComp.layer(\"" + n + "\");",
            "var radius  = ctrl.effect(\"Radius\")(\"Slider\");",
            "var force   = ctrl.effect(\"Force\")(\"Slider\");",
            "var falloff = ctrl.effect(\"Falloff\")(\"Slider\");",
            "var mode    = ctrl.effect(\"Mode\")(\"Slider\"); // 0 = repel  1 = attract",
            "",
            "// Null world position",
            "var src  = ctrl.transform.position;",
            "",
            "// Natural / keyframed position of THIS layer (no expression)",
            "var rest = value;",
            "",
            "// 2-D distance from null to this layer's rest position",
            "var dx   = rest[0] - src[0];",
            "var dy   = rest[1] - src[1];",
            "var dist = Math.sqrt(dx * dx + dy * dy);",
            "",
            "if (dist > 0.001 && dist < radius) {",
            "  // t = 1 when on top of null, 0 at edge of radius",
            "  var t        = 1.0 - (dist / radius);",
            "  var strength = Math.pow(t, Math.max(falloff, 0.1)) * force;",
            "  var dir      = (mode < 0.5) ? 1.0 : -1.0;   // repel or attract",
            "",
            "  var rx = rest[0] + dir * (dx / dist) * strength;",
            "  var ry = rest[1] + dir * (dy / dist) * strength;",
            "",
            "  // Preserve Z for 3-D layers",
            "  (rest.length === 3) ? [rx, ry, rest[2]] : [rx, ry];",
            "} else {",
            "  rest; // outside radius — no change",
            "}"
        ].join("\n");
    }

    // Fallback for separated-dimension position properties
    function buildAxisExpression(axis) {
        var n   = CTRL_NAME.replace(/"/g, '\\"');
        var src = (axis === "x") ? "src[0]" : "src[1]";
        return [
            "var ctrl    = thisComp.layer(\"" + n + "\");",
            "var radius  = ctrl.effect(\"Radius\")(\"Slider\");",
            "var force   = ctrl.effect(\"Force\")(\"Slider\");",
            "var falloff = ctrl.effect(\"Falloff\")(\"Slider\");",
            "var mode    = ctrl.effect(\"Mode\")(\"Slider\");",
            "var src     = ctrl.transform.position;",
            "var rest    = value;",
            "var pos2D   = (thisComp.layer(thisLayer.index)).transform.position;",
            "var dx = pos2D[0] - src[0];",
            "var dy = pos2D[1] - src[1];",
            "var dist = Math.sqrt(dx*dx + dy*dy);",
            "if (dist > 0.001 && dist < radius) {",
            "  var t = 1.0 - dist/radius;",
            "  var s = Math.pow(t, Math.max(falloff,0.1)) * force;",
            "  var d = (mode < 0.5) ? 1 : -1;",
            "  rest + d * (" + ((axis==="x") ? "dx" : "dy") + " / dist) * s;",
            "} else { rest; }"
        ].join("\n");
    }

    // ── BOOT ─────────────────────────────────────────────────────────────────
    buildUI(thisObj);

}(this));
