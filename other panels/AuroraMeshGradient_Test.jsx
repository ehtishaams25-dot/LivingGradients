// Aurora Mesh Gradient Generator for After Effects
// Creates a fluid, animated aurora gradient with organic S-curve sweeps.
// Inspired by Huawei Nova / Apple-style flowing gradient wallpapers.

(function() {

    // ============================================================
    //  HELPER: Safe Effect Add (tries multiple matchNames)
    // ============================================================
    function addEffect(layer, names){
        for(var i = 0; i < names.length; i++){
            try{ var ef = layer.Effects.addProperty(names[i]); if(ef) return ef; }catch(e){}
        }
        return null;
    }

    app.beginUndoGroup("Create Aurora Mesh Gradient");

    var proj = app.project;
    if (!proj) proj = app.newProject();

    // ============================================================
    //  COMPOSITION SETUP
    // ============================================================
    var compW = 1920;
    var compH = 1080;
    var duration = 10; // seconds
    var fps = 30;
    var compName = "Aurora Gradient Test";
    var myComp = proj.items.addComp(compName, compW, compH, 1, duration, fps);
    myComp.openInViewer();

    // ============================================================
    //  COLOR PALETTE (Deep aurora purples, blues, pinks)
    // ============================================================
    var C = {
        bgDark:     [0.02, 0.01, 0.06],   // near-black deep purple
        bgMid:      [0.08, 0.04, 0.18],   // dark purple
        aurora1:    [0.55, 0.15, 0.95],    // vivid purple
        aurora2:    [0.35, 0.55, 1.0],     // bright blue
        aurora3:    [0.85, 0.25, 0.75],    // magenta/pink
        hotCore:    [0.95, 0.85, 1.0],     // near-white lavender
        accent:     [0.20, 0.70, 0.95]    // cyan accent
    };

    // ============================================================
    //  LAYER 1: BACKGROUND — 4-Color Gradient base
    // ============================================================
    var bgSolid = myComp.layers.addSolid([0,0,0], "BG Base", compW, compH, 1);
    var bgGrad = addEffect(bgSolid, [
        "ADBE Ramp", "Gradient Ramp"
    ]);
    if(bgGrad){
        bgGrad.property(1).setValue([compW * 0.5, 0]);        // Start of Ramp (top center)
        bgGrad.property(2).setValue(C.bgMid);                  // Start Color
        bgGrad.property(3).setValue([compW * 0.5, compH]);     // End of Ramp (bottom center)
        bgGrad.property(4).setValue(C.bgDark);                 // End Color
        bgGrad.property(6).setValue(100);                      // Ramp Scatter (reduce banding)
    }

    // ============================================================
    //  LAYER 2: PRIMARY AURORA SWEEP — 4-Color Gradient + Animation
    //  This is the main flowing color layer
    // ============================================================
    var sweep1 = myComp.layers.addSolid([1,1,1], "Aurora Sweep Primary", compW, compH, 1);

    // --- Motion Tile (for seamless edge wrapping) ---
    var tile1 = addEffect(sweep1, ["ADBE MotionTile", "Motion Tile", "CC RepeTile"]);
    if(tile1){
        try{
            for(var pi = 1; pi <= tile1.numProperties; pi++){
                var tp = tile1.property(pi);
                var tn = (tp.name || "").toLowerCase();
                if(tn.indexOf("width")  !== -1) try{ tp.setValue(400); }catch(e){}
                if(tn.indexOf("height") !== -1) try{ tp.setValue(400); }catch(e){}
                if(tn.indexOf("mirror") !== -1) try{ tp.setValue(true); }catch(e){}
            }
        }catch(e){}
    }

    // --- 4-Color Gradient ---
    var grad1 = addEffect(sweep1, [
        "4-Color Gradient",
        "4 Color Gradient",
        "ADBE 4-Color Gradient",
        "ADBE 4ColorGradient",
        "ADBE 4 Color Gradient"
    ]);
    if(grad1){
        var pts1 = [], cols1 = [];
        for(var q = 1; q <= 4; q++){
            try{
                var pt = grad1.property("Point " + q);
                var cp = grad1.property("Color " + q);
                if(pt && cp){ pts1.push(pt); cols1.push(cp); }
            }catch(e){}
        }

        if(pts1.length === 4){
            var cw = compW, ch = compH;
            var ov = Math.max(cw, ch) * 0.5;

            // Starting corner positions (spread beyond comp edges)
            var corners1 = [
                [-ov * 0.3, -ov * 0.3],
                [cw + ov * 0.3, -ov * 0.2],
                [-ov * 0.2, ch + ov * 0.3],
                [cw + ov * 0.3, ch + ov * 0.3]
            ];

            // Animated end positions — drift organically
            var ends1 = [
                [cw * 0.7, ch * 0.3],
                [cw * 0.2, ch * 0.6],
                [cw * 0.8, ch * 0.7],
                [cw * 0.3, ch * 0.4]
            ];

            // Palette for sweep 1
            var sweep1Colors = [C.aurora1, C.aurora2, C.aurora3, C.accent];

            for(var gi = 0; gi < 4; gi++){
                // Multi-waypoint keyframes for organic drift
                var mid1 = [
                    corners1[gi][0] + (ends1[gi][0] - corners1[gi][0]) * 0.3 + (Math.random() - 0.5) * cw * 0.4,
                    corners1[gi][1] + (ends1[gi][1] - corners1[gi][1]) * 0.3 + (Math.random() - 0.5) * ch * 0.4
                ];
                var mid2 = [
                    corners1[gi][0] + (ends1[gi][0] - corners1[gi][0]) * 0.7 + (Math.random() - 0.5) * cw * 0.4,
                    corners1[gi][1] + (ends1[gi][1] - corners1[gi][1]) * 0.7 + (Math.random() - 0.5) * ch * 0.4
                ];

                pts1[gi].setValueAtTime(0,                corners1[gi]);
                pts1[gi].setValueAtTime(duration * 0.33,  mid1);
                pts1[gi].setValueAtTime(duration * 0.66,  mid2);
                pts1[gi].setValueAtTime(duration,         ends1[gi]);
                pts1[gi].expression = 'loopOut("pingpong")';

                cols1[gi].setValue(sweep1Colors[gi]);
            }
        }
    }

    // --- Turbulent Displace (the organic fluid warp) ---
    var turb1 = addEffect(sweep1, ["ADBE TurbulentDisplace", "Turbulent Displace"]);
    if(turb1){
        try{ turb1.property("Amount").setValue(280); }catch(e){}
        try{ turb1.property("Size").setValue(450); }catch(e){}
        try{ turb1.property("Complexity").setValue(3); }catch(e){}
        try{ turb1.property("Evolution").expression = "time * 80"; }catch(e){}
    }

    // --- Gaussian Blur (soften edges) ---
    var blur1 = addEffect(sweep1, [
        "ADBE Gaussian Blur 2",
        "ADBE Fast Box Blur 2",
        "ADBE Gaussian Blur",
        "ADBE Fast Blur"
    ]);
    if(blur1){
        blur1.property(1).setValue(60);
        try{ blur1.property(2).setValue(3); }catch(e){}
    }

    sweep1.blendingMode = BlendingMode.SCREEN;
    sweep1.property("Transform").property("Opacity").setValue(90);

    // ============================================================
    //  LAYER 3: SECONDARY AURORA SWEEP — Offset colors, different timing
    // ============================================================
    var sweep2 = myComp.layers.addSolid([1,1,1], "Aurora Sweep Secondary", compW, compH, 1);

    // --- Motion Tile ---
    var tile2 = addEffect(sweep2, ["ADBE MotionTile", "Motion Tile", "CC RepeTile"]);
    if(tile2){
        try{
            for(var pi2 = 1; pi2 <= tile2.numProperties; pi2++){
                var tp2 = tile2.property(pi2);
                var tn2 = (tp2.name || "").toLowerCase();
                if(tn2.indexOf("width")  !== -1) try{ tp2.setValue(400); }catch(e){}
                if(tn2.indexOf("height") !== -1) try{ tp2.setValue(400); }catch(e){}
                if(tn2.indexOf("mirror") !== -1) try{ tp2.setValue(true); }catch(e){}
            }
        }catch(e){}
    }

    // --- 4-Color Gradient ---
    var grad2 = addEffect(sweep2, [
        "4-Color Gradient",
        "4 Color Gradient",
        "ADBE 4-Color Gradient",
        "ADBE 4ColorGradient",
        "ADBE 4 Color Gradient"
    ]);
    if(grad2){
        var pts2 = [], cols2 = [];
        for(var q2 = 1; q2 <= 4; q2++){
            try{
                var pt2 = grad2.property("Point " + q2);
                var cp2 = grad2.property("Color " + q2);
                if(pt2 && cp2){ pts2.push(pt2); cols2.push(cp2); }
            }catch(e){}
        }

        if(pts2.length === 4){
            // Different starting positions than sweep 1
            var corners2 = [
                [cw * 0.8, -ov * 0.2],
                [-ov * 0.2, ch * 0.5],
                [cw * 0.5, ch + ov * 0.2],
                [cw + ov * 0.2, ch * 0.3]
            ];

            var ends2 = [
                [cw * 0.3, ch * 0.5],
                [cw * 0.7, ch * 0.2],
                [cw * 0.4, ch * 0.4],
                [cw * 0.6, ch * 0.8]
            ];

            // Complementary/shifted colors for depth
            var sweep2Colors = [C.aurora2, C.aurora3, C.accent, C.aurora1];

            for(var gi2 = 0; gi2 < 4; gi2++){
                var m1 = [
                    corners2[gi2][0] + (ends2[gi2][0] - corners2[gi2][0]) * 0.4 + (Math.random() - 0.5) * cw * 0.3,
                    corners2[gi2][1] + (ends2[gi2][1] - corners2[gi2][1]) * 0.4 + (Math.random() - 0.5) * ch * 0.3
                ];
                var m2 = [
                    corners2[gi2][0] + (ends2[gi2][0] - corners2[gi2][0]) * 0.7 + (Math.random() - 0.5) * cw * 0.3,
                    corners2[gi2][1] + (ends2[gi2][1] - corners2[gi2][1]) * 0.7 + (Math.random() - 0.5) * ch * 0.3
                ];

                pts2[gi2].setValueAtTime(0,                corners2[gi2]);
                pts2[gi2].setValueAtTime(duration * 0.25,  m1);
                pts2[gi2].setValueAtTime(duration * 0.6,   m2);
                pts2[gi2].setValueAtTime(duration,         ends2[gi2]);
                pts2[gi2].expression = 'loopOut("pingpong")';

                cols2[gi2].setValue(sweep2Colors[gi2]);
            }
        }
    }

    // --- Turbulent Displace (different settings for variation) ---
    var turb2 = addEffect(sweep2, ["ADBE TurbulentDisplace", "Turbulent Displace"]);
    if(turb2){
        try{ turb2.property("Amount").setValue(220); }catch(e){}
        try{ turb2.property("Size").setValue(350); }catch(e){}
        try{ turb2.property("Complexity").setValue(2); }catch(e){}
        try{ turb2.property("Evolution").expression = "time * 55"; }catch(e){}
    }

    // --- Gaussian Blur ---
    var blur2 = addEffect(sweep2, [
        "ADBE Gaussian Blur 2",
        "ADBE Fast Box Blur 2",
        "ADBE Gaussian Blur",
        "ADBE Fast Blur"
    ]);
    if(blur2){
        blur2.property(1).setValue(80);
        try{ blur2.property(2).setValue(3); }catch(e){}
    }

    sweep2.blendingMode = BlendingMode.SCREEN;
    sweep2.property("Transform").property("Opacity").setValue(65);

    // ============================================================
    //  LAYER 4: HOT CORE — Bright concentrated glow for the main sweep
    // ============================================================
    var hotCore = myComp.layers.addSolid([1,1,1], "Hot Core Glow", compW, compH, 1);

    var gradCore = addEffect(hotCore, [
        "4-Color Gradient",
        "4 Color Gradient",
        "ADBE 4-Color Gradient",
        "ADBE 4ColorGradient",
        "ADBE 4 Color Gradient"
    ]);
    if(gradCore){
        var ptsC = [], colsC = [];
        for(var qc = 1; qc <= 4; qc++){
            try{
                var ptc = gradCore.property("Point " + qc);
                var cpc = gradCore.property("Color " + qc);
                if(ptc && cpc){ ptsC.push(ptc); colsC.push(cpc); }
            }catch(e){}
        }

        if(ptsC.length === 4){
            // Cluster the hot core points closer to center for a concentrated glow
            var coreCorners = [
                [cw * 0.35, ch * 0.25],
                [cw * 0.65, ch * 0.3],
                [cw * 0.3,  ch * 0.7],
                [cw * 0.7,  ch * 0.75]
            ];

            var coreEnds = [
                [cw * 0.55, ch * 0.45],
                [cw * 0.45, ch * 0.55],
                [cw * 0.6,  ch * 0.5],
                [cw * 0.4,  ch * 0.5]
            ];

            var coreColors = [C.hotCore, C.hotCore, C.aurora1, C.aurora3];

            for(var gc = 0; gc < 4; gc++){
                ptsC[gc].setValueAtTime(0,                 coreCorners[gc]);
                ptsC[gc].setValueAtTime(duration * 0.5,    coreEnds[gc]);
                ptsC[gc].setValueAtTime(duration,          coreCorners[gc]);
                ptsC[gc].expression = 'loopOut("pingpong")';

                colsC[gc].setValue(coreColors[gc]);
            }
        }
    }

    // --- Turbulent Displace on core ---
    var turbC = addEffect(hotCore, ["ADBE TurbulentDisplace", "Turbulent Displace"]);
    if(turbC){
        try{ turbC.property("Amount").setValue(200); }catch(e){}
        try{ turbC.property("Size").setValue(500); }catch(e){}
        try{ turbC.property("Complexity").setValue(2); }catch(e){}
        try{ turbC.property("Evolution").expression = "time * 65"; }catch(e){}
    }

    // --- Heavy Blur for dreamy glow ---
    var blurC = addEffect(hotCore, [
        "ADBE Gaussian Blur 2",
        "ADBE Fast Box Blur 2",
        "ADBE Gaussian Blur",
        "ADBE Fast Blur"
    ]);
    if(blurC){
        blurC.property(1).setValue(120);
        try{ blurC.property(2).setValue(3); }catch(e){}
    }

    hotCore.blendingMode = BlendingMode.SCREEN;
    hotCore.property("Transform").property("Opacity").setValue(50);

    // ============================================================
    //  LAYER 5: AMBIENT GLOW — Soft diffuse color wash (adds depth)
    // ============================================================
    var ambientSolid = myComp.layers.addSolid([0,0,0], "Ambient Glow", compW, compH, 1);

    var ambRamp = addEffect(ambientSolid, ["ADBE Ramp", "Gradient Ramp"]);
    if(ambRamp){
        // Animate the gradient position for subtle ambient movement
        ambRamp.property(1).setValueAtTime(0,        [compW * 0.2, compH * 0.8]);
        ambRamp.property(1).setValueAtTime(duration,  [compW * 0.4, compH * 0.6]);
        ambRamp.property(1).expression = 'loopOut("pingpong")';

        ambRamp.property(2).setValue(C.aurora2);  // Start Color (blue)

        ambRamp.property(3).setValueAtTime(0,        [compW * 0.8, compH * 0.2]);
        ambRamp.property(3).setValueAtTime(duration,  [compW * 0.6, compH * 0.4]);
        ambRamp.property(3).expression = 'loopOut("pingpong")';

        ambRamp.property(4).setValue(C.bgDark);    // End Color (dark)

        // Radial shape
        try{ ambRamp.property(5).setValue(2); }catch(e){}
        ambRamp.property(6).setValue(80); // Scatter
    }

    ambientSolid.blendingMode = BlendingMode.ADD;
    ambientSolid.property("Transform").property("Opacity").setValue(30);

    // ============================================================
    //  LAYER 6: TEXTURE NOISE — Anti-banding adjustment layer
    // ============================================================
    var adjLayer = myComp.layers.addSolid([1,1,1], "Texture Noise", compW, compH, 1);
    adjLayer.adjustmentLayer = true;
    var noiseFX = addEffect(adjLayer, ["ADBE Noise", "Noise"]);
    if(noiseFX){
        noiseFX.property(1).setValue(2.5); // Subtle noise amount
    }

    // ============================================================
    //  REORDER LAYERS (top to bottom)
    //  1. Texture Noise (adjustment)
    //  2. Hot Core Glow
    //  3. Aurora Sweep Primary
    //  4. Aurora Sweep Secondary
    //  5. Ambient Glow
    //  6. BG Base
    // ============================================================
    // Layers are added bottom-up in AE, so the last added is on top.
    // Current order (top to bottom): Texture Noise, Ambient Glow, Hot Core, Sweep2, Sweep1, BG
    // We need to rearrange:
    try{
        // Move Hot Core above sweeps (below texture noise)
        hotCore.moveBefore(ambientSolid);
        // Move sweep1 above sweep2
        sweep1.moveBefore(ambientSolid);
        // Move sweep2 above ambient
        sweep2.moveBefore(ambientSolid);
    }catch(e){}

    app.endUndoGroup();

    alert("Aurora Mesh Gradient created!\n\n" +
          "• Duration: " + duration + "s at " + fps + "fps\n" +
          "• Animated color points with pingpong looping\n" +
          "• Turbulent Displace for organic fluid motion\n" +
          "• Multiple sweep layers for depth\n\n" +
          "Press spacebar to preview the animation!\n" +
          "Tweak colors, blur amounts, and turbulence to taste.");
})();
