/*
 * Living Gradients — matchName / property audit
 *
 * Run from AE:  File > Scripts > Run Script File...  (pick this file)
 * It creates a throwaway comp, tries every effect the panel relies on,
 * and writes a report next to this script.
 *
 * The panel swallows every failure silently, so this is the only way to
 * see which effects actually exist on THIS machine + AE version + locale.
 */
(function () {

    // Every effect the panel tries to apply, as [label, matchName, displayName]
    var TARGETS = [
        ["Fractal Noise",       "ADBE Fractal Noise",       "Fractal Noise"],
        ["Turbulent Displace",  "ADBE Turbulent Displace",  "Turbulent Displace"],
        ["Glow",                "ADBE Glo2",                "Glow"],
        ["Fast Box Blur",       "ADBE Box Blur2",           "Fast Box Blur"],
        ["Gaussian Blur",       "ADBE Gaussian Blur 2",     "Gaussian Blur"],
        ["Fast Blur (legacy)",  "ADBE Fast Blur",           "Fast Blur"],
        ["Wave Warp",           "ADBE Wave Warp",           "Wave Warp"],
        ["4-Color Gradient",    "ADBE 4ColorGradient",      "4-Color Gradient"],
        ["Motion Tile",         "ADBE Tile",                "Motion Tile"],
        ["Twirl",               "ADBE Twirl",               "Twirl"],
        ["Tint",                "ADBE Tint",                "Tint"],
        ["Gradient Ramp",       "ADBE Ramp",                "Gradient Ramp"],
        ["Colorama",            "APC Colorama",             "Colorama"],
        ["Extract",             "ADBE Extract",             "Extract"],
        ["Transform (effect)",  "ADBE Geometry2",           "Transform"],
        ["Optics Compensation", "ADBE Optics Compensation", "Optics Compensation"],
        ["Polar Coordinates",   "ADBE Polar Coordinates",   "Polar Coordinates"],
        ["Displacement Map",    "ADBE Displacement Map",    "Displacement Map"],
        ["Curves",              "ADBE CurvesCustom",        "Curves"],
        ["Mirror",              "ADBE Mirror",              "Mirror"],
        ["Mosaic",              "ADBE Mosaic",              "Mosaic"],
        ["Noise",               "ADBE Noise",               "Noise"],
        ["Echo",                "ADBE Echo",                "Echo"],
        ["Directional Blur",    "ADBE Motion Blur",         "Directional Blur"],
        ["Simple Choker",       "ADBE Simple Choker",       "Simple Choker"],
        ["Fill",                "ADBE Fill",                "Fill"],
        ["Drop Shadow",         "ADBE Drop Shadow",         "Drop Shadow"],
        ["Warp",                "ADBE WRPMESH",             "Warp"],
        ["Venetian Blinds",     "ADBE Venetian Blinds",     "Venetian Blinds"],
        ["Cell Pattern",        "ADBE Cell Pattern",        "Cell Pattern"],
        ["Slider Control",      "ADBE Slider Control",      "Slider Control"],
        ["Color Control",       "ADBE Color Control",       "Color Control"],
        // Cycore (bundled, but absent in some trial / stripped installs)
        ["CC RepeTile",         "CC RepeTile",              "CC RepeTile"],
        ["CC Bubbles",          "CC Bubbles",               "CC Bubbles"],
        ["CC Toner",            "CC Toner",                 "CC Toner"],
        ["CC Vector Blur",      "CC Vector Blur",           "CC Vector Blur"],
        ["CC Particle World",   "CC Particle World",        "CC Particle World"],
        // VR / Immersive — panel assumes these for Metallic
        ["VR Color Gradient",   "ADBE VR Color Gradient",   "VR Color Gradient"],
        ["VR Rotate Sphere",    "ADBE VR Rotate Sphere",    "VR Rotate Sphere"],
        ["VR Plane to Sphere",  "ADBE VR Plane to Sphere",  "VR Plane to Sphere"],
        // Third party — panel silently degrades if missing
        ["PE Thick Stroke",     "PE Thick Stroke",          "Thick Stroke"],
        ["Deep Glow",           "Deep Glow",                "Deep Glow"]
    ];

    var out = [];
    function log(s) { out.push(s); }

    var comp = app.project.items.addComp("LG_AUDIT_TMP", 512, 512, 1, 5, 30);
    var layer = comp.layers.addSolid([1, 1, 1], "probe", 512, 512, 1);

    log("Living Gradients — effect audit");
    log("AE version : " + app.version);
    log("Language   : " + app.isoLanguage);
    log("Date       : " + new Date().toString());
    log("");
    log("STATUS  EFFECT                | matchName works | display name works | real matchName");
    log("------------------------------------------------------------------------------------");

    var missing = [];
    for (var i = 0; i < TARGETS.length; i++) {
        var label = TARGETS[i][0], mn = TARGETS[i][1], dn = TARGETS[i][2];
        var byMatch = null, byDisplay = null, realMatch = "";

        try { byMatch = layer.Effects.addProperty(mn); } catch (e) { }
        if (byMatch) { realMatch = byMatch.matchName; byMatch.remove(); }

        try { byDisplay = layer.Effects.addProperty(dn); } catch (e) { }
        if (byDisplay) { if (!realMatch) realMatch = byDisplay.matchName; byDisplay.remove(); }

        var ok = (byMatch || byDisplay);
        if (!ok) missing.push(label);

        log((ok ? "  OK  " : " FAIL ") + "  " +
            pad(label, 22) + "| " +
            pad(byMatch ? "yes" : "NO", 16) + "| " +
            pad(byDisplay ? "yes" : "NO", 19) + "| " +
            realMatch);
    }

    // Property-name probe for the effects the panel sets by name.
    log("");
    log("PROPERTY NAMES (what the panel must use to set values)");
    log("------------------------------------------------------------------------------------");
    var PROBE = ["ADBE Ramp", "ADBE Tile", "ADBE Box Blur2", "ADBE Glo2",
                 "ADBE 4ColorGradient", "ADBE Cell Pattern", "APC Colorama", "ADBE WRPMESH"];
    for (var p = 0; p < PROBE.length; p++) {
        var fx = null;
        try { fx = layer.Effects.addProperty(PROBE[p]); } catch (e) { }
        if (!fx) { log(PROBE[p] + "  -> NOT AVAILABLE"); continue; }
        log(PROBE[p] + "  (" + fx.name + ")");
        for (var q = 1; q <= fx.numProperties; q++) {
            var pr = fx.property(q);
            log("    [" + q + "] " + pr.name + "   {" + pr.matchName + "}");
        }
        fx.remove();
        log("");
    }

    log("");
    log("MISSING ON THIS MACHINE: " + (missing.length ? missing.join(", ") : "none"));

    comp.remove();

    var f = new File((new File($.fileName)).parent.fsName + "/matchname_audit_report.txt");
    f.open("w");
    f.write(out.join("\n"));
    f.close();

    alert("Audit complete.\n\nMissing: " + (missing.length ? missing.join(", ") : "none") +
          "\n\nFull report written to:\n" + f.fsName);

    function pad(s, n) {
        s = String(s);
        while (s.length < n) s += " ";
        return s;
    }
})();
