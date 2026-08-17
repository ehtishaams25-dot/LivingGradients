// LIVING GRADIENTS v2 — main.jsx

function addFx(layer, names) {
    for (var i = 0; i < names.length; i++) {
        try {
            var e = layer.Effects.addProperty(names[i]);
            if (e) return e;
        } catch (x) {}
    }
    return null;
}

function sp(fx, name, val) {
    try {
        fx.property(name).setValue(val);
    } catch (x) {}
}

function ex(prop, str) {
    try {
        prop.expression = str;
    } catch (x) {}
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
        app.beginUndoGroup('Living Gradients');
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
            case 'Wireframe':
                buildWireframe(comp, c, p.controls, w, h, dur);
                break;
            case 'Holographic':
            case 'Grainy':
            case 'Liquid':
            case 'Neon':
            case 'Topographic':
            case 'Glass':
                buildGenericNewStyle(comp, c, p.controls, w, h, dur, p.type);
                break;
            case 'FigmaShader':
            case 'Psychedelic':
            case 'Heatmap':
                buildAdvancedShader(comp, c, p.controls, w, h, dur, p.type);
                break;
            default:
                return 'ERROR: Unknown type: ' + p.type;
        }
        app.endUndoGroup();
        return 'Done: ' + comp.name;
    } catch (e) {
        try {
            app.endUndoGroup();
        } catch (x) {}
        return 'ERROR: ' + e.message + ' line ' + e.line;
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
                } catch (e) {}
                if (tn.indexOf('height') !== -1) try {
                    tp.setValue(500);
                } catch (e) {}
                if (tn.indexOf('mirror') !== -1) try {
                    tp.setValue(true);
                } catch (e) {}
            }
        } catch (e) {}
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
            } catch (x) {}
        }
    }

    // Turbulent Displace
    var td = addFx(s, ['ADBE TurbulentDisplace', 'Turbulent Displace']);
    if (td) {
        try {
            td.property('Amount').setValue(turbAmt);
        } catch (e) {}
        try {
            td.property('Size').setValue(scaleAmt);
        } catch (e) {}
        try {
            td.property('Complexity').setValue(2);
        } catch (e) {}
        try {
            td.property('Evolution').expression = 'time * ' + evolSpd;
        } catch (e) {}
    }

    // Opacity
    try {
        s.opacity.setValue(opacity);
    } catch (e) {}
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
            } catch (e2) {}
        }

        var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
        var cIdx = Math.floor(Math.random() * c.length);
        try {
            fill.property("Color").setValue(c[cIdx]);
        } catch (e) {
            try {
                fill.property(4).setValue(c[cIdx]);
            } catch (e2) {}
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
        } catch (e) {}
        try {
            blobBlur.property(2).setValue(3);
        } catch (e) {}
        try {
            blobBlur.property(4).setValue(true);
        } catch (e) {}
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
            } catch (e2) {}
        }
        try {
            path.property("Points").setValue(pointsVal);
        } catch (e) {
            try {
                path.property(2).setValue(pointsVal);
            } catch (e2) {}
        }
        try {
            path.property("Outer Radius").setValue(406);
        } catch (e) {
            try {
                path.property(5).setValue(406);
            } catch (e2) {}
        }
        if (typeVal === 2) {
            var inRad = (shapeStr === "5-Point Star") ? 155 : 203;
            try {
                path.property("Inner Radius").setValue(inRad);
            } catch (e) {
                try {
                    path.property(7).setValue(inRad);
                } catch (e2) {}
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
            } catch (e2) {}
        }
    } else if (shapeStr === "Square" || shapeStr === "Rectangle") {
        path = shapeGrpContents.addProperty("ADBE Vector Shape - Rect");
        var sz2 = (shapeStr === "Square") ? [812, 812] : [1000, 600];
        try {
            path.property("Size").setValue(sz2);
        } catch (e) {
            try {
                path.property(2).setValue(sz2);
            } catch (e2) {}
        }
    }

    var shapeFill = shapeGrpContents.addProperty("ADBE Vector Graphic - Fill");
    try {
        shapeFill.property("Color").setValue([1, 1, 1]);
    } catch (e) {
        try {
            shapeFill.property(4).setValue([1, 1, 1]);
        } catch (e2) {}
    }

    shapeLayer.property("Transform").property("Position").setValue([w / 2, h / 2]);
    ex(shapeLayer.property("Transform").property("Rotation"), "time * 10");

    shapeLayer.moveBefore(blobInStar);
    try {
        blobInStar.trackMatteType = TrackMatteType.ALPHA;
    } catch (e) {
        try {
            blobInStar.setTrackMatte(shapeLayer, TrackMatteType.ALPHA);
        } catch (e2) {}
    }

    var finalLayer = comp.layers.add(starComp);
    finalLayer.name = "Matte Comp (" + presetName + ")";

    var finalBlur = addFx(finalLayer, ["ADBE Box Blur2", "ADBE Fast Box Blur", "Fast Box Blur", "ADBE Gaussian Blur 2"]);
    if (finalBlur) {
        try {
            finalBlur.property(1).setValue(p.blur);
        } catch (e) {}
        try {
            finalBlur.property(2).setValue(3);
        } catch (e) {}
        try {
            finalBlur.property(4).setValue(true);
        } catch (e) {}
    }

    var waveWarp = addFx(finalLayer, ["ADBE Wave Warp", "Wave Warp", "ADBE Wave Warp2"]);
    if (waveWarp) {
        try {
            waveWarp.property(1).setValue(p.waveType);
        } catch (e) {
            try {
                waveWarp.property("Wave Type").setValue(p.waveType);
            } catch (e2) {}
        }
        try {
            waveWarp.property(2).setValue(p.waveHeight);
        } catch (e) {
            try {
                waveWarp.property("Wave Height").setValue(p.waveHeight);
            } catch (e2) {}
        }
        try {
            waveWarp.property(3).setValue(p.waveWidth);
        } catch (e) {
            try {
                waveWarp.property("Wave Width").setValue(p.waveWidth);
            } catch (e2) {}
        }
        var dir = ctrl.direction !== undefined ? parseFloat(ctrl.direction) : 163;
        try {
            waveWarp.property(4).setValue(dir);
        } catch (e) {
            try {
                waveWarp.property("Direction").setValue(dir);
            } catch (e2) {}
        }
        var spd = ctrl.speed !== undefined ? parseFloat(ctrl.speed) : 0.3;
        try {
            waveWarp.property(5).setValue(spd);
        } catch (e) {
            try {
                waveWarp.property("Wave Speed").setValue(spd);
            } catch (e2) {}
        }
        try {
            waveWarp.property(6).setValue(1);
        } catch (e) {
            try {
                waveWarp.property("Pinning").setValue(1);
            } catch (e2) {}
        }
        try {
            waveWarp.property(7).setValue(0);
        } catch (e) {
            try {
                waveWarp.property("Phase").setValue(0);
            } catch (e2) {}
        }
    }

    var optics = addFx(finalLayer, ["ADBE Optics Compensation", "Optics Compensation"]);
    if (optics) {
        try {
            optics.property(1).setValue(p.fov);
        } catch (e) {
            try {
                optics.property("Field Of View (FOV)").setValue(p.fov);
            } catch (e2) {}
        }
        try {
            optics.property(2).setValue(true);
        } catch (e) {
            try {
                optics.property("Reverse Lens Distortion").setValue(true);
            } catch (e2) {}
        }
        try {
            optics.property(3).setValue(1);
        } catch (e) {
            try {
                optics.property("FOV Orientation").setValue(1);
            } catch (e2) {}
        }
        try {
            optics.property(4).setValue([w / 2, h / 2]);
        } catch (e) {
            try {
                optics.property("View Center").setValue([w / 2, h / 2]);
            } catch (e2) {}
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
    } catch (e) {}
    try {
        fx.property(name).setValue(val);
    } catch (e2) {}
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
    } catch (e) {}
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
        } catch (e2) {}
    }
    try {
        star.property("Points").setValue(starPoints);
    } catch (e) {
        try {
            star.property(2).setValue(starPoints);
        } catch (e2) {}
    }
    try {
        star.property("Outer Radius").setValue(285);
    } catch (e) {
        try {
            star.property(5).setValue(285);
        } catch (e2) {}
    }
    try {
        star.property("Inner Radius").setValue(112);
    } catch (e) {
        try {
            star.property(7).setValue(112);
        } catch (e2) {}
    }

    var fill = gc.addProperty("ADBE Vector Graphic - Fill");
    try {
        fill.property("Color").setValue([1, 1, 1]);
    } catch (e) {
        try {
            fill.property(4).setValue([1, 1, 1]);
        } catch (e2) {}
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
        } catch (e) {}
        try {
            blur.property(2).setValue(3);
        } catch (e2) {}
        try {
            blur.property(3).setValue(1);
        } catch (e3) {}
        try {
            blur.property(4).setValue(true);
        } catch (e4) {}
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
            } catch (e2) {}
        }

        var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
        var cIdx = bi % c.length;
        try {
            fill.property("Color").setValue(c[cIdx]);
        } catch (e3) {
            try {
                fill.property(4).setValue(c[cIdx]);
            } catch (e4) {}
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
        } catch (e5) {}
        try {
            colorBlur.property(2).setValue(3);
        } catch (e6) {}
        try {
            colorBlur.property(4).setValue(true);
        } catch (e7) {}
    }

    var matteLayer = colorSourceComp.layers.add(matteComp);
    matteLayer.name = "ChromaFlare Alpha Matte";
    try {
        colorLayer.setTrackMatte(matteLayer, TrackMatteType.ALPHA);
    } catch (e8) {
        try {
            colorLayer.trackMatteType = TrackMatteType.ALPHA;
        } catch (e9) {}
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
        } catch (e) {}
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

        app.beginUndoGroup("Update SilkFlare Controls");
        for (var i = 1; i <= comp.numLayers; i++) {
            var layer = comp.layer(i);
            if (layer.name.indexOf("Matte Comp") !== -1) {
                var waveWarp = null;
                try {
                    waveWarp = layer.property("Effects").property("Wave Warp");
                } catch (e) {}
                if (!waveWarp) {
                    try {
                        waveWarp = layer.property("Effects").property("ADBE Wave Warp");
                    } catch (e) {}
                }
                if (!waveWarp) {
                    try {
                        waveWarp = layer.property("Effects").property("ADBE Wave Warp2");
                    } catch (e) {}
                }

                if (waveWarp) {
                    var dir = ctrl.direction !== undefined ? parseFloat(ctrl.direction) : 163;
                    try {
                        waveWarp.property(4).setValue(dir);
                    } catch (e) {
                        try {
                            waveWarp.property("Direction").setValue(dir);
                        } catch (e2) {}
                    }
                    var spd = ctrl.speed !== undefined ? parseFloat(ctrl.speed) : 0.3;
                    try {
                        waveWarp.property(5).setValue(spd);
                    } catch (e) {
                        try {
                            waveWarp.property("Wave Speed").setValue(spd);
                        } catch (e2) {}
                    }
                }
                break;
            }
        }
        app.endUndoGroup();
    } catch (e) {
        try {
            app.endUndoGroup();
        } catch (x) {}
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
                                } catch (x2) {}
                            }
                        }
                    }
                }
            }
        } catch (e) {}
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
        } catch (e) {}
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
            var layer = comp.layer(li);
            var lname = layer.name;

            // Living Gradient: update 4-Color Gradient effect colors
            if (lname === 'Living Gradient') {
                try {
                    var effects = layer.property('Effects');
                    for (var ei = 1; ei <= effects.numProperties; ei++) {
                        var ef = effects.property(ei);
                        if (ef.matchName === 'ADBE 4ColorGradient' || ef.name === '4-Color Gradient' || ef.name === '4 Color Gradient') {
                            for (var ci = 0; ci < 4; ci++) {
                                try {
                                    ef.property('Color ' + (ci + 1)).setValue(c[ci % c.length]);
                                } catch (x) {}
                            }
                            break;
                        }
                    }
                } catch (x) {}
            }

            // SilkFlare: update colors in the Blobs precomp
            if (lname.indexOf('Matte Comp') !== -1) {
                try {
                    var src = layer.source; // This is the "SilkFlare - Matte" comp
                    if (src && src instanceof CompItem) {
                        // Find the "Color Blobs" layer inside the matte comp
                        for (var mi = 1; mi <= src.numLayers; mi++) {
                            var matteLayer = src.layer(mi);
                            if (matteLayer.name === 'Color Blobs' && matteLayer.source && matteLayer.source instanceof CompItem) {
                                var blobComp = matteLayer.source;
                                for (var bi = 1; bi <= blobComp.numLayers; bi++) {
                                    var blob = blobComp.layer(bi);
                                    try {
                                        var bContents = blob.property('Contents');
                                        if (bContents && bContents.numProperties > 0) {
                                            var bGrp = bContents.property(1);
                                            if (bGrp) {
                                                var bGrpC = bGrp.property('Contents');
                                                for (var fi = 1; fi <= bGrpC.numProperties; fi++) {
                                                    var fp = bGrpC.property(fi);
                                                    if (fp.matchName === 'ADBE Vector Graphic - Fill') {
                                                        var cIdx = (bi - 1) % c.length;
                                                        try {
                                                            fp.property('Color').setValue(c[cIdx]);
                                                        } catch (x) {
                                                            try {
                                                                fp.property(4).setValue(c[cIdx]);
                                                            } catch (x2) {}
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    } catch (x) {}
                                }
                                break;
                            }
                        }
                    }
                } catch (x) {}
            }

            // ChromaFlare: update the editable blob color source inside the final precomp
            if (lname.indexOf('ChromaFlare Final Gradient') !== -1) {
                try {
                    if (layer.source && layer.source instanceof CompItem) {
                        updateNestedBlobSources(layer.source, c, 0);
                    }
                } catch (x) {}
            }
        }

        app.endUndoGroup();
    } catch (e) {
        try {
            app.endUndoGroup();
        } catch (x) {}
    }
}

// ── 5. MASSIVE LIBRARY GENERATORS ──
function buildWireframe(comp, c, ctrl, w, h, dur) {
    var bg = comp.layers.addSolid(c[3] || [0, 0, 0], 'Wireframe BG', w, h, 1);
    var wire = comp.layers.addSolid(c[2] || [1, 1, 1], 'Twisted Wire', w, h, 1);
    
    var grid = addFx(wire, ['ADBE Grid', 'Grid']);
    if (grid) {
        try { grid.property("Size From").setValue(0); } catch(e) { try { grid.property(2).setValue(0); } catch(e2){} }
        var gridSize = ctrl.gridSize || 50;
        try { grid.property("Width").setValue(gridSize); } catch(e) { try { grid.property(3).setValue(gridSize); } catch(e2){} }
        try { grid.property("Height").setValue(gridSize); } catch(e) { try { grid.property(4).setValue(gridSize); } catch(e2){} }
        try { grid.property("Border").setValue(ctrl.thickness || 2); } catch(e) { try { grid.property(5).setValue(ctrl.thickness || 2); } catch(e2){} }
        try { grid.property("Color").setValue(c[1] || [0, 1, 1]); } catch(e) { try { grid.property(7).setValue(c[1] || [0, 1, 1]); } catch(e2){} }
    }
    
    wire.threeDLayer = true;
    try { wire.property("Transform").property("X Rotation").setValue(ctrl.rotationX || 45); } catch(e){}
    try { wire.property("Transform").property("Y Rotation").setValue(ctrl.rotationY || -45); } catch(e){}
    try { wire.property("Transform").property("Z Rotation").expression = "time * 15"; } catch(e){}
}

function buildGenericNewStyle(comp, c, ctrl, w, h, dur, typeName) {
    // Basic implementation for the others so it adds to timeline
    var s = comp.layers.addSolid([1, 1, 1], typeName + ' Layer', w, h, 1);
    
    var g4 = addFx(s, ['4-Color Gradient', '4 Color Gradient', 'ADBE 4-Color Gradient']);
    if (g4) {
        var ov = Math.max(w, h) * 0.5;
        var corners = [[-ov, -ov], [w + ov, -ov], [-ov, h + ov], [w + ov, h + ov]];
        for (var i = 0; i < 4; i++) {
            try {
                var pt = g4.property('Point ' + (i + 1));
                var cp = g4.property('Color ' + (i + 1));
                if (pt && cp) {
                    pt.setValueAtTime(0, corners[i]);
                    pt.setValueAtTime(10, [(Math.random() * (w + ov * 2)) - ov, (Math.random() * (h + ov * 2)) - ov]);
                    try { pt.expression = 'loopOut("pingpong")'; } catch(e){}
                    cp.setValue(c[i % c.length]);
                }
            } catch (x) {}
        }
    }
    
    if (typeName === 'Grainy') {
        var noise = addFx(s, ['ADBE Noise', 'Noise']);
        if (noise) {
            try { noise.property("Amount of Noise").setValue(ctrl.noise || 25); } catch(e) { try { noise.property(1).setValue(ctrl.noise || 25); } catch(e2){} }
        }
    } else if (typeName === 'Liquid') {
        var td = addFx(s, ['ADBE TurbulentDisplace', 'Turbulent Displace']);
        if (td) {
            try { td.property("Amount").setValue(ctrl.turbulence || 150); } catch(e) { try { td.property(1).setValue(ctrl.turbulence || 150); } catch(e2){} }
            try { td.property("Evolution").expression = "time * " + (ctrl.speed || 30); } catch(e) {}
        }
    } else if (typeName === 'Glass') {
        var glassBlur = addFx(s, ["ADBE Fast Box Blur", "Fast Box Blur"]);
        if (glassBlur) {
            try { glassBlur.property(1).setValue(ctrl.softness || 45); } catch(e) {}
        }
        var glassDistort = addFx(s, ["CC Glass"]);
        if (glassDistort) {
            try { glassDistort.property("Surface").property("Softness").setValue(ctrl.softness || 45); } catch(e) {}
            try { glassDistort.property("Surface").property("Displacement").setValue(ctrl.refraction || 80); } catch(e) {}
        }
    }
}

function buildAdvancedShader(comp, c, ctrl, w, h, dur, typeName) {
    var s = comp.layers.addSolid([1, 1, 1], typeName + ' Shader', w, h, dur);
    
    // Base gradient
    var g4 = addFx(s, ['4-Color Gradient', '4 Color Gradient', 'ADBE 4-Color Gradient']);
    if (g4) {
        var ov = Math.max(w, h) * 0.5;
        var corners = [[-ov, -ov], [w + ov, -ov], [-ov, h + ov], [w + ov, h + ov]];
        for (var i = 0; i < 4; i++) {
            try {
                var pt = g4.property('Point ' + (i + 1));
                var cp = g4.property('Color ' + (i + 1));
                if (pt && cp) {
                    pt.setValueAtTime(0, corners[i]);
                    pt.setValueAtTime(dur || 10, [(Math.random() * (w + ov * 2)) - ov, (Math.random() * (h + ov * 2)) - ov]);
                    try { pt.expression = 'loopOut("pingpong")'; } catch(e){}
                    cp.setValue(c[i % c.length]);
                }
            } catch (x) {}
        }
    }

    if (typeName === 'FigmaShader') {
        var td = addFx(s, ['ADBE TurbulentDisplace', 'Turbulent Displace']);
        if (td) {
            try { td.property("Amount").setValue(ctrl.distortion || 200); } catch(e) { try { td.property(1).setValue(ctrl.distortion || 200); } catch(e2){} }
            try { td.property("Size").setValue(150); } catch(e) {}
            try { td.property("Evolution").expression = "time * " + (ctrl.fluidity || 60); } catch(e) {}
        }
        
        var glass = addFx(s, ['CC Glass']);
        if (glass) {
            try { glass.property("Surface").property("Softness").setValue(30); } catch(e) {}
            try { glass.property("Surface").property("Height").setValue(ctrl.height || 40); } catch(e) {}
            try { glass.property("Surface").property("Displacement").setValue(200); } catch(e) {}
            try { glass.property("Light").property("Light Intensity").setValue(ctrl.glossiness || 75); } catch(e) {}
        }
    } else if (typeName === 'Psychedelic') {
        var td2 = addFx(s, ['ADBE TurbulentDisplace', 'Turbulent Displace']);
        if (td2) {
            try { td2.property("Amount").setValue(300); } catch(e) {}
            try { td2.property("Size").setValue(ctrl.complexity * 20 || 100); } catch(e) {}
            try { td2.property("Evolution").expression = "time * " + (ctrl.speed || 80); } catch(e) {}
        }
        
        var hue = addFx(s, ['ADBE Hue/Saturation', 'Hue/Saturation']);
        if (hue) {
            try { hue.property("Channel Control").property("Master Hue").expression = "time * " + (ctrl.colorCycle || 180); } catch(e) {}
        }
    } else if (typeName === 'Heatmap') {
        var td3 = addFx(s, ['ADBE TurbulentDisplace', 'Turbulent Displace']);
        if (td3) {
            try { td3.property("Amount").setValue(250); } catch(e) {}
            try { td3.property("Size").setValue(250); } catch(e) {}
            try { td3.property("Evolution").expression = "time * " + (ctrl.speed || 40); } catch(e) {}
        }
        var noise = addFx(s, ['ADBE FractalNoise', 'Fractal Noise']);
        if (noise) {
            try { noise.property("Contrast").setValue(ctrl.contrast || 80); } catch(e) {}
            try { noise.property("Transform").property("Scale").setValue(ctrl.noiseScale || 150); } catch(e) {}
            try { noise.property("Evolution").expression = "time * " + (ctrl.speed || 40); } catch(e) {}
            try { noise.property("Blending Mode").setValue(5); /* Overlay */ } catch(e) {}
        }
    }
}