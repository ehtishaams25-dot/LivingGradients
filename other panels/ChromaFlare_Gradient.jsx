/**
 * ============================================================
 *  CHROMAFLARE GRADIENT GENERATOR
 *  Adobe After Effects Dockable Panel Script
 *  Made by Ehtishaam Shaikh | linktr.ee/itsehtishaam
 * ============================================================
 *
 *  Tutorial-inspired build:
 *  1. Rotating 4-point star source
 *  2. Fast Box Blur + Wave Warp streaking
 *  3. Colorama spectral coloring
 *  4. Duplicated Colorama source layers in the final comp
 *  5. Warp set to Arc on each final layer
 *  6. Final gradients precomposed into one layer
 */
(function(thisObj) {

    var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "ChromaFlare Gradient", undefined, {
        resizeable: true
    });
    if (!win) {
        alert("Script must be docked as a panel.");
        return;
    }

    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 6;

    // ============================================================
    //  UI
    // ============================================================
    var panelSettings = win.add("panel", undefined, " ChromaFlare Settings");
    panelSettings.orientation = "column";
    panelSettings.alignChildren = ["fill", "top"];
    panelSettings.spacing = 6;

    function addSliderRow(parent, label, min, max, val, textWidth) {
        var row = parent.add("group");
        row.orientation = "row";
        row.alignChildren = ["left", "center"];
        var lbl = row.add("statictext", undefined, label + ":");
        lbl.preferredSize.width = 92;
        var sld = row.add("slider", undefined, val, min, max);
        sld.preferredSize.width = 125;
        var txt = row.add("edittext", undefined, String(val));
        txt.preferredSize.width = textWidth || 48;
        sld.onChanging = function() {
            var rounded = Math.round(sld.value * 10) / 10;
            txt.text = String(rounded);
        };
        txt.onChange = function() {
            var v = parseFloat(txt.text);
            if (isNaN(v)) v = val;
            if (v < min) v = min;
            if (v > max) v = max;
            sld.value = v;
            txt.text = String(Math.round(v * 10) / 10);
        };
        return {
            row: row,
            slider: sld,
            text: txt
        };
    }

    var starPointsRow = panelSettings.add("group");
    starPointsRow.orientation = "row";
    starPointsRow.alignChildren = ["fill", "center"];
    var lblPoints = starPointsRow.add("statictext", undefined, "Star:");
    lblPoints.preferredSize.width = 92;
    var starDD = starPointsRow.add("dropdownlist", undefined, ["4-Point Star", "5-Point Star", "6-Point Star"]);
    starDD.selection = 0;

    var rotCtl = addSliderRow(panelSettings, "Rotation Speed", 0, 120, 50, 48);
    var waveDirCtl = addSliderRow(panelSettings, "Wave Direction", 0, 360, 140, 48);
    var waveSpeedCtl = addSliderRow(panelSettings, "Wave Speed", 0, 3, 0.7, 48);
    var bendCtl = addSliderRow(panelSettings, "Arc Bend", -100, 100, 72, 48);
    var horizDistCtl = addSliderRow(panelSettings, "Horiz Distort", -100, 100, 94, 48);
    var vertDistCtl = addSliderRow(panelSettings, "Vert Distort", -100, 100, -29, 48);

    var btnGenerate = win.add("button", undefined, "Generate ChromaFlare Gradient");
    btnGenerate.preferredSize.height = 30;

    var rowFooter = win.add("group");
    rowFooter.orientation = "row";
    rowFooter.alignment = "left";
    rowFooter.add("statictext", undefined, "ChromaFlare  |  Made by Ehtishaam Shaikh");

    // ============================================================
    //  HELPERS
    // ============================================================
    function addEffect(layer, names) {
        for (var i = 0; i < names.length; i++) {
            try {
                var ef = layer.property("Effects").addProperty(names[i]);
                if (ef) return ef;
            } catch (e) {}
        }
        return null;
    }

    function setFirst(effect, names, value) {
        if (!effect) return false;
        for (var i = 0; i < names.length; i++) {
            try {
                var p = effect.property(names[i]);
                if (p) {
                    p.setValue(value);
                    return true;
                }
            } catch (e) {}
        }
        return false;
    }

    function setByIndex(effect, idx, value) {
        try {
            effect.property(idx).setValue(value);
            return true;
        } catch (e) {}
        return false;
    }

    function findPropDeep(group, wanted) {
        if (!group) return null;
        var wantedLower = wanted.toLowerCase();
        try {
            for (var i = 1; i <= group.numProperties; i++) {
                var p = group.property(i);
                var n = (p.name || "").toLowerCase();
                var m = (p.matchName || "").toLowerCase();
                if (n === wantedLower || m === wantedLower) return p;
                if (p.numProperties && p.numProperties > 0) {
                    var found = findPropDeep(p, wanted);
                    if (found) return found;
                }
            }
        } catch (e) {}
        return null;
    }

    function setDeep(effect, names, value) {
        if (!effect) return false;
        for (var i = 0; i < names.length; i++) {
            var p = findPropDeep(effect, names[i]);
            if (p) {
                try {
                    p.setValue(value);
                    return true;
                } catch (e) {}
            }
        }
        return false;
    }

    function setMenuDeep(effect, names, values) {
        if (!effect) return false;
        for (var i = 0; i < names.length; i++) {
            var p = findPropDeep(effect, names[i]);
            if (p) {
                for (var vi = 0; vi < values.length; vi++) {
                    try {
                        p.setValue(values[vi]);
                        return true;
                    } catch (e) {}
                }
            }
        }
        return false;
    }

    function setPhaseMenu(effect, names, preferredValues) {
        if (setMenuDeep(effect, names, preferredValues)) return true;
        return false;
    }

    function setLayerControlNone(effect, names) {
        if (!effect) return false;
        for (var i = 0; i < names.length; i++) {
            var p = findPropDeep(effect, names[i]);
            if (p) {
                try {
                    p.setValue(0);
                    return true;
                } catch (e) {}
                try {
                    p.setValue(null);
                    return true;
                } catch (e2) {}
            }
        }
        return false;
    }

    function softenColoramaOutputCycle(effect) {
        if (!effect) return false;

        var outputCycle = findPropDeep(effect, "Output Cycle");
        if (!outputCycle) outputCycle = findPropDeep(effect, "ADBE Colorama-Output Cycle");
        if (!outputCycle) return false;

        try {
            var v = outputCycle.value;
            if (v instanceof Array && v.length > 0) {
                if (v[0] instanceof Array && v[0].length >= 4) {
                    v[0][3] = 0;
                    outputCycle.setValue(v);
                    return true;
                }
            }
        } catch (e) {}

        try {
            var pv = outputCycle.value;
            if (pv && pv.length && pv.length >= 2) {
                for (var pi = 0; pi < pv.length; pi++) {
                    if (pv[pi] instanceof Array && pv[pi].length >= 4) {
                        pv[pi][3] = 0;
                        outputCycle.setValue(pv);
                        return true;
                    }
                    if (pv[pi] && pv[pi].color && pv[pi].color.length >= 4) {
                        pv[pi].color[3] = 0;
                        outputCycle.setValue(pv);
                        return true;
                    }
                }
            }
        } catch (e1) {}

        try {
            if (outputCycle.numProperties && outputCycle.numProperties > 0) {
                for (var i = 1; i <= outputCycle.numProperties; i++) {
                    var p = outputCycle.property(i);
                    var n = (p.name || "").toLowerCase();
                    if (n.indexOf("alpha") !== -1 || n.indexOf("opacity") !== -1) {
                        p.setValue(0);
                        return true;
                    }
                }
            }
        } catch (e2) {}

        return false;
    }

    function getNum(textObj, fallback) {
        var v = parseFloat(textObj.text);
        return isNaN(v) ? fallback : v;
    }

    function makeStarLayer(comp, starPoints, rotSpeed, fillColor, nameSuffix, scaleVal, opacityVal, rotationOffset) {
        var layer = comp.layers.addShape();
        layer.name = nameSuffix ? "Rotating Star " + nameSuffix : "Rotating Star Matte";

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
        var useColor = fillColor || [1, 1, 1];
        try {
            fill.property("Color").setValue(useColor);
        } catch (e) {
            try {
                fill.property(4).setValue(useColor);
            } catch (e2) {}
        }

        layer.property("Transform").property("Position").setValue([comp.width / 2, comp.height / 2]);
        if (scaleVal) {
            try {
                layer.property("Transform").property("Scale").setValue([scaleVal, scaleVal]);
            } catch (e) {}
        }
        if (opacityVal) {
            try {
                layer.property("Transform").property("Opacity").setValue(opacityVal);
            } catch (e) {}
        }
        try {
            var off = rotationOffset ? rotationOffset : 0;
            layer.property("Transform").property("Rotation").expression = "time * " + rotSpeed + " + " + off;
        } catch (e) {}

        return layer;
    }

    function applySourceEffects(layer, waveDir, waveSpeed, useColorama) {
        var blur = addEffect(layer, ["ADBE Box Blur2", "ADBE Fast Box Blur", "Fast Box Blur", "ADBE Gaussian Blur 2"]);
        if (blur) {
            setByIndex(blur, 1, 80);
            setByIndex(blur, 2, 3);
            setByIndex(blur, 3, 1);
            setByIndex(blur, 4, true);
        }

        var wave = addEffect(layer, ["ADBE Wave Warp", "Wave Warp", "ADBE Wave Warp2"]);
        if (wave) {
            setByIndex(wave, 1, 6);
            setFirst(wave, ["Wave Type"], 6);
            setByIndex(wave, 2, 200);
            setFirst(wave, ["Wave Height"], 200);
            setByIndex(wave, 3, 70);
            setFirst(wave, ["Wave Width"], 70);
            setByIndex(wave, 4, waveDir);
            setFirst(wave, ["Direction"], waveDir);
            setByIndex(wave, 5, waveSpeed);
            setFirst(wave, ["Wave Speed"], waveSpeed);
            setByIndex(wave, 6, 2);
            setFirst(wave, ["Pinning"], 2);
            setByIndex(wave, 7, 0);
            setFirst(wave, ["Phase"], 0);
            setByIndex(wave, 8, 1);
            setFirst(wave, ["Antialiasing (Best Quality)", "Antialiasing"], 1);
        }

        if (!useColorama) return null;

        var colorama = addEffect(layer, ["ADBE Colorama", "Colorama"]);
        if (colorama) {
            setPhaseMenu(colorama, ["Get Phase From"], [9, 8]);
            setLayerControlNone(colorama, ["Add Phase"]);
            setPhaseMenu(colorama, ["Add Phase From"], [9, 8]);
            setMenuDeep(colorama, ["Add Mode"], [1, 2]);
            setDeep(colorama, ["Phase Shift"], 0);
            setDeep(colorama, ["Cycle Repetitions"], 1);
            setDeep(colorama, ["Modify Alpha"], true);
            setDeep(colorama, ["Composite Over Layer"], true);
            softenColoramaOutputCycle(colorama);
            try {
                colorama.name = "Colorama - Alpha Driver";
            } catch (e) {}
        }

        return colorama;
    }

    function applyArcWarp(layer, bendVal, horizDist, vertDist) {
        var warp = addEffect(layer, ["ADBE Warp", "Warp"]);
        if (warp) {
            setByIndex(warp, 1, 1);
            setFirst(warp, ["Warp Style"], 1);
            setByIndex(warp, 2, 1);
            setFirst(warp, ["Warp Axis"], 1);
            setByIndex(warp, 3, bendVal);
            setFirst(warp, ["Bend"], bendVal);
            setByIndex(warp, 4, horizDist);
            setFirst(warp, ["Horizontal Distortion"], horizDist);
            setByIndex(warp, 5, vertDist);
            setFirst(warp, ["Vertical Distortion"], vertDist);
        }
        return warp;
    }

    function applyFinalGradientTransform(layer, compW, compH, scaleVal, rotationVal) {
        layer.property("Transform").property("Position").setValue([compW / 2, compH / 2]);
        layer.property("Transform").property("Rotation").setValue(rotationVal);
        layer.property("Transform").property("Scale").setValue(scaleVal);
    }

    function applyAlphaTrackMatte(fillLayer, matteLayer) {
        if (!fillLayer || !matteLayer) return false;
        try {
            fillLayer.setTrackMatte(matteLayer, TrackMatteType.ALPHA);
            return true;
        } catch (e) {}
        try {
            fillLayer.trackMatteType = TrackMatteType.ALPHA;
            return true;
        } catch (e2) {}
        return false;
    }

    // ============================================================
    //  GENERATION
    // ============================================================
    btnGenerate.onClick = function() {
        app.beginUndoGroup("Create ChromaFlare Gradient");

        var proj = app.project;
        if (!proj) proj = app.newProject();

        var compW = 1920;
        var compH = 1080;
        var duration = 10;
        var fps = 30;

        var starText = starDD.selection ? starDD.selection.text : "4-Point Star";
        var starPoints = 4;
        if (starText.indexOf("5") === 0) starPoints = 5;
        if (starText.indexOf("6") === 0) starPoints = 6;

        var rotSpeed = getNum(rotCtl.text, 50);
        var waveDir = getNum(waveDirCtl.text, 140);
        var waveSpeed = getNum(waveSpeedCtl.text, 0.7);
        var bendVal = getNum(bendCtl.text, 72);
        var horizDist = getNum(horizDistCtl.text, 94);
        var vertDist = getNum(vertDistCtl.text, -29);

        // --------------------------------------------------------
        //  1. STAR SOURCE COMP
        // --------------------------------------------------------
        var sourceComp = proj.items.addComp("ChromaFlare - Star Source", compW, compH, 1, duration, fps);
        var starLayer = makeStarLayer(sourceComp, starPoints, rotSpeed, [1, 1, 1], "Colorama Driver", 100, 100, 0);
        applySourceEffects(starLayer, waveDir, waveSpeed, true);

        var matteComp = proj.items.addComp("ChromaFlare - Alpha Matte", compW, compH, 1, duration, fps);
        var matteStarLayer = makeStarLayer(matteComp, starPoints, rotSpeed, [1, 1, 1], "Alpha Matte", 100, 100, 0);
        applySourceEffects(matteStarLayer, waveDir, waveSpeed, false);

        // --------------------------------------------------------
        //  2. ARC WARP PRECOMP
        // --------------------------------------------------------
        var arcComp = proj.items.addComp("ChromaFlare - Arc Warp", compW, compH, 1, duration, fps);
        var sourceLayer = arcComp.layers.add(sourceComp);
        sourceLayer.name = "Colorama Star Source";
        applyArcWarp(sourceLayer, bendVal, horizDist, vertDist);

        // --------------------------------------------------------
        //  3. FINAL COMPOSITION WITH DUPLICATED COLORAMA SOURCE LAYERS
        // --------------------------------------------------------
        var finalComp = proj.items.addComp("Gradient final", compW, compH, 1, duration, fps);
        try {
            finalComp.bgColor = [0, 0, 0];
        } catch (e) {}

        var base = finalComp.layers.add(sourceComp);
        base.name = "Colorama Star Source";
        applyFinalGradientTransform(base, compW, compH, [100, 100], 90);
        applyArcWarp(base, bendVal, horizDist, vertDist);

        var baseMatte = finalComp.layers.add(matteComp);
        baseMatte.name = "Colorama Star Source Alpha Matte";
        applyFinalGradientTransform(baseMatte, compW, compH, [100, 100], 90);
        applyArcWarp(baseMatte, bendVal, horizDist, vertDist);
        applyAlphaTrackMatte(base, baseMatte);

        var dupe = finalComp.layers.add(sourceComp);
        dupe.name = "Colorama Star Source 2";
        applyFinalGradientTransform(dupe, compW, compH, [-100, -100], 90);
        applyArcWarp(dupe, bendVal, horizDist, vertDist);

        var dupeMatte = finalComp.layers.add(matteComp);
        dupeMatte.name = "Colorama Star Source 2 Alpha Matte";
        applyFinalGradientTransform(dupeMatte, compW, compH, [-100, -100], 90);
        applyArcWarp(dupeMatte, bendVal, horizDist, vertDist);
        applyAlphaTrackMatte(dupe, dupeMatte);

        var didPrecompose = false;
        try {
            finalComp.layers.precompose([dupeMatte.index, dupe.index, baseMatte.index, base.index], "ChromaFlare - Final Gradients", true);
            if (finalComp.layer(1)) finalComp.layer(1).name = "ChromaFlare Final Gradient";
            didPrecompose = true;
        } catch (e) {}

        finalComp.openInViewer();
        app.endUndoGroup();

        alert("ChromaFlare Gradient created!\n\n" +
            "Generated comps:\n" +
            "  1. ChromaFlare - Star Source\n" +
            "  2. ChromaFlare - Alpha Matte\n" +
            "  3. ChromaFlare - Arc Warp\n" +
            "  4. ChromaFlare - Final Gradients\n" +
            "  5. Gradient final\n\n" +
            "Tutorial defaults applied:\n" +
            "  - Rotation expression: time * " + rotSpeed + "\n" +
            "  - Fast Box Blur: 80 radius, 3 iterations\n" +
            "  - Wave Warp: Semicircle, 200 height, 70 width\n" +
            "  - Wave Warp Pinning: All Edges\n" +
            "  - Colorama Input Phase: Alpha, Add Phase: None, Add Mode: Wrap\n" +
            "  - Alpha matte applied after Colorama for soft transparent edges\n" +
            "  - Warp: Arc, Horizontal, Bend " + bendVal + ", H " + horizDist + ", V " + vertDist + "\n\n" +
            (didPrecompose ? "The two final gradients were mirrored and precomposed into one layer." : "The two final gradients were mirrored, but AE did not allow the precompose step.") +
            " The first Output Cycle color opacity is still attempted, with the alpha matte as the reliable fallback.");
    };

    win.onResizing = win.onResize = function() {
        this.layout.resize();
    };
    win.layout.layout(true);
    if (win instanceof Window) {
        win.center();
        win.show();
    }

})(this);
