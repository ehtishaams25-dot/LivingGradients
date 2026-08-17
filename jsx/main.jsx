// LIVING GRADIENTS v2 — main.jsx

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
            case 'Heatmap':
                buildHeatmap(comp, c, p.controls, w, h, dur);
                break;
            case 'Halftone':
                buildHalftone(comp, c, p.controls, w, h, dur);
                break;
            case 'AsciiMatrix':
                buildAsciiMatrix(comp, c, p.controls, w, h, dur);
                break;
            default:
                return 'ERROR: Unknown type: ' + p.type;
        }

        var afterCount = comp.numLayers;
        var addedLayersCount = afterCount - beforeCount;

        applyGlobalPolish(comp, p);

        if (p.trackingEnabled && p.trackingLayerName && (p.type === 'living' || p.type === 'Halftone' || p.type === 'AsciiMatrix')) {
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

    if (p.grain && p.grain > 0) {
        var noise = addFx(layer, ['ADBE Noise', 'Noise']);
        if (noise) {
            try { noise.property('Amount of Noise').setValue(p.grain); } catch (e) { }
            try { noise.property('Use Color Noise').setValue(false); } catch (e) { }
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
    
    var precompLayer;
    try {
        precompLayer = comp.layers.precompose(indices, p.type + " Trail Base", true);
    } catch(e) {
        precompLayer = comp.layer(1); 
    }

    if (p.type === 'AsciiMatrix') return;

    var trailMatte = comp.layers.addShape();
    trailMatte.name = "Trail Matte (" + p.trackingLayerName + ")";
    trailMatte.moveBefore(precompLayer);

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
    
    var expr = "try {\n" +
               "  var tgt = comp('" + comp.name + "').layer('" + p.trackingLayerName + "');\n" +
               "  if (tgt.hasParent) {\n" + 
               "     tgt.toComp(tgt.anchorPoint);\n" +
               "  } else {\n" +
               "     tgt.transform.position;\n" +
               "  }\n" +
               "} catch(e) { value; }";
    try { trailMatte.property("Transform").property("Position").expression = expr; } catch(e) {}
    
    var echo = addFx(trailMatte, ["Echo", "ADBE Echo"]);
    if (echo) {
        safeEx(echo, "Echo Time (seconds)", 1, "-thisComp.frameDuration");
        safeSet(echo, "Number Of Echoes", 2, 40);
        safeSet(echo, "Starting Intensity", 3, 1.0);
        safeSet(echo, "Decay", 4, 0.92);
        safeSet(echo, "Echo Operator", 5, 2); // 2 = Maximum
    }
    
    var blur = addFx(trailMatte, ["ADBE Fast Box Blur", "Fast Box Blur", "ADBE Gaussian Blur 2", "Gaussian Blur"]);
    if (blur) {
        safeSet(blur, "Blur Radius", 1, 40);
        try { blur.property(4).setValue(true); } catch(e) {}
    }
    
    try {
        precompLayer.setTrackMatte(trailMatte, TrackMatteType.ALPHA);
    } catch(e) {
        try { precompLayer.trackMatteType = TrackMatteType.ALPHA; } catch(e2){}
    }
    
    var head = comp.layers.addShape();
    head.name = "Trail Head (" + p.trackingLayerName + ")";
    var hContents = head.property("Contents");
    var hGrp = hContents.addProperty("ADBE Vector Group");
    var hGrpContents = hGrp.property("Contents");
    var hEllipse = hGrpContents.addProperty("ADBE Vector Shape - Ellipse");
    try { hEllipse.property("Size").setValue([300, 300]); } catch(e) {
        try { hEllipse.property(2).setValue([300, 300]); } catch(e2){}
    }
    var hFill = hGrpContents.addProperty("ADBE Vector Graphic - Fill");
    try { hFill.property("Color").setValue([1,1,1]); } catch(e) {
        try { hFill.property(4).setValue([1,1,1]); } catch(e2){}
    }
    try { head.property("Transform").property("Position").expression = expr; } catch(e) {}
    head.moveBefore(trailMatte);
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

// ── 1. LIVING GRADIENT ── 4-Color Gradient + Motion Tile + Turbulent Displace (from Living Gradients.jsx)
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
        var comp = app.project.activeItem;
        if (!comp) return;

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

        for (var li = 1; li <= comp.numLayers; li++) {
            updateLayerColors(comp.layer(li), c, 0);
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

    if (lname === 'Halftone Gradient' || lname === 'Halftone Color' || lname === 'ASCII Color Overlay') {
        try {
            var ef2 = findFx(layer, ['4-Color Gradient', 'ADBE 4ColorGradient']);
            if (ef2) {
                for (var ci2 = 0; ci2 < 4; ci2++) {
                    try { ef2.property('Color ' + (ci2 + 1)).setValue(c[ci2 % c.length]); } catch (x) { }
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

function buildHalftone(comp, c, ctrl, w, h, dur) {
    var speed = ctrl.speed !== undefined ? parseFloat(ctrl.speed) : 30;
    var dotSize = ctrl.dotSize !== undefined ? parseFloat(ctrl.dotSize) : 10;
    var dotFill = ctrl.dotFill !== undefined ? parseFloat(ctrl.dotFill) : 100;

    var s = comp.layers.addSolid([1, 1, 1], 'Halftone Gradient', w, h, 1, dur);

    var tile = addFx(s, ['ADBE MotionTile', 'Motion Tile', 'CC RepeTile']);
    if (tile) {
        safeSet(tile, "Output Width", 1, 300);
        safeSet(tile, "Output Height", 2, 300);
        safeSet(tile, "Mirror Edges", 3, true);
    }

    var g4 = addFx(s, ['4-Color Gradient', '4 Color Gradient', 'ADBE 4-Color Gradient', 'ADBE 4ColorGradient', 'ADBE 4 Color Gradient']);
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

    var td = addFx(s, ['ADBE TurbulentDisplace', 'Turbulent Displace']);
    if (td) {
        safeSet(td, "Amount", 1, 200);
        safeSet(td, "Size", 2, 300);
        safeEx(td, "Evolution", 4, "time * 50");
    }

    var ball = addFx(s, ['CC Ball Action']);
    if (ball) {
        safeSet(ball, "Grid Spacing", 2, dotSize);
        safeSet(ball, "Ball Size", 3, dotFill);
    }
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
        safeSet(lumaNoise, "Contrast", 4, 150);
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
    var gBlur = addFx(maskPattern, ["Fast Box Blur", "ADBE Fast Blur"]);
    if (gBlur) safeSet(gBlur, "Blur Radius", 1, dotSize * 0.4);

    var maskLuma = maskComp.layers.add(lumaComp);
    try { maskLuma.blendingMode = BlendingMode.HARD_MIX; } catch (e) { }

    // Soften the jagged Hard Mix edges slightly
    var adjLayer = maskComp.layers.addSolid([1, 1, 1], "Anti-Alias", w, h, 1, dur);
    adjLayer.adjustmentLayer = true;
    var aaBlur = addFx(adjLayer, ["Fast Box Blur", "ADBE Fast Blur"]);
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
            safeSet(blur, "Blur Radius", 1, 40);
            try { blur.property(4).setValue(true); } catch(e) {}
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