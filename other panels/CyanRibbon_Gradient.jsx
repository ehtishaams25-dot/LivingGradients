/**
 * ============================================================
 *  CYAN RIBBON GRADIENT GENERATOR
 *  Adobe After Effects Dockable Panel Script
 *  Made by Ehtishaam Shaikh | linktr.ee/itsehtishaam
 * ============================================================
 *
 *  Reference-inspired build:
 *  1. [BG] solid with Motion Tile -> 4-Color Gradient -> Twirl
 *  2. Procedural Waves layer for soft cyan/purple flowing folds
 *  3. Final adjustment layer for subtle distortion and glow
 *  4. Optional centered "Gradient." title
 */
(function(thisObj) {

    var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "CyanRibbon Gradient", undefined, {
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
    var panelSettings = win.add("panel", undefined, " CyanRibbon Settings");
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

    var sizeRow = panelSettings.add("group");
    sizeRow.orientation = "row";
    sizeRow.alignChildren = ["fill", "center"];
    var lblSize = sizeRow.add("statictext", undefined, "Size:");
    lblSize.preferredSize.width = 92;
    var sizeDD = sizeRow.add("dropdownlist", undefined, ["2560 x 1440", "1920 x 1080", "1080 x 1920"]);
    sizeDD.selection = 0;

    var motionCtl = addSliderRow(panelSettings, "Motion Speed", 0, 120, 18, 48);
    var twirlAngleCtl = addSliderRow(panelSettings, "Twirl Angle", -720, 720, 360, 54);
    var twirlRadiusCtl = addSliderRow(panelSettings, "Twirl Radius", 0, 100, 23.5, 48);
    var waveAmountCtl = addSliderRow(panelSettings, "Wave Amount", 0, 160, 72, 48);
    var ribbonContrastCtl = addSliderRow(panelSettings, "Ribbon Detail", 20, 260, 145, 48);

    var titleRow = panelSettings.add("group");
    titleRow.orientation = "row";
    titleRow.alignChildren = ["left", "center"];
    var chkTitle = titleRow.add("checkbox", undefined, "Add centered title");
    chkTitle.value = true;

    var btnGenerate = win.add("button", undefined, "Generate CyanRibbon Gradient");
    btnGenerate.preferredSize.height = 30;

    var rowFooter = win.add("group");
    rowFooter.orientation = "row";
    rowFooter.alignment = "left";
    rowFooter.add("statictext", undefined, "CyanRibbon  |  Made by Ehtishaam Shaikh");

    // ============================================================
    //  HELPERS
    // ============================================================
    function addEffect(layer, names) {
        for (var i = 0; i < names.length; i++) {
            try {
                var ef = layer.property("Effects").addProperty(names[i]);
                if (ef) return ef;
            } catch (e) {}
            try {
                var ef2 = layer.Effects.addProperty(names[i]);
                if (ef2) return ef2;
            } catch (e2) {}
        }
        return null;
    }

    function propByNames(group, names) {
        if (!group) return null;
        for (var i = 0; i < names.length; i++) {
            try {
                var p = group.property(names[i]);
                if (p) return p;
            } catch (e) {}
        }
        return null;
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

    function setProp(prop, value) {
        if (!prop) return false;
        try {
            prop.setValue(value);
            return true;
        } catch (e) {}
        return false;
    }

    function setEffectValue(fx, index, names, value) {
        if (!fx) return false;
        if (setProp(propByNames(fx, names), value)) return true;
        for (var i = 0; i < names.length; i++) {
            if (setProp(findPropDeep(fx, names[i]), value)) return true;
        }
        try {
            if (setProp(fx.property(index), value)) return true;
        } catch (e) {}
        return false;
    }

    function setGroupValue(fx, groupNames, index, names, value) {
        var group = propByNames(fx, groupNames);
        if (!group) {
            for (var gi = 0; gi < groupNames.length; gi++) {
                group = findPropDeep(fx, groupNames[gi]);
                if (group) break;
            }
        }
        if (group) {
            if (setProp(propByNames(group, names), value)) return true;
            for (var i = 0; i < names.length; i++) {
                if (setProp(findPropDeep(group, names[i]), value)) return true;
            }
            try {
                if (setProp(group.property(index), value)) return true;
            } catch (e) {}
        }
        return setEffectValue(fx, index, names, value);
    }

    function setExpression(fx, names, expressionText) {
        if (!fx) return false;
        for (var i = 0; i < names.length; i++) {
            var p = propByNames(fx, [names[i]]);
            if (!p) p = findPropDeep(fx, names[i]);
            if (p) {
                try {
                    p.expression = expressionText;
                    return true;
                } catch (e) {}
            }
        }
        return false;
    }

    function getNum(textObj, fallback) {
        var v = parseFloat(textObj.text);
        return isNaN(v) ? fallback : v;
    }

    function getCompSize() {
        var txt = sizeDD.selection ? sizeDD.selection.text : "2560 x 1440";
        if (txt.indexOf("1920") === 0) return [1920, 1080];
        if (txt.indexOf("1080") === 0) return [1080, 1920];
        return [2560, 1440];
    }

    function safeBlendMode(layer, modes) {
        for (var i = 0; i < modes.length; i++) {
            try {
                layer.blendingMode = modes[i];
                return true;
            } catch (e) {}
        }
        return false;
    }

    function addBlur(layer, amount) {
        var blur = addEffect(layer, ["ADBE Box Blur2", "ADBE Fast Box Blur", "Fast Box Blur", "ADBE Gaussian Blur 2"]);
        if (blur) {
            setEffectValue(blur, 1, ["Blur Radius", "Blurriness"], amount);
            setEffectValue(blur, 2, ["Iterations"], 3);
            setEffectValue(blur, 3, ["Repeat Edge Pixels"], true);
            setEffectValue(blur, 4, ["Repeat Edge Pixels"], true);
        }
        return blur;
    }

    // ============================================================
    //  EFFECT BUILDERS
    // ============================================================
    function applyMotionTile(layer, compW, compH, motionSpeed) {
        var tile = addEffect(layer, ["ADBE Tile", "Motion Tile"]);
        if (!tile) return "Missing Motion Tile";

        setEffectValue(tile, 1, ["Tile Center"], [compW / 2, compH / 2]);
        setEffectValue(tile, 2, ["Tile Width"], 100);
        setEffectValue(tile, 3, ["Tile Height"], 100);
        setEffectValue(tile, 4, ["Output Width"], 300);
        setEffectValue(tile, 5, ["Output Height"], 300);
        setEffectValue(tile, 6, ["Mirror Edges"], true);
        setEffectValue(tile, 7, ["Phase"], 0);
        setEffectValue(tile, 8, ["Horizontal Phase Shift"], false);

        if (motionSpeed > 0) {
            setExpression(tile, ["Phase"], "time * " + motionSpeed);
        }

        return "";
    }

    function applyFourColorGradient(layer, compW, compH) {
        var grad = addEffect(layer, ["ADBE 4ColorGradient", "ADBE Four Color Gradient", "4-Color Gradient"]);
        if (!grad) return "Missing 4-Color Gradient";

        var p1 = [compW * 0.02, compH * 0.02];
        var p2 = [compW * 0.86, compH * 0.07];
        var p3 = [compW * 0.18, compH * 0.95];
        var p4 = [compW * 1.02, compH * 0.94];

        setEffectValue(grad, 1, ["Point 1"], p1);
        setEffectValue(grad, 2, ["Point 2"], p2);
        setEffectValue(grad, 3, ["Point 3"], p3);
        setEffectValue(grad, 4, ["Point 4"], p4);

        setEffectValue(grad, 5, ["Color 1"], [0.00, 0.90, 0.92]);
        setEffectValue(grad, 6, ["Color 2"], [0.04, 0.38, 1.00]);
        setEffectValue(grad, 7, ["Color 3"], [0.02, 0.70, 0.86]);
        setEffectValue(grad, 8, ["Color 4"], [0.02, 0.12, 0.78]);

        setEffectValue(grad, 9, ["Blend"], 85);
        setEffectValue(grad, 10, ["Opacity"], 100);

        return "";
    }

    function applyTwirl(layer, compW, compH, angleVal, radiusVal) {
        var twirl = addEffect(layer, ["ADBE Twirl", "Twirl"]);
        if (!twirl) return "Missing Twirl";

        setEffectValue(twirl, 1, ["Angle"], angleVal);
        setEffectValue(twirl, 2, ["Twirl Radius", "Radius"], radiusVal);
        setEffectValue(twirl, 3, ["Twirl Center", "Center"], [compW / 2, compH / 2]);
        return "";
    }

    function applyWaveWarp(layer, amount, direction, speed) {
        var wave = addEffect(layer, ["ADBE Wave Warp", "Wave Warp", "ADBE Wave Warp2"]);
        if (!wave) return "Missing Wave Warp";

        setEffectValue(wave, 1, ["Wave Type"], 6);
        setEffectValue(wave, 2, ["Wave Height"], amount);
        setEffectValue(wave, 3, ["Wave Width"], 410);
        setEffectValue(wave, 4, ["Direction"], direction);
        setEffectValue(wave, 5, ["Wave Speed"], speed);
        setEffectValue(wave, 6, ["Pinning"], 2);
        setEffectValue(wave, 7, ["Phase"], 0);
        setEffectValue(wave, 8, ["Antialiasing (Best Quality)", "Antialiasing"], 1);
        return "";
    }

    function applyTurbulentDisplace(layer, amount, size, speed) {
        var turb = addEffect(layer, ["ADBE Turbulent Displace", "ADBE TurbulentDisplace", "Turbulent Displace"]);
        if (!turb) return "Missing Turbulent Displace";

        setEffectValue(turb, 1, ["Displacement"], 1);
        setEffectValue(turb, 2, ["Amount"], amount);
        setEffectValue(turb, 3, ["Size"], size);
        setEffectValue(turb, 5, ["Complexity"], 2.2);
        setExpression(turb, ["Evolution"], "time * " + speed);
        setEffectValue(turb, 8, ["Pinning"], 2);
        setEffectValue(turb, 9, ["Antialiasing for Best Quality", "Antialiasing"], 1);
        return "";
    }

    function applyFractalRibbon(layer, compW, compH, contrastVal, motionSpeed) {
        var fractal = addEffect(layer, ["ADBE Fractal Noise", "Fractal Noise"]);
        if (!fractal) return "Missing Fractal Noise";

        setEffectValue(fractal, 1, ["Fractal Type"], 1);
        setEffectValue(fractal, 2, ["Noise Type"], 4);
        setEffectValue(fractal, 3, ["Invert"], false);
        setEffectValue(fractal, 4, ["Contrast"], contrastVal);
        setEffectValue(fractal, 5, ["Brightness"], -42);
        setEffectValue(fractal, 6, ["Overflow"], 2);

        setGroupValue(fractal, ["Transform"], 1, ["Rotation"], -38);
        setGroupValue(fractal, ["Transform"], 2, ["Uniform Scaling"], false);
        setGroupValue(fractal, ["Transform"], 3, ["Scale"], 300);
        setGroupValue(fractal, ["Transform"], 4, ["Scale Width"], 520);
        setGroupValue(fractal, ["Transform"], 5, ["Scale Height"], 58);
        setGroupValue(fractal, ["Transform"], 6, ["Offset Turbulence"], [compW * 0.48, compH * 0.5]);
        setEffectValue(fractal, 8, ["Complexity"], 5.5);
        setExpression(fractal, ["Evolution"], "time * " + (motionSpeed * 4));

        return "";
    }

    function applyTint(layer) {
        var tint = addEffect(layer, ["ADBE Tint", "Tint"]);
        if (!tint) return "Missing Tint";

        setEffectValue(tint, 1, ["Map Black To"], [0.01, 0.02, 0.15]);
        setEffectValue(tint, 2, ["Map White To"], [0.02, 1.00, 0.84]);
        setEffectValue(tint, 3, ["Amount to Tint"], 100);
        return "";
    }

    function applyGlow(layer) {
        var glow = addEffect(layer, ["ADBE Glow", "Glow"]);
        if (!glow) return "";

        setEffectValue(glow, 1, ["Glow Based On"], 2);
        setEffectValue(glow, 2, ["Glow Threshold"], 47);
        setEffectValue(glow, 3, ["Glow Radius"], 95);
        setEffectValue(glow, 4, ["Glow Intensity"], 0.65);
        return "";
    }

    function applyCurvesOrLevels(layer) {
        var levels = addEffect(layer, ["ADBE Easy Levels2", "ADBE Easy Levels", "Levels"]);
        if (!levels) return "";

        setEffectValue(levels, 1, ["Input Black"], 8);
        setEffectValue(levels, 2, ["Input White"], 245);
        setEffectValue(levels, 3, ["Gamma"], 1.06);
        return "";
    }

    function makeDiagonalRibbon(comp, name, color, pos, size, rotation, opacity, blurAmount) {
        var layer = comp.layers.addShape();
        layer.name = name;

        var contents = layer.property("Contents");
        var grp = contents.addProperty("ADBE Vector Group");
        grp.name = "Soft Ribbon";
        var gc = grp.property("Contents");

        var rect = gc.addProperty("ADBE Vector Shape - Rect");
        try {
            rect.property("Size").setValue(size);
        } catch (e) {
            try {
                rect.property(2).setValue(size);
            } catch (e2) {}
        }
        try {
            rect.property("Roundness").setValue(size[1] * 0.5);
        } catch (e3) {
            try {
                rect.property(3).setValue(size[1] * 0.5);
            } catch (e4) {}
        }

        var fill = gc.addProperty("ADBE Vector Graphic - Fill");
        try {
            fill.property("Color").setValue(color);
        } catch (e5) {
            try {
                fill.property(4).setValue(color);
            } catch (e6) {}
        }

        layer.property("Transform").property("Position").setValue(pos);
        layer.property("Transform").property("Rotation").setValue(rotation);
        layer.property("Transform").property("Opacity").setValue(opacity);

        addBlur(layer, blurAmount);
        applyWaveWarp(layer, 28, 126, 0.08);
        applyTurbulentDisplace(layer, 34, 310, 18);

        safeBlendMode(layer, [BlendingMode.ADD, BlendingMode.SCREEN]);
        return layer;
    }

    function addTitle(comp, compW, compH) {
        var txt = comp.layers.addText("Gradient.");
        txt.name = "Gradient.";
        txt.property("Transform").property("Position").setValue([compW / 2, compH / 2 + compH * 0.02]);

        try {
            var doc = txt.property("Source Text").value;
            doc.font = "Arial-BoldMT";
            doc.fontSize = Math.round(compW * 0.052);
            doc.fillColor = [1, 1, 1];
            doc.justification = ParagraphJustification.CENTER_JUSTIFY;
            txt.property("Source Text").setValue(doc);
        } catch (e) {}

        var glow = addEffect(txt, ["ADBE Glow", "Glow"]);
        if (glow) {
            setEffectValue(glow, 2, ["Glow Threshold"], 70);
            setEffectValue(glow, 3, ["Glow Radius"], 18);
            setEffectValue(glow, 4, ["Glow Intensity"], 0.35);
        }

        return txt;
    }

    // ============================================================
    //  GENERATION
    // ============================================================
    btnGenerate.onClick = function() {
        app.beginUndoGroup("Create CyanRibbon Gradient");

        try {
            var proj = app.project;
            if (!proj) proj = app.newProject();

            var size = getCompSize();
            var compW = size[0];
            var compH = size[1];
            var duration = 10;
            var fps = 30;

            var motionSpeed = getNum(motionCtl.text, 18);
            var twirlAngle = getNum(twirlAngleCtl.text, 360);
            var twirlRadius = getNum(twirlRadiusCtl.text, 23.5);
            var waveAmount = getNum(waveAmountCtl.text, 72);
            var ribbonDetail = getNum(ribbonContrastCtl.text, 145);

            var finalComp = proj.items.addComp("CyanRibbon Gradient", compW, compH, 1, duration, fps);
            try {
                finalComp.bgColor = [0.0, 0.02, 0.08];
            } catch (e) {}

            var issues = [];
            var result;

            var bg = finalComp.layers.addSolid([0.02, 0.25, 0.95], "[BG]", compW, compH, 1, duration);
            bg.moveToEnd();

            result = applyMotionTile(bg, compW, compH, motionSpeed);
            if (result) issues.push(result);
            result = applyFourColorGradient(bg, compW, compH);
            if (result) issues.push(result);
            result = applyTwirl(bg, compW, compH, twirlAngle, twirlRadius);
            if (result) issues.push(result);
            result = applyTurbulentDisplace(bg, 22, 540, 8);
            if (result) issues.push(result);

            var waves = finalComp.layers.addSolid([0, 0, 0], "Waves", compW, compH, 1, duration);
            waves.moveBefore(bg);
            result = applyFractalRibbon(waves, compW, compH, ribbonDetail, motionSpeed);
            if (result) issues.push(result);
            result = applyWaveWarp(waves, waveAmount, 130, 0.12);
            if (result) issues.push(result);
            result = applyTurbulentDisplace(waves, 52, 420, 22);
            if (result) issues.push(result);
            result = applyTint(waves);
            if (result) issues.push(result);
            addBlur(waves, 18);
            applyGlow(waves);
            waves.property("Transform").property("Opacity").setValue(62);
            safeBlendMode(waves, [BlendingMode.SCREEN, BlendingMode.ADD]);

            makeDiagonalRibbon(finalComp, "Cyan Fold 1", [0.00, 0.95, 0.90], [compW * 0.33, compH * 0.18], [compW * 0.95, compH * 0.11], -43, 34, 70);
            makeDiagonalRibbon(finalComp, "Blue Fold 1", [0.02, 0.28, 1.00], [compW * 0.70, compH * 0.28], [compW * 1.05, compH * 0.15], -41, 30, 78);
            makeDiagonalRibbon(finalComp, "Cyan Fold 2", [0.00, 1.00, 0.72], [compW * 0.78, compH * 0.72], [compW * 0.72, compH * 0.10], -39, 38, 64);
            makeDiagonalRibbon(finalComp, "Violet Shadow Fold", [0.19, 0.06, 0.58], [compW * 0.54, compH * 0.48], [compW * 1.15, compH * 0.18], -38, 28, 90);

            var adjust = finalComp.layers.addSolid([1, 1, 1], "Final Polish", compW, compH, 1, duration);
            adjust.adjustmentLayer = true;
            adjust.moveToBeginning();
            applyTurbulentDisplace(adjust, 10, 900, 5);
            applyCurvesOrLevels(adjust);
            applyGlow(adjust);

            if (chkTitle.value) {
                var title = addTitle(finalComp, compW, compH);
                title.moveToBeginning();
            }

            finalComp.openInViewer();
            app.endUndoGroup();

            if (issues.length) {
                alert("CyanRibbon Gradient created, but AE could not add:\n\n" + issues.join("\n") + "\n\nThe comp is still built. Check that the listed effects are available in your AE install.");
            } else {
                alert("CyanRibbon Gradient created.\n\nLayer stack:\n  - Gradient. text\n  - Final Polish\n  - Soft fold ribbons\n  - Waves\n  - [BG]\n\n[BG] uses the screenshot-style stack:\n  Motion Tile > 4-Color Gradient > Twirl\n\nThe Waves and fold layers add the cyan/purple satin streaks from the reference.");
            }

        } catch (err) {
            try {
                app.endUndoGroup();
            } catch (e) {}
            alert("CyanRibbon Gradient failed:\n" + err.toString() + (err.line ? "\nLine: " + err.line : ""));
        }
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
