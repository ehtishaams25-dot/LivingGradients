// SilkFlare Gradient Generator for After Effects
// Creates a premium flowing silk gradient using blob shapes, star matte,
// and distortion effects (blur, wave warp, optics compensation).
// Made by Ehtishaam Shaikh | linktr.ee/itsehtishaam

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

    app.beginUndoGroup("Create SilkFlare Gradient");

    var proj = app.project;
    if(!proj) proj = app.newProject();

    var compW = 1920;
    var compH = 1080;
    var duration = 10;
    var fps = 30;

    // ============================================================
    //  COLOR PALETTE — Warm silk/amber tones (from reference)
    // ============================================================
    var blobColors = [
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

    // ============================================================
    //  STEP 1: Create blob circles composition
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

        // Ellipse path
        var ellipse = grpContents.addProperty("ADBE Vector Shape - Ellipse");
        var blobSize = 100 + Math.random() * 280;
        try{ ellipse.property("Size").setValue([blobSize, blobSize]); }catch(e){
            try{ ellipse.property(2).setValue([blobSize, blobSize]); }catch(e2){}
        }

        // Fill
        var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
        var cIdx = Math.floor(Math.random() * blobColors.length);
        try{ fill.property("Color").setValue(blobColors[cIdx]); }catch(e){
            try{ fill.property(4).setValue(blobColors[cIdx]); }catch(e2){}
        }

        // Random position spread across the comp
        var bx = Math.random() * compW;
        var by = Math.random() * compH;
        blobLayer.property("Transform").property("Position").setValue([bx, by]);
    }

    // ============================================================
    //  STEP 2 & 3: Create star matte composition
    //  - Add blob precomp with Fast Box Blur (radius 63, iterations 3)
    //  - Create 4-point star shape with rotation expression
    //  - Track matte the blobs to the star
    // ============================================================
    var starComp = proj.items.addComp("SilkFlare - Star Matte", compW, compH, 1, duration, fps);

    // Add blob comp as a layer first (it will be below the star)
    var blobInStar = starComp.layers.add(blobComp);
    blobInStar.name = "Color Blobs";

    // Fast Box Blur on the blob layer
    var blobBlur = addEffect(blobInStar, [
        "ADBE Box Blur2",
        "ADBE Fast Box Blur",
        "Fast Box Blur",
        "ADBE Gaussian Blur 2"
    ]);
    if(blobBlur){
        try{ blobBlur.property(1).setValue(63); }catch(e){}   // Blur Radius
        try{ blobBlur.property(2).setValue(3); }catch(e){}    // Iterations
        // Repeat Edge Pixels (property 4 in Fast Box Blur)
        try{ blobBlur.property(4).setValue(true); }catch(e){}
    }

    // Create star shape layer
    var starLayer = starComp.layers.addShape();
    starLayer.name = "Star Shape";

    var starContents = starLayer.property("Contents");
    var starGrp = starContents.addProperty("ADBE Vector Group");
    starGrp.name = "Polystar 1";

    var starGrpContents = starGrp.property("Contents");

    // Add polystar path
    var polystar = starGrpContents.addProperty("ADBE Vector Shape - Star");

    // Configure polystar — Star type with 4 points
    // Property indices for Polystar Path: 1=Type, 2=Points, 3=Position, 4=Rotation,
    // 5=Outer Radius, 6=Outer Roundness, 7=Inner Radius, 8=Inner Roundness
    try{ polystar.property("Type").setValue(2); }catch(e){
        try{ polystar.property(1).setValue(2); }catch(e2){}
    }
    try{ polystar.property("Points").setValue(4); }catch(e){
        try{ polystar.property(2).setValue(4); }catch(e2){}
    }
    try{ polystar.property("Outer Radius").setValue(406); }catch(e){
        try{ polystar.property(5).setValue(406); }catch(e2){}
    }
    try{ polystar.property("Inner Radius").setValue(203); }catch(e){
        try{ polystar.property(7).setValue(203); }catch(e2){}
    }

    // Add white fill (for alpha matte)
    var starFill = starGrpContents.addProperty("ADBE Vector Graphic - Fill");
    try{ starFill.property("Color").setValue([1, 1, 1]); }catch(e){
        try{ starFill.property(4).setValue([1, 1, 1]); }catch(e2){}
    }

    // Center the star layer
    starLayer.property("Transform").property("Position").setValue([compW / 2, compH / 2]);

    // Add rotation expression: time * 10
    try{
        starLayer.property("Transform").property("Rotation").expression = "time * 10";
    }catch(e){}

    // Reorder: star must be directly above blobs for track matte
    starLayer.moveBefore(blobInStar);

    // Set blob layer to use star as alpha matte
    try{
        blobInStar.trackMatteType = TrackMatteType.ALPHA;
    }catch(e){
        // Fallback for older AE versions
        try{ blobInStar.setTrackMatte(starLayer, TrackMatteType.ALPHA); }catch(e2){}
    }

    // ============================================================
    //  STEP 4 & 5: Create final composition with distortion effects
    //  - Fast Box Blur (radius 45, iterations 3)
    //  - Wave Warp (Semicircle, height -164, width 49, dir 308, speed 0.3)
    //  - Optics Compensation (FOV 145.2, reverse lens, horizontal)
    // ============================================================
    var finalComp = proj.items.addComp("SilkFlare Gradient", compW, compH, 1, duration, fps);

    var finalLayer = finalComp.layers.add(starComp);
    finalLayer.name = "Star Matte Comp";

    // --- Fast Box Blur ---
    var finalBlur = addEffect(finalLayer, [
        "ADBE Box Blur2",
        "ADBE Fast Box Blur",
        "Fast Box Blur",
        "ADBE Gaussian Blur 2"
    ]);
    if(finalBlur){
        try{ finalBlur.property(1).setValue(45); }catch(e){}   // Blur Radius
        try{ finalBlur.property(2).setValue(3); }catch(e){}    // Iterations
        try{ finalBlur.property(4).setValue(true); }catch(e){} // Repeat Edge Pixels
    }

    // --- Wave Warp ---
    var waveWarp = addEffect(finalLayer, [
        "ADBE Wave Warp",
        "Wave Warp",
        "ADBE Wave Warp2"
    ]);
    if(waveWarp){
        // Wave Type: Semicircle (index 6 in the dropdown)
        try{ waveWarp.property(1).setValue(6); }catch(e){
            try{ waveWarp.property("Wave Type").setValue(6); }catch(e2){}
        }
        // Wave Height: -164
        try{ waveWarp.property(2).setValue(-164); }catch(e){
            try{ waveWarp.property("Wave Height").setValue(-164); }catch(e2){}
        }
        // Wave Width: 49
        try{ waveWarp.property(3).setValue(49); }catch(e){
            try{ waveWarp.property("Wave Width").setValue(49); }catch(e2){}
        }
        // Direction: 308 degrees
        try{ waveWarp.property(4).setValue(308); }catch(e){
            try{ waveWarp.property("Direction").setValue(308); }catch(e2){}
        }
        // Wave Speed: 0.3
        try{ waveWarp.property(5).setValue(0.3); }catch(e){
            try{ waveWarp.property("Wave Speed").setValue(0.3); }catch(e2){}
        }
        // Pinning: None (value 1)
        try{ waveWarp.property(6).setValue(1); }catch(e){
            try{ waveWarp.property("Pinning").setValue(1); }catch(e2){}
        }
        // Phase: 0
        try{ waveWarp.property(7).setValue(0); }catch(e){
            try{ waveWarp.property("Phase").setValue(0); }catch(e2){}
        }
    }

    // --- Optics Compensation ---
    var optics = addEffect(finalLayer, [
        "ADBE Optics Compensation",
        "Optics Compensation"
    ]);
    if(optics){
        // Field Of View (FOV): 145.2
        try{ optics.property(1).setValue(145.2); }catch(e){
            try{ optics.property("Field Of View (FOV)").setValue(145.2); }catch(e2){}
        }
        // Reverse Lens Distortion: checked
        try{ optics.property(2).setValue(true); }catch(e){
            try{ optics.property("Reverse Lens Distortion").setValue(true); }catch(e2){}
        }
        // FOV Orientation: Horizontal (value 1)
        try{ optics.property(3).setValue(1); }catch(e){
            try{ optics.property("FOV Orientation").setValue(1); }catch(e2){}
        }
        // View Center: comp center
        try{ optics.property(4).setValue([compW / 2, compH / 2]); }catch(e){
            try{ optics.property("View Center").setValue([compW / 2, compH / 2]); }catch(e2){}
        }
    }

    // Open the final comp
    finalComp.openInViewer();

    app.endUndoGroup();

    alert("SilkFlare Gradient created!\n\n" +
          "3 compositions generated:\n" +
          "  1. SilkFlare - Blobs (color circles)\n" +
          "  2. SilkFlare - Star Matte (blurred blobs + rotating star)\n" +
          "  3. SilkFlare Gradient (final with effects)\n\n" +
          "Effects applied:\n" +
          "  - Fast Box Blur (45, 3 iterations)\n" +
          "  - Wave Warp (Semicircle, -164 height)\n" +
          "  - Optics Compensation (FOV 145.2)\n\n" +
          "Press spacebar to preview the animation!\n" +
          "Tweak blob colors and effect values to taste.");

})();
