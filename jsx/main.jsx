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
            record((context ? context + " \u2014 " : "") + "effect unavailable: " + names[0]);
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
            record((context ? context + " \u2014 " : "") + "cannot set '" + name + "'");
            return false;
        },

        /* Set a property nested inside a property group (Colorama's Input
           Phase, Cell Pattern's evolution options, etc). */
        setIn: function (fx, groupName, name, val, context) {
            if (!fx) return false;
            try { fx.property(groupName).property(name).setValue(val); return true; } catch (x) { }
            try { fx.property(name).setValue(val); return true; } catch (x2) { }
            record((context ? context + " \u2014 " : "") + "cannot set '" + groupName + " > " + name + "'");
            return false;
        },

        expr: function (fx, name, idx, str, context) {
            if (!fx) return false;
            var p = this.find(fx, name, idx);
            if (p) {
                try { p.expression = str; return true; } catch (x) { }
            }
            record((context ? context + " \u2014 " : "") + "cannot express '" + name + "'");
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

/* The colour picker — After Effects' own, not the operating system's.

   THREE IMPLEMENTATIONS, AND WHY THIS IS THE THIRD.

   The first one opened a comp, added a shape layer called TEMP_COLOR_PICKER,
   put a Color Control on it, selected the property and fired
   app.executeCommand(2240) -- all inside an app.beginUndoGroup(). That is the
   right idea wrapped around a fatal mistake. 2240 is "Edit Value...", which
   opens a MODAL dialog: script execution stops dead while it is up, and the
   undo group opened before it cannot close until the user dismisses it. After
   Effects notices ("Undo group mismatch, will attempt to fix"), the undo stack
   is left inconsistent, and the application is one wrong step from going down.
   When the script died before its cleanup, the temp layer stayed behind too.

   The second one threw the whole approach away for $.colorPicker(), which is
   synchronous, needs no comp and cannot crash anything. It also opens the
   WRONG PICKER: $.colorPicker() is the operating system's colour dialog. It
   ignores the host's "Use System Color Picker" preference, it knows nothing
   about the project's working space, and on Windows it is the twenty-year-old
   grid of basic colours.

   This one goes back to the temp layer WITHOUT THE UNDO GROUP, which is the
   only part that was ever dangerous. Nothing is open across the modal, so
   there is no mismatch to fix: add the layer, set the starting colour, select
   the property, open the dialog, read the value back, remove the layer. The
   removal is in a finally, so a failure inside the dialog still cleans up, and
   lgSweepPickerLeftovers() clears anything an older build stranded.

   WHAT IT NEEDS, AND WHAT HAPPENS WHEN IT IS MISSING. "Edit Value..." acts on
   the selection in the active comp, so this needs one open. With no comp it
   falls back to $.colorPicker() rather than failing -- an old dialog beats no
   dialog -- and the panel falls back again to its own HTML picker if even that
   is unavailable, which is also what runs when the panel is opened in a plain
   browser.

   CANCEL IS NOT DETECTABLE. The dialog does not report which button closed it;
   cancelling simply leaves the property at the colour it opened on, so this
   returns the starting colour and the swatch does not move. That is the right
   outcome anyway. */
function openNativeColorPicker(hexStr) {
    try {
        lgSweepPickerLeftovers();

        var rgb;
        try { rgb = hexRgb(hexStr); } catch (e) { rgb = [1, 1, 1]; }

        var picked = lgAeColorPicker(rgb);
        if (!picked) picked = lgSystemColorPicker(rgb);
        if (!picked) return "-1";

        return "#" + lgHex2(picked[0] * 255) +
                     lgHex2(picked[1] * 255) +
                     lgHex2(picked[2] * 255);
    } catch (e) {
        return "-1";
    }
}

/* After Effects' own picker, via a Color Control nobody ever sees.

   The layer is a shape layer with no contents, so it renders nothing even for
   the instant it exists, and it is disabled and named TEMP_COLOR_PICKER so
   that anything which does survive a crash is obviously ours and gets swept
   the next time the picker opens.

   Returns [r, g, b] in 0..1, or null when there is no comp to work in. */
function lgAeColorPicker(rgb) {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) return null;

    var temp = null;
    try {
        temp = comp.layers.addShape();
        temp.name = 'TEMP_COLOR_PICKER';
        try { temp.enabled = false; } catch (e) { }

        var ctrl = temp.property("ADBE Effect Parade").addProperty("ADBE Color Control");
        var prop = ctrl.property("ADBE Color Control-0001");
        try { prop.setValue([rgb[0], rgb[1], rgb[2], 1]); } catch (e) { }

        /* No undo group. See the note above -- an open group across this modal
           is what took After Effects down. 2240 is "Edit Value...", used by id
           rather than through findMenuCommandId() because the menu item's name
           changes with the host's language and the id does not. */
        prop.selected = true;
        app.executeCommand(2240);

        var out = prop.value;
        if (!out || out.length < 3) return null;
        return [out[0], out[1], out[2]];
    } catch (e) {
        return null;
    } finally {
        if (temp) { try { temp.remove(); } catch (e) { } }
    }
}

/* The operating system's dialog. Only reached when there is no comp open.
   Takes and returns 0xRRGGBB, or -1 when the user cancels. */
function lgSystemColorPicker(rgb) {
    try {
        var start = (Math.round(rgb[0] * 255) << 16) |
                    (Math.round(rgb[1] * 255) << 8) |
                     Math.round(rgb[2] * 255);
        var picked = $.colorPicker(start);
        if (picked === null || picked === undefined || picked < 0) return null;
        return [((picked >> 16) & 0xFF) / 255,
                ((picked >> 8) & 0xFF) / 255,
                 (picked & 0xFF) / 255];
    } catch (e) {
        return null;
    }
}

function lgHex2(n) {
    var h = Math.max(0, Math.min(255, Math.round(n))).toString(16).toUpperCase();
    return (h.length < 2) ? "0" + h : h;
}

/* Remove any TEMP_COLOR_PICKER layer the old implementation left behind. */
function lgSweepPickerLeftovers() {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) return;
        for (var i = comp.numLayers; i >= 1; i--) {
            if (comp.layer(i).name === 'TEMP_COLOR_PICKER') {
                try { comp.layer(i).remove(); } catch (e) { }
            }
        }
    } catch (e) { }
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

/* Tolerant on purpose. This is called from the colour picker, from preset
   payloads and from live colour pushes, and a single malformed string used to
   come back as [NaN, NaN, NaN] -- which After Effects accepts and renders as
   black, so a typo in one swatch silently blacked out a gradient. Anything
   unparseable falls back to mid grey and says so. */
function hexRgb(h) {
    if (h === undefined || h === null) return [0.5, 0.5, 0.5];
    h = String(h).replace('#', '');
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    if (h.length < 6) return [0.5, 0.5, 0.5];
    var r = parseInt(h.slice(0, 2), 16),
        g = parseInt(h.slice(2, 4), 16),
        b = parseInt(h.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return [0.5, 0.5, 0.5];
    return [r / 255, g / 255, b / 255];
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
        case 'Copper':
        case 'Gold':
        case 'Silver':
        case 'Brushed':
        case 'Foil':
            buildMetalTexture(comp, c, controls, w, h, dur, type);
            break;
        /* Hammered is no longer a preset of its own — Snakeskin is the only
           thing that builds it, and it now carries Hammered's own settings
           rather than the reptile tuning it used to have. The 'Hammered' kind
           stays as the name of the recipe because every layer name, live
           tuner and saved preset already refers to it. */
        case 'Snakeskin':
            buildMetalTexture(comp, c, controls, w, h, dur, 'Hammered');
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
        case 'SaaS':
            buildSaaS(comp, c, controls, w, h, dur);
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
            LG.note('linear blending off \u2014 these effect stacks blend in gamma space');
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
        app.beginUndoGroup('Living Gradients \u2014 Batch');

        folder = app.project.items.addFolder('Living Gradients');

        var made = [], failed = [], i, j;

        for (i = 0; i < p.items.length; i++) {
            var item = p.items[i];
            var comp = null;

            try {
                comp = app.project.items.addComp(
                    'LG \u2014 ' + (item.label || item.type),
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
    // The name is what the live recolour path matches on — keep it.
    var s = comp.layers.addSolid([0, 0, 0], 'Oklab Smooth Gradient', w, h, 1, dur);
    tuneOklabSmooth(s, c, ctrl, w, h);
}

/* Both settings redraw the ramp in place, so both are live. */
function tuneOklabSmooth(s, c, ctrl, w, h) {
    if (!s) return;
    var radial = !!(ctrl.gradientType &&
                    String(ctrl.gradientType).toLowerCase() === 'radial');
    var angle  = (num(ctrl.angle, 0) === 90) ? 90 : 0;
    lgOklabRamp(s, c, w || 1920, h || 1080, angle, radial);
    lgBlur(s, num(ctrl.softness, 0));
}

// -- SAAS GRADIENT --
/* The look every landing page has had since about 2021: a mostly empty
   field with one enormous, very soft bloom of colour pushed off to a side,
   and maybe a quieter second one balancing it.

   WHY MASKS RATHER THAN A RAMP

   The obvious build is a radial Gradient Ramp, and it is wrong twice over.
   A radial ramp runs from its start colour to its end colour across a
   circle, so the falloff is linear and reads as a spotlight with a visible
   edge, not as light. And it fills the layer, so a second bloom needs a
   blend mode to hide the first one's background, which drags the whole
   stack into Add or Screen and breaks on a light-coloured backdrop.

   A solid with a feathered elliptical mask has neither problem. Mask
   feather falls off smoothly, it is genuinely transparent outside the
   shape, and it composites in Normal on any background. The bloom is then
   just a layer, which means it can be moved, and moving it is the point.

   WHY THE DRIFT IS ON POSITION

   A mask path is awkward to animate from script and pointless to animate
   here anyway. Wiggling the layer's position moves the mask with it, gives
   the same result, and keeps the shape parameters readable afterwards.

   Colour 1 is the BACKGROUND, not the first stop of a ramp. That is a
   different role model from every other gradient in this library and it is
   deliberate: in this look the background is most of what you see, so
   giving it the first swatch is telling the truth about the design. */
/* ── SaaS ────────────────────────────────────────────────────────────
   Clean space with one big soft bloom off to a side. Position is the subject,
   which is why this is the gradient the XY pad was built for.

   WHY THE LAYERS ARE SHAPED THE WAY THEY ARE. The first version sized each
   bloom's solid to its own radius and then moved the solid to put the bloom
   where the pad asked. That builds fine and cannot be tuned: changing the
   radius needs a bigger solid, and a solid cannot be resized after the fact,
   so every drag of the pad had to rebuild the whole gradient from scratch.

   So the solid no longer moves and no longer depends on the radius. Every
   bloom is one fixed-size layer -- the comp plus a margin on all sides -- sat
   dead centre, and the bloom's *position and size live in the mask* instead.
   A mask path can be rewritten in place as often as you like. That is what
   makes the pad track the pointer rather than stutter behind a rebuild.

   The margin is what the drift wiggles into, so nothing has to reach past the
   layer's own edge. Anything the mask spills beyond it is already well off
   screen. */
var SAAS_MARGIN = 420;

/* One place decides what the sliders mean, so the build and the live update
   cannot drift apart. Returns three entries always -- `on` says which of them
   this bloom count actually shows. */
function saasLayout(ctrl, w, h) {
    var blooms = Math.round(num(ctrl.blooms, 2));
    if (blooms < 1) blooms = 1;
    if (blooms > 3) blooms = 3;

    var posX     = num(ctrl.positionX, 30) / 100;
    var posY     = num(ctrl.positionY, 35) / 100;
    var size     = num(ctrl.size, 70) / 100;
    var softness = num(ctrl.softness, 80) / 100;
    var strength = num(ctrl.intensity, 85);
    var spread   = num(ctrl.spread, 55) / 100;
    var drift    = num(ctrl.drift, 30);
    var speed    = num(ctrl.speed, 12) / 100;

    /* Fixed angles rather than random ones: this look has to be reproducible,
       and a preset that renders differently every time it is applied is not a
       preset. */
    var offsets = [[0, 0], [0.62, 0.42], [-0.48, 0.55]];
    var shortest = (w < h) ? w : h;

    var out = [], i;
    for (i = 0; i < 3; i++) {
        /* Each bloom after the first is quieter and smaller. A row of equally
           loud blooms reads as a lava lamp; the hierarchy is what makes it
           read as one light with bounce. */
        var falloff = (i === 0) ? 1 : (i === 1 ? 0.72 : 0.5);
        var radius  = size * shortest * 0.75 * falloff;
        if (radius < 8) radius = 8;

        var feather = radius * softness;
        if (feather < 1) feather = 1;

        out.push({
            on:      i < blooms,
            cx:      posX * w + offsets[i][0] * spread * shortest,
            cy:      posY * h + offsets[i][1] * spread * shortest,
            radius:  radius,
            feather: feather,
            opacity: strength * falloff,
            drift:   drift * falloff,
            speed:   speed
        });
    }
    return out;
}

/* An ellipse from four bezier vertices. After Effects has no circle primitive
   for mask paths, and 0.5523 is the standard circular constant -- the handle
   length that makes four arcs meet as a true circle rather than a rounded
   diamond. */
function saasEllipse(lx, ly, radius) {
    var shape = new Shape();
    shape.closed = true;
    var k = radius * 0.5523;
    shape.vertices = [
        [lx, ly - radius],
        [lx + radius, ly],
        [lx, ly + radius],
        [lx - radius, ly]
    ];
    shape.inTangents  = [[-k, 0], [0, -k], [k, 0], [0, k]];
    shape.outTangents = [[k, 0], [0, k], [-k, 0], [0, -k]];
    return shape;
}

function buildSaaS(comp, c, ctrl, w, h, dur) {
    var bg = c[0] || [1, 1, 1];

    /* Back to front, so the layer order comes out right without any
       reordering afterwards. */
    var back = comp.layers.addSolid(bg, 'SaaS Backdrop', w, h, 1, dur);
    back.moveToEnd();

    /* All three are always built, and the bloom count switches them on and
       off. Creating a layer is the one thing a live update genuinely cannot
       do without rebuilding, so the count stops being a rebuild trigger and
       becomes just another slider. */
    var i, bloom;
    for (i = 0; i < 3; i++) {
        bloom = comp.layers.addSolid(c[i + 1] || c[c.length - 1] || [0.4, 0.5, 1],
                                     'SaaS Bloom ' + (i + 1),
                                     w + SAAS_MARGIN * 2, h + SAAS_MARGIN * 2, 1, dur);
        /* The mask has to exist before tuneSaaS runs -- it rewrites mask 1 in
           place and does not create one, because on every later call the mask
           is already there and adding a second would stack two blooms on one
           layer. Building it here is the only time it is ever added. */
        try {
            bloom.property('Masks').addProperty('Mask');
        } catch (e) {
            LG.warn('SaaS: could not add the mask for bloom ' + (i + 1));
        }
    }

    tuneSaaS(comp, c, ctrl, w, h);
}

/* Everything the panel can change, applied in place. */
function tuneSaaS(comp, c, ctrl, w, h) {
    var spec = saasLayout(ctrl, w, h), i, l;

    for (i = 1; i <= comp.numLayers; i++) {
        l = comp.layer(i);

        if (l.name === 'SaaS Backdrop') {
            try { l.source.mainSource.color = c[0] || [1, 1, 1]; } catch (e) { }
            continue;
        }

        var idx = -1;
        if (l.name === 'SaaS Bloom 1') idx = 0;
        else if (l.name === 'SaaS Bloom 2') idx = 1;
        else if (l.name === 'SaaS Bloom 3') idx = 2;
        if (idx === -1) continue;

        var b = spec[idx];
        try { l.enabled = b.on; } catch (e) { }
        if (!b.on) continue;

        try { l.source.mainSource.color = c[idx + 1] || c[c.length - 1] || [0.4, 0.5, 1]; } catch (e) { }

        /* Local coordinates. The layer is centred in the comp and is larger
           than it by SAAS_MARGIN on every side, so a comp point (cx, cy) sits
           at (cx + margin, cy + margin) in the layer's own frame. */
        try {
            var mask = l.property('Masks').property(1);
            mask.property('maskShape').setValue(
                saasEllipse(b.cx + SAAS_MARGIN, b.cy + SAAS_MARGIN, b.radius));
            mask.property('maskFeather').setValue([b.feather, b.feather]);
            /* Mask Expansion pulls the hard core back in as feather grows, so
               raising softness does not also make the bloom bigger. Without
               this, the softness slider reads as a second size slider. */
            mask.property('maskExpansion').setValue(-b.feather * 0.35);
        } catch (e) {
            LG.warn('SaaS: could not shape bloom ' + (idx + 1));
        }

        try { l.property('Transform').property('Opacity').setValue(b.opacity); } catch (e) { }

        /* The drift. Slow enough that you cannot catch it moving if you look
           directly at it, which is the difference between a background and a
           distraction. Different seeds per bloom, or they all drift in
           lockstep and the field looks like it is sliding rather than
           breathing. */
        try {
            var pos = l.property('Transform').property('Position');
            pos.setValue([w / 2, h / 2]);
            pos.expression = (b.drift > 0 && b.speed > 0)
                ? 'seedRandom(' + (idx + 1) + ', true);' +
                  'wiggle(' + b.speed.toFixed(3) + ', ' + b.drift.toFixed(1) + ');'
                : '';
        } catch (e) { }
    }
}

// ── 2. LIVING GRADIENT ── 4-Color Gradient + Motion Tile + Turbulent Displace (from Living Gradients.jsx)
function buildLiving(comp, c, ctrl, w, h, dur) {
    var speed = Math.round(num(ctrl.speed, 10));

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
    var g4 = addFx(s, ['ADBE 4ColorGradient', '4-Color Gradient']);
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

    addFx(s, ['ADBE Turbulent Displace', 'Turbulent Displace']);
    tuneLiving(s, c, ctrl);
}

/* Turbulence, scale, evolution and opacity are all plain values, so all four
   are live. Shift Speed is the interesting one: it sets how long the
   four-colour drift takes to reach its far position before the pingpong loop
   sends it back, which is a keyframe *time* rather than a value — so it is
   retimed rather than rewritten, and the positions the build randomised stay
   exactly where they were instead of jumping on every drag. */
function tuneLiving(s, c, ctrl) {
    if (!s) return;

    var td = findFx(s, ['ADBE Turbulent Displace', 'Turbulent Displace']);
    if (td) {
        LG.set(td, 'Amount',     2, num(ctrl.softness, 250));
        LG.set(td, 'Size',       3, Math.min(1000, Math.max(1, num(ctrl.scale, 400))));
        LG.set(td, 'Complexity', 5, 2);
        var evol = num(ctrl.rotation, 70);
        LG.expr(td, 'Evolution', 6, evol !== 0 ? 'time * ' + evol : 'value');
    }

    var g4 = findFx(s, ['ADBE 4ColorGradient', '4-Color Gradient']);
    if (g4) {
        var cycle = lgCycleTime(Math.round(num(ctrl.speed, 10)));
        var pidx = [2, 4, 6, 8], cidx = [3, 5, 7, 9], i;
        for (i = 0; i < 4; i++) {
            lgRetimeLastKey(LG.find(g4, 'Point ' + (i + 1), pidx[i]), cycle);
            LG.set(g4, 'Color ' + (i + 1), cidx[i], c[i % c.length]);
        }
    }

    try { s.opacity.setValue(num(ctrl.opacity, 100)); } catch (e) { }
}

/* Move a property's last keyframe to a new time without changing its value.
   After Effects has no "retime a key" call, so it is read, removed and set
   again — which is only safe because the value is carried across. */
function lgRetimeLastKey(prop, t) {
    if (!prop) return;
    try {
        var n = prop.numKeys;
        if (n < 2) return;
        if (Math.abs(prop.keyTime(n) - t) < 0.001) return;
        var v = prop.keyValue(n);
        prop.removeKey(n);
        prop.setValueAtTime(t, v);
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
        safeSet(tile1, "Output Width", 4, 300);
        safeSet(tile1, "Output Height", 5, 300);
        safeSet(tile1, "Mirror Edges", 6, true);
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
        safeSet(noise, "Noise Type", 2, false);
    }

    // Motion Tile (Second)
    var tile2 = addFx(s, ['ADBE Tile']);
    if (tile2) {
        safeSet(tile2, "Output Width", 4, 300);
        safeSet(tile2, "Output Height", 5, 300);
        safeSet(tile2, "Mirror Edges", 6, true);
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
                        safeSet(noise, "Noise Type", 2, false);
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

        /* SaaS spans four layers -- a backdrop and three blooms -- so it
           cannot ride the single-layer table below.

           Until this branch existed there was no SaaS entry anywhere in this
           function, so a drag on the XY pad fell past every test here and
           landed in the SilkFlare fallback at the bottom, which only touches
           layers named "Matte Comp". The panel was sending the position on
           every pointer move and After Effects was faithfully doing nothing
           with it. That is the whole reason the joystick "wasn't real time" —
           it was never connected, not slow. */
        if (ctrl.type === 'SaaS') {
            app.beginUndoGroup('Update SaaS');
            tuneSaaS(comp, lcols, lctrl, realComp.width, realComp.height);
            app.endUndoGroup();
            return;
        }

        /* WHICH BUILDER'S LAYERS AM I LOOKING AT?

           Usually the type's own. Snakeskin is the exception: it is built by
           buildMetalTexture(..., 'Hammered') on purpose, so its layers are
           called "Hammered Metal" and "Hammered Height" — and every lookup
           below searched for "Snakeskin Metal", found nothing, and reported
           success. One entry here is the whole fix, and any future preset that
           shares another builder needs one line and nothing else. */
        var LIVE_ALIAS = { Snakeskin: 'Hammered' };
        var liveKind = LIVE_ALIAS[ctrl.type] || ctrl.type;

        /* Each entry names the layers a type tunes and the function that tunes
           each one. Single-layer types keep the short form. Every tuner is
           called as fn(layer, colours, controls, compWidth, compHeight), and
           every one of them is the same function the builder ran — that is the
           rule that stops a slider meaning one thing on build and another on a
           drag. */
        var LIVE_TUNERS = {
            Metallic:       { layer: 'Metallic',        fn: tuneMetallic },
            CellularMosaic: { layer: 'Cellular Mosaic', fn: tuneCellularMosaic },
            AnimeWater:     { layer: 'Anime Water',     fn: tuneAnimeWater },
            AnimeCells:     { layer: 'Anime Cells',     fn: tuneAnimeCells },

            /* The twelve that had no live update at all. */
            OklabSmooth:    { layer: 'Oklab Smooth Gradient', fn: tuneOklabSmooth },
            living:         { layer: 'Living Gradient',       fn: tuneLiving },
            LavaLamp:       { layer: 'Lava Lamp',             fn: tuneLavaLamp },
            Waves:          { layer: 'Wave Lines',            fn: tuneWaves },
            WebThreads:     { layer: 'Web Threads',           fn: tuneWebThreads },
            Antigravity:    { layer: 'Antigravity Particles', fn: tuneAntigravity },

            SonduckLiquid:  { layers: [
                { name: 'Sonduck Shapes',      fn: tuneSonduckLiquid },
                { match: /^Ribbon [0-9]+$/,    fn: tuneRibbonDrift }
            ] },
            PrismaticBurst: { layers: [
                { name: 'Prismatic Rays Matte', fn: tunePrismaticRays },
                { name: 'Prismatic Colors',     fn: tunePrismaticColors }
            ] },
            StackedSquares: { layers: [
                { name: 'Stacked Background', fn: tuneStackedSquares },
                { name: 'Square 1', fn: tuneStackedSquare },
                { name: 'Square 2', fn: tuneStackedSquare },
                { name: 'Square 3', fn: tuneStackedSquare },
                { name: 'Square 4', fn: tuneStackedSquare },
                { name: 'Square 5', fn: tuneStackedSquare }
            ] },
            TrailGradient:  { layers: [
                { name: 'Trail Animation', fn: tuneTrailGradient },
                { match: /^Trail [0-9]+$/, fn: tuneTrailStroke }
            ] }
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

        if (LIVE_TUNERS[liveKind]) {
            var tuner = LIVE_TUNERS[liveKind];
            var jobs = tuner.layers || [{ name: tuner.layer, fn: tuner.fn }];
            var touched = 0;
            app.beginUndoGroup('Update ' + ctrl.type);
            for (var ti = 1; ti <= comp.numLayers; ti++) {
                var lay = comp.layer(ti);
                for (var tj = 0; tj < jobs.length; tj++) {
                    var job = jobs[tj];
                    var hit = job.match ? job.match.test(lay.name) : (lay.name === job.name);
                    if (hit) { job.fn(lay, lcols, lctrl, realComp.width, realComp.height); touched++; }
                }
            }
            app.endUndoGroup();
            /* Nothing matched means the selection is not this gradient. Saying
               so beats the silence that made twelve of these look wired up. */
            if (!touched) {
                LG.warn('Nothing here belongs to "' + ctrl.type +
                        '" \u2014 select the gradient you want to change.');
            }
            return;
        }

        /* The shaded metals and the frosted glass are two layers each, and one
           of the two lives in a comp of its own, so they cannot ride the
           single-layer table above. A slider that only ever reached the
           picture and never the height field would move the colour and leave
           the surface exactly as it was — Relief, Brush Length and Crumple all
           live on the map, not on what you can see. */
        var SHADED = { Copper: 1, Gold: 1, Silver: 1, Brushed: 1,
                       Foil: 1, Hammered: 1,
                       /* Still reachable so a preset saved on one of the
                          removed metals goes on updating live. */
                       Polished: 1, Gunmetal: 1 };
        if (SHADED[liveKind]) {
            var kind = liveKind;
            app.beginUndoGroup('Update ' + ctrl.type);
            var metalLayer = null, heightLayer = null, staleBase = null, mi2;
            for (mi2 = 1; mi2 <= comp.numLayers; mi2++) {
                var ml = comp.layer(mi2);
                if (ml.name === kind + ' Metal')  metalLayer = ml;
                else if (ml.name === kind + ' Height') heightLayer = ml;
                else if (ml.name === kind + ' Base')   staleBase = ml;
            }

            /* A metal built before the backstop was removed still has one.
               Take it out on the first live update rather than leaving a
               third layer in a comp that is documented as having two — and
               do it before anything else touches the stack, so the bump
               index re-found further down is the finished one. */
            if (staleBase) {
                try { staleBase.remove(); } catch (e) { }
                metalLayer = null; heightLayer = null;
                for (mi2 = 1; mi2 <= comp.numLayers; mi2++) {
                    var ml2 = comp.layer(mi2);
                    if (ml2.name === kind + ' Metal')  metalLayer = ml2;
                    else if (ml2.name === kind + ' Height') heightLayer = ml2;
                }
            }
            if (heightLayer && heightLayer.source && heightLayer.source instanceof CompItem
                && heightLayer.source.numLayers > 0) {
                tuneMetalHeight(heightLayer.source.layer(1), lctrl, kind);
            }
            if (metalLayer) {
                tuneMetalSurface(metalLayer, lcols, lctrl, kind,
                                 heightLayer ? heightLayer.index : 0);
            } else {
                LG.warn(ctrl.type + ': no "' + kind + ' Metal" layer here to update.');
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
                                safeEx(turb, "Evolution", 6, "time * " + (parseFloat(amctrl.speed) * 2));
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
                        safeEx(cTurb, "Evolution", 6, "time * " + (parseFloat(amctrl.speed) * 2));
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
                        if (wctrl.turbEvolution !== undefined) safeEx(td, "Evolution", 6, "time * " + parseFloat(wctrl.turbEvolution));
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

        /* Everything above returns. Anything still here reached the bottom of
           the dispatch, and the bottom of the dispatch is SilkFlare's -- so
           until this guard existed, every type without a tuner quietly ran
           SilkFlare's code against layers it does not have and reported
           success. That is a silent no-op, and it is exactly how the SaaS pad
           managed to look wired up while doing nothing at all.

           Now an unhandled type says so in the panel's own warning channel
           instead of pretending. */
        var SILKFLARE = { Silk: 1, Aurora: 1, Prism: 1, Fiber: 1, Veil: 1,
                          Pulse: 1, Comet: 1 };
        if (!SILKFLARE[ctrl.type]) {
            LG.warn('No live tuner for "' + ctrl.type + '" \u2014 its sliders will ' +
                    'only take effect when the gradient is re-applied.');
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
        safeSet(noise, "Complexity", 16, 1);
        var scale = ctrl.noiseScale !== undefined ? parseFloat(ctrl.noiseScale) : 150;
        safeSet(noise, "Scale", 10, scale);
        var speed = ctrl.speed !== undefined ? parseFloat(ctrl.speed) : 40;
        safeEx(noise, "Evolution", 24, "time * " + speed);
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
        safeSet(filmNoise, "Noise Type", 2, false); // Grayscale noise only
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
        safeSet(grad, "Point 1", 2, [w * 0.1, h * 0.1]);
        safeSet(grad, "Point 2", 4, [w * 0.9, h * 0.2]);
        safeSet(grad, "Point 3", 6, [w * 0.2, h * 0.8]);
        safeSet(grad, "Point 4", 8, [w * 0.8, h * 0.9]);
        safeEx(grad, "Point 1", 2, "var s = time * " + (speed / 10) + "; [value[0] + Math.sin(s)*300, value[1] + Math.cos(s*0.8)*200]");
        safeEx(grad, "Point 2", 4, "var s = time * " + (speed / 10) + "; [value[0] + Math.cos(s*1.2)*300, value[1] + Math.sin(s*0.9)*200]");
        safeEx(grad, "Point 3", 6, "var s = time * " + (speed / 10) + "; [value[0] + Math.sin(s*0.7)*300, value[1] + Math.cos(s*1.1)*200]");
        safeEx(grad, "Point 4", 8, "var s = time * " + (speed / 10) + "; [value[0] + Math.cos(s*0.9)*300, value[1] + Math.sin(s*1.3)*200]");
    }

    var turb = addFx(lumaSolid, ["Turbulent Displace", "ADBE Turbulent Displace"]);
    if (turb) {
        safeSet(turb, "Amount", 2, 100);
        safeSet(turb, "Size", 3, 300);
        safeEx(turb, "Evolution", 6, "time * " + speed * 2);
    }

    addFx(lumaSolid, ["Tint", "ADBE Tint"]); // Grayscale!

    var noiseSolid = lumaComp.layers.addSolid([1, 1, 1], "Evolving Noise", w, h, 1, dur);
    var lumaNoise = addFx(noiseSolid, ["Fractal Noise", "ADBE FractalNoise"]);
    if (lumaNoise) {
        safeSet(lumaNoise, "Fractal Type", 1, 1);
        safeSet(lumaNoise, "Noise Type", 2, 4); // Spline
        safeSet(lumaNoise, "Contrast", 4, 150);
        safeSet(lumaNoise, "Brightness", 5, 0);
        safeEx(lumaNoise, "Evolution", 24, "time * " + (speed * 1.5));
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
            safeSet(ext, "Black Point", 3, minLuma);
            safeSet(ext, "White Point", 4, maxLuma);
            safeSet(ext, "Black Softness", 5, 0);
            safeSet(ext, "White Softness", 6, 0);
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
            safeSet(cmGrad, "Point 1", 2, [w * 0.1, h * 0.1]);
            safeSet(cmGrad, "Color 1", 3, c[0]);
            safeSet(cmGrad, "Point 2", 4, [w * 0.9, h * 0.2]);
            safeSet(cmGrad, "Color 2", 5, c[1]);
            safeSet(cmGrad, "Point 3", 6, [w * 0.2, h * 0.8]);
            safeSet(cmGrad, "Color 3", 7, c[2]);
            safeSet(cmGrad, "Point 4", 8, [w * 0.8, h * 0.9]);
            safeSet(cmGrad, "Color 4", 9, c[3]);
            safeEx(cmGrad, "Point 1", 2, "var s = time * " + (speed / 10) + "; [value[0] + Math.sin(s)*300, value[1] + Math.cos(s*0.8)*200]");
            safeEx(cmGrad, "Point 2", 4, "var s = time * " + (speed / 10) + "; [value[0] + Math.cos(s*1.2)*300, value[1] + Math.sin(s*0.9)*200]");
            safeEx(cmGrad, "Point 3", 6, "var s = time * " + (speed / 10) + "; [value[0] + Math.sin(s*0.7)*300, value[1] + Math.cos(s*1.1)*200]");
            safeEx(cmGrad, "Point 4", 8, "var s = time * " + (speed / 10) + "; [value[0] + Math.cos(s*0.9)*300, value[1] + Math.sin(s*1.3)*200]");
        }
        var cmTurb = addFx(colorMaster, ["Turbulent Displace", "ADBE Turbulent Displace"]);
        if (cmTurb) {
            safeSet(cmTurb, "Amount", 2, 100);
            safeSet(cmTurb, "Size", 3, 300);
            safeEx(cmTurb, "Evolution", 6, "time * " + speed * 2);
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
        fractalType:  1,                  // Basic — see the note on Metal Grain
        /* 170 was pushing plain fBm into its own tails. Basic noise gets no
           bias correction because it does not need one, so contrast here is
           unopposed: at 170 most of the distribution ends up pinned at one end
           or the other and the "soft ridges" this comment asks for came out as
           hard-edged blotches. A height field wants gradation above all else —
           the shader makes the contrast, this only has to describe the shape. */
        contrast:     115,
        brightness:   0,
        overflow:     2,                  // soft clamp — no folds, no flashing
        complexity:   5,
        scaleWidth:   scale * 0.75,
        scaleHeight:  scale * 0.55,
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
    var h = 1080;
    try { h = s.height; } catch (e) { }
    var speed  = num(ctrl.speed, 14);
    var irid   = num(ctrl.iridescence, 22);
    var relief = num(ctrl.relief, 45);

    /* Something to refract. A field at scale 420 across a frame is one soft
       blob and reads as a flat wash once it is behind glass; this is a third
       of that, so there are edges for the surface to bend. */
    lgFractalSet(lgFxNamed(s, ['ADBE Fractal Noise'], 'Glass Colour Field'), {
        fractalType:  1,                  // Basic — see the note on Metal Grain
        /* Small features plus high contrast is the recipe for camouflage, and
           camouflage is what this was rendering: irregular hard-edged patches
           of light and dark with no fade between them.

           The note above about needing "edges for the surface to bend" is
           right in principle and was applied about twice as hard as it needed
           to be. The refraction reads the *surface* field for its edges; this
           layer is only the colour behind the glass, and colour behind frosted
           glass is a soft wash. Bigger features, gentler contrast. */
        contrast:     118,
        brightness:   0,
        overflow:     2,
        complexity:   4,
        scaleWidth:   num(ctrl.scale, 420) * 0.62,
        scaleHeight:  num(ctrl.scale, 420) * 0.48,
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
               range in the panel, but what actually gets asked of CC Glass is
               capped against the layer's own overhang — displacement past the
               layer's edge fetches nothing and punches a hole. */
            displacement: Math.min(num(ctrl.refraction, 110) * 0.5,
                                   (h - h / LG_OVERSIZE) / 2 * 0.8)
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
        }, 'CC Glass');
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
        safeSet(tile, "Output Width", 4, 300);
        safeSet(tile, "Output Height", 5, 300);
        safeSet(tile, "Mirror Edges", 6, true);
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
        safeEx(td, "Evolution", 6, "time * " + turbEvolution);
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

    /* @effect dispNow = ADBE Displacement Map */
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

/* ── THE FOUR SHADERS SHARE ONE MATERIAL BLOCK ────────────────────────
   CC Glass, CC Blobbylize, CC Plastic and CC Mr. Mercury all carry the same
   Light and Shading parameters under the same display names. What differs is
   where they sit, because each effect's Surface group is a different size.

   This started as one integer offset from CC Glass, which worked for
   Blobbylize and is wrong for CC Plastic: its Light block is one lower, but
   its Shading block is two lower again because of Ambient Light Color, and
   its Specular is three lower because Dust sits in front of it. An offset
   cannot express that. A table can, and the table is transcribed straight out
   of tools/effect_probe_report.txt rather than derived from anything.

   The indices are the fallback in any case — LG.find resolves by display name
   first and these names are identical across all four — but a knowingly wrong
   index is worse than no index, because on a localised host it is the one
   that runs. */
var LG_SHADER_IDX = {
    'CC Glass':      { using:  9, intensity: 10, color: 11, type: 12, height: 13,
                       direction: 15, ambient: 18, diffuse: 19, specular: 20,
                       roughness: 21, metal: 22 },
    'CC Blobbylize': { using:  8, intensity:  9, color: 10, type: 11, height: 12,
                       direction: 14, ambient: 17, diffuse: 18, specular: 19,
                       roughness: 20, metal: 21 },
    'CC Plastic':    { using: 10, intensity: 11, color: 12, type: 13, height: 14,
                       direction: 16, ambient: 20, diffuse: 21, dust: 22,
                       specular: 23, roughness: 24, metal: 25 },
    'CC Mr. Mercury':{ using: 17, intensity: 18, color: 19, type: 20, height: 21,
                       direction: 23, ambient: 26, diffuse: 27, specular: 28,
                       roughness: 29, metal: 30 }
};

function lgShadeSet(fx, o, which) {
    if (!fx) return null;
    var ix = LG_SHADER_IDX[which || 'CC Glass'] || LG_SHADER_IDX['CC Glass'];

    /* Every one of these is a 0..100 parameter and setValue THROWS past the
       end rather than clamping. That is not a detail: a contact sheet came
       back with "cannot set 'Specular'" on five of the eight metals, all of
       them the ones asking for more than 100, and a Specular that never
       landed is a metal with no highlight on it. Clamp here, once, rather
       than trusting eight preset tables to stay inside the range. */
    function pc(v, dflt) {
        v = num(v, dflt);
        return v < 0 ? 0 : (v > 100 ? 100 : v);
    }

    LG.set(fx, 'Using',           ix.using,     1);                    // Effect Light

    /* LIGHT INTENSITY IS NOT ONE OF THE 0..100 ONES. Ambient, Diffuse,
       Specular and Metal are percentages of a fixed budget and genuinely stop
       at 100. Light Intensity is a lamp, and a lamp is allowed to be brighter
       than "all of it" — the tuned foil runs at 215.3, which is most of what
       makes a crumpled sheet read as bright metal rather than as grey paper.

       Clamping it with the others silently halved that on the one preset that
       needed it, and the clamp was added for a warning that named Specular,
       not this. Clamped separately and generously: the point of the clamp is
       that setValue throws past the end of a property's range rather than
       saturating, so there still has to be a ceiling. */
    var intensity = num(o.intensity, 100);
    if (intensity < 0)   intensity = 0;
    if (intensity > 500) intensity = 500;
    LG.set(fx, 'Light Intensity', ix.intensity, intensity);
    LG.set(fx, 'Light Color',     ix.color,     o.lightColor || [1, 1, 1]);
    LG.set(fx, 'Light Type',      ix.type,      num(o.lightType, 1));  // 1 Distant, 2 Point
    LG.set(fx, 'Light Height',    ix.height,    pc(o.lightHeight, 45));
    LG.set(fx, 'Light Direction', ix.direction, num(o.lightAngle, 315));

    /* Ambient is how much of the picture comes through unlit, Diffuse is how
       much the lamp adds. They sum, so an Ambient of 46 with a Diffuse of 55
       is already at 101% before the specular goes on top — which is why an
       earlier sheet came back as white bands with a few dark lines through
       them. Keeping the pair under about 90 is what leaves headroom for a
       highlight to read as a highlight. */
    LG.set(fx, 'Ambient',   ix.ambient,  pc(o.ambient, 40));
    LG.set(fx, 'Diffuse',   ix.diffuse,  pc(o.diffuse, 45));
    LG.set(fx, 'Specular',  ix.specular, pc(o.specular, 80));

    // Only CC Plastic has this: a matte scatter over the whole surface.
    if (ix.dust !== undefined && o.dust !== undefined) {
        LG.set(fx, 'Dust', ix.dust, pc(o.dust, 0));
    }

    /* Roughness is a 0..1 exponent term, not a percentage — the interface
       shows it as 0.100 and the probe confirms it takes no integer clamp.
       The panel's slider is 1..100 because that is a usable range to drag;
       /500 lands it in 0.002 (mirror) to 0.2 (cast iron). */
    LG.set(fx, 'Roughness', ix.roughness, Math.max(0.001, num(o.roughness, 10) / 500));

    // The whole reason these read as metal rather than as coloured plastic.
    LG.set(fx, 'Metal',     ix.metal, pc(o.metal, 100));
    return fx;
}

/* The surface half of CC Glass: which layer is the height field, how deep it
   is, and how far it bends what is behind it. */
function lgGlassSurface(fx, bumpLayerIndex, o) {   /* @effect fx = CC Glass */
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
/* THE THREE MOLTEN METALS ARE A MEASURED RECIPE, NOT A DERIVED ONE.

   Everything above this line was worked out from first principles and looked
   wrong in the render every time. The numbers below were found the other way
   round: the panel built a copper, it was opened in After Effects and tuned by
   hand until it read as poured metal, and the finished stack was then read
   back off the layer. Where a number here disagrees with the reasoning in the
   comments above, the number wins — it is the one that was looked at.

   The four that actually mattered, none of which the derived version would
   ever have produced:

     Tile Height 25, not 100. The fold is squeezed vertically before it is
     bent, so the bands arrive as short wide lozenges rather than as full-
     height stripes, and a displacement through them makes folds instead of
     wobbly columns.

     Metal Twist on BULGE Smoother, not Twist Smoother. Twist rotates the
     bands around a centre. Bulge pushes them outward along their own normals,
     which is what the surface of something poured does.

     Metal Environment on plain Turbulent, not Turbulent Smoother. The smooth
     variant is too gentle at this size to break the regularity of the fold;
     the hard one keeps the flow irregular the way a real reflection is.

     33 reflection bands, not 6. Six wide bands is a mirror in a showroom.
     Thirty-three narrow ones is what a curved liquid surface does to a
     window, and it is what makes the highlight run as a thin bright line down
     the fold rather than washing across half of it.

   The three differ only in palette and in a few degrees of light. That is
   deliberate: they are the same metal poured, and pretending otherwise by
   giving each one its own geometry is what made the last set look like eight
   unrelated accidents. */
var MOLTEN = {
    recipe: 'molten',
    env: 'flow', field: 'noise',

    /* The fold, read straight back off the hand-tuned comp rather than left
       to the panel's sliders to supply.

         tilt 18   End of Ramp is [5376, 544.3] on a 5376 x 3024 layer, and
                   544.3 is 18% of 3024 exactly.
         bands 33  Motion Tile's Tile Width is 3.0, and 3.0 is 100/33. The
                   note above already argues for thirty-three; this states it,
                   so a build with no controls attached (a contact sheet, a
                   saved preset from before the slider existed) gets the fold
                   instead of getting Tile Width 100 and no fold at all. */
    tilt: 18, bands: 33, foldHeight: 25,

    /* The two displacements, by menu index — 5 is Bulge Smoother and 1 is
       plain Turbulent. See the note above; these two lines are most of the
       difference between metal and a striped ramp. */
    /* THE AMOUNTS WERE ZERO AND THE WHOLE FILE TALKS AS IF THEY WERE NOT.

       Every note here — the budget that reserves overhang for "433 + 229",
       the argument that Pin All is what makes a hand-tuned comp with those
       numbers safe — describes a pour that this table was not asking for. Both
       Amounts read 0, alongside a tilt of 0 and a band count of 0, so what the
       three molten metals actually built was a black-to-white ramp with no
       slope, no fold and no displacement: a flat grey wash. The values below
       are the ones on the tuned comp, and they are what the rest of the file
       has been assuming all along. */
    twistMode: 5, twistAmount: 433,   twistSize: 351,
    envMode:   1, envAmount:  229.1,  envSize:  620,

    /* Tritone. CC Toner's Brights and Darktones are inactive in this mode, so
       the palette is genuinely three colours — and the panel offers three
       rather than four with two of them quietly doing nothing. */
    tritone: true,

    /* NO SHADER, AND NO HEIGHT MAP EITHER.

       This is the correction the tuned comp actually carries, and it is the
       one that is hardest to believe from reading the file: the molten stack
       ends at CC Toner. There is no CC Glass on it and no bloom after it.

       The reasoning above — that a metal is a height field handed to a real
       Blinn-Phong shader — is right about Foil, Brushed and Hammered, whose
       whole look IS their tooling. It is wrong about a pour. What makes
       poured metal read as metal is the shape of the reflection, and the
       reflection here is already fully formed by the time the shader would
       see it: a ramp, folded into thirty-three mirrored bands, bent twice by
       large-size turbulence. CC Glass on top of that only re-lights an image
       that was never a surface, and the bloom only spreads the highlight it
       has already got.

       So the shader stage is switched off rather than tuned quiet, on the
       same argument Foil's `bare` uses from the other end — and because
       nothing then reads the height field, buildMetalTexture does not build
       the height comp for these three at all. A molten metal is one solid in
       one comp.

       The three glass numbers below are kept as the record of what the
       shader was set to when it was still on. They are inert while
       `shader: 'none'`; delete the line above and they take effect again
       exactly as they did. */
    shader: 'none', bloom: false,
    glassSoftness: 4.3, glassHeight: -58, glassDisplacement: -48.2,

    hWidth: 480, hHeight: 430, hContrast: 130, hComplexity: 3,
    crumpleMode: 1, crumpleAmount: 120, crumpleSize: 180,
    /* Smooth 0, not 8. The tuned comp's height map carries a Fast Box Blur at
       radius 0 — the crumple here is Turbulent at Size 180, so its finest
       structure is already far wider than a pixel and there is nothing left
       for a blur to remove except contrast. Same reasoning as Foil's zero,
       reached from the opposite end of the size range. */
    smooth: 0, metal: 100, ambient: 36, diffuse: 50,
    lightIntensity: 93.6, lightHeight: 45, lightAngle: 58, specular: 90, roughness: 17,
    sheen: 28, speed: 7,
    
    bloomThreshold: 44.7, bloomRadius: 79.6, bloomIntensity: 0.3
};

/* One molten metal, with only what makes it that metal changed. */
function lgMolten(over) {
    var out = {}, k;
    for (k in MOLTEN) if (MOLTEN.hasOwnProperty(k)) out[k] = MOLTEN[k];
    for (k in over)   if (over.hasOwnProperty(k))   out[k] = over[k];
    return out;
}

var METAL_SURFACES = {
    Copper:  lgMolten({}),
    Gold:    lgMolten({}),
    Silver:  lgMolten({}),

    /* CRUMPLED FOIL — the same discovery from the other end.

       Foil turned out not to need the environment at all. No ramp, no fold,
       no twist, no toner, no bloom: just the height map, shaded. Everything
       that makes foil foil is in the map, and the map is Fractal Noise put
       through a CROSS DISPLACEMENT at Size 2 — a displacement whose noise is
       a couple of pixels across shreds the field into creases instead of
       bending it, which is the same trick that turned a failed gold into Fur.

       So this recipe switches the environment stage off rather than setting
       it to something quiet. An effect that is off cannot drift, and half the
       stack not being there is also half the render time. */
    Foil: {
        recipe: 'crinkle',
        bare: false,
        field: 'noise',
        hWidth: 150, hHeight: 130, hContrast: 103, hComplexity: 4,
        crumpleMode: 9,                   // Cross Displacement
        crumpleAmount: 718, crumpleSize: 2,
        smooth: 0,
        /* End of Ramp is [5376, 665.3] on the tuned sheet, and 665.3 is 22%
           of 3024. Foil has no fold, so the ramp is the whole environment and
           its slope is the only thing setting where the sheet is lit from. */
        tilt: 22, bands: 0, foldHeight: 0,
        twistMode: 6, twistAmount: 0, twistSize: 1000,
        envMode: 1, envAmount: 0, envSize: 999,
        /* THE PALETTE WAS SWITCHED OFF. `toner: false` disabled CC Toner on
           this finish, and CC Toner is the only thing on a metal that reads
           the palette -- so Crumpled Foil offered four swatches (Shadow, Base
           Metal, Bright, Highlight) and not one of them changed a pixel. It
           rendered at exactly 0.00 mean chroma next to Brushed Steel's 14.35
           off the same shading path, on a palette that carries a blue.

           `bare` genuinely switches a stage off because that stage is not
           part of the look. A dead colour control is not that -- it is a
           control the panel still draws. */
        toner: true, noiseType: 3,
        glassSoftness: 0, glassHeight: 10, glassDisplacement: 10,
        lightIntensity: 215.3, lightAngle: 305, lightHeight: 67,
        /* Roughness 42, which lands on the tuned sheet's 0.084.

           This number was 0.083 — the value read straight off CC Glass in the
           tuned comp — and it is in the wrong units. Roughness reaches the
           effect as slider/500 (see lgShadeSet), so 0.083 arrived as 0.000166:
           a perfect mirror, on the one finish whose whole character is a soft
           broad sheen. Everything else in this table is already slider-space;
           this was the one field written in effect-space. */
        ambient: 63, diffuse: 16, specular: 63, roughness: 42, metal: 100,
        sheen: 0, speed: 5
    },

    /* BRUSHED STEEL, rethought against the foil.

       It keeps the wide-and-short noise that makes the grain run one way, and
       it takes the foil's lesson everywhere else: the shading block is the
       foil's rather than the old derived one, and the environment is quiet
       rather than absent — a brushed plate does reflect a room, it just
       reflects it softly. Crumple is off; the grain is the tooling. */
    Brushed: {
        env: 'plate', field: 'noise',
        tilt: 10, bands: 5, foldHeight: 100,
        twistMode: 5, envMode: 1,
        hWidth: 1400, hHeight: 3, hContrast: 150, hComplexity: 6,
        brushDirection: 90, smooth: 1,
        glassSoftness: 0, glassHeight: 14, glassDisplacement: 6,
        lightIntensity: 180, lightAngle: 300, lightHeight: 55,
        ambient: 58, diffuse: 20, specular: 60, roughness: 0.4, metal: 100,
        sheen: 10, speed: 4
    },

    /* HAMMERED — no longer a preset, still a recipe.

       Snakeskin is the only thing that builds this, and it now builds it with
       these settings rather than the reptile tuning it used to carry. The
       dimple lattice was always the same geometry; what said "metal" was the
       lighting, and the lighting is back. */
    Hammered: {
        env: 'plate', field: 'cells', pattern: 'Bubbles',
        cellSize: 90, cellContrast: 150,
        tilt: 16, bands: 4, foldHeight: 100,
        twistMode: 6, envMode: 4,
        smooth: 5, metal: 100, ambient: 44, diffuse: 50
    },

    /* Kept only so a preset somebody saved before these left the library
       still builds and still updates. Nothing offers them. */
    Polished: {
        env: 'flow', field: 'noise',
        tilt: 14, bands: 5, foldHeight: 100, twistMode: 6, envMode: 4,
        hWidth: 700, hHeight: 620, hContrast: 110, hComplexity: 2,
        smooth: 6, metal: 100, ambient: 34, diffuse: 48
    },
    Gunmetal: {
        shader: 'plastic', dust: 34,
        env: 'plate', field: 'noise',
        tilt: 12, bands: 6, foldHeight: 100, twistMode: 6, envMode: 4,
        hWidth: 90, hHeight: 80, hContrast: 160, hComplexity: 5,
        smooth: 2, metal: 85, ambient: 50, diffuse: 52
    }
};

/* THE SMALLEST THING IN THE HEIGHT FIELD, in pixels.

   CC Glass has two strengths and they do different jobs. Height is how hard
   the surface is *lit* — the normals that make it read as metal. Displacement
   is how far the reflection is *bent* over that surface.

   Bending is the one with a limit. Displace the picture by more than the
   distance between one bump and the next and the reflection does not flow over
   the tooling, it tears across it, and what comes back is crinkle. That is
   exactly what tools/bisect/06 -> 07 shows: frame 06 is smooth flowing ribbons
   and frame 07, the only difference being CC Glass, is wrinkled foil.

   Foil is the case that proves it. Its field is Fractal Noise at 150 x 130
   with four octaves, so its finest structure is about 16px across, and the
   build was asking CC Glass to displace by 56. Nothing survives that.

   So the shader's Displacement is capped against this rather than left to
   follow Relief alone. It is a cap and never a raise: a preset whose field is
   already coarse (Polished at 620, Hammered's 90px dimples) is untouched, and
   only the ones that were shredding themselves change. Height is left alone,
   so the surface goes on being lit exactly as hard as it was. */
function lgHeightFinestFeature(o) {
    var scale  = num(o.scaleAll, 100) / 100;
    var smooth = Math.max(0.5, num(o.smooth, 5) * scale);
    var finest;

    if (o.field === 'cells') {
        /* A Cell Pattern is one smooth octave. Its dimple *is* its finest
           structure, so the wavelength is the cell size, not a fraction of it. */
        finest = Math.max(6, num(o.cellSize, 90) * scale);
    } else {
        /* Fractal Noise carries `complexity` octaves, each half the width of
           the one above. The narrower axis is what binds — Brushed is 1400
           wide and 3 tall on purpose. */
        var base = Math.min(num(o.hWidth, 500), num(o.hHeight, 500)) * scale;
        finest = base / Math.pow(2, Math.max(1, num(o.hComplexity, 3)) - 1);
    }

    /* The blur at the end of tuneMetalHeight erases everything below its own
       radius, so whatever it leaves behind is the real answer. */
    return Math.max(finest, smooth * 2);
}

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
            LG.set(cell, 'Contextual Slider', 3, num(o.cellContrast, 150));
            LG.set(cell, 'Disperse',     5, 0.55);
            LG.set(cell, 'Size',         6, Math.max(6, num(o.cellSize, 90) * scale));
            LG.expr(cell, 'Evolution', 13, speed !== 0 ? 'time * ' + (speed * 2) : 'value');
        }
    } else {
        /* Fractal Type 1, Basic, and this is the same correction the animal
           prints needed — in the place it does the most damage.

           The turbulent family is bright-biased: it renders as light cloud
           with dark veins, mean well above mid-grey. Soft-clamped, that is a
           map which is nearly white nearly everywhere with a few dark
           filaments through it. A bump map like that is FLAT, and a shader
           handed a flat map has nothing to shade — which is why CC Glass
           appeared to be doing nothing on seven of the eight metals.

           The eighth was Hammered, whose map is a Cell Pattern rather than
           noise, so it used its full range. Hammered is also the only metal
           that has looked like metal in three contact sheets. That is not a
           coincidence, it is the controlled experiment. */
        lgFractalSet(lgFxNamed(s, ['ADBE Fractal Noise'], 'Metal Grain'), {
            fractalType: 1,
            noiseType:   num(o.noiseType, 4),
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
    /* Budgeted against the solid's own overhang, exactly as the surface's
       displacements are budgeted against LG_OVERSIZE. The Crumple slider goes
       to 400 and a reach of 3.2x puts that 1280px past the edge of a 600px
       pad — the tear then prints straight through onto the metal, because this
       map is what CC Glass reads as its bump source. */
    var crumpleMax = lgDisplaceBudget(HEIGHT_PAD, 0);
    if (warp > crumpleMax) warp = crumpleMax;

    /* A spec may state the crumple outright instead of taking it from the
       slider, and Foil does. Its Amount is 718 at a Size of TWO — a
       displacement whose noise is two pixels across does not bend the field,
       it shreds it, and shredded fractal noise is exactly what the inside of
       a crumpled sheet of foil looks like. That is the same mechanism as Fur,
       reached from the opposite direction, and no amount of moving a Crumple
       slider between 20 and 250 would ever have found it — which is why the
       size floor of 20 below is bypassed rather than lowered for everyone. */
    var crumpleAmt  = (o.crumpleAmount !== undefined) ? num(o.crumpleAmount, 0) : warp;
    var crumpleSize = (o.crumpleSize !== undefined)
                        ? Math.max(1, num(o.crumpleSize, 2) * scale)
                        : Math.max(20, 180 * scale);

    var td = lgFxStage(s, ['ADBE Turbulent Displace'], 'Metal Crumple',
                       crumpleAmt > 0);
    if (td) {
        lgTurbSet(td, {
            mode: num(o.crumpleMode, 4), amount: crumpleAmt, complexity: 1,
            size: crumpleSize, speed: speed * 0.6
        });
        try { td.enabled = crumpleAmt > 0; } catch (e) { }
    }

    /* The brush. Applied to the height field rather than to the picture,
       because a brushed surface is a surface whose *shape* runs one way —
       smearing the finished image would only blur the render. */
    var brushLen = num(o.brushLength, 0);
    var brush = lgFxStage(s, ['ADBE Motion Blur'], 'Metal Brush', brushLen > 0);
    if (brush) {
        LG.set(brush, 'Direction',   1, num(o.brushDirection, 90));
        LG.set(brush, 'Blur Length', 2, brushLen * scale);
        try { brush.enabled = brushLen > 0; } catch (e) { }
    }

    /* Normals are a derivative, so any pixel-level noise left in the height
       field arrives in the shading multiplied. This blur is not cosmetic —
       on every finish whose tooling is larger than a pixel.

       Foil is the exception and asks for zero. Its creases ARE pixel-level
       structure: the whole look is a two-pixel cross displacement, and a blur
       wide enough to be worth applying would erase the only thing on the map.
       So the floor of 0.5 applies to a spec that says nothing and not to one
       that says none. */
    var smoothPx = num(o.smooth, 5) * scale;
    lgBlur(s, (o.smooth === 0) ? 0 : Math.max(0.5, smoothPx));
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

    /* CRUMPLED FOIL NEEDS NONE OF THE ENVIRONMENT.

       Every other finish here is a reflection with a surface in front of it.
       Foil is only the surface: the creases in its height map are the whole
       look, and a ramp folded into bands behind them made it worse rather
       than better. `bare` switches the reflection stage off — ramp, fold,
       twist, environment, toner, bloom — instead of setting each one to
       something quiet. Off is a state that cannot drift, and it is also half
       the render. */
    var bare = o.bare === true;

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
        try { ramp.enabled = !bare; } catch (e) { }
        LG.set(ramp, 'Start of Ramp', 1, [0, 0]);
        LG.set(ramp, 'End of Ramp',   3, [w, h * (num(o.tilt, 14) / 100)]);
        LG.set(ramp, 'Start Color',   2, [0, 0, 0]);
        LG.set(ramp, 'End Color',     4, [1, 1, 1]);
    }

    /* Sliding Tile Center rather than Phase — Phase offsets alternate tiles
       against each other and shears the reflection instead of drifting it. */
    var wantFold = !bare && num(o.bands, 0) > 0;
    var tile = lgFxStage(s, ['ADBE Tile'], 'Metal Fold', wantFold);
    if (tile) {
        try { tile.enabled = wantFold; } catch (e) { }
        LG.set(tile, 'Tile Width',    2, 100 / Math.max(1, num(o.bands, 1)));
        /* 25 on the molten metals, 100 everywhere else, and it is one of the
           four numbers that separate a pour from a stripe — see MOLTEN. */
        LG.set(tile, 'Tile Height',   3, num(o.foldHeight, 100));
        LG.set(tile, 'Output Width',  4, 100);
        LG.set(tile, 'Output Height', 5, 100);
        LG.set(tile, 'Mirror Edges',  6, true);
        LG.expr(tile, 'Tile Center', 1, speed !== 0
            ? '[value[0] + time * ' + (speed * 6) + ', value[1]]'
            : 'value');
    }

    /* Anything a previous version of this file left behind. A layer built
       before the hairlines were diagnosed still carries the wrap-back field,
       and an effect nobody sets any more is an effect nobody turns off.

       FIND, NEVER ADD. lgFxNamed applies the effect when it cannot find one,
       so this line was putting a fresh Fractal Noise onto every metal it built
       purely in order to switch it off again — a dead effect on the stack of
       all eight, and one more thing between the ramp and the shader. What it
       does to a layer that still has a live one is visible in
       tools/bisect/02 -> 03: frame 02 is the smooth mirrored bands this
       gradient is trying to be, and frame 03, with Metal Flow on, is grey
       mottle with no bands left in it at all. */
    var stale = lgFindNamed(s, 'Metal Flow');
    if (stale) { try { stale.enabled = false; } catch (e) { } }

    /* 2. Bend it, within a budget.

          THE BLACK HOLES. The last sheet came back with the flow finally
          reading as poured metal and two hard-edged pure-black shapes cut out
          of it. Pure black is not in any of these palettes — it is nothing at
          all, the comp showing through where the layer had no pixels.

          Turbulent Displace samples: to put a pixel here it fetches one from
          up to `Amount` away, and past the layer's own edge there is nothing
          to fetch. The layer is built oversized precisely so there is
          something out there, but the overhang is finite, and two stacked
          displacements of 100 and 356 wanted 456px of it where only 162px
          existed vertically. The holes reached in from the top and bottom
          edges, which is exactly where they were.

          So the overhang is a budget and it is spent, not exceeded. Vertical
          is what binds — the frame is wider than it is tall, so the layer's
          vertical overhang is the smaller of the two. */
    var overhang = (h - h / LG_OVERSIZE) / 2;

    /* The shader displaces on top of the turbulence and fetches from the same
       overhang, so its reach is reserved rather than hoped for. Worked out here
       and handed to the shader below, so the number the budget reserves and the
       number the shader actually uses cannot drift apart.

       Slightly conservative on Mercury and Gunmetal, which run CC Blobbylize
       and CC Plastic — neither has a Displacement at all, so they reserve a
       little they will not spend. Erring that way costs a fraction of the pour
       and the other way costs a hole. */
    var glassDisp   = Math.min(relief * 0.8, lgHeightFinestFeature(o) * 0.6);
    var glassSoften = Math.max(1, relief * 0.12);
    var budget = lgDisplaceBudget(overhang, glassDisp + glassSoften);

    var twistAmt, envAmt;

    if (o.twistAmount !== undefined || o.envAmount !== undefined) {
        /* A MEASURED RECIPE IS NOT BUDGETED, AND THAT IS DELIBERATE.

           The budget above converts overhang into an Amount at a flat 3.2px of
           reach per unit. That constant was measured on one mode at one size
           and it is pessimistic here: the molten stack asks for 433 + 229,
           which the model says needs 2118px of overhang against the 972px that
           exists — and the hand-tuned comp those numbers came off has no holes
           in it anywhere. Reach depends on the displacement mode and its Size,
           neither of which the model looks at.

           What actually makes holes impossible is Pin All, which lgTurbSet
           sets on every one of these: an out-of-bounds fetch returns the
           nearest real pixel instead of transparency, so there is nothing to
           tear. The budget is a second belt on top of that braces, and here it
           would cost the look to buy safety that Pin All already provides.

           So: a spec that states its amounts gets them. A spec that derives
           them from the Crumple slider still goes through the budget, because
           there the numbers are guesses and a guess should be capped. */
        twistAmt = flow ? num(o.twistAmount, 0) : 0;
        envAmt   = num(o.envAmount, 0);
        var extra = num(o.warp, 0);
        if (extra) { twistAmt += extra * 0.25; envAmt += extra * 0.8; }
    } else {
        twistAmt = flow ? 70 + num(o.warp, 0) * 0.25 : 0;
        envAmt   = flow ? 260 + num(o.warp, 0) * 0.8 : num(o.warp, 0) * 0.6;
        var fitted = lgFitDisplace([twistAmt, envAmt], budget);
        twistAmt = fitted[0];
        envAmt   = fitted[1];
    }

    /* Twist Smoother rather than Twist: plain Twist winds tight spirals whose
       centres compress the bands into a vortex, and a vortex is the other
       thing an earlier sheet was full of. */
    var wantTwist = !bare && twistAmt > 0;
    var twist = lgFxStage(s, ['ADBE Turbulent Displace'], 'Metal Twist', wantTwist);
    if (twist) {
        lgTurbSet(twist, {
            mode: num(o.twistMode, 6), amount: twistAmt, complexity: 1,
            size: Math.max(1, num(o.twistSize, Math.max(300, 1000 * scale)) * scale),
            speed: speed * -0.2
        });
        try { twist.enabled = wantTwist; } catch (e) { }
    }

    var wantEnv = !bare && envAmt > 0;
    var env = lgFxStage(s, ['ADBE Turbulent Displace'], 'Metal Environment', wantEnv);
    if (env) {
        lgTurbSet(env, {
            mode: num(o.envMode, 4), amount: envAmt, complexity: 1,
            size: Math.max(1, num(o.envSize, flow ? 620 : 300) * scale),
            speed: speed * 0.3
        });
        try { env.enabled = wantEnv; } catch (e) { }
    }

    /* 3. The palette.

          The molten metals declare `tritone` and take three roles: Shadow,
          Base Metal and Highlight. Everything else keeps the five-stop ramp.

          THE CLAIM THAT USED TO BE HERE WAS WRONG. It said Brights and
          Darktones "do nothing in that mode", and that is what let lgToneTri
          write three stops and leave the other two at CC Toner's own tan
          defaults. Mode 3 is Pentone, not Tritone; all five stops are live.
          Molten Silver -- three neutral colours -- rendered gold because of
          it. lgToneTri now fills all five and the note there carries the
          measurement. */
    var wantToner = !bare && (o.toner !== false);
    var toner = lgFxOn(s, ['CC Toner'], wantToner);
    if (toner) {
        if (o.tritone) lgToneTri(toner, c);
        else           lgToneColors(toner, c, true);
        try { toner.enabled = wantToner; } catch (e) { }
    }

    /* 4. The shader. One of two, fixed per preset — never switched at run
          time, so the effect stack a live update walks is the one the build
          made. */
    var specular = num(o.specular, 80);
    var material = {
        intensity:   num(o.lightIntensity, 60 + specular * 0.35),
        lightAngle:  num(o.lightAngle, 315),
        lightHeight: num(o.lightHeight, 45),
        ambient:     num(o.ambient, 40),
        diffuse:     num(o.diffuse, 45),
        specular:    specular,
        roughness:   num(o.roughness, 10),
        metal:       num(o.metal, 100)
    };

    if (o.shader === 'none') {
        /* The molten metals. Nothing to light — see MOLTEN. All three
           shaders are named here rather than just the one this preset would
           have used, because a layer built by an earlier version could be
           carrying any of them and a live shader on a stack nobody sets any
           more is the same failure as the dead Fractal Noise was. */
        lgFxOn(s, ['CC Glass'],      false);
        lgFxOn(s, ['CC Plastic'],    false);
        lgFxOn(s, ['CC Blobbylize'], false);
    } else if (o.shader === 'plastic') {
        var plastic = lgFx(s, ['CC Plastic']);
        if (plastic) {
            if (bumpIndex) LG.set(plastic, 'Bump Layer', 2, bumpIndex);
            LG.set(plastic, 'Property', 3, 5);               // Lightness
            LG.set(plastic, 'Softness', 4, Math.max(1, relief * 0.12));
            LG.set(plastic, 'Height',   5, relief);
            material.dust = num(o.dust, 0);
            lgShadeSet(plastic, material, 'CC Plastic');
        }
    } else if (o.shader === 'blobbylize') {
        var blob = lgFx(s, ['CC Blobbylize']);
        if (blob) {
            if (bumpIndex) LG.set(blob, 'Blob Layer', 2, bumpIndex);
            LG.set(blob, 'Property', 3, 5);                  // Lightness
            LG.set(blob, 'Softness', 4, Math.max(1, relief * 0.55));
            /* Cut Away is where the droplet's edge falls: it discards the
               bottom of the height range, so what is left stands proud with a
               rounded shoulder instead of fading out. It is the difference
               between droplets and lumps. */
            LG.set(blob, 'Cut Away', 5, num(o.blobCut, 30));
            lgShadeSet(blob, material, 'CC Blobbylize');
        }
    } else {
        var glass = lgFx(s, ['CC Glass']);
        if (glass) {
            /* Displacement is what bends the reflection over the tooling, and
               it has a ceiling that Relief knows nothing about: bend the
               picture further than the distance between one bump and the next
               and the reflection tears across the surface instead of flowing
               over it. See lgHeightFinestFeature — and tools/bisect/06 next to
               07, which is that failure with nothing else changed.

               Height is deliberately left at full Relief. Height is how hard
               the surface is lit and Displacement is how far the picture is
               bent; only the second one shreds, so capping it keeps the metal
               as lit as it ever was and stops the crinkle. */
            /* A measured recipe states all three. Height and Displacement
               are signed on the molten metals — negative inverts the normals
               and bends the reflection against the slope, which is what puts
               the bright band in the trough of a fold instead of on its ridge.
               Relief still scales them, so the slider keeps working: it moves
               the depth without flipping the sign that makes it metal. */
            var reliefScale = relief / 30;
            lgGlassSurface(glass, bumpIndex, {
                softness:     o.glassSoftness !== undefined
                                ? num(o.glassSoftness, 0) : glassSoften,
                height:       o.glassHeight !== undefined
                                ? num(o.glassHeight, 40) * reliefScale : relief,
                displacement: o.glassDisplacement !== undefined
                                ? num(o.glassDisplacement, 60) * reliefScale : glassDisp
            });
            lgShadeSet(glass, material, 'CC Glass');
        }
    }

    // 5. Bloom on the specular, then the optional final soften.
    var wantBloom = !bare && o.bloom !== false
                          && (sheen > 0 || num(o.bloomIntensity, 0) > 0);
    var g = lgFxStage(s, ['ADBE Glo2'], 'Metal Bloom', wantBloom);
    if (g) {
        LG.set(g, 'Glow Threshold', 2, o.bloomThreshold !== undefined ? o.bloomThreshold : Math.max(0, 100 - sheen * 0.4));
        LG.set(g, 'Glow Radius',    3, o.bloomRadius !== undefined ? o.bloomRadius : 12 + sheen * 0.9);
        LG.set(g, 'Glow Intensity', 4, o.bloomIntensity !== undefined ? o.bloomIntensity : sheen / 110);
        LG.set(g, 'Glow Colors',    7, 1);                       // Original Colors
        try { g.enabled = wantBloom; } catch (e) { }
    }

    /* The final soften is zero on every metal in the library. A Fast Box Blur
       at radius zero is still a row in the panel and still a pass over an
       oversized layer, so it is applied only when the slider asks for one — or
       when the layer already carries one, in which case the slider goes on
       driving it down to zero and back the way it always did. */
    var soften = num(o.softness, 0);
    if (soften > 0 || findFx(s, ['ADBE Box Blur2'])) lgBlur(s, soften);
}

/* Every displaced layer is built larger than the comp so there is image
   beyond the frame for the displacements to fetch. 1.8 rather than the 1.3 it
   started at: at 1.3 a 1080-tall comp has only 162px of vertical overhang,
   and the flow metals were asking for more than twice that.

   tuneMetalSurface reads this same constant to work out how much
   displacement it can afford, so the two can never disagree. */
var LG_OVERSIZE = 2.8;

/* HOW FAR A TURBULENT DISPLACE ACTUALLY REACHES, PER UNIT OF "Amount".

   This is the number the holes were about, and it was guessed three times
   before it was measured. It is not 1. Amount is not a cap in pixels.

   WHICH STAGE, from tools/hole_bisect.jsx. Frames 00-04 are opaque to every
   edge; frame 05, whose only difference is Metal Environment switching on,
   tears to the vertical centre of the frame. So the environment stage is the
   one that overruns the overhang, and it overruns it by a long way. That is
   qualitative: those frames were rendered in a small comp, and the amounts
   scale with the comp, so they say which effect and not how much.

   HOW MUCH, from tools/hole_probe_report.txt, which dumped a real 1920x1080
   build: Metal Twist at Amount 77.2 and Metal Environment at 268.4 on a layer
   with 432px of vertical overhang, and it tore roughly half of the 1080 frame
   away. Write the reach as k x Amount:

     total Amount 345.6, reach about 432 + 540      ->   k ~= 2.8

   And a second, weaker constraint from the attempt after it — LG_OVERSIZE 2.4
   with the amounts fitted to 290 against 756px of overhang — which reduced the
   tear to a strip along the bottom edge rather than removing it:

     290k a little over 756                         ->   k >~ 2.6

   THE SIZE-PROPORTIONAL MODEL IS OUT. If the reach went as Amount x Size, the
   probe's two stages at Size 1000 and 620 would have reached 772 + 1664 px
   past a 432px overhang, which is the whole frame several times over. Half of
   it survived. So the reach follows Amount, and whatever Size contributes is
   small enough to sit inside the margin below.

   3.2 rather than 2.8 is that margin — about 15%, on a quantity estimated from
   pixels counted by eye in one render. It is an inference, not a measurement,
   and it is the last one left in this file: tools/reach_calibrate.jsx renders
   a sweep of Amount x Size x mode and tools/reach_measure.js decodes the alpha
   and prints the fitted slope. Run those two and put the number they give here,
   and the displacement budget stops being an estimate. */
var LG_REACH_PER_AMOUNT = 3.2;

/* The most Amount a stack of displacements may ask for, given how much image
   there is beyond the edge to fetch from. `reserved` is what later effects on
   the same layer will spend out of the same overhang — CC Glass displaces on
   top of the turbulence, and its reach is not free either.

   Every caller budgets through this, so the reach model lives in one place and
   a future calibration changes every gradient at once. */
function lgDisplaceBudget(overhang, reserved) {
    var usable = overhang - (reserved || 0);
    if (usable < 0) usable = 0;
    return usable / LG_REACH_PER_AMOUNT;
}

/* Scale a requested displacement stack down to fit a budget. Takes and returns
   an array of Amounts, so the relative weighting a preset chose survives. */
function lgFitDisplace(amounts, budget) {
    var wanted = 0, i, out = [];
    for (i = 0; i < amounts.length; i++) wanted += amounts[i];
    var fit = (wanted > budget && wanted > 0) ? budget / wanted : 1;
    for (i = 0; i < amounts.length; i++) out.push(amounts[i] * fit);
    return out;
}

function lgOversize(n) { return Math.round(n * LG_OVERSIZE); }

/* How far the height solid overhangs its own comp on every side. The Crumple
   inside that comp is budgeted against this the same way the surface's
   displacements are budgeted against LG_OVERSIZE — it used to be a round
   number chosen to be "comfortably past" the largest Crumple the panel offers,
   which at Amount 400 and a reach of 3.2x was not close to true.

   800 AND A SLIDER THAT STOPS AT 250 ARE ONE DECISION. 800 / 3.2 is 250, so the
   top of the Crumple slider is exactly what this pad can pay for and every
   position on it does something. At 600 the cap landed at 188 while the slider
   went to 400, which meant the top half of the control was inert — and Foil's
   own default of 240 was being silently clamped.

   Going the other way instead — keeping the slider at 400 and padding to 1280 —
   costs real render area: the height solid is already 6976 x 4624 at delivery
   size and that would take it past 44 megapixels for a map nobody looks at. */
var HEIGHT_PAD = 800;

/* THE BACKSTOP IS GONE, and this is what used to be here.

   A third layer sat under the metal: the same ramp, folded into the same
   bands, through the same palette, heavily blurred — so that if a
   displacement ever tore, the hole fell through to soft out-of-focus metal
   instead of to nothing. It was insurance against a reach model that had
   been wrong three times.

   It is removed because a build is now two layers and only two — the metal
   solid and the comp holding its height map — and a backstop nobody ever
   sees is still a comp-sized layer carrying a ramp, a tile and a toner on
   every metal ever built. The molten stack has been rendered at delivery
   size with Amounts of 433 and 229 against 972px of overhang and it does not
   tear.

   If the tearing does come back, the fix is the overhang or the Amount, not
   a layer painted underneath to hide it. */

function buildMetalTexture(comp, c, ctrl, w, h, dur, kind) {
    var fps = comp.frameRate;
    var OW = lgOversize(w), OH = lgOversize(h);

    /* 1. The height field, in its own comp.

       The solid is built LARGER than the comp that holds it, and that is the
       whole point of the number below.

       Everywhere else in this file a displaced layer is oversized relative to
       the comp it sits in (see LG_OVERSIZE), so there is image beyond the
       frame for the displacement to fetch. The height field was the one place
       that was not: the solid was created at exactly OW x OH inside a comp of
       exactly OW x OH, so its edges and the comp's edges were the same line.

       Turbulent Displace, Directional Blur and CC Glass all work by fetching a
       pixel from somewhere else on the layer. Ask any of them for a pixel past
       the edge and there is nothing there, so they fetch transparency — and
       with the layer edge sitting exactly on the comp edge, that torn alpha
       lands inside the frame instead of safely outside it. The height map is
       CC Glass's bump source, so the holes then print straight through onto
       the metal. That is why the checkerboard showed up in the same shape on
       the height map and on the finished gradient.

       HEIGHT_PAD is the overhang, sized past the largest Crumple the panel can
       ask for so the tear always happens off-comp where nothing can see it.

       AND IT IS SKIPPED ENTIRELY WHEN NOTHING READS IT. A height map exists to
       be some shader's bump source. The molten metals have no shader — see
       MOLTEN — so building the comp for them would leave a disabled layer in
       the project pointing at a full-size, fully-animated Fractal Noise that
       renders for nobody. */
    var spec = METAL_SURFACES[kind] || METAL_SURFACES.Polished;
    if (spec.shader !== 'none') {
        var heightComp = app.project.items.addComp(kind + ' Height Map', OW, OH, 1, dur, fps);
        var heightSolid = heightComp.layers.addSolid([0.5, 0.5, 0.5], 'Height',
                                                     OW + HEIGHT_PAD * 2,
                                                     OH + HEIGHT_PAD * 2, 1, dur);
        tuneMetalHeight(heightSolid, ctrl, kind);

        // 2. The layers into the target comp, bottom-most first.
        var bump = comp.layers.add(heightComp);
        bump.name = kind + ' Height';
        bump.enabled = false;        // a bump source, not a picture
    }

    /* And the metal itself. Two layers in the comp for a shaded finish, one
       for a molten one, and that is the whole build — see the note by
       HEIGHT_PAD for the backstop that used to make it three. */
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
    else LG.warn(kind + ': lost the metal layer before shading it');
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
function lgToneStops(toner, stops) {   /* @effect toner = CC Toner */
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
            LG.set(cell, 'Contextual Slider', 3, contrast);
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
        /* 100, as a literal. This line was pasted in from tuneMetalSurface,
           which reads `o.foldHeight` off a surface spec it looks up through
           lgDefaults() — and there is no `o` in this function and no
           foldHeight in METAL_FINISHES, so building Satin Waves threw
           "ReferenceError: o is undefined" every time, in the panel as much as
           in the render tools.

           100 is the right number rather than just the safe one: foldHeight is
           25 on the molten metals and 100 everywhere else (see MOLTEN), Satin
           Waves is not a molten metal, and 100 is what the pasted expression's
           own fallback would have produced had `o` merely been empty instead of
           absent. */
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
        try { g.enabled = !bare && sheen > 0; } catch (e) { }
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
function lgToneColors(toner, c, ordered, hard) {   /* @effect toner = CC Toner */
    if (!toner) return null;
    var src = ordered ? c : lgByLuma(c);
    var s = hard ? lgSteps5(src) : lgRamp5(src);
    /* 3 IS TRITONE, NOT PENTONE. The comment here said Pentone for a long
       time and the effect controls of anything this panel built say Tritone,
       which means Brights and Darktones have been inert on every metal, every
       animal print and every glass the panel has ever made — two of the five
       stops below are written and then ignored. Left at 3 because that is
       what all of those looks were tuned against; see lgToneTri for the
       version that admits it. */
    LG.set(toner, 'Tones',      1, 3);                       // 3 = Tritone
    LG.set(toner, 'Shadows',    6, s[0]);
    LG.set(toner, 'Darktones',  5, s[1]);
    LG.set(toner, 'Midtones',   4, s[2]);
    LG.set(toner, 'Brights',    3, s[3]);
    LG.set(toner, 'Highlights', 2, s[4]);
    return toner;
}

/* THREE STOPS, WRITTEN AS THREE.

   CC Toner in Tritone uses Shadows, Midtones and Highlights and ignores the
   other two. This takes a three-colour palette and puts each colour where it
   goes — no ramp, no luminance sort, no fifth stop quietly discarded. Shadow
   is what the surface reflects with nothing lighting it, Base Metal is the
   body colour that says copper rather than steel, and Highlight is the
   specular hit.

   A palette with more than three colours still works: the first, the middle
   and the last are taken, which is what a saved four-colour metal preset
   needs in order to keep looking like itself. */
function lgToneTri(toner, c) {   /* @effect toner = CC Toner */
    if (!toner) return null;
    var n = (c && c.length) ? c.length : 0;
    if (!n) return toner;

    var shadow    = c[0];
    var body      = c[Math.floor((n - 1) / 2)];
    var highlight = c[n - 1];

    /* ALL FIVE STOPS, NOT THREE, AND TONES 3 IS PENTONE.

       This used to set Tones to 3 with the comment "// Tritone", then write
       Shadows, Midtones and Highlights and stop -- leaving Brights and
       Darktones at whatever CC Toner defaults to. Those defaults are
       #c0aa78 and #40320a: a tan and a dark olive.

       Mode 3 is Pentone. lgToneStops, thirty lines down, has always said so
       in its own comment and has always written all five. So the panel held
       both readings of the same number and acted on the wrong one here.

       What it looked like: Molten Silver. Its palette is #0B0E12 / #7E8B99 /
       #FFFFFF -- three neutrals, no hue anywhere -- and it rendered visibly
       gold, because two of the five stops it was being mapped through were a
       tan nobody chose. Measured on a build: mean chroma 29.3/255 with a peak
       of 71 on a palette whose own chroma is 14. Copper and Gold hid it, being
       warm already; the neutral one is where a foreign colour has nowhere to
       blend in.

       Sweeping Tones 1..5 does not fix it -- no mode renders neutral, because
       the wrong colours are in the STOPS, not in the mode. So this fills every
       stop from the palette and the choice of mode stops mattering: the two
       intermediates are the midpoints either side of the body colour, which is
       what a metal ramp wants anyway. A three-colour palette still gives a
       three-colour metal; it just no longer travels through a tan to get
       between them. */
    lgToneStops(toner, [ shadow,
                         lgMix(shadow, body, 0.5),
                         body,
                         lgMix(body, highlight, 0.5),
                         highlight ]);
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
    var found = lgFindNamed(layer, label);
    if (found) return found;
    var added = addFx(layer, names);
    if (added) { try { added.name = label; } catch (e) { } }
    return added;
}

/* Set the value of an Expression Control that this panel named. Several
   gradients are driven entirely by expressions reading `effect('Speed')(1)`,
   which makes them the easiest things in the file to update live — one number
   on one slider and every expression that reads it follows. */
function lgCtrlSet(layer, label, value) {
    var fx = lgFindNamed(layer, label);
    if (!fx) return false;
    /* Property 1 of a Slider Control is "Slider" and of a Color Control is
       "Color". Ask by index: these two effects have exactly one parameter, so
       there is nothing else it could be, on any host in any language. */
    try { fx.property(1).setValue(value); return true; } catch (e) { }
    LG.warn("could not set the '" + label + "' control");
    return false;
}

/* The first shape group's Contents — where every shape builder in this file
   puts its path, stroke and repeater. */
function lgShapeContents(layer) {
    try { return layer.property('Contents').property(1).property('Contents'); }
    catch (e) { return null; }
}

/* An item inside a shape group, by matchName. Shape items have no stable
   index: adding a repeater or a rounded-corners filter shifts everything after
   it, and several builders here do exactly that. */
function lgShapeItem(gc, matchName) {
    if (!gc) return null;
    var i, q;
    for (i = 1; i <= gc.numProperties; i++) {
        q = null;
        try { q = gc.property(i); } catch (e) { continue; }
        try { if (q && q.matchName === matchName) return q; } catch (e) { }
    }
    return null;
}

/* The same lookup without the "or apply one". For effects that only ever need
   handling when a layer built by an older version still carries them — asking
   lgFxNamed for those applies a fresh effect just so the next line can switch
   it off, which is how a dead Fractal Noise ended up on all eight metals. */
function lgFindNamed(layer, label) {
    var effects = null, i, ef;
    try { effects = layer.property('Effects'); } catch (e) { return null; }
    for (i = 1; i <= effects.numProperties; i++) {
        ef = null;
        try { ef = effects.property(i); } catch (e) { continue; }
        if (ef && ef.name === label) return ef;
    }
    return null;
}

/* AN OPTIONAL STAGE — applied only when it does something.

   lgFxNamed and lgFx both mean "find it, or apply it", and every stage in the
   metal builder went through one of them. So a preset that wanted none of the
   reflection still got a Ramp, a Motion Tile, two Turbulent Displaces, a CC
   Toner and a Glow applied to its layer, and the next six lines switched them
   all off again. Crumpled Foil is two effects; the panel was building it as
   eight, six of them dead rows in the Effect Controls panel with their fx
   switches dark, all of them still in the stack for a live update to walk.

   These take the answer instead of assuming yes:

     want true    exactly lgFxNamed / lgFx. Find it, or apply it.
     want false   NEVER apply. A layer that a previous version already put the
                  stage on keeps it — found and switched off, because deleting
                  an effect a saved preset might turn back on is not this
                  function's call — but a fresh build simply does not have it.

   The one asymmetry worth knowing: a stage that was skipped at build time and
   is later wanted by a slider gets applied at the END of the stack rather than
   in its proper place. Every stage that can be switched on by a control is
   already non-zero in the specs that offer that control, so this is currently
   unreachable; it is written down because the day it stops being unreachable
   the symptom is an ordering bug, not a missing effect. */
function lgFxStage(layer, names, label, want) {
    if (want) return lgFxNamed(layer, names, label);
    var found = lgFindNamed(layer, label);
    if (found) { try { found.enabled = false; } catch (e) { } }
    return null;
}

/* The same, for the stages this file identifies by matchName rather than by a
   name it gave them — CC Toner, CC Glass, the shaders. */
function lgFxOn(layer, names, want) {
    if (want) return lgFx(layer, names);
    var found = findFx(layer, names);
    if (found) { try { found.enabled = false; } catch (e) { } }
    return null;
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
function lgFractalSet(fn, o) {   /* @effect fn = ADBE Fractal Noise */
    if (!fn) return null;

    /* The turbulent fractal types are bright-biased: they render as light
       cloud with dark veins, mean well above mid-grey. Raise Contrast without
       pulling Brightness down to match and the field clips to white, which
       downstream means every pixel lands on the gradient map's top stop and
       the render comes out one flat colour. That was the yellow frame. */
    /* The compensation below existed already but nothing could ever reach it:
       it only applied when a caller left `brightness` undefined, and every
       single caller in this file passes it explicitly. So the correction was
       dead code, and the fields it was written to rescue went on clipping.

       It is now applied as an offset on top of whatever the caller asked for,
       and only to the fractal types that actually need it. Fractal Type 1
       (Basic) is plain fBm and symmetric about mid-grey by construction, so it
       gets nothing. The turbulent family is folded noise -- its mean sits well
       above mid-grey -- so raising Contrast on it drives the whole field up
       into the ceiling. What that looks like downstream depends only on the
       Overflow mode, which is why one root cause produced so many different
       symptoms:

         Clip       -> large areas flatten to pure white. The blown-out
                       blotches on Frosted Glass, the voids in the ASCII map.
         Soft Clamp -> the field compresses into its top end and goes mushy,
                       leaving a shader nothing to shade. The metals.
         Wrap Back  -> whole regions sit against the wrap boundary at once and
                       flip together as the noise evolves. That is not a
                       gradient flickering, it is every pixel in a region
                       crossing the same threshold on the same frame -- the
                       strobing on Liquid Waves and Liquid Mercury.

       Centre the field and all three behave: Clip stops clipping, Soft Clamp
       keeps its mid-range, and Wrap Back's boundaries become smooth contours
       that travel across the frame instead of regions that blink. */
    var contrast = num(o.contrast, 120);
    var fractalType = o.fractalType || 2;
    var bias = (fractalType === 1) ? 0 : -(contrast - 100) * 0.22;
    var brightness = num(o.brightness, 0) + bias;
    var scale = num(o.scale, 150);

    LG.set(fn, 'Fractal Type', 1, fractalType);          // 2 = Turbulent Smooth
    LG.set(fn, 'Noise Type',   2, o.noiseType !== undefined ? o.noiseType : 4);                    // 4 = Spline
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
function lgTurbSet(td, o) {   /* @effect td = ADBE Turbulent Displace */
    if (!td) return null;
    LG.set(td, 'Displacement', 1, o.mode || 1);
    LG.set(td, 'Amount',       2, num(o.amount, 100));
    /* Size tops out at 1000 and throws above it — which is how eight metals
       came back warning "cannot set 'Size'" the moment the flow field asked
       for 1100. A Size that never lands keeps the effect's default of 100,
       and 100 is far below the band width, which is precisely the ratio that
       frays bands into hairlines instead of pouring them (see rule 8). One
       refused write, and the whole look goes back to where it started. */
    LG.set(td, 'Size',         3, Math.min(1000, Math.max(1, num(o.size, 100))));
    if (o.complexity !== undefined) LG.set(td, 'Complexity', 5, o.complexity);
    var speed = num(o.speed, 20);
    LG.expr(td, 'Evolution', 6, speed !== 0 ? 'time * ' + speed : 'value');

    /* Pinning and Resize Layer, set explicitly rather than left to whatever
       the host defaults to. This is the holes.

       Turbulent Displace moves pixels by fetching them from somewhere else on
       the layer. Ask for a displacement near an edge and it reaches past the
       layer bounds, where there is nothing -- so it fetches transparency and
       punches a hole straight through an otherwise opaque surface. Composited
       over nothing, that reads as a hard-edged black void, which is exactly
       what the metals were showing.

       'Pin All' clamps the fetch to the layer's own edges, so an
       out-of-bounds sample returns the nearest real pixel instead of a hole.
       Resize Layer stays off: the layers here are already oversized on purpose
       (see LG_OVERSIZE) and letting the effect grow them again would knock
       every downstream index and bump-layer reference out of alignment.

       PIN ALL IS OPTION 11, NOT OPTION 1, AND THIS LINE SAID 1.

       The INDEX was right and the VALUE was wrong, which is the one kind of
       dropdown error nothing here was checking for. index_audit.js verifies
       that property 12 is Pinning -- and it is -- so the audit passed, in
       green, while every Turbulent Displace in the library ran unpinned.
       A wrong value hides in exactly the place a wrong index cannot.

       Measured, not reasoned, on the rule this file already lives by. Copper
       was built at 1920x1080, the comp then grown to the metal layer's own
       5376x3024 so all four edges were inside the frame, a pure green solid
       put underneath so torn alpha could not be mistaken for a dark pixel,
       and all seventeen options rendered. Green pixels over the whole layer:

         option  1  (what was here)   30043    tears on all four edges
         option  3                     1281    right edge only
         option  4                    14374
         option  8                    20775
         option 11                        0    <-- pins all four
         option 12                     8471
         option 16                    16944

       Option 11 is the only value that tears nowhere, which is what Pin All
       means. In the visible 1920x1080 crop, option 1 was leaving 6.64% of the
       frame as hard-edged black voids: the holes hanging from the top of
       Molten Copper, Molten Gold and Molten Silver.

       This is one line and it is not one gradient. lgTurbSet is the only place
       Pinning is written and twelve call sites go through it, so the same tear
       was in everything that displaces -- which is why the symptom looked
       different every time it was chased.

       Both are indices 12 and 13 -- from tools/effect_probe_report.txt, not
       from memory. The 11 is from the sweep above, for the same reason. */
    LG.set(td, 'Pinning',      12, 11);
    LG.set(td, 'Resize Layer', 13, false);
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
    /* @effect toner = CC Toner */
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
        /* The interface labels property 3 "Contrast" for most patterns and
           "Sharpness" for the crystallised ones. The DOM calls it "Contextual
           Slider" in every case, so that is what to ask for — asking for
           "Contrast" missed the name and the scan and landed on the index,
           which meant this one write was resolving the one way the rest of
           this file treats as a last resort. */
        LG.set(cell, 'Contextual Slider', 3, num(ctrl.contrast, 140));
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

/* -- LIQUID RIBBONS ---------------------------------------------------
   THE RIBBONS USED TO RUN OUT.

   Every shape was parented to one null and that null slid left forever, at
   speed * 50 px/sec -- 1000 px/sec on the default. A CC RepeTile adjustment
   layer above them was meant to make that endless, and it does not: RepeTile
   expands a layer's bounds, and the comp still only ever shows the frame. So
   the field simply left. 4000 px of Expand Left at 1000 px/sec is four
   seconds, which is exactly when the ribbons vanished.

   Each shape now carries its own drift and wraps itself: it leaves the left
   edge and re-enters from the right, a full margin outside the frame in both
   directions so nothing pops into view inside it. No null, no RepeTile, and
   no end. */
var SONDUCK_COUNT  = 15;    // ribbons in the band
var SONDUCK_MARGIN = 400;   // how far past each edge a ribbon lives before wrapping

function buildSonduckLiquid(comp, c, ctrl, w, h, dur) {
    var fps = comp.frameRate;
    var shapesComp = app.project.items.addComp("Sonduck Shapes", w, h, 1, dur, fps);
    var band = w + SONDUCK_MARGIN * 2;

    for (var i = 0; i < SONDUCK_COUNT; i++) {
        var star = shapesComp.layers.addShape();
        /* Named, because the live path finds each one by name -- and a ribbon
           that keeps its index in its name is a ribbon whose drift a live
           update can reproduce exactly. */
        star.name = "Ribbon " + i;
        var gc = star.property("Contents")
                     .addProperty("ADBE Vector Group").property("Contents");
        var path = gc.addProperty("ADBE Vector Shape - Star");
        safeSet(path, "Type",         1, 1);
        safeSet(path, "Points",       2, 5);
        safeSet(path, "Inner Radius", 4, 100);
        safeSet(path, "Outer Radius", 5, 250);
        var fill = gc.addProperty("ADBE Vector Graphic - Fill");
        safeSet(fill, "Color", 4, i < Math.ceil(SONDUCK_COUNT / 2) ? [1, 1, 1] : [0, 0, 0]);

        /* Spread evenly across the band instead of dropped at random. Fifteen
           random positions leave holes wide enough to read as a gap travelling
           through the frame, which is half of why the old one looked like it
           was emptying even before it did. */
        var x = -SONDUCK_MARGIN + (i + 0.5) * (band / SONDUCK_COUNT);
        var y = (((i * 7) % SONDUCK_COUNT) / SONDUCK_COUNT) * h;
        try { star.property("Transform").property("Position").setValue([x, y]); }
        catch (e) { LG.warn("SonduckLiquid: cannot position ribbon " + i); }

        tuneRibbonDrift(star, null, ctrl);
    }

    comp.layers.addSolid([0.1, 0, 0.2], "Background", w, h, 1, dur);
    var shapesLayer = comp.layers.add(shapesComp);
    shapesLayer.name = "Sonduck Shapes";

    addFx(shapesLayer, ["ADBE Tint", "Tint"]);

    var dirBlur = addFx(shapesLayer, ["ADBE Motion Blur", "Directional Blur"]);
    if (dirBlur) {
        LG.set(dirBlur, "Direction",   1, 30);
        LG.set(dirBlur, "Blur Length", 2, 700);
    }

    var twirl = addFx(shapesLayer, ["ADBE Twirl", "Twirl"]);
    if (twirl) {
        LG.set(twirl, "Angle",        1, 60);
        LG.set(twirl, "Twirl Radius", 2, 60);
    }

    tuneSonduckLiquid(shapesLayer, c, ctrl);
}

/* One ribbon's endless drift. The wrap is modulo the band, so the shape is
   always somewhere in [-margin, width + margin) however long the comp runs,
   and the jump happens a full margin outside the frame where nothing can see
   it. The double modulo is not superstition: JavaScript's % keeps the sign of
   the left operand, so a plain % turns negative the moment the drift passes
   the origin and the ribbon leaves for good -- the same failure in a new
   costume. */
function tuneRibbonDrift(layer, cols, ctrl) {
    if (!layer) return;
    var speed = num(ctrl.speed, 20);
    var pos = null;
    try { pos = layer.property("Transform").property("Position"); } catch (e) { }
    if (!pos) return;
    try {
        pos.expression = speed !== 0
            ? ("var m = " + SONDUCK_MARGIN + ", band = thisComp.width + m * 2;\n" +
               "var x = value[0] - time * " + (speed * 50) + ";\n" +
               "x = ((((x + m) % band) + band) % band) - m;\n" +
               "[x, value[1]]")
            : "";
    } catch (e) {
        LG.warn('could not set the drift on "' + layer.name + '"');
    }
}

function tuneSonduckLiquid(s, c, ctrl) {
    if (!s) return;
    var tint = findFx(s, ["ADBE Tint", "Tint"]);
    if (tint) {
        LG.set(tint, "Map Black To", 1, c[0]);
        LG.set(tint, "Map White To", 2, c[1] || c[0]);
    }
}

/* -- LAVA LAMP --------------------------------------------------------
   What was here was not a lava lamp and could not have become one.

   CC RepeTile ran FIRST, ahead of the gradient. RepeTile expands the layer's
   bounds -- 2000 px right, 1000 px on the other three -- so every effect after
   it worked on a canvas about 4900x3080 while the comp only ever showed the
   middle 1920x1080 of it. The 4-Color Gradient spread its four points across
   that whole expanded canvas, so the frame saw one corner of one colour, and
   Twirl's 35% radius, measured on the same expanded canvas, swung a spiral far
   wider than the frame. On top of that sat Fractal Noise at Contrast 200 and
   Brightness -30 in a darkening blending mode, which crushes nearly the whole
   field to black. A black frame with two enormous arcs across it. That is
   precisely what it rendered.

   A lava lamp is blobs: round, slow, rising, necking apart and merging back.
   None of that comes from a gradient with noise laid over it. It comes from
   one smooth noise field thresholded hard enough that the bright parts break
   into separate islands, panned upward so they rise, bulged so they pinch,
   and coloured by luminance so the cores read hot and the fluid around them
   reads deep. That is what this builds -- on the same solid-plus-Toner spine
   every other working gradient in this file uses. */
function buildLavaLamp(comp, c, ctrl, w, h, dur) {
    var s = comp.layers.addSolid([0, 0, 0], "Lava Lamp", w, h, 1, dur);
    tuneLavaLamp(s, c, ctrl);
}

/* Every knob is an effect property or an expression on one layer, so all of
   them are live. Nothing here needs a rebuild. */
function tuneLavaLamp(s, c, ctrl) {
    if (!s) return;

    var size  = num(ctrl.blobSize, 420);
    var melt  = num(ctrl.melt, 190);
    var rise  = num(ctrl.rise, 45);
    var morph = num(ctrl.morph, 12);

    /* Fractal Type 1 (Basic) on purpose. It is the one type symmetric about
       mid-grey, so Contrast lifts the peaks and drops the troughs by the same
       amount instead of driving the whole field into the ceiling -- and
       Contrast is the only thing here separating a cloud from a blob. The
       brightness offset holds the field centred as Contrast climbs, the same
       correction lgFractalSet applies to the turbulent types, and the reason
       this can sit at Overflow Clip without blowing out.

       Complexity 2 keeps the islands round; more octaves fray their edges back
       into cloud. Taller than wide, because a rising blob stretches. */
    var fn = lgFx(s, ['ADBE Fractal Noise']);
    lgFractalSet(fn, {
        fractalType: 1,
        contrast:    melt,
        brightness:  -(melt - 100) * 0.30,
        overflow:    1,
        complexity:  2,
        scale:       size,
        scaleWidth:  size,
        scaleHeight: size * 1.7,
        speed:       morph
    });

    /* The rise. Offset Turbulence pans the field itself, so blobs travel up
       through the frame while Evolution reshapes them on the way -- which is
       the difference between a lamp and a texture that happens to be moving. */
    LG.expr(fn, 'Offset Turbulence', 13, rise !== 0
        ? '[value[0], value[1] - time * ' + rise + ']'
        : 'value');

    /* Bulge, not Turbulent. Turbulent shivers the whole edge at once; Bulge
       pushes regions in and out, which is what makes a blob neck down, split,
       and swallow its neighbour. Size tracks the blob so the distortion is the
       scale of the thing it is distorting rather than noise laid on top. */
    lgTurbSet(lgFx(s, ['ADBE Turbulent Displace']), {
        mode:   2,
        amount: num(ctrl.wobble, 70),
        size:   Math.min(1000, Math.max(60, size * 0.9)),
        speed:  morph * 0.5
    });

    lgBlur(s, num(ctrl.softness, 10));

    /* Sorted by luminance, not by slot order: the darkest colour becomes the
       fluid the blobs hang in and the brightest becomes the core, whatever
       order the four swatches happen to be in. A lamp with its hot colour in
       the background is not a lamp. */
    lgToneColors(lgFx(s, ['CC Toner']), c, false);
    lgGlow(s, num(ctrl.heat, 35), 2.0);
}

function buildStackedSquares(comp, c, ctrl, w, h, dur) {
    var s = comp.layers.addSolid([1,1,1], "Stacked Background", w, h, 1, dur);
    try { s.property("Transform").property("Scale").setValue([250, 250]); } catch(e) {}

    addFx(s, ['ADBE 4ColorGradient', '4-Color Gradient']);
    
    var mt = addFx(s, ['ADBE Tile']);
    if (mt) {
        safeSet(mt, 'Output Width', 4, 150);
        safeSet(mt, 'Output Height', 5, 150);
        safeSet(mt, 'Mirror Edges', 6, true);
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

        var drop = addFx(sq, ["ADBE Drop Shadow", "Drop Shadow"]);
        if (drop) {
            safeSet(drop, "Opacity", 2, 255);
            safeSet(drop, "Distance", 4, 0);
            safeSet(drop, "Softness", 5, 200);
        }
        
        if (j !== 3) {
            try { sq.blendingMode = BlendingMode.MULTIPLY; } catch(e) {}
        } else {
            addFx(sq, ['ADBE 4ColorGradient', '4-Color Gradient']);
        }
    }

    /* Every square is named "Square N", and the tuner works off that name, so
       the build and a slider drag walk the same layers by the same route. */
    tuneStackedSquares(s, c, ctrl);
    for (var k = 1; k <= 5; k++) {
        var sqNow = null, li;
        for (li = 1; li <= comp.numLayers; li++) {
            if (comp.layer(li).name === "Square " + k) { sqNow = comp.layer(li); break; }
        }
        if (sqNow) tuneStackedSquare(sqNow, c, ctrl);
    }
}

/* The backdrop: a four-colour field under the stack, rotating slowly. */
function tuneStackedSquares(s, c, ctrl) {
    if (!s) return;
    var speed = num(ctrl.speed, 20);
    lgWiggleGradient(findFx(s, ['ADBE 4ColorGradient', '4-Color Gradient']), c, 0);
    lgRotate(s, speed * 0.75, 0);
}

/* One square. The rotation offset is derived from the name so the five stay
   fanned out by the same two degrees each after a live update as they were
   when they were built. */
function tuneStackedSquare(sq, c, ctrl) {
    if (!sq) return;
    var speed = num(ctrl.speed, 20);
    var j = parseInt(String(sq.name).replace(/[^0-9]/g, ''), 10);
    if (isNaN(j)) j = 1;
    lgRotate(sq, speed, (j - 1) * 2);
    if (j === 3) lgWiggleGradient(findFx(sq, ['ADBE 4ColorGradient', '4-Color Gradient']), c, 1);
}

/* A rotation that runs at `speed` degrees a second, offset by `offset`. An
   empty expression rather than "time * 0" when the speed is zero, so the
   layer's own Rotation value is what shows. */
function lgRotate(layer, speed, offset) {
    var rot = null;
    try { rot = layer.property("Transform").property("Rotation"); } catch (e) { return; }
    try {
        rot.expression = speed !== 0
            ? "time * " + speed + " - " + (offset || 0)
            : '';
    } catch (e) { LG.warn('could not animate the rotation on "' + layer.name + '"'); }
}

/* Four colours on a 4-Color Gradient, each drifting on its own wiggle.
   `shift` rotates which palette entry lands on which corner. */
function lgWiggleGradient(g4, c, shift) {
    if (!g4) return;
    var cidx = [3, 5, 7, 9], pidx = [2, 4, 6, 8], i;
    for (i = 0; i < 4; i++) {
        LG.set(g4, 'Color ' + (i + 1), cidx[i], c[(i + (shift || 0)) % c.length]);
        LG.expr(g4, 'Point ' + (i + 1), pidx[i], 'wiggle(0.5, 500)');
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

    var precomp = app.project.items.addComp("Trail Base", w, h, 1, dur, comp.frameRate);

    for (var i = 0; i < numStrokes; i++) {
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
            LG.set(tile, "Output Height", 5, 400);
            LG.set(tile, "Mirror Edges",  6, true);
        }
        tuneTrailStroke(s, null, ctrl, w);

        try { s.property("Transform").property("Position").setValue([xPos, h / 2]); }
        catch (e) { LG.warn("TrailGradient: cannot position stroke " + i); }
    }

    var finalLayer = comp.layers.add(precomp);
    finalLayer.name = "Trail Animation";

    /* Map the greyscale trail onto the picked colours.

       This used to write the five CC Toner stops by hand with Tones set to 3
       and a comment calling it Pentatone. 3 is Tritone -- lgToneColors has
       said so for a while -- and Tritone reads Shadows, Midtones and
       Highlights and ignores the other two. Both of the stops that were being
       skipped were Colour 2 and Colour 4, which is why moving either of them
       did nothing at all to this gradient. Going through lgToneColors ramps
       the whole palette into the stops that are actually read, the same way
       every other gradient in this file does. */
    var toner = lgFx(finalLayer, ["CC Toner"]);
    if (!toner) {
        // No Cycore on this host — tint the extremes instead of leaving it grey.
        var tint = addFx(finalLayer, ["ADBE Tint"]);
        if (tint) {
            safeSet(tint, "Map Black To", 1, c[3] || c[0]);
            safeSet(tint, "Map White To", 2, c[0]);
        }
    }

    addFx(finalLayer, ["ADBE WRPMESH"]);
    tuneTrailGradient(finalLayer, c, ctrl);
}

/* One stroke. The bank reads as a travelling wave because each stroke scrolls
   at its own speed, and that speed is derived from the layer's own name so a
   live update reproduces exactly what the build made.

   Phase Pattern is the shape of that speed across the bank, and it is the one
   knob that changes this gradient most: same strokes, same colours, entirely
   different motion. Spread is how hard the pattern is pushed -- at 0 every
   stroke moves together and the bank is a flat scrolling sheet. */
function tuneTrailStroke(s, cols, ctrl, w) {
    if (!s) return;
    var i = parseInt(String(s.name).replace(/[^0-9]/g, ''), 10);
    if (isNaN(i)) i = 0;

    var base   = num(ctrl.cycleSpeed, 600);
    var spread = num(ctrl.spread, 100) / 100;
    /* The stroke count is not stored anywhere, but it is not a free variable
       either: the builder derives it from the comp width and the trail width,
       and both of those are still here. Recomputing it is how Mirror and Sine
       find the middle of a bank they were not told the size of. */
    var width  = Math.max(4, num(ctrl.width, 60));
    var count  = Math.ceil(num(w, 1920) / width) + 4;
    var speed;

    switch (ctrl.phase) {
        case 'Sine':
            /* Two full turns across the bank, so the whole thing breathes in
               and out instead of shearing one way. */
            speed = base * (1 + 0.6 * spread * Math.sin((i / count) * Math.PI * 4));
            break;
        case 'Mirror':
            // Symmetric about the middle: a chevron opening from the centre.
            speed = base - Math.abs(i - count / 2) * 40 * spread;
            break;
        case 'Random':
            /* Seeded off the index, never Math.random. A live update has to
               land on the same number the build did or every drag reshuffles
               the whole bank into a different look. */
            speed = base * (0.35 + 1.30 * lgTrailHash(i) * spread);
            break;
        case 'Counterflow':
            // Alternate strokes run the other way. Reads as a braid.
            speed = (i % 2 === 0 ? 1 : -1) * (base - (i * 20 * spread));
            break;
        default:   // Linear, the original, and still the right default
            speed = base - (i * 20 * spread);
            break;
    }

    var tile = findFx(s, ["ADBE Tile"]);
    if (!tile) return;
    LG.expr(tile, "Tile Center", 1,
            "[value[0], value[1] + (time * " + speed + ")]");
}

/* A stable pseudo-random in [0,1) from a stroke index -- the same hash the
   preview painters use, for the same reason: it has to be the same number
   every time it is asked. */
function lgTrailHash(i) {
    var n = (i * 1619 + 31337) & 0x7fffffff;
    n = (n >> 13) ^ n;
    return ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 0x7fffffff;
}

/* AE's Warp styles, in menu order. Flat is not one of them -- it is Squeeze
   with the bend taken to zero, which is the only way to switch the distortion
   off without removing an effect the live path expects to find. */
var TRAIL_WARPS = {
    'Flat':    0,  'Arc':     1,  'Arch':    4,  'Bulge':   5,
    'Flag':    8,  'Wave':    9,  'Fish':   10,  'Rise':   11,
    'Fisheye': 12, 'Inflate': 13, 'Squeeze': 14, 'Twist':  15
};

/* The finished bank. Trail *width* stays a rebuild -- it decides how many
   strokes there are and how wide each solid is, and a solid cannot be resized
   after the fact. Everything else on this layer is free to drag. */
function tuneTrailGradient(s, c, ctrl) {
    if (!s) return;

    var warp = findFx(s, ["ADBE WRPMESH"]);
    if (warp) {
        var style = TRAIL_WARPS[ctrl.warpStyle];
        if (style === undefined) style = 14;          // Squeeze, the original
        LG.set(warp, "Warp Style", 1, style || 14);
        /* Warp Axis flips which way the bend runs. On a bank of vertical
           strokes the two axes are not variations on each other -- one arcs
           the strokes and the other arcs the bank. */
        LG.set(warp, "Warp Axis",  2, ctrl.warpAxis === 'Vertical' ? 2 : 1);
        LG.set(warp, "Bend",       3, style === 0 ? 0 : num(ctrl.bend, 30));
    }

    /* Palette order or luminance order. Ordered keeps Colour 1 at the shadow
       end whatever it is, which is what you want when the palette was chosen
       as a sequence; sorted puts the darkest colour in the dark, which is what
       you want when it was chosen as a set. */
    var toner = findFx(s, ["CC Toner"]);
    if (toner) lgToneColors(toner, c, ctrl.colorOrder !== 'By Luminance');
}

// --- WEB STUDIO CLONES ---

function buildPrismaticBurst(comp, c, ctrl, w, h, dur) {
    // Bottom Layer: Gradient
    var gradLayer = comp.layers.addSolid([1,1,1], "Prismatic Colors", w, h, 1, dur);
    gradLayer.startTime = 0;
    
    addFx(gradLayer, ["ADBE 4ColorGradient", "4-Color Gradient"]);
    tunePrismaticColors(gradLayer, c, ctrl, w, h);

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
    
    addFx(rayLayer, ["ADBE Fractal Noise", "Fractal Noise"]);
    tunePrismaticRays(rayLayer, c, ctrl);

    
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

/* The rays are a Fractal Noise squeezed to an extreme width-to-height ratio
   and then wrapped by Rect-to-Polar, so ray density is Scale Width and nothing
   structural. All three sliders are live. */
function tunePrismaticRays(s, c, ctrl) {
    if (!s) return;
    var noise = findFx(s, ["ADBE Fractal Noise", "Fractal Noise"]);
    if (!noise) { LG.warn('Prismatic Burst: the ray field is missing'); return; }

    LG.set(noise, "Fractal Type", 1, 1); // Basic
    LG.set(noise, "Noise Type",   2, 1); // Block
    LG.set(noise, "Contrast",     4, 300);
    LG.set(noise, "Brightness",   5, 0);
    LG.set(noise, "Complexity",  16, 4);

    /* "Transform" and "Sub Settings" are topic markers with no children. The
       rays are made entirely by the ratio below, so reaching through an empty
       group is the difference between rays and undifferentiated block noise. */
    LG.set(noise, "Uniform Scaling", 9, false);
    LG.set(noise, "Scale Width",    11, Math.max(1, num(ctrl.rayCount, 5) * 2));
    LG.set(noise, "Scale Height",   12, 4000);
    LG.set(noise, "Sub Influence (%)", 18, num(ctrl.distort, 250) / 5);
    LG.expr(noise, "Evolution", 24, "time * " + num(ctrl.speed, 100));
}

function tunePrismaticColors(s, c, ctrl, w, h) {
    if (!s) return;
    var ramp = findFx(s, ["ADBE 4ColorGradient", "4-Color Gradient"]);
    if (!ramp) return;
    var speed = num(ctrl.speed, 100);
    var width = w || 1920, height = h || 1080;
    var pts = [[width * 0.1, height * 0.1], [width * 0.9, height * 0.1],
               [width * 0.1, height * 0.9], [width * 0.9, height * 0.9]];
    var idx = [2, 4, 6, 8], cidx = [3, 5, 7, 9], i;
    for (i = 0; i < 4; i++) {
        LG.set(ramp, "Point " + (i + 1), idx[i], pts[i]);
        LG.set(ramp, "Color " + (i + 1), cidx[i], c[i % c.length]);
        LG.expr(ramp, "Point " + (i + 1), idx[i],
                "wiggle(" + (speed / 50) + ", " + (width / 4) + ")");
    }
}

function buildAntigravity(comp, c, ctrl, w, h, dur) {
    comp.layers.addSolid([0.07, 0.05, 0.09], "Background Void", w, h, 1, dur);

    var emitterLayer = comp.layers.addSolid([0, 0, 0], "Antigravity Particles", w, h, 1, dur);
    emitterLayer.blendingMode = BlendingMode.ADD;

    addFx(emitterLayer, ["CC Particle World"]);

    var glow = lgFxNamed(emitterLayer, ["ADBE Glo2"], 'Particle Glow');
    if (glow) {
        LG.set(glow, "Glow Threshold", 2, 30);   // particles are dim; bite early
        LG.set(glow, "Glow Radius",    3, 50);
        LG.set(glow, "Glow Intensity", 4, 1.5);
    }

    tuneAntigravity(emitterLayer, c, ctrl);
}

/* Every setting on this one is a CC Particle World parameter, so all three
   sliders are live. Particle count is a birth *rate* rather than a fixed
   population, which is why even that does not need a rebuild. */
function tuneAntigravity(s, c, ctrl) {
    if (!s) return;
    var pw = findFx(s, ["CC Particle World"]);
    if (!pw) { LG.warn('Antigravity: CC Particle World is not on this layer'); return; }

    safeSet(pw, "Birth Rate", null, num(ctrl.count, 500) / 100);
    safeSet(pw, "Longevity (sec)", null, 4);

    safeSetGroup(pw, "Producer", "Radius X", null, 0.2);
    safeSetGroup(pw, "Producer", "Radius Y", null, 0.2);

    safeSetGroup(pw, "Physics", "Velocity", null, num(ctrl.waveSpeed, 0.4));
    safeSetGroup(pw, "Physics", "Gravity", null, 0);        // Antigravity!
    safeSetGroup(pw, "Physics", "Resistance", null, 0.5);

    safeSetGroup(pw, "Particle", "Particle Type", null, 2); // Line
    safeSetGroup(pw, "Particle", "Birth Size", null, num(ctrl.particleSize, 2) / 10);
    safeSetGroup(pw, "Particle", "Death Size", null, 0);
    safeSetGroup(pw, "Particle", "Size Variation", null, 100);
    safeSetGroup(pw, "Particle", "Max Opacity", null, 100);
    safeSetGroup(pw, "Particle", "Birth Color", null, c[0] || [1, 0.62, 0.98]);
    safeSetGroup(pw, "Particle", "Death Color", null, c[1] || [0.32, 0.15, 1]);
}

function buildWaves(comp, c, ctrl, w, h, dur) {
    comp.layers.addSolid([0.07, 0.05, 0.09], "Background", w, h, 1, dur);
    
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
    
    gc.addProperty("ADBE Vector Graphic - Stroke");
    gc.addProperty("ADBE Vector Filter - Repeater");

    linesLayer.property("Transform").property("Position").setValue([-w / 2, 0]);

    addFx(linesLayer, ["ADBE Turbulent Displace", "Turbulent Displace"]);

    tuneWaves(linesLayer, c, ctrl, w, h);
}

/* One shape, one repeater, one displacement — so line gap, amplitude and
   speed are all values rather than structure, and all three are live. The
   repeater's copy count follows the gap so the bank always covers the frame
   however tight it is set. */
function tuneWaves(s, c, ctrl, w, h) {
    if (!s) return;
    var speedX = num(ctrl.waveSpeedX, 0.02);
    var ampX   = num(ctrl.waveAmpX, 40);
    var xGap   = Math.max(1, num(ctrl.xGap, 12));
    var width  = w || 1920;

    var gc = lgShapeContents(s);
    var stroke = lgShapeItem(gc, "ADBE Vector Graphic - Stroke");
    if (stroke) {
        safeSet(stroke, "Color", null, c[0] || [0.32, 0.15, 1]);
        safeSet(stroke, "Stroke Width", null, 1.5);
    } else {
        LG.warn('Waves: could not find the stroke to recolour');
    }

    var repeater = lgShapeItem(gc, "ADBE Vector Filter - Repeater");
    if (repeater) {
        safeSet(repeater, "Copies", null, Math.ceil((width * 2) / xGap));
        var repTransform = null;
        try { repTransform = repeater.property("Transform"); } catch (e) { }
        if (repTransform) safeSet(repTransform, "Position", null, [xGap, 0]);
    }

    var turb = findFx(s, ["ADBE Turbulent Displace", "Turbulent Displace"]);
    if (turb) {
        // A dropdown, and its options are 1-based; 0 was out of range.
        LG.set(turb, "Displacement", 1, 1); // Turbulent
        LG.set(turb, "Amount",       2, ampX * 2);
        LG.set(turb, "Size",         3, 250);
        LG.set(turb, "Complexity",   5, 2);
        LG.expr(turb, "Evolution",   6, "time * " + (speedX * 5000));
        LG.expr(turb, "Offset (Turbulence)", 4, "[value[0], value[1] - time * 200]");
    }
}

function buildWebThreads(comp, c, ctrl, w, h, dur) {
    /* Thread count is the only setting that is structure rather than a value:
       each thread is its own shape group. Everything else the expressions read
       off Expression Controls, and tuneWebThreads writes those. */
    var threadCount = ctrl.threadCount !== undefined ? parseInt(ctrl.threadCount) : 10;

    var bg = comp.layers.addSolid([0.05, 0.05, 0.05], "Background", w, h, 1, dur);
    bg.startTime = 0;

    var layer = comp.layers.addShape();
    layer.name = "Web Threads";
    layer.startTime = 0;
    layer.outPoint = dur;

    /* The controls the expressions read. Applied here, filled in by
       tuneWebThreads so that dragging a slider afterwards writes the same
       number to the same place the build did. */
    var CONTROLS = ['Speed', 'Frequency', 'Spread', 'Taper', 'Pinch Position', 'Thickness'];
    for (var ci = 0; ci < CONTROLS.length; ci++) {
        var sfx = addFx(layer, ["ADBE Slider Control"]);
        if (sfx) { try { sfx.name = CONTROLS[ci]; } catch (e) { } }
    }
    for (var cj = 1; cj <= 3; cj++) {
        var cfx = addFx(layer, ["ADBE Color Control"]);
        if (cfx) { try { cfx.name = 'Color ' + cj; } catch (e) { } }
    }
    tuneWebThreads(layer, c, ctrl);

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

    var mirror = addFx(layer, ["ADBE Mirror"]);
    if (mirror) {
        safeSet(mirror, "Reflection Center", null, [w/2, h/2]);
        safeSet(mirror, "Reflection Angle", null, 90);
    }
    /* After the Mirror, so the glow is not itself mirrored. Tuned rather than
       set, for the same reason as everything else on this layer. */
    tuneWebThreadsGlow(layer, ctrl);
}

/* Every thread's path, width and colour is an expression reading an Expression
   Control on this layer, so the whole gradient tunes by writing eight numbers.
   Thread *count* is the exception — each thread is a shape group, and groups
   are structure, so changing it still rebuilds. */
function tuneWebThreads(s, c, ctrl) {
    if (!s) return;
    lgCtrlSet(s, 'Speed',          num(ctrl.speed, 0.4));
    lgCtrlSet(s, 'Frequency',      num(ctrl.frequency, 14));
    lgCtrlSet(s, 'Spread',         num(ctrl.spread, 0.06));
    lgCtrlSet(s, 'Taper',          num(ctrl.taper, 3));
    lgCtrlSet(s, 'Pinch Position', num(ctrl.position, 0.59));
    lgCtrlSet(s, 'Thickness',      num(ctrl.thickness, 1.1));
    lgCtrlSet(s, 'Color 1', c[0] || [0.13, 0.03, 0.53]);
    lgCtrlSet(s, 'Color 2', c[1] || [0.67, 0.02, 0.65]);
    lgCtrlSet(s, 'Color 3', c[2] || [0.53, 0.15, 0.15]);
    tuneWebThreadsGlow(s, ctrl);
}

function tuneWebThreadsGlow(s, ctrl) {
    var glowAmt = num(ctrl.glow, 0.02);
    var glow = lgFxNamed(s, ['ADBE Glo2'], 'Thread Glow');
    if (!glow) return;
    LG.set(glow, 'Glow Threshold', 2, 40);
    LG.set(glow, 'Glow Radius',    3, glowAmt * 1000 + 20);
    LG.set(glow, 'Glow Intensity', 4, 1.5);
    try { glow.enabled = glowAmt > 0; } catch (e) { }
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
