#target aftereffects

/**
 * Liquid Glass Gradient Generator
 * Replicates the organic, flowing glass texture with deep blue tones and sharp highlights.
 */
function createLiquidGlass() {
    app.beginUndoGroup("Create Liquid Glass Gradient");

    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
        comp = app.project.items.addComp("Liquid Glass", 1920, 1080, 1, 10, 30);
    }

    var layer = comp.layers.addSolid([0, 0, 0], "Liquid Glass Texture", comp.width, comp.height, comp.pixelAspect);

    // Helper function for adding effects reliably
    function addEffect(layer, effectName, displayName) {
        var effect = layer.Effects.addProperty(effectName);
        if (displayName) effect.name = displayName;
        return effect;
    }

    // 1. Fractal Noise - The base "liquid" shapes
    var fractal = addEffect(layer, "ADBE Fractal Noise", "Base Liquid Shapes");
    fractal.property(1).setValue(4); // Fractal Type: Swirly
    fractal.property(2).setValue(2); // Noise Type: Soft Linear
    fractal.property(4).setValue(160); // Contrast
    fractal.property(5).setValue(-15); // Brightness
    fractal.property(9).setValue(600); // Scale
    fractal.property(10).setValue(1.5); // Complexity
    
    // Animate Evolution
    var evolution = fractal.property(15);
    evolution.expression = "time * 120";

    // 2. Fast Box Blur - Smooth out the noise into blobs
    var blur = addEffect(layer, "ADBE Fast Blur 2", "Smooth Blobs");
    blur.property(1).setValue(40); // Blur Radius
    blur.property(2).setValue(2); // Iterations
    blur.property(3).setValue(1); // Repeat Edge Pixels

    // 3. CC Glass - The 3D "Glassy" refraction
    // Note: CC effects often don't have standard ADBE names in older versions, 
    // but in modern AE "CC Glass" works.
    try {
        var glass = addEffect(layer, "CC Glass", "Glass Surface");
        // Surface
        glass.property(1).setValue(1); // Bump Map (This Layer)
        glass.property(2).setValue(1); // Property (Luminance)
        glass.property(3).setValue(25); // Softness
        glass.property(4).setValue(80); // Height
        glass.property(5).setValue(120); // Displacement
        
        // Light
        glass.property(6).setValue(1); // Light Type (Distant Light)
        glass.property(8).setValue(150); // Light Intensity
        glass.property(9).setValue([-50, -50]); // Light Direction (Top Left)
    } catch (e) {
        // Fallback or warning if CC Glass is missing
    }

    // 4. Tritone - Color Mapping (Deep Blue Palette)
    var tritone = addEffect(layer, "ADBE Tritone", "Color Palette");
    tritone.property(1).setValue([1, 1, 1]); // Highlights: White
    tritone.property(2).setValue([0.18, 0.18, 0.73]); // Midtones: Deep Indigo/Blue
    tritone.property(3).setValue([0, 0, 0.15]); // Shadows: Very Dark Blue

    // 5. Curves - Final Contrast Punch
    var curves = addEffect(layer, "ADBE Curves", "Final Polish");
    // We'll leave this for manual adjustment or add a slight S-curve
    
    // 6. Glow - For that premium sheen
    var glow = addEffect(layer, "ADBE Glow", "Highlight Sheen");
    glow.property(2).setValue(15); // Threshold
    glow.property(3).setValue(50); // Radius
    glow.property(4).setValue(0.5); // Intensity

    comp.openInViewer();
    app.endUndoGroup();
}

createLiquidGlass();
