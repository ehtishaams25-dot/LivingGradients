/**
 * ============================================================
 *  SILKFLARE GRADIENT GENERATOR  v2
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
    //  PRESETS
    //  Each preset locks in: waveType, waveHeight, waveWidth,
    //  blurRadius, and FOV. User only tweaks Speed + Direction.
    // ============================================================
    //  Wave Type index map (AE internal):
    //  1=Sine  2=Square  3=Triangle  4=Sawtooth
    //  5=Circle  6=Semicircle  7=Smooth Noise
    var PRESETS = {
        "Silk":   { waveType:6, waveHeight:-164, waveWidth:49,  blur:45, fov:145.2, speedDefault:0.3 },
        "Aurora": { waveType:1, waveHeight:113,  waveWidth:105, blur:60, fov:145.2, speedDefault:0.2 },
        "Prism":  { waveType:4, waveHeight:73,   waveWidth:31,  blur:30, fov:145.9, speedDefault:0.3 },
        "Fiber":  { waveType:3, waveHeight:694,  waveWidth:20,  blur:98, fov:150.4, speedDefault:1.4 },
        "Veil":   { waveType:7, waveHeight:200,  waveWidth:150, blur:80, fov:145.2, speedDefault:0.15},
        "Pulse":  { waveType:5, waveHeight:300,  waveWidth:60,  blur:40, fov:145.2, speedDefault:0.6 },
        "Comet":  { waveType:6, waveHeight:-300, waveWidth:20,  blur:70, fov:145.2, speedDefault:0.5 }
    };

    var PRESET_NAMES = ["Silk", "Aurora", "Prism", "Fiber", "Veil", "Pulse", "Comet"];

    function getPreset(){
        var name = presetDD.selection ? presetDD.selection.text : "Silk";
        return PRESETS[name] || PRESETS["Silk"];
    }

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
        [0.85, 0.40, 0.00],
        [0.95, 0.55, 0.10],
        [0.90, 0.45, 0.05],
        [0.98, 0.65, 0.30],
        [0.80, 0.35, 0.00],
        [0.95, 0.75, 0.50],
        [0.98, 0.82, 0.62],
        [0.95, 0.85, 0.70],
        [1.00, 0.92, 0.80],
        [1.00, 0.98, 0.92]
    ];

    var Palette = {
        colors: [],
        _baseHue: 0,

        init: function(){
            for(var i = 0; i < NUM_SWATCHES; i++){
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
    //  UI: COLOR PALETTE  (unchanged)
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
                if(newColor !== -1){
                    var r = (newColor >> 16) & 0xFF;
                    var g = (newColor >> 8)  & 0xFF;
                    var b =  newColor        & 0xFF;
                    Palette.colors[idx] = [r/255, g/255, b/255];
                    updateSwatches();
                    if(typeof updateColors === "function") updateColors();
                }
            });
            lb.onClick = function(){
                locked[idx] = !locked[idx];
                lb.text    = locked[idx] ? "X" : "o";
                lb.helpTip = locked[idx] ? "Locked" : "Unlocked";
            };
        })(si);
    }

    // ============================================================
    //  UI: SILKFLARE SETTINGS  (rebuilt — presets only)
    // ============================================================
    var panelSettings = win.add("panel", undefined, " SilkFlare Settings");
    panelSettings.orientation = "column";
    panelSettings.alignChildren = ["fill","top"];
    panelSettings.spacing = 6;

    // --- Preset ---
    var rowPreset = panelSettings.add("group");
    rowPreset.orientation = "row";
    rowPreset.alignChildren = ["fill","center"];
    var lblPreset = rowPreset.add("statictext", undefined, "Preset:");
    lblPreset.preferredSize.width = 75;
    var presetDD = rowPreset.add("dropdownlist", undefined, PRESET_NAMES);
    presetDD.selection = 0; // Silk

    // --- Matte Shape (still useful, stays) ---
    var rowShape = panelSettings.add("group");
    rowShape.orientation = "row";
    rowShape.alignChildren = ["fill","center"];
    var lblShape = rowShape.add("statictext", undefined, "Shape:");
    lblShape.preferredSize.width = 75;
    var shapeTypes = ["4-Point Star (Default)", "5-Point Star", "Hexagon", "Circle", "Oval", "Square", "Rectangle"];
    var shapeDD = rowShape.add("dropdownlist", undefined, shapeTypes);
    shapeDD.selection = 0;

    // --- Speed ---
    var rowSpeed = panelSettings.add("group");
    rowSpeed.orientation = "row";
    rowSpeed.alignChildren = ["left","center"];
    var lblSpeed = rowSpeed.add("statictext", undefined, "Speed:");
    lblSpeed.preferredSize.width = 75;
    var sldSpeed = rowSpeed.add("slider", undefined, 0.3, 0.05, 3.0);
    sldSpeed.preferredSize.width = 120;
    var txtSpeed = rowSpeed.add("edittext", undefined, "0.3");
    txtSpeed.preferredSize.width = 45;

    // --- Direction ---
    var rowDir = panelSettings.add("group");
    rowDir.orientation = "row";
    rowDir.alignChildren = ["left","center"];
    var lblDir = rowDir.add("statictext", undefined, "Direction:");
    lblDir.preferredSize.width = 75;
    var sldDir = rowDir.add("slider", undefined, 163, 0, 360);
    sldDir.preferredSize.width = 120;
    var txtDir = rowDir.add("edittext", undefined, "163");
    txtDir.preferredSize.width = 45;

    // Sync slider <-> text
    sldSpeed.onChanging = function(){
        txtSpeed.text = (Math.round(sldSpeed.value * 100) / 100).toString();
        if(typeof updateWave === "function") updateWave();
    };
    txtSpeed.onChange = function(){
        var v = parseFloat(txtSpeed.text) || 0.3;
        sldSpeed.value = v;
        if(typeof updateWave === "function") updateWave();
    };

    sldDir.onChanging = function(){
        txtDir.text = Math.round(sldDir.value).toString();
        if(typeof updateWave === "function") updateWave();
    };
    txtDir.onChange = function(){
        sldDir.value = parseFloat(txtDir.text) || 0;
        if(typeof updateWave === "function") updateWave();
    };

    // When preset changes, snap Speed to that preset's default
    presetDD.onChange = function(){
        var p = getPreset();
        sldSpeed.value = p.speedDefault;
        txtSpeed.text  = (Math.round(p.speedDefault * 100) / 100).toString();
        if(typeof updateWave === "function") updateWave();
    };

    shapeDD.onChange = function(){ if(typeof updateMatteShape === "function") updateMatteShape(); };

    var btnGenerate = win.add("button", undefined, "Generate SilkFlare Gradient");
    btnGenerate.preferredSize.height = 30;

    // Footer
    var rowFooter = win.add("group");
    rowFooter.orientation = "row";
    rowFooter.alignment = "left";
    rowFooter.add("statictext", undefined, "SilkFlare  v2  |  Made by Ehtishaam Shaikh");

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
    function updateColors(){
        if(!activeContext.blobFills || activeContext.blobFills.length === 0) return;
        try{ activeContext.blobFills[0].name; }catch(e){ return; }
        app.beginUndoGroup("Update Colors");
        for(var i = 0; i < activeContext.blobFills.length; i++){
            var fill = activeContext.blobFills[i];
            var cIdx = activeContext.blobColorIndices[i];
            try{ fill.property("Color").setValue(Palette.colors[cIdx]); }catch(e){
                try{ fill.property(4).setValue(Palette.colors[cIdx]); }catch(e2){}
            }
        }
        app.endUndoGroup();
    }

    function updateMatteShape(){
        if(!activeContext.shapeGrpContents) return;
        try{ activeContext.shapeGrpContents.numProperties; }catch(e){ return; }
        app.beginUndoGroup("Update Shape");
        for(var i=activeContext.shapeGrpContents.numProperties; i>0; i--){
            var prop = activeContext.shapeGrpContents.property(i);
            if(prop.matchName !== "ADBE Vector Graphic - Fill") prop.remove();
        }
        var shapeStr = shapeDD.selection ? shapeDD.selection.text : "4-Point Star (Default)";
        var path;
        if(shapeStr.indexOf("Star") !== -1 || shapeStr === "Hexagon"){
            path = activeContext.shapeGrpContents.addProperty("ADBE Vector Shape - Star");
            var typeVal = (shapeStr === "Hexagon") ? 1 : 2;
            var pointsVal = 4;
            if(shapeStr === "5-Point Star") pointsVal = 5;
            if(shapeStr === "Hexagon")      pointsVal = 6;
            try{ path.property("Type").setValue(typeVal);     }catch(e){ try{ path.property(1).setValue(typeVal);     }catch(e2){} }
            try{ path.property("Points").setValue(pointsVal); }catch(e){ try{ path.property(2).setValue(pointsVal);   }catch(e2){} }
            try{ path.property("Outer Radius").setValue(406); }catch(e){ try{ path.property(5).setValue(406);         }catch(e2){} }
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
            if(activeContext.shapeGrpContents.property(i).matchName === "ADBE Vector Graphic - Fill"){ fillIdx = i; break; }
        }
        if(path && path.propertyIndex > fillIdx) path.moveTo(fillIdx);
        app.endUndoGroup();
    }

    function updateWave(){
        if(!activeContext.waveWarp) return;
        try{ activeContext.waveWarp.name; }catch(e){ return; }
        var p = getPreset();
        app.beginUndoGroup("Update Wave");
        // Type, Height, Width locked from preset
        try{ activeContext.waveWarp.property(1).setValue(p.waveType);   }catch(e){ try{ activeContext.waveWarp.property("Wave Type").setValue(p.waveType);   }catch(e2){} }
        try{ activeContext.waveWarp.property(2).setValue(p.waveHeight); }catch(e){ try{ activeContext.waveWarp.property("Wave Height").setValue(p.waveHeight);}catch(e2){} }
        try{ activeContext.waveWarp.property(3).setValue(p.waveWidth);  }catch(e){ try{ activeContext.waveWarp.property("Wave Width").setValue(p.waveWidth);  }catch(e2){} }
        // Direction from slider
        var dir = parseFloat(txtDir.text) || 0;
        try{ activeContext.waveWarp.property(4).setValue(dir);  }catch(e){ try{ activeContext.waveWarp.property("Direction").setValue(dir);   }catch(e2){} }
        // Speed from slider
        var spd = parseFloat(txtSpeed.text) || 0.3;
        try{ activeContext.waveWarp.property(5).setValue(spd);  }catch(e){ try{ activeContext.waveWarp.property("Wave Speed").setValue(spd);  }catch(e2){} }
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

        var p = getPreset();

        var compW    = 1920;
        var compH    = 1080;
        var duration = 10;
        var fps      = 30;

        var blobColors = [];
        for(var i=0; i<NUM_SWATCHES; i++) blobColors.push(Palette.colors[i]);

        // --------------------------------------------------------
        // 1. BLOB COMP
        // --------------------------------------------------------
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

        // --------------------------------------------------------
        // 2. MATTE COMP
        // --------------------------------------------------------
        var starComp   = proj.items.addComp("SilkFlare - Matte", compW, compH, 1, duration, fps);
        var blobInStar = starComp.layers.add(blobComp);
        blobInStar.name = "Color Blobs";

        var blobBlur = addEffect(blobInStar, ["ADBE Box Blur2", "ADBE Fast Box Blur", "Fast Box Blur", "ADBE Gaussian Blur 2"]);
        if(blobBlur){
            try{ blobBlur.property(1).setValue(63);   }catch(e){}
            try{ blobBlur.property(2).setValue(3);    }catch(e){}
            try{ blobBlur.property(4).setValue(true); }catch(e){}
        }

        var shapeLayer   = starComp.layers.addShape();
        shapeLayer.name  = "Matte Shape";
        var shapeContents    = shapeLayer.property("Contents");
        var shapeGrp         = shapeContents.addProperty("ADBE Vector Group");
        shapeGrp.name        = "Shape";
        var shapeGrpContents = shapeGrp.property("Contents");
        activeContext.shapeGrpContents = shapeGrpContents;

        var shapeStr = shapeDD.selection ? shapeDD.selection.text : "4-Point Star (Default)";
        var path;

        if(shapeStr.indexOf("Star") !== -1 || shapeStr === "Hexagon"){
            path = shapeGrpContents.addProperty("ADBE Vector Shape - Star");
            var typeVal = (shapeStr === "Hexagon") ? 1 : 2;
            var pointsVal = 4;
            if(shapeStr === "5-Point Star") pointsVal = 5;
            if(shapeStr === "Hexagon")      pointsVal = 6;
            try{ path.property("Type").setValue(typeVal);     }catch(e){ try{ path.property(1).setValue(typeVal);   }catch(e2){} }
            try{ path.property("Points").setValue(pointsVal); }catch(e){ try{ path.property(2).setValue(pointsVal); }catch(e2){} }
            try{ path.property("Outer Radius").setValue(406); }catch(e){ try{ path.property(5).setValue(406);       }catch(e2){} }
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

        // --------------------------------------------------------
        // 3. FINAL COMP
        // --------------------------------------------------------
        var finalComp  = proj.items.addComp("SilkFlare Gradient", compW, compH, 1, duration, fps);
        var finalLayer = finalComp.layers.add(starComp);
        finalLayer.name = "Matte Comp";

        // Blur radius from preset
        var finalBlur = addEffect(finalLayer, ["ADBE Box Blur2", "ADBE Fast Box Blur", "Fast Box Blur", "ADBE Gaussian Blur 2"]);
        if(finalBlur){
            try{ finalBlur.property(1).setValue(p.blur);  }catch(e){}
            try{ finalBlur.property(2).setValue(3);       }catch(e){}
            try{ finalBlur.property(4).setValue(true);    }catch(e){}
        }

        // Wave Warp — type/height/width from preset, speed+direction from sliders
        var waveWarp = addEffect(finalLayer, ["ADBE Wave Warp", "Wave Warp", "ADBE Wave Warp2"]);
        if(waveWarp){
            activeContext.waveWarp = waveWarp;
            try{ waveWarp.property(1).setValue(p.waveType);   }catch(e){ try{ waveWarp.property("Wave Type").setValue(p.waveType);   }catch(e2){} }
            try{ waveWarp.property(2).setValue(p.waveHeight); }catch(e){ try{ waveWarp.property("Wave Height").setValue(p.waveHeight);}catch(e2){} }
            try{ waveWarp.property(3).setValue(p.waveWidth);  }catch(e){ try{ waveWarp.property("Wave Width").setValue(p.waveWidth);  }catch(e2){} }
            var dir = parseFloat(txtDir.text) || 163;
            try{ waveWarp.property(4).setValue(dir);           }catch(e){ try{ waveWarp.property("Direction").setValue(dir);          }catch(e2){} }
            var spd = parseFloat(txtSpeed.text) || p.speedDefault;
            try{ waveWarp.property(5).setValue(spd);           }catch(e){ try{ waveWarp.property("Wave Speed").setValue(spd);         }catch(e2){} }
            try{ waveWarp.property(6).setValue(1);             }catch(e){ try{ waveWarp.property("Pinning").setValue(1);              }catch(e2){} }
            try{ waveWarp.property(7).setValue(0);             }catch(e){ try{ waveWarp.property("Phase").setValue(0);               }catch(e2){} }
        }

        // Optics Compensation — FOV from preset
        var optics = addEffect(finalLayer, ["ADBE Optics Compensation", "Optics Compensation"]);
        if(optics){
            try{ optics.property(1).setValue(p.fov);          }catch(e){ try{ optics.property("Field Of View (FOV)").setValue(p.fov); }catch(e2){} }
            try{ optics.property(2).setValue(true);           }catch(e){ try{ optics.property("Reverse Lens Distortion").setValue(true); }catch(e2){} }
            try{ optics.property(3).setValue(1);              }catch(e){ try{ optics.property("FOV Orientation").setValue(1);         }catch(e2){} }
            try{ optics.property(4).setValue([compW/2,compH/2]); }catch(e){ try{ optics.property("View Center").setValue([compW/2,compH/2]); }catch(e2){} }
        }

        finalComp.openInViewer();
        app.endUndoGroup();

        var presetName = presetDD.selection ? presetDD.selection.text : "Silk";
        alert("SilkFlare Gradient created!\n\nPreset: " + presetName + "\nShape: " + shapeStr + "\nSpeed: " + sldSpeed.value.toFixed(2) + "\nDirection: " + Math.round(sldDir.value) + "°\n\nPress spacebar to preview!");
    };

    win.layout.layout(true);

})(this);
