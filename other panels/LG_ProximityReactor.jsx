// =============================================================
//  LG — PROXIMITY REACTOR  (Standalone Test)
//  React Bits · Living Gradients · Digivero
// =============================================================
//
//  USAGE:  File > Scripts > Run Script File  in After Effects
//
//  WHAT THIS CREATES:
//  ─────────────────
//  A new comp containing a proximity-reactive gradient.
//  The gradient locally warps + glows wherever "LG_ProxCtrl"
//  null is positioned. Parent any layer (emoji, shape, text)
//  to the null — the gradient will appear to react to it.
//
//  LAYER STACK  (top → bottom)
//  ─────────────────────────────────────────────────────────
//  1. LG_ProxCtrl  — Null w/ LG_Size & LG_Force sliders
//  2. LG_GlowSpot  — ADD blend radial glow follows null
//  3. LG_Gradient  — Main 4-color gradient (displaced)
//  4. LG_ProxMap   — Guide: radial map drives displacement
//
//  CONTROLS ON LG_ProxCtrl NULL
//  ─────────────────────────────────────────────────────────
//  LG_Size  (px)   — radius of the influence zone
//  LG_Force (0–200)— strength of warp + glow
//
// =============================================================

(function () {

  // ===========================================================
  //  HELPERS
  // ===========================================================

  /** Safe setValue — silently skips if property unavailable */
  function sv(prop, val) {
    try { prop.setValue(val); } catch (e) {}
  }

  /** Safe setExpression */
  function se(prop, expr) {
    try { prop.expression = expr; } catch (e) {}
  }

  /**
   * Safe addEffect — tries each matchName in order, returns first success.
   * Mirrors SilkFlare's pattern: AE effect matchNames are brittle across versions.
   */
  function addEffect(layer, names) {
    for (var i = 0; i < names.length; i++) {
      try {
        var ef = layer.property("Effects").addProperty(names[i]);
        if (ef) return ef;
      } catch (e) {}
    }
    return null;
  }

  // ── Expression strings ──────────────────────────────────────

  /** null layer's current comp-space position */
  var EXPR_nullPos = [
    'var c = thisComp.layer("LG_ProxCtrl");',
    'c.toComp(c.anchorPoint);'
  ].join('\n');

  /**
   * null position + (Size * scale) offset — used as ramp end-point
   * scale 0.7 ≈ 45° diagonal so the circle covers the Size radius cleanly
   */
  function EXPR_nullEdge(scale) {
    return [
      'var c = thisComp.layer("LG_ProxCtrl");',
      'var p = c.toComp(c.anchorPoint);',
      'var r = c.effect("LG_Size")("Slider") * ' + scale + ';',
      '[p[0] + r * 0.707, p[1] + r * 0.707];'
    ].join('\n');
  }

  /** Force slider * multiplier */
  function EXPR_force(mult) {
    return [
      'var c = thisComp.layer("LG_ProxCtrl");',
      'c.effect("LG_Force")("Slider") * ' + mult + ';'
    ].join('\n');
  }

  /**
   * Slow organic drift for 4-Color Gradient color points.
   * Each corner gets a different phase so they move independently.
   */
  function EXPR_drift(bx, by, rx, ry, phase) {
    return [
      'var t = time * 0.22 + ' + phase + ';',
      '[' + bx + ' + Math.sin(t)        * ' + rx + ',',
      ' ' + by + ' + Math.cos(t * 0.71) * ' + ry + '];'
    ].join('\n');
  }

  // ===========================================================
  //  CONFIG
  // ===========================================================

  var W   = 1920,
      H   = 1080,
      FPS = 30,
      DUR = 10;   // seconds

  var DEF_SIZE  = 700;   // influence radius (px)
  var DEF_FORCE = 80;    // 0 – 200

  // 4-Color Gradient palette  (R, G, B, A  in 0–1 range)
  var C1 = [0.98, 0.42, 0.21, 1];  // orange   #FA6B35
  var C2 = [0.98, 0.20, 0.40, 1];  // pink     #FA3366
  var C3 = [0.80, 0.00, 1.00, 1];  // purple   #CC00FF
  var C4 = [0.00, 0.20, 1.00, 1];  // blue     #0033FF

  // ===========================================================
  //  CREATE COMP
  // ===========================================================

  app.beginUndoGroup("LG: Proximity Reactor");

  var comp = app.project.items.addComp(
    "LG_ProxReactor", W, H, 1, DUR, FPS
  );

  // ===========================================================
  //  LAYER A — LG_ProxMap  (guide — displacement source)
  // ===========================================================
  //
  //  A radial gradient ramp that is ALWAYS centred on the null.
  //  White at the null's exact position → 50% grey at the edge
  //  of the influence zone → no further displacement beyond that.
  //
  //  Using 50% grey as end colour (not black) ensures we get
  //  clean outward-push displacement only — no pull-back ring.
  //
  var proxMapLayer = comp.layers.addSolid(
    [0.5, 0.5, 0.5], "LG_ProxMap", W, H, 1, DUR
  );
  proxMapLayer.guideLayer = true;

  var pmRamp = addEffect(proxMapLayer, ["ADBE Ramp", "Ramp", "ADBE Ramp2"]);
  sv(pmRamp.property("ADBE Ramp-0005"), 2);               // Radial shape
  se(pmRamp.property("ADBE Ramp-0001"), EXPR_nullPos);    // Start = null pos
  sv(pmRamp.property("ADBE Ramp-0002"), [1, 1, 1, 1]);   // White at centre
  se(pmRamp.property("ADBE Ramp-0003"), EXPR_nullEdge(1));// End  = null + Size
  sv(pmRamp.property("ADBE Ramp-0004"), [0.5, 0.5, 0.5, 1]); // 50% grey at edge

  // ===========================================================
  //  LAYER B — LG_Gradient  (main visible gradient)
  // ===========================================================

  var gradLayer = comp.layers.addSolid(
    [0, 0, 0], "LG_Gradient", W, H, 1, DUR
  );

  // ── 4-Color Gradient ──────────────────────────────────────
  // matchName differs between AE versions — try all known variants
  var g4 = addEffect(gradLayer, [
    "ADBE 4-Color Gradient",
    "4-Color Gradient",
    "ADBE 4 Color Gradient"
  ]);

  if (!g4) {
    alert("ERROR: Could not add 4-Color Gradient effect.\n" +
          "Make sure the effect is installed (Effects & Presets panel).\n" +
          "Script aborted.");
    app.endUndoGroup();
    return;
  }

  // Static colour values
  sv(g4.property("ADBE 4-Color Gradient-0002"), C1);
  sv(g4.property("ADBE 4-Color Gradient-0004"), C2);
  sv(g4.property("ADBE 4-Color Gradient-0006"), C3);
  sv(g4.property("ADBE 4-Color Gradient-0008"), C4);
  sv(g4.property("ADBE 4-Color Gradient-0009"), 80);  // Blend %

  // Animated corner positions — each drifts on its own phase
  se(g4.property("ADBE 4-Color Gradient-0001"), EXPR_drift(W*0.25, H*0.25, 160, 110, 0.0));
  se(g4.property("ADBE 4-Color Gradient-0003"), EXPR_drift(W*0.75, H*0.25, 160, 110, 1.6));
  se(g4.property("ADBE 4-Color Gradient-0005"), EXPR_drift(W*0.75, H*0.75, 160, 110, 3.1));
  se(g4.property("ADBE 4-Color Gradient-0007"), EXPR_drift(W*0.25, H*0.75, 160, 110, 4.7));

  // ── Turbulent Displace — global organic breathing ─────────
  //    This keeps the gradient alive even when the null is still
  var turb = addEffect(gradLayer, ["ADBE Turbulent Displace", "Turbulent Displace"]);
  sv(turb.property("Amount"), 30);
  sv(turb.property("Size"),   260);

  // Evolution: 2 keyframes at 0s and DUR so AE interpolates smoothly
  try {
    var evoGroup = turb.property("Evolution Options");
    var evoProp  = evoGroup.property("Evolution");
    evoProp.setValueAtTime(0,   [0,   0]);    // 0° at frame 0
    evoProp.setValueAtTime(DUR, [1, 120]);    // ~1.33 rotations over duration
  } catch (e) {
    // fallback: add expression if property group access fails
    try {
      turb.property("Evolution Options").property("Evolution").expression = "time * 50;";
    } catch (e2) {}
  }

  // ── Displacement Map — localized reaction at null ─────────
  //    Uses LG_ProxMap as the warp source so distortion is
  //    strongest exactly where the null sits, fades at Size radius
  var dmap = addEffect(gradLayer, ["ADBE Displacement Map", "Displacement Map"]);

  // Channel: Luminance of ProxMap drives the displacement
  sv(dmap.property("ADBE Displacement Map-0002"), 5);   // H channel = Luminance
  sv(dmap.property("ADBE Displacement Map-0003"), 5);   // V channel = Luminance

  // Max displacement driven by LG_Force  (Force 80 → 120 px warp)
  se(dmap.property("ADBE Displacement Map-0004"), EXPR_force(1.5));
  se(dmap.property("ADBE Displacement Map-0005"), EXPR_force(1.5));

  sv(dmap.property("ADBE Displacement Map-0006"), 3);   // Stretch map to fit

  // ── Subtle Glow on gradient ────────────────────────────────
  try {
    var gfx = addEffect(gradLayer, ["ADBE Glow", "Glow"]);
    if (gfx) {
      sv(gfx.property("ADBE Glow-0002"), 0.55);   // Threshold
      sv(gfx.property("ADBE Glow-0003"), 60);      // Radius
      sv(gfx.property("ADBE Glow-0004"), 0.7);     // Intensity
    }
  } catch (e) {}

  // ===========================================================
  //  LAYER C — LG_GlowSpot  (ADD blend — colour bloom at null)
  // ===========================================================
  //
  //  In ADD blending mode black = invisible, so this layer only
  //  contributes a warm bloom exactly where the ramp is bright.
  //  The glow radius is 35% of LG_Size so it feels tight + punchy.
  //
  var glowLayer = comp.layers.addSolid(
    [0, 0, 0], "LG_GlowSpot", W, H, 1, DUR
  );
  glowLayer.blendingMode = BlendingMode.ADD;

  var glRamp = addEffect(glowLayer, ["ADBE Ramp", "Ramp", "ADBE Ramp2"]);
  sv(glRamp.property("ADBE Ramp-0005"), 2);               // Radial
  se(glRamp.property("ADBE Ramp-0001"), EXPR_nullPos);    // Centre = null
  sv(glRamp.property("ADBE Ramp-0002"), [1, 0.88, 1, 1]);// Warm white tint
  se(glRamp.property("ADBE Ramp-0003"), EXPR_nullEdge(0.35)); // Tight radius
  sv(glRamp.property("ADBE Ramp-0004"), [0, 0, 0, 1]);   // Black = invisible

  // Opacity: Force 80 → ~56% in ADD mode (feels bright but not blown out)
  se(
    glowLayer.property("Transform").property("Opacity"),
    EXPR_force(0.7)   // cap: slider max 200 → 140%, but ADD mode self-limits
  );

  // ===========================================================
  //  LAYER D — LG_ProxCtrl  (Null controller — top of stack)
  // ===========================================================

  var nullLayer = comp.layers.addNull(DUR);
  nullLayer.name  = "LG_ProxCtrl";
  nullLayer.label = 3;   // Purple in AE label colours

  sv(nullLayer.property("Transform").property("Position"), [W / 2, H / 2]);

  var nFx = nullLayer.property("Effects");

  var sSlider = addEffect(nullLayer, ["ADBE Slider Control", "Slider Control"]);
  sSlider.name = "LG_Size";
  sv(sSlider.property("Slider"), DEF_SIZE);

  var fSlider = addEffect(nullLayer, ["ADBE Slider Control", "Slider Control"]);
  fSlider.name = "LG_Force";
  sv(fSlider.property("Slider"), DEF_FORCE);

  // Demo orbit so you can immediately RAM Preview and see the effect.
  // Delete this expression to keyframe the null yourself.
  se(nullLayer.property("Transform").property("Position"), [
    'var r = 280;',
    'var s = 0.38;',
    '[thisComp.width  / 2 + r * Math.cos(time * s),',
    ' thisComp.height / 2 + r * Math.sin(time * s * 0.65)];'
  ].join('\n'));

  // ===========================================================
  //  LAYER ORDER
  //  1 null → 2 glow → 3 gradient → 4 proxmap (bottom)
  // ===========================================================

  nullLayer.moveToBeginning();    // index 1
  glowLayer.moveAfter(nullLayer); // index 2
  gradLayer.moveAfter(glowLayer); // index 3
  proxMapLayer.moveToEnd();       // index 4

  // Link Displacement Map source to LG_ProxMap now that indices are settled
  try {
    dmap.property("ADBE Displacement Map-0001").setValue(proxMapLayer.index);
  } catch (e) {
    // Fallback using display name
    try {
      dmap.property("Displacement Map Layer").setValue(proxMapLayer.index);
    } catch (e2) {}
  }

  // ===========================================================
  //  OPEN + DONE
  // ===========================================================

  comp.openInViewer();
  app.endUndoGroup();

  alert(
    "LG Proximity Reactor — Live!\n\n" +

    "HOW TO USE:\n" +
    "  1. Hit Space / RAM Preview to see the demo orbit\n" +
    "  2. Parent your layer (emoji, shape, text) to 'LG_ProxCtrl'\n" +
    "  3. Select the null, delete its Position expression\n" +
    "     to keyframe it manually wherever you like\n\n" +

    "CONTROLS  (on LG_ProxCtrl null):\n" +
    "  LG_Size   — radius of influence zone (px)\n" +
    "  LG_Force  — strength of warp + glow (0–200)\n\n" +

    "The gradient warps and glows\n" +
    "wherever the null (and anything parented to it) moves."
  );

}());
