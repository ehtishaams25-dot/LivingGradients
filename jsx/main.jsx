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
function addFx(layer, names) {
    for (var i = 0; i < names.length; i++) {
        try {
            var e = layer.Effects.addProperty(names[i]);
            if (e) return e;
        } catch (x) { }
    }
    return null;
}

function sp(fx, name, val) {
    try {
        fx.property(name).setValue(val);
    } catch (x) { }
}

function ex(prop, str) {
    try {
        prop.expression = str;
    } catch (x) { }
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

function rgbHsv(r, g, b) {
    var mx = Math.max(r, g, b),
        mn = Math.min(r, g, b),
        d = mx - mn,
        h = 0,
        s = mx ? d / mx : 0,
        v = mx;
    if (d) {
        if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (mx === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
    }
    return [h, s, v];
}

function hsvRgb(h, s, v) {
    var i = Math.floor(h * 6),
        f = h * 6 - i,
        p = v * (1 - s),
        q = v * (1 - f * s),
        t = v * (1 - (1 - f) * s),
        r, g, b;
    switch (i % 6) {
        case 0:
            r = v;
            g = t;
            b = p;
            break;
        case 1:
            r = q;
            g = v;
            b = p;
            break;
        case 2:
            r = p;
            g = v;
            b = t;
            break;
        case 3:
            r = p;
            g = q;
            b = v;
            break;
        case 4:
            r = t;
            g = p;
            b = v;
            break;
        default:
            r = v;
            g = p;
            b = q;
    }
    return [r, g, b];
}

function vibrify(c) {
    var h = rgbHsv(c[0], c[1], c[2]);
    return hsvRgb(h[0], Math.min(1, h[1] * 1.2), Math.min(1, h[2] * 1.05));
}

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

function interpolateOklab(c1, c2, t) {
    var ok1 = rgbToOklab(c1[0], c1[1], c1[2]);
    var ok2 = rgbToOklab(c2[0], c2[1], c2[2]);
    return oklabToRgb(
        ok1[0] + (ok2[0] - ok1[0]) * t,
        ok1[1] + (ok2[1] - ok1[1]) * t,
        ok1[2] + (ok2[2] - ok1[2]) * t
    );
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

function generateGradient(paramsStr) {
    try {
        var p = JSON.parse(paramsStr),
            comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) return 'ERROR: No active composition.';
        var w = comp.width,
            h = comp.height,
            dur = comp.duration;
        var c = [];
        for (var i = 0; i < p.colors.length; i++) c.push(vibrify(hexRgb(p.colors[i])));
        
        p.controls = p.controls || {};
        p.controls.trackingEnabled = p.trackingEnabled;
        p.controls.trackingLayerName = p.trackingLayerName;
        
        app.beginUndoGroup('Living Gradients');
        var beforeCount = comp.numLayers;
        switch (p.type) {
            case 'living':
                buildLiving(comp, c, p.controls, w, h, dur);
                break;
            case 'Silk':
            case 'Aurora':
            case 'Prism':
            case 'Fiber':
            case 'Veil':
            case 'Pulse':
            case 'Comet':
                buildSilkFlare(comp, c, p.controls, w, h, dur, p.type);
                break;
            case 'ChromaFlare':
                buildChromaFlare(comp, c, p.controls, w, h, dur);
                break;
            case 'Metallic':
                buildMetallic(comp, c, p.controls, w, h, dur);
                break;
            case 'Heatmap':
                buildHeatmap(comp, c, p.controls, w, h, dur);
                break;
            case 'Halftone':
                buildHalftone(comp, c, p.controls, w, h, dur);
                break;
            case 'AsciiMatrix':
                buildAsciiMatrix(comp, c, p.controls, w, h, dur);
                break;
            case 'Fluid':
                buildFluid(comp, c, p.controls, w, h, dur);
                break;
            case 'Glass':
                buildGlass(comp, c, p.controls, w, h, dur);
                break;
            case 'ReededGlass':
                buildReededGlass(comp, c, p.controls, w, h, dur);
                break;
            case 'AnimeWater':
                buildAnimeWater(comp, c, p.controls, w, h, dur);
                break;
            case 'Sunburst':
                buildSunburst(comp, c, p.controls, w, h, dur);
                break;
            case 'LiquidWaves':
                buildLiquidWaves(comp, c, p.controls, w, h, dur);
                break;
            case 'CurvedStripes':
                buildCurvedStripes(comp, c, p.controls, w, h, dur);
                break;
            case 'CellularMosaic':
                buildCellularMosaic(comp, c, p.controls, w, h, dur);
                break;
            case 'TrailGradient':
                buildTrailGradient(comp, c, p.controls, w, h, dur);
                break;
            case 'Wavy':
                buildWavy(comp, c, p.controls, w, h, dur);
                break;
            case 'SonduckLiquid':
                buildSonduckLiquid(comp, c, p.controls, w, h, dur);
                break;
            case 'TwirlShapes':
                buildTwirlShapes(comp, c, p.controls, w, h, dur);
                break;
            case 'LavaLamp':
                buildLavaLamp(comp, c, p.controls, w, h, dur);
                break;
            case 'StackedSquares':
                buildStackedSquares(comp, c, p.controls, w, h, dur);
                break;
            case 'PrismaticBurst':
                buildPrismaticBurst(comp, c, p.controls, w, h, dur);
                break;
            case 'Antigravity':
                buildAntigravity(comp, c, p.controls, w, h, dur);
                break;
            case 'Waves':
                buildWaves(comp, c, p.controls, w, h, dur);
                break;
            case 'WebThreads':
                buildWebThreads(comp, c, p.controls, w, h, dur);
                break;
            case 'OklabSmooth':
                buildOklabSmooth(comp, c, p.controls, w, h, dur);
                break;
            case 'ai_custom':
                buildAiCustom(comp, c, w, h, dur, p.customCode);
                break;
            case 'ai_image':
                buildAiImage(comp, c, w, h, dur, p.imagePath);
                break;
            default:
                return 'ERROR: Unknown type: ' + p.type;
        }

        var afterCount = comp.numLayers;
        var addedLayersCount = afterCount - beforeCount;

        applyGlobalPolish(comp, p);

        if (p.trackingEnabled && p.trackingLayerName) {
            applyTrailTracking(comp, p, addedLayersCount);
        }

        app.endUndoGroup();
        return 'Done: ' + comp.name;
    } catch (e) {
        try {
            app.endUndoGroup();
        } catch (x) { }
        return 'ERROR: ' + e.message + ' line ' + e.line;
    }
}

function applyGlobalPolish(comp, p) {
    if (comp.numLayers === 0) return;
    var layer = comp.layer(1); // The top layer just generated

    try {
        layer.comment = 'LIVING_GRADIENT_DATA:' + JSON.stringify(p);
    } catch(e) {}

    if (p.grain && p.grain > 0) {
        var noise = addFx(layer, ['ADBE Noise', 'Noise']);
        if (noise) {
            try { noise.property('Amount of Noise').setValue(p.grain); } catch (e) { }
            try { noise.property('Use Color Noise').setValue(false); } catch (e) { }
        }
    }



    if (p.glow && p.glow > 0) {
        var glow = addFx(layer, ['ADBE Glow2', 'Glow', 'ADBE Glow']);
        if (glow) {
            try { glow.property('Glow Radius').setValue(p.glow); } catch (e) { }
            try { glow.property('Glow Intensity').setValue(p.glow / 50); } catch (e) { }
            try { glow.property('Glow Threshold').setValue(100 - (p.glow * 0.5)); } catch (e) { }
        }
    }

    if (p.bpmSync && p.bpmValue > 0) {
        applyBpmCycleToComp(comp, p, 0);
    }
}

function applyTrailTracking(comp, p, addedLayersCount) {
    if (addedLayersCount <= 0) return;

    var indices = [];
    for (var i = 1; i <= addedLayersCount; i++) {
        indices.push(i);
    }
    
    var precompItem;
    try {
        precompItem = comp.layers.precompose(indices, p.type + " Trail Base", true);
    } catch(e) {
    }
    // `precompose` returns a CompItem. The actual layer representing the precomp is now at index 1.
    var precompLayer = comp.layer(1); 

    var exprLayer = "try {\n" +
               "  var tgt = comp('" + comp.name + "').layer('" + p.trackingLayerName + "');\n" +
               "  if (tgt.hasParent) {\n" + 
               "     tgt.toComp(tgt.anchorPoint);\n" +
               "  } else {\n" +
               "     tgt.transform.position;\n" +
               "  }\n" +
               "} catch(e) { value; }";

    var matteComp;
    try {
        matteComp = app.project.items.addComp("Fluid Track Matte", comp.width, comp.height, comp.pixelAspect, comp.duration, comp.frameRate);
    } catch(e) {
        return; // fallback if precomp fails
    }

    // 1. Fluid Base using Fractal Noise for high-contrast Luma Matte
    var fluidLayer = matteComp.layers.addSolid([1,1,1], "Fluid Base", comp.width, comp.height, comp.duration);
    
    var fracNoise = addFx(fluidLayer, ["ADBE Fractal Noise", "Fractal Noise"]);
    if (fracNoise) {
        safeSet(fracNoise, "Fractal Type", null, 1); // Dynamic
        safeSet(fracNoise, "Noise Type", null, 1); // Block
        safeSet(fracNoise, "Contrast", null, 250);
        safeSet(fracNoise, "Brightness", null, -20);
        safeSet(fracNoise, "Complexity", null, 4);
        safeEx(fracNoise, "Evolution", null, "time * 250");
    }

    var turb = addFx(fluidLayer, ["ADBE Turbulent Displace", "Turbulent Displace"]);
    if (turb) {
        safeSet(turb, "Amount", null, 150);
        safeSet(turb, "Size", null, 100);
        safeSet(turb, "Complexity", null, 2);
        safeEx(turb, "Evolution", null, "time * 200");
    }

    // 2. Tracking shape to reveal the fluid
    var trailMatte = matteComp.layers.addShape();
    trailMatte.name = "Trail Matte (" + p.trackingLayerName + ")";
    var contents = trailMatte.property("Contents");
    var grp = contents.addProperty("ADBE Vector Group");
    var grpContents = grp.property("Contents");
    var ellipse = grpContents.addProperty("ADBE Vector Shape - Ellipse");
    try { ellipse.property("Size").setValue([300, 300]); } catch(e) {
        try { ellipse.property(2).setValue([300, 300]); } catch(e2){}
    }
    var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
    try { fill.property("Color").setValue([1,1,1]); } catch(e) {
        try { fill.property(4).setValue([1,1,1]); } catch(e2){}
    }

    // CRITICAL: Reset Shape layer anchors to 0,0 so Transform effect maps 1:1 with comp space
    try { trailMatte.property("Transform").property("Anchor Point").setValue([0,0]); } catch(e){}
    try { trailMatte.property("Transform").property("Position").setValue([0,0]); } catch(e){}

    var xform = addFx(trailMatte, ["ADBE Geometry2", "Transform"]);
    if (xform) {
        safeSet(xform, "Anchor Point", null, [0,0]);
        safeEx(xform, "Position", null, exprLayer);
    }

    var echo = addFx(trailMatte, ["Echo", "ADBE Echo"]);
    if (echo) {
        safeEx(echo, "Echo Time (seconds)", null, "-thisComp.frameDuration");
        safeSet(echo, "Number Of Echoes", null, 50);
        safeSet(echo, "Starting Intensity", null, 1.0);
        safeSet(echo, "Decay", null, 0.95);
        safeSet(echo, "Echo Operator", null, 2);
    }
    var blur = addFx(trailMatte, ["ADBE Fast Box Blur", "Fast Box Blur", "ADBE Gaussian Blur 2", "Gaussian Blur"]);
    if (blur) safeSet(blur, "Blur Radius", null, 60);

    var choker = addFx(trailMatte, ["ADBE Simple Choker", "Simple Choker"]);
    if (choker) safeSet(choker, "Choke Matte", null, 30);

    // 3. Mask the fluid with the tracking trail
    trailMatte.moveBefore(fluidLayer);
    try { fluidLayer.setTrackMatte(trailMatte, TrackMatteType.ALPHA); } catch(e) {
        try { fluidLayer.trackMatteType = TrackMatteType.ALPHA; } catch(e2){}
    }
    // Explicitly disable the matte layer
    try { trailMatte.enabled = false; } catch(e){}

    // 4. Bring precomp back to main comp and Luma mask the gradient
    var matteCompLayer = comp.layers.add(matteComp);
    matteCompLayer.name = "Fluid Track Matte";
    matteCompLayer.moveBefore(precompLayer);
    
    try {
        precompLayer.setTrackMatte(matteCompLayer, TrackMatteType.LUMA);
    } catch(e) {
        try { precompLayer.trackMatteType = TrackMatteType.LUMA; } catch(e2){}
    }
    // Explicitly disable the matte layer
    try { matteCompLayer.enabled = false; } catch(e){}
    
    // Removed redundant "head" layer since the user's tracked layer is already visible on screen.
}

function applyBpmCycleToComp(comp, p, depth) {
    if (depth > 5) return;
    var cStrs = [];
    for (var i = 0; i < p.colors.length; i++) {
        var rgb = vibrify(hexRgb(p.colors[i]));
        cStrs.push("[" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",1]");
    }
    var arrStr = "[" + cStrs.join(",") + "]";
    var exprBase = "var cArr = " + arrStr + ";\n" +
        "var bpm = " + p.bpmValue + ";\n" +
        "var measureLength = (60 / bpm) * 4;\n";

    for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layer(i);
        // check if layer has 4-color gradient
        var g4 = findFx(layer, ['4-Color Gradient', '4 Color Gradient', 'ADBE 4-Color Gradient', 'ADBE 4ColorGradient']);
        if (g4) {
            for (var c = 1; c <= 4; c++) {
                var expr = exprBase + "var t = (time / measureLength) + " + (c - 1) + ";\n" +
                    "var idx1 = Math.floor(t) % cArr.length;\n" +
                    "var idx2 = (idx1 + 1) % cArr.length;\n" +
                    "var amt = t - Math.floor(t);\n" +
                    "linear(amt, 0, 1, cArr[idx1], cArr[idx2]);";
                try { g4.property('Color ' + c).expression = expr; } catch (e) { }
            }
        }

        // check if layer is a shape layer with a fill
        try {
            if (layer instanceof ShapeLayer) {
                var grps = ["Color", "Circle", "Shape"];
                for (var gi = 0; gi < grps.length; gi++) {
                    var fill = null;
                    try { fill = layer.property("Contents").property(grps[gi]).property("Contents").property("ADBE Vector Graphic - Fill"); } catch (e) { }
                    if (fill) {
                        var offset = Math.floor(Math.random() * 4);
                        var expr = exprBase + "var t = (time / measureLength) + " + offset + ";\n" +
                            "var idx1 = Math.floor(t) % cArr.length;\n" +
                            "var idx2 = (idx1 + 1) % cArr.length;\n" +
                            "var amt = t - Math.floor(t);\n" +
                            "linear(amt, 0, 1, cArr[idx1], cArr[idx2]);";
                        try { fill.property("Color").expression = expr; } catch (e) {
                            try { fill.property(4).expression = expr; } catch (e) { }
                        }
                    }
                }
            }
        } catch (e) { }

        // if layer is a precomp, recurse
        try {
            if (layer.source && layer.source instanceof CompItem) {
                applyBpmCycleToComp(layer.source, p, depth + 1);
            }
        } catch (e) { }
    }
}

// ── 1. OKLAB SMOOTH ──
function buildOklabSmooth(comp, c, ctrl, w, h, dur) {
    var s = comp.layers.addShape();
    s.name = "Oklab Smooth Gradient";
    var contents = s.property("Contents");
    var grp = contents.addProperty("ADBE Vector Group");
    grp.name = "Gradient";
    var grpContents = grp.property("Contents");

    var rect = grpContents.addProperty("ADBE Vector Shape - Rect");
    try { rect.property("Size").setValue([w, h]); } catch (e) {
        try { rect.property(2).setValue([w, h]); } catch (e2) { }
    }

    var gFill = grpContents.addProperty("ADBE Vector Graphic - G-Fill");
    
    // Type: 1 = Linear, 2 = Radial
    var gType = (ctrl.gradientType && ctrl.gradientType.toLowerCase() === 'radial') ? 2 : 1;
    try { gFill.property("Type").setValue(gType); } catch(e) {
        try { gFill.property(1).setValue(gType); } catch(e2){}
    }

    var ov = Math.max(w, h) * 0.1;
    var startPos = ctrl.angle === 90 ? [0, -h/2 + ov] : [-w/2 + ov, 0];
    var endPos = ctrl.angle === 90 ? [0, h/2 - ov] : [w/2 - ov, 0];

    try { gFill.property("Start Point").setValue(startPos); } catch (e) {
        try { gFill.property(4).setValue(startPos); } catch (e2) { }
    }
    try { gFill.property("End Point").setValue(endPos); } catch (e) {
        try { gFill.property(5).setValue(endPos); } catch (e2) { }
    }

    // Generate 15 color stops in Oklab space
    var numStops = 15;
    var colorsArray = [];
    
    // Multi-color support (if more than 2 colors passed)
    var numColors = c.length;
    var segments = numColors > 1 ? numColors - 1 : 1;
    
    for (var i = 0; i < numStops; i++) {
        var t = i / (numStops - 1);
        colorsArray.push(t); // Position

        var segmentT = t * segments;
        var segmentIndex = Math.min(Math.floor(segmentT), segments - 1);
        var localT = segmentT - segmentIndex;

        var c1 = c[segmentIndex % numColors];
        var c2 = c[(segmentIndex + 1) % numColors];

        // Ensure we handle single color gracefully
        if (numColors === 1) c2 = c1;

        var rgb = interpolateOklab(c1, c2, localT);
        colorsArray.push(rgb[0], rgb[1], rgb[2]); // R, G, B
    }

    // Add 2 opacity stops at ends
    colorsArray.push(0, 1.0, 1, 1.0); // pos, alpha, pos, alpha

    // Apply colors
    var colorsProp = null;
    try { colorsProp = gFill.property("Colors"); } catch (e) {
        try { colorsProp = gFill.property(9); } catch (e2) { }
    }

    if (colorsProp) {
        try {
            colorsProp.setValue(colorsArray);
        } catch (e) {
            // Fallback if the array format doesn't match the specific AE version:
            // Gradient Fill Colors property can sometimes be tricky.
        }
    }

    // Option to add some bezier warping or displacement for "smoothness"
    if (ctrl.softness && ctrl.softness > 0) {
        var blur = addFx(s, ["ADBE Fast Box Blur", "Fast Box Blur"]);
        if (blur) {
            safeSet(blur, "Blur Radius", 1, ctrl.softness);
            try { blur.property(4).setValue(true); } catch(e){}
        }
    }
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
    var tile = addFx(s, ['ADBE MotionTile', 'Motion Tile', 'CC RepeTile']);
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
                    pt.setValueAtTime(speed, [(Math.random() * (w + ov * 2)) - ov, (Math.random() * (h + ov * 2)) - ov]);
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
    if (!fx) return;
    try {
        fx.property(idx).setValue(val);
        return;
    } catch (e) { }
    try {
        fx.property(name).setValue(val);
    } catch (e2) { }
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
                    pt.setValueAtTime(speed, [(Math.random() * (w + ov * 2)) - ov, (Math.random() * (h + ov * 2)) - ov]);
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
        try { twirl.property("Twirl Radius").setValueAtTime(speed, twirlRadius); } catch(e) {
            try { twirl.property(2).setValueAtTime(speed, twirlRadius); } catch(e2){}
        }
    }

    // Motion Tile
    var tile1 = addFx(s, ['ADBE MotionTile', 'Motion Tile', 'CC RepeTile']);
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
        try { waveWarp.property("Wave Width").setValueAtTime(speed, waveWidth); } catch(e) {
            try { waveWarp.property(3).setValueAtTime(speed, waveWidth); } catch(e2){}
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
    var tile2 = addFx(s, ['ADBE MotionTile', 'Motion Tile', 'CC RepeTile']);
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

function updateSilkFlareWave(paramsStr) {
    try {
        var ctrl = JSON.parse(paramsStr);
        var realComp = app.project.activeItem;
        if (!realComp) return;
        var selectedLayers = realComp.selectedLayers;
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
                var glow = layer.property("Effects").property("Glow");
                if (!glow) {
                    try { glow = layer.property("Effects").property("ADBE Glow2"); } catch(e) {}
                }
                if (!glow) {
                    try { glow = layer.property("Effects").property("ADBE Glow"); } catch(e) {}
                }

                if (!glow && ctrl.glow > 0) {
                    try { glow = layer.property("Effects").addProperty("ADBE Glow2"); } catch(e) {}
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
        }
        app.endUndoGroup();

        var comp = realComp; // Restore real comp for timeline searching

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
                            try { noise.property("Transform").property("Scale").setValue(parseFloat(hctrl.noiseScale)); } catch (e) { }
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
            var hfctrl = ctrl.controls || ctrl;
            app.beginUndoGroup("Update Halftone Controls");

            // Live update for speed and contrast by scanning project for the Halftone Luma Map
            // (Dot size and shape require a full rebuild)
            for (var i = 1; i <= app.project.numItems; i++) {
                var item = app.project.item(i);
                if (item instanceof CompItem) {
                    if (item.name === "Halftone Luma Map") {
                        var lumaSolid = item.layer("Fluid Gradient");
                        if (lumaSolid) {
                            var turb = findFx(lumaSolid, ["Turbulent Displace", "ADBE Turbulent Displace"]);
                            if (turb && hfctrl.speed !== undefined) {
                                safeEx(turb, "Evolution", 5, "time * " + (parseFloat(hfctrl.speed) * 2));
                            }
                        }
                        var noiseSolid = item.layer("Evolving Noise");
                        if (noiseSolid) {
                            var lumaNoise = findFx(noiseSolid, ["Fractal Noise", "ADBE FractalNoise"]);
                            if (lumaNoise) {
                                if (hfctrl.contrast !== undefined) safeSet(lumaNoise, "Contrast", 4, parseFloat(hfctrl.contrast));
                                if (hfctrl.speed !== undefined) safeEx(lumaNoise, "Evolution", 10, "time * " + (parseFloat(hfctrl.speed) * 1.5));
                            }
                        }
                    }
                }
            }
            // Update the main color layer in the active comp
            for (var l = 1; l <= comp.numLayers; l++) {
                var cLayer = comp.layer(l);
                if (cLayer.name === "Halftone Color") {
                    var cTurb = findFx(cLayer, ["Turbulent Displace", "ADBE Turbulent Displace"]);
                    if (cTurb && hfctrl.speed !== undefined) {
                        safeEx(cTurb, "Evolution", 5, "time * " + (parseFloat(hfctrl.speed) * 2));
                    }
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

        if (ctrl.type === "Glass") {
            var gctrl = ctrl.controls || ctrl;
            app.beginUndoGroup("Update Glass Controls");
            for (var l = 1; l <= comp.numLayers; l++) {
                var cLayer = comp.layer(l);
                if (cLayer.name === "Glass Refraction") {
                    var blur = findFx(cLayer, ["Fast Box Blur", "ADBE Fast Box Blur", "ADBE Gaussian Blur 2"]);
                    if (blur && gctrl.softness !== undefined) {
                        safeSet(blur, "Blur Radius", 1, parseFloat(gctrl.softness));
                    }
                    var disp = findFx(cLayer, ["Displacement Map", "ADBE Displacement Map"]);
                    if (disp && gctrl.refraction !== undefined) {
                        safeSet(disp, "Max Horizontal Displacement", 3, parseFloat(gctrl.refraction));
                    }
                }
            }
            if (gctrl.speed !== undefined) {
                for (var i = 1; i <= app.project.numItems; i++) {
                    var item = app.project.item(i);
                    if (item instanceof CompItem && item.name === "Glass Gradient Map") {
                        var mapSolid = item.layer("Gradient Map");
                        if (mapSolid) {
                            safeEx(mapSolid.property("Transform").property("Position"), "var s = time * " + parseFloat(gctrl.speed) + "; [value[0] - s, value[1]]");
                        }
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

        if (ctrl.type === "AnimeWater") {
            var actrl = ctrl.controls || ctrl;
            app.beginUndoGroup("Update Anime Water Controls");
            for (var l = 1; l <= comp.numLayers; l++) {
                var layer = comp.layer(l);
                if (layer.name === "Anime Water Base" || layer.name === "Anime Water Light") {
                    var bubbles = findFx(layer, ["CC Bubbles"]);
                    if (bubbles) {
                        var multiplier = layer.name === "Anime Water Light" ? 1.5 : 1.0;
                        var speedMult = layer.name === "Anime Water Light" ? 1.2 : 1.0;
                        if (actrl.bubbleAmount !== undefined) safeSet(bubbles, "Bubble Amount", 1, parseFloat(actrl.bubbleAmount) * multiplier);
                        if (actrl.bubbleSpeed !== undefined) safeSet(bubbles, "Bubble Speed", 2, parseFloat(actrl.bubbleSpeed) * speedMult);
                    }
                }
                if (layer.name === "Anime Water Surface" || layer.name === "Anime Water Glow") {
                    var noise = findFx(layer, ["Fractal Noise", "ADBE FractalNoise"]);
                    if (noise) {
                        if (actrl.contrast !== undefined) safeSet(noise, "Contrast", 4, parseFloat(actrl.contrast));
                        if (actrl.speed !== undefined) safeEx(noise, "Evolution", 10, "time * " + parseFloat(actrl.speed));
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
        for (var i = 0; i < hexColors.length; i++) c.push(vibrify(hexRgb(hexColors[i])));

        app.beginUndoGroup("Update Colors Live");

        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) return;

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

    if (lname === 'Oklab Smooth Gradient') {
        try {
            var gFill = null;
            try { gFill = layer.property("Contents").property("Gradient").property("Contents").property("ADBE Vector Graphic - G-Fill"); } catch(e){}
            if (gFill) {
                var numStops = 15;
                var colorsArray = [];
                var numColors = c.length;
                var segments = numColors > 1 ? numColors - 1 : 1;
                for (var i = 0; i < numStops; i++) {
                    var t = i / (numStops - 1);
                    colorsArray.push(t);
                    var segmentT = t * segments;
                    var segmentIndex = Math.min(Math.floor(segmentT), segments - 1);
                    var localT = segmentT - segmentIndex;
                    var c1 = c[segmentIndex % numColors];
                    var c2 = c[(segmentIndex + 1) % numColors];
                    if (numColors === 1) c2 = c1;
                    var rgb = interpolateOklab(c1, c2, localT);
                    colorsArray.push(rgb[0], rgb[1], rgb[2]);
                }
                colorsArray.push(0, 1.0, 1, 1.0);
                var colorsProp = null;
                try { colorsProp = gFill.property("Colors"); } catch (e) {
                    try { colorsProp = gFill.property(9); } catch (e2) { }
                }
                if (colorsProp) colorsProp.setValue(colorsArray);
            }
        } catch (x) { }
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
                try { toner.property("Tones").setValue(4); } catch (e) { try { toner.property(1).setValue(4); } catch (e2) { } }
                try { toner.property("Highlights").setValue(c[3] || [1, 1, 1]); } catch (e) { try { toner.property(2).setValue(c[3] || [1, 1, 1]); } catch (e2) { } }
                try { toner.property("Brights").setValue(c[2] || [1, 1, 0]); } catch (e) { try { toner.property(3).setValue(c[2] || [1, 1, 0]); } catch (e2) { } }
                try { toner.property("Midtones").setValue(c[1] || [1, 0, 0]); } catch (e) { try { toner.property(4).setValue(c[1] || [1, 0, 0]); } catch (e2) { } }
                try { toner.property("Darktones").setValue(c[0] || [0, 0, 1]); } catch (e) { try { toner.property(5).setValue(c[0] || [0, 0, 1]); } catch (e2) { } }
                try { toner.property("Shadows").setValue([0.05, 0.0, 0.1]); } catch (e) { try { toner.property(6).setValue([0.05, 0.0, 0.1]); } catch (e2) { } }
            }
        } catch (x) { }
    }

    if (lname === 'Halftone Gradient' || lname === 'Halftone Color' || lname === 'ASCII Color Overlay' || lname === 'Glass Base Color' || lname === 'Lava Lamp' || lname === 'Stacked Background' || lname.indexOf('Square 3') !== -1) {
        try {
            var ef2 = findFx(layer, ['4-Color Gradient', 'ADBE 4ColorGradient']);
            if (ef2) {
                for (var ci2 = 0; ci2 < 4; ci2++) {
                    try { ef2.property('Color ' + (ci2 + 1)).setValue(c[ci2 % c.length]); } catch (x) { }
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

    if (lname.indexOf('Anime Water') !== -1) {
        try {
            var ramp = findFx(layer, ['Gradient Ramp', 'ADBE Ramp']);
            if (ramp) {
                if (lname === 'Anime Water Base') {
                    try { ramp.property('Start Color').setValue(c[0] || [1,1,1]); } catch(e){}
                    try { ramp.property('End Color').setValue(c[1] || [0,0,0]); } catch(e){}
                } else if (lname === 'Anime Water Light') {
                    try { ramp.property('Start Color').setValue(c[2] || [1,1,1]); } catch(e){}
                    try { ramp.property('End Color').setValue(c[3] || [0,0,0]); } catch(e){}
                }
            }
        } catch (x) { }
    }
}

// ── 5. MASSIVE LIBRARY GENERATORS ──
function safeSet(fx, name, idx, val) {
    if (!fx) return;
    try { fx.property(name).setValue(val); return; } catch (e) { }
    if (idx !== null) { try { fx.property(idx).setValue(val); return; } catch (e) { } }
}
function safeEx(fx, name, idx, expr) {
    if (!fx) return;
    try { fx.property(name).expression = expr; return; } catch (e) { }
    if (idx !== null) { try { fx.property(idx).expression = expr; return; } catch (e) { } }
}
function safeSetGroup(fx, groupName, name, idx, val) {
    if (!fx) return;
    try { fx.property(groupName).property(name).setValue(val); return; } catch (e) { }
    try { fx.property(name).setValue(val); return; } catch (e) { }
    if (idx !== null) { try { fx.property(idx).setValue(val); return; } catch (e) { } }
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
        safeSetGroup(noise, "Transform", "Scale", null, scale);
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

function buildHalftone(comp, c, ctrl, w, h, dur) {
    var proj = app.project;
    var fps = comp.frameRate;
    var dotSize = ctrl.dotSize !== undefined ? parseFloat(ctrl.dotSize) : 40;
    var contrastVal = ctrl.contrast !== undefined ? parseFloat(ctrl.contrast) : 128;
    var speed = ctrl.speed !== undefined ? parseFloat(ctrl.speed) : 30;
    var shapeText = ctrl.shape || "Circle";

    // 1. Luma Source Precomp (The Grayscale map)
    var lumaComp = proj.items.addComp("Halftone Luma Map", w, h, 1, dur, fps);
    var lumaSolid = lumaComp.layers.addSolid([1, 1, 1], "Fluid Gradient", w, h, 1, dur);

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
    addFx(lumaSolid, ["Tint", "ADBE Tint"]); // Make it grayscale

    var noiseSolid = lumaComp.layers.addSolid([1, 1, 1], "Evolving Noise", w, h, 1, dur);
    var lumaNoise = addFx(noiseSolid, ["Fractal Noise", "ADBE FractalNoise"]);
    if (lumaNoise) {
        safeSet(lumaNoise, "Fractal Type", 1, 1);
        safeSet(lumaNoise, "Noise Type", 2, 4); // Spline
        safeSet(lumaNoise, "Contrast", 4, contrastVal);
        safeSet(lumaNoise, "Brightness", 5, 0);
        safeEx(lumaNoise, "Evolution", 10, "time * " + (speed * 1.5));
    }
    try { noiseSolid.blendingMode = BlendingMode.OVERLAY; } catch (e) { }

    // 2. Halftone Cell Precomp (The shape)
    var cellComp = proj.items.addComp("Halftone Cell", Math.round(dotSize), Math.round(dotSize), 1, dur, fps);
    var shapeLayer = null;

    if (shapeText === "Custom Text/Emoji") {
        var charStr = ctrl.customText || "💀";
        shapeLayer = cellComp.layers.addText(charStr);
        shapeLayer.name = "Custom Text";
        var txtDoc = shapeLayer.property("Source Text").value;
        txtDoc.fontSize = dotSize * 0.8;
        txtDoc.fillColor = [1, 1, 1];
        txtDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
        shapeLayer.property("Source Text").setValue(txtDoc);
        shapeLayer.property("Transform").property("Position").setValue([dotSize / 2, dotSize * 0.75]);

        // Force text to pure white
        var fillFx = addFx(shapeLayer, ["Fill", "ADBE Fill"]);
        if (fillFx) safeSet(fillFx, "Color", 2, [1, 1, 1]);
    } else {
        shapeLayer = cellComp.layers.addShape();
        shapeLayer.name = "Shape";
        var contents = shapeLayer.property("Contents");
        var grp = contents.addProperty("ADBE Vector Group");
        var grpContents = grp.property("Contents");

        var shape;
        if (shapeText === "Square") {
            shape = grpContents.addProperty("ADBE Vector Shape - Rect");
            safeSet(shape, "Size", 2, [dotSize * 0.9, dotSize * 0.9]);
        } else if (shapeText === "Cross") {
            shape = grpContents.addProperty("ADBE Vector Shape - Star");
            safeSet(shape, "Type", 1, 1);
            safeSet(shape, "Points", 2, 4);
            safeSet(shape, "Inner Radius", 4, dotSize * 0.1);
            safeSet(shape, "Outer Radius", 5, dotSize * 0.45);
        } else if (shapeText === "Triangle") {
            shape = grpContents.addProperty("ADBE Vector Shape - Star");
            safeSet(shape, "Type", 1, 2);
            safeSet(shape, "Points", 2, 3);
            safeSet(shape, "Outer Radius", 4, dotSize * 0.45);
        } else {
            shape = grpContents.addProperty("ADBE Vector Shape - Ellipse");
            safeSet(shape, "Size", 2, [dotSize * 0.9, dotSize * 0.9]);
        }
        var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
        safeSet(fill, "Color", 4, [1, 1, 1]); // Pure White
        shapeLayer.property("Transform").property("Position").setValue([dotSize / 2, dotSize / 2]);
    }

    // 3. Pattern Grid Comp
    var ow = w * 1.5;
    var oh = h * 1.5;
    var patternComp = proj.items.addComp("Halftone Pattern Grid", Math.round(ow), Math.round(oh), 1, dur, fps);
    var pBg = patternComp.layers.addSolid([0, 0, 0], "Black BG", Math.round(ow), Math.round(oh), 1, dur); // Black background
    var cellLayer = patternComp.layers.add(cellComp);
    cellLayer.property("Transform").property("Position").setValue([ow / 2, oh / 2]);
    var repeTile = addFx(cellLayer, ["CC RepeTile"]);
    if (repeTile) {
        safeSet(repeTile, "Expand Right", 1, ow);
        safeSet(repeTile, "Expand Left", 2, ow);
        safeSet(repeTile, "Expand Down", 3, oh);
        safeSet(repeTile, "Expand Up", 4, oh);
    }

    // 4. Halftone Mask Comp (The Magic Hard Mix)
    var maskComp = proj.items.addComp("Halftone Mask", w, h, 1, dur, fps);

    var maskPattern = maskComp.layers.add(patternComp);
    safeEx(maskPattern.property("Transform").property("Rotation"), "45 + (time * 1)");
    var gBlur = addFx(maskPattern, ["ADBE Fast Box Blur", "Fast Box Blur", "ADBE Fast Blur"]);
    if (gBlur) safeSet(gBlur, "Blur Radius", 1, dotSize * 0.4);

    var maskLuma = maskComp.layers.add(lumaComp);
    try { maskLuma.blendingMode = BlendingMode.HARD_MIX; } catch (e) { }

    // Soften the jagged Hard Mix edges slightly
    var adjLayer = maskComp.layers.addSolid([1, 1, 1], "Anti-Alias", w, h, 1, dur);
    adjLayer.adjustmentLayer = true;
    var aaBlur = addFx(adjLayer, ["ADBE Fast Box Blur", "Fast Box Blur", "ADBE Fast Blur"]);
    if (aaBlur) safeSet(aaBlur, "Blur Radius", 1, 1);

    // 5. Master Comp Integration
    // Background solid (black)
    var bgMaster = comp.layers.addSolid([0, 0, 0], "Background", w, h, 1, dur);

    // Colored Gradient (in main comp so updateLiveColors works!)
    var colorMaster = comp.layers.addSolid([1, 1, 1], "Halftone Color", w, h, 1, dur);
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

    // Halftone Mask
    var maskMaster = comp.layers.add(maskComp);
    maskMaster.enabled = false;

    // Set Luma Matte (mask over color)
    maskMaster.moveBefore(colorMaster);
    try {
        colorMaster.setTrackMatte(maskMaster, TrackMatteType.LUMA);
    } catch (e) {
        try { colorMaster.trackMatteType = TrackMatteType.LUMA; } catch (e2) { }
    }
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

    if (ctrl.trackingEnabled && ctrl.trackingLayerName) {
        var trailShape = lumaComp.layers.addShape();
        trailShape.name = "Trail Source (" + ctrl.trackingLayerName + ")";
        var contents = trailShape.property("Contents");
        var grp = contents.addProperty("ADBE Vector Group");
        var grpContents = grp.property("Contents");
        var ellipse = grpContents.addProperty("ADBE Vector Shape - Ellipse");
        try { ellipse.property("Size").setValue([150, 150]); } catch(e) {
            try { ellipse.property(2).setValue([150, 150]); } catch(e2){}
        }
        var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
        try { fill.property("Color").setValue([1,1,1]); } catch(e) {
            try { fill.property(4).setValue([1,1,1]); } catch(e2){}
        }
        var expr = "try {\n" +
                   "  var tgt = comp('" + comp.name + "').layer('" + ctrl.trackingLayerName + "');\n" +
                   "  if (tgt.hasParent) {\n" + 
                   "     tgt.toComp(tgt.anchorPoint);\n" +
                   "  } else {\n" +
                   "     tgt.transform.position;\n" +
                   "  }\n" +
                   "} catch(e) { value; }";
        try { trailShape.property("Transform").property("Position").expression = expr; } catch(e) {}
        
        var echo = addFx(trailShape, ["Echo", "ADBE Echo"]);
        if (echo) {
            safeEx(echo, "Echo Time (seconds)", 1, "-thisComp.frameDuration");
            safeSet(echo, "Number Of Echoes", 2, 40);
            safeSet(echo, "Starting Intensity", 3, 1.0);
            safeSet(echo, "Decay", 4, 0.92);
            safeSet(echo, "Echo Operator", 5, 2); // 2 = Maximum
        }
        
        var blur = addFx(trailShape, ["ADBE Fast Box Blur", "Fast Box Blur", "ADBE Gaussian Blur 2", "Gaussian Blur"]);
        if (blur) {
            safeSet(blur, "Blur Radius", 1, 30);
            try { blur.property(4).setValue(true); } catch(e) {}
        }

        // --- Fluid Simulation Effect ---
        var fluidAdj = lumaComp.layers.addSolid([1, 1, 1], "Fluid Dispersion", w, h, 1, dur);
        fluidAdj.adjustmentLayer = true;

        var turb1 = addFx(fluidAdj, ["Turbulent Displace", "ADBE Turbulent Displace"]);
        if (turb1) {
            safeSet(turb1, "Amount", 2, 120);
            safeSet(turb1, "Size", 3, 200); // Large slow swirls
            safeEx(turb1, "Evolution", 5, "time * " + (speed * 4));
        }

        var vecBlur = addFx(fluidAdj, ["CC Vector Blur"]);
        if (vecBlur) {
            safeSet(vecBlur, "Amount", 2, 50);
            safeSet(vecBlur, "Ridge Smoothness", 4, 30);
        }

        var turb2 = addFx(fluidAdj, ["Turbulent Displace", "ADBE Turbulent Displace"]);
        if (turb2) {
            safeSet(turb2, "Amount", 2, 60);
            safeSet(turb2, "Size", 3, 60); // Small fast ripples
            safeEx(turb2, "Evolution", 5, "time * " + (speed * 8));
        }

        var softenBlur = addFx(fluidAdj, ["ADBE Fast Box Blur", "Fast Box Blur", "ADBE Gaussian Blur 2", "Gaussian Blur"]);
        if (softenBlur) {
            safeSet(softenBlur, "Blur Radius", 1, 15);
            try { softenBlur.property(4).setValue(true); } catch(e) {}
        }
    } else {
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
    }

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

function buildAiCustom(comp, c, w, h, dur, customCode) {
    if (!customCode) throw new Error("No custom code provided by AI.");
    try {
        eval(customCode);
    } catch(e) {
        throw new Error("AI Code Error: " + e.message + " on line " + e.line);
    }
}

function buildAiImage(comp, c, w, h, dur, imagePath) {
    if (!imagePath) throw new Error("No image path provided.");
    
    var file = new File(imagePath);
    if (!file.exists) throw new Error("Image file does not exist: " + imagePath);
    
    var importedItem = null;
    try {
        importedItem = app.project.importFile(new ImportOptions(file));
    } catch(e) {
        throw new Error("Failed to import image: " + e.message);
    }
    
    var layer = comp.layers.add(importedItem);
    layer.name = "AI Generated Texture";
    
    // Scale to fit comp
    var sX = (w / layer.width) * 100;
    var sY = (h / layer.height) * 100;
    var maxScale = Math.max(sX, sY);
    try {
        layer.property("Transform").property("Scale").setValue([maxScale, maxScale]);
    } catch(e){}
    
    // Create a solid on top with 4-Color Gradient set to Color blending mode
    var s = comp.layers.addSolid([1,1,1], "AI Color Overlay", w, h, 1);
    try {
        s.blendingMode = BlendingMode.COLOR;
    } catch(e) {
        // Fallback for older AE versions
        try { s.blendingMode = 4022; } catch(e2){}
    }
    
    var g4 = addFx(s, ['4-Color Gradient', '4 Color Gradient', 'ADBE 4-Color Gradient']);
    if (g4) {
        var ov = Math.max(w, h) * 0.5;
        var corners = [[-ov, -ov], [w + ov, -ov], [-ov, h + ov], [w + ov, h + ov]];
        for (var i = 0; i < 4; i++) {
            try {
                g4.property('Point ' + (i + 1)).setValue(corners[i]);
                g4.property('Color ' + (i + 1)).setValue(c[i % c.length]);
            } catch (x) { }
        }
    }
}

function buildGlass(comp, c, ctrl, w, h, dur) {
    var proj = app.project;
    var fps = comp.frameRate;

    var softness = ctrl.softness !== undefined ? parseFloat(ctrl.softness) : 45;
    var refraction = ctrl.refraction !== undefined ? parseFloat(ctrl.refraction) : 80;
    var speed = ctrl.speed !== undefined ? parseFloat(ctrl.speed) : 40;

    // 1. Create Gradient Map Precomp for Displacement
    var mapComp = proj.items.addComp("Glass Gradient Map", w, h, 1, dur, fps);
    var mapSolid = mapComp.layers.addSolid([1,1,1], "Gradient Map", w, h, 1, dur);
    
    var ramp = addFx(mapSolid, ["Gradient Ramp", "ADBE Ramp"]);
    if (ramp) {
        safeSet(ramp, "Start of Ramp", 1, [0, h/2]);
        safeSet(ramp, "End of Ramp", 3, [w/4, h/2]);
        safeSet(ramp, "Start Color", 2, [0,0,0]);
        safeSet(ramp, "End Color", 4, [1,1,1]);
    }
    
    var rep = addFx(mapSolid, ["CC RepeTile"]);
    if (rep) {
        safeSet(rep, "Expand Right", 1, w * 4);
    }
    // Anchor Point fix and scale as per video
    try {
        mapSolid.property("Transform").property("Anchor Point").setValue([0, h/2]);
        mapSolid.property("Transform").property("Position").setValue([0, h/2]);
        mapSolid.property("Transform").property("Scale").setValue([102, 100]);
    } catch(e) {}
    
    // Animate map position to move left/right based on speed
    safeEx(mapSolid.property("Transform").property("Position"), "var s = time * " + speed + "; [value[0] - s, value[1]]");

    // 2. Base Gradient layer with 4 colors
    var baseSolid = comp.layers.addSolid([1,1,1], "Glass Base Color", w, h, 1, dur);
    applyAnimatedGradient(baseSolid, c, w, h, dur);

    // 3. Displacement Adjustment Layer
    var mapLayer = comp.layers.add(mapComp);
    mapLayer.enabled = false;
    mapLayer.collapseTransformation = true;

    var adjLayer = comp.layers.addSolid([1,1,1], "Glass Refraction", w, h, 1, dur);
    adjLayer.adjustmentLayer = true;

    var dispMap = addFx(adjLayer, ["Displacement Map", "ADBE Displacement Map"]);
    if (dispMap) {
        safeSet(dispMap, "Displacement Map Layer", 1, mapLayer.index);
        safeSet(dispMap, "Use For Horizontal Displacement", 2, 1); // Red
        safeSet(dispMap, "Use For Vertical Displacement", 4, 2); // Green
        safeSet(dispMap, "Max Horizontal Displacement", 3, refraction);
        safeSet(dispMap, "Max Vertical Displacement", 5, 0);
        safeSet(dispMap, "Wrap Pixels Around", 6, true);
    }

    var blur = addFx(adjLayer, ["Fast Box Blur", "ADBE Fast Box Blur", "ADBE Gaussian Blur 2"]);
    if (blur) {
        safeSet(blur, "Blur Radius", 1, softness);
        try { blur.property("Blur Dimensions").setValue(2); } catch(e) {
            try { blur.property(3).setValue(2); } catch(e2) {} // 2 = Vertical
        }
    }

    // 4. White highlight overlay
    var overlayMap = comp.layers.add(mapComp);
    overlayMap.name = "Glass Highlights";
    overlayMap.collapseTransformation = true;
    try { overlayMap.blendingMode = BlendingMode.OVERLAY; } catch(e) {}
    overlayMap.opacity.setValue(40);
    
    // Extract black to make it transparent
    var ext = addFx(overlayMap, ["Extract", "ADBE Extract"]);
    if (ext) {
        safeSet(ext, "Black Point", 1, 0);
        safeSet(ext, "White Point", 2, 255);
        safeSet(ext, "Black Softness", 3, 50);
    }
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

    var tile = addFx(s, ['ADBE MotionTile', 'Motion Tile', 'CC RepeTile']);
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

function buildReededGlass(comp, c, ctrl, w, h, dur) {
    var fps = comp.frameRate;

    var speed = ctrl.speed !== undefined ? parseFloat(ctrl.speed) : 60;
    var scaleAmt = ctrl.scale !== undefined ? parseFloat(ctrl.scale) : 150;
    var blurAmt = ctrl.blur !== undefined ? parseFloat(ctrl.blur) : 15;
    var lineSize = ctrl.lineSize !== undefined ? parseFloat(ctrl.lineSize) : 80;
    var refraction = ctrl.refraction !== undefined ? parseFloat(ctrl.refraction) : 50;

    // 1. Noise Base
    var noiseSolid = comp.layers.addSolid([1,1,1], "Noise Base", w, h, 1, dur);
    var fn = addFx(noiseSolid, ["Fractal Noise", "ADBE FractalNoise"]);
    if (fn) {
        safeSetGroup(fn, "Transform", "Scale", null, scaleAmt);
        safeEx(fn, "Evolution", 10, "value + time * " + speed);
    }
    
    // Color Overlay
    var colorAdj = comp.layers.addSolid([1,1,1], "Color Overlay", w, h, 1, dur);
    colorAdj.adjustmentLayer = true;
    try { colorAdj.blendingMode = BlendingMode.COLOR; } catch(e) {}
    var g4 = addFx(colorAdj, ['4-Color Gradient', '4 Color Gradient', 'ADBE 4-Color Gradient']);
    if (g4) {
        var ov = Math.max(w, h) * 0.5;
        var corners = [[-ov, -ov], [w + ov, -ov], [-ov, h + ov], [w + ov, h + ov]];
        for (var i = 0; i < 4; i++) {
            safeSet(g4, 'Point ' + (i + 1), null, corners[i]);
            safeSet(g4, 'Color ' + (i + 1), null, c[i % c.length]);
        }
    }
    var curves = addFx(colorAdj, ["Curves", "ADBE CurvesCustom"]);

    // 2. Lines Map
    var linesComp = app.project.items.addComp("Reeded Lines Map", w, h, 1, dur, fps);
    var mapSolid = linesComp.layers.addSolid([0.5,0.5,0.5], "Gradient Map", w, h, 1, dur);
    var ramp = addFx(mapSolid, ["Gradient Ramp", "ADBE Ramp"]);
    if (ramp) {
        safeSet(ramp, "Start of Ramp", 1, [0, h/2]);
        safeSet(ramp, "End of Ramp", 3, [lineSize, h/2]);
        safeSet(ramp, "Start Color", 2, [0,0,0]);
        safeSet(ramp, "End Color", 4, [1,1,1]);
    }
    var rep = addFx(mapSolid, ["CC RepeTile"]);
    if (rep) {
        safeSet(rep, "Expand Right", 1, w * 2);
    }
    
    // 3. Bring Lines map in
    var mapLayer = comp.layers.add(linesComp);
    mapLayer.enabled = false;
    mapLayer.name = "Lines Map";

    // 4. Displacement Adj Layer
    var dispAdj = comp.layers.addSolid([1,1,1], "Reeded Displacement", w, h, 1, dur);
    dispAdj.adjustmentLayer = true;
    dispAdj.moveBefore(colorAdj); // Under colors

    var disp = addFx(dispAdj, ["Displacement Map", "ADBE Displacement Map"]);
    if (disp) {
        safeSet(disp, "Displacement Map Layer", 1, mapLayer.index);
        safeSet(disp, "Use For Horizontal Displacement", 2, 1);
        safeSet(disp, "Use For Vertical Displacement", 4, 2);
        safeSet(disp, "Max Horizontal Displacement", 3, refraction);
        safeSet(disp, "Max Vertical Displacement", 5, 0);
        safeSet(disp, "Wrap Pixels Around", 6, true);
    }
    var blur = addFx(dispAdj, ["Fast Box Blur", "ADBE Fast Box Blur", "ADBE Gaussian Blur 2"]);
    if (blur) {
        safeSet(blur, "Blur Radius", 1, blurAmt);
        try { blur.property("Blur Dimensions").setValue(1); } catch(e) {
            try { blur.property(3).setValue(1); } catch(e2) {} // 1 = Horizontal
        }
    }

    var hlLayer = comp.layers.add(linesComp);
    hlLayer.name = "Reeded Highlights";
    try { hlLayer.blendingMode = BlendingMode.SCREEN; } catch(e) {}
    hlLayer.opacity.setValue(25);
}

function buildAnimeWater(comp, c, ctrl, w, h, dur) {
    var maxSize = Math.max(w, h);
    var bubbleAmount = ctrl.bubbleAmount !== undefined ? parseFloat(ctrl.bubbleAmount) : 50;
    var bubbleSpeed = ctrl.bubbleSpeed !== undefined ? parseFloat(ctrl.bubbleSpeed) : 1;
    var speed = ctrl.speed !== undefined ? parseFloat(ctrl.speed) : 50;
    var contrast = ctrl.contrast !== undefined ? parseFloat(ctrl.contrast) : 250;

    // 1. Base Layer (Dark Side)
    var l1 = comp.layers.addSolid([1,1,1], "Anime Water Base", maxSize, maxSize, 1, dur);
    try { l1.property("Transform").property("Rotation").setValue(90); } catch(e){}
    try { l1.property("Transform").property("Scale").setValue([120, 120]); } catch(e){}
    var g1 = addFx(l1, ["Gradient Ramp", "ADBE Ramp"]);
    if (g1) {
        safeSet(g1, "Start of Ramp", 1, [maxSize * 0.1, maxSize / 2]);
        safeSet(g1, "End of Ramp", 3, [maxSize * 0.9, maxSize / 2]);
        safeSet(g1, "Start Color", 2, c[0] || [0, 0.4, 0.8]);
        safeSet(g1, "End Color", 4, c[1] || [0, 0, 0.4]);
    }
    var b1 = addFx(l1, ["CC Bubbles"]);
    if (b1) {
        safeSet(b1, "Bubble Amount", 1, bubbleAmount);
        safeSet(b1, "Bubble Speed", 2, bubbleSpeed);
    }

    // 2. Light Layer
    var l2 = comp.layers.addSolid([1,1,1], "Anime Water Light", maxSize, maxSize, 1, dur);
    try { l2.property("Transform").property("Rotation").setValue(90); } catch(e){}
    try { l2.property("Transform").property("Scale").setValue([120, 120]); } catch(e){}
    try { l2.blendingMode = BlendingMode.SCREEN; } catch(e) {
        try { l2.blendingMode = BlendingMode.ADD; } catch(e2) {}
    }
    var g2 = addFx(l2, ["Gradient Ramp", "ADBE Ramp"]);
    if (g2) {
        safeSet(g2, "Start of Ramp", 1, [maxSize * 0.3, maxSize / 2]);
        safeSet(g2, "End of Ramp", 3, [maxSize * 0.7, maxSize / 2]);
        safeSet(g2, "Start Color", 2, c[2] || [0, 0.8, 1]);
        safeSet(g2, "End Color", 4, c[3] || [0, 0, 0]);
    }
    var b2 = addFx(l2, ["CC Bubbles"]);
    if (b2) {
        safeSet(b2, "Bubble Amount", 1, bubbleAmount * 1.5);
        safeSet(b2, "Bubble Speed", 2, bubbleSpeed * 1.2);
    }

    // 3. Fractal Noise (Water Surface)
    var l3 = comp.layers.addSolid([1,1,1], "Anime Water Surface", maxSize, maxSize, 1, dur);
    try { l3.property("Transform").property("Rotation").setValue(90); } catch(e){}
    try { l3.property("Transform").property("Scale").setValue([120, 120]); } catch(e){}
    var n3 = addFx(l3, ["Fractal Noise", "ADBE FractalNoise"]);
    if (n3) {
        safeSet(n3, "Contrast", 4, contrast);
        safeSetGroup(n3, "Evolution Options", "Random Seed", null, 70);
        safeSet(n3, "Complexity", 8, 8.0);
        safeEx(n3, "Evolution", 10, "time * " + speed);
        try {
            var offset3 = n3.property("Transform").property("Offset Turbulence");
            if (offset3) {
                offset3.setValueAtTime(0, [maxSize/2, maxSize/2]);
                offset3.setValueAtTime(10, [maxSize/2 + 1000, maxSize/2]);
                offset3.expression = 'loopOut("continue")';
            }
        } catch(e) {}
    }
    try { l3.blendingMode = BlendingMode.ADD; } catch(e) {}
    try { l3.opacity.setValue(8); } catch(e) {} // Assuming 8% based on transcript 'opacity ko 8.0'

    // 4. Final Layer (Shine/Sparkle)
    var l4 = comp.layers.addSolid([1,1,1], "Anime Water Glow", maxSize, maxSize, 1, dur);
    try { l4.property("Transform").property("Rotation").setValue(90); } catch(e){}
    try { l4.property("Transform").property("Scale").setValue([120, 120]); } catch(e){}
    var n4 = addFx(l4, ["Fractal Noise", "ADBE FractalNoise"]);
    if (n4) {
        safeSet(n4, "Contrast", 4, contrast);
        safeSetGroup(n4, "Evolution Options", "Random Seed", null, 0);
        safeSet(n4, "Complexity", 8, 8.0);
        safeEx(n4, "Evolution", 10, "time * " + speed);
        try {
            var offset4 = n4.property("Transform").property("Offset Turbulence");
            if (offset4) {
                offset4.setValueAtTime(0, [maxSize/2, maxSize/2]);
                offset4.setValueAtTime(10, [maxSize/2 + 1000, maxSize/2]);
                offset4.expression = 'loopOut("continue")';
            }
        } catch(e) {}
    }
    try { l4.blendingMode = BlendingMode.ADD; } catch(e) {}
    try { l4.opacity.setValue(100); } catch(e) {}

    // Add Glows to Layer 4
    var gl1 = addFx(l4, ["Deep Glow", "ADBE Glow2", "Glow", "ADBE Glow"]);
    if (gl1 && gl1.matchName.indexOf("Deep Glow") === -1) {
        safeSet(gl1, "Glow Radius", 2, 50);
        safeSet(gl1, "Glow Intensity", 3, 2);
    }
    var gl2 = addFx(l4, ["Deep Glow", "ADBE Glow2", "Glow", "ADBE Glow"]);
    if (gl2 && gl2.matchName.indexOf("Deep Glow") === -1) {
        safeSet(gl2, "Glow Radius", 2, 100);
        safeSet(gl2, "Glow Intensity", 3, 1);
    }
}

// ── METALLIC GRADIENT ──
function buildMetallic(comp, c, ctrl, w, h, dur) {
    function sProp(fx, n1, v) {
        try { fx.property(n1).setValue(v); } catch(e) {}
    }

    var speed = ctrl.speed !== undefined ? ctrl.speed : 10;
    
    // 1. Solid "gradient"
    var s = comp.layers.addSolid([1,1,1], 'gradient', w, h, 1);
    
    // 2. Fractal Noise
    var fn = addFx(s, ['Fractal Noise', 'ADBE FractalNoise', 'ADBE Fractal Noise']);
    if (fn) {
        sProp(fn, 'Contrast', 250);
        sProp(fn, 'Brightness', 65);
        try { fn.property('Evolution').expression = 'time * ' + speed * 10; } catch(e) {}
    }
    
    // 3. VR Color Gradient (applied after fractal noise per transcript)
    var vcg = addFx(s, ['VR Color Gradient', 'Mettle Color Gradient', 'ADBE VR Color Gradient']);
    if (vcg) {
        sProp(vcg, 'Gradient Power', 100);
        sProp(vcg, 'Gradient Blend', 45);
        sProp(vcg, 'Color 1', c[0 % c.length]);
        sProp(vcg, 'Color 2', c[1 % c.length]);
        sProp(vcg, 'Color 3', c[2 % c.length]);
        sProp(vcg, 'Color 4', c[3 % c.length]);
    }
    
    try { s.blendingMode = BlendingMode.HARD_LIGHT; } catch(e) {}
    
    // 4. Fast Box Blur
    var blur1 = addFx(s, ['Fast Box Blur', 'ADBE Fast Box Blur', 'ADBE Gaussian Blur 2']);
    if (blur1) {
        sProp(blur1, 'Blur Radius', 28);
    }
    
    // 5. Precompose layer
    var precomp = comp.layers.precompose([s.index], 'shape', true);
    
    // 6. VR Rotate Sphere
    var vrs = addFx(precomp, ['VR Rotate Sphere', 'Mettle Rotate Sphere', 'ADBE VR Rotate Sphere']);
    if (vrs) {
        try { vrs.property('Rotate X').expression = '318 + time * ' + speed; } catch(e) {}
        try { vrs.property('Rotate Y').expression = '318 + time * ' + speed; } catch(e) {}
        try { vrs.property('Rotate Z').expression = '318 + time * ' + speed; } catch(e) {}
    }
    
    // 7. Fast Box Blur on precomp
    var blur2 = addFx(precomp, ['Fast Box Blur', 'ADBE Fast Box Blur', 'ADBE Gaussian Blur 2']);
    if (blur2) {
        sProp(blur2, 'Blur Radius', 17);
    }
    
    // 8. Adjustment Layer
    var adj = comp.layers.addSolid([1,1,1], 'square', w, h, 1);
    adj.adjustmentLayer = true;
    
    // 9. VR Plane to Sphere
    var vps = addFx(adj, ['VR Plane to Sphere', 'Mettle Plane to Sphere', 'ADBE VR Plane to Sphere']);
    if (vps) {
        sProp(vps, 'Scale', 200); 
        sProp(vps, 'Feather', 50);
    }
}

// ============================================
// NEW PROCEDURAL GRADIENTS
// ============================================

function buildSunburst(comp, c, ctrl, w, h, dur) {
    var rays = ctrl.rays !== undefined ? parseFloat(ctrl.rays) : 24;
    var rotationSpeed = ctrl.rotationSpeed !== undefined ? parseFloat(ctrl.rotationSpeed) : 50;
    var centerOffset = ctrl.centerOffset !== undefined ? parseFloat(ctrl.centerOffset) : 0;

    var s = comp.layers.addSolid([1, 1, 1], 'Sunburst Gradient', w, h, 1, dur);
    applyAnimatedGradient(s, c, w, h, dur);

    var venetian = addFx(s, ['Venetian Blinds', 'ADBE Venetian Blinds']);
    if (venetian) {
        safeSet(venetian, 'Transition Completion', 1, 50);
        safeSet(venetian, 'Direction', 2, 90);
        safeSet(venetian, 'Width', 3, Math.max(w, h) * 2 / rays);
        safeSet(venetian, 'Feather', 4, 10);
    }

    var polar = addFx(s, ['Polar Coordinates', 'ADBE Polar Coordinates']);
    if (polar) {
        safeSet(polar, 'Interpolation', 1, 100);
        safeSet(polar, 'Type of Conversion', 2, 1); // Rect to Polar
    }

    var transform = addFx(s, ['Transform', 'ADBE Transform']);
    if (transform) {
        safeSetGroup(transform, 'Transform', 'Scale', null, 150);
        safeEx(transform, 'Rotation', 4, 'time * ' + rotationSpeed);
        if (centerOffset > 0) {
            safeEx(transform, 'Position', 2, '[value[0], value[1] + ' + centerOffset + ' * Math.sin(time)]');
        }
    }
}

function buildLiquidWaves(comp, c, ctrl, w, h, dur) {
    var speed = ctrl.speed !== undefined ? parseFloat(ctrl.speed) : 60;
    var turbulence = ctrl.turbulence !== undefined ? parseFloat(ctrl.turbulence) : 200;
    var scale = ctrl.scale !== undefined ? parseFloat(ctrl.scale) : 150;
    var blur = ctrl.blur !== undefined ? parseFloat(ctrl.blur) : 50;

    var s = comp.layers.addSolid([1, 1, 1], 'Liquid Waves', w, h, 1, dur);

    var g4 = addFx(s, ['4-Color Gradient', '4 Color Gradient', 'ADBE 4-Color Gradient']);
    if (g4) {
        var ov = Math.max(w, h) * 0.5;
        var corners = [[-ov, -ov], [w + ov, -ov], [-ov, h + ov], [w + ov, h + ov]];
        for (var i = 0; i < 4; i++) {
            safeSet(g4, 'Point ' + (i + 1), null, corners[i]);
            safeSet(g4, 'Color ' + (i + 1), null, c[i % c.length]);
            safeEx(g4, 'Point ' + (i + 1), null, 'wiggle(0.2, ' + speed * 10 + ')');
        }
    }

    var td = addFx(s, ['ADBE TurbulentDisplace', 'Turbulent Displace']);
    if (td) {
        safeSet(td, 'Displacement', 1, 4); // Smooth
        safeSet(td, 'Amount', 2, turbulence);
        safeSet(td, 'Size', 3, scale);
        safeSet(td, 'Complexity', 4, 2);
        safeEx(td, 'Evolution', 5, 'time * ' + speed);
    }

    var td2 = addFx(s, ['ADBE TurbulentDisplace', 'Turbulent Displace']);
    if (td2) {
        safeSet(td2, 'Displacement', 1, 3); // Twist
        safeSet(td2, 'Amount', 2, turbulence * 0.5);
        safeSet(td2, 'Size', 3, scale * 1.5);
        safeEx(td2, 'Evolution', 5, 'time * ' + (speed * -0.8));
    }

    var fbb = addFx(s, ['Fast Box Blur', 'ADBE Fast Box Blur', 'ADBE Gaussian Blur 2']);
    if (fbb && blur > 0) {
        safeSet(fbb, 'Blur Radius', 1, blur);
    }
}

function buildCurvedStripes(comp, c, ctrl, w, h, dur) {
    var stripes = ctrl.stripes !== undefined ? parseFloat(ctrl.stripes) : 20;
    var waveHeight = ctrl.waveHeight !== undefined ? parseFloat(ctrl.waveHeight) : 100;
    var waveWidth = ctrl.waveWidth !== undefined ? parseFloat(ctrl.waveWidth) : 200;
    var speed = ctrl.speed !== undefined ? parseFloat(ctrl.speed) : 30;

    var s = comp.layers.addSolid([1, 1, 1], 'Curved Stripes', w, h, 1, dur);
    
    // We will use ramp for basic gradient, then venetian, then turbulent
    applyAnimatedGradient(s, c, w, h, dur);

    var venetian = addFx(s, ['Venetian Blinds', 'ADBE Venetian Blinds']);
    if (venetian) {
        safeSet(venetian, 'Transition Completion', 1, 50);
        safeSet(venetian, 'Direction', 2, 90); // Vertical lines
        safeSet(venetian, 'Width', 3, w / stripes);
        safeSet(venetian, 'Feather', 4, w / stripes * 0.2);
    }

    var wave = addFx(s, ['ADBE Wave Warp', 'Wave Warp', 'ADBE Wave Warp2']);
    if (wave) {
        safeSet(wave, 'Wave Type', 1, 1); // Sine
        safeSet(wave, 'Wave Height', 2, waveHeight);
        safeSet(wave, 'Wave Width', 3, waveWidth);
        safeSet(wave, 'Direction', 4, 0); // Horizontal displacement
        safeSet(wave, 'Wave Speed', 5, speed / 50);
        safeSet(wave, 'Pinning', 6, 1);
    }

    var wave2 = addFx(s, ['ADBE Wave Warp', 'Wave Warp', 'ADBE Wave Warp2']);
    if (wave2) {
        safeSet(wave2, 'Wave Type', 1, 1);
        safeSet(wave2, 'Wave Height', 2, waveHeight * 0.5);
        safeSet(wave2, 'Wave Width', 3, waveWidth * 1.5);
        safeSet(wave2, 'Direction', 4, 180);
        safeSet(wave2, 'Wave Speed', 5, speed / -40);
        safeSet(wave2, 'Pinning', 6, 1);
    }
}

function buildCellularMosaic(comp, c, ctrl, w, h, dur) {
    var cells = ctrl.cells !== undefined ? parseFloat(ctrl.cells) : 50;
    var dispersion = ctrl.dispersion !== undefined ? parseFloat(ctrl.dispersion) : 50;
    var speed = ctrl.speed !== undefined ? parseFloat(ctrl.speed) : 80;
    var patternStr = ctrl.pattern || 'Bubbles';
    
    var patternMap = { 'Bubbles': 1, 'Crystals': 2, 'Plates': 3, 'Tubular': 4 };
    var patternVal = patternMap[patternStr] || 1;

    var s = comp.layers.addSolid([1, 1, 1], 'Cellular Mosaic', w, h, 1, dur);

    var cell = addFx(s, ['Cell Pattern', 'ADBE Cell Pattern']);
    if (cell) {
        safeSet(cell, 'Cell Pattern', 1, patternVal);
        safeSet(cell, 'Disperse', 4, dispersion / 100);
        safeSet(cell, 'Size', 5, 200 - cells); // Inverse mapping
        safeEx(cell, 'Evolution', 8, 'time * ' + speed);
    }

    var colorama = addFx(s, ['Colorama', 'ADBE Colorama']);
    if (colorama) {
        // Output Cycle - map 4 colors
        try {
            var cycle = colorama.property('Output Cycle').property('Output Cycle');
            if (cycle) {
                // Approximate 4 color cycle on colorama is tricky, we can use gradient map equivalent via tint and tritone or just let Colorama map basic hues
                // For safety we will just use a generic gradient if colorama complex setup fails
            }
        } catch(e) {}
        
        safeSet(colorama, 'Get Phase From', 1, 1); // Alpha/Luma
    }
    
    // Instead of complex Colorama setting which has a specialized property array, 
    // let's use a simpler approach: Cell Pattern over a Gradient Map via Displacement and Blending
    
    var colorAdj = comp.layers.addSolid([1,1,1], 'Gradient Colors', w, h, 1, dur);
    applyAnimatedGradient(colorAdj, c, w, h, dur);
    try { colorAdj.blendingMode = BlendingMode.COLOR; } catch(e) {}
    
    // Move colors on top
    colorAdj.moveBefore(s);
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
        safeSet(fn, 'Noise Type', 2, 1);
        safeSet(fn, 'Contrast', 4, 200);
        safeSet(fn, 'Brightness', 5, -30);
        safeSet(fn, 'Complexity', 8, 1);
        safeSet(fn, 'Blending Mode', 13, 5);
        safeSet(fn, 'Blending Mode', 14, 5);
        
        var transform = fn.property("Transform");
        if (transform) {
            safeSet(transform, "Rotation", null, -35);
            safeEx(transform, "Rotation", null, "time * " + speed);
            safeSet(transform, "Uniform Scaling", null, false);
            safeSet(transform, "Scale Width", null, 1300);
            safeSet(transform, "Scale Height", null, 600);
        }
        safeEx(fn, 'Evolution', 10, 'time * ' + (speed * 10));
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
    
    var mt = addFx(s, ['Motion Tile', 'CC RepeTile', 'ADBE MotionTile']);
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
        safeSet(path, "Roundness", 3, 50);
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
    var precomp = app.project.items.addComp("Trail Base", w, h, 1, dur, comp.frameRate);
    
    var strokeWidth = ctrl.width !== undefined ? parseFloat(ctrl.width) : 60;
    var numStrokes = Math.ceil(w / strokeWidth) + 4;
    var startCycle = ctrl.cycleSpeed !== undefined ? parseFloat(ctrl.cycleSpeed) : 600;
    var cycleOffset = 20;

    var useThickStroke = false;
    var s_test = precomp.layers.addSolid([1,1,1], "Test", w, h, 1);
    var ts_test = addFx(s_test, ['PE Thick Stroke', 'PE_ThickStroke', 'Thick Stroke', 'ThickStroke']);
    if (ts_test) {
        useThickStroke = true;
    }
    s_test.remove();

    for (var i = 0; i < numStrokes; i++) {
        var cycleSpeed = startCycle - (i * cycleOffset);
        var xPos = (i - Math.floor(numStrokes/2)) * strokeWidth + (w/2);

        if (useThickStroke) {
            var s = precomp.layers.addSolid([1,1,1], "Trail " + i, w, h, 1);
            var newMask = s.Masks.addProperty("Mask");
            var myShape = new Shape();
            myShape.vertices = [[w/2, -h*0.2], [w/2, h*1.2]];
            myShape.closed = false;
            try { newMask.property("maskShape").setValue(myShape); } catch(e) {}
            
            var ts = addFx(s, ['PE Thick Stroke', 'PE_ThickStroke', 'Thick Stroke', 'ThickStroke']);
            if (ts) {
                try { ts.property("Width").setValue(strokeWidth); } catch(e) {}
                try { ts.property("End Width").setValue(strokeWidth); } catch(e) {}
                try { ts.property("Cap").setValue(2); } catch(e) {}
                try { ts.property("Cycle").expression = "time * " + cycleSpeed; } catch(e) {}
            }
            try { s.property("Transform").property("Position").setValue([xPos, h/2]); } catch(e) {}
        } else {
            var s = precomp.layers.addSolid([1,1,1], "Trail " + i, strokeWidth, h, 1);
            
            var ramp = addFx(s, ["ADBE Ramp", "Gradient Ramp", "Ramp"]);
            if (ramp) {
                try { ramp.property("Start Point").setValue([strokeWidth/2, 0]); } catch(e) {}
                try { ramp.property("End Point").setValue([strokeWidth/2, h/2]); } catch(e) {}
                try { ramp.property("Start Color").setValue([0,0,0]); } catch(e) {}
                try { ramp.property("End Color").setValue([1,1,1]); } catch(e) {}
            }
            
            var tile = addFx(s, ["ADBE MotionTile", "Motion Tile"]);
            if (tile) {
                try { tile.property("Output Height").setValue(400); } catch(e) {}
                try { tile.property("Mirror Edges").setValue(true); } catch(e) {}
                try { tile.property("Tile Center").expression = "[value[0], value[1] + (time * " + cycleSpeed + ")]"; } catch(e) {}
            }
            
            try { s.property("Transform").property("Position").setValue([xPos, h/2]); } catch(e) {}
        }
    }
    
    var finalLayer = comp.layers.add(precomp);
    finalLayer.name = "Trail Animation";
    
    var toner = addFx(finalLayer, ["CC Toner"]);
    if (toner) {
        try { toner.property("Tones").setValue(3); } catch(e) {} // Pentatone
        var c1 = c[0], c2 = c[1] || c[0], c3 = c[2] || c[1], c4 = c[3] || c[2];
        try { toner.property("Highlights").setValue(c1); } catch(e) {}
        try { toner.property("Brights").setValue(c2); } catch(e) {}
        try { toner.property("Midtones").setValue(c3); } catch(e) {}
        try { toner.property("Darktones").setValue(c4); } catch(e) {}
        try { toner.property("Shadows").setValue(c1); } catch(e) {}
    } else {
        addFx(finalLayer, ['ADBE Colorama', 'Colorama']);
    }
    
    var warp = addFx(finalLayer, ["ADBE Warp", "Warp"]);
    if (warp) {
        try { warp.property("Warp Style").setValue(13); } catch(e) {} // Squeeze
        var bend = ctrl.bend !== undefined ? parseFloat(ctrl.bend) : 30;
        try { warp.property("Bend").setValue(bend); } catch(e) {}
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

    // Top Layer: Rays (Matte)
    var rayLayer = comp.layers.addSolid([1,1,1], "Prismatic Rays Matte", w, h, 1, dur);
    rayLayer.startTime = 0;
    
    var noise = addFx(rayLayer, ["ADBE Fractal Noise", "Fractal Noise"]);
    if (noise) {
        safeSet(noise, "Fractal Type", null, 1); // Dynamic
        safeSet(noise, "Noise Type", null, 1); // Block
        safeSet(noise, "Contrast", null, 300);
        safeSet(noise, "Brightness", null, 0);
        safeSet(noise, "Complexity", null, 4);
        
        var transformGrp = noise.property("Transform");
        if (transformGrp) {
            safeSet(transformGrp, "Uniform Scaling", null, 0); // false
            safeSet(transformGrp, "Scale Width", null, rayCount * 2); 
            safeSet(transformGrp, "Scale Height", null, 4000); 
        }
        
        safeEx(noise, "Evolution", null, "time * " + speed);
        
        var subSettings = noise.property("Sub Settings");
        if (subSettings) {
            safeSet(subSettings, "Sub Influence", null, distort / 5);
        }
    }
    
    var polar = addFx(rayLayer, ["ADBE Polar Coordinates", "Polar Coordinates"]);
    if (polar) {
        safeSet(polar, "Interpolation", null, 100);
        safeSet(polar, "Type of Conversion", null, 1); // Rect to Polar
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
    
    var glow = addFx(emitterLayer, ["Deep Glow", "ADBE Glow2", "Glow", "ADBE Glow"]);
    if (glow && glow.matchName.indexOf("Deep Glow") === -1) {
        safeSet(glow, "Glow Radius", null, 50);
        safeSet(glow, "Glow Intensity", null, 1.5);
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
        safeSet(turb, "Displacement", null, 0); // Turbulent
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
