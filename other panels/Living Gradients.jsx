/**
 * ============================================================
 *  GRADIENT LAB v2 — Premium Edition
 *  Adobe After Effects Dockable Panel Script
 *  Made by Ehtishaam Shaikh | linktr.ee/itsehtishaam
 * ============================================================
 */
(function(thisObj){

    var win = (thisObj instanceof Panel) ? thisObj : null;
    if(!win){ alert("Gradient Lab v2 must be docked as a panel. Go to Window > Gradient_Lab_v2.jsx"); return; }

    win.orientation = "column";
    win.alignChildren = ["fill","fill"];
    win.spacing = 4;

    // ============================================================
    //  GLOBAL STATE
    // ============================================================
    var NUM_SWATCHES = 8;
    var locked = [];
    for(var li = 0; li < NUM_SWATCHES; li++) locked.push(false);

    var Palette = {
        colors: [],
        _baseHue: 0,

        init: function(){
            this._baseHue = Math.random();
            for(var i = 0; i < NUM_SWATCHES; i++) this.colors.push(this._random());
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
            // Temperature shift
            if(temp > 0){ c[0]=Math.min(1,c[0]+temp*0.22); c[2]=Math.max(0,c[2]-temp*0.22); }
            else if(temp < 0){ c[0]=Math.max(0,c[0]+temp*0.22); c[2]=Math.min(1,c[2]-temp*0.22); }
            // Saturation shift
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
        },

        toCSSGradient: function(angle){
            var stops = [];
            for(var i = 0; i < NUM_SWATCHES; i++) stops.push(this.toHex(this.colors[i]));
            return "background: linear-gradient("+Math.round(angle)+"deg, "+stops.join(", ")+");";
        },

        serialize: function(){
            var parts = [];
            for(var i = 0; i < NUM_SWATCHES; i++) parts.push(this.toHex(this.colors[i]));
            return parts.join(",");
        },

        deserialize: function(str){
            var parts = str.split(",");
            for(var i = 0; i < parts.length && i < NUM_SWATCHES; i++){
                var hex = parts[i].replace("#","");
                if(hex.length === 6) this.colors[i] = [parseInt(hex.substr(0,2),16)/255, parseInt(hex.substr(2,2),16)/255, parseInt(hex.substr(4,2),16)/255];
            }
        }
    };

    Palette.init();

    // ============================================================
    //  PRESETS ENGINE (file-based, simple pipe format)
    // ============================================================
    var presetsData = {}; // { name: hexString }
    var presetsFile = new File(Folder.userData.absoluteURI + "/GradientLabV2Presets.txt");

    function loadPresets(){
        presetsData = {};
        if(!presetsFile.exists) return;
        presetsFile.open("r");
        var content = presetsFile.read();
        presetsFile.close();
        var lines = content.split("\n");
        for(var l = 0; l < lines.length; l++){
            var line = lines[l];
            if(!line) continue;
            var sep = line.indexOf("|");
            if(sep < 1) continue;
            var name = line.substring(0, sep);
            var val  = line.substring(sep+1);
            if(name && val) presetsData[name] = val;
        }
    }

    function savePresets(){
        presetsFile.open("w");
        for(var k in presetsData){
            if(presetsData.hasOwnProperty(k)) presetsFile.writeln(k+"|"+presetsData[k]);
        }
        presetsFile.close();
    }

    function refreshPresetDD(){
        presetDD.removeAll();
        for(var k in presetsData){
            if(presetsData.hasOwnProperty(k)) presetDD.add("item", k);
        }
    }

    loadPresets();

    // ============================================================
    //  BLEND MODE MAP
    // ============================================================
    var BLEND_MAP = {
        "Normal": BlendingMode.NORMAL,
        "Screen": BlendingMode.SCREEN,
        "Add": BlendingMode.ADD,
        "Multiply": BlendingMode.MULTIPLY,
        "Overlay": BlendingMode.OVERLAY,
        "Soft Light": BlendingMode.SOFT_LIGHT,
        "Lighten": BlendingMode.LIGHTEN,
        "Color Dodge": BlendingMode.COLOR_DODGE,
        "Hard Light": BlendingMode.HARD_LIGHT
    };

    // ============================================================
    //  HELPER: Apply Color to Layer
    // ============================================================
    function applyColorToLayer(layer, col){
        if(layer instanceof TextLayer){
            try{
                var td = layer.sourceText.value;
                td.fillColor = col;
                layer.sourceText.setValue(td);
                return;
            }catch(e){}
        }
        if(layer instanceof ShapeLayer){
            try{
                layer.property("Contents").property(1).property("Fill 1").property("Color").setValue(col);
                return;
            }catch(e){}
        }
        // AVLayer / Solid — try Fill effect
        try{
            var fill = layer.Effects.addProperty("ADBE Fill");
            if(fill) fill.property("Color").setValue(col);
        }catch(e){}
    }

    // ============================================================
    //  HELPER: Safe Effect Add (tries multiple names)
    // ============================================================
    function addEffect(layer, names){
        for(var i = 0; i < names.length; i++){
            try{ var ef = layer.Effects.addProperty(names[i]); if(ef) return ef; }catch(e){}
        }
        return null;
    }

    // ============================================================
    //  UI: SMART PALETTE PANEL
    // ============================================================
    var panelPalette = win.add("panel", undefined, " Smart Palette");
    panelPalette.orientation = "column";
    panelPalette.alignChildren = ["fill","fill"];
    panelPalette.spacing = 5;

    // Row 1: Mode selector + shuffle
    var rowMode = panelPalette.add("group");
    rowMode.orientation = "row";
    rowMode.alignChildren = ["fill","center"];
    rowMode.add("statictext", undefined, "Mode:");
    var modeDD = rowMode.add("dropdownlist", undefined,
        ["Random","Pastel","Dark","Neon","Sunset","Ocean","Earth","Fire","Cyberpunk","Mono","Complement","Analogous","Triadic","Gold"]);
    modeDD.selection = 0;
    var btnShuffle = rowMode.add("button", undefined, "Shuffle");
    btnShuffle.preferredSize.width = 60;

    // Row 2: Swatches + lock buttons
    var rowSwatches = panelPalette.add("group");
    rowSwatches.orientation = "row";
    rowSwatches.alignChildren = ["center","fill"];
    var swatches = [], lockBtns = [];

    for(var si = 0; si < NUM_SWATCHES; si++){
        var sc = rowSwatches.add("group");
        sc.orientation = "column";
        sc.alignChildren = ["center","fill"];
        sc.spacing = 1;
        var sw = sc.add("panel", undefined, "");
        sw.preferredSize = [28, 26];
        swatches.push(sw);
        var lb = sc.add("button", undefined, "o");
        lb.preferredSize = [28, 14];
        lockBtns.push(lb);
        (function(idx){
            sw.onClick = function(){
                var comp = app.project.activeItem;
                if(!(comp instanceof CompItem)){ alert("Select a composition first."); return; }
                var sel = comp.selectedLayers;
                if(!sel.length){ alert("Select a layer to apply this color."); return; }
                app.beginUndoGroup("Apply Color");
                for(var l = 0; l < sel.length; l++) applyColorToLayer(sel[l], Palette.colors[idx]);
                app.endUndoGroup();
            };
            sw.helpTip = "Click to apply to selected layer";
            lb.onClick = function(){
                locked[idx] = !locked[idx];
                lb.text = locked[idx] ? "X" : "o";
                lb.helpTip = locked[idx] ? "Locked — won't regenerate" : "Unlocked";
            };
        })(si);
    }

    // Row 3: Temperature + Saturation
    var rowAdj = panelPalette.add("group");
    rowAdj.orientation = "row";
    rowAdj.alignChildren = ["fill","center"];
    rowAdj.add("statictext", undefined, "Temp:");
    var tempSl = rowAdj.add("slider", undefined, 0, -100, 100);
    tempSl.preferredSize.width = 72;
    rowAdj.add("statictext", undefined, "Sat:");
    var satSl = rowAdj.add("slider", undefined, 0, -100, 100);
    satSl.preferredSize.width = 72;

    // Row 4: Palette action buttons
    var rowPalAct = panelPalette.add("group");
    rowPalAct.orientation = "row";
    rowPalAct.alignChildren = ["fill","center"];
    var btnAddComp   = rowPalAct.add("button", undefined, "To Comp");
    var btnMakeGrad  = rowPalAct.add("button", undefined, "Gradient");
    var btnGradMap   = rowPalAct.add("button", undefined, "Grad Map");
    var btnCopyCSS   = rowPalAct.add("button", undefined, "Copy CSS");

    // Row 5: Gradient type + angle
    var rowGradOpt = panelPalette.add("group");
    rowGradOpt.orientation = "row";
    rowGradOpt.alignChildren = ["fill","center"];
    rowGradOpt.add("statictext", undefined, "Type:");
    var gradTypeDD = rowGradOpt.add("dropdownlist", undefined, ["Linear","Radial"]);
    gradTypeDD.selection = 0;
    rowGradOpt.add("statictext", undefined, "Angle:");
    var angleSl = rowGradOpt.add("slider", undefined, 135, 0, 360);
    angleSl.preferredSize.width = 70;
    var angleLbl = rowGradOpt.add("statictext", undefined, "135deg");
    angleLbl.preferredSize.width = 40;
    angleSl.onChanging = function(){ angleLbl.text = Math.round(angleSl.value)+"deg"; };

    // ============================================================
    //  UI: LIVING GRADIENT PANEL
    // ============================================================
    var panelLiving = win.add("panel", undefined, " Living Gradient");
    panelLiving.orientation = "column";
    panelLiving.alignChildren = ["fill","fill"];
    panelLiving.spacing = 5;

    function sliderRow(parent, label, defaultVal, minVal, maxVal, unit){
        var row = parent.add("group");
        row.orientation = "row";
        row.alignChildren = ["fill","center"];
        row.add("statictext", undefined, label);
        var sl = row.add("slider", undefined, defaultVal, minVal, maxVal);
        sl.preferredSize.width = 90;
        var lbl = row.add("statictext", undefined, String(defaultVal)+(unit||""));
        lbl.preferredSize.width = 36;
        sl.onChanging = function(){ lbl.text = Math.round(sl.value)+(unit||""); };
        return { slider: sl, label: lbl };
    }

    var cSpeed   = sliderRow(panelLiving, "Speed (s):",    10,   1,  60, "s");
    var cTurb    = sliderRow(panelLiving, "Turbulence:",  250,   0, 900, "");
    var cScale   = sliderRow(panelLiving, "Scale:",        400,  50, 1200, "");
    var cEvol    = sliderRow(panelLiving, "Evolution:",    70,   0, 250, "");
    var cOpacity = sliderRow(panelLiving, "Opacity:",     100,  10, 100, "%");

    var rowLivOpt = panelLiving.add("group");
    rowLivOpt.orientation = "row";
    rowLivOpt.alignChildren = ["fill","center"];
    rowLivOpt.add("statictext", undefined, "Blend:");
    var blendDD = rowLivOpt.add("dropdownlist", undefined,
        ["Normal","Screen","Add","Multiply","Overlay","Soft Light","Lighten","Color Dodge","Hard Light"]);
    blendDD.selection = 0;
    rowLivOpt.add("statictext", undefined, "Loop:");
    var loopDD = rowLivOpt.add("dropdownlist", undefined, ["Pingpong","Cycle","Drift"]);
    loopDD.selection = 0;

    var btnLiving = panelLiving.add("button", undefined, "Generate Living Gradient");

    // ============================================================
    //  UI: PRESETS PANEL
    // ============================================================
    var panelPresets = win.add("panel", undefined, " Presets");
    panelPresets.orientation = "column";
    panelPresets.alignChildren = ["fill","fill"];
    panelPresets.spacing = 4;

    var rowPreset = panelPresets.add("group");
    rowPreset.orientation = "row";
    rowPreset.alignChildren = ["fill","center"];
    var presetDD = rowPreset.add("dropdownlist", undefined, []);
    presetDD.preferredSize.width = 130;
    var btnSaveP   = rowPreset.add("button", undefined, "Save");
    var btnLoadP   = rowPreset.add("button", undefined, "Load");
    var btnDeleteP = rowPreset.add("button", undefined, "Del");

    refreshPresetDD();

    // ============================================================
    //  UI: FOOTER
    // ============================================================
    var rowFooter = win.add("group");
    rowFooter.orientation = "row";
    rowFooter.alignment = "left";
    rowFooter.add("statictext", undefined, "Gradient Lab v2  |  Made by Ehtishaam Shaikh");
    var btnSocials = rowFooter.add("button", undefined, "Socials");

    // ============================================================
    //  SWATCH UPDATE
    // ============================================================
    function updateSwatches(){
        for(var i = 0; i < swatches.length; i++){
            var c = Palette.colors[i];
            swatches[i].graphics.backgroundColor = swatches[i].graphics.newBrush(
                swatches[i].graphics.BrushType.SOLID_COLOR, c);
            swatches[i].helpTip = Palette.toHex(c) + (locked[i] ? " [LOCKED]" : " — click to apply");
        }
        try{ win.update(); }catch(e){}
    }

    // ============================================================
    //  CALLBACKS: PALETTE
    // ============================================================
    btnShuffle.onClick = function(){
        var mode = modeDD.selection ? modeDD.selection.text : "Random";
        var temp = tempSl.value / 100;
        var sat  = satSl.value  / 100;
        Palette.generate(mode, temp, sat);
        updateSwatches();
    };

    btnAddComp.onClick = function(){
        var comp = app.project.activeItem;
        if(!(comp instanceof CompItem)){ alert("Select a composition first."); return; }
        app.beginUndoGroup("Add Palette to Comp");
        for(var j = 0; j < NUM_SWATCHES; j++){
            var s = comp.layers.addSolid(Palette.colors[j], "Color "+(j+1), 80, 80, 1);
            s.position.setValue([55 + j*90, 80]);
        }
        app.endUndoGroup();
    };

    btnMakeGrad.onClick = function(){
        var comp = app.project.activeItem;
        if(!(comp instanceof CompItem)){ alert("Select a composition first."); return; }
        var isRadial = (gradTypeDD.selection && gradTypeDD.selection.text === "Radial");
        var angle    = angleSl.value;
        app.beginUndoGroup("Make Gradient");
        var solid = comp.layers.addSolid(Palette.colors[0], "Gradient", comp.width, comp.height, 1);
        var ramp  = solid.Effects.addProperty("ADBE Ramp");
        var cx = comp.width/2, cy = comp.height/2;
        var len = Math.max(comp.width, comp.height) / 2;
        var rad = angle * Math.PI / 180;
        if(isRadial){
            try{ ramp.property("Ramp Shape").setValue(2); }catch(e){}
            ramp.property("Start of Ramp").setValue([cx, cy]);
            ramp.property("End of Ramp").setValue([cx + len, cy]);
        } else {
            try{ ramp.property("Ramp Shape").setValue(1); }catch(e){}
            ramp.property("Start of Ramp").setValue([cx - Math.cos(rad)*len, cy - Math.sin(rad)*len]);
            ramp.property("End of Ramp").setValue([cx + Math.cos(rad)*len, cy + Math.sin(rad)*len]);
        }
        ramp.property("Start Color").setValue(Palette.colors[0]);
        ramp.property("End Color").setValue(Palette.colors[1]);
        app.endUndoGroup();
    };

    btnGradMap.onClick = function(){
        var comp = app.project.activeItem;
        if(!(comp instanceof CompItem)){ alert("Select a composition first."); return; }
        var sel = comp.selectedLayers;
        if(!sel.length){ alert("Select one or more layers first."); return; }
        app.beginUndoGroup("Gradient Map");
        for(var l = 0; l < sel.length; l++){
            try{
                var tritone = sel[l].Effects.addProperty("ADBE Tritone");
                if(tritone){
                    tritone.property("Highlights").setValue(Palette.colors[0]);
                    tritone.property("Midtones").setValue(Palette.colors[Math.floor(NUM_SWATCHES/2)]);
                    tritone.property("Shadows").setValue(Palette.colors[NUM_SWATCHES-1]);
                }
            }catch(e){ alert("Gradient Map error on layer "+sel[l].name+": "+e); }
        }
        app.endUndoGroup();
    };

    btnCopyCSS.onClick = function(){
        var angle = angleSl.value;
        var css = Palette.toCSSGradient(angle);
        var tmpFile = new File(Folder.temp.absoluteURI + "/gradientlab_css.txt");
        try{
            tmpFile.open("w"); tmpFile.write(css); tmpFile.close();
            alert("CSS Gradient:\n\n" + css + "\n\nSaved to:\n" + tmpFile.absoluteURI);
        }catch(e){ alert("CSS Gradient:\n\n" + css); }
    };

    // ============================================================
    //  CALLBACKS: LIVING GRADIENT
    // ============================================================
    btnLiving.onClick = function(){
        var comp = app.project.activeItem;
        if(!(comp instanceof CompItem)){ alert("Select a composition first."); return; }

        var speed    = Math.round(cSpeed.slider.value);
        var turbAmt  = cTurb.slider.value;
        var scaleAmt = cScale.slider.value;
        var evolSpd  = cEvol.slider.value;
        var opacity  = cOpacity.slider.value;
        var loopTxt  = loopDD.selection ? loopDD.selection.text : "Pingpong";
        var blendTxt = blendDD.selection ? blendDD.selection.text : "Normal";

        var loopExpr;
        switch(loopTxt){
            case "Pingpong": loopExpr = 'loopOut("pingpong")'; break;
            case "Cycle":    loopExpr = 'loopOut("cycle")';    break;
            case "Drift":    loopExpr = 'loopOut("cycle")';    break;
            default:         loopExpr = 'loopOut("pingpong")'; break;
        }

        app.beginUndoGroup("Living Gradient");
        try{
            var solid = comp.layers.addSolid([1,1,1], "Living Gradient", comp.width, comp.height, 1);

            // --- Motion Tile ---
            var tile = addEffect(solid, ["ADBE MotionTile","Motion Tile","CC RepeTile"]);
            if(tile){
                try{
                    for(var pi = 1; pi <= tile.numProperties; pi++){
                        var tp = tile.property(pi);
                        var tn = (tp.name || "").toLowerCase();
                        if(tn.indexOf("width")  !== -1) try{ tp.setValue(500); }catch(e){}
                        if(tn.indexOf("height") !== -1) try{ tp.setValue(500); }catch(e){}
                        if(tn.indexOf("mirror") !== -1) try{ tp.setValue(true); }catch(e){}
                    }
                }catch(e){}
            }

            // --- 4-Color Gradient ---
            var grad = addEffect(solid, [
                "4-Color Gradient",
                "4 Color Gradient",
                "ADBE 4-Color Gradient",
                "ADBE 4ColorGradient",
                "ADBE 4 Color Gradient"
            ]);
            if(!grad){
                solid.remove();
                app.endUndoGroup();
                alert("Could not find '4-Color Gradient' effect.\nMake sure you are on AE 2018 or newer.");
                return;
            }

            var pts = [], cols = [];
            for(var q = 1; q <= 4; q++){
                try{
                    var pt = grad.property("Point " + q);
                    var cp = grad.property("Color " + q);
                    if(pt && cp){ pts.push(pt); cols.push(cp); }
                }catch(e){}
            }

            if(pts.length !== 4){
                solid.remove();
                app.endUndoGroup();
                alert("Could not access all 4 gradient control points.\nTry a newer AE version.");
                return;
            }

            var cw = comp.width, ch = comp.height;
            var ov = Math.max(cw, ch) * 0.5;
            var corners = [[-ov,-ov],[cw+ov,-ov],[-ov,ch+ov],[cw+ov,ch+ov]];

            function randExt(){ return [(Math.random()*(cw+ov*2))-ov, (Math.random()*(ch+ov*2))-ov]; }

            for(var gi = 0; gi < 4; gi++){
                var start = corners[gi];
                var end   = randExt();

                if(loopTxt === "Drift"){
                    // Multi-waypoint for more organic motion
                    var mid1 = randExt();
                    var mid2 = randExt();
                    pts[gi].setValueAtTime(0,           start);
                    pts[gi].setValueAtTime(speed*0.33,  mid1);
                    pts[gi].setValueAtTime(speed*0.66,  mid2);
                    pts[gi].setValueAtTime(speed,       end);
                } else {
                    pts[gi].setValueAtTime(0,     start);
                    pts[gi].setValueAtTime(speed, end);
                }
                pts[gi].expression = loopExpr;
                cols[gi].setValue(Palette.colors[gi % NUM_SWATCHES]);
            }

            // --- Turbulent Displace ---
            var turb = addEffect(solid, ["ADBE TurbulentDisplace","Turbulent Displace"]);
            if(turb){
                try{ turb.property("Amount").setValue(turbAmt);     }catch(e){}
                try{ turb.property("Size").setValue(scaleAmt);      }catch(e){}
                try{ turb.property("Complexity").setValue(2);       }catch(e){}
                try{ turb.property("Evolution").expression = "time * " + evolSpd; }catch(e){}
            }

            // --- Blend Mode ---
            try{
                var bm = BLEND_MAP[blendTxt];
                if(bm) solid.blendingMode = bm;
            }catch(e){}

            // --- Opacity ---
            try{ solid.opacity.setValue(opacity); }catch(e){}

            app.endUndoGroup();

        }catch(err){
            try{ app.endUndoGroup(); }catch(e){}
            alert("Error generating Living Gradient:\n" + err.toString());
        }
    };

    // ============================================================
    //  CALLBACKS: PRESETS
    // ============================================================
    btnSaveP.onClick = function(){
        var name = prompt("Name this preset:", "Preset "+(new Date().getTime()));
        if(!name || !name.length) return;
        name = name.replace(/[|\n\r]/g, "_"); // sanitize
        presetsData[name] = Palette.serialize();
        savePresets();
        refreshPresetDD();
        // Select the newly saved item
        for(var i = 0; i < presetDD.items.length; i++){
            if(presetDD.items[i].text === name){ presetDD.selection = i; break; }
        }
        alert("Preset saved: " + name);
    };

    btnLoadP.onClick = function(){
        if(!presetDD.selection){ alert("Select a preset from the list first."); return; }
        var name = presetDD.selection.text;
        var val  = presetsData[name];
        if(val){ Palette.deserialize(val); updateSwatches(); }
        else{ alert("Could not load preset."); }
    };

    btnDeleteP.onClick = function(){
        if(!presetDD.selection){ alert("Select a preset to delete."); return; }
        var name = presetDD.selection.text;
        if(confirm("Delete preset '" + name + "'?")){ delete presetsData[name]; savePresets(); refreshPresetDD(); }
    };

    // ============================================================
    //  CALLBACKS: FOOTER
    // ============================================================
    btnSocials.onClick = function(){
        var url = "https://linktr.ee/itsehtishaam";
        try{ system.callSystem("explorer \"" + url + "\""); }catch(e){
            try{ system.callSystem("open " + url); }catch(e2){
                alert("Visit: " + url);
            }
        }
    };

    // ============================================================
    //  INIT
    // ============================================================
    updateSwatches();
    win.layout.layout(true);

})(this);
