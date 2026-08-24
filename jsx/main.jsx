/* =====================================================================
   LG CORE — effect resolution + failure reporting
   ---------------------------------------------------------------------
   Every effect and property write in this file routes through here.

   Two jobs:
   1. Resolve effects by LOGICAL name, not by a guessed matchName string.
      The resolver tries real matchNames first and caches whatever the
      host actually accepts, so the panel is locale-independent and
      self-correcting across AE versions.
   2. Record every failure. Nothing is silently swallowed any more —
      generateGradient() returns the warnings and the panel shows them.
   ===================================================================== */
var LG = (function () {

    var warnings = [];
    var notes    = [];   // things changed on the user's behalf, worth saying
    var resolved = {};   // logicalKey -> matchName that worked
    var reverse  = null; // any known alias (incl. historical typos) -> logicalKey

    /* Candidates are ordered: real matchName first, English display name
       last. The display name only ever runs on a host where the matchName
       was rejected, which should now be never. */
    var FX = {
        fractalNoise:      ["ADBE Fractal Noise", "Fractal Noise"],
        turbulentDisplace: ["ADBE Turbulent Displace", "Turbulent Displace"],
        glow:              ["ADBE Glo2", "Glow"],
        fastBoxBlur:       ["ADBE Box Blur2", "Fast Box Blur"],
        gaussianBlur:      ["ADBE Gaussian Blur 2", "Gaussian Blur"],
        fastBlur:          ["ADBE Fast Blur", "Fast Blur"],
        waveWarp:          ["ADBE Wave Warp", "Wave Warp"],
        fourColorGradient: ["ADBE 4ColorGradient", "4-Color Gradient"],
        motionTile:        ["ADBE Tile", "Motion Tile"],
        twirl:             ["ADBE Twirl", "Twirl"],
        tint:              ["ADBE Tint", "Tint"],
        ramp:              ["ADBE Ramp", "Gradient Ramp"],
        colorama:          ["APC Colorama", "Colorama"],
        extract:           ["ADBE Extract", "Extract"],
        transformFx:       ["ADBE Geometry2", "Transform"],
        opticsComp:        ["ADBE Optics Compensation", "Optics Compensation"],
        polarCoords:       ["ADBE Polar Coordinates", "Polar Coordinates"],
        displacementMap:   ["ADBE Displacement Map", "Displacement Map"],
        curves:            ["ADBE CurvesCustom", "Curves"],
        mirror:            ["ADBE Mirror", "Mirror"],
        mosaic:            ["ADBE Mosaic", "Mosaic"],
        noise:             ["ADBE Noise", "Noise"],
        echo:              ["ADBE Echo", "Echo"],
        directionalBlur:   ["ADBE Motion Blur", "Directional Blur"],
        simpleChoker:      ["ADBE Simple Choker", "Simple Choker"],
        fill:              ["ADBE Fill", "Fill"],
        dropShadow:        ["ADBE Drop Shadow", "Drop Shadow"],
        warp:              ["ADBE WRPMESH", "Warp"],
        venetianBlinds:    ["ADBE Venetian Blinds", "Venetian Blinds"],
        cellPattern:       ["ADBE Cell Pattern", "Cell Pattern"],
        sliderControl:     ["ADBE Slider Control", "Slider Control"],
        colorControl:      ["ADBE Color Control", "Color Control"],
        pointControl:      ["ADBE Point Control", "Point Control"],
        bulge:             ["ADBE Bulge", "Bulge"],
        angleControl:      ["ADBE Angle Control", "Angle Control"],
        levels:            ["ADBE Easy Levels2", "Levels"],
        setMatte:          ["ADBE Set Matte3", "Set Matte"],
        ccRepeTile:        ["CC RepeTile"],
        ccBubbles:         ["CC Bubbles"],
        ccToner:           ["CC Toner"],
        ccVectorBlur:      ["CC Vector Blur"],
        ccGlass:           ["CC Glass"],
        ccPlastic:         ["CC Plastic"],
        ccBlobbylize:      ["CC Blobbylize"],
        ccMrMercury:       ["CC Mr. Mercury"],
        ccParticleWorld:   ["CC Particle World"],
        /* Immersive/VR ship with AE but their matchNames carry the Mettle
           SkyBox lineage. Ordered most-likely-first; the resolver settles it. */
        vrColorGradient:   ["ADBE SkyBox Color Gradient", "ADBE VR Color Gradient", "VR Color Gradient"],
        vrRotateSphere:    ["ADBE SkyBox Rotate Sphere", "ADBE VR Rotate Sphere", "VR Rotate Sphere"],
        vrPlaneToSphere:   ["ADBE SkyBox Plane to Sphere", "ADBE VR Plane to Sphere", "VR Plane to Sphere"]
    };

    /* Historical typos and dead names found in earlier revisions of this
       file. Mapping them here means old call sites auto-correct instead of
       falling through to an English display name. */
    var ALIASES = {
        "ADBE FractalNoise":        "fractalNoise",
        "ADBE TurbulentDisplace":   "turbulentDisplace",
        "ADBE Glow":                "glow",
        "ADBE Glow2":               "glow",
        "Deep Glow":                "glow",
        "ADBE Fast Box Blur":       "fastBoxBlur",
        "ADBE Box Blur":            "fastBoxBlur",
        "ADBE Wave Warp2":          "waveWarp",
        "ADBE 4-Color Gradient":    "fourColorGradient",
        "ADBE 4 Color Gradient":    "fourColorGradient",
        "4 Color Gradient":         "fourColorGradient",
        "ADBE MotionTile":          "motionTile",
        "ADBE Colorama":            "colorama",
        "ADBE Warp":                "warp",
        "ADBE Directional Blur":    "directionalBlur",
        "ADBE Transform":           "transformFx",
        "Ramp":                     "ramp",
        "ADBE VR Color Gradient":   "vrColorGradient",
        "Mettle Color Gradient":    "vrColorGradient",
        "ADBE VR Rotate Sphere":    "vrRotateSphere",
        "Mettle Rotate Sphere":     "vrRotateSphere",
        "ADBE VR Plane to Sphere":  "vrPlaneToSphere",
        "Mettle Plane to Sphere":   "vrPlaneToSphere"
    };

    function buildReverse() {
        reverse = {};
        var key, list, i, a;
        for (key in FX) {
            if (!FX.hasOwnProperty(key)) continue;
            list = FX[key];
            for (i = 0; i < list.length; i++) reverse[list[i]] = key;
        }
        for (a in ALIASES) {
            if (ALIASES.hasOwnProperty(a)) reverse[a] = ALIASES[a];
        }
    }

    /* Names differ across AE versions by case and punctuation far more often
       than by wording — "Offset (Turbulence)" vs "Offset Turbulence". */
    function norm(s) {
        return String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
    }

    function keyFor(name) {
        if (!reverse) buildReverse();
        return reverse[name] || null;
    }

    /* Expand whatever a caller passed into an ordered candidate list.
       Names that map to a logical key contribute that key's full list;
       unknown names are kept verbatim so third-party effects still work. */
    function candidates(names) {
        if (!reverse) buildReverse();
        var out = [], seen = {}, i, j, key, list;

        function push(n) {
            if (n && !seen[n]) { seen[n] = true; out.push(n); }
        }

        for (i = 0; i < names.length; i++) {
            key = keyFor(names[i]);
            if (key) {
                if (resolved[key]) push(resolved[key]);
                list = FX[key];
                for (j = 0; j < list.length; j++) push(list[j]);
            } else {
                push(names[i]);
            }
        }
        return out;
    }

    function record(msg) {
        for (var i = 0; i < warnings.length; i++) {
            if (warnings[i] === msg) return;   // dedupe; builders loop
        }
        if (warnings.length < 40) warnings.push(msg);
    }

    return {
        reset: function () { warnings = []; notes = []; },

        warn: record,

        /* Not a failure — something was adjusted deliberately and the user
           should know, e.g. a project setting changed for colour quality. */
        note: function (msg) {
            for (var i = 0; i < notes.length; i++) if (notes[i] === msg) return;
            if (notes.length < 6) notes.push(msg);
        },

        notes: function () { return notes.slice(0); },

        count: function () { return warnings.length; },

        report: function () {
            var out = "";
            if (notes.length)    out += " | " + notes.join("; ");
            if (warnings.length) out += " | " + warnings.length + " warning" +
                                        (warnings.length === 1 ? "" : "s") +
                                        ": " + warnings.join("; ");
            return out;
        },

        /* Apply an effect. `names` may be logical keys, real matchNames, or
           legacy strings — all are canonicalised. Returns the effect or null,
           and records a warning if nothing applied. */
        add: function (layer, names, context) {
            if (!layer) {
                record((context || "effect") + ": no layer");
                return null;
            }
            if (typeof names === "string") names = [names];
            var list = candidates(names), i, e, key;

            for (i = 0; i < list.length; i++) {
                e = null;
                try { e = layer.Effects.addProperty(list[i]); } catch (x) { e = null; }
                if (e) {
                    key = keyFor(list[i]);
                    if (key) resolved[key] = list[i];
                    return e;
                }
            }
            record((context ? context + " — " : "") + "effect unavailable: " + names[0]);
            return null;
        },

        /* Resolve a property on an effect. Order matters:

           1. the exact display name — right on an English host;
           2. a scan of the effect's own properties, normalised (case and
              punctuation dropped), which survives the small renames AE makes
              between versions;
           3. the 1-based index, last, for a non-English host.

           The index used to come second, and several historical call sites
           carry indices that were never right — Turbulent Displace's
           Complexity is the 5th property, not the 4th. A wrong index sets the
           wrong parameter silently, which is worse than not setting it, so it
           now only runs once the name and the scan have both missed. */
        find: function (fx, name, idx) {
            if (!fx) return null;
            var p = null, i, q, n = 0;

            if (name) {
                try { p = fx.property(name); } catch (x) { p = null; }
                if (p) return p;
            }

            if (name) {
                var want = norm(name);
                try { n = fx.numProperties; } catch (x) { n = 0; }
                for (i = 1; i <= n; i++) {          // exact, normalised
                    q = null;
                    try { q = fx.property(i); } catch (x) { continue; }
                    if (q && norm(q.name) === want) return q;
                }
                for (i = 1; i <= n; i++) {          // then prefix
                    q = null;
                    try { q = fx.property(i); } catch (x) { continue; }
                    if (q && norm(q.name).indexOf(want) === 0) return q;
                }
            }

            if (idx !== null && idx !== undefined) {
                try { p = fx.property(idx); } catch (x) { p = null; }
                if (p) return p;
            }
            return null;
        },

        set: function (fx, name, idx, val, context) {
            if (!fx) return false;
            var p = this.find(fx, name, idx);
            if (p) {
                try { p.setValue(val); return true; } catch (x) { }
            }
            record((context ? context + " — " : "") + "cannot set '" + name + "'");
            return false;
        },

        /* Set a property nested inside a property group (Colorama's Input
           Phase, Cell Pattern's evolution options, etc). */
        setIn: function (fx, groupName, name, val, context) {
            if (!fx) return false;
            try { fx.property(groupName).property(name).setValue(val); return true; } catch (x) { }
            try { fx.property(name).setValue(val); return true; } catch (x2) { }
            record((context ? context + " — " : "") + "cannot set '" + groupName + " > " + name + "'");
            return false;
        },

        expr: function (fx, name, idx, str, context) {
            if (!fx) return false;
            var p = this.find(fx, name, idx);
            if (p) {
                try { p.expression = str; return true; } catch (x) { }
            }
            record((context ? context + " — " : "") + "cannot express '" + name + "'");
            return false;
        },

        /* Diagnostic: which logical effects are missing on this host.
           Returns an array of logical keys. */
        probe: function () {
            var missing = [], key, list, i, e, ok;
            var probeComp = app.project.items.addComp("LG_PROBE", 32, 32, 1, 1, 24);
            var temp = probeComp.layers.addSolid([0, 0, 0], "LG_PROBE", 32, 32, 1);
            for (key in FX) {
                if (!FX.hasOwnProperty(key)) continue;
                list = FX[key];
                ok = false;
                for (i = 0; i < list.length; i++) {
                    e = null;
                    try { e = temp.Effects.addProperty(list[i]); } catch (x) { e = null; }
                    if (e) { resolved[key] = list[i]; e.remove(); ok = true; break; }
                }
                if (!ok) missing.push(key);
            }
            probeComp.remove();
            return missing;
        }
    };
})();

function openNativeColorPicker(hexStr) {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Please activate a Composition before picking a color (click on the timeline or composition viewer).");
            return "-1";
        }

        app.beginUndoGroup("Color Picker");
        var tempLayer = comp.layers.addShape();
        tempLayer.name = "TEMP_COLOR_PICKER";
        tempLayer.enabled = false;
        
        var colorEffect = tempLayer.Effects.addProperty("ADBE Color Control");
        var colorProp = colorEffect.property("Color");
        
        var rgb = hex2rgb(hexStr);
        if (rgb) {
            colorProp.setValue([rgb[0], rgb[1], rgb[2], 1]);
        }
        
        var originalSelection = comp.selectedLayers;
        for (var i = 1; i <= comp.numLayers; i++) {
            comp.layer(i).selected = false;
        }
        
        tempLayer.selected = true;
        colorProp.selected = true;
        
        try {
            comp.openInViewer(); // Force comp viewer active
            app.executeCommand(2240);
        } catch(cmdErr) {
            alert("Failed to execute AE Color Picker command: " + cmdErr.toString());
            tempLayer.remove();
            app.endUndoGroup();
            return "-1";
        }
        
        var resultRgb = colorProp.value;
        
        tempLayer.remove();
        
        for (var i = 0; i < originalSelection.length; i++) {
            try { originalSelection[i].selected = true; } catch(e) {}
        }
        app.endUndoGroup();

        var r = Math.round(resultRgb[0] * 255).toString(16);
        var g = Math.round(resultRgb[1] * 255).toString(16);
        var b = Math.round(resultRgb[2] * 255).toString(16);
        
        if (r.length < 2) r = "0" + r;
        if (g.length < 2) g = "0" + g;
        if (b.length < 2) b = "0" + b;
        
        return "#" + (r + g + b).toUpperCase();
    } catch(e) {
        alert("Unexpected Color Picker Error: " + e.toString());
        try { app.endUndoGroup(); } catch(undoErr){}
        return "-1";
    }
}
/* Legacy shims. Every historical call site keeps working, but the names
   are now canonicalised by LG and failures are reported instead of lost. */
function addFx(layer, names) {
    return LG.add(layer, names);
}

function sp(fx, name, val) {
    return LG.set(fx, name, null, val);
}

function ex(prop, str) {
    if (!prop) { LG.warn("expression target missing"); return false; }
    try { prop.expression = str; return true; } catch (x) {
        LG.warn("cannot express '" + (prop.name || "?") + "'");
        return false;
    }
}

function getCompLayers() {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) return '[]';
        var arr = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            arr.push(comp.layer(i).name);
        }
        // Very basic manual JSON array building since JSON object might not be available in all AE versions
        var jsonStr = '[';
        for (var i = 0; i < arr.length; i++) {
            jsonStr += '"' + arr[i].replace(/"/g, '\\"') + '"';
            if (i < arr.length - 1) jsonStr += ',';
        }
        jsonStr += ']';
        return jsonStr;
    } catch(e) {
        return '[]';
    }
}

function hexRgb(h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}



/* vibrify() used to sit here, multiplying every picked colour's saturation
   by 1.2 and its value by 1.05 before the build. It was a hidden edit to
   the user's choice: an already-saturated colour clamped at 1.0 and shifted
   hue on the way. Colours now reach After Effects exactly as picked, and
   the Glow control covers the punch it was providing. */

// --- OKLAB COLOR SPACE UTILS ---
function srgbToLinear(c) {
    var a = 0.055;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + a) / (1 + a), 2.4);
}

function linearToSrgb(c) {
    var a = 0.055;
    return c <= 0.0031308 ? 12.92 * c : (1 + a) * Math.pow(c, 1 / 2.4) - a;
}

function rgbToOklab(r, g, b) {
    var lr = srgbToLinear(r);
    var lg = srgbToLinear(g);
    var lb = srgbToLinear(b);

    var l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
    var m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
    var s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

    var l_ = Math.pow(Math.max(0, l), 1/3);
    var m_ = Math.pow(Math.max(0, m), 1/3);
    var s_ = Math.pow(Math.max(0, s), 1/3);

    return [
        0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    ];
}

function oklabToRgb(L, a, b) {
    var l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    var m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    var s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    var l = l_ * l_ * l_;
    var m = m_ * m_ * m_;
    var s = s_ * s_ * s_;

    var lr =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    var lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    var lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    return [
        Math.max(0, Math.min(1, linearToSrgb(lr))),
        Math.max(0, Math.min(1, linearToSrgb(lg))),
        Math.max(0, Math.min(1, linearToSrgb(lb)))
    ];
}

/* Blend two colours without going grey in the middle.

   Oklab on its own does not fix this. Lerping a and b in a straight line is a
   chord across the colour circle, and for two colours on opposite sides of it
   that chord passes through the origin — which is grey, by definition. Red to
   cyan goes red, dull red, grey, dull cyan, cyan. That is the grey band, and
   it is why a designer's habit is to drop a third colour into the middle by
   hand: it forces the path to bend outwards instead of through the centre.

   So take the path the designer would take. Convert a and b to chroma and
   hue, travel around the circle the short way, and carry the chroma across
   rather than letting it collapse. The midpoint of red and cyan comes out a
   saturated magenta or yellow depending on which way round is shorter — a
   colour, which is what was wanted, instead of the absence of one.

   Two colours that genuinely share a hue still interpolate in a straight
   line, because their hue difference is zero and there is no arc to take. */
function interpolateOklab(c1, c2, t) {
    var ok1 = rgbToOklab(c1[0], c1[1], c1[2]);
    var ok2 = rgbToOklab(c2[0], c2[1], c2[2]);

    var L = ok1[0] + (ok2[0] - ok1[0]) * t;

    var C1 = Math.sqrt(ok1[1] * ok1[1] + ok1[2] * ok1[2]);
    var C2 = Math.sqrt(ok2[1] * ok2[1] + ok2[2] * ok2[2]);

    /* A near-neutral has no meaningful hue — its angle is numerical noise —
       so it inherits the other end's hue rather than dragging the blend
       somewhere arbitrary. Greys and whites keep behaving as they should. */
    var FLAT = 0.0005;
    var h1 = (C1 > FLAT) ? Math.atan2(ok1[2], ok1[1]) : null;
    var h2 = (C2 > FLAT) ? Math.atan2(ok2[2], ok2[1]) : null;

    var C = C1 + (C2 - C1) * t;
    var h;

    if (h1 === null && h2 === null) {
        return oklabToRgb(L, 0, 0);                 // both neutral
    } else if (h1 === null) {
        h = h2;
    } else if (h2 === null) {
        h = h1;
    } else {
        var d = h2 - h1;
        var TAU = Math.PI * 2;
        while (d >  Math.PI) d -= TAU;              // the short way round
        while (d < -Math.PI) d += TAU;
        h = h1 + d * t;

        /* Directly opposite hues have no short way round, and a straight lerp
           of chroma would still dip toward grey at the midpoint. Lift the
           middle back to the brighter of the two ends so the transition keeps
           its saturation the whole way across. */
        var lift = 1 + (1 - Math.abs(2 * t - 1)) * (Math.abs(d) / Math.PI);
        C = C * lift;
        if (C > Math.max(C1, C2)) C = Math.max(C1, C2);
    }

    return oklabToRgb(L, Math.cos(h) * C, Math.sin(h) * C);
}
// --------------------------------

function getSelectedGradientState() {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) return '';
        var selected = comp.selectedLayers;
        if (selected.length === 0) return '';
        
        var layer = selected[0];
        if (layer.comment && layer.comment.indexOf('LIVING_GRADIENT_DATA:') === 0) {
            return layer.comment.substring(21);
        }
    } catch(e) {}
    return '';
}

/* One place that knows which builder makes which type.

   Extracted from generateGradient so batch generation runs the exact same
   code path as a single build — a second copy of this switch would drift
   the moment a type was added. Returns nothing; throws on an unknown type
   so callers can report it per-item. */
function dispatchBuild(comp, type, c, controls, w, h, dur) {
    switch (type) {
        case 'living':
            buildLiving(comp, c, controls, w, h, dur);
            break;
        case 'Silk':
        case 'Aurora':
        case 'Prism':
        case 'Fiber':
        case 'Veil':
        case 'Pulse':
        case 'Comet':
            buildSilkFlare(comp, c, controls, w, h, dur, type);
            break;
        case 'ChromaFlare':
            buildChromaFlare(comp, c, controls, w, h, dur);
            break;
        case 'Metallic':
            buildMetallic(comp, c, controls, w, h, dur);
            break;
        case 'Heatmap':
            buildHeatmap(comp, c, controls, w, h, dur);
            break;
        case 'Halftone':
            buildHalftone(comp, c, controls, w, h, dur);
            break;
        case 'AsciiMatrix':
            buildAsciiMatrix(comp, c, controls, w, h, dur);
            break;
        case 'Fluid':
            buildFluid(comp, c, controls, w, h, dur);
            break;
        case 'Glass':
            buildGlass(comp, c, controls, w, h, dur);
            break;
        case 'ReededGlass':
            buildReededGlass(comp, c, controls, w, h, dur);
            break;
        case 'AnimeWater':
            buildAnimeWater(comp, c, controls, w, h, dur);
            break;
        case 'AnimeCells':
            buildAnimeCells(comp, c, controls, w, h, dur);
            break;
        case 'Polished':
        case 'Brushed':
        case 'Gold':
        case 'Copper':
        case 'Gunmetal':
        case 'Hammered':
        case 'Foil':
        case 'Mercury':
            buildMetalTexture(comp, c, controls, w, h, dur, type);
            break;
        case 'Giraffe':
        case 'Tiger':
        case 'Zebra':
        case 'Leopard':
        case 'Cow':
        case 'Fur':
            buildAnimalPrint(comp, c, controls, w, h, dur, type);
            break;
        case 'Sunburst':
            buildSunburst(comp, c, controls, w, h, dur);
            break;
        case 'LiquidWaves':
            buildLiquidWaves(comp, c, controls, w, h, dur);
            break;
        case 'CellularMosaic':
            buildCellularMosaic(comp, c, controls, w, h, dur);
            break;
        case 'TrailGradient':
            buildTrailGradient(comp, c, controls, w, h, dur);
            break;
        case 'Wavy':
            buildWavy(comp, c, controls, w, h, dur);
            break;
        case 'SonduckLiquid':
            buildSonduckLiquid(comp, c, controls, w, h, dur);
            break;
        case 'TwirlShapes':
            buildTwirlShapes(comp, c, controls, w, h, dur);
            break;
        case 'LavaLamp':
            buildLavaLamp(comp, c, controls, w, h, dur);
            break;
        case 'StackedSquares':
            buildStackedSquares(comp, c, controls, w, h, dur);
            break;
        case 'PrismaticBurst':
            buildPrismaticBurst(comp, c, controls, w, h, dur);
            break;
        case 'Antigravity':
            buildAntigravity(comp, c, controls, w, h, dur);
            break;
        case 'Waves':
            buildWaves(comp, c, controls, w, h, dur);
            break;
        case 'WebThreads':
            buildWebThreads(comp, c, controls, w, h, dur);
            break;
        case 'OklabSmooth':
            buildOklabSmooth(comp, c, controls, w, h, dur);
            break;
        default:
            return 'ERROR: Unknown type: ' + type;
    }

}

function generateGradient(paramsStr) {
    try {
        var p = JSON.parse(paramsStr),
            comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) return 'ERROR: No active composition.';
        var w = comp.width,
            h = comp.height,
            dur = comp.duration;
        var c = [];
        for (var i = 0; i < p.colors.length; i++) c.push(hexRgb(p.colors[i]));

        LG.reset();
        applyColorQuality(p.colorQuality === true);

        p.controls = p.controls || {};

        app.beginUndoGroup('Living Gradients');
        var beforeCount = comp.numLayers;

        var unknown = dispatchBuild(comp, p.type, c, p.controls, w, h, dur);
        if (unknown) { app.endUndoGroup(); return unknown; }

        var afterCount = comp.numLayers;
        var addedLayersCount = afterCount - beforeCount;

        var gradientLayer = groupGeneratedLayers(comp, p, addedLayersCount);
        applyGlobalPolish(comp, p, gradientLayer);

        if (p.fluidEnabled && p.fluidLayerName) {
            applyFluidTrail(comp, gradientLayer, p);
        }

        app.endUndoGroup();
        return 'Done: ' + comp.name + LG.report();
    } catch (e) {
        try {
            app.endUndoGroup();
        } catch (x) { }
        return 'ERROR: ' + e.message + ' line ' + e.line + LG.report();
    }
}

/* Muddy gradients in After Effects are almost always the project, not the
   effect stack.

   Two settings do the damage. At 8 bits per channel a smooth ramp across a
   1080p comp has fewer steps than it has pixels, so it bands and the
   dithering reads as grain. And with gamma-space blending, mixing two
   saturated complementary colours drives the midpoint toward grey — the
   classic "muddy middle" on a four-colour gradient.

   Both are project-wide, so this never runs silently: whatever it changes
   is reported back to the panel. */
function applyColorQuality(enabled) {

    /* Bit depth is the user's decision, not ours.

       This used to raise any project under 16 bits per channel on every
       single build, with the toggle defaulting to on — so a machine that
       works in 8-bit on purpose, because 16-bit previews are twice the RAM
       and slower to scrub, got quietly switched every time a gradient was
       made. Plenty of people work in 8-bit and only lift it at render, or
       never. Taking that decision away from them is not a quality feature.

       It is opt-in now, and off unless the user asks for it. The banding it
       guards against is real but it is theirs to trade against speed.

       Note the `=== true`: an absent flag used to mean yes. */
    /* Nothing raises the bit depth any more. The toggle that used to is gone
       from the panel entirely — it was a project-wide setting presented as a
       per-gradient option, which is the wrong shape for it, and plenty of
       people work in 8-bit deliberately. AE's own Project Settings is where
       that decision belongs. */

    /* Linear blending used to be forced on here, and it is the reason so many
       of these gradients came out wrong. It does fix the grey midpoint on a
       four-colour ramp — but it also redefines every blend mode in the
       project, and half of these builds are stacks of blend modes: Halftone
       thresholds with Hard Mix, Cellular Mosaic colours through Color,
       Metallic through Hard Light. Under 1.0 gamma those stop doing what they
       were dialled in to do, and the result is the washed-out and near-black
       renders.

       So the muddy midpoint is fixed where it belongs — in the colours we
       place, via interpolateOklab — and blending is left in the gamma space
       the effect stacks assume. */
    try {
        if (app.project.linearBlending) {
            app.project.linearBlending = false;
            LG.note('linear blending off — these effect stacks blend in gamma space');
        }
    } catch (e) {
        LG.warn('could not set the blending space: ' + e.message);
    }
}

/* Batch generation — one composition per selected type.

   The active comp is used only as a template for size, frame rate, pixel
   aspect and duration; it is never written to. Each type gets its own comp
   inside a "Living Gradients" folder, so a batch is easy to review and easy
   to throw away.

   A type that throws takes its own comp down with it and is reported by
   name. One bad builder must not cost the user the other eleven. */
function generateBatch(paramsStr) {
    var folder = null;
    try {
        var p   = JSON.parse(paramsStr);
        var src = app.project.activeItem;
        if (!src || !(src instanceof CompItem)) return 'ERROR: No active composition to take settings from.';
        if (!p.items || !p.items.length)        return 'ERROR: No gradients selected.';

        LG.reset();
        applyColorQuality(p.colorQuality === true);
        app.beginUndoGroup('Living Gradients — Batch');

        folder = app.project.items.addFolder('Living Gradients');

        var made = [], failed = [], i, j;

        for (i = 0; i < p.items.length; i++) {
            var item = p.items[i];
            var comp = null;

            try {
                comp = app.project.items.addComp(
                    'LG — ' + (item.label || item.type),
                    src.width, src.height, src.pixelAspect, src.duration, src.frameRate);
                comp.parentFolder = folder;

                var c = [];
                for (j = 0; j < item.colors.length; j++) c.push(hexRgb(item.colors[j]));

                var controls = item.controls || {};
                var unknown = dispatchBuild(comp, item.type, c, controls,
                                            src.width, src.height, src.duration);
                if (unknown) throw new Error('unknown type');

                // Grain and glow are batch-wide, so they come off the
                // envelope rather than the per-item controls.
                var polish = {
                    type:     item.type,
                    grain:    p.grain,
                    glow:     p.glow,
                    controls: controls
                };
                var layer = groupGeneratedLayers(comp, polish, comp.numLayers);
                applyGlobalPolish(comp, polish, layer);

                made.push(item.type);
            } catch (itemErr) {
                failed.push(item.type);
                LG.warn(item.type + ': ' + itemErr.message);
                if (comp) { try { comp.remove(); } catch (rmErr) { } }
            }
        }

        // Nothing worked — do not leave an empty folder behind.
        if (!made.length && folder) { try { folder.remove(); } catch (e) { } }

        app.endUndoGroup();

        var msg = 'Created ' + made.length + ' of ' + p.items.length + ' gradients';
        if (failed.length) msg += ' (failed: ' + failed.join(', ') + ')';
        return msg + LG.report();

    } catch (e) {
        try { app.endUndoGroup(); } catch (x) { }
        return 'ERROR: ' + e.message + ' line ' + e.line + LG.report();
    }
}

/* Collapse the layers this build just added into a single layer, so that
   anything applied afterwards (grain, glow, tracking) affects the finished
   gradient rather than whichever element happened to end up on top.
   Returns that layer. */
function groupGeneratedLayers(comp, p, addedLayersCount) {
    if (comp.numLayers === 0) return null;
    if (!addedLayersCount || addedLayersCount < 1) addedLayersCount = 1;
    /* A single-layer build normally stays as it is. Posterize Time is the
       exception: it can only hold a whole animation from outside it, so that
       build gets wrapped too. */
    if (addedLayersCount === 1 && !(p && p.posterize)) return comp.layer(1);

    var indices = [], i;
    for (i = 1; i <= addedLayersCount; i++) indices.push(i);

    var item = null;
    try {
        item = comp.layers.precompose(indices, (p.type || 'Living Gradients') + ' Gradient', true);
    } catch (e) {
        LG.warn('could not group the generated layers: ' + e.message);
        return comp.layer(1);
    }

    // precompose() returns a CompItem; find the layer that represents it.
    for (i = 1; i <= comp.numLayers; i++) {
        if (comp.layer(i).source === item) return comp.layer(i);
    }
    return comp.layer(1);
}

function applyGlobalPolish(comp, p, layer) {
    if (!layer) return;

    try {
        layer.comment = 'LIVING_GRADIENT_DATA:' + JSON.stringify(p);
    } catch (e) {
        LG.warn('could not store settings on the layer comment');
    }

    if (p.grain && p.grain > 0) {
        var noise = addFx(layer, ['ADBE Noise']);
        if (noise) {
            /* Grain is luminance, never colour. Coloured noise reads as a
               broken video signal rather than film, and it is the single
               fastest way to make a gradient look cheap.

               The checkbox is labelled "Use Color Noise" in the interface but
               the DOM calls it "Noise Type" (see tools/effect_probe_report.txt,
               ADBE Noise property 2). Asking for it by the interface label
               missed, and the write only landed because LG.find falls back to
               the index — which is not something to rely on. Ask for it by the
               name the host actually uses, and keep the index as the fallback
               it was meant to be. */
            safeSet(noise, 'Amount of Noise', 1, p.grain);
            if (!safeSet(noise, 'Noise Type', 2, false)) {
                LG.warn('grain: could not force monochrome noise');
            }
            safeSet(noise, 'Clipping', 3, true);
        }
    }

    if (p.glow && p.glow > 0) {
        var glow = addFx(layer, ['ADBE Glo2']);
        if (glow) {
            safeSet(glow, 'Glow Threshold', 2, 100 - (p.glow * 0.5));
            safeSet(glow, 'Glow Radius',    3, p.glow);
            safeSet(glow, 'Glow Intensity', 4, p.glow / 50);
        }
    }

    /* Posterize Time has to sit on the wrapper, not inside it. On a layer that
       carries the effects itself it only holds the source, and everything
       applied after it still evaluates at full comp time — so the gradient
       would keep moving smoothly and only the solid underneath would step.
       groupGeneratedLayers precomposes whenever this is on, so by the time we
       get here the layer is always a precomp and holding it holds the lot. */
    if (p.posterize) {
        var post = findFx(layer, ['ADBE Posterize Time']);
        if (!post) post = addFx(layer, ['ADBE Posterize Time']);
        if (post) {
            try { post.moveTo(1); } catch (e) { }
            LG.set(post, 'Frame Rate', 1, Math.max(1, num(p.posterizeFps, 12)));
        }
    }

}

/* =====================================================================
   PHYSICS TRACKING
   ---------------------------------------------------------------------
   The gradient reacts to a layer moving through it.

   Architecture: simulate, bake, express.

   The simulation runs here in ExtendScript — sample the target's comp-space
   position on every frame, integrate a spring and an energy envelope, and
   write the result as one keyframe per frame onto a control null. Effects on
   the gradient then read that null through single-frame expressions.

   That split is what keeps it smooth. Expression-based physics has to walk
   backwards through valueAtTime() on every evaluation, which gets slower the
   further into the comp you scrub and visibly stutters on long comps. Baked
   keyframes cost nothing at preview time, and a key on every frame means AE
   never interpolates the physics — it plays back exactly as simulated.

   The trade is that the bake is a snapshot. Move the tracked layer and press
   Re-Bake.
   ===================================================================== */


/* Resolve the tracked layer by name. */
/* ── FLUID TRAIL ──────────────────────────────────────────────────────
   A liquid trail that follows a layer, made entirely of native effects, used
   as a luma matte so the gradient underneath is untouched.

   This is the whole feature, and it is about thirty lines, because the fluid
   lab settled two things that had been guesses:

   1. Echo applied DIRECTLY to a moving layer trails. It was supposed not to —
      the usual rule is that effects render before a layer's Transform, so
      Echo should see the layer standing still — but recipes 2, 3 and 4 of the
      lab produced identical trails on this host. So no precompose, no
      adjustment layer, no extra comp. One layer carries the whole thing.

   2. The read that looks like liquid rather than smear is blur-then-reharden.
      A wide blur merges the echo copies into one body; Levels crushed to a
      narrow band cuts a firm edge back into it. That pair is what makes the
      trail pinch and swell and separate the way liquid does. Blur alone —
      lab recipes 5 and 8 — is just a smudge.

   Everything downstream stays live: the gradient is a normal layer, the matte
   is a normal layer, and every builder in the library works with it unchanged
   because none of them know it is there.

   Parameter indices come from tools/fluid_lab_report.txt. */
var FLUID_DEFAULTS = {
    length:    60,     // how far back the trail reaches
    thickness: 100,    // body weight
    wobble:    45,     // organic distortion
    softness:  25,     // edge falloff, 0 = hard cut
    size:      7.5     // emitter diameter, percent of width
};

/* Everything about the trail except the layer it lives on.

   Split out so that dragging a slider re-runs the same code the build ran,
   rather than a second copy of it that can drift. lgFx finds the existing
   effect before adding one, so calling this repeatedly updates in place
   instead of stacking a new Echo on every frame of a drag. */
function tuneFluidTrail(m, o, w) {
    if (!m) return;

    var length = Math.max(1, num(o.length, 60));
    var echo = lgFx(m, ['ADBE Echo']);
    if (echo) {
        /* More, shorter echoes rather than fewer long ones: the lab's stills
           show visible stepping at -0.035s, and the steps are what give a
           trail away as a stack of copies. */
        LG.set(echo, 'Echo Time (seconds)', 1, -0.012);
        LG.set(echo, 'Number Of Echoes',    2, Math.round(length));
        LG.set(echo, 'Starting Intensity',  3, 1);
        LG.set(echo, 'Decay',               4, 0.96);
        LG.set(echo, 'Echo Operator',       5, 3);      // Maximum
    }

    // Blur wide, then cut a firm edge back in. This is the liquid.
    var thickness = num(o.thickness, 100) / 100;
    var blur = lgFx(m, ['ADBE Box Blur2']);
    if (blur) {
        LG.set(blur, 'Blur Radius', 1, w * 0.022 * thickness);
        LG.set(blur, 'Iterations',  2, 3);
        LG.set(blur, 'Repeat Edge Pixels', 4, true);
    }

    var soft = num(o.softness, 25) / 100;
    var lev = lgFx(m, ['ADBE Easy Levels2']);
    if (lev) {
        /* The narrower this band, the harder the surface. Softness widens it,
           which is the difference between mercury and ink in water. */
        var mid = 0.38;
        LG.set(lev, 'Input Black', 3, Math.max(0, mid - 0.02 - soft * 0.22));
        LG.set(lev, 'Input White', 4, Math.min(1, mid + 0.02 + soft * 0.22));
    }

    var wob = num(o.wobble, 45);
    var td = lgFx(m, ['ADBE Turbulent Displace']);
    if (td) {
        lgTurbSet(td, { mode: 1, amount: wob, size: w * 0.09, speed: 14 });
        try { td.enabled = wob > 0; } catch (e) { }
    }

    // The emitter blob, so size stays live too.
    try {
        var el = m.property('Contents').property(1).property('Contents').property(1);
        var d = w * (num(o.size, 7.5) / 100);
        el.property('Size').setValue([d, d]);
    } catch (e) { }
}

function applyFluidTrail(comp, gradientLayer, p) {
    if (!gradientLayer) { LG.warn('fluid: no gradient layer'); return; }

    var target = findTrackTarget(comp, p.fluidLayerName);
    if (!target) {
        LG.warn("fluid: layer '" + p.fluidLayerName + "' not found");
        return;
    }
    if (target === gradientLayer) {
        LG.warn('fluid: the target layer is the gradient itself');
        return;
    }

    var o = lgDefaults(FLUID_DEFAULTS, p.fluid || {});
    var w = comp.width, h = comp.height;

    // ── The emitter: one blob, following the target ──────────────────
    var m = comp.layers.addShape();
    m.name = 'LG Fluid Matte';

    var gc = m.property('Contents')
              .addProperty('ADBE Vector Group').property('Contents');
    var el = gc.addProperty('ADBE Vector Shape - Ellipse');
    var d  = w * (num(o.size, 7.5) / 100);
    try { el.property('Size').setValue([d, d]); } catch (e) { LG.warn('fluid: emitter size'); }

    var fill = gc.addProperty('ADBE Vector Graphic - Fill');
    try { fill.property('Color').setValue([1, 1, 1]); } catch (e) { }

    /* toComp rather than transform.position, for the same reason
       sampleTargetPath uses it: parenting, 3D and anchor offsets all have to
       land, or the trail follows a layer that is not where it looks. */
    try {
        m.property('Transform').property('Position').expression =
            'var t = thisComp.layer("' + target.name + '");\n' +
            'var p = t.toComp(t.anchorPoint);\n' +
            '[p[0], p[1]]';
    } catch (e) {
        LG.warn('fluid: could not follow the target layer');
    }

    tuneFluidTrail(m, o, w);

    // ── Matte the gradient to it ─────────────────────────────────────
    try { m.moveBefore(gradientLayer); } catch (e) { }

    var matted = false;
    try {
        gradientLayer.setTrackMatte(m, TrackMatteType.LUMA);
        matted = true;
    } catch (e) {
        /* Older hosts have no setTrackMatte; there the matte has to be the
           layer directly above and the mode is set on the layer itself. */
        try {
            gradientLayer.trackMatteType = TrackMatteType.LUMA;
            matted = true;
        } catch (e2) {
            LG.warn('fluid: could not apply the track matte');
        }
    }
    if (matted) LG.note('gradient matted to the fluid trail');

    return m;
}

function findTrackTarget(comp, layerName) {
    for (var i = 1; i <= comp.numLayers; i++) {
        if (comp.layer(i).name === layerName) return comp.layer(i);
    }
    return null;
}









/* Track mattes moved to a layer-reference API in AE 2023. Try the modern
   call, then the legacy enum. */
function setTrackMatteSafely(layer, matteLayer, kind) {
    var type = (kind === "LUMA") ? TrackMatteType.LUMA : TrackMatteType.ALPHA;
    try { layer.setTrackMatte(matteLayer, type); return true; } catch (e) { }
    try { layer.trackMatteType = type; return true; } catch (e2) { }
    LG.warn("tracking: could not set the track matte");
    return false;
}


function num(v, fallback) {
    var n = parseFloat(v);
    return (v === undefined || v === null || isNaN(n)) ? fallback : n;
}




// ── 1. OKLAB SMOOTH ──
/* The first card in the library, and it rendered as a plain white-to-black
   ramp with none of the palette in it.

   It was building a shape layer and setting the Gradient Fill's "Colors"
   property from a flat array. That property is CUSTOM_VALUE and setValue does
   not take an array for it, so every stop was rejected and the fill kept AE's
   default — which is white to black. The attempt sat inside an empty catch
   with a comment guessing at version differences, so it never surfaced.

   lgOklabRamp is the way through, and has been in this file all along: a
   black-to-white Gradient Ramp carries the shape and CC Toner maps five
   Oklab-interpolated stops onto it, all through properties scripting can
   actually write. */
function buildOklabSmooth(comp, c, ctrl, w, h, dur) {
    var radial = !!(ctrl.gradientType &&
                    String(ctrl.gradientType).toLowerCase() === 'radial');
    var angle  = (num(ctrl.angle, 0) === 90) ? 90 : 0;

    // The name is what the live recolour path matches on — keep it.
    var s = comp.layers.addSolid([0, 0, 0], 'Oklab Smooth Gradient', w, h, 1, dur);

    lgOklabRamp(s, c, w, h, angle, radial);

    if (ctrl.softness && ctrl.softness > 0) lgBlur(s, num(ctrl.softness, 0));
}

// ── 2. LIVING GRADIENT ── 4-Color Gradient + Motion Tile + Turbulent Displace (from Living Gradients.jsx)
function buildLiving(comp, c, ctrl, w, h, dur) {
    var speed = Math.round(ctrl.speed || 10);
    var turbAmt = ctrl.softness || 250;
    var scaleAmt = ctrl.scale || 400;
    var evolSpd = ctrl.rotation || 70;
    var opacity = ctrl.opacity || 100;

    var s = comp.layers.addSolid([1, 1, 1], 'Living Gradient', w, h, 1);

    // Motion Tile
    var tile = addFx(s, ['ADBE Tile']);
    if (tile) {
        try {
            for (var pi = 1; pi <= tile.numProperties; pi++) {
                var tp = tile.property(pi);
                var tn = (tp.name || '').toLowerCase();
                if (tn.indexOf('width') !== -1) try {
                    tp.setValue(500);
                } catch (e) { }
                if (tn.indexOf('height') !== -1) try {
                    tp.setValue(500);
                } catch (e) { }
                if (tn.indexOf('mirror') !== -1) try {
                    tp.setValue(true);
                } catch (e) { }
            }
        } catch (e) { }
    }

    // 4-Color Gradient
    var g4 = addFx(s, ['4-Color Gradient', '4 Color Gradient', 'ADBE 4-Color Gradient', 'ADBE 4ColorGradient', 'ADBE 4 Color Gradient']);
    if (g4) {
        var ov = Math.max(w, h) * 0.5;
        var corners = [
            [-ov, -ov],
            [w + ov, -ov],
            [-ov, h + ov],
            [w + ov, h + ov]
        ];
        for (var i = 0; i < 4; i++) {
            try {
                var pt = g4.property('Point ' + (i + 1));
                var cp = g4.property('Color ' + (i + 1));
                if (pt && cp) {
                    pt.setValueAtTime(0, corners[i]);
                    pt.setValueAtTime(lgCycleTime(speed), [(Math.random() * (w + ov * 2)) - ov, (Math.random() * (h + ov * 2)) - ov]);
                    ex(pt, 'loopOut("pingpong")');
                    cp.setValue(c[i % c.length]);
                }
            } catch (x) { }
        }
    }

    // Turbulent Displace
    var td = addFx(s, ['ADBE TurbulentDisplace', 'Turbulent Displace']);
    if (td) {
        try {
            td.property('Amount').setValue(turbAmt);
        } catch (e) { }
        try {
            td.property('Size').setValue(scaleAmt);
        } catch (e) { }
        try {
            td.property('Complexity').setValue(2);
        } catch (e) { }
        try {
            td.property('Evolution').expression = 'time * ' + evolSpd;
        } catch (e) { }
    }

    // Opacity
    try {
        s.opacity.setValue(opacity);
    } catch (e) { }
}

// ── 2. SILKFLARE ENGINE ──
function buildSilkFlare(comp, c, ctrl, w, h, dur, presetName) {
    var PRESETS = {
        "Silk": {
            waveType: 6,
            waveHeight: -164,
            waveWidth: 49,
            blur: 45,
            fov: 145.2
        },
        "Aurora": {
            waveType: 1,
            waveHeight: 113,
            waveWidth: 105,
            blur: 60,
            fov: 145.2
        },
        "Prism": {
            waveType: 4,
            waveHeight: 73,
            waveWidth: 31,
            blur: 30,
            fov: 145.9
        },
        "Fiber": {
            waveType: 3,
            waveHeight: 694,
            waveWidth: 20,
            blur: 98,
            fov: 150.4
        },
        "Veil": {
            waveType: 7,
            waveHeight: 200,
            waveWidth: 150,
            blur: 80,
            fov: 145.2
        },
        "Pulse": {
            waveType: 5,
            waveHeight: 300,
            waveWidth: 60,
            blur: 40,
            fov: 145.2
        },
        "Comet": {
            waveType: 6,
            waveHeight: -300,
            waveWidth: 20,
            blur: 70,
            fov: 145.2
        }
    };
    var p = PRESETS[presetName] || PRESETS["Silk"];
    var proj = app.project;

    var blobComp = proj.items.addComp("SilkFlare - Blobs", w, h, 1, dur, comp.frameRate);
    var numBlobs = 28;
    for (var bi = 0; bi < numBlobs; bi++) {
        var blobLayer = blobComp.layers.addShape();
        blobLayer.name = "Blob " + (bi + 1);
        var contents = blobLayer.property("Contents");
        var grp = contents.addProperty("ADBE Vector Group");
        grp.name = "Circle";
        var grpContents = grp.property("Contents");

        var ellipse = grpContents.addProperty("ADBE Vector Shape - Ellipse");
        var blobSize = 400 + Math.random() * 500;
        try {
            ellipse.property("Size").setValue([blobSize, blobSize]);
        } catch (e) {
            try {
                ellipse.property(2).setValue([blobSize, blobSize]);
            } catch (e2) { }
        }

        var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
        var cIdx = Math.floor(Math.random() * c.length);
        try {
            fill.property("Color").setValue(c[cIdx]);
        } catch (e) {
            try {
                fill.property(4).setValue(c[cIdx]);
            } catch (e2) { }
        }

        var bx = (w * -0.1) + Math.random() * (w * 1.2);
        var by = (h * -0.1) + Math.random() * (h * 1.2);
        blobLayer.property("Transform").property("Position").setValue([bx, by]);
    }

    var starComp = proj.items.addComp("SilkFlare - Matte", w, h, 1, dur, comp.frameRate);
    var blobInStar = starComp.layers.add(blobComp);
    blobInStar.name = "Color Blobs";

    var blobBlur = addFx(blobInStar, ["ADBE Box Blur2", "ADBE Fast Box Blur", "Fast Box Blur", "ADBE Gaussian Blur 2"]);
    if (blobBlur) {
        try {
            blobBlur.property(1).setValue(63);
        } catch (e) { }
        try {
            blobBlur.property(2).setValue(3);
        } catch (e) { }
        try {
            blobBlur.property(4).setValue(true);
        } catch (e) { }
    }

    var shapeLayer = starComp.layers.addShape();
    shapeLayer.name = "Matte Shape";
    var shapeContents = shapeLayer.property("Contents");
    var shapeGrp = shapeContents.addProperty("ADBE Vector Group");
    shapeGrp.name = "Shape";
    var shapeGrpContents = shapeGrp.property("Contents");

    var shapeStr = ctrl.shape || "4-Point Star (Default)";
    var path;
    if (shapeStr.indexOf("Star") !== -1 || shapeStr === "Hexagon") {
        path = shapeGrpContents.addProperty("ADBE Vector Shape - Star");
        var typeVal = (shapeStr === "Hexagon") ? 1 : 2;
        var pointsVal = 4;
        if (shapeStr === "5-Point Star") pointsVal = 5;
        if (shapeStr === "Hexagon") pointsVal = 6;
        try {
            path.property("Type").setValue(typeVal);
        } catch (e) {
            try {
                path.property(1).setValue(typeVal);
            } catch (e2) { }
        }
        try {
            path.property("Points").setValue(pointsVal);
        } catch (e) {
            try {
                path.property(2).setValue(pointsVal);
            } catch (e2) { }
        }
        try {
            path.property("Outer Radius").setValue(406);
        } catch (e) {
            try {
                path.property(5).setValue(406);
            } catch (e2) { }
        }
        if (typeVal === 2) {
            var inRad = (shapeStr === "5-Point Star") ? 155 : 203;
            try {
                path.property("Inner Radius").setValue(inRad);
            } catch (e) {
                try {
                    path.property(7).setValue(inRad);
                } catch (e2) { }
            }
        }
    } else if (shapeStr === "Circle" || shapeStr === "Oval") {
        path = shapeGrpContents.addProperty("ADBE Vector Shape - Ellipse");
        var sz = (shapeStr === "Circle") ? [812, 812] : [1000, 600];
        try {
            path.property("Size").setValue(sz);
        } catch (e) {
            try {
                path.property(2).setValue(sz);
            } catch (e2) { }
        }
    } else if (shapeStr === "Square" || shapeStr === "Rectangle") {
        path = shapeGrpContents.addProperty("ADBE Vector Shape - Rect");
        var sz2 = (shapeStr === "Square") ? [812, 812] : [1000, 600];
        try {
            path.property("Size").setValue(sz2);
        } catch (e) {
            try {
                path.property(2).setValue(sz2);
            } catch (e2) { }
        }
    }

    var shapeFill = shapeGrpContents.addProperty("ADBE Vector Graphic - Fill");
    try {
        shapeFill.property("Color").setValue([1, 1, 1]);
    } catch (e) {
        try {
            shapeFill.property(4).setValue([1, 1, 1]);
        } catch (e2) { }
    }

    shapeLayer.property("Transform").property("Position").setValue([w / 2, h / 2]);
    ex(shapeLayer.property("Transform").property("Rotation"), "time * 10");

    shapeLayer.moveBefore(blobInStar);
    try {
        blobInStar.trackMatteType = TrackMatteType.ALPHA;
    } catch (e) {
        try {
            blobInStar.setTrackMatte(shapeLayer, TrackMatteType.ALPHA);
        } catch (e2) { }
    }

    var finalLayer = comp.layers.add(starComp);
    finalLayer.name = "Matte Comp (" + presetName + ")";

    var finalBlur = addFx(finalLayer, ["ADBE Box Blur2", "ADBE Fast Box Blur", "Fast Box Blur", "ADBE Gaussian Blur 2"]);
    if (finalBlur) {
        try {
            finalBlur.property(1).setValue(p.blur);
        } catch (e) { }
        try {
            finalBlur.property(2).setValue(3);
        } catch (e) { }
        try {
            finalBlur.property(4).setValue(true);
        } catch (e) { }
    }

    var waveWarp = addFx(finalLayer, ["ADBE Wave Warp", "Wave Warp", "ADBE Wave Warp2"]);
    if (waveWarp) {
        try {
            waveWarp.property(1).setValue(p.waveType);
        } catch (e) {
            try {
                waveWarp.property("Wave Type").setValue(p.waveType);
            } catch (e2) { }
        }
        try {
            waveWarp.property(2).setValue(p.waveHeight);
        } catch (e) {
            try {
                waveWarp.property("Wave Height").setValue(p.waveHeight);
            } catch (e2) { }
        }
        try {
            waveWarp.property(3).setValue(p.waveWidth);
        } catch (e) {
            try {
                waveWarp.property("Wave Width").setValue(p.waveWidth);
            } catch (e2) { }
        }
        var dir = ctrl.direction !== undefined ? parseFloat(ctrl.direction) : 163;
        try {
            waveWarp.property(4).setValue(dir);
        } catch (e) {
            try {
                waveWarp.property("Direction").setValue(dir);
            } catch (e2) { }
        }
        var spd = ctrl.speed !== undefined ? parseFloat(ctrl.speed) : 0.3;
        try {
            waveWarp.property(5).setValue(spd);
        } catch (e) {
            try {
                waveWarp.property("Wave Speed").setValue(spd);
            } catch (e2) { }
        }
        try {
            waveWarp.property(6).setValue(1);
        } catch (e) {
            try {
                waveWarp.property("Pinning").setValue(1);
            } catch (e2) { }
        }
        try {
            waveWarp.property(7).setValue(0);
        } catch (e) {
            try {
                waveWarp.property("Phase").setValue(0);
            } catch (e2) { }
        }
    }

    var optics = addFx(finalLayer, ["ADBE Optics Compensation", "Optics Compensation"]);
    if (optics) {
        try {
            optics.property(1).setValue(p.fov);
        } catch (e) {
            try {
                optics.property("Field Of View (FOV)").setValue(p.fov);
            } catch (e2) { }
        }
        try {
            optics.property(2).setValue(true);
        } catch (e) {
            try {
                optics.property("Reverse Lens Distortion").setValue(true);
            } catch (e2) { }
        }
        try {
            optics.property(3).setValue(1);
        } catch (e) {
            try {
                optics.property("FOV Orientation").setValue(1);
            } catch (e2) { }
        }
        try {
            optics.property(4).setValue([w / 2, h / 2]);
        } catch (e) {
            try {
                optics.property("View Center").setValue([w / 2, h / 2]);
            } catch (e2) { }
        }
    }
}

// ── 3. REALTIME UPDATE ──
// ChromaFlare uses normal shape fills for color so the CEP color pickers can update it safely.
function setFxValue(fx, idx, name, val) {
    if (!fx) return false;
    try { fx.property(idx).setValue(val); return true; } catch (e) { }
    return LG.set(fx, name, null, val);
}

function findFx(layer, names) {
    try {
        var effects = layer.property("Effects");
        for (var i = 0; i < names.length; i++) {
            var fx = effects.property(names[i]);
            if (fx) return fx;
        }
        for (var ei = 1; ei <= effects.numProperties; ei++) {
            var ef = effects.property(ei);
            for (var ni = 0; ni < names.length; ni++) {
                if (ef.name === names[ni] || ef.matchName === names[ni]) return ef;
            }
        }
    } catch (e) { }
    return null;
}

function makeChromaStarLayer(comp, starPoints, rotSpeed) {
    var layer = comp.layers.addShape();
    layer.name = "ChromaFlare Rotating Star Matte";

    var contents = layer.property("Contents");
    var grp = contents.addProperty("ADBE Vector Group");
    grp.name = "Star";
    var gc = grp.property("Contents");
    var star = gc.addProperty("ADBE Vector Shape - Star");

    try {
        star.property("Type").setValue(2);
    } catch (e) {
        try {
            star.property(1).setValue(2);
        } catch (e2) { }
    }
    try {
        star.property("Points").setValue(starPoints);
    } catch (e) {
        try {
            star.property(2).setValue(starPoints);
        } catch (e2) { }
    }
    try {
        star.property("Outer Radius").setValue(285);
    } catch (e) {
        try {
            star.property(5).setValue(285);
        } catch (e2) { }
    }
    try {
        star.property("Inner Radius").setValue(112);
    } catch (e) {
        try {
            star.property(7).setValue(112);
        } catch (e2) { }
    }

    var fill = gc.addProperty("ADBE Vector Graphic - Fill");
    try {
        fill.property("Color").setValue([1, 1, 1]);
    } catch (e) {
        try {
            fill.property(4).setValue([1, 1, 1]);
        } catch (e2) { }
    }

    layer.property("Transform").property("Position").setValue([comp.width / 2, comp.height / 2]);
    ex(layer.property("Transform").property("Rotation"), "time * " + rotSpeed);
    return layer;
}

function applyChromaMatteEffects(layer, direction, speed) {
    var blur = addFx(layer, ["ADBE Box Blur2", "ADBE Fast Box Blur", "Fast Box Blur", "ADBE Gaussian Blur 2"]);
    if (blur) {
        try {
            blur.property(1).setValue(80);
        } catch (e) { }
        try {
            blur.property(2).setValue(3);
        } catch (e2) { }
        try {
            blur.property(3).setValue(1);
        } catch (e3) { }
        try {
            blur.property(4).setValue(true);
        } catch (e4) { }
    }

    var wave = addFx(layer, ["ADBE Wave Warp", "Wave Warp", "ADBE Wave Warp2"]);
    if (wave) {
        setFxValue(wave, 1, "Wave Type", 6);
        setFxValue(wave, 2, "Wave Height", 200);
        setFxValue(wave, 3, "Wave Width", 70);
        setFxValue(wave, 4, "Direction", direction);
        setFxValue(wave, 5, "Wave Speed", speed);
        setFxValue(wave, 6, "Pinning", 2);
        setFxValue(wave, 7, "Phase", 0);
        setFxValue(wave, 8, "Antialiasing", 1);
    }
}

function applyChromaArcWarp(layer, bend, horiz, vert) {
    var warp = addFx(layer, ["ADBE Warp", "Warp"]);
    if (warp) {
        setFxValue(warp, 1, "Warp Style", 1);
        setFxValue(warp, 2, "Warp Axis", 1);
        setFxValue(warp, 3, "Bend", bend);
        setFxValue(warp, 4, "Horizontal Distortion", horiz);
        setFxValue(warp, 5, "Vertical Distortion", vert);
    }
}

function setChromaFinalTransform(layer, w, h, scaleVal, rotationVal) {
    layer.property("Transform").property("Position").setValue([w / 2, h / 2]);
    layer.property("Transform").property("Rotation").setValue(rotationVal);
    layer.property("Transform").property("Scale").setValue(scaleVal);
}

function buildChromaFlare(comp, c, ctrl, w, h, dur) {
    var proj = app.project;
    var fps = comp.frameRate;
    var rotSpeed = ctrl.rotationSpeed !== undefined ? parseFloat(ctrl.rotationSpeed) : 50;
    var waveSpeed = ctrl.speed !== undefined ? parseFloat(ctrl.speed) : 0.7;
    var direction = ctrl.direction !== undefined ? parseFloat(ctrl.direction) : 140;
    var bend = ctrl.bend !== undefined ? parseFloat(ctrl.bend) : 72;
    var horiz = ctrl.horizontalDistort !== undefined ? parseFloat(ctrl.horizontalDistort) : 94;
    var vert = ctrl.verticalDistort !== undefined ? parseFloat(ctrl.verticalDistort) : -29;
    var starText = ctrl.star || "4-Point Star";
    var starPoints = 4;
    if (starText.indexOf("5") === 0) starPoints = 5;
    if (starText.indexOf("6") === 0) starPoints = 6;

    var blobComp = proj.items.addComp("ChromaFlare - Color Blobs", w, h, 1, dur, fps);
    var numBlobs = 34;
    for (var bi = 0; bi < numBlobs; bi++) {
        var blobLayer = blobComp.layers.addShape();
        blobLayer.name = "Blob " + (bi + 1);
        var contents = blobLayer.property("Contents");
        var grp = contents.addProperty("ADBE Vector Group");
        grp.name = "Color";
        var grpContents = grp.property("Contents");

        var ellipse = grpContents.addProperty("ADBE Vector Shape - Ellipse");
        var blobW = 420 + Math.random() * 760;
        var blobH = 260 + Math.random() * 520;
        try {
            ellipse.property("Size").setValue([blobW, blobH]);
        } catch (e) {
            try {
                ellipse.property(2).setValue([blobW, blobH]);
            } catch (e2) { }
        }

        var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
        var cIdx = bi % c.length;
        try {
            fill.property("Color").setValue(c[cIdx]);
        } catch (e3) {
            try {
                fill.property(4).setValue(c[cIdx]);
            } catch (e4) { }
        }

        var bx = (w * -0.15) + Math.random() * (w * 1.3);
        var by = (h * -0.15) + Math.random() * (h * 1.3);
        blobLayer.property("Transform").property("Position").setValue([bx, by]);
        blobLayer.property("Transform").property("Rotation").setValue(-35 + Math.random() * 70);
    }

    var matteComp = proj.items.addComp("ChromaFlare - Alpha Matte", w, h, 1, dur, fps);
    var starLayer = makeChromaStarLayer(matteComp, starPoints, rotSpeed);
    applyChromaMatteEffects(starLayer, direction, waveSpeed);

    var colorSourceComp = proj.items.addComp("ChromaFlare - Color Source", w, h, 1, dur, fps);
    var colorLayer = colorSourceComp.layers.add(blobComp);
    colorLayer.name = "Color Blobs";
    var colorBlur = addFx(colorLayer, ["ADBE Box Blur2", "ADBE Fast Box Blur", "Fast Box Blur", "ADBE Gaussian Blur 2"]);
    if (colorBlur) {
        try {
            colorBlur.property(1).setValue(55);
        } catch (e5) { }
        try {
            colorBlur.property(2).setValue(3);
        } catch (e6) { }
        try {
            colorBlur.property(4).setValue(true);
        } catch (e7) { }
    }

    var matteLayer = colorSourceComp.layers.add(matteComp);
    matteLayer.name = "ChromaFlare Alpha Matte";
    try {
        colorLayer.setTrackMatte(matteLayer, TrackMatteType.ALPHA);
    } catch (e8) {
        try {
            colorLayer.trackMatteType = TrackMatteType.ALPHA;
        } catch (e9) { }
    }

    var finalComp = proj.items.addComp("ChromaFlare - Final Gradients", w, h, 1, dur, fps);
    var base = finalComp.layers.add(colorSourceComp);
    base.name = "ChromaFlare Color Source";
    setChromaFinalTransform(base, w, h, [100, 100], 90);
    applyChromaArcWarp(base, bend, horiz, vert);

    var dupe = finalComp.layers.add(colorSourceComp);
    dupe.name = "ChromaFlare Color Source 2";
    setChromaFinalTransform(dupe, w, h, [-100, -100], 90);
    applyChromaArcWarp(dupe, bend, horiz, vert);

    var finalLayer = comp.layers.add(finalComp);
    finalLayer.name = "ChromaFlare Final Gradient";
}

function buildFluid(comp, c, ctrl, w, h, dur) {
    var twirlAngle = ctrl.twirlAngle !== undefined ? parseFloat(ctrl.twirlAngle) : 1;
    var twirlRadius = ctrl.twirlRadius !== undefined ? parseFloat(ctrl.twirlRadius) : 30;
    var waveHeight = ctrl.waveHeight !== undefined ? parseFloat(ctrl.waveHeight) : 500;
    var waveWidth = ctrl.waveWidth !== undefined ? parseFloat(ctrl.waveWidth) : 660;
    var waveSpeed = ctrl.waveSpeed !== undefined ? parseFloat(ctrl.waveSpeed) : 0.2;
    var waveDirection = ctrl.waveDirection !== undefined ? parseFloat(ctrl.waveDirection) : 45;
    var noiseAmount = ctrl.noiseAmount !== undefined ? parseFloat(ctrl.noiseAmount) : 4;
    var waveTypeStr = ctrl.waveType || 'Circle';

    var waveTypeMap = {
        'Sine': 1, 'Square': 2, 'Triangle': 3, 'Sawtooth': 4,
        'Circle': 5, 'Semicircle': 6, 'Smooth Noise': 7, 'Noise': 8
    };
    var waveTypeVal = waveTypeMap[waveTypeStr] || 5;

    var s = comp.layers.addSolid([1, 1, 1], 'Fluid Gradient', w, h, dur);

    // 4-Color Gradient
    var speed = 10;
    var g4 = addFx(s, ['4-Color Gradient', '4 Color Gradient', 'ADBE 4-Color Gradient', 'ADBE 4ColorGradient']);
    if (g4) {
        var ov = Math.max(w, h) * 0.5;
        var corners = [[-ov, -ov], [w + ov, -ov], [-ov, h + ov], [w + ov, h + ov]];
        for (var i = 0; i < 4; i++) {
            try {
                var pt = g4.property('Point ' + (i + 1));
                var cp = g4.property('Color ' + (i + 1));
                if (pt && cp) {
                    pt.setValueAtTime(0, corners[i]);
                    pt.setValueAtTime(lgCycleTime(speed), [(Math.random() * (w + ov * 2)) - ov, (Math.random() * (h + ov * 2)) - ov]);
                    ex(pt, 'loopOut("pingpong")');
                    cp.setValue(c[i % c.length]);
                }
            } catch (x) { }
        }
    }

    // Twirl
    var twirl = addFx(s, ['ADBE Twirl', 'Twirl']);
    if (twirl) {
        try { twirl.property("Angle").setValue(twirlAngle * 360); } catch(e) {
            try { twirl.property(1).setValue(twirlAngle * 360); } catch(e2){}
        }
        try { twirl.property("Twirl Radius").setValueAtTime(0, 15); } catch(e) {
            try { twirl.property(2).setValueAtTime(0, 15); } catch(e2){}
        }
        try { twirl.property("Twirl Radius").setValueAtTime(lgCycleTime(speed), twirlRadius); } catch(e) {
            try { twirl.property(2).setValueAtTime(lgCycleTime(speed), twirlRadius); } catch(e2){}
        }
    }

    // Motion Tile
    var tile1 = addFx(s, ['ADBE Tile']);
    if (tile1) {
        safeSet(tile1, "Output Width", 1, 300);
        safeSet(tile1, "Output Height", 2, 300);
        safeSet(tile1, "Mirror Edges", 3, true);
    }

    // Waves (Wave Warp)
    var waveWarp = addFx(s, ["ADBE Wave Warp", "Wave Warp", "ADBE Wave Warp2"]);
    if (waveWarp) {
        safeSet(waveWarp, "Wave Type", 1, waveTypeVal);
        safeSet(waveWarp, "Wave Height", 2, waveHeight);
        try { waveWarp.property("Wave Width").setValueAtTime(0, 460); } catch(e) {
            try { waveWarp.property(3).setValueAtTime(0, 460); } catch(e2){}
        }
        try { waveWarp.property("Wave Width").setValueAtTime(lgCycleTime(speed), waveWidth); } catch(e) {
            try { waveWarp.property(3).setValueAtTime(lgCycleTime(speed), waveWidth); } catch(e2){}
        }
        safeSet(waveWarp, "Direction", 4, waveDirection);
        safeSet(waveWarp, "Wave Speed", 5, waveSpeed);
    }

    // Noise
    var noise = addFx(s, ["ADBE Noise", "Noise"]);
    if (noise) {
        safeSet(noise, "Amount of Noise", 1, noiseAmount);
        safeSet(noise, "Use Color Noise", 2, false);
    }

    // Motion Tile (Second)
    var tile2 = addFx(s, ['ADBE Tile']);
    if (tile2) {
        safeSet(tile2, "Output Width", 1, 300);
        safeSet(tile2, "Output Height", 2, 300);
        safeSet(tile2, "Mirror Edges", 3, true);
    }
}

function updateChromaNestedControls(src, ctrl, depth) {
    if (!src || !(src instanceof CompItem) || depth > 5) return;

    var rotSpeed = ctrl.rotationSpeed !== undefined ? parseFloat(ctrl.rotationSpeed) : 50;
    var waveSpeed = ctrl.speed !== undefined ? parseFloat(ctrl.speed) : 0.7;
    var direction = ctrl.direction !== undefined ? parseFloat(ctrl.direction) : 140;
    var bend = ctrl.bend !== undefined ? parseFloat(ctrl.bend) : 72;
    var horiz = ctrl.horizontalDistort !== undefined ? parseFloat(ctrl.horizontalDistort) : 94;
    var vert = ctrl.verticalDistort !== undefined ? parseFloat(ctrl.verticalDistort) : -29;

    for (var i = 1; i <= src.numLayers; i++) {
        var layer = src.layer(i);
        if (layer.name.indexOf("ChromaFlare Color Source") !== -1) {
            var warp = findFx(layer, ["Warp", "ADBE Warp"]);
            if (warp) {
                setFxValue(warp, 3, "Bend", bend);
                setFxValue(warp, 4, "Horizontal Distortion", horiz);
                setFxValue(warp, 5, "Vertical Distortion", vert);
            }
        }

        if (layer.name === "ChromaFlare Rotating Star Matte") {
            ex(layer.property("Transform").property("Rotation"), "time * " + rotSpeed);
            var wave = findFx(layer, ["Wave Warp", "ADBE Wave Warp", "ADBE Wave Warp2"]);
            if (wave) {
                setFxValue(wave, 4, "Direction", direction);
                setFxValue(wave, 5, "Wave Speed", waveSpeed);
            }
        }

        try {
            if (layer.source && layer.source instanceof CompItem) {
                updateChromaNestedControls(layer.source, ctrl, depth + 1);
            }
        } catch (e) { }
    }
}

/* Flatten a comp and everything nested inside it into one list of layers. */
function lgAllLayers(comp, depth, out) {
    out = out || [];
    if (!comp || !(comp instanceof CompItem) || depth < 0) return out;
    for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layer(i);
        out.push(layer);
        if (depth > 0 && layer.source && layer.source instanceof CompItem) {
            lgAllLayers(layer.source, depth - 1, out);
        }
    }
    return out;
}

/* A comp-shaped view of that list, so `for (i = 1; i <= comp.numLayers; i++)`
   walks the whole tree unchanged. */
function lgScope(comp) {
    var flat = lgAllLayers(comp, 5, []);
    return {
        numLayers: flat.length,
        layer: function (i) { return flat[i - 1]; }
    };
}

/* Nothing selected is the ordinary state after a click anywhere else in the
   timeline, and the panel should still be driving the gradient it just made.
   Every generated layer carries a LIVING_GRADIENT_DATA comment, so that is
   the fallback rather than giving up. */
function lgTaggedLayers(comp) {
    var out = [], i, l;
    if (!comp || !(comp instanceof CompItem)) return out;
    for (i = 1; i <= comp.numLayers; i++) {
        l = comp.layer(i);
        try {
            if (l.comment && l.comment.indexOf('LIVING_GRADIENT_DATA:') === 0) out.push(l);
        } catch (e) { }
    }
    return out;
}

function lgColorsOf(p) {
    var out = [], i, src = (p && p.colors) ? p.colors : [];
    for (i = 0; i < src.length; i++) out.push(hexRgb(src[i]));
    while (out.length < 4) out.push([0.5, 0.5, 0.5]);
    return out;
}

/* Kept under its historical name so nothing that still calls it breaks. */
function updateSilkFlareWave(paramsStr) {
    return updateGradientLive(paramsStr);
}

function updateGradientLive(paramsStr) {
    try {
        var ctrl = JSON.parse(paramsStr);
        var realComp = app.project.activeItem;
        if (!realComp || !(realComp instanceof CompItem)) return;
        var selectedLayers = realComp.selectedLayers;
        if (selectedLayers.length === 0) selectedLayers = lgTaggedLayers(realComp);
        if (selectedLayers.length === 0) return;

        app.beginUndoGroup("Update Global Settings");
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            try {
                layer.comment = 'LIVING_GRADIENT_DATA:' + paramsStr;
            } catch(e) {}

            // Grain
            if (ctrl.grain !== undefined) {
                var noise = layer.property("Effects").property("Noise");
                if (!noise) {
                    try { noise = layer.property("Effects").property("ADBE Noise"); } catch(e) {}
                }
                
                if (!noise && ctrl.grain > 0) {
                    try { 
                        noise = layer.property("Effects").addProperty("ADBE Noise"); 
                        noise.property("Use Color Noise").setValue(false);
                    } catch(e) {}
                }
                
                if (noise) {
                    try {
                        if (ctrl.grain === 0) {
                            noise.enabled = false;
                        } else {
                            noise.enabled = true;
                            noise.property("Amount of Noise").setValue(ctrl.grain);
                        }
                    } catch(e) {}
                }
            }

            // Glow
            if (ctrl.glow !== undefined) {
                var glow = null;
                try { glow = layer.property("Effects").property("Glow"); } catch(e) {}

                if (!glow && ctrl.glow > 0) {
                    glow = addFx(layer, ['ADBE Glo2']);
                    if (glow) { try { glow.name = "Glow"; } catch(e) {} }
                }
                
                if (glow) {
                    try {
                        if (ctrl.glow === 0) {
                            glow.enabled = false;
                        } else {
                            glow.enabled = true;
                            glow.property("Glow Radius").setValue(ctrl.glow);
                            glow.property("Glow Intensity").setValue(ctrl.glow / 50);
                            glow.property("Glow Threshold").setValue(100 - (ctrl.glow * 0.5));
                        }
                    } catch(e) {}
                }
            }

            /* Posterize Time. Toggling it here holds whatever the layer
               renders; on a single-layer gradient that is the solid rather
               than the finished animation, so the toggle only fully takes
               once the gradient has been regenerated and wrapped. */
            var post = findFx(layer, ['ADBE Posterize Time']);
            if (ctrl.posterize) {
                if (!post) post = addFx(layer, ['ADBE Posterize Time']);
                if (post) {
                    post.enabled = true;
                    LG.set(post, 'Frame Rate', 1, Math.max(1, num(ctrl.posterizeFps, 12)));
                }
            } else if (post) {
                try { post.enabled = false; } catch (e) { }
            }
        }
        app.endUndoGroup();

        /* Every build is precomposed into one "<Type> Gradient" layer before
           the panel sees it again, and several builds nest further than that
           — Reeded Glass is three deep. The handlers below all search by
           layer name against comp.layer(i), and at the top level of the
           active comp there is nothing to find but the wrapper, which is why
           dragging a slider appeared to do nothing at all. lgScope hands them
           a comp-shaped view of the entire tree, so every handler below
           became recursive without any of them changing. */
        var comp = lgScope(realComp);
        var lctrl = ctrl.controls || ctrl;
        var lcols = lgColorsOf(ctrl);

        /* Types on the shared greyscale-then-colour path. Build and live
           update run the same tune* function, so a slider cannot mean one
           thing when the layer is created and another when it is dragged. */
        /* The fluid trail is not a property of any one gradient — every
           gradient can wear it — so it updates before the per-type dispatch
           below rather than inside it. Without this the sliders did nothing
           until the gradient was re-applied, which made them useless. */
        if (ctrl.fluid) {
            for (var fi = 1; fi <= comp.numLayers; fi++) {
                if (comp.layer(fi).name === 'LG Fluid Matte') {
                    tuneFluidTrail(comp.layer(fi), lgDefaults(FLUID_DEFAULTS, ctrl.fluid),
                                   realComp.width);
                }
            }
        }

        var LIVE_TUNERS = {
            LiquidWaves:    { layer: 'Liquid Waves',    fn: tuneLiquidWaves },
            Metallic:       { layer: 'Metallic',        fn: tuneMetallic },
            CellularMosaic: { layer: 'Cellular Mosaic', fn: tuneCellularMosaic },
            AnimeWater:     { layer: 'Anime Water',     fn: tuneAnimeWater },
            AnimeCells:     { layer: 'Anime Cells',     fn: tuneAnimeCells }
        };

        /* Animal prints share one tuner, so they are registered by loop
           rather than five near-identical lines. */
        (function () {
            var names = ['Giraffe', 'Tiger', 'Zebra', 'Leopard', 'Cow', 'Fur'], i;
            for (i = 0; i < names.length; i++) {
                LIVE_TUNERS[names[i]] = (function (species) {
                    return {
                        layer: species + ' Print',
                        fn: function (layer, cols, lc) {
                            tuneAnimalPrint(layer, cols, lc, species);
                        }
                    };
                })(names[i]);
            }
        })();
        if (LIVE_TUNERS[ctrl.type]) {
            var tuner = LIVE_TUNERS[ctrl.type];
            app.beginUndoGroup('Update ' + tuner.layer);
            for (var ti = 1; ti <= comp.numLayers; ti++) {
                if (comp.layer(ti).name === tuner.layer) tuner.fn(comp.layer(ti), lcols, lctrl);
            }
            app.endUndoGroup();
            return;
        }

        /* The shaded metals and the frosted glass are two layers each, and one
           of the two lives in a comp of its own, so they cannot ride the
           single-layer table above. A slider that only ever reached the
           picture and never the height field would move the colour and leave
           the surface exactly as it was — Relief, Brush Length and Crumple all
           live on the map, not on what you can see. */
        var SHADED = { Polished: 1, Brushed: 1, Gold: 1, Copper: 1,
                       Gunmetal: 1, Hammered: 1, Foil: 1, Mercury: 1 };
        if (SHADED[ctrl.type]) {
            var kind = ctrl.type;
            app.beginUndoGroup('Update ' + kind);
            var metalLayer = null, heightLayer = null, mi2;
            for (mi2 = 1; mi2 <= comp.numLayers; mi2++) {
                var ml = comp.layer(mi2);
                if (ml.name === kind + ' Metal')  metalLayer = ml;
                else if (ml.name === kind + ' Height') heightLayer = ml;
            }
            if (heightLayer && heightLayer.source && heightLayer.source instanceof CompItem
                && heightLayer.source.numLayers > 0) {
                tuneMetalHeight(heightLayer.source.layer(1), lctrl, kind);
            }
            if (metalLayer) {
                tuneMetalSurface(metalLayer, lcols, lctrl, kind,
                                 heightLayer ? heightLayer.index : 0);
            }
            app.endUndoGroup();
            return;
        }

        if (ctrl.type === 'Glass') {
            app.beginUndoGroup('Update Frosted Glass');
            var glassColour = null, glassSurface = null, gi;
            for (gi = 1; gi <= comp.numLayers; gi++) {
                var gl = comp.layer(gi);
                if (gl.name === 'Glass Colour')  glassColour = gl;
                else if (gl.name === 'Glass Surface') glassSurface = gl;
            }
            if (glassSurface && glassSurface.source && glassSurface.source instanceof CompItem
                && glassSurface.source.numLayers > 0) {
                tuneGlassSurface(glassSurface.source.layer(1), lctrl);
            }
            if (glassColour) {
                tuneGlass(glassColour, lcols, lctrl,
                          glassSurface ? glassSurface.index : 0);
            }
            app.endUndoGroup();
            return;
        }

        if (ctrl.type === 'Sunburst') {
            app.beginUndoGroup('Update Sunburst');
            for (var si = 1; si <= comp.numLayers; si++) {
                var sl = comp.layer(si);
                if (sl.name === 'Sunburst Rays') {
                    tuneSunburst(sl, lctrl, realComp.width, realComp.height);
                } else if (sl.name === 'Sunburst Colour') {
                    lgGradientPoints(findFx(sl, ['ADBE 4ColorGradient']),
                                     lgRayColors(lcols), realComp.width, realComp.height, 20);
                }
            }
            app.endUndoGroup();
            return;
        }

        if (ctrl.type === 'ReededGlass') {
            var upright = (lctrl.orientation || 'Vertical') !== 'Horizontal';
            var refract = num(lctrl.refraction, 90);
            app.beginUndoGroup('Update Reeded Glass');
            for (var ri = 1; ri <= comp.numLayers; ri++) {
                var rl = comp.layer(ri);
                if (rl.name === 'Reeded Colour') {
                    tuneReededColour(rl, lcols, lctrl);
                } else if (rl.name === 'Reeded Glass') {
                    var rdisp = findFx(rl, ['ADBE Displacement Map']);
                    if (rdisp) {
                        LG.set(rdisp, 'Max Horizontal Displacement', 3, upright ? refract : 0);
                        LG.set(rdisp, 'Max Vertical Displacement',   5, upright ? 0 : refract);
                    }
                    lgBlur(rl, num(lctrl.blur, 6));
                } else if (rl.name === 'Reeded Sheen') {
                    try { rl.opacity.setValue(num(lctrl.sheen, 45)); } catch (e) { }
                }
            }
            app.endUndoGroup();
            return;
        }

        if (ctrl.type === "ChromaFlare") {
            var cctrl = ctrl.controls || ctrl;
            app.beginUndoGroup("Update ChromaFlare Controls");
            for (var ci = 1; ci <= comp.numLayers; ci++) {
                var clayer = comp.layer(ci);
                if (clayer.name.indexOf("ChromaFlare Final Gradient") !== -1 && clayer.source && clayer.source instanceof CompItem) {
                    updateChromaNestedControls(clayer.source, cctrl, 0);
                }
            }
            app.endUndoGroup();
            return;
        }

        if (ctrl.type === "Heatmap") {
            var hctrl = ctrl.controls || ctrl;
            app.beginUndoGroup("Update Heatmap Controls");
            for (var hi = 1; hi <= comp.numLayers; hi++) {
                var hlayer = comp.layer(hi);
                if (hlayer.name === "Heatmap Base") {
                    var noise = null;
                    try { noise = hlayer.property("Effects").property("Fractal Noise") || hlayer.property("Effects").property("ADBE FractalNoise"); } catch (e) { }
                    if (noise) {
                        if (hctrl.contrast !== undefined) {
                            try { noise.property("Contrast").setValue(parseFloat(hctrl.contrast)); } catch (e) {
                                try { noise.property(4).setValue(parseFloat(hctrl.contrast)); } catch (e2) { }
                            }
                        }
                        if (hctrl.noiseScale !== undefined) {
                            safeSet(noise, "Scale", 10, parseFloat(hctrl.noiseScale));
                        }
                        if (hctrl.speed !== undefined) {
                            try { noise.property("Evolution").expression = "time * " + parseFloat(hctrl.speed); } catch (e) {
                                try { noise.property(10).expression = "time * " + parseFloat(hctrl.speed); } catch (e2) { }
                            }
                        }
                    }
                }
            }
            app.endUndoGroup();
            return;
        }

        if (ctrl.type === "Halftone") {
            /* Dot size and dot shape are comp geometry and still need a
               rebuild. Everything else is live. */
            var hspeed = num(lctrl.speed, 30);
            app.beginUndoGroup("Update Halftone");
            for (var hi = 1; hi <= comp.numLayers; hi++) {
                var hl = comp.layer(hi);
                if (hl.name === "Halftone Luma") {
                    tuneHalftoneField(hl, lctrl, realComp.width, realComp.height);
                } else if (hl.name === "Screen") {
                    try { hl.property('Transform').property('Rotation').setValue(num(lctrl.angle, 45)); } catch (e) { }
                } else if (hl.name === "Threshold") {
                    tuneHalftoneThreshold(hl, num(lctrl.coverage, 128), num(lctrl.edge, 82));
                } else if (hl.name === "Halftone Color") {
                    tuneHalftoneInk(hl, lcols, lctrl, realComp.width, realComp.height);
                }
            }
            app.endUndoGroup();
            return;
        }
        if (ctrl.type === "AsciiMatrix") {
            var amctrl = ctrl.controls || ctrl;
            app.beginUndoGroup("Update ASCII Matrix Controls");

            // Live update for speed
            for (var i = 1; i <= app.project.numItems; i++) {
                var item = app.project.item(i);
                if (item instanceof CompItem) {
                    if (item.name === "ASCII Luma Map") {
                        var lumaSolid = item.layer("Fluid Gradient");
                        if (lumaSolid) {
                            var turb = findFx(lumaSolid, ["Turbulent Displace", "ADBE Turbulent Displace"]);
                            if (turb && amctrl.speed !== undefined) {
                                safeEx(turb, "Evolution", 5, "time * " + (parseFloat(amctrl.speed) * 2));
                            }
                        }
                    }
                }
            }

            for (var l = 1; l <= comp.numLayers; l++) {
                var cLayer = comp.layer(l);
                if (cLayer.name === "ASCII Color Overlay") {
                    var cTurb = findFx(cLayer, ["Turbulent Displace", "ADBE Turbulent Displace"]);
                    if (cTurb && amctrl.speed !== undefined) {
                        safeEx(cTurb, "Evolution", 5, "time * " + (parseFloat(amctrl.speed) * 2));
                    }
                }
            }
            app.endUndoGroup();
            return;
        }

        if (ctrl.type === "Wavy") {
            var wctrl = ctrl.controls || ctrl;
            app.beginUndoGroup("Update Wavy Controls");
            for (var i = 1; i <= comp.numLayers; i++) {
                var layer = comp.layer(i);
                if (layer.name === "Wavy Gradient") {
                    var wave = findFx(layer, ["Wave Warp", "ADBE Wave Warp", "ADBE Wave Warp2"]);
                    if (wave) {
                        var waveTypeMap = { 'Sine': 1, 'Square': 2, 'Triangle': 3, 'Sawtooth': 4, 'Circle': 5, 'Semicircle': 6 };
                        if (wctrl.waveType !== undefined) safeSet(wave, "Wave Type", 1, waveTypeMap[wctrl.waveType] || 4);
                        if (wctrl.waveHeight !== undefined) safeSet(wave, "Wave Height", 2, parseFloat(wctrl.waveHeight));
                        if (wctrl.waveWidth !== undefined) safeSet(wave, "Wave Width", 3, parseFloat(wctrl.waveWidth));
                        if (wctrl.waveDirection !== undefined) safeSet(wave, "Direction", 4, parseFloat(wctrl.waveDirection));
                        if (wctrl.waveSpeed !== undefined) safeSet(wave, "Wave Speed", 5, parseFloat(wctrl.waveSpeed));
                    }
                    var td = findFx(layer, ["Turbulent Displace", "ADBE Turbulent Displace"]);
                    if (td) {
                        var turbTypeMap = { 'Turbulent': 1, 'Bulge': 2, 'Twist': 3, 'Smooth': 4 };
                        if (wctrl.turbType !== undefined) safeSet(td, "Displacement", 1, turbTypeMap[wctrl.turbType] || 3);
                        if (wctrl.turbAmount !== undefined) safeSet(td, "Amount", 2, parseFloat(wctrl.turbAmount));
                        if (wctrl.turbSize !== undefined) safeSet(td, "Size", 3, parseFloat(wctrl.turbSize));
                        if (wctrl.turbEvolution !== undefined) safeEx(td, "Evolution", 5, "time * " + parseFloat(wctrl.turbEvolution));
                    }
                }
            }
            app.endUndoGroup();
            return;
        }

        if (ctrl.type === "Fluid") {
            var fctrl = ctrl.controls || ctrl;
            app.beginUndoGroup("Update Fluid Controls");
            for (var l = 1; l <= comp.numLayers; l++) {
                var layer = comp.layer(l);
                if (layer.name === "Fluid Gradient") {
                    var twirl = findFx(layer, ["Twirl", "ADBE Twirl"]);
                    if (twirl) {
                        if (fctrl.twirlAngle !== undefined) safeSet(twirl, "Angle", 1, parseFloat(fctrl.twirlAngle) * 360);
                    }
                    var waveWarp = findFx(layer, ["Wave Warp", "ADBE Wave Warp", "ADBE Wave Warp2"]);
                    if (waveWarp) {
                        if (fctrl.waveType !== undefined) {
                            var waveTypeMap = {'Sine': 1, 'Square': 2, 'Triangle': 3, 'Sawtooth': 4, 'Circle': 5, 'Semicircle': 6, 'Smooth Noise': 7, 'Noise': 8};
                            safeSet(waveWarp, "Wave Type", 1, waveTypeMap[fctrl.waveType] || 5);
                        }
                        if (fctrl.waveHeight !== undefined) safeSet(waveWarp, "Wave Height", 2, parseFloat(fctrl.waveHeight));
                        if (fctrl.waveDirection !== undefined) safeSet(waveWarp, "Direction", 4, parseFloat(fctrl.waveDirection));
                        if (fctrl.waveSpeed !== undefined) safeSet(waveWarp, "Wave Speed", 5, parseFloat(fctrl.waveSpeed));
                    }
                    var noise = findFx(layer, ["Noise", "ADBE Noise"]);
                    if (noise && fctrl.noiseAmount !== undefined) {
                        safeSet(noise, "Amount of Noise", 1, parseFloat(fctrl.noiseAmount));
                    }
                }
            }
            app.endUndoGroup();
            return;
        }

        app.beginUndoGroup("Update SilkFlare Controls");
        for (var i = 1; i <= comp.numLayers; i++) {
            var layer = comp.layer(i);
            if (layer.name.indexOf("Matte Comp") !== -1) {
                var waveWarp = null;
                try {
                    waveWarp = layer.property("Effects").property("Wave Warp");
                } catch (e) { }
                if (!waveWarp) {
                    try {
                        waveWarp = layer.property("Effects").property("ADBE Wave Warp");
                    } catch (e) { }
                }
                if (!waveWarp) {
                    try {
                        waveWarp = layer.property("Effects").property("ADBE Wave Warp2");
                    } catch (e) { }
                }

                if (waveWarp) {
                    var sctrl = ctrl.controls || ctrl;
                    var dir = sctrl.direction !== undefined ? parseFloat(sctrl.direction) : 163;
                    try {
                        waveWarp.property(4).setValue(dir);
                    } catch (e) {
                        try {
                            waveWarp.property("Direction").setValue(dir);
                        } catch (e2) { }
                    }
                    var spd = sctrl.speed !== undefined ? parseFloat(sctrl.speed) : 0.3;
                    try {
                        waveWarp.property(5).setValue(spd);
                    } catch (e) {
                        try {
                            waveWarp.property("Wave Speed").setValue(spd);
                        } catch (e2) { }
                    }
                }
                break;
            }
        }
        app.endUndoGroup();
    } catch (e) {
        try {
            app.endUndoGroup();
        } catch (x) { }
    }
}

// ── 4. REALTIME COLOR UPDATE ──
// Updates colors on both Living Gradient (4-Color Gradient effect) and SilkFlare (blob fills)
function updateBlobCompColors(blobComp, c) {
    if (!blobComp || !(blobComp instanceof CompItem)) return;
    for (var bi = 1; bi <= blobComp.numLayers; bi++) {
        var blob = blobComp.layer(bi);
        if (blob.name.indexOf("Blob ") !== 0) continue;
        try {
            var bContents = blob.property("Contents");
            if (bContents && bContents.numProperties > 0) {
                var bGrp = bContents.property(1);
                if (bGrp) {
                    var bGrpC = bGrp.property("Contents");
                    for (var fi = 1; fi <= bGrpC.numProperties; fi++) {
                        var fp = bGrpC.property(fi);
                        if (fp.matchName === "ADBE Vector Graphic - Fill") {
                            var cIdx = (bi - 1) % c.length;
                            try {
                                fp.property("Color").setValue(c[cIdx]);
                            } catch (x) {
                                try {
                                    fp.property(4).setValue(c[cIdx]);
                                } catch (x2) { }
                            }
                        }
                    }
                }
            }
        } catch (e) { }
    }
}

function updateNestedBlobSources(src, c, depth) {
    if (!src || !(src instanceof CompItem) || depth > 5) return;
    for (var i = 1; i <= src.numLayers; i++) {
        var layer = src.layer(i);
        try {
            if (layer.name === "Color Blobs" && layer.source && layer.source instanceof CompItem) {
                updateBlobCompColors(layer.source, c);
            }
            if (layer.source && layer.source instanceof CompItem) {
                updateNestedBlobSources(layer.source, c, depth + 1);
            }
        } catch (e) { }
    }
}

function updateLiveColors(colorsStr) {
    try {
        var hexColors = JSON.parse(colorsStr);
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) return;

        var c = [];
        for (var i = 0; i < hexColors.length; i++) c.push(hexRgb(hexColors[i]));

        app.beginUndoGroup("Update Colors Live");

        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) selectedLayers = lgTaggedLayers(comp);
        if (selectedLayers.length === 0) { app.endUndoGroup(); return; }

        for (var li = 0; li < selectedLayers.length; li++) {
            try {
                if (selectedLayers[li].comment && selectedLayers[li].comment.indexOf('LIVING_GRADIENT_DATA:') === 0) {
                    var oldParams = JSON.parse(selectedLayers[li].comment.substring(21));
                    oldParams.colors = hexColors;
                    selectedLayers[li].comment = 'LIVING_GRADIENT_DATA:' + JSON.stringify(oldParams);
                }
            } catch(e) {}
            updateLayerColors(selectedLayers[li], c, 0);
        }

        app.endUndoGroup();
    } catch (e) {
        try {
            app.endUndoGroup();
        } catch (x) { }
    }
}

function updateLayerColors(layer, c, depth) {
    if (depth > 5 || !layer) return;
    var lname = layer.name;

    if (lname.indexOf('Trail Base') !== -1) {
        if (layer.source && layer.source instanceof CompItem) {
            for (var pci = 1; pci <= layer.source.numLayers; pci++) {
                updateLayerColors(layer.source.layer(pci), c, depth + 1);
            }
        }
        return;
    }

    if (lname === 'Living Gradient') {
        try {
            var ef = findFx(layer, ['4-Color Gradient', 'ADBE 4ColorGradient']);
            if (ef) {
                for (var ci = 0; ci < 4; ci++) {
                    try { ef.property('Color ' + (ci + 1)).setValue(c[ci % c.length]); } catch (x) { }
                }
            }
        } catch (x) { }
    }

    /* Was re-running the same rejected Gradient Fill write as the builder.
       The layer is a ramp through CC Toner now, so a palette change is just a
       re-map of the five stops. */
    if (lname === 'Oklab Smooth Gradient') {
        lgOklabToneStops(layer, c);
    }

    if (lname.indexOf('Matte Comp') !== -1) {
        try {
            var src = layer.source;
            if (src && src instanceof CompItem) {
                for (var mi = 1; mi <= src.numLayers; mi++) {
                    var matteLayer = src.layer(mi);
                    if (matteLayer.name === 'Color Blobs' && matteLayer.source && matteLayer.source instanceof CompItem) {
                        updateBlobCompColors(matteLayer.source, c);
                        break;
                    }
                }
            }
        } catch (x) { }
    }

    if (lname.indexOf('ChromaFlare Final Gradient') !== -1) {
        try {
            if (layer.source && layer.source instanceof CompItem) {
                updateNestedBlobSources(layer.source, c, 0);
            }
        } catch (x) { }
    }

    if (lname === 'Heatmap Base') {
        try {
            var toner = layer.property('Effects').property('CC Toner');
            if (toner) {
                try { toner.property("Tones").setValue(3); } catch (e) { try { toner.property(1).setValue(3); } catch (e2) { } }
                try { toner.property("Highlights").setValue(c[3] || [1, 1, 1]); } catch (e) { try { toner.property(2).setValue(c[3] || [1, 1, 1]); } catch (e2) { } }
                try { toner.property("Brights").setValue(c[2] || [1, 1, 0]); } catch (e) { try { toner.property(3).setValue(c[2] || [1, 1, 0]); } catch (e2) { } }
                try { toner.property("Midtones").setValue(c[1] || [1, 0, 0]); } catch (e) { try { toner.property(4).setValue(c[1] || [1, 0, 0]); } catch (e2) { } }
                try { toner.property("Darktones").setValue(c[0] || [0, 0, 1]); } catch (e) { try { toner.property(5).setValue(c[0] || [0, 0, 1]); } catch (e2) { } }
                try { toner.property("Shadows").setValue([0.05, 0.0, 0.1]); } catch (e) { try { toner.property(6).setValue([0.05, 0.0, 0.1]); } catch (e2) { } }
            }
        } catch (x) { }
    }

    if (lname === 'Halftone Color') {
        try {
            var ink = lgRayColors(c), n = ink.length, segs = (n > 1) ? n - 1 : 1;
            var toner = findFx(layer, ['CC Toner']);
            if (toner) {
                var stops = [], si, st, sseg, sidx;
                for (si = 0; si < 5; si++) {
                    st = si / 4;
                    sseg = st * segs;
                    sidx = Math.min(Math.floor(sseg), segs - 1);
                    stops.push(interpolateOklab(ink[sidx % n], ink[(sidx + 1) % n], sseg - sidx));
                }
                LG.set(toner, 'Tones',      1, 3);
                LG.set(toner, 'Shadows',    6, stops[0]);
                LG.set(toner, 'Darktones',  5, stops[1]);
                LG.set(toner, 'Midtones',   4, stops[2]);
                LG.set(toner, 'Brights',    3, stops[3]);
                LG.set(toner, 'Highlights', 2, stops[4]);
            }
        } catch (x) { }
    }

    if (lname === 'Halftone Gradient' || lname === 'ASCII Color Overlay' || lname === 'Sunburst Colour' || lname === 'Lava Lamp' || lname === 'Stacked Background' || lname.indexOf('Square 3') !== -1) {
        try {
            /* Sunburst keeps its last slot for the backdrop, so only the ray
               colours may reach the gradient. */
            var src2 = (lname === 'Sunburst Colour') ? lgRayColors(c) : c;
            var ef2 = findFx(layer, ['4-Color Gradient', 'ADBE 4ColorGradient']);
            if (ef2) {
                for (var ci2 = 0; ci2 < 4; ci2++) {
                    try { ef2.property('Color ' + (ci2 + 1)).setValue(src2[ci2 % src2.length]); } catch (x) { }
                }
            }
        } catch (x) { }
    }

    if (lname === 'Sonduck Shapes' || lname === 'Twirl Shapes') {
        try {
            var tint = findFx(layer, ["Tint", "ADBE Tint"]);
            if (tint) {
                safeSet(tint, "Map Black To", 1, c[0]);
                safeSet(tint, "Map White To", 2, c[1]);
            }
        } catch (x) { }
    }

    /* Every gradient on the shared greyscale-then-colour path is coloured by a
       CC Toner, so recolouring them is one operation regardless of which
       builder made the layer. Heatmap keeps its own mapping above. */
    if (lname !== 'Heatmap Base') {
        try {
            var toner = findFx(layer, ['CC Toner']);
            if (toner) lgToneColors(toner, c);
        } catch (x) { }
    }

    /* Backdrops are plain solids painted the darkest colour in the palette. */
    if (lname === 'Sunburst Backdrop' || lname === 'Halftone Background') {
        try { layer.source.mainSource.color = lgRole(c, 2, lgByLuma(c)[0]); } catch (x) { }
    }

    /* And every build ends up precomposed, so the layers that actually carry
       the colour are a level or two under whatever the user has selected. */
    if (depth < 4) {
        try {
            if (layer.source && layer.source instanceof CompItem) {
                for (var ni = 1; ni <= layer.source.numLayers; ni++) {
                    updateLayerColors(layer.source.layer(ni), c, depth + 1);
                }
            }
        } catch (x) { }
    }
}

// ── 5. MASSIVE LIBRARY GENERATORS ──
function safeSet(fx, name, idx, val) {
    return LG.set(fx, name, idx, val);
}
function safeEx(fx, name, idx, expr) {
    /* Two-argument form: (property, expressionString). Several call sites use
       it, and against the four-argument signature they all failed silently —
       the expression string was being read as a property name. */
    if (idx === undefined && expr === undefined && typeof name === "string") {
        return ex(fx, name);
    }
    return LG.expr(fx, name, idx, expr);
}
function safeSetGroup(fx, groupName, name, idx, val) {
    if (!fx) return false;
    try { fx.property(groupName).property(name).setValue(val); return true; } catch (e) { }
    return LG.set(fx, name, idx, val);
}


function applyAnimatedGradient(s, c, w, h, dur) {
    var g4 = addFx(s, ['4-Color Gradient', '4 Color Gradient', 'ADBE 4-Color Gradient']);
    if (g4) {
        var ov = Math.max(w, h) * 0.5;
        var corners = [[-ov, -ov], [w + ov, -ov], [-ov, h + ov], [w + ov, h + ov]];
        var animationDur = dur && dur > 0 ? dur : 10;
        for (var i = 0; i < 4; i++) {
            try {
                var pt = g4.property('Point ' + (i + 1));
                var cp = g4.property('Color ' + (i + 1));
                if (pt && cp) {
                    pt.setValueAtTime(0, corners[i]);
                    pt.setValueAtTime(animationDur, [(Math.random() * (w + ov * 2)) - ov, (Math.random() * (h + ov * 2)) - ov]);
                    try { pt.expression = 'loopOut("pingpong")'; } catch (e) { }
                    cp.setValue(c[i % c.length]);
                }
            } catch (x) { }
        }
    }
}

function buildHeatmap(comp, c, ctrl, w, h, dur) {
    var s = comp.layers.addSolid([0, 0, 0], 'Heatmap Base', w, h, 1, dur);

    var noise = addFx(s, ['ADBE FractalNoise', 'Fractal Noise']);
    if (noise) {
        safeSet(noise, "Fractal Type", 1, 1);
        safeSet(noise, "Noise Type", 2, 4);
        var contrast = ctrl.contrast !== undefined ? parseFloat(ctrl.contrast) : 80;
        safeSet(noise, "Contrast", 4, contrast);
        safeSet(noise, "Brightness", 5, 0);
        safeSet(noise, "Complexity", 8, 1);
        var scale = ctrl.noiseScale !== undefined ? parseFloat(ctrl.noiseScale) : 150;
        safeSet(noise, "Scale", 10, scale);
        var speed = ctrl.speed !== undefined ? parseFloat(ctrl.speed) : 40;
        safeEx(noise, "Evolution", 10, "time * " + speed);
    }

    var blur = addFx(s, ["ADBE Fast Box Blur", "Fast Box Blur", "ADBE Box Blur2"]);
    if (blur) safeSet(blur, "Blur Radius", 1, 25);

    // Map luma to 4 colors (+ 1 dark shadow color)
    var toner = addFx(s, ['CC Toner']);
    if (toner) {
        // CC Toner options: 1=Duotone, 2=Tritone, 3=Pentatone (for most AE versions)
        // Some older AE versions use 4 for Pentatone. We will try 3 first, then 4, or just set it to 3.
        safeSet(toner, "Tones", 1, 3); 
        // Just in case it needs 4 or 5, we'll also try 5? No, 3 is standard for Pentatone if there are 3 options.
        // Actually, if it failed on 4 and went to 1 (Duotone), then Pentatone is 3.
        // Map colors correctly: c[3] is brightest (White), c[0] is darkest (Dark Blue)
        safeSet(toner, "Highlights", 2, c[3] || [1, 1, 1]);
        safeSet(toner, "Brights", 3, c[2] || [1, 1, 0]);
        safeSet(toner, "Midtones", 4, c[1] || [1, 0, 0]);
        safeSet(toner, "Darktones", 5, c[0] || [0, 0, 1]);
        safeSet(toner, "Shadows", 6, [0.05, 0.0, 0.1]); // Coldest thermal base
    }

    // Authentic gritty thermal-camera texture on top
    var filmNoise = addFx(s, ['ADBE Noise', 'Noise']);
    if (filmNoise) {
        safeSet(filmNoise, "Amount of Noise", 1, 12);
        safeSet(filmNoise, "Use Color Noise", 2, 0); // Grayscale noise only
    }
}

/* A halftone screen is one comparison: a repeating dot profile against a
   moving grey field. Where the profile is brighter than the field, ink.

   The part that kept going wrong is the profile. Drawing a shape and blurring
   it gives a bump whose peak and floor depend on how much of the cell the
   shape covered and how wide the blur was — at 90% coverage there is no floor
   left, at a wide blur there is no peak, and either way the comparison has
   almost no range to work in. Every dot then reads as fully on or fully off,
   which is a frame of solid ink or an empty one.

   A radial Gradient Ramp has no such problem. It is white at the centre and
   black at the corner *by construction*, so the profile spans the full range
   in every cell, and the threshold maps smoothly onto dot radius: a bright
   field cuts low on the cone and leaves a wide dot, a dark field cuts high
   and leaves a small one. That is what a halftone actually is.

   The field has to be just as well behaved, and Fractal Noise is not. Its
   turbulent types are bright-biased — the histogram sits well above mid-grey —
   so with the threshold at the middle of the range almost every cell cut low
   on the cone and the dots merged into solid ink. That was the red-to-cyan
   frame with a few pinholes in it.

   So the field is a ramp too, pushed around by Turbulent Displace. A linear
   ramp is uniformly distributed by construction, and displacing it is a
   spatial remap that leaves the histogram alone — it only makes the isolines
   wander, which is exactly the organic drift wanted. With profile and field
   both uniform over 0-255, the threshold is not a number to be tuned by
   trial: half-way is genuinely half-way, and Ink Coverage at 128 gives a
   40%-coverage mid-tone, 255 gives bare paper, 0 gives solid ink.

   Shapes other than a circle cannot be expressed as a ramp, so those still go
   through draw-and-blur — but at 70% coverage and a narrow blur, which leaves
   the profile most of its range. */
function buildHalftone(comp, c, ctrl, w, h, dur) {
    var proj = app.project;
    var fps  = comp.frameRate;

    var dotSize  = Math.max(4, num(ctrl.dotSize, 20));
    var speed    = num(ctrl.speed, 30);
    var angle    = num(ctrl.angle, 45);
    var edge     = num(ctrl.edge, 82);
    var coverage = num(ctrl.coverage, 128);
    var shape    = ctrl.shape || 'Circle';

    // 1. The grey field the dots are measured against.
    var lumaComp  = proj.items.addComp('Halftone Luma Map', w, h, 1, dur, fps);
    var lumaSolid = lumaComp.layers.addSolid([0.5, 0.5, 0.5], 'Halftone Luma', w, h, 1, dur);
    tuneHalftoneField(lumaSolid, ctrl, w, h);

    // 2. One cell.
    var cellComp = proj.items.addComp('Halftone Cell', Math.round(dotSize), Math.round(dotSize), 1, dur, fps);
    var isRamp = buildHalftoneCell(cellComp, shape, ctrl.customText, dotSize);

    /* 3. The screen. Square, and wider than the frame's diagonal, so that it
          covers at every screen angle. The previous 1.7x rectangle did not:
          rotated 45 degrees its half-height reached 918px while the frame's
          corner sits 1102px out, so two opposite corners fell outside the
          screen entirely and showed bare paper. A square whose side beats the
          diagonal has no orientation that can fail. */
    var side = Math.ceil(Math.sqrt(w * w + h * h) * 1.08);
    var ow = side, oh = side;
    var patternComp = proj.items.addComp('Halftone Pattern Grid', ow, oh, 1, dur, fps);
    patternComp.layers.addSolid([0, 0, 0], 'Screen Base', ow, oh, 1, dur);

    /* Tile out from the centre rather than a corner: it halves how far
       CC RepeTile has to expand, which keeps the screen covering the frame at
       4K instead of leaving a bare band down one side. */
    var cellLayer = patternComp.layers.add(cellComp);
    try { cellLayer.property('Transform').property('Position').setValue([ow / 2, oh / 2]); } catch (e) { }
    var repeTile = addFx(cellLayer, ['CC RepeTile']);
    if (repeTile) {
        LG.set(repeTile, 'Expand Right', 1, ow / 2 + dotSize);
        LG.set(repeTile, 'Expand Left',  2, ow / 2 + dotSize);
        LG.set(repeTile, 'Expand Down',  3, oh / 2 + dotSize);
        LG.set(repeTile, 'Expand Up',    4, oh / 2 + dotSize);
    }

    // 4. The comparison.
    var maskComp = proj.items.addComp('Halftone Mask', w, h, 1, dur, fps);

    var screen = maskComp.layers.add(patternComp);
    screen.name = 'Screen';
    try { screen.property('Transform').property('Rotation').setValue(angle); } catch (e) { }
    // A ramp cell is already a smooth profile; only a drawn shape needs softening.
    lgBlur(screen, isRamp ? 0 : dotSize * 0.26);

    /* Half of each, so the composite is the midpoint of profile and field and
       the threshold below sits in the middle of a known range. */
    var field = maskComp.layers.add(lumaComp);
    field.name = 'Field';
    try { field.opacity.setValue(50); } catch (e) { }

    var cut = maskComp.layers.addSolid([1, 1, 1], 'Threshold', w, h, 1, dur);
    cut.adjustmentLayer = true;
    addFx(cut, ['ADBE Extract']);
    tuneHalftoneThreshold(cut, coverage, edge);

    // 5. Colour, cut by the screen.
    comp.layers.addSolid(lgRole(c, 2, lgByLuma(c)[0]), 'Halftone Background', w, h, 1, dur);

    var colorMaster = comp.layers.addSolid([1, 1, 1], 'Halftone Color', w, h, 1, dur);
    tuneHalftoneInk(colorMaster, c, ctrl, w, h);

    var screenMatte = comp.layers.add(maskComp);
    screenMatte.name = 'Halftone Screen';
    setTrackMatteSafely(colorMaster, screenMatte, 'ALPHA');
}

/* The field IS the gradient. Every reference for this effect is the same
   thing: two colours, and a dot screen carrying the transition between them —
   solid ink at one end, bare paper at the other, dots doing the middle. So
   the field has to sweep the full 0-255 across the frame, and it has to be
   aimable, because which way it sweeps is the whole composition.

   The previous version used Fractal Noise at scale 420. At that scale the
   features are larger than the frame, so the field came out essentially flat
   and every cell got the same threshold — a uniform screen of identical dots
   with no gradient in it at all.

   Tone Spread is the ramp's length. At 1.0 it spans exactly the frame, so the
   far edges reach solid and bare; shorter pushes more of the frame to the
   extremes, longer keeps more of it in the mid-tones where the dots read as
   dots. Flow Warp bends the isolines off straight. */
function tuneHalftoneField(lumaSolid, ctrl, w, h) {
    if (!lumaSolid) return;
    if (!w) { try { w = lumaSolid.width;  } catch (e) { w = 1920; } }
    if (!h) { try { h = lumaSolid.height; } catch (e) { h = 1080; } }

    var field  = ctrl.field || 'Linear';
    var spread = Math.max(0.25, Math.min(2.0, 1.8 - num(ctrl.contrast, 128) / 160));
    var speed  = num(ctrl.speed, 20);
    var warp   = num(ctrl.warp, 260);
    var radial = (field === 'Radial');

    var rad = num(ctrl.direction, 90) * Math.PI / 180;
    var cx  = w / 2, cy = h / 2;
    /* Project the frame onto the gradient's own axis, so a 1.0 spread spans
       the frame whichever way it is pointing. */
    var reach = (Math.abs(Math.cos(rad)) * w + Math.abs(Math.sin(rad)) * h) * 0.5 * spread;
    if (radial) reach = Math.max(w, h) * 0.5 * spread;

    var ramp = lgFx(lumaSolid, ['ADBE Ramp']);
    if (ramp) {
        if (radial) {
            LG.set(ramp, 'Start of Ramp', 1, [cx, cy]);
            LG.set(ramp, 'End of Ramp',   3, [cx + reach, cy]);
        } else {
            LG.set(ramp, 'Start of Ramp', 1, [cx - Math.cos(rad) * reach, cy - Math.sin(rad) * reach]);
            LG.set(ramp, 'End of Ramp',   3, [cx + Math.cos(rad) * reach, cy + Math.sin(rad) * reach]);
        }
        LG.set(ramp, 'Start Color', 2, [0, 0, 0]);
        LG.set(ramp, 'End Color',   4, [1, 1, 1]);
        LG.set(ramp, 'Ramp Shape',  5, radial ? 2 : 1);   // probe grid 7

        /* Flow Speed has to move the ramp itself. Leaving it to Turbulent
           Displace's Evolution was the same mistake as everywhere else in this
           file: displacing a smooth gradient barely changes a smooth gradient,
           so Linear and Radial sat completely still while only Organic — which
           warps hard enough to fold the field — appeared to animate.

           It sweeps back and forth rather than travelling. A ramp that only
           translates runs off its own ends and the frame goes solid. */
        var f = speed / 25;
        if (speed > 0) {
            if (radial) {
                LG.expr(ramp, 'End of Ramp', 3,
                    '[value[0] + Math.sin(time * ' + f + ') * ' + (reach * 0.3) + ', value[1]]');
                LG.expr(ramp, 'Start of Ramp', 1,
                    '[value[0] + Math.sin(time * ' + (f * 0.7) + ') * ' + (w * 0.08) +
                    ', value[1] + Math.cos(time * ' + (f * 0.53) + ') * ' + (h * 0.08) + ']');
            } else {
                var sweep = '[value[0] + Math.sin(time * ' + f + ') * ' +
                            (Math.cos(rad) * reach * 0.42) +
                            ', value[1] + Math.sin(time * ' + f + ') * ' +
                            (Math.sin(rad) * reach * 0.42) + ']';
                LG.expr(ramp, 'Start of Ramp', 1, sweep);
                LG.expr(ramp, 'End of Ramp',   3, sweep);
            }
        } else {
            LG.expr(ramp, 'Start of Ramp', 1, 'value');
            LG.expr(ramp, 'End of Ramp',   3, 'value');
        }
    }

    /* Organic doubles the warp and coarsens it, which turns the sweep into
       wandering blobs of density rather than a directional fade. */
    var drift = (field === 'Organic') ? warp * 2.5 : warp;

    lgTurbSet(lgFxNamed(lumaSolid, ['ADBE Turbulent Displace'], 'Field Drift'), {
        mode: 4, amount: drift, size: (field === 'Organic') ? 700 : 450, speed: speed * 0.4
    });
    lgTurbSet(lgFxNamed(lumaSolid, ['ADBE Turbulent Displace'], 'Field Detail'), {
        mode: 1, amount: drift * 0.3, size: 130, speed: speed * 0.7
    });
}

/* The ink is one fade from Ink A to Ink B, pointed the same way as the screen.

   It used to be a four-colour gradient fed the two ink colours, which put A at
   two opposite corners and B at the other two — so a red-to-cyan palette came
   out red in two corners with cyan between them, which is not a gradient, it
   is a checkerboard. Every reference for this effect is a clean two-stop fade
   with the dots carrying the transition, so that is what this is. */
function tuneHalftoneInk(colorMaster, c, ctrl, w, h) {
    if (!colorMaster) return;
    if (!w) { try { w = colorMaster.width;  } catch (e) { w = 1920; } }
    if (!h) { try { h = colorMaster.height; } catch (e) { h = 1080; } }
    lgOklabRamp(colorMaster, lgRayColors(c), w, h,
                num(ctrl.direction, 90), ctrl.field === 'Radial');
}

/* Ink Coverage is the threshold, and it is exposed rather than fixed because
   it is the one number that decides whether the frame reads as a halftone or
   as a solid block. Low values cut lower on the dot profile and leave more
   ink. Edge Hardness is the softness band around the cut — the antialiasing. */
function tuneHalftoneThreshold(cut, coverage, edge) {
    var extract = findFx(cut, ['ADBE Extract']);
    if (!extract) return;
    LG.set(extract, 'Black Point',    3, coverage);
    LG.set(extract, 'White Point',    4, 255);
    LG.set(extract, 'Black Softness', 5, Math.max(2, (100 - edge) * 0.9));
    LG.set(extract, 'White Softness', 6, 0);
}

/* Every shape is drawn to cover the same fraction of its cell — about 30%,
   which is what the radial ramp's profile works out to.

   Without that, Ink Coverage means something different for every shape. The
   cross was the extreme case: four thin arms covering roughly 5% of the cell,
   so its profile sat far below the threshold everywhere and the frame came out
   as bare paper with a corner of dots. Sizes below are solved from each
   shape's own area formula for a 30% fill, so one threshold reads the same
   whichever shape is chosen.

   Returns true when the cell is a ramp, so the caller knows it needs no blur. */
function buildHalftoneCell(cellComp, shape, customText, dotSize) {
    if (shape === 'Circle' || !shape) {
        var dot = cellComp.layers.addSolid([0, 0, 0], 'Dot', Math.round(dotSize), Math.round(dotSize), 1, cellComp.duration);
        var ramp = addFx(dot, ['ADBE Ramp']);
        if (ramp) {
            /* Reaching just past the cell corner is what lets a dot grow until
               it touches its neighbours at full ink and vanish at none. */
            LG.set(ramp, 'Start of Ramp', 1, [dotSize / 2, dotSize / 2]);
            LG.set(ramp, 'Start Color',   2, [1, 1, 1]);
            LG.set(ramp, 'End of Ramp',   3, [dotSize / 2 + dotSize * 0.72, dotSize / 2]);
            LG.set(ramp, 'End Color',     4, [0, 0, 0]);
            LG.set(ramp, 'Ramp Shape',    5, 2);      // 2 = Radial (probe grid 7)
        }
        return true;
    }

    if (shape === 'Custom Text/Emoji') {
        var charStr = customText || '#';
        var textLayer = cellComp.layers.addText(charStr);
        textLayer.name = 'Custom Text';
        try {
            var txtDoc = textLayer.property('Source Text').value;
            txtDoc.fontSize = dotSize * 0.95;
            txtDoc.fillColor = [1, 1, 1];
            txtDoc.applyFill = true;
            txtDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
            textLayer.property('Source Text').setValue(txtDoc);
            textLayer.property('Transform').property('Position').setValue([dotSize / 2, dotSize * 0.72]);
        } catch (e) {
            LG.warn('Halftone: could not style the custom symbol');
        }
        var fillFx = addFx(textLayer, ['ADBE Fill']);
        if (fillFx) LG.set(fillFx, 'Color', null, [1, 1, 1]);
        return false;
    }

    var shapeLayer = cellComp.layers.addShape();
    shapeLayer.name = 'Dot';
    var gc = shapeLayer.property('Contents').addProperty('ADBE Vector Group').property('Contents');
    var geo, target = 0.30 * dotSize * dotSize;      // the area to hit

    if (shape === 'Square') {
        // a^2 = target
        var side = Math.sqrt(target);
        geo = gc.addProperty('ADBE Vector Shape - Rect');
        LG.set(geo, 'Size', null, [side, side]);
    } else if (shape === 'Cross') {
        /* A four-point star of outer R and inner ratio k has area 2*sqrt(2)*k*R^2.
           At k = 0.40 that solves to R = sqrt(target / 1.131). */
        var rCross = Math.sqrt(target / 1.131);
        geo = gc.addProperty('ADBE Vector Shape - Star');
        LG.set(geo, 'Type',         null, 1);          // star
        LG.set(geo, 'Points',       null, 4);
        LG.set(geo, 'Inner Radius', null, rCross * 0.40);
        LG.set(geo, 'Outer Radius', null, rCross);
    } else if (shape === 'Triangle') {
        // An equilateral triangle of circumradius R has area (3*sqrt(3)/4)*R^2.
        var rTri = Math.sqrt(target / 1.299);
        geo = gc.addProperty('ADBE Vector Shape - Star');
        LG.set(geo, 'Type',         null, 2);          // polygon
        LG.set(geo, 'Points',       null, 3);
        LG.set(geo, 'Outer Radius', null, rTri);
    } else {
        // pi*r^2 = target
        var rDot = Math.sqrt(target / Math.PI);
        geo = gc.addProperty('ADBE Vector Shape - Ellipse');
        LG.set(geo, 'Size', null, [rDot * 2, rDot * 2]);
    }

    var fill = gc.addProperty('ADBE Vector Graphic - Fill');
    LG.set(fill, 'Color', null, [1, 1, 1]);
    try { shapeLayer.property('Transform').property('Position').setValue([dotSize / 2, dotSize / 2]); } catch (e) { }
    return false;
}

function buildAsciiMatrix(comp, c, ctrl, w, h, dur) {
    var proj = app.project;
    var fps = comp.frameRate;

    var gridSize = ctrl.gridSize !== undefined ? parseFloat(ctrl.gridSize) : 40;
    var charString = ctrl.chars || " .-+#@";
    var speed = ctrl.speed !== undefined ? parseFloat(ctrl.speed) : 30;
    var colorizeMode = ctrl.colorize || 'Gradient Colors';

    // Ensure at least 2 characters
    if (charString.length < 2) charString = " #";
    var numTiers = charString.length;

    // 1. Luma Source Precomp (The 4-Color Gradient map)
    var lumaComp = proj.items.addComp("ASCII Luma Map", w, h, 1, dur, fps);

    var lumaSolid = lumaComp.layers.addSolid([0, 0, 0], "Fluid Gradient", w, h, 1, dur);

    var grad = addFx(lumaSolid, ["4-Color Gradient", "ADBE 4ColorGradient"]);
    if (grad) {
        safeSet(grad, "Point 1", 1, [w * 0.1, h * 0.1]);
        safeSet(grad, "Point 2", 3, [w * 0.9, h * 0.2]);
        safeSet(grad, "Point 3", 5, [w * 0.2, h * 0.8]);
        safeSet(grad, "Point 4", 7, [w * 0.8, h * 0.9]);
        safeEx(grad, "Point 1", 1, "var s = time * " + (speed / 10) + "; [value[0] + Math.sin(s)*300, value[1] + Math.cos(s*0.8)*200]");
        safeEx(grad, "Point 2", 3, "var s = time * " + (speed / 10) + "; [value[0] + Math.cos(s*1.2)*300, value[1] + Math.sin(s*0.9)*200]");
        safeEx(grad, "Point 3", 5, "var s = time * " + (speed / 10) + "; [value[0] + Math.sin(s*0.7)*300, value[1] + Math.cos(s*1.1)*200]");
        safeEx(grad, "Point 4", 7, "var s = time * " + (speed / 10) + "; [value[0] + Math.cos(s*0.9)*300, value[1] + Math.sin(s*1.3)*200]");
    }

    var turb = addFx(lumaSolid, ["Turbulent Displace", "ADBE Turbulent Displace"]);
    if (turb) {
        safeSet(turb, "Amount", 2, 100);
        safeSet(turb, "Size", 3, 300);
        safeEx(turb, "Evolution", 5, "time * " + speed * 2);
    }

    addFx(lumaSolid, ["Tint", "ADBE Tint"]); // Grayscale!

    var noiseSolid = lumaComp.layers.addSolid([1, 1, 1], "Evolving Noise", w, h, 1, dur);
    var lumaNoise = addFx(noiseSolid, ["Fractal Noise", "ADBE FractalNoise"]);
    if (lumaNoise) {
        safeSet(lumaNoise, "Fractal Type", 1, 1);
        safeSet(lumaNoise, "Noise Type", 2, 4); // Spline
        safeSet(lumaNoise, "Contrast", 4, 150);
        safeSet(lumaNoise, "Brightness", 5, 0);
        safeEx(lumaNoise, "Evolution", 10, "time * " + (speed * 1.5));
    }
    try { noiseSolid.blendingMode = BlendingMode.OVERLAY; } catch (e) { }

    // Pixelate it so each grid cell has a uniform luminance
    var adjLayer = lumaComp.layers.addSolid([1, 1, 1], "Pixelate", w, h, 1, dur);
    adjLayer.adjustmentLayer = true;
    var mosaic = addFx(adjLayer, ["Mosaic", "ADBE Mosaic"]);
    if (mosaic) {
        safeSet(mosaic, "Horizontal Blocks", 1, Math.floor(w / gridSize));
        safeSet(mosaic, "Vertical Blocks", 2, Math.floor(h / gridSize));
    }

    // 2. Master Assembly
    var bgMaster = comp.layers.addSolid([0, 0, 0], "Background", w, h, 1, dur);

    var textColor = [1, 1, 1];
    if (colorizeMode === 'Matrix Green') textColor = [0, 1, 0];

    // Build from bottom to top
    for (var i = 0; i < numTiers; i++) {
        var charTarget = charString.charAt(i);

        // Single Character Precomp
        var charComp = proj.items.addComp("ASCII Char '" + charTarget + "'", Math.round(gridSize), Math.round(gridSize), 1, dur, fps);
        var txtLayer = charComp.layers.addText(charTarget);
        var txtDoc = txtLayer.property("Source Text").value;
        txtDoc.fontSize = gridSize * 0.9;
        txtDoc.fillColor = textColor;
        txtDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
        txtLayer.property("Source Text").setValue(txtDoc);
        txtLayer.property("Transform").property("Position").setValue([gridSize / 2, gridSize * 0.8]);

        // Tile it
        var charMapComp = proj.items.addComp("ASCII Grid '" + charTarget + "'", w, h, 1, dur, fps);
        var tiledLayer = charMapComp.layers.add(charComp);
        tiledLayer.property("Transform").property("Position").setValue([gridSize / 2, gridSize / 2]);
        var repeTile = addFx(tiledLayer, ["CC RepeTile"]);
        if (repeTile) {
            safeSet(repeTile, "Expand Right", 1, w);
            safeSet(repeTile, "Expand Down", 3, h);
        }

        // Bring tiled text grid into main comp
        var textMaster = comp.layers.add(charMapComp);

        // Bring Luma Map into main comp ABOVE the text grid
        var maskMaster = comp.layers.add(lumaComp);
        maskMaster.enabled = false;

        // Apply Extract effect to Luma Map
        var ext = addFx(maskMaster, ["Extract", "ADBE Extract"]);
        if (ext) {
            // Divide 0-255 into bands based on numTiers
            var bandSize = 255 / numTiers;
            var minLuma = i * bandSize;
            var maxLuma = (i + 1) * bandSize;
            safeSet(ext, "Black Point", 1, minLuma);
            safeSet(ext, "White Point", 2, maxLuma);
            safeSet(ext, "Black Softness", 3, 0);
            safeSet(ext, "White Softness", 4, 0);
        }

        // Set Alpha Matte
        try {
            textMaster.setTrackMatte(maskMaster, TrackMatteType.ALPHA);
        } catch (e) {
            try { textMaster.trackMatteType = TrackMatteType.ALPHA; } catch (e2) { }
        }
    }

    // 3. Optional Gradient Color Overlay
    if (colorizeMode === 'Gradient Colors') {
        var colorMaster = comp.layers.addSolid([1, 1, 1], "ASCII Color Overlay", w, h, 1, dur);
        var cmGrad = addFx(colorMaster, ["4-Color Gradient", "ADBE 4ColorGradient"]);
        if (cmGrad) {
            safeSet(cmGrad, "Point 1", 1, [w * 0.1, h * 0.1]);
            safeSet(cmGrad, "Color 1", 2, c[0]);
            safeSet(cmGrad, "Point 2", 3, [w * 0.9, h * 0.2]);
            safeSet(cmGrad, "Color 2", 4, c[1]);
            safeSet(cmGrad, "Point 3", 5, [w * 0.2, h * 0.8]);
            safeSet(cmGrad, "Color 3", 6, c[2]);
            safeSet(cmGrad, "Point 4", 7, [w * 0.8, h * 0.9]);
            safeSet(cmGrad, "Color 4", 8, c[3]);
            safeEx(cmGrad, "Point 1", 1, "var s = time * " + (speed / 10) + "; [value[0] + Math.sin(s)*300, value[1] + Math.cos(s*0.8)*200]");
            safeEx(cmGrad, "Point 2", 3, "var s = time * " + (speed / 10) + "; [value[0] + Math.cos(s*1.2)*300, value[1] + Math.sin(s*0.9)*200]");
            safeEx(cmGrad, "Point 3", 5, "var s = time * " + (speed / 10) + "; [value[0] + Math.sin(s*0.7)*300, value[1] + Math.cos(s*1.1)*200]");
            safeEx(cmGrad, "Point 4", 7, "var s = time * " + (speed / 10) + "; [value[0] + Math.cos(s*0.9)*300, value[1] + Math.sin(s*1.3)*200]");
        }
        var cmTurb = addFx(colorMaster, ["Turbulent Displace", "ADBE Turbulent Displace"]);
        if (cmTurb) {
            safeSet(cmTurb, "Amount", 2, 100);
            safeSet(cmTurb, "Size", 3, 300);
            safeEx(cmTurb, "Evolution", 5, "time * " + speed * 2);
        }
        var cMosaic = addFx(colorMaster, ["Mosaic", "ADBE Mosaic"]);
        if (cMosaic) {
            safeSet(cMosaic, "Horizontal Blocks", 1, Math.floor(w / gridSize));
            safeSet(cMosaic, "Vertical Blocks", 2, Math.floor(h / gridSize));
        }

        try { colorMaster.blendingMode = BlendingMode.MULTIPLY; } catch (e) { }
    }
}



/* ── FROSTED GLASS ────────────────────────────────────────────────────
   A sheet of glass in front of a colour field, and both halves are real.

   WHAT WAS WRONG THE FIRST TIME. The original build was one layer: Fractal
   Noise with Overflow on Wrap Back at contrast 260, then a wide Glow at a
   threshold low enough to catch half the frame. Wrap Back folds every value
   past white back down, so at that contrast the field is a stack of hard
   bands with a discontinuity at every fold — and the noise evolves, so those
   discontinuities sweep across the frame while the Glow blooms whatever is
   bright in each one. That is the flashing. It was never glass either: glass
   is a thing you see *through*, and there was nothing behind it to see.

   WHAT WAS WRONG THE SECOND TIME. Splitting it into a colour field and a
   surface was right; the numbers were not. The tile came back as a white
   trapezoid on black, and the reason is that CC Glass's Displacement pulls
   pixels in from outside the frame. On a comp-sized layer there is nothing
   out there to pull, so a displacement of 110 dragged the layer's own edge
   into the middle of the picture. The layers are 30% oversized now, so there
   is always more image to pull from — and the colour field itself was so
   low-frequency (a scale of 420 across the frame) that there was barely any
   structure to refract in the first place.

   So: a colour field with something in it, a surface with ridges in it, and
   a displacement that stays inside what the layer can supply. CC Glass does
   both jobs from the same normals — it bends what is behind the surface and
   lights the surface itself — and those two agreeing is what the eye reads
   as glass.

   Set Frost to 0 and the same build is clear liquid glass. */
function buildGlass(comp, c, ctrl, w, h, dur) {
    var fps = comp.frameRate;
    var OW = lgOversize(w), OH = lgOversize(h);

    // 1. The surface, in its own comp so it is finished before it is sampled.
    var surfComp = app.project.items.addComp('Glass Surface Map', OW, OH, 1, dur, fps);
    var surfSolid = surfComp.layers.addSolid([0.5, 0.5, 0.5], 'Surface', OW, OH, 1, dur);
    tuneGlassSurface(surfSolid, ctrl);

    var surf = comp.layers.add(surfComp);
    surf.name = 'Glass Surface';
    surf.enabled = false;

    comp.layers.addSolid([0.5, 0.5, 0.5], 'Glass Colour', OW, OH, 1, dur);

    // 2. Stack is final, so the bump index is safe. See buildMetalTexture.
    var colourNow = null, surfNow = null, i;
    for (i = 1; i <= comp.numLayers; i++) {
        if (comp.layer(i).name === 'Glass Colour')  colourNow = comp.layer(i);
        else if (comp.layer(i).name === 'Glass Surface') surfNow = comp.layer(i);
    }
    if (colourNow) tuneGlass(colourNow, c, ctrl, surfNow ? surfNow.index : 0);
}

/* The shape of the sheet. Soft ridges, not bands — this is a height field, so
   every hard edge in it arrives in the render as a crease of light. */
function tuneGlassSurface(s, ctrl) {
    if (!s) return;
    var speed = num(ctrl.speed, 14);
    var scale = num(ctrl.surfaceScale, 260);

    lgFractalSet(lgFxNamed(s, ['ADBE Fractal Noise'], 'Glass Relief'), {
        fractalType:  2,
        contrast:     150,
        brightness:   0,
        overflow:     2,                  // soft clamp — no folds, no flashing
        complexity:   5,
        scaleWidth:   scale * 1.6,
        scaleHeight:  scale,
        subInfluence: 80,
        speed:        speed * 0.7
    });

    var td = lgFxNamed(s, ['ADBE Turbulent Displace'], 'Glass Ripple');
    var ripple = num(ctrl.ripple, 90);
    if (td) {
        lgTurbSet(td, { mode: 4, amount: ripple, size: 300, speed: speed * 0.4 });
        try { td.enabled = ripple > 0; } catch (e) { }
    }

    lgBlur(s, 6);                          // normals are a derivative
}

/* The colour behind the glass, then the glass over it. */
function tuneGlass(s, c, ctrl, bumpIndex) {
    if (!s) return;
    var speed  = num(ctrl.speed, 14);
    var irid   = num(ctrl.iridescence, 22);
    var relief = num(ctrl.relief, 45);

    /* Something to refract. A field at scale 420 across a frame is one soft
       blob and reads as a flat wash once it is behind glass; this is a third
       of that, so there are edges for the surface to bend. */
    lgFractalSet(lgFxNamed(s, ['ADBE Fractal Noise'], 'Glass Colour Field'), {
        fractalType:  2,
        contrast:     130,
        brightness:   0,
        overflow:     2,
        complexity:   4,
        scaleWidth:   num(ctrl.scale, 420) * 0.5,
        scaleHeight:  num(ctrl.scale, 420) * 0.36,
        subInfluence: 60,
        speed:        speed
    });
    lgToneColors(lgFx(s, ['CC Toner']), c, true);

    var glass = lgFx(s, ['CC Glass']);
    if (glass) {
        lgGlassSurface(glass, bumpIndex, {
            softness:     Math.max(1, relief * 0.2),
            height:       relief,
            /* Refraction is the headline slider, so it keeps its full 0..300
               range in the panel — but a third of it is as far as the layer's
               own 30% overhang can honestly supply. */
            displacement: num(ctrl.refraction, 110) * 0.34
        });
        lgShadeSet(glass, {
            intensity:   70 + num(ctrl.specular, 85) * 0.3,
            lightAngle:  num(ctrl.lightAngle, 315),
            lightHeight: 55,
            ambient:     40,
            diffuse:     34,
            specular:    num(ctrl.specular, 55),
            roughness:   num(ctrl.roughness, 18),
            metal:       0                 // glass is not metal: white highlights
        });
    }

    /* Iridescence is a small, high-threshold bloom in two palette colours —
       a fringe on the brightest edges only. The original ran this at a
       threshold low enough to catch half the frame, which is how a subtle
       chromatic edge became a strobe. */
    var g = lgFxNamed(s, ['ADBE Glo2'], 'Glass Iridescence');
    if (g) {
        var sorted = lgByLuma(c);
        LG.set(g, 'Glow Threshold', 2, Math.max(55, 100 - irid * 0.35));
        LG.set(g, 'Glow Radius',    3, 15 + irid * 0.8);
        LG.set(g, 'Glow Intensity', 4, irid / 90);
        LG.set(g, 'Glow Colors',    7, 2);                    // A & B Colors
        LG.set(g, 'Color Looping',  8, 3);                    // Triangle A>B>A
        LG.set(g, 'Color Loops',    9, 2);
        LG.set(g, 'Color A',       12, lgMix(sorted[sorted.length - 1], [1, 1, 1], 0.4));
        LG.set(g, 'Color B',       13, sorted[1 % sorted.length]);
        try { g.enabled = irid > 0; } catch (e) { }
    }

    // The frost. At 0 this is clear glass.
    lgBlur(s, num(ctrl.softness, 10));
}

function buildWavy(comp, c, ctrl, w, h, dur) {
    var waveTypeStr = ctrl.waveType || 'Sawtooth';
    var waveHeight = ctrl.waveHeight !== undefined ? parseFloat(ctrl.waveHeight) : 160;
    var waveWidth = ctrl.waveWidth !== undefined ? parseFloat(ctrl.waveWidth) : 60;
    var waveDirection = ctrl.waveDirection !== undefined ? parseFloat(ctrl.waveDirection) : -90;
    var waveSpeed = ctrl.waveSpeed !== undefined ? parseFloat(ctrl.waveSpeed) : 0.6;
    
    var turbTypeStr = ctrl.turbType || 'Twist';
    var turbAmount = ctrl.turbAmount !== undefined ? parseFloat(ctrl.turbAmount) : 50;
    var turbSize = ctrl.turbSize !== undefined ? parseFloat(ctrl.turbSize) : 100;
    var turbEvolution = ctrl.turbEvolution !== undefined ? parseFloat(ctrl.turbEvolution) : 50;

    var waveTypeMap = { 'Sine': 1, 'Square': 2, 'Triangle': 3, 'Sawtooth': 4, 'Circle': 5, 'Semicircle': 6 };
    var turbTypeMap = { 'Turbulent': 1, 'Bulge': 2, 'Twist': 3, 'Smooth': 4 };

    var turbTypeVal = turbTypeMap[turbTypeStr] || 3;
    var waveTypeVal = waveTypeMap[waveTypeStr] || 4;

    var s = comp.layers.addSolid([1, 1, 1], 'Wavy Gradient', w, h, 1, dur);

    var tile = addFx(s, ['ADBE Tile']);
    if (tile) {
        safeSet(tile, "Output Width", 1, 300);
        safeSet(tile, "Output Height", 2, 300);
        safeSet(tile, "Mirror Edges", 3, true);
    }

    applyAnimatedGradient(s, c, w, h, dur);

    var wave = addFx(s, ["ADBE Wave Warp", "Wave Warp", "ADBE Wave Warp2"]);
    if (wave) {
        safeSet(wave, "Wave Type", 1, waveTypeVal);
        safeSet(wave, "Wave Height", 2, waveHeight);
        safeSet(wave, "Wave Width", 3, waveWidth);
        safeSet(wave, "Direction", 4, waveDirection);
        safeSet(wave, "Wave Speed", 5, waveSpeed);
        safeSet(wave, "Pinning", 6, 1);
    }

    var td = addFx(s, ['ADBE TurbulentDisplace', 'Turbulent Displace']);
    if (td) {
        safeSet(td, "Displacement", 1, turbTypeVal);
        safeSet(td, "Amount", 2, turbAmount);
        safeSet(td, "Size", 3, turbSize);
        safeEx(td, "Evolution", 5, "time * " + turbEvolution);
    }
}

/* Reeded (fluted) glass over a colour field — the Nothing-wallpaper look.

   The flutes never appeared in the old build for a plain reason: the ramp
   that was meant to be one flute was painted across a full-comp-width solid,
   so CC RepeTile was tiling a single frame-wide gradient. One flute has to be
   one flute wide before tiling it means anything.

   The other half of it is ordering. A Displacement Map's source is stored as
   a layer index, and the old code set that index and *then* moved layers
   around, so it ended up pointing at whatever had shuffled into that slot.
   Every layer here is in its final position before the source is assigned. */
function buildReededGlass(comp, c, ctrl, w, h, dur) {
    var fps = comp.frameRate;

    var lineSize    = Math.max(4, num(ctrl.lineSize, 44));
    var refraction  = num(ctrl.refraction, 90);
    var vertical    = (ctrl.orientation || 'Vertical') !== 'Horizontal';
    var sheen       = num(ctrl.sheen, 45);
    var blurAmt     = num(ctrl.blur, 6);

    // 1. The colour behind the glass.
    var colour = comp.layers.addSolid([0.5, 0.5, 0.5], 'Reeded Colour', w, h, 1, dur);
    tuneReededColour(colour, c, ctrl);

    // 2. One flute, tiled. The solid is a single flute wide.
    var linesComp = app.project.items.addComp('Reeded Lines Map', w, h, 1, dur, fps);
    var fluteW = vertical ? Math.round(lineSize) : w;
    var fluteH = vertical ? h : Math.round(lineSize);
    var flute  = linesComp.layers.addSolid([0.5, 0.5, 0.5], 'Flute', fluteW, fluteH, 1, dur);

    var ramp = addFx(flute, ['ADBE Ramp']);
    if (ramp) {
        LG.set(ramp, 'Start of Ramp', 1, vertical ? [0, fluteH / 2] : [fluteW / 2, 0]);
        LG.set(ramp, 'End of Ramp',   3, vertical ? [fluteW, fluteH / 2] : [fluteW / 2, fluteH]);
        LG.set(ramp, 'Start Color',   2, [0, 0, 0]);
        LG.set(ramp, 'End Color',     4, [1, 1, 1]);
    }
    var rep = addFx(flute, ['CC RepeTile']);
    if (rep) {
        LG.set(rep, 'Expand Right', 1, vertical ? w : 0);
        LG.set(rep, 'Expand Left',  2, vertical ? w : 0);
        LG.set(rep, 'Expand Down',  3, vertical ? 0 : h);
        LG.set(rep, 'Expand Up',    4, vertical ? 0 : h);
    }

    // 3. The flute map, hidden — it is a displacement source, not an image.
    var mapLayer = comp.layers.add(linesComp);
    mapLayer.name = 'Reeded Lines';
    mapLayer.enabled = false;

    // 4. The glass itself.
    var glass = comp.layers.addSolid([1, 1, 1], 'Reeded Glass', w, h, 1, dur);
    glass.adjustmentLayer = true;
    // Applied here so it sits below the blur; wired up at step 6.
    addFx(glass, ['ADBE Displacement Map']);
    var blur = addFx(glass, ['ADBE Box Blur2']);
    if (blur) {
        LG.set(blur, 'Blur Radius', 1, blurAmt);
        LG.set(blur, 'Blur Dimensions', 3, vertical ? 2 : 3);   // across the flutes
        LG.set(blur, 'Repeat Edge Pixels', 4, true);
    }

    // 5. The bright line down each flute edge.
    var sheenLayer = null;
    if (sheen > 0) {
        sheenLayer = comp.layers.add(linesComp);
        sheenLayer.name = 'Reeded Sheen';
        try { sheenLayer.blendingMode = BlendingMode.SCREEN; } catch (e) { }
        try { sheenLayer.opacity.setValue(sheen); } catch (e) { }
        var lift = addFx(sheenLayer, ['ADBE Extract']);
        if (lift) {
            LG.set(lift, 'Black Point',    null, 205);
            LG.set(lift, 'White Point',    null, 255);
            LG.set(lift, 'Black Softness', null, 30);
        }
        lgBlur(sheenLayer, 2);
    }

    /* 6. Only now is the layer stack final, so only now is the source safe.

       `disp` and `mapLayer` were fetched before the sheen layer was inserted
       above them. An ExtendScript layer or effect reference is bound to the
       index it was taken at, so inserting a layer leaves both pointing at the
       wrong place — which is exactly what the contact sheet caught: all five
       writes here failed and the flutes came out flat, with no refraction at
       all. Re-find both against the finished stack. */
    var glassNow = null, mapNow = null, li;
    for (li = 1; li <= comp.numLayers; li++) {
        var candidate = comp.layer(li);
        if (candidate.name === 'Reeded Glass') glassNow = candidate;
        else if (candidate.name === 'Reeded Lines') mapNow = candidate;
    }

    var dispNow = glassNow ? findFx(glassNow, ['ADBE Displacement Map']) : null;
    if (dispNow && mapNow) {
        LG.set(dispNow, 'Displacement Map Layer', 1, mapNow.index);
        // The map is greyscale, so the red channel is the whole signal.
        LG.set(dispNow, 'Use For Horizontal Displacement', 2, 1);
        LG.set(dispNow, 'Max Horizontal Displacement', 3, vertical ? refraction : 0);
        LG.set(dispNow, 'Use For Vertical Displacement', 4, 1);
        LG.set(dispNow, 'Max Vertical Displacement', 5, vertical ? 0 : refraction);
    } else {
        LG.warn('Reeded Glass: lost the glass or flute layer before wiring refraction');
    }
}

/* The colour field is deliberately soft and slow. Reeded glass is read
   through its flutes; competing detail behind them turns to mush, which is
   what the fractal-noise-plus-Color-blend version did. */
function tuneReededColour(colour, c, ctrl) {
    if (!colour) return;
    lgFractalSet(lgFx(colour, ['ADBE Fractal Noise']), {
        fractalType: 2,
        contrast:    70,
        brightness:  6,
        overflow:    2,                       // Soft Clamp — no banding here
        complexity:  3,
        scale:       num(ctrl.scale, 420),
        speed:       num(ctrl.speed, 14)
    });
    lgToneColors(lgFx(colour, ['CC Toner']), c, true);
    lgBlur(colour, 24);
}

/* Anime water, built on the Cell Pattern engine rather than CC Bubbles.

   The old version stacked two bubble layers, two fractal noise layers and two
   glows, and rendered as a blank white rectangle — the top layer was a white
   solid in Add at full opacity, which adds white to every pixel in the frame.

   Caustics genuinely are a cell pattern: light refracted through a moving
   surface lands as bright veins around dark cells, which is what Cell Pattern
   inverted gives you directly. So this is the Cellular Mosaic construction
   with water settings rather than a stack of its own — one engine, tuned two
   ways, instead of two engines to keep working.

   The defaults are the settings that looked right in the panel: static plates,
   dense, fully dispersed, high contrast for crisp veins, and inverted so the
   walls read as the light rather than the cells. */
var ANIME_WATER_DEFAULTS = {
    pattern:    'Static Plates',
    cells:      91,
    dispersion: 100,
    speed:      30,
    contrast:   325,
    drift:      20,
    warp:       20,
    softness:   0,
    sheen:      23,
    invert:     'On'
};

/* The panel's values win wherever it sent one; anything it did not send falls
   back to the preset's own defaults rather than the mosaic's. */
function lgDefaults(base, ctrl) {
    var merged = {}, k;
    for (k in base) if (base.hasOwnProperty(k)) merged[k] = base[k];
    if (ctrl) {
        for (k in ctrl) {
            if (ctrl.hasOwnProperty(k) && ctrl[k] !== undefined && ctrl[k] !== '') merged[k] = ctrl[k];
        }
    }
    return merged;
}

function tuneAnimeWater(s, c, ctrl) {
    if (!s) return;
    tuneCellularMosaic(s, c, lgDefaults(ANIME_WATER_DEFAULTS, ctrl));
}

/* The flat, graphic end of the cell engine: poster colour inside each cell
   and a drawn line around it, no shading. A 2D background rather than a
   gradient, which is why it lives in the Anime section next to Anime Water
   instead of with the mosaics. */
var ANIME_CELLS_DEFAULTS = {
    pattern:    'Static Plates',
    cells:      120,
    dispersion: 100,
    speed:      0,
    contrast:   400,
    drift:      0,
    warp:       0,
    softness:   0,
    sheen:      0,
    invert:     'On',
    shading:    'Flat'
};

function tuneAnimeCells(s, c, ctrl) {
    if (!s) return;
    tuneCellularMosaic(s, c, lgDefaults(ANIME_CELLS_DEFAULTS, ctrl));
}

/* ── THE LIT SURFACE SHADER ───────────────────────────────────────────
   Everything below this line — every metal, and the frosted glass further
   down — is one idea: build a greyscale *height field*, then hand it to a
   real shader and let the shader work out what the surface looks like.

   This is the correction to how the metals were written before. They tried to
   draw the result: a soft noise field standing in for "where the light is", a
   second noise field in Overlay standing in for "the tooling", and a Glow
   standing in for "the specular". None of those three know about each other,
   so nothing in the frame agreed about where the light was, and the output
   was noise with a gradient behind it rather than a lit object. Turning the
   sliders up made it noisier, not shinier, which is the tell.

   CC Glass and CC Blobbylize are both genuine Blinn–Phong shaders that ship
   with After Effects. They take a bump layer, derive surface normals from it,
   and light it with an ambient / diffuse / specular model that has a Metal
   term — and the Metal term is the thing that was missing. At Metal 100 the
   specular highlight takes the *surface's* colour instead of the light's,
   which is the entire physical difference between gold and a yellow plastic
   toy. That is why gold now reads as gold.

   CC Glass is not in tools/effect_probe_report.txt, so the indices below are
   reasoned from CC Blobbylize's dump in tools/fluid_lab_report.txt, which is
   the same parameter block in the same order. They are the fallback only:
   LG.find resolves by display name first and this host is English, so a wrong
   index cannot be what actually runs. Re-running tools/effect_probe.jsx will
   confirm them — CC Glass is on its list now. */

/* The light and material half of CC Glass. CC Blobbylize and CC Mr. Mercury
   carry the same block under the same names but at different indices, hence
   the offset argument — CC Glass has both a Height and a Displacement where
   Blobbylize has only Cut Away, so everything below Surface sits one later.

   These indices are no longer reasoned from anything. They are the dump in
   tools/effect_probe_report.txt, taken on this machine, and the guess they
   replaced was wrong by exactly that one place. */
function lgShadeSet(fx, o, off) {
    if (!fx) return null;
    var d = (off === undefined) ? 0 : off;

    /* Every one of these is a 0..100 parameter and setValue THROWS past the
       end rather than clamping. That is not a detail: the first contact sheet
       came back with "cannot set 'Specular'" on five of the eight metals, all
       of them the ones asking for more than 100, and a Specular that never
       landed is a metal with no highlight on it. Clamp here, once, rather
       than trusting eight preset tables to stay inside the range. */
    function pc(v, dflt) {
        v = num(v, dflt);
        return v < 0 ? 0 : (v > 100 ? 100 : v);
    }

    LG.set(fx, 'Using',           9 + d,  1);                    // Effect Light
    LG.set(fx, 'Light Intensity', 10 + d, pc(o.intensity, 100));
    LG.set(fx, 'Light Color',     11 + d, o.lightColor || [1, 1, 1]);
    LG.set(fx, 'Light Type',      12 + d, num(o.lightType, 1));  // 1 Distant, 2 Point
    LG.set(fx, 'Light Height',    13 + d, pc(o.lightHeight, 45));
    LG.set(fx, 'Light Direction', 15 + d, num(o.lightAngle, 315));

    /* Ambient is how much of the picture comes through unlit, Diffuse is how
       much the lamp adds. They sum, so an Ambient of 46 with a Diffuse of 55
       is already at 101% before the specular goes on top — which is why the
       first sheet came back as white bands with a few dark lines through
       them. Keeping the pair under about 90 is what leaves headroom for a
       highlight to read as a highlight. */
    LG.set(fx, 'Ambient',   18 + d, pc(o.ambient, 40));
    LG.set(fx, 'Diffuse',   19 + d, pc(o.diffuse, 45));
    LG.set(fx, 'Specular',  20 + d, pc(o.specular, 80));

    /* Roughness is a 0..1 exponent term, not a percentage — the interface
       shows it as 0.100 and the probe confirms it takes no integer clamp.
       The panel's slider is 1..100 because that is a usable range to drag;
       /500 lands it in 0.002 (mirror) to 0.2 (cast iron). */
    LG.set(fx, 'Roughness', 21 + d, Math.max(0.001, num(o.roughness, 10) / 500));

    // The whole reason these read as metal rather than as coloured plastic.
    LG.set(fx, 'Metal',     22 + d, pc(o.metal, 100));
    return fx;
}

/* The surface half of CC Glass: which layer is the height field, how deep it
   is, and how far it bends what is behind it. */
function lgGlassSurface(fx, bumpLayerIndex, o) {
    if (!fx) return null;
    if (bumpLayerIndex) LG.set(fx, 'Bump Map', 2, bumpLayerIndex);
    LG.set(fx, 'Property',     3, 5);                            // Lightness
    LG.set(fx, 'Softness',     4, Math.max(0, num(o.softness, 8)));
    LG.set(fx, 'Height',       5, num(o.height, 40));
    LG.set(fx, 'Displacement', 6, num(o.displacement, 60));
    return fx;
}

/* ── METAL ────────────────────────────────────────────────────────────
   Eight finishes, one builder, two layers each.

     <kind> Height   a hidden greyscale layer: the tooling. Brushed steel is
                     grain smeared along one axis, hammered is dimples, foil
                     is deep creases, mercury is blobs.

     <kind> Metal    what the surface reflects, then the shader on top.

   THE ENVIRONMENT IS THE PRESET. The first version of this gave all eight
   the same reflection — a ramp folded into a triangle wave by Motion Tile —
   and the sheet showed exactly that: eight tiles of straight vertical bands.
   Straight bands are what a *plate* reflects. They are not what liquid metal
   looks like, and liquid metal is what was actually being asked for.

   So there are two environments now, and which one a finish gets is the
   biggest single thing that separates them:

     flow    Fractal Noise with Overflow on Wrap Back, then twisted. Wrap
             Back folds every value that runs past white back down again, so
             the field arrives already banded into closed organic ribbons
             rather than into stripes — and a twist through it is what makes
             those ribbons pour. This is chrome, gold, copper, mercury, foil.

     plate   the folded ramp, few wide bands, barely bent. A flat industrial
             surface reflecting a room. This is brushed steel, gunmetal and
             hammered — and hammered was the one tile on the first sheet that
             already looked like metal, so its numbers are left alone.

   The height field lives in its own comp because CC Glass reads its bump
   layer as a finished image, and a precomp is the only way to be sure the
   grain is there when it is sampled.

   Both layers are built oversized. CC Glass's Displacement pulls pixels in
   from outside the frame, and on a frame-sized layer there is nothing out
   there to pull — which is what turned the first Frosted Glass into a white
   trapezoid on black. A layer 30% larger than the comp always has more of
   itself to give. */
var METAL_SURFACES = {
    Polished: {
        env: 'flow', field: 'noise',
        hWidth: 700, hHeight: 620, hContrast: 50, hComplexity: 2,
        smooth: 6, tilt: 14, metal: 100, ambient: 34, diffuse: 48
    },
    Brushed: {
        /* Wide and very short: the noise is long horizontal filaments before
           the directional blur ever touches it. Blurring along one axis only
           is the whole difference between brushed and mirrored — it smears
           the reflection down the grain and leaves it sharp across it. */
        env: 'plate', field: 'noise',
        hWidth: 1400, hHeight: 3, hContrast: 70, hComplexity: 6,
        brushDirection: 90, smooth: 1, tilt: 10, metal: 100, ambient: 44, diffuse: 46
    },
    Gold: {
        env: 'flow', field: 'noise',
        hWidth: 420, hHeight: 380, hContrast: 90, hComplexity: 3,
        smooth: 8, tilt: 18, metal: 100, ambient: 36, diffuse: 50
    },
    Copper: {
        env: 'flow', field: 'noise',
        hWidth: 480, hHeight: 430, hContrast: 80, hComplexity: 3,
        smooth: 9, tilt: 16, metal: 100, ambient: 36, diffuse: 50
    },
    Gunmetal: {
        /* Sandblasted: fine isotropic grain, and the only finish here that is
           not trying to be shiny. Low specular, high roughness. */
        env: 'plate', field: 'noise',
        hWidth: 90, hHeight: 80, hContrast: 130, hComplexity: 5,
        smooth: 2, tilt: 12, metal: 85, ambient: 50, diffuse: 52
    },
    Hammered: {
        /* Dimples. These numbers came back as the one tile on the first
           contact sheet that already read as a lit metal object, so they are
           the reference the other seven were pulled towards rather than
           something to improve. */
        env: 'plate', field: 'cells', pattern: 'Bubbles',
        cellSize: 90, cellContrast: 150,
        smooth: 5, tilt: 16, metal: 100, ambient: 44, diffuse: 50
    },
    Foil: {
        // Creases: mid-scale, very high contrast, then displaced hard.
        env: 'flow', field: 'noise',
        hWidth: 150, hHeight: 130, hContrast: 300, hComplexity: 4,
        smooth: 2, tilt: 22, metal: 100, ambient: 32, diffuse: 44
    },
    Mercury: {
        /* Blobs. Wrap Back on the height field too, so the droplets arrive as
           closed rounded contours, and a heavy blur rounds them off. */
        env: 'flow', field: 'noise', overflow: 3,
        hWidth: 300, hHeight: 280, hContrast: 200, hComplexity: 2,
        smooth: 22, tilt: 10, metal: 100, ambient: 30, diffuse: 46
    }
};

/* The height field, inside its own comp. */
function tuneMetalHeight(s, ctrl, kind) {
    if (!s) return;
    var spec  = METAL_SURFACES[kind] || METAL_SURFACES.Polished;
    var o     = lgDefaults(spec, ctrl);
    var scale = num(o.scaleAll, 100) / 100;
    var speed = num(o.speed, 6);

    if (o.field === 'cells') {
        var cell = lgFx(s, ['ADBE Cell Pattern']);
        if (cell) {
            LG.set(cell, 'Cell Pattern', 1, 1);                  // Bubbles
            LG.set(cell, 'Contrast',     3, num(o.cellContrast, 150));
            LG.set(cell, 'Disperse',     5, 0.55);
            LG.set(cell, 'Size',         6, Math.max(6, num(o.cellSize, 90) * scale));
            LG.expr(cell, 'Evolution', 13, speed !== 0 ? 'time * ' + (speed * 2) : 'value');
        }
    } else {
        lgFractalSet(lgFxNamed(s, ['ADBE Fractal Noise'], 'Metal Grain'), {
            fractalType: 2,
            contrast:    num(o.hContrast, 80),
            brightness:  0,
            overflow:    num(o.overflow, 2),
            complexity:  num(o.hComplexity, 3),
            scaleWidth:  Math.max(1, num(o.hWidth, 500) * scale),
            scaleHeight: Math.max(1, num(o.hHeight, 500) * scale),
            speed:       speed
        });
    }

    /* Crumple. On mercury this is the churn that keeps the droplets moving
       into and out of each other. */
    var warp = num(o.warp, 0);
    var td = lgFxNamed(s, ['ADBE Turbulent Displace'], 'Metal Crumple');
    if (td) {
        lgTurbSet(td, {
            mode: 4, amount: warp,
            size: Math.max(20, 180 * scale), speed: speed * 0.6
        });
        try { td.enabled = warp > 0; } catch (e) { }
    }

    /* The brush. Applied to the height field rather than to the picture,
       because a brushed surface is a surface whose *shape* runs one way —
       smearing the finished image would only blur the render. */
    var brushLen = num(o.brushLength, 0);
    var brush = lgFxNamed(s, ['ADBE Motion Blur'], 'Metal Brush');
    if (brush) {
        LG.set(brush, 'Direction',   1, num(o.brushDirection, 90));
        LG.set(brush, 'Blur Length', 2, brushLen * scale);
        try { brush.enabled = brushLen > 0; } catch (e) { }
    }

    /* Normals are a derivative, so any pixel-level noise left in the height
       field arrives in the shading multiplied. This blur is not cosmetic. */
    lgBlur(s, Math.max(0.5, num(o.smooth, 5) * scale));
}

/* What the metal reflects, and the shader that lights it. */
function tuneMetalSurface(s, c, ctrl, kind, bumpIndex) {
    if (!s) return;
    /* Read the size off the layer rather than taking the comp's. The layer is
       deliberately larger than the comp (see the note above) so the two are
       not the same number, and a ramp drawn to the comp's width would stop
       part-way across it. */
    var w = 1920, h = 1080;
    try { w = s.width; h = s.height; } catch (e) { }

    var spec   = METAL_SURFACES[kind] || METAL_SURFACES.Polished;
    var o      = lgDefaults(spec, ctrl);
    var speed  = num(o.speed, 6);
    var bands  = Math.max(1, num(o.bands, 5));
    var relief = num(o.relief, 30);
    var sheen  = num(o.sheen, 20);
    var flow   = o.env === 'flow';
    var scale  = num(o.scaleAll, 100) / 100;

    /* 1. The environment — one construction for all eight now.

       WRAP BACK WAS THE HAIRLINES. The previous version built the flowing
       metals out of Fractal Noise with Overflow on Wrap Back. That is the
       right idea for ribbons and the wrong idea here, and the contact sheet
       showed why at 1:1: Wrap Back folds every value that runs past white
       back down again, so the number of dark-to-light cycles in the frame is
       however many times the field's value sweeps through unity. Where the
       field was gently sloping that was a handful. Where the twist had
       compressed it, it was hundreds — and hundreds of hairline cycles
       following the flow contours is a fingerprint, or marbled endpaper. It
       is not metal. The big folds underneath were already right; the rings
       sat on top of them.

       A ramp folded by Motion Tile in Mirror Edges mode gives the same even
       distribution of tones with none of that. It is a triangle wave: exactly
       `bands` cycles, continuous at every fold rather than discontinuous, and
       the count is a number this file chose rather than an emergent property
       of a histogram. Then it gets bent, and how hard it gets bent is the
       whole difference between a plate and a pour:

         plate   barely bent. A flat industrial surface reflecting a room.
         flow    bent hard, at a large size, twice. Large size is the load-
                 bearing word — a displacement whose noise is smaller than the
                 bands shreds them, and one whose noise is much larger than
                 the bands moves them about as whole shapes, which is what
                 pouring looks like. */
    var ramp = lgFxNamed(s, ['ADBE Ramp'], 'Metal Ramp');
    if (ramp) {
        LG.set(ramp, 'Start of Ramp', 1, [0, 0]);
        LG.set(ramp, 'End of Ramp',   3, [w, h * (num(o.tilt, 14) / 100)]);
        LG.set(ramp, 'Start Color',   2, [0, 0, 0]);
        LG.set(ramp, 'End Color',     4, [1, 1, 1]);
    }

    /* Sliding Tile Center rather than Phase — Phase offsets alternate tiles
       against each other and shears the reflection instead of drifting it. */
    var tile = lgFxNamed(s, ['ADBE Tile'], 'Metal Fold');
    if (tile) {
        LG.set(tile, 'Tile Width',    2, 100 / bands);
        LG.set(tile, 'Tile Height',   3, 100);
        LG.set(tile, 'Output Width',  4, 100);
        LG.set(tile, 'Output Height', 5, 100);
        LG.set(tile, 'Mirror Edges',  6, true);
        LG.expr(tile, 'Tile Center', 1, speed !== 0
            ? '[value[0] + time * ' + (speed * 6) + ', value[1]]'
            : 'value');
    }

    /* Anything a previous version of this file left behind. A layer built
       before the hairlines were diagnosed still carries the wrap-back field,
       and an effect nobody sets any more is an effect nobody turns off. */
    var stale = lgFxNamed(s, ['ADBE Fractal Noise'], 'Metal Flow');
    if (stale) { try { stale.enabled = false; } catch (e) { } }

    /* 2. Bend it. Twist Smoother rather than Twist: plain Twist winds tight
          spirals whose centres compress the bands into a vortex, and a vortex
          is the other thing the first sheet was full of. */
    var twist = lgFxNamed(s, ['ADBE Turbulent Displace'], 'Metal Twist');
    var twistAmt = flow ? 70 + num(o.warp, 0) * 0.25 : 0;
    if (twist) {
        lgTurbSet(twist, {
            mode: 6, amount: twistAmt,
            size: Math.max(300, 1100 * scale), speed: speed * -0.2
        });
        try { twist.enabled = twistAmt > 0; } catch (e) { }
    }

    var env = lgFxNamed(s, ['ADBE Turbulent Displace'], 'Metal Environment');
    var envAmt = flow ? 260 + num(o.warp, 0) * 0.8 : num(o.warp, 0) * 0.6;
    if (env) {
        lgTurbSet(env, {
            mode: 4, amount: envAmt,
            size: Math.max(240, (flow ? 620 : 300) * scale), speed: speed * 0.3
        });
        try { env.enabled = envAmt > 0; } catch (e) { }
    }

    // 3. The palette, in role order: Shadow, Base Metal, Bright, Highlight.
    lgToneColors(lgFx(s, ['CC Toner']), c, true);

    // 4. The shader.
    var glass = lgFx(s, ['CC Glass']);
    if (glass) {
        lgGlassSurface(glass, bumpIndex, {
            softness:     Math.max(1, relief * 0.12),
            height:       relief,
            /* Displacement is what bends the reflection over the tooling.
               Kept well inside the layer's own overhang so it can never pull
               from beyond the layer and leave a transparent edge. */
            displacement: relief * 0.8
        });
        var specular = num(o.specular, 80);
        lgShadeSet(glass, {
            intensity:   60 + specular * 0.35,
            lightAngle:  num(o.lightAngle, 315),
            lightHeight: num(o.lightHeight, 45),
            ambient:     num(o.ambient, 40),
            diffuse:     num(o.diffuse, 45),
            specular:    specular,
            roughness:   num(o.roughness, 10),
            metal:       num(o.metal, 100)
        });
    }

    // 5. Bloom on the specular, then the optional final soften.
    var g = lgFxNamed(s, ['ADBE Glo2'], 'Metal Bloom');
    if (g) {
        LG.set(g, 'Glow Threshold', 2, Math.max(0, 100 - sheen * 0.4));
        LG.set(g, 'Glow Radius',    3, 12 + sheen * 0.9);
        LG.set(g, 'Glow Intensity', 4, sheen / 110);
        LG.set(g, 'Glow Colors',    7, 1);                       // Original Colors
        try { g.enabled = sheen > 0; } catch (e) { }
    }

    lgBlur(s, num(o.softness, 0));
}

/* Both layers are built 30% larger than the comp so the shader's
   displacement always has image to pull from. See the note on METAL_SURFACES. */
function lgOversize(n) { return Math.round(n * 1.3); }

function buildMetalTexture(comp, c, ctrl, w, h, dur, kind) {
    var fps = comp.frameRate;
    var OW = lgOversize(w), OH = lgOversize(h);

    // 1. The height field, in its own comp.
    var heightComp = app.project.items.addComp(kind + ' Height Map', OW, OH, 1, dur, fps);
    var heightSolid = heightComp.layers.addSolid([0.5, 0.5, 0.5], 'Height', OW, OH, 1, dur);
    tuneMetalHeight(heightSolid, ctrl, kind);

    // 2. Both layers into the target comp, height first so it ends up below.
    var bump = comp.layers.add(heightComp);
    bump.name = kind + ' Height';
    bump.enabled = false;            // a bump source, not a picture

    comp.layers.addSolid([0.5, 0.5, 0.5], kind + ' Metal', OW, OH, 1, dur);

    /* 3. Only now is the stack final, so only now is the bump index safe.

       An ExtendScript layer reference is bound to the index it was taken at,
       and CC Glass stores its Bump Map as an index rather than as a pointer.
       Reeded Glass lost its refraction to exactly this: the source was
       assigned before a later layer shifted everything down by one. Re-find
       both against the finished stack. */
    var metalNow = null, bumpNow = null, i;
    for (i = 1; i <= comp.numLayers; i++) {
        if (comp.layer(i).name === kind + ' Metal')  metalNow = comp.layer(i);
        else if (comp.layer(i).name === kind + ' Height') bumpNow = comp.layer(i);
    }
    if (metalNow) tuneMetalSurface(metalNow, c, ctrl, kind, bumpNow ? bumpNow.index : 0);
}

/* ── ANIMAL PRINTS ────────────────────────────────────────────────────
   Five presets, one builder.

   Every animal print is the same two steps: make a field, then cut it at a
   threshold so what is below reads as coat and what is above reads as
   marking. Only the field differs — a tessellation for the giraffe, whose
   markings tile the whole coat, and stretched or clumped noise for the four
   whose markings sit on a background.

   WHAT WAS WRONG. Four of the five rendered as a solid dark frame and the
   giraffe — the one that uses no noise at all — was fine. That split is the
   clue, and the arithmetic says why.

   Fractal Noise outputs 0.5 + (v - 0.5) * contrast/100 + brightness/100,
   clipped. With contrast pinned at 400, the value of v at which the output
   crosses CC Toner's coat/marking switch sits only about 0.03 away from the
   middle of the field — so the share of the frame that comes out as marking
   is decided almost entirely by where the field's mean happens to be. Sweep
   that mean from 0.50 to 0.75 and the old Zebra settings go from 38% marking
   to 99% marking. 99% marking is a black frame.

   The field was Fractal Type 2, Turbulent Smooth, and the turbulent family is
   built on folded noise: its mean sits well above mid-grey rather than on it.
   (That is not a new finding here — it is the same bias already documented in
   lgFractalSet, where it was diagnosed as the cause of an all-yellow frame.)
   So the old build was landing in the right-hand end of that sweep.

   Fractal Type 1, Basic, is plain fBm and is symmetric about mid-grey by
   construction. That is the fix, and it is a structural property rather than
   a tuned number, which is why it is the one worth relying on.

   It is also why Coverage exists. The threshold is genuinely sensitive at the
   contrast a hard-edged print needs, so the panel now exposes it directly:
   Coverage *is* the cut, and one drag corrects anything the field's own
   statistics do that this file guessed wrong. The slider it replaced —
   "Stripe Weight" — drove Contrast, and contrast cannot move a threshold. It
   can only steepen the edge at whichever threshold you already have, which on
   a frame that is already 99% one colour does nothing at all.

   None of them are static any more either. Every one has an evolution speed
   above zero by default: these are backgrounds, not swatches. */
var ANIMAL_PRINTS = {
    Giraffe: {
        field: 'cells',
        /* Not inverted, and this is the correction the first sheet asked for.
           Static Plates puts the plate faces high and the seams between them
           low. Inverting that made the seams the marking and the faces the
           coat, so the tile came back as a cream frame with thin brown
           netting on it — the exact photographic negative of a giraffe, whose
           patches are the large shapes and whose cream is the thin line
           between them. The cells were also about half the size they should
           be at 1920 across. */
        pattern: 'Static Plates', invert: false,
        size: 320, disperse: 1.0,
        coverage: 66, contrast: 400, warp: 25, warpSize: 200, softness: 5, speed: 5
    },
    Tiger: {
        field: 'noise',
        /* Tall and narrow: features stretched hugely in Y and squeezed in X
           are stripes running down the body. */
        scaleWidth: 25, scaleHeight: 700, complexity: 3,
        coverage: 34, contrast: 340, warp: 70, warpSize: 140, softness: 2, speed: 6
    },
    Zebra: {
        field: 'noise',
        // Same construction, broader bands and a stronger wave through them.
        scaleWidth: 45, scaleHeight: 900, complexity: 2,
        coverage: 45, contrast: 400, warp: 110, warpSize: 240, softness: 2, speed: 5
    },
    Leopard: {
        field: 'noise', rosette: true,
        /* The rosette is the three-stop mapping, not a second pattern: a
           blob's shoulder lands in the ring band and its peak lands in the
           core band, so each spot comes out as a dark ring with a lighter
           centre.

           At a scale of 70 with four octaves the blobs came out as grit —
           every rosette was a few pixels across and the ring and the core had
           nowhere to sit. A spot needs to be big enough to have an inside. */
        scaleWidth: 190, scaleHeight: 175, complexity: 3,
        coverage: 34, contrast: 170, warp: 30, warpSize: 140, softness: 3, speed: 4
    },
    Cow: {
        field: 'noise',
        // Large and barely thresholded: a few big irregular patches.
        scaleWidth: 300, scaleHeight: 260, complexity: 2,
        coverage: 42, contrast: 400, warp: 40, warpSize: 320, softness: 4, speed: 3
    },
    /* FUR — the accident, made deliberate.

       This is Turbulent Displace used the way nothing else in this file uses
       it: Size down at 3 instead of the usual 150, Amount up at 900 instead
       of the usual 70. A displacement whose noise is finer than the shapes it
       is pushing does not bend those shapes, it shreds their edges into
       filaments — and filaments the length of the Amount, all leaning the way
       the Twist mode turns them, is fur.

       The base underneath it is an ordinary two-tone print, which is what
       gives the pelt its darker undercoat showing through. */
    Fur: {
        field: 'noise', fur: true,
        scaleWidth: 260, scaleHeight: 230, complexity: 3,
        coverage: 45, contrast: 180,
        warpMode: 3, warp: 900, warpSize: 3,
        softness: 1, speed: 3
    }
};
/* Where to sit Fractal Noise's Brightness so that `coverage` per cent of the
   frame ends up above the threshold.

   Fractal Noise outputs 0.5 + (v - 0.5) * contrast/100 + brightness/100, so
   the value of v at which the output crosses a given level is exact
   arithmetic rather than a guess — which is the point. `mid` is the output
   level the colour mapping switches at, and the 0.55 is the practical spread
   of Basic noise: it very rarely reaches the last 20% at either end, so a
   coverage of 5 or 95 has to land inside that band to do anything at all. */
function lgPrintBias(coverage, contrast, mid) {
    var d = (0.5 - num(coverage, 50) / 100) * 0.55;
    return (mid - 0.5) * 100 - d * num(contrast, 300);
}

/* CC Toner's five stops, set directly. */
function lgToneStops(toner, stops) {
    if (!toner) return null;
    LG.set(toner, 'Tones',      1, 3);                       // Pentone
    LG.set(toner, 'Shadows',    6, stops[0]);
    LG.set(toner, 'Darktones',  5, stops[1]);
    LG.set(toner, 'Midtones',   4, stops[2]);
    LG.set(toner, 'Brights',    3, stops[3]);
    LG.set(toner, 'Highlights', 2, stops[4]);
    return toner;
}

function tuneAnimalPrint(s, c, ctrl, species) {
    if (!s) return;
    var spec  = ANIMAL_PRINTS[species] || ANIMAL_PRINTS.Giraffe;
    var o     = lgDefaults(spec, ctrl);
    var scale = num(o.scaleAll, 100) / 100;      // one slider over the whole print
    var speed = num(o.speed, 4);
    var cov   = num(o.coverage, 50);
    var contrast = num(o.contrast, 300);

    var coat = lgRole(c, 0, [1, 1, 1]);
    var mark = lgRole(c, 1, [0, 0, 0]);

    if (o.field === 'cells') {
        var cell = lgFx(s, ['ADBE Cell Pattern']);
        if (cell) {
            var patternMap = {
                'Bubbles': 1, 'Crystals': 2, 'Plates': 3, 'Crystallize': 4,
                'Static Plates': 7, 'Static Crystals': 8, 'Static Crystallize': 9,
                'Mixed Crystals': 12, 'Static Mixed Crystals': 13
            };
            LG.set(cell, 'Cell Pattern', 1, patternMap[o.pattern] || 7);
            LG.set(cell, 'Invert',       2, o.invert !== false && o.invert !== 'Off');
            LG.set(cell, 'Contrast',     3, contrast);
            LG.set(cell, 'Disperse',     5, num(o.disperse, 1));
            LG.set(cell, 'Size',         6, Math.max(6, num(o.size, 150) * scale));
            LG.expr(cell, 'Evolution', 13, speed !== 0 ? 'time * ' + speed : 'value');
        }

        /* Cell Pattern has no brightness, so coverage cannot bias the field
           the way it can on noise. It moves the threshold instead, by picking
           which of the five stops the coat runs out at — coarse, in steps of
           a fifth, but it is the honest control rather than a decorative
           one. */
        var k = Math.round(5 * (1 - cov / 100));
        if (k < 1) k = 1; else if (k > 4) k = 4;
        var stops = [], si;
        for (si = 0; si < 5; si++) stops.push(si < k ? coat : mark);
        lgToneStops(lgFx(s, ['CC Toner']), stops);

    } else if (o.rosette) {
        /* Three stops. Coat below, the ring at the blob's shoulder, the core
           at its peak — so the switch the coverage slider aims at is the
           lower of the two, at 0.375 of the output range. */
        var ring = lgRole(c, 1, [0.2, 0.1, 0.03]);
        var core = lgRole(c, 2, [0.66, 0.46, 0.18]);

        lgFractalSet(lgFx(s, ['ADBE Fractal Noise']), {
            fractalType: 1,                       // Basic — symmetric about mid
            contrast:    contrast,
            brightness:  lgPrintBias(cov, contrast, 0.375),
            overflow:    1,                       // hard clip; this is a print
            complexity:  num(o.complexity, 4),
            scaleWidth:  num(o.scaleWidth, 100) * scale,
            scaleHeight: num(o.scaleHeight, 100) * scale,
            speed:       speed
        });
        lgToneStops(lgFx(s, ['CC Toner']), [coat, coat, ring, core, core]);

    } else {
        lgFractalSet(lgFx(s, ['ADBE Fractal Noise']), {
            fractalType: 1,
            contrast:    contrast,
            brightness:  lgPrintBias(cov, contrast, 0.625),
            overflow:    1,
            complexity:  num(o.complexity, 3),
            scaleWidth:  num(o.scaleWidth, 100) * scale,
            scaleHeight: num(o.scaleHeight, 100) * scale,
            speed:       speed
        });
        lgToneStops(lgFx(s, ['CC Toner']), [coat, coat, coat, mark, mark]);
    }

    /* The wobble. Markings that follow a perfectly regular field read as
       printed fabric; a little displacement is what makes them read as grown.

       It sits after the colour rather than before it so that displacing the
       field cannot drag the threshold around with it — the print is already
       flat colour by the time this runs, so this only bends the shapes. */
    var warp = num(o.warp, 0);
    var td = lgFx(s, ['ADBE Turbulent Displace']);
    if (td) {
        /* The size floor is 2, not 20. Fur lives below 20 — that is the whole
           trick of it — and a floor of 20 would quietly turn every pelt back
           into a wobble. */
        lgTurbSet(td, {
            mode:   num(o.warpMode, 1),
            amount: warp,
            size:   Math.max(2, num(o.warpSize, 150) * scale),
            speed:  speed * (o.fur ? 0.08 : 0.3)
        });
        try { td.enabled = warp > 0; } catch (e) { }
    }

    lgBlur(s, num(o.softness, 3) * scale);
}

function buildAnimalPrint(comp, c, ctrl, w, h, dur, species) {
    var s = comp.layers.addSolid([1, 1, 1], species + ' Print', w, h, 1, dur);
    tuneAnimalPrint(s, c, ctrl, species);
}

function buildAnimeCells(comp, c, ctrl, w, h, dur) {
    var s = comp.layers.addSolid([1, 1, 1], 'Anime Cells', w, h, 1, dur);
    tuneAnimeCells(s, c, ctrl);
}

function buildAnimeWater(comp, c, ctrl, w, h, dur) {
    var s = comp.layers.addSolid([1, 1, 1], 'Anime Water', w, h, 1, dur);
    tuneAnimeWater(s, c, ctrl);
}

// ── METALLIC GRADIENT ──
/* Metal, in four finishes.

   The light field is a ramp, not noise. That is the important part and it is
   why the previous two attempts failed: noise has no predictable distribution,
   so pushing its contrast piles the histogram up at one end and whatever
   gradient map is downstream paints the whole frame one colour. A linear
   black-to-white ramp is uniform by construction. Fold it with Motion Tile in
   Mirror Edges mode and it becomes an even triangle wave — light and dark
   bands, each tone getting an equal share of the frame. That is also what a
   reflective surface physically is: a bright-dark-bright environment, the
   bands compressing where the surface curves.

   The four finishes are not four presets over one look. Each switches real
   stages on and off:

     Chrome        wide bands, heavy warp, hard tonal falloff, no blur.
     Iridescent    many bands, the palette at full saturation, and a
                   two-colour Glow that shifts hue across every fold.
     Brushed       fine bands plus a Directional Blur along the grain — the
                   anisotropic streak is the entire difference between a
                   brushed surface and a mirrored one.
     Y2K Chrome    few bands, warp off, and stepped tone stops so the
                   horizon lands as a hard graphic edge.

   Stages are added once and switched with `enabled` rather than added and
   removed, so the effect order on the layer never changes underneath a live
   update. */

var METAL_FINISHES = {
    'Chrome':     { warp: 1.0, brush: 0,   irid: false, hard: false, blur: 0.4 },
    'Iridescent': { warp: 0.7, brush: 0,   irid: true,  hard: false, blur: 1.0 },
    'Brushed':    { warp: 0.35, brush: 1,  irid: false, hard: false, blur: 0.6 },
    'Y2K Chrome': { warp: 0,   brush: 0,   irid: false, hard: true,  blur: 0.2 }
};

function buildMetallic(comp, c, ctrl, w, h, dur) {
    var s = comp.layers.addSolid([0.5, 0.5, 0.5], 'Metallic', w, h, 1, dur);
    tuneMetallic(s, c, ctrl, w, h);
}

function tuneMetallic(s, c, ctrl, w, h) {
    if (!s) return;
    if (!w) { try { w = s.width;  } catch (e) { w = 1920; } }
    if (!h) { try { h = s.height; } catch (e) { h = 1080; } }

    var fin = METAL_FINISHES[ctrl.finish] || METAL_FINISHES['Chrome'];

    var bands  = Math.max(2, num(ctrl.bands, 6));
    var speed  = num(ctrl.speed, 20);
    var tilt   = num(ctrl.tilt, 12);
    var ripple = num(ctrl.ripple, 180) * fin.warp;
    var rScale = num(ctrl.rippleScale, 260);
    var swirl  = num(ctrl.swirl, 70) * fin.warp;
    var sheen  = num(ctrl.sheen, 45);
    var soft   = num(ctrl.softness, 2) * fin.blur;

    // 1. A uniformly distributed light field.
    var ramp = lgFx(s, ['ADBE Ramp']);
    if (ramp) {
        LG.set(ramp, 'Start of Ramp', 1, [0, 0]);
        LG.set(ramp, 'End of Ramp',   3, [w, h * (tilt / 100)]);
        LG.set(ramp, 'Start Color',   2, [0, 0, 0]);
        LG.set(ramp, 'End Color',     4, [1, 1, 1]);
    }

    /* 2. Fold it. Mirror Edges is a checkbox, so the alternating flip cannot
          resolve to the wrong option. Sliding Tile Center rather than Phase
          moves the whole field evenly — Phase offsets alternate tiles against
          each other and shears the reflection instead of drifting it. */
    var tile = lgFx(s, ['ADBE Tile']);
    if (tile) {
        LG.set(tile, 'Tile Width',    2, 100 / bands);
        LG.set(tile, 'Tile Height',   3, 100);
        LG.set(tile, 'Output Width',  4, 100);
        LG.set(tile, 'Output Height', 5, 100);
        LG.set(tile, 'Mirror Edges',  6, true);
        LG.expr(tile, 'Tile Center', 1, speed !== 0
            ? '[value[0] + time * ' + (speed * 5) + ', value[1]]'
            : 'value');
    }

    // 3. Bend the bands. Foil becomes chrome here, or stays flat for Y2K.
    var rip = lgFxNamed(s, ['ADBE Turbulent Displace'], 'Metal Ripple');
    lgTurbSet(rip, { mode: 1, amount: ripple, size: Math.max(20, rScale), speed: speed * 0.35 });
    if (rip) { try { rip.enabled = ripple > 0; } catch (e) { } }

    var swl = lgFxNamed(s, ['ADBE Turbulent Displace'], 'Metal Swirl');
    lgTurbSet(swl, { mode: 3, amount: swirl, size: Math.max(20, rScale * 2.5), speed: speed * -0.2 });
    if (swl) { try { swl.enabled = swirl > 0; } catch (e) { } }

    /* 4. The grain. Blurring along one axis only is what makes a surface read
          as brushed rather than polished — it smears the reflection in the
          direction of the tooling and leaves it sharp across it. */
    var brush = lgFxNamed(s, ['ADBE Motion Blur'], 'Metal Brush');
    if (brush) {
        LG.set(brush, 'Direction',   1, 90 + (tilt * 0.9));
        LG.set(brush, 'Blur Length', 2, 55);
        try { brush.enabled = fin.brush > 0; } catch (e) { }
    }

    // 5. Colour. Stepped for Y2K, blended for everything else.
    lgToneColors(lgFx(s, ['CC Toner']), c, true, fin.hard);

    /* 6. Specular. Iridescence comes from a Glow told to use two colours of
          its own instead of the image's: the bloom then shifts hue across each
          fold, which is the oil-slick read. Ordinary metal glows in its own
          colours. */
    var g = lgFxNamed(s, ['ADBE Glo2'], 'Metal Sheen');
    if (g) {
        LG.set(g, 'Glow Threshold', 2, Math.max(0, 100 - sheen * 0.8));
        LG.set(g, 'Glow Radius',    3, 20 + sheen * 1.1);
        LG.set(g, 'Glow Intensity', 4, sheen / 55);
        LG.set(g, 'Glow Colors',    7, fin.irid ? 2 : 1);   // 2 = A & B Colors
        if (fin.irid) {
            var pal = lgRamp5(c);
            LG.set(g, 'Color Looping', 8, 3);               // Triangle A>B>A
            LG.set(g, 'Color Loops',   9, 3);
            LG.set(g, 'Color A',      12, pal[4]);
            LG.set(g, 'Color B',      13, pal[1]);
        }
        try { g.enabled = sheen > 0; } catch (e) { }
    }

    lgBlur(s, soft);
}

// ============================================
// SHARED: SHAPING LIGHT, THEN COLOURING IT
// ============================================

/* Every gradient in this section is built the same way: make a moving
   greyscale field, then map that field onto the user's four colours.

   That split is the fix for the whole class of "it just looks like a normal
   gradient" bugs. The old builders took a smooth four-colour ramp and pushed
   it through Turbulent Displace — but a displaced smooth gradient is still a
   smooth gradient. Nothing in it can fold, band, or catch a highlight,
   because there is no structure in it to move. Fractal Noise with Overflow
   set to "Wrap Back" has that structure: values that run past white fold
   back down, so the field arrives already banded into ribbons, and displacing
   *those* reads as liquid. */

/* Rec.709 luminance of an AE [r, g, b] triple. */
function lgLuma(rgb) {
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

/* Move a colour toward another one. Multiplying a colour to brighten it drives
   whichever channel is already highest into the clip and the hue collapses to
   a primary — #FFCC00 scaled by 1.4 is pure yellow. Mixing toward white keeps
   the hue and only lifts the value. */
function lgMix(rgb, target, t) {
    var out = [], i, v;
    for (i = 0; i < 3; i++) {
        v = rgb[i] + (target[i] - rgb[i]) * t;
        out.push(v < 0 ? 0 : (v > 1 ? 1 : v));
    }
    return out;
}


/* Darkest first. A palette is four colours picked in whatever order they were
   picked; a gradient map needs them in tonal order or the mapping reads as
   noise rather than as light. The colours themselves are untouched — only
   which tonal stop each one lands on. */
function lgByLuma(c) {
    var out = [], i, j, t;
    for (i = 0; i < c.length; i++) out.push(c[i]);
    for (i = 1; i < out.length; i++) {
        for (j = i; j > 0 && lgLuma(out[j]) < lgLuma(out[j - 1]); j--) {
            t = out[j]; out[j] = out[j - 1]; out[j - 1] = t;
        }
    }
    return out;
}

/* CC Toner is the only gradient map in stock After Effects that scripting can
   actually drive. Colorama looks like the right tool and is not: its Output
   Cycle has no settable value type, which is why the Cellular Mosaic build
   quietly dropped it. */
/* CC Toner has five fixed stops, and a gradient can now arrive with two
   colours or six. Resample the palette across those five in Oklab, so a
   two-colour palette produces a genuine ramp rather than the same colour
   repeated, and a six-colour one is not truncated to the first four. */
function lgRamp5(c) {
    var out = [], i, t, idx, n = c.length;
    if (n === 0) return [[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]];
    if (n === 1) { for (i = 0; i < 5; i++) out.push(c[0]); return out; }
    for (i = 0; i < 5; i++) {
        t = (i / 4) * (n - 1);
        idx = Math.floor(t);
        if (idx > n - 2) idx = n - 2;
        out.push(interpolateOklab(c[idx], c[idx + 1], t - idx));
    }
    return out;
}

/* `ordered` means the palette already runs dark to light because the gradient
   declared named roles for its slots — Metallic's Shadow / Base / Bright /
   Highlight. Without roles there is no way to know the intended order, so it
   is inferred from luminance. */
function lgToneColors(toner, c, ordered, hard) {
    if (!toner) return null;
    var src = ordered ? c : lgByLuma(c);
    var s = hard ? lgSteps5(src) : lgRamp5(src);
    LG.set(toner, 'Tones',      1, 3);                       // 3 = Pentone (probe grid 4)
    LG.set(toner, 'Shadows',    6, s[0]);
    LG.set(toner, 'Darktones',  5, s[1]);
    LG.set(toner, 'Midtones',   4, s[2]);
    LG.set(toner, 'Brights',    3, s[3]);
    LG.set(toner, 'Highlights', 2, s[4]);
    return toner;
}

/* Same five stops, but stepped instead of blended — neighbouring stops repeat
   so the boundaries stay hard. This is what separates graphic Y2K chrome from
   a soft metal. */
function lgSteps5(c) {
    var out = [], i, n = c.length;
    for (i = 0; i < 5; i++) {
        out.push(c[Math.min(n - 1, Math.floor(i * n / 5))]);
    }
    return out;
}

/* Find an effect on a layer, or apply it. Builders and live updates share
   their parameter code through this: the first run adds the stack in order,
   every later run finds what is already there. */
/* One named colour slot. Sunburst and Halftone declare what each of their
   colours is for — Ray A, Ray B, Backdrop — so the builder can use them by
   role instead of sorting the palette by luminance and hoping the darkest one
   was meant to be the background. Older saved gradients still arrive with four
   unlabelled colours, hence the fallback. */
function lgRole(c, i, fallback) {
    if (c && c.length > i) return c[i];
    return fallback;
}

function lgFx(layer, names) {
    var fx = findFx(layer, names);
    return fx ? fx : addFx(layer, names);
}

/* An effect identified by the name this panel gave it. A builder that applies
   the same effect twice cannot tell the two apart otherwise — lgFx hands back
   the first match both times, so the second set of values silently overwrites
   the first and one of the two stages never exists. */
function lgFxNamed(layer, names, label) {
    var effects = null, i, ef;
    try { effects = layer.property('Effects'); } catch (e) { return null; }
    for (i = 1; i <= effects.numProperties; i++) {
        ef = null;
        try { ef = effects.property(i); } catch (e) { continue; }
        if (ef && ef.name === label) return ef;
    }
    var added = addFx(layer, names);
    if (added) { try { added.name = label; } catch (e) { } }
    return added;
}

/* Fractal Noise, configured from the probe dump rather than from memory.

   The important correction: an effect's parameter groups are decoration, not
   structure. "Transform" reports zero children and Scale, Scale Width and
   Rotation sit at indices 8-12 as siblings of it — so every
   fn.property('Transform').property('Scale') this file used resolved to
   nothing and failed silently inside a try/catch. Not one scale or stretch
   setting on any of these gradients was ever applied, which is most of why
   they all came out as the same undifferentiated cloud.

   Indices are from tools/effect_probe_report.txt on this machine. */
function lgFractalSet(fn, o) {
    if (!fn) return null;

    /* The turbulent fractal types are bright-biased: they render as light
       cloud with dark veins, mean well above mid-grey. Raise Contrast without
       pulling Brightness down to match and the field clips to white, which
       downstream means every pixel lands on the gradient map's top stop and
       the render comes out one flat colour. That was the yellow frame. */
    var contrast = num(o.contrast, 120);
    var brightness = (o.brightness !== undefined)
        ? o.brightness
        : -(contrast - 100) * 0.22;
    var scale = num(o.scale, 150);

    LG.set(fn, 'Fractal Type', 1, o.fractalType || 2);   // 2 = Turbulent Smooth
    LG.set(fn, 'Noise Type',   2, 4);                    // 4 = Spline
    LG.set(fn, 'Contrast',     4, contrast);
    LG.set(fn, 'Brightness',   5, brightness);
    LG.set(fn, 'Overflow',     6, o.overflow || 1);      // 1 Clip, 2 Soft Clamp, 3 Wrap Back
    LG.set(fn, 'Complexity',  16, num(o.complexity, 4));

    if (o.rotation !== undefined) LG.set(fn, 'Rotation', 8, o.rotation);

    if (o.scaleWidth !== undefined || o.scaleHeight !== undefined) {
        LG.set(fn, 'Uniform Scaling', 9, false);
        LG.set(fn, 'Scale Width',  11, num(o.scaleWidth, scale));
        LG.set(fn, 'Scale Height', 12, num(o.scaleHeight, scale));
    } else {
        LG.set(fn, 'Uniform Scaling', 9, true);
        LG.set(fn, 'Scale', 10, scale);
    }

    if (o.subInfluence !== undefined) {
        LG.set(fn, 'Sub Influence (%)', 18, o.subInfluence);
    }

    var speed = num(o.speed, 20);
    LG.expr(fn, 'Evolution', 24, speed !== 0 ? 'time * ' + speed : 'value');
    return fn;
}


/* Displacement modes are 1 Turbulent, 2 Bulge, 3 Twist, 4 Turbulent Smoother,
   5 Bulge Smoother, 6 Twist Smoother. */
function lgTurbSet(td, o) {
    if (!td) return null;
    LG.set(td, 'Displacement', 1, o.mode || 1);
    LG.set(td, 'Amount',       2, num(o.amount, 100));
    LG.set(td, 'Size',         3, Math.max(1, num(o.size, 100)));
    if (o.complexity !== undefined) LG.set(td, 'Complexity', 5, o.complexity);
    var speed = num(o.speed, 20);
    LG.expr(td, 'Evolution', 6, speed !== 0 ? 'time * ' + speed : 'value');
    return td;
}

function lgBlur(layer, radius) {
    var b = lgFx(layer, ['ADBE Box Blur2']);
    if (!b) return null;
    LG.set(b, 'Blur Radius', 1, Math.max(0, radius));
    LG.set(b, 'Repeat Edge Pixels', 4, true);
    return b;
}

function lgGlow(layer, amount, radiusScale) {
    var g = lgFx(layer, ['ADBE Glo2']);
    if (!g) return null;
    /* The panel's global Glow slider finds its own effect by the display name
       "Glow". Renaming this one keeps the two from overwriting each other
       every time either slider moves. */
    try { g.name = 'LG Sheen'; } catch (e) { }
    LG.set(g, 'Glow Threshold', 2, Math.max(0, 100 - amount * 0.7));
    LG.set(g, 'Glow Radius',    3, amount * (radiusScale || 1.5));
    LG.set(g, 'Glow Intensity', 4, amount / 60);
    return g;
}

/* Five Oklab-interpolated stops between the ends of a palette.

   A Gradient Fill's "Colors" is a CUSTOM_VALUE property and setValue will not
   take a plain array for it — that is the "gradient stops rejected" warning,
   and the same silently-caught attempt has been sitting in buildOklabSmooth
   all along. CC Toner is the way through: a black-to-white ramp carries the
   shape, and Toner maps its five stops onto colours that scripting *can* set.
   The interpolation still happens in Oklab, so a red-to-cyan fade still avoids
   the brown middle that a straight sRGB line goes through. */
function lgOklabRamp(layer, c, w, h, angleDeg, radial) {
    if (!layer) return null;

    var rad = (angleDeg || 0) * Math.PI / 180;
    var cx = w / 2, cy = h / 2;
    var reach = radial
        ? Math.max(w, h) * 0.55
        : (Math.abs(Math.cos(rad)) * w + Math.abs(Math.sin(rad)) * h) * 0.5;

    var ramp = lgFx(layer, ['ADBE Ramp']);
    if (ramp) {
        if (radial) {
            LG.set(ramp, 'Start of Ramp', 1, [cx, cy]);
            LG.set(ramp, 'End of Ramp',   3, [cx + reach, cy]);
        } else {
            LG.set(ramp, 'Start of Ramp', 1, [cx - Math.cos(rad) * reach, cy - Math.sin(rad) * reach]);
            LG.set(ramp, 'End of Ramp',   3, [cx + Math.cos(rad) * reach, cy + Math.sin(rad) * reach]);
        }
        LG.set(ramp, 'Start Color', 2, [0, 0, 0]);
        LG.set(ramp, 'End Color',   4, [1, 1, 1]);
        LG.set(ramp, 'Ramp Shape',  5, radial ? 2 : 1);
    }

    lgFx(layer, ['CC Toner']);
    lgOklabToneStops(layer, c);
    return ramp;
}

/* The five stops themselves. Split out of lgOklabRamp so that changing the
   palette on a layer that already exists re-maps the colours without
   rebuilding the black-to-white ramp carrying them. */
/* A speed slider is not a number of seconds, and it kept being used as one.

   Several builders wrote `setValueAtTime(speed, ...)` — putting the second
   keyframe at `speed` seconds. Two things go wrong. At speed 0 that keyframe
   lands exactly on top of the one at t=0, and `loopOut("pingpong")` across a
   pair of coincident keys steps instead of moves: that is the flicker. And
   where it does not collide, the slider runs backwards — a higher "speed"
   puts the keyframe further away, so the motion is slower.

   One cycle length, derived from the speed, floored so the keys can never
   coincide and capped so the slowest setting still moves within a normal comp. */
function lgCycleTime(speed) {
    var sp = Math.abs(num(speed, 20));
    if (sp < 0.001) return 8;                 // "stopped" means slow, not broken
    return Math.max(0.4, Math.min(30, 120 / sp));
}

function lgOklabToneStops(layer, c) {
    var toner = layer ? findFx(layer, ['CC Toner']) : null;
    if (!toner) return null;

    var n = c.length, segs = (n > 1) ? n - 1 : 1, i, t, seg, idx, stops = [];
    for (i = 0; i < 5; i++) {
        t = i / 4;
        seg = t * segs;
        idx = Math.min(Math.floor(seg), segs - 1);
        stops.push(interpolateOklab(c[idx % n], c[(idx + 1) % n], seg - idx));
    }
    LG.set(toner, 'Tones',      1, 3);          // 3 = Pentone
    LG.set(toner, 'Shadows',    6, stops[0]);
    LG.set(toner, 'Darktones',  5, stops[1]);
    LG.set(toner, 'Midtones',   4, stops[2]);
    LG.set(toner, 'Brights',    3, stops[3]);
    LG.set(toner, 'Highlights', 2, stops[4]);
    return toner;
}

/* Four colours at the corners, each drifting on its own phase. Corners rather
   than inset points, so the gradient still covers the frame at full drift. */
function lgGradientPoints(fx, c, w, h, speed) {
    if (!fx) return null;
    var ov = Math.max(w, h) * 0.35;
    var pts = [[-ov, -ov], [w + ov, -ov], [-ov, h + ov], [w + ov, h + ov]];
    var amp = Math.max(w, h) * 0.12;
    var f = [1.0, 1.2, 0.7, 0.9];
    for (var i = 0; i < 4; i++) {
        LG.set(fx, 'Point ' + (i + 1), null, pts[i]);
        LG.set(fx, 'Color ' + (i + 1), null, c[i % c.length]);
        if (speed > 0) {
            LG.expr(fx, 'Point ' + (i + 1), null,
                'var s = time * ' + (speed / 60) + ';' +
                '[value[0] + Math.sin(s * ' + f[i] + ') * ' + amp + ', ' +
                'value[1] + Math.cos(s * ' + f[(i + 1) % 4] + ') * ' + amp + ']');
        }
    }
    return fx;
}

// ============================================
// NEW PROCEDURAL GRADIENTS
// ============================================

/* Rays are geometry, so they are drawn as geometry.

   The previous build bent Venetian Blinds through Polar Coordinates, and
   Polar Coordinates' Interpolation refused to set — leaving the effect at 0%,
   which does nothing at all. What rendered was the raw Venetian Blinds pass:
   flat diagonal stripes. One wedge plus a Repeater has nothing to resolve at
   runtime, the ray count is exact, and the edges stay hard, which is what
   makes it read as a cartoon sunburst rather than a soft radial gradient. */
/* One wedge, pointing right, long enough to clear the farthest corner from
   wherever the centre has been placed. Shared so that dragging Ray Count
   reshapes the existing layer instead of needing a rebuild. */
function lgSunburstWedge(cx, cy, w, h, rays, thickness) {
    var reach = 0, corners = [[0, 0], [w, 0], [0, h], [w, h]], i, dx, dy, d;
    for (i = 0; i < 4; i++) {
        dx = corners[i][0] - cx; dy = corners[i][1] - cy;
        d = Math.sqrt(dx * dx + dy * dy);
        if (d > reach) reach = d;
    }
    reach *= 1.15;

    var step = 360 / rays;
    var half = (step * thickness / 100) / 2 * Math.PI / 180;

    var shape = new Shape();
    shape.vertices = [
        [0, 0],
        [reach * Math.cos(-half), reach * Math.sin(-half)],
        [reach * Math.cos(half),  reach * Math.sin(half)]
    ];
    shape.inTangents  = [[0, 0], [0, 0], [0, 0]];
    shape.outTangents = [[0, 0], [0, 0], [0, 0]];
    shape.closed = true;

    return { shape: shape, step: step, reach: reach };
}

/* Live counterpart of buildSunburst: everything except the layer stack. */
function tuneSunburst(raysLayer, ctrl, w, h) {
    if (!raysLayer) return;
    var rays      = Math.max(3, Math.round(num(ctrl.rays, 18)));
    var thickness = Math.min(95, Math.max(5, num(ctrl.thickness, 50)));
    var rotSpeed  = num(ctrl.rotationSpeed, 15);
    var pulse     = num(ctrl.pulse, 0);
    var cx = w * num(ctrl.centerX, 50) / 100;
    var cy = h * num(ctrl.centerY, 50) / 100;
    var geom = lgSunburstWedge(cx, cy, w, h, rays, thickness);

    try { raysLayer.property('Transform').property('Position').setValue([cx, cy]); } catch (e) { }
    ex(raysLayer.property('Transform').property('Rotation'),
       rotSpeed !== 0 ? 'time * ' + rotSpeed : 'value');
    ex(raysLayer.property('Transform').property('Scale'),
       pulse > 0 ? 'var s = 100 + (1 + Math.sin(time * 2.2)) * ' + (pulse * 0.25) + '; [s, s]' : 'value');

    try {
        var gc = raysLayer.property('Contents').property('Ray').property('Contents');
        gc.property('ADBE Vector Shape - Group').property('Path').setValue(geom.shape);
        var rep = gc.property('ADBE Vector Filter - Repeater');
        rep.property('Copies').setValue(rays);
        rep.property('Transform').property('Rotation').setValue(geom.step);
    } catch (e) {
        LG.warn('Sunburst: ray count needs a rebuild');
    }

    lgBlur(raysLayer, num(ctrl.softness, 0) * 0.6);
}

/* The rays alternate between two colours; the third slot is the backdrop and
   must not leak into the wedges. */
function lgRayColors(c) {
    return [lgRole(c, 0, [1, 1, 1]), lgRole(c, 1, lgRole(c, 0, [1, 1, 1]))];
}

function buildSunburst(comp, c, ctrl, w, h, dur) {
    var rays      = Math.max(3, Math.round(num(ctrl.rays, 18)));
    var thickness = Math.min(95, Math.max(5, num(ctrl.thickness, 50)));
    var rotSpeed  = num(ctrl.rotationSpeed, 15);
    var pulse     = num(ctrl.pulse, 0);
    var softness  = num(ctrl.softness, 0);
    var coreSize  = num(ctrl.coreSize, 0);
    var cx = w * num(ctrl.centerX, 50) / 100;
    var cy = h * num(ctrl.centerY, 50) / 100;

    comp.layers.addSolid(lgRole(c, 2, lgByLuma(c)[0]), 'Sunburst Backdrop', w, h, 1, dur);

    var colour = comp.layers.addSolid([1, 1, 1], 'Sunburst Colour', w, h, 1, dur);
    lgGradientPoints(addFx(colour, ['ADBE 4ColorGradient']), lgRayColors(c), w, h, 20);

    var raysLayer = comp.layers.addShape();
    raysLayer.name = 'Sunburst Rays';
    try {
        raysLayer.property('Transform').property('Anchor Point').setValue([0, 0]);
        raysLayer.property('Transform').property('Position').setValue([cx, cy]);
    } catch (e) { }

    var geom = lgSunburstWedge(cx, cy, w, h, rays, thickness);
    var step = geom.step;

    var contents = raysLayer.property('Contents');
    var grp = contents.addProperty('ADBE Vector Group');
    grp.name = 'Ray';
    var gc = grp.property('Contents');

    var pathGroup = gc.addProperty('ADBE Vector Shape - Group');
    try { pathGroup.property('Path').setValue(geom.shape); } catch (e) {
        LG.warn('Sunburst: could not set the ray path');
    }

    var fill = gc.addProperty('ADBE Vector Graphic - Fill');
    try { fill.property('Color').setValue([1, 1, 1]); } catch (e) { }

    // The Repeater sits below the path and the fill, so it copies both.
    var rep = gc.addProperty('ADBE Vector Filter - Repeater');
    try {
        rep.property('Copies').setValue(rays);
        var rt = rep.property('Transform');
        rt.property('Position').setValue([0, 0]);
        rt.property('Anchor Point').setValue([0, 0]);
        rt.property('Rotation').setValue(step);
    } catch (e) {
        LG.warn('Sunburst: could not configure the ray repeater');
    }

    if (coreSize > 0) {
        var cgrp = contents.addProperty('ADBE Vector Group');
        cgrp.name = 'Centre Disc';
        var cgc = cgrp.property('Contents');
        var disc = Math.min(w, h) * coreSize / 100;
        var ell = cgc.addProperty('ADBE Vector Shape - Ellipse');
        try { ell.property('Size').setValue([disc, disc]); } catch (e) { }
        var cfill = cgc.addProperty('ADBE Vector Graphic - Fill');
        try { cfill.property('Color').setValue([1, 1, 1]); } catch (e) { }
    }

    if (rotSpeed !== 0) {
        ex(raysLayer.property('Transform').property('Rotation'), 'time * ' + rotSpeed);
    }
    /* The pulse only ever grows the rays. Letting it shrink them pulls the
       wedges back inside the frame and shows the backdrop at the corners. */
    if (pulse > 0) {
        ex(raysLayer.property('Transform').property('Scale'),
           'var s = 100 + (1 + Math.sin(time * 2.2)) * ' + (pulse * 0.25) + '; [s, s]');
    }
    if (softness > 0) lgBlur(raysLayer, softness * 0.6);

    setTrackMatteSafely(colour, raysLayer, 'ALPHA');
}

function buildLiquidWaves(comp, c, ctrl, w, h, dur) {
    var s = comp.layers.addSolid([0.5, 0.5, 0.5], 'Liquid Waves', w, h, 1, dur);
    tuneLiquidWaves(s, c, ctrl);
}

/* Banded ribbons that fold through each other. Contrast is exposed as "Band
   Density" because that is what it does once Overflow is wrapping: each extra
   turn of contrast pushes another fold of the noise past white and back down,
   and each fold is another ribbon. */
function tuneLiquidWaves(s, c, ctrl) {
    if (!s) return;
    var speed = num(ctrl.speed, 30);
    var scale = num(ctrl.scale, 260);

    lgFractalSet(lgFx(s, ['ADBE Fractal Noise']), {
        fractalType: 2,
        contrast:    num(ctrl.bands, 200),
        brightness:  0,
        overflow:    3,                          // Wrap Back — this is the effect
        complexity:  num(ctrl.complexity, 4),
        scale:       scale,
        scaleWidth:  scale * 1.6,
        subInfluence: 70,
        speed:       speed * 0.6
    });
    lgTurbSet(lgFx(s, ['ADBE Turbulent Displace']), {
        mode:   3,                               // Twist
        amount: num(ctrl.turbulence, 140),
        size:   Math.max(20, scale * 0.7),
        speed:  speed * 0.4
    });
    lgToneColors(lgFx(s, ['CC Toner']), c, true);
    lgBlur(s, num(ctrl.blur, 6));
}

function buildCellularMosaic(comp, c, ctrl, w, h, dur) {
    var s = comp.layers.addSolid([1, 1, 1], 'Cellular Mosaic', w, h, 1, dur);
    tuneCellularMosaic(s, c, ctrl);
}

/* Cell Pattern, coloured through CC Toner rather than through a Color-mode
   layer stacked on top. The old stack washed out to near-white: Color mode
   takes its luminance from the layer below, and a bubble field is nearly all
   highlight, so there was almost no luminance left to take. */
function tuneCellularMosaic(s, c, ctrl) {
    if (!s) return;
    /* Probe grid 5 renders all 13 options. Tubular (5), Pillow (6) and Static
       Pillow (11) come out as flat grey at any size worth using, so they are
       not offered — a menu entry that produces nothing is worse than a
       shorter menu. */
    var patternMap = {
        'Bubbles': 1, 'Crystals': 2, 'Plates': 3, 'Crystallize': 4,
        'Static Plates': 7, 'Static Crystals': 8, 'Static Crystallize': 9,
        'Mixed Crystals': 12, 'Static Mixed Crystals': 13
    };
    var pv    = patternMap[ctrl.pattern] || 1;
    var cells = num(ctrl.cells, 50);
    var speed = num(ctrl.speed, 80);
    var drift = num(ctrl.drift, 60);

    var cell = lgFx(s, ['ADBE Cell Pattern']);
    if (cell) {
        LG.set(cell, 'Cell Pattern', 1, pv);
        LG.set(cell, 'Invert',       2, ctrl.invert === 'On');
        /* Property 3 is named "Contextual Slider" — it is Contrast or
           Sharpness depending on the pattern, so only the index finds it. */
        LG.set(cell, 'Contrast',     3, num(ctrl.contrast, 140));
        LG.set(cell, 'Disperse',     5, num(ctrl.dispersion, 50) / 100);
        LG.set(cell, 'Size',         6, Math.max(6, 250 - cells));
        LG.expr(cell, 'Offset', 7, drift > 0
            ? '[value[0] + time * ' + drift + ', value[1] + Math.sin(time * 0.4) * ' + drift + ']'
            : 'value');
        LG.expr(cell, 'Evolution', 13, speed !== 0 ? 'time * ' + speed : 'value');
    }

    lgTurbSet(lgFx(s, ['ADBE Turbulent Displace']), {
        mode: 4, amount: num(ctrl.warp, 30), size: 200, speed: speed * 0.3
    });
    /* Flat maps the palette as five hard steps instead of a ramp, which is
       what turns this from a shaded mosaic into a flat 2D background — poster
       colour with a drawn line around each cell, no gradient inside it. */
    lgToneColors(lgFx(s, ['CC Toner']), c, true, ctrl.shading === 'Flat');
    lgBlur(s, num(ctrl.softness, 4));
    lgGlow(s, num(ctrl.sheen, 20), 1.5);
}

// ============================================
// SONDUCKFILM TUTORIAL GRADIENTS
// ============================================

function buildSonduckLiquid(comp, c, ctrl, w, h, dur) {
    var fps = comp.frameRate;
    var speed = ctrl.speed !== undefined ? parseFloat(ctrl.speed) : 20;

    var shapesComp = app.project.items.addComp("Sonduck Shapes", w, h, 1, dur, fps);
    var nullLayer = shapesComp.layers.addNull(dur);
    nullLayer.name = "Animation Null";

    for (var i = 0; i < 15; i++) {
        var isWhite = i < 8;
        var starColor = isWhite ? [1,1,1] : [0,0,0];
        var star = shapesComp.layers.addShape();
        var contents = star.property("Contents");
        var grp = contents.addProperty("ADBE Vector Group");
        var gc = grp.property("Contents");
        var path = gc.addProperty("ADBE Vector Shape - Star");
        safeSet(path, "Type", 1, 1);
        safeSet(path, "Points", 2, 5);
        safeSet(path, "Inner Radius", 4, 100);
        safeSet(path, "Outer Radius", 5, 250);
        var fill = gc.addProperty("ADBE Vector Graphic - Fill");
        safeSet(fill, "Color", 4, starColor);
        
        star.property("Transform").property("Position").setValue([Math.random() * w, Math.random() * h]);
        star.parent = nullLayer;
    }
    
    var adj = shapesComp.layers.addSolid([1,1,1], "Repetile", w, h, 1, dur);
    adj.adjustmentLayer = true;
    var repeTile = addFx(adj, ["CC RepeTile"]);
    if (repeTile) {
        safeSet(repeTile, "Expand Right", 1, 4000);
        safeSet(repeTile, "Expand Left", 2, 4000);
        safeSet(repeTile, "Expand Down", 3, 2000);
        safeSet(repeTile, "Expand Up", 4, 2000);
    }
    safeEx(nullLayer.property("Transform").property("Position"), "var s = time * " + (speed * 50) + "; [value[0] - s, value[1]]");

    var bg = comp.layers.addSolid([0.1, 0, 0.2], "Background", w, h, 1, dur);
    var shapesLayer = comp.layers.add(shapesComp);
    shapesLayer.name = "Sonduck Shapes";
    
    var tint = addFx(shapesLayer, ["Tint", "ADBE Tint"]);
    if (tint) {
        safeSet(tint, "Map Black To", 1, c[0]);
        safeSet(tint, "Map White To", 2, c[1]);
    }
    
    var dirBlur = addFx(shapesLayer, ["Directional Blur", "ADBE Directional Blur"]);
    if (dirBlur) {
        safeSet(dirBlur, "Direction", 1, 30);
        safeSet(dirBlur, "Blur Length", 2, 700);
    }
    
    var twirl = addFx(shapesLayer, ["Twirl", "ADBE Twirl"]);
    if (twirl) {
        safeSet(twirl, "Angle", 1, 60);
        safeSet(twirl, "Twirl Radius", 2, 60);
    }
}

function buildTwirlShapes(comp, c, ctrl, w, h, dur) {
    var fps = comp.frameRate;
    var speed = ctrl.speed !== undefined ? parseFloat(ctrl.speed) : 20;

    var shapesComp = app.project.items.addComp("Twirl Shapes", w, h, 1, dur, fps);
    var nullLayer = shapesComp.layers.addNull(dur);

    for (var i = 0; i < 20; i++) {
        var isWhite = i % 2 === 0;
        var shapeColor = isWhite ? [1,1,1] : [0,0,0];
        var star = shapesComp.layers.addShape();
        var contents = star.property("Contents");
        var grp = contents.addProperty("ADBE Vector Group");
        var gc = grp.property("Contents");
        var path = gc.addProperty("ADBE Vector Shape - Star");
        safeSet(path, "Type", 1, 2);
        safeSet(path, "Points", 2, 6);
        safeSet(path, "Outer Radius", 4, 150 + Math.random() * 150);
        var fill = gc.addProperty("ADBE Vector Graphic - Fill");
        safeSet(fill, "Color", 4, shapeColor);
        
        star.property("Transform").property("Position").setValue([Math.random() * w, Math.random() * h]);
        star.parent = nullLayer;
    }
    
    var adj = shapesComp.layers.addSolid([1,1,1], "Repetile", w, h, 1, dur);
    adj.adjustmentLayer = true;
    var repeTile = addFx(adj, ["CC RepeTile"]);
    if (repeTile) {
        safeSet(repeTile, "Expand Right", 1, 4000);
        safeSet(repeTile, "Expand Left", 2, 4000);
        safeSet(repeTile, "Expand Down", 3, 2000);
        safeSet(repeTile, "Expand Up", 4, 2000);
    }
    safeEx(nullLayer.property("Transform").property("Position"), "var s = time * " + (speed * 30) + "; [value[0] + Math.cos(s)*500, value[1] + Math.sin(s)*500]");

    comp.layers.addSolid([0, 0, 0], "Background", w, h, 1, dur);
    var shapesLayer = comp.layers.add(shapesComp);
    shapesLayer.name = "Twirl Shapes";
    
    var tint = addFx(shapesLayer, ["Tint", "ADBE Tint"]);
    if (tint) {
        safeSet(tint, "Map Black To", 1, c[0]);
        safeSet(tint, "Map White To", 2, c[1]);
    }
    
    var dirBlur = addFx(shapesLayer, ["Directional Blur", "ADBE Directional Blur"]);
    if (dirBlur) {
        safeSet(dirBlur, "Direction", 1, -45);
        safeSet(dirBlur, "Blur Length", 2, 500);
    }
    
    var twirl = addFx(shapesLayer, ["Twirl", "ADBE Twirl"]);
    if (twirl) {
        safeSet(twirl, "Angle", 1, -120);
        safeSet(twirl, "Twirl Radius", 2, 80);
    }
}

function buildLavaLamp(comp, c, ctrl, w, h, dur) {
    var speed = ctrl.speed !== undefined ? parseFloat(ctrl.speed) : 15;

    var s = comp.layers.addSolid([0,0,0], "Lava Lamp", w, h, 1, dur);
    var repeTile = addFx(s, ["CC RepeTile"]);
    if (repeTile) {
        safeSet(repeTile, "Expand Right", 1, 2000);
        safeSet(repeTile, "Expand Left", 2, 1000);
        safeSet(repeTile, "Expand Down", 3, 1000);
        safeSet(repeTile, "Expand Up", 4, 1000);
    }
    
    var g4 = addFx(s, ['4-Color Gradient', '4 Color Gradient', 'ADBE 4-Color Gradient']);
    if (g4) {
        for (var i = 0; i < 4; i++) {
            safeSet(g4, 'Color ' + (i + 1), null, c[i % c.length]);
            safeEx(g4, 'Point ' + (i + 1), null, 'wiggle(0.5, 500)');
        }
    }
    
    var fn = addFx(s, ['Fractal Noise', 'ADBE FractalNoise']);
    if (fn) {
        safeSet(fn, 'Noise Type',    2, 1);
        safeSet(fn, 'Contrast',      4, 200);
        safeSet(fn, 'Brightness',    5, -30);
        safeSet(fn, 'Complexity',   16, 1);
        safeSet(fn, 'Blending Mode', 31, 5);

        /* Fractal Noise's "Transform" is a topic marker in the DOM, not a
           group with children — Rotation and the Scale pair are siblings of
           it at the top level. Reaching through it set nothing at all, which
           is why this rendered as a flat tiled check instead of a lamp.
           Indices from tools/effect_probe_report.txt. */
        safeSet(fn, 'Rotation',        8, -35);
        safeEx(fn,  'Rotation',        8, 'time * ' + speed);
        safeSet(fn, 'Uniform Scaling', 9, false);
        safeSet(fn, 'Scale Width',    11, 1300);
        safeSet(fn, 'Scale Height',   12, 600);

        safeEx(fn, 'Evolution', 24, 'time * ' + (speed * 10));
    }
    
    var twirl = addFx(s, ["Twirl", "ADBE Twirl"]);
    if (twirl) {
        safeSet(twirl, "Angle", 1, 230);
        safeSet(twirl, "Twirl Radius", 2, 35);
    }
}

function buildStackedSquares(comp, c, ctrl, w, h, dur) {
    var speed = ctrl.speed !== undefined ? parseFloat(ctrl.speed) : 20;

    var s = comp.layers.addSolid([1,1,1], "Stacked Background", w, h, 1, dur);
    try { s.property("Transform").property("Scale").setValue([250, 250]); } catch(e) {}
    safeEx(s.property("Transform").property("Rotation"), "time * " + (speed * 0.75));

    var g4 = addFx(s, ['4-Color Gradient', '4 Color Gradient', 'ADBE 4-Color Gradient']);
    if (g4) {
        for (var i = 0; i < 4; i++) {
            safeSet(g4, 'Color ' + (i + 1), null, c[i % c.length]);
            safeEx(g4, 'Point ' + (i + 1), null, 'wiggle(0.5, 500)');
        }
    }
    
    var mt = addFx(s, ['ADBE Tile']);
    if (mt) {
        safeSet(mt, 'Output Width', 1, 150);
        safeSet(mt, 'Output Height', 2, 150);
        safeSet(mt, 'Mirror Edges', 3, true);
    }
    
    var twirl1 = addFx(s, ["Twirl", "ADBE Twirl"]);
    if (twirl1) {
        safeSet(twirl1, "Angle", 1, 280);
        safeSet(twirl1, "Twirl Radius", 2, 50);
    }
    var twirl2 = addFx(s, ["Twirl", "ADBE Twirl"]);
    if (twirl2) {
        safeSet(twirl2, "Angle", 1, -250);
        safeSet(twirl2, "Twirl Radius", 2, 30);
    }
    
    var baseSize = Math.min(w, h) * 0.2;
    for (var j = 5; j >= 1; j--) {
        var sq = comp.layers.addShape();
        sq.name = "Square " + j;
        var contents = sq.property("Contents");
        var grp = contents.addProperty("ADBE Vector Group");
        var gc = grp.property("Contents");
        var path = gc.addProperty("ADBE Vector Shape - Rect");
        safeSet(path, "Size", 2, [baseSize, baseSize]);
        /* Proportional, not a fixed 50px. At delivery size 50px is a soft
           corner on a 216px square; at a quarter of that it is a circle, and
           the shape stops being a square at all. */
        safeSet(path, "Roundness", 3, baseSize * 0.23);
        var fill = gc.addProperty("ADBE Vector Graphic - Fill");
        safeSet(fill, "Color", 4, [1,1,1]);
        
        sq.property("Transform").property("Position").setValue([w/2, h/2]);
        var scaleVal = Math.pow(1.8, j-1) * 100;
        sq.property("Transform").property("Scale").setValue([scaleVal, scaleVal]);
        
        var rotOffset = (j - 1) * 2;
        safeEx(sq.property("Transform").property("Rotation"), "time * " + speed + " - " + rotOffset);
        
        var drop = addFx(sq, ["Drop Shadow", "ADBE Drop Shadow"]);
        if (drop) {
            safeSet(drop, "Opacity", 2, 255);
            safeSet(drop, "Distance", 4, 0);
            safeSet(drop, "Softness", 5, 200);
        }
        
        if (j !== 3) {
            try { sq.blendingMode = BlendingMode.MULTIPLY; } catch(e) {}
        } else {
            var g4_copy = addFx(sq, ['4-Color Gradient', '4 Color Gradient', 'ADBE 4-Color Gradient']);
            if (g4_copy) {
                for (var i = 0; i < 4; i++) {
                    safeSet(g4_copy, 'Color ' + (i + 1), null, c[(i+1) % c.length]);
                    safeEx(g4_copy, 'Point ' + (i + 1), null, 'wiggle(0.5, 500)');
                }
            }
        }
    }
}
function buildTrailGradient(comp, c, ctrl, w, h, dur) {
    /* Vertical strokes whose gradient scrolls at slightly different speeds,
       so the bank of them reads as a travelling wave.

       Rebuilt on stock effects only. The previous version preferred Plugin
       Everything's Thick Stroke and fell back to a Motion Tile path that was
       broken twice over: it applied CC RepeTile instead of Motion Tile, and
       set "Start Point"/"End Point" on Gradient Ramp, which owns neither. */

    var strokeWidth = ctrl.width !== undefined ? parseFloat(ctrl.width) : 60;
    if (strokeWidth < 4) strokeWidth = 4;
    var numStrokes  = Math.ceil(w / strokeWidth) + 4;
    var startCycle  = ctrl.cycleSpeed !== undefined ? parseFloat(ctrl.cycleSpeed) : 600;
    var cycleOffset = 20;

    var precomp = app.project.items.addComp("Trail Base", w, h, 1, dur, comp.frameRate);

    for (var i = 0; i < numStrokes; i++) {
        var cycleSpeed = startCycle - (i * cycleOffset);
        var xPos = (i - Math.floor(numStrokes / 2)) * strokeWidth + (w / 2);

        var s = precomp.layers.addSolid([1, 1, 1], "Trail " + i, strokeWidth, h, 1, dur);

        var ramp = addFx(s, ["ADBE Ramp"]);
        if (ramp) {
            // Gradient Ramp's points are "Start of Ramp" / "End of Ramp".
            safeSet(ramp, "Start of Ramp", 1, [strokeWidth / 2, 0]);
            safeSet(ramp, "Start Color",   2, [0, 0, 0, 1]);
            safeSet(ramp, "End of Ramp",   3, [strokeWidth / 2, h / 2]);
            safeSet(ramp, "End Color",     4, [1, 1, 1, 1]);
        }

        var tile = addFx(s, ["ADBE Tile"]);
        if (tile) {
            safeSet(tile, "Output Height", 5, 400);
            safeSet(tile, "Mirror Edges",  6, true);
            safeEx(tile, "Tile Center", 1,
                   "[value[0], value[1] + (time * " + cycleSpeed + ")]");
        }

        try { s.property("Transform").property("Position").setValue([xPos, h / 2]); }
        catch (e) { LG.warn("TrailGradient: cannot position stroke " + i); }
    }

    var finalLayer = comp.layers.add(precomp);
    finalLayer.name = "Trail Animation";

    /* Map the greyscale trail onto the four picked colours. CC Toner is the
       cleanest stock route: it maps luminance across five tonal stops. */
    var toner = addFx(finalLayer, ["CC Toner"]);
    if (toner) {
        var c1 = c[0],
            c2 = c[1] || c[0],
            c3 = c[2] || c[1] || c[0],
            c4 = c[3] || c[2] || c[0];
        safeSet(toner, "Tones",      1, 3);   // Pentatone
        safeSet(toner, "Highlights", 2, c1);
        safeSet(toner, "Brights",    3, c2);
        safeSet(toner, "Midtones",   4, c3);
        safeSet(toner, "Darktones",  5, c4);
        safeSet(toner, "Shadows",    6, c1);
    } else {
        // No Cycore on this host — tint the extremes instead of leaving it grey.
        var tint = addFx(finalLayer, ["ADBE Tint"]);
        if (tint) {
            safeSet(tint, "Map Black To", 1, c[3] || c[0]);
            safeSet(tint, "Map White To", 2, c[0]);
        }
    }

    var warp = addFx(finalLayer, ["ADBE WRPMESH"]);
    if (warp) {
        // Warp Style is a 1-based dropdown; 14 = Squeeze (13 is Inflate).
        safeSet(warp, "Warp Style", 1, 14);
        var bend = ctrl.bend !== undefined ? parseFloat(ctrl.bend) : 30;
        safeSet(warp, "Bend", 3, bend);
    }
}

// --- WEB STUDIO CLONES ---

function buildPrismaticBurst(comp, c, ctrl, w, h, dur) {
    var speed = ctrl.speed !== undefined ? parseFloat(ctrl.speed) : 100;
    var rayCount = ctrl.rayCount !== undefined ? parseFloat(ctrl.rayCount) : 5;
    var distort = ctrl.distort !== undefined ? parseFloat(ctrl.distort) : 250;

    var c1 = c[0] || [1,0,0];
    var c2 = c[1] || [0,1,0];
    var c3 = c[2] || [0,0,1];
    var c4 = c[3] || [1,1,0];

    // Bottom Layer: Gradient
    var gradLayer = comp.layers.addSolid([1,1,1], "Prismatic Colors", w, h, 1, dur);
    gradLayer.startTime = 0;
    
    var ramp = addFx(gradLayer, ["ADBE 4-Color Gradient", "4-Color Gradient"]);
    if (ramp) {
        var pts = [[w*0.1, h*0.1], [w*0.9, h*0.1], [w*0.1, h*0.9], [w*0.9, h*0.9]];
        for (var i = 0; i < 4; i++) {
            safeSet(ramp, "Point " + (i+1), null, pts[i]);
            var col = (i===0?c1:i===1?c2:i===2?c3:c4);
            safeSet(ramp, "Color " + (i+1), null, col);
            safeEx(ramp, "Point " + (i+1), null, "wiggle(" + (speed/50) + ", " + (w/4) + ")");
        }
    }

    /* Top Layer: Rays (Matte)

       Square, and as wide as the frame's diagonal. Rect-to-Polar wraps the
       layer into a disc inscribed in it, so a frame-sized layer gives a circle
       of rays floating on black with the corners empty — which is exactly what
       the contact sheet showed. Sized to the diagonal, the disc covers the
       frame. */
    var diag = Math.ceil(Math.sqrt(w * w + h * h));
    var rayLayer = comp.layers.addSolid([1,1,1], "Prismatic Rays Matte", diag, diag, 1, dur);
    rayLayer.startTime = 0;
    try {
        rayLayer.property("Transform").property("Position").setValue([w / 2, h / 2]);
    } catch (e) { }
    
    var noise = addFx(rayLayer, ["ADBE Fractal Noise", "Fractal Noise"]);
    if (noise) {
        safeSet(noise, "Fractal Type", 1, 1); // Dynamic
        safeSet(noise, "Noise Type",   2, 1); // Block
        safeSet(noise, "Contrast",     4, 300);
        safeSet(noise, "Brightness",   5, 0);
        safeSet(noise, "Complexity",  16, 4);

        /* Same as Lava Lamp: "Transform" and "Sub Settings" are topic markers
           with no children. The rays are made entirely by the extreme
           width-to-height ratio below, so reaching through an empty group is
           the difference between rays and undifferentiated block noise. */
        safeSet(noise, "Uniform Scaling", 9, false);
        safeSet(noise, "Scale Width",    11, rayCount * 2);
        safeSet(noise, "Scale Height",   12, 4000);

        safeEx(noise, "Evolution", 24, "time * " + speed);

        // The parameter is called "Sub Influence (%)" on the host.
        safeSet(noise, "Sub Influence (%)", 18, distort / 5);
    }
    
    var polar = addFx(rayLayer, ["ADBE Polar Coordinates", "Polar Coordinates"]);
    if (polar) {
        // Interpolation is a checkbox, not a percentage — 100 was rejected.
        safeSet(polar, "Interpolation", 1, true);
        safeSet(polar, "Type of Conversion", 2, 1); // Rect to Polar
    }

    // Apply Track Matte
    try {
        gradLayer.setTrackMatte(rayLayer, TrackMatteType.LUMA);
    } catch(e) {
        try { gradLayer.trackMatteType = TrackMatteType.LUMA; } catch(e2) {}
    }
}

function buildAntigravity(comp, c, ctrl, w, h, dur) {
    var count = ctrl.count !== undefined ? parseFloat(ctrl.count) : 300;
    var speed = ctrl.waveSpeed !== undefined ? parseFloat(ctrl.waveSpeed) : 0.4;
    var pSize = ctrl.particleSize !== undefined ? parseFloat(ctrl.particleSize) : 2;

    var color1 = c[0] || [1, 0.62, 0.98]; // #FF9FFC
    var color2 = c[1] || [0.32, 0.15, 1]; // #5227FF

    var bg = comp.layers.addSolid([0.07, 0.05, 0.09], "Background Void", w, h, 1, dur);
    
    var emitterLayer = comp.layers.addSolid([0,0,0], "Antigravity Particles", w, h, 1, dur);
    emitterLayer.blendingMode = BlendingMode.ADD;
    
    var pw = addFx(emitterLayer, ["CC Particle World"]);
    if (pw) {
        safeSet(pw, "Birth Rate", null, count / 100);
        safeSet(pw, "Longevity (sec)", null, 4);
        
        // Emitter
        safeSetGroup(pw, "Producer", "Radius X", null, 0.2);
        safeSetGroup(pw, "Producer", "Radius Y", null, 0.2);
        
        // Physics
        safeSetGroup(pw, "Physics", "Velocity", null, speed);
        safeSetGroup(pw, "Physics", "Gravity", null, 0); // Antigravity!
        safeSetGroup(pw, "Physics", "Resistance", null, 0.5);
        
        // Particle
        safeSetGroup(pw, "Particle", "Particle Type", null, 2); // Line
        safeSetGroup(pw, "Particle", "Birth Size", null, pSize / 10);
        safeSetGroup(pw, "Particle", "Death Size", null, 0);
        safeSetGroup(pw, "Particle", "Size Variation", null, 100);
        safeSetGroup(pw, "Particle", "Max Opacity", null, 100);
        safeSetGroup(pw, "Particle", "Birth Color", null, color1);
        safeSetGroup(pw, "Particle", "Death Color", null, color2);
    }
    
    var glow = addFx(emitterLayer, ["ADBE Glo2"]);
    if (glow) {
        safeSet(glow, "Glow Threshold", 2, 30);   // particles are dim; bite early
        safeSet(glow, "Glow Radius",    3, 50);
        safeSet(glow, "Glow Intensity", 4, 1.5);
    }
}

function buildWaves(comp, c, ctrl, w, h, dur) {
    var speedX = ctrl.waveSpeedX !== undefined ? parseFloat(ctrl.waveSpeedX) : 0.02;
    var ampX = ctrl.waveAmpX !== undefined ? parseFloat(ctrl.waveAmpX) : 40;
    var xGap = ctrl.xGap !== undefined ? parseFloat(ctrl.xGap) : 12;
    
    var color = c[0] || [0.32, 0.15, 1]; // #5227FF

    var bg = comp.layers.addSolid([0.07, 0.05, 0.09], "Background", w, h, 1, dur);
    
    var linesLayer = comp.layers.addShape();
    linesLayer.name = "Wave Lines";
    
    var contents = linesLayer.property("Contents");
    var grp = contents.addProperty("ADBE Vector Group");
    var gc = grp.property("Contents");
    
    var path = gc.addProperty("ADBE Vector Shape - Group");
    var pathData = new Shape();
    pathData.vertices = [[0, -h], [0, h*2]];
    pathData.inTangents = [[0,0], [0,0]];
    pathData.outTangents = [[0,0], [0,0]];
    pathData.closed = false;
    path.property("Path").setValue(pathData);
    
    var stroke = gc.addProperty("ADBE Vector Graphic - Stroke");
    safeSet(stroke, "Color", null, color);
    safeSet(stroke, "Stroke Width", null, 1.5);
    
    var repeater = gc.addProperty("ADBE Vector Filter - Repeater");
    safeSet(repeater, "Copies", null, Math.ceil((w*2) / xGap));
    var repTransform = repeater.property("Transform");
    safeSet(repTransform, "Position", null, [xGap, 0]);
    
    linesLayer.property("Transform").property("Position").setValue([-w/2, 0]);
    
    var turb = addFx(linesLayer, ["ADBE Turbulent Displace", "Turbulent Displace"]);
    if (turb) {
        // A dropdown, and its options are 1-based; 0 was out of range.
        safeSet(turb, "Displacement", 1, 1); // Turbulent
        safeSet(turb, "Amount", null, ampX * 2);
        safeSet(turb, "Size", null, 250);
        safeSet(turb, "Complexity", null, 1.5);
        safeEx(turb, "Evolution", null, "time * " + (speedX * 5000));
        safeEx(turb, "Offset (Turbulence)", null, "[value[0], value[1] - time * 200]");
    }
}

function buildWebThreads(comp, c, ctrl, w, h, dur) {
    var speed = ctrl.speed !== undefined ? parseFloat(ctrl.speed) : 0.4;
    var threadCount = ctrl.threadCount !== undefined ? parseInt(ctrl.threadCount) : 10;
    var frequency = ctrl.frequency !== undefined ? parseFloat(ctrl.frequency) : 14;
    var spread = ctrl.spread !== undefined ? parseFloat(ctrl.spread) : 0.06;
    var taper = ctrl.taper !== undefined ? parseFloat(ctrl.taper) : 3;
    var pinchPos = ctrl.position !== undefined ? parseFloat(ctrl.position) : 0.59;
    var thickness = ctrl.thickness !== undefined ? parseFloat(ctrl.thickness) : 1.1;
    var glowAmt = ctrl.glow !== undefined ? parseFloat(ctrl.glow) : 0.02;

    var c1 = c[0] || [0.13, 0.03, 0.53];
    var c2 = c[1] || [0.67, 0.02, 0.65];
    var c3 = c[2] || [0.53, 0.15, 0.15];
    
    var bg = comp.layers.addSolid([0.05, 0.05, 0.05], "Background", w, h, 1, dur);
    bg.startTime = 0;

    var layer = comp.layers.addShape();
    layer.name = "Web Threads";
    layer.startTime = 0;
    layer.outPoint = dur;

    var speedFx = addFx(layer, ["ADBE Slider Control"]); speedFx.name = "Speed"; safeSet(speedFx, 1, null, speed);
    var freqFx = addFx(layer, ["ADBE Slider Control"]); freqFx.name = "Frequency"; safeSet(freqFx, 1, null, frequency);
    var spreadFx = addFx(layer, ["ADBE Slider Control"]); spreadFx.name = "Spread"; safeSet(spreadFx, 1, null, spread);
    var taperFx = addFx(layer, ["ADBE Slider Control"]); taperFx.name = "Taper"; safeSet(taperFx, 1, null, taper);
    var posFx = addFx(layer, ["ADBE Slider Control"]); posFx.name = "Pinch Position"; safeSet(posFx, 1, null, pinchPos);
    var thickFx = addFx(layer, ["ADBE Slider Control"]); thickFx.name = "Thickness"; safeSet(thickFx, 1, null, thickness);
    
    var color1Fx = addFx(layer, ["ADBE Color Control"]); color1Fx.name = "Color 1"; safeSet(color1Fx, 1, null, c1);
    var color2Fx = addFx(layer, ["ADBE Color Control"]); color2Fx.name = "Color 2"; safeSet(color2Fx, 1, null, c2);
    var color3Fx = addFx(layer, ["ADBE Color Control"]); color3Fx.name = "Color 3"; safeSet(color3Fx, 1, null, c3);

    var contents = layer.property("Contents");

    for (var i = 0; i < threadCount; i++) {
        var grp = contents.addProperty("ADBE Vector Group");
        grp.name = "Thread " + (i + 1);
        var gc = grp.property("Contents");

        var path = gc.addProperty("ADBE Vector Shape - Group");
        var expr = "var w = thisComp.width;\n" +
                   "var h = thisComp.height;\n" +
                   "var speed = effect('Speed')(1);\n" +
                   "var freq = effect('Frequency')(1) * Math.PI;\n" +
                   "var spreadH = h * effect('Spread')(1) * 10;\n" +
                   "var taper = effect('Taper')(1);\n" +
                   "var pinch = effect('Pinch Position')(1);\n" +
                   "var timeSpeed = time * speed * 5 + " + (i * 0.5) + ";\n" + 
                   "var pts = [];\n" +
                   "var z = [0,0];\n" +
                   "var inT = [];\n" +
                   "var outT = [];\n" +
                   "var segments = 25;\n" +
                   "for (var j = 0; j <= segments; j++) {\n" +
                   "    var t = j / segments;\n" +
                   "    var x = (t - 0.5) * w;\n" +
                   "    var dist = Math.abs(t - pinch);\n" +
                   "    var amp = spreadH * Math.pow(dist, taper);\n" +
                   "    var y = Math.sin(t * freq + timeSpeed) * amp;\n" +
                   "    pts.push([x, y]);\n" +
                   "    inT.push(z);\n" +
                   "    outT.push(z);\n" +
                   "}\n" +
                   "createPath(pts, inT, outT, false);";
        safeEx(path, "Path", null, expr);

        var rc = gc.addProperty("ADBE Vector Filter - RC");
        safeSet(rc, "Radius", null, w / 15);

        var stroke = gc.addProperty("ADBE Vector Graphic - Stroke");
        safeEx(stroke, "Stroke Width", null, "effect('Thickness')(1) * 2");
        
        var colorExpr = "var c1 = effect('Color 1')(1);\n" +
                        "var c2 = effect('Color 2')(1);\n" +
                        "var c3 = effect('Color 3')(1);\n" +
                        "var t = " + (i / Math.max(1, threadCount - 1)) + ";\n" +
                        "if (t < 0.5) { linear(t, 0, 0.5, c1, c2); } else { linear(t, 0.5, 1, c2, c3); }";
        safeEx(stroke, "Color", null, colorExpr);
        
        try { stroke.property("Blend Mode").setValue(2); } catch(e){}
    }
    
    try { layer.property("Transform").property("Position").setValue([w/2, h/2]); } catch(e){}

    var glow = addFx(layer, ["ADBE Glow", "Glow"]);
    if (glow) {
        safeSet(glow, "Glow Threshold", null, 40);
        safeSet(glow, "Glow Radius", null, glowAmt * 1000 + 20);
        safeSet(glow, "Glow Intensity", null, 1.5);
    }
    
    var mirror = addFx(layer, ["ADBE Mirror"]);
    if (mirror) {
        safeSet(mirror, "Reflection Center", null, [w/2, h/2]);
        safeSet(mirror, "Reflection Angle", null, 90);
    }
}

/**
 * Liquid Ether — ExtendScript Bridge
 * Returns the selected layer's position normalised to -1..1 range,
 * plus layer dimensions so the fluid emitter can match the bounding box.
 */
function getLayerInfo() {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ error: "No active composition" });
        }

        var sel = comp.selectedLayers;
        if (!sel || sel.length === 0) {
            return JSON.stringify({ error: "No layer selected" });
        }

        var layer = sel[0];
        var time  = comp.time;
        var pos;

        // Try unified position property first
        try {
            var tg  = layer.property("ADBE Transform Group");
            var pp  = tg.property("ADBE Position");
            pos = pp.valueAtTime(time, false);
        } catch (e1) {
            // Separated-dimension fallback
            try {
                var tg2 = layer.property("ADBE Transform Group");
                var px  = tg2.property("ADBE Position_0").valueAtTime(time, false);
                var py  = tg2.property("ADBE Position_1").valueAtTime(time, false);
                pos = [px, py];
            } catch (e2) {
                return JSON.stringify({ error: "Cannot read position: " + e2.toString() });
            }
        }

        // Calculate bounding box width/height taking scale into account
        var w = 100, h = 100;
        try {
            var rect = layer.sourceRectAtTime(time, false);
            var scale = [100, 100];
            try {
                scale = layer.property("ADBE Transform Group").property("ADBE Scale").valueAtTime(time, false);
            } catch(es) {}
            w = rect.width * (Math.abs(scale[0]) / 100.0);
            h = rect.height * (Math.abs(scale[1]) / 100.0);
            if(w <= 0) w = 100;
            if(h <= 0) h = 100;
        } catch (er) {
            // If text or shape has no size (or failure), default to 100
        }

        // Normalise: AE origin is top-left; map to -1..1 NDC (flip Y)
        var nx =  (pos[0] / comp.width)  * 2.0 - 1.0;
        var ny = -((pos[1] / comp.height) * 2.0 - 1.0);

        return JSON.stringify({
            x:          pos[0],
            y:          pos[1],
            nx:         nx,
            ny:         ny,
            width:      w,
            height:     h,
            compWidth:  comp.width,
            compHeight: comp.height,
            layerName:  layer.name,
            time:       time
        });

    } catch (e) {
        return JSON.stringify({ error: e.toString() });
    }
}
