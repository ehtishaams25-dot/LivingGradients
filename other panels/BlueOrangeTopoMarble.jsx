/**
 * ============================================================
 *  BLUE ORANGE TOPO MARBLE
 *  Adobe After Effects Dockable Panel Script
 *  Recreates:
 *  Fractal Noise -> Turbulent Displace -> CC Toner
 *  then precomp -> CC Glass -> Optics Compensation
 * ============================================================
 */
(function(thisObj){

    var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Blue Orange Topo Marble", undefined, {resizeable:true});
    if(!win){ alert("Script must be docked as a panel."); return; }

    win.orientation = "column";
    win.alignChildren = ["fill","top"];
    win.spacing = 6;

    // ============================================================
    //  SETTINGS
    // ============================================================
    var SETTINGS = {
        compName: "Blue Orange Topo Marble",
        baseCompName: "Topo Marble - Fractal Toner Base",
        layerName: "White Solid 5",
        compW: 5000,
        compH: 2813,
        duration: 10,
        fps: 30,

        fractal: {
            fractalType: 1,              // Basic
            noiseType: 2,                // Block
            invert: false,
            contrast: 165,
            brightness: 0,
            overflow: 4,                 // Allow HDR Results

            rotation: 0,
            uniformScaling: false,
            scale: 6,
            scaleWidth: 100,
            scaleHeight: 10000,
            offsetTurbulence: [2500, 1406.5],
            perspectiveOffset: false,

            complexity: 6,
            subInfluence: 25,
            subScaling: 10,
            subRotation: 300,
            subOffset: [0, 0],
            centerSubscale: false,

            evolution: 0,
            opacity: 100,
            blendingMode: 1              // None
        },

        turbulent: {
            displacement: 1,             // Turbulent
            amount: 215,
            size: 350,
            offset: [2726.3, 1406.5],
            complexity: 2.5,
            evolutionExpression: "time * 90",
            pinning: 1,                  // Pin All
            antialiasing: 1              // Low
        },

        toner: {
            tones: 3,                    // Pentone
            highlights: [1.0, 0.50, 0.0],
            brights: [0.0, 0.0, 0.0],
            midtones: [0.0, 0.0, 0.0],
            darktones: [0.0, 0.47, 1.0],
            shadows: [0.0, 0.31, 0.95],
            blend: 0
        },

        optics: {
            fov: 8,
            reverse: true,
            orientation: 1,              // Horizontal
            viewCenter: [2500, 1406.5],
            optimalPixels: true,
            resize: 1                    // Off
        }
    };

    // ============================================================
    //  UI
    // ============================================================
    var panelInfo = win.add("panel", undefined, " Topo Marble");
    panelInfo.orientation = "column";
    panelInfo.alignChildren = ["fill","top"];
    panelInfo.spacing = 5;

    panelInfo.add("statictext", undefined, "Creates the screenshot effect stack with the final lens/glass effects on a precomp.");

    var btnGenerate = win.add("button", undefined, "Generate Topo Marble");
    btnGenerate.preferredSize.height = 30;

    var rowFooter = win.add("group");
    rowFooter.orientation = "row";
    rowFooter.alignment = "left";
    rowFooter.add("statictext", undefined, "Blue Orange Topo Marble");

    // ============================================================
    //  HELPER: Safe Effect Add
    // ============================================================
    function addEffect(layer, names){
        for(var i = 0; i < names.length; i++){
            try{ var ef = layer.Effects.addProperty(names[i]); if(ef) return ef; }catch(e){}
        }
        return null;
    }

    function propByNames(group, names){
        if(!group) return null;
        for(var i = 0; i < names.length; i++){
            try{ var p = group.property(names[i]); if(p) return p; }catch(e){}
        }
        return null;
    }

    function setProp(prop, value){
        if(!prop) return false;
        try{ prop.setValue(value); return true; }catch(e){}
        return false;
    }

    function setEffectValue(fx, index, names, value){
        if(!fx) return false;
        if(setProp(propByNames(fx, names), value)) return true;
        try{ if(setProp(fx.property(index), value)) return true; }catch(e){}
        return false;
    }

    function setGroupValue(fx, groupNames, index, names, value){
        var group = propByNames(fx, groupNames);
        if(group){
            if(setProp(propByNames(group, names), value)) return true;
            try{ if(setProp(group.property(index), value)) return true; }catch(e){}
        }
        return setEffectValue(fx, index, names, value);
    }

    function setEffectExpression(fx, names, expressionText){
        var p = propByNames(fx, names);
        if(!p) return false;
        try{ p.expression = expressionText; return true; }catch(e){}
        return false;
    }

    function setGroupExpression(fx, groupNames, names, expressionText){
        var group = propByNames(fx, groupNames);
        if(group && setEffectExpression(group, names, expressionText)) return true;
        return setEffectExpression(fx, names, expressionText);
    }

    // ============================================================
    //  EFFECT BUILDERS
    // ============================================================
    function applyFractalNoise(layer, cfg){
        var fractal = addEffect(layer, ["ADBE Fractal Noise", "Fractal Noise"]);
        if(!fractal) return "Missing Fractal Noise";

        setEffectValue(fractal, 1, ["Fractal Type"], cfg.fractalType);
        setEffectValue(fractal, 2, ["Noise Type"], cfg.noiseType);
        setEffectValue(fractal, 3, ["Invert"], cfg.invert);
        setEffectValue(fractal, 4, ["Contrast"], cfg.contrast);
        setEffectValue(fractal, 5, ["Brightness"], cfg.brightness);
        setEffectValue(fractal, 6, ["Overflow"], cfg.overflow);

        setGroupValue(fractal, ["Transform"], 1, ["Rotation"], cfg.rotation);
        setGroupValue(fractal, ["Transform"], 2, ["Uniform Scaling"], cfg.uniformScaling);
        setGroupValue(fractal, ["Transform"], 3, ["Scale"], cfg.scale);
        setGroupValue(fractal, ["Transform"], 4, ["Scale Width"], cfg.scaleWidth);
        setGroupValue(fractal, ["Transform"], 5, ["Scale Height"], cfg.scaleHeight);
        setGroupValue(fractal, ["Transform"], 6, ["Offset Turbulence"], cfg.offsetTurbulence);
        setGroupValue(fractal, ["Transform"], 7, ["Perspective Offset"], cfg.perspectiveOffset);

        setEffectValue(fractal, 8, ["Complexity"], cfg.complexity);

        setGroupValue(fractal, ["Sub Settings"], 1, ["Sub Influence (%)", "Sub Influence"], cfg.subInfluence);
        setGroupValue(fractal, ["Sub Settings"], 2, ["Sub Scaling"], cfg.subScaling);
        setGroupValue(fractal, ["Sub Settings"], 3, ["Sub Rotation"], cfg.subRotation);
        setGroupValue(fractal, ["Sub Settings"], 4, ["Sub Offset"], cfg.subOffset);
        setGroupValue(fractal, ["Sub Settings"], 5, ["Center Subscale"], cfg.centerSubscale);

        setGroupValue(fractal, ["Evolution"], 1, ["Evolution"], cfg.evolution);
        setEffectValue(fractal, 14, ["Evolution"], cfg.evolution);

        setEffectValue(fractal, 15, ["Opacity"], cfg.opacity);
        setEffectValue(fractal, 16, ["Blending Mode"], cfg.blendingMode);

        return "";
    }

    function applyTurbulentDisplace(layer, cfg){
        var turb = addEffect(layer, ["ADBE Turbulent Displace", "ADBE TurbulentDisplace", "Turbulent Displace"]);
        if(!turb) return "Missing Turbulent Displace";

        setEffectValue(turb, 1, ["Displacement"], cfg.displacement);
        setEffectValue(turb, 2, ["Amount"], cfg.amount);
        setEffectValue(turb, 3, ["Size"], cfg.size);
        setEffectValue(turb, 4, ["Offset (Turbulence)", "Offset"], cfg.offset);
        setEffectValue(turb, 5, ["Complexity"], cfg.complexity);
        setEffectExpression(turb, ["Evolution"], cfg.evolutionExpression);
        setEffectValue(turb, 8, ["Pinning"], cfg.pinning);
        setEffectValue(turb, 9, ["Antialiasing for Best Quality", "Antialiasing"], cfg.antialiasing);

        return "";
    }

    function applyToner(layer, cfg){
        var toner = addEffect(layer, ["CC Toner", "CC Toner2"]);
        if(!toner) return "Missing CC Toner";

        setEffectValue(toner, 1, ["Tones"], cfg.tones);
        setEffectValue(toner, 2, ["Highlights"], cfg.highlights);
        setEffectValue(toner, 3, ["Brights"], cfg.brights);
        setEffectValue(toner, 4, ["Midtones"], cfg.midtones);
        setEffectValue(toner, 5, ["Darktones"], cfg.darktones);
        setEffectValue(toner, 6, ["Shadows"], cfg.shadows);
        setEffectValue(toner, 7, ["Blend w. Original", "Blend With Original"], cfg.blend);

        return "";
    }

    function applyGlass(layer){
        var glass = addEffect(layer, ["CC Glass", "CC Glass2"]);
        if(!glass) return "Missing CC Glass";

        // The screenshot shows CC Glass groups collapsed, so the AE defaults are left intact.
        return "";
    }

    function applyOptics(layer, cfg){
        var optics = addEffect(layer, ["ADBE Optics Compensation", "Optics Compensation"]);
        if(!optics) return "Missing Optics Compensation";

        setEffectValue(optics, 1, ["Field Of View (FOV)", "Field of View"], cfg.fov);
        setEffectValue(optics, 2, ["Reverse Lens Distortion"], cfg.reverse);
        setEffectValue(optics, 3, ["FOV Orientation"], cfg.orientation);
        setEffectValue(optics, 4, ["View Center"], cfg.viewCenter);
        setEffectValue(optics, 5, ["Optimal Pixels (Inv)", "Optimal Pixels"], cfg.optimalPixels);
        setEffectValue(optics, 6, ["Resize"], cfg.resize);

        return "";
    }

    function findLayerBySource(comp, sourceItem){
        for(var i = 1; i <= comp.numLayers; i++){
            try{ if(comp.layer(i).source === sourceItem) return comp.layer(i); }catch(e){}
        }
        return null;
    }

    // ============================================================
    //  GENERATION LOGIC
    // ============================================================
    btnGenerate.onClick = function(){
        app.beginUndoGroup("Create Blue Orange Topo Marble");

        try{
            var proj = app.project;
            if(!proj) proj = app.newProject();

            var finalComp = proj.items.addComp(
                SETTINGS.compName,
                SETTINGS.compW,
                SETTINGS.compH,
                1,
                SETTINGS.duration,
                SETTINGS.fps
            );

            var solid = finalComp.layers.addSolid([1, 1, 1], SETTINGS.layerName, SETTINGS.compW, SETTINGS.compH, 1, SETTINGS.duration);
            solid.moveToBeginning();

            var issues = [];
            var result;

            result = applyFractalNoise(solid, SETTINGS.fractal);       if(result) issues.push(result);
            result = applyTurbulentDisplace(solid, SETTINGS.turbulent); if(result) issues.push(result);
            result = applyToner(solid, SETTINGS.toner);                 if(result) issues.push(result);

            // Precompose after CC Toner. CC Glass and Optics belong on the precomp layer.
            var baseComp = finalComp.layers.precompose([solid.index], SETTINGS.baseCompName, true);
            var precompLayer = findLayerBySource(finalComp, baseComp);
            if(!precompLayer) precompLayer = finalComp.layer(1);
            precompLayer.name = "Topo Marble Precomp";

            result = applyGlass(precompLayer);                          if(result) issues.push(result);
            result = applyOptics(precompLayer, SETTINGS.optics);         if(result) issues.push(result);

            finalComp.openInViewer();
            app.endUndoGroup();

            if(issues.length){
                alert("Topo Marble created, but AE could not add:\n\n" + issues.join("\n") + "\n\nCheck that the Cycore/CC effects are installed.");
            }else{
                alert("Blue Orange Topo Marble created.\n\nInside precomp:\nFractal Noise > Turbulent Displace > CC Toner\n\nOn precomp layer:\nCC Glass > Optics Compensation");
            }

        }catch(err){
            try{ app.endUndoGroup(); }catch(e){}
            alert("Blue Orange Topo Marble failed:\n" + err.toString() + (err.line ? "\nLine: " + err.line : ""));
        }
    };

    win.layout.layout(true);

})(this);
