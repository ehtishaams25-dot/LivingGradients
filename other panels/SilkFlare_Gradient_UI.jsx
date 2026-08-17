/**
 * ============================================================
 *  SILKFLARE GRADIENT GENERATOR
 *  Adobe After Effects Dockable Panel Script
 *  Made by Ehtishaam Shaikh | linktr.ee/itsehtishaam
 * ============================================================
 */
(function(thisObj){

    var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "SilkFlare Gradient", undefined, {resizeable:true});
    if(!win){ alert("Script must be docked as a panel."); return; }

    win.orientation = "column";
    win.alignChildren = ["fill","top"];
    win.spacing = 6;

    // ============================================================
    //  GLOBAL STATE
    // ============================================================
    var NUM_SWATCHES = 10;
    var locked = [];
    for(var li = 0; li < NUM_SWATCHES; li++) locked.push(false);

    var activeContext = {
        blobFills: [],
        blobColorIndices: [],
        shapeGrpContents: null,
        waveWarp: null
    };

    var defaultColors = [
        [0.85, 0.40, 0.00],    // deep orange
        [0.95, 0.55, 0.10],    // bright orange
        [0.90, 0.45, 0.05],    // burnt orange
        [0.98, 0.65, 0.30],    // medium orange
        [0.80, 0.35, 0.00],    // dark amber
        [0.95, 0.75, 0.50],    // warm peach
        [0.98, 0.82, 0.62],    // light peach
        [0.95, 0.85, 0.70],    // pale cream
        [1.00, 0.92, 0.80],    // cream
        [1.00, 0.98, 0.92]     // near white
    ];

    var Palette = {
        colors: [],
        _baseHue: 0,

        init: function(){
            for(var i = 0; i < NUM_SWATCHES; i++) {
                this.colors.push(defaultColors[i].slice());
            }
        },

        _random: function(){ return [Math.random(), Math.random(), Math.random()]; },

        _hsv: function(h, s, v){
            var r,g,b, i=Math.floor(h*6), f=h*6-i;
            var p=v*(1-s), q=v*(1-f*s), t=v*(1-(1-f)*s);
            switch(i%6){
                case 0:r=v;g=t;b=p;break; case 1:r=q;g=v;b=p;break;
                case 2:r=p;g=v;b=t;break; case 3:r=p;g=q;b=v;break;
                case 4:r=t;g=p;b=v;break; case 5:r=v;g=p;b=q;break;
            }
            return [r,g,b];
        },

        _clamp: function(c){
            return [
                Math.max(0,Math.min(1,c[0])),
                Math.max(0,Math.min(1,c[1])),
                Math.max(0,Math.min(1,c[2]))
            ];
        },

        _adjust: function(c, temp, sat){
            if(temp > 0){ c[0]=Math.min(1,c[0]+temp*0.22); c[2]=Math.max(0,c[2]-temp*0.22); }
            else if(temp < 0){ c[0]=Math.max(0,c[0]+temp*0.22); c[2]=Math.min(1,c[2]-temp*0.22); }
            if(sat !== 0){
                var avg=(c[0]+c[1]+c[2])/3;
                c[0]=Math.max(0,Math.min(1,avg+(c[0]-avg)*(1+sat)));
                c[1]=Math.max(0,Math.min(1,avg+(c[1]-avg)*(1+sat)));
                c[2]=Math.max(0,Math.min(1,avg+(c[2]-avg)*(1+sat)));
            }
            return this._clamp(c);
        },

        _one: function(mode){
            var h = this._baseHue;
            switch(mode){
                case "Pastel":    return [Math.random()*0.35+0.6, Math.random()*0.35+0.6, Math.random()*0.35+0.6];
                case "Dark":      return [Math.random()*0.32, Math.random()*0.32, Math.random()*0.32];
                case "Neon":
                    var ni=Math.floor(Math.random()*3), nc=[0,0,0];
                    nc[ni]=Math.random()*0.2+0.8; nc[(ni+1)%3]=Math.random()*0.2; nc[(ni+2)%3]=Math.random()*0.4+0.5;
                    return nc;
                case "Sunset":    return [Math.random()*0.3+0.65, Math.random()*0.45+0.05, Math.random()*0.25];
                case "Ocean":     return [Math.random()*0.15, Math.random()*0.35+0.45, Math.random()*0.35+0.5];
                case "Earth":     return [Math.random()*0.3+0.28, Math.random()*0.18+0.18, Math.random()*0.12+0.05];
                case "Fire":      var ft=Math.random(); return [0.8+Math.random()*0.2, ft*0.55, ft*0.08];
                case "Cyberpunk":
                    var cpPool=[[0.8,0,0.9],[0,0.9,0.95],[0.9,0,0.55],[0.25,0,1],[0,0.8,0.4]];
                    var cp=cpPool[Math.floor(Math.random()*cpPool.length)];
                    return [cp[0]*0.7+Math.random()*cp[0]*0.3, cp[1]*0.7+Math.random()*cp[1]*0.3, cp[2]*0.7+Math.random()*cp[2]*0.3];
                case "Mono":      return this._hsv(h, Math.random()*0.4+0.5, Math.random()*0.5+0.3);
                case "Complement":
                    return this._hsv((Math.random()>0.5?h:(h+0.5)%1), Math.random()*0.3+0.6, Math.random()*0.4+0.45);
                case "Analogous": return this._hsv((h+(Math.random()-0.5)*0.12+1)%1, Math.random()*0.3+0.6, Math.random()*0.3+0.55);
                case "Triadic":   return this._hsv((h+Math.floor(Math.random()*3)/3)%1, Math.random()*0.3+0.6, Math.random()*0.3+0.55);
                case "Gold":      return [Math.random()*0.1+0.85, Math.random()*0.2+0.6, Math.random()*0.1];
                default:          return this._random();
            }
        },

        generate: function(mode, temp, sat){
            this._baseHue = Math.random();
            for(var i = 0; i < NUM_SWATCHES; i++){
                if(!locked[i]) this.colors[i] = this._adjust(this._one(mode), temp, sat);
            }
        },

        toHex: function(c){
            function h(n){ var x=Math.round(n*255).toString(16); return x.length===1?"0"+x:x; }
            return "#"+h(c[0])+h(c[1])+h(c[2]);
        }
    };

    Palette.init();

    // ============================================================
    //  UI: PALETTE
    // ============================================================
    var panelPalette = win.add("panel", undefined, " Color Palette");
    panelPalette.orientation = "column";
    panelPalette.alignChildren = ["fill","top"];
    panelPalette.spacing = 5;

    var rowMode = panelPalette.add("group");
    rowMode.orientation = "row";
    rowMode.alignChildren = ["fill","center"];
    var modeDD = rowMode.add("dropdownlist", undefined,
        ["Random","Pastel","Dark","Neon","Sunset","Ocean","Earth","Fire","Cyberpunk","Mono","Complement","Analogous","Triadic","Gold"]);
    modeDD.selection = 4; // Sunset default
    var btnShuffle = rowMode.add("button", undefined, "Shuffle");
    btnShuffle.preferredSize.width = 70;

    var rowSwatches = panelPalette.add("group");
    rowSwatches.orientation = "row";
    rowSwatches.alignChildren = ["center","top"];
    var swatches = [], lockBtns = [];

    // Make 10 swatches nicely
    for(var si = 0; si < NUM_SWATCHES; si++){
        var sc = rowSwatches.add("group");
        sc.orientation = "column";
        sc.alignChildren = ["center","top"];
        sc.spacing = 1;
        var sw = sc.add("panel", undefined, "");
        sw.preferredSize = [22, 22];
        swatches.push(sw);
        var lb = sc.add("button", undefined, "o");
        lb.preferredSize = [22, 14];
        lockBtns.push(lb);
        (function(idx){
            sw.addEventListener("mousedown", function(e){
                var c = Palette.colors[idx];
                var decColor = (Math.round(c[0]*255) << 16) + (Math.round(c[1]*255) << 8) + Math.round(c[2]*255);
                var newColor = $.colorPicker(decColor);
                if (newColor !== -1) {
                    var r = (newColor >> 16) & 0xFF;
                    var g = (newColor >> 8) & 0xFF;
                    var b = newColor & 0xFF;
                    Palette.colors[idx] = [r/255, g/255, b/255];
                    updateSwatches();
                    if(typeof updateColors === "function") updateColors();
                }
            });
            lb.onClick = function(){
                locked[idx] = !locked[idx];
                lb.text = locked[idx] ? "X" : "o";
                lb.helpTip = locked[idx] ? "Locked" : "Unlocked";
            };
        })(si);
    }

    // ============================================================
    //  UI: SETTINGS
    // ============================================================
    var panelSettings = win.add("panel", undefined, " SilkFlare Settings");
    panelSettings.orientation = "column";
    panelSettings.alignChildren = ["fill","top"];
    panelSettings.spacing = 5;

    var rowShape = panelSettings.add("group");
    rowShape.orientation = "row";
    rowShape.alignChildren = ["fill","center"];
    rowShape.add("statictext", undefined, "Matte Shape:");
    var shapeTypes = ["4-Point Star (Default)", "5-Point Star", "Hexagon", "Circle", "Oval", "Square", "Rectangle"];
    var shapeDD = rowShape.add("dropdownlist", undefined, shapeTypes);
    shapeDD.selection = 0;

    var rowWave = panelSettings.add("group");
    rowWave.orientation = "row";
    rowWave.alignChildren = ["fill","center"];
    rowWave.add("statictext", undefined, "Wave Type:");
    var waveTypes = ["Sine", "Square", "Triangle", "Sawtooth", "Circle", "Semicircle", "Smooth Noise"];
    var waveDD = rowWave.add("dropdownlist", undefined, waveTypes);
    waveDD.selection = 5; // Semicircle

    function makeSliderGroup(parent, label, min, max, val) {
        var grp = parent.add("group");
        grp.orientation = "row";
        grp.alignChildren = ["left","center"];
        var st = grp.add("statictext", undefined, label);
        st.preferredSize.width = 75;
        var sld = grp.add("slider", undefined, val, min, max);
        sld.preferredSize.width = 120;
        var txt = grp.add("edittext", undefined, Math.round(val).toString());
        txt.preferredSize.width = 45;
        sld.onChanging = function() { txt.text = Math.round(sld.value).toString(); if(typeof updateWave === "function") updateWave(); }
        txt.onChange = function() { sld.value = parseFloat(txt.text) || 0; if(typeof updateWave === "function") updateWave(); }
        return { sld: sld, txt: txt };
    }

    var slHeight = makeSliderGroup(panelSettings, "Wave Height:", -500, 500, -164);
    var slWidth = makeSliderGroup(panelSettings, "Wave Width:", 1, 500, 49);
    var slAngle = makeSliderGroup(panelSettings, "Wave Angle:", 0, 360, 308);

    shapeDD.onChange = function() { if(typeof updateMatteShape === "function") updateMatteShape(); }
    waveDD.onChange = function() { if(typeof updateWave === "function") updateWave(); }

    var btnGenerate = win.add("button", undefined, "Generate SilkFlare Gradient");
    btnGenerate.preferredSize.height = 30;

    // Footer
    var rowFooter = win.add("group");
    rowFooter.orientation = "row";
    rowFooter.alignment = "left";
    rowFooter.add("statictext", undefined, "SilkFlare UI  |  Made by Ehtishaam Shaikh");

    // ============================================================
    //  SWATCH UPDATE
    // ============================================================
    function updateSwatches(){
        for(var i = 0; i < swatches.length; i++){
            var c = Palette.colors[i];
            swatches[i].graphics.backgroundColor = swatches[i].graphics.newBrush(
                swatches[i].graphics.BrushType.SOLID_COLOR, c);
            swatches[i].helpTip = Palette.toHex(c) + (locked[i] ? " [LOCKED]" : "");
        }
        try{ win.update(); }catch(e){}
    }

    btnShuffle.onClick = function(){
        var mode = modeDD.selection ? modeDD.selection.text : "Random";
        Palette.generate(mode, 0, 0);
        updateSwatches();
        if(typeof updateColors === "function") updateColors();
    };

    updateSwatches();

    // ============================================================
    //  HELPER: Safe Effect Add
    // ============================================================
    function addEffect(layer, names){
        for(var i = 0; i < names.length; i++){
            try{ var ef = layer.Effects.addProperty(names[i]); if(ef) return ef; }catch(e){}
        }
        return null;
    }

    // ============================================================
    //  REALTIME UPDATE LOGIC
    // ============================================================
    function updateColors() {
        if (!activeContext.blobFills || activeContext.blobFills.length === 0) return;
        try { activeContext.blobFills[0].name; } catch(e) { return; }
        app.beginUndoGroup("Update Colors");
        for (var i = 0; i < activeContext.blobFills.length; i++) {
            var fill = activeContext.blobFills[i];
            var cIdx = activeContext.blobColorIndices[i];
            try{ fill.property("Color").setValue(Palette.colors[cIdx]); }catch(e){
                try{ fill.property(4).setValue(Palette.colors[cIdx]); }catch(e2){}
            }
        }
        app.endUndoGroup();
    }

    function updateMatteShape() {
        if (!activeContext.shapeGrpContents) return;
        try { activeContext.shapeGrpContents.numProperties; } catch(e) { return; }
        app.beginUndoGroup("Update Shape");
        for(var i=activeContext.shapeGrpContents.numProperties; i>0; i--) {
            var prop = activeContext.shapeGrpContents.property(i);
            if(prop.matchName !== "ADBE Vector Graphic - Fill") {
                prop.remove();
            }
        }
        var shapeStr = shapeDD.selection ? shapeDD.selection.text : "4-Point Star (Default)";
        var path;
        if(shapeStr.indexOf("Star") !== -1 || shapeStr === "Hexagon"){
            path = activeContext.shapeGrpContents.addProperty("ADBE Vector Shape - Star");
            var typeVal = (shapeStr === "Hexagon") ? 1 : 2;
            var pointsVal = 4;
            if(shapeStr === "5-Point Star") pointsVal = 5;
            if(shapeStr === "Hexagon") pointsVal = 6;
            try{ path.property("Type").setValue(typeVal); }catch(e){ try{ path.property(1).setValue(typeVal); }catch(e2){} }
            try{ path.property("Points").setValue(pointsVal); }catch(e){ try{ path.property(2).setValue(pointsVal); }catch(e2){} }
            try{ path.property("Outer Radius").setValue(406); }catch(e){ try{ path.property(5).setValue(406); }catch(e2){} }
            if(typeVal === 2){
                var inRad = (shapeStr === "5-Point Star") ? 155 : 203;
                try{ path.property("Inner Radius").setValue(inRad); }catch(e){ try{ path.property(7).setValue(inRad); }catch(e2){} }
            }
        } else if(shapeStr === "Circle" || shapeStr === "Oval"){
            path = activeContext.shapeGrpContents.addProperty("ADBE Vector Shape - Ellipse");
            var sz = (shapeStr === "Circle") ? [812, 812] : [1000, 600];
            try{ path.property("Size").setValue(sz); }catch(e){ try{ path.property(2).setValue(sz); }catch(e2){} }
        } else if(shapeStr === "Square" || shapeStr === "Rectangle"){
            path = activeContext.shapeGrpContents.addProperty("ADBE Vector Shape - Rect");
            var sz2 = (shapeStr === "Square") ? [812, 812] : [1000, 600];
            try{ path.property("Size").setValue(sz2); }catch(e){ try{ path.property(2).setValue(sz2); }catch(e2){} }
        }
        
        var fillIdx = 1;
        for(var i=1; i<=activeContext.shapeGrpContents.numProperties; i++){
            if(activeContext.shapeGrpContents.property(i).matchName === "ADBE Vector Graphic - Fill"){
                fillIdx = i; break;
            }
        }
        if(path.propertyIndex > fillIdx) path.moveTo(fillIdx);
        app.endUndoGroup();
    }

    function updateWave() {
        if (!activeContext.waveWarp) return;
        try { activeContext.waveWarp.name; } catch(e) { return; }
        app.beginUndoGroup("Update Wave");
        var wIdx = waveDD.selection ? waveDD.selection.index + 1 : 6;
        try{ activeContext.waveWarp.property(1).setValue(wIdx); }catch(e){ try{ activeContext.waveWarp.property("Wave Type").setValue(wIdx); }catch(e2){} }
        var h = parseFloat(slHeight.txt.text) || 0;
        try{ activeContext.waveWarp.property(2).setValue(h); }catch(e){ try{ activeContext.waveWarp.property("Wave Height").setValue(h); }catch(e2){} }
        var w = parseFloat(slWidth.txt.text) || 1;
        try{ activeContext.waveWarp.property(3).setValue(w); }catch(e){ try{ activeContext.waveWarp.property("Wave Width").setValue(w); }catch(e2){} }
        var a = parseFloat(slAngle.txt.text) || 0;
        try{ activeContext.waveWarp.property(4).setValue(a); }catch(e){ try{ activeContext.waveWarp.property("Direction").setValue(a); }catch(e2){} }
        app.endUndoGroup();
    }

    // ============================================================
    //  GENERATION LOGIC
    // ============================================================
    btnGenerate.onClick = function(){
        activeContext.blobFills = [];
        activeContext.blobColorIndices = [];
        activeContext.shapeGrpContents = null;
        activeContext.waveWarp = null;

        app.beginUndoGroup("Create SilkFlare Gradient");

        var proj = app.project;
        if(!proj) proj = app.newProject();

        var compW = 1920;
        var compH = 1080;
        var duration = 10;
        var fps = 30;

        // Colors
        var blobColors = [];
        for(var i=0; i<NUM_SWATCHES; i++) blobColors.push(Palette.colors[i]);

        // ============================================================
        // 1. BLOB COMP
        // ============================================================
        var blobComp = proj.items.addComp("SilkFlare - Blobs", compW, compH, 1, duration, fps);
        var numBlobs = 28;
        for(var bi = 0; bi < numBlobs; bi++){
            var blobLayer = blobComp.layers.addShape();
            blobLayer.name = "Blob " + (bi + 1);
            var contents = blobLayer.property("Contents");
            var grp = contents.addProperty("ADBE Vector Group");
            grp.name = "Circle";
            var grpContents = grp.property("Contents");

            var ellipse = grpContents.addProperty("ADBE Vector Shape - Ellipse");
            var blobSize = 400 + Math.random() * 500;
            try{ ellipse.property("Size").setValue([blobSize, blobSize]); }catch(e){
                try{ ellipse.property(2).setValue([blobSize, blobSize]); }catch(e2){}
            }

            var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
            var cIdx = Math.floor(Math.random() * blobColors.length);
            activeContext.blobFills.push(fill);
            activeContext.blobColorIndices.push(cIdx);
            try{ fill.property("Color").setValue(blobColors[cIdx]); }catch(e){
                try{ fill.property(4).setValue(blobColors[cIdx]); }catch(e2){}
            }

            var bx = (compW * -0.1) + Math.random() * (compW * 1.2);
            var by = (compH * -0.1) + Math.random() * (compH * 1.2);
            blobLayer.property("Transform").property("Position").setValue([bx, by]);
        }

        // ============================================================
        // 2. MATTE COMP
        // ============================================================
        var starComp = proj.items.addComp("SilkFlare - Matte", compW, compH, 1, duration, fps);
        var blobInStar = starComp.layers.add(blobComp);
        blobInStar.name = "Color Blobs";

        var blobBlur = addEffect(blobInStar, ["ADBE Box Blur2", "ADBE Fast Box Blur", "Fast Box Blur", "ADBE Gaussian Blur 2"]);
        if(blobBlur){
            try{ blobBlur.property(1).setValue(63); }catch(e){}
            try{ blobBlur.property(2).setValue(3); }catch(e){}
            try{ blobBlur.property(4).setValue(true); }catch(e){}
        }

        var shapeLayer = starComp.layers.addShape();
        shapeLayer.name = "Matte Shape";
        var shapeContents = shapeLayer.property("Contents");
        var shapeGrp = shapeContents.addProperty("ADBE Vector Group");
        shapeGrp.name = "Shape";
        var shapeGrpContents = shapeGrp.property("Contents");
        activeContext.shapeGrpContents = shapeGrpContents;

        var shapeStr = shapeDD.selection ? shapeDD.selection.text : "4-Point Star (Default)";
        var path;

        if(shapeStr.indexOf("Star") !== -1 || shapeStr === "Hexagon"){
            path = shapeGrpContents.addProperty("ADBE Vector Shape - Star");
            var typeVal = (shapeStr === "Hexagon") ? 1 : 2; // 1=Polygon, 2=Star
            var pointsVal = 4;
            if(shapeStr === "5-Point Star") pointsVal = 5;
            if(shapeStr === "Hexagon") pointsVal = 6;

            try{ path.property("Type").setValue(typeVal); }catch(e){ try{ path.property(1).setValue(typeVal); }catch(e2){} }
            try{ path.property("Points").setValue(pointsVal); }catch(e){ try{ path.property(2).setValue(pointsVal); }catch(e2){} }
            try{ path.property("Outer Radius").setValue(406); }catch(e){ try{ path.property(5).setValue(406); }catch(e2){} }
            if(typeVal === 2){
                var inRad = (shapeStr === "5-Point Star") ? 155 : 203;
                try{ path.property("Inner Radius").setValue(inRad); }catch(e){ try{ path.property(7).setValue(inRad); }catch(e2){} }
            }
        } else if(shapeStr === "Circle" || shapeStr === "Oval"){
            path = shapeGrpContents.addProperty("ADBE Vector Shape - Ellipse");
            var sz = (shapeStr === "Circle") ? [812, 812] : [1000, 600];
            try{ path.property("Size").setValue(sz); }catch(e){ try{ path.property(2).setValue(sz); }catch(e2){} }
        } else if(shapeStr === "Square" || shapeStr === "Rectangle"){
            path = shapeGrpContents.addProperty("ADBE Vector Shape - Rect");
            var sz2 = (shapeStr === "Square") ? [812, 812] : [1000, 600];
            try{ path.property("Size").setValue(sz2); }catch(e){ try{ path.property(2).setValue(sz2); }catch(e2){} }
        }

        var shapeFill = shapeGrpContents.addProperty("ADBE Vector Graphic - Fill");
        try{ shapeFill.property("Color").setValue([1, 1, 1]); }catch(e){ try{ shapeFill.property(4).setValue([1, 1, 1]); }catch(e2){} }

        shapeLayer.property("Transform").property("Position").setValue([compW / 2, compH / 2]);
        try{ shapeLayer.property("Transform").property("Rotation").expression = "time * 10"; }catch(e){}

        shapeLayer.moveBefore(blobInStar);
        try{ blobInStar.trackMatteType = TrackMatteType.ALPHA; }catch(e){
            try{ blobInStar.setTrackMatte(shapeLayer, TrackMatteType.ALPHA); }catch(e2){}
        }

        // ============================================================
        // 3. FINAL COMP
        // ============================================================
        var finalComp = proj.items.addComp("SilkFlare Gradient", compW, compH, 1, duration, fps);
        var finalLayer = finalComp.layers.add(starComp);
        finalLayer.name = "Matte Comp";

        var finalBlur = addEffect(finalLayer, ["ADBE Box Blur2", "ADBE Fast Box Blur", "Fast Box Blur", "ADBE Gaussian Blur 2"]);
        if(finalBlur){
            try{ finalBlur.property(1).setValue(45); }catch(e){}
            try{ finalBlur.property(2).setValue(3); }catch(e){}
            try{ finalBlur.property(4).setValue(true); }catch(e){}
        }

        var waveWarp = addEffect(finalLayer, ["ADBE Wave Warp", "Wave Warp", "ADBE Wave Warp2"]);
        if(waveWarp){
            activeContext.waveWarp = waveWarp;
            var wIdx = waveDD.selection ? waveDD.selection.index + 1 : 6;
            try{ waveWarp.property(1).setValue(wIdx); }catch(e){ try{ waveWarp.property("Wave Type").setValue(wIdx); }catch(e2){} }
            var h = parseFloat(slHeight.txt.text) || -164;
            try{ waveWarp.property(2).setValue(h); }catch(e){ try{ waveWarp.property("Wave Height").setValue(h); }catch(e2){} }
            var w = parseFloat(slWidth.txt.text) || 49;
            try{ waveWarp.property(3).setValue(w); }catch(e){ try{ waveWarp.property("Wave Width").setValue(w); }catch(e2){} }
            var a = parseFloat(slAngle.txt.text) || 308;
            try{ waveWarp.property(4).setValue(a); }catch(e){ try{ waveWarp.property("Direction").setValue(a); }catch(e2){} }
            try{ waveWarp.property(5).setValue(0.3); }catch(e){ try{ waveWarp.property("Wave Speed").setValue(0.3); }catch(e2){} }
            try{ waveWarp.property(6).setValue(1); }catch(e){ try{ waveWarp.property("Pinning").setValue(1); }catch(e2){} }
            try{ waveWarp.property(7).setValue(0); }catch(e){ try{ waveWarp.property("Phase").setValue(0); }catch(e2){} }
        }

        var optics = addEffect(finalLayer, ["ADBE Optics Compensation", "Optics Compensation"]);
        if(optics){
            try{ optics.property(1).setValue(145.2); }catch(e){ try{ optics.property("Field Of View (FOV)").setValue(145.2); }catch(e2){} }
            try{ optics.property(2).setValue(true); }catch(e){ try{ optics.property("Reverse Lens Distortion").setValue(true); }catch(e2){} }
            try{ optics.property(3).setValue(1); }catch(e){ try{ optics.property("FOV Orientation").setValue(1); }catch(e2){} }
            try{ optics.property(4).setValue([compW / 2, compH / 2]); }catch(e){ try{ optics.property("View Center").setValue([compW / 2, compH / 2]); }catch(e2){} }
        }

        finalComp.openInViewer();

        app.endUndoGroup();

        alert("SilkFlare Gradient created!\n\nShapes: " + shapeStr + "\nWave: " + (waveDD.selection ? waveDD.selection.text : "Semicircle") + "\n\nPress spacebar to preview!");
    };

    win.layout.layout(true);

})(this);
