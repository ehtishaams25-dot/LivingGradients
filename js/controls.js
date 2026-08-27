/* ============================================
   CONTROLS.JS — Per-type slider configs
   ============================================ */

const GRADIENT_CONTROLS = {
  /* Types that previously rendered "No settings for this type" in the
     inspector. Keys match what each builder actually reads. */
  OklabSmooth: [
    { id: 'gradientType', label: 'Gradient Type', options: ['Linear', 'Radial'], default: 'Linear', type: 'select' },
    { id: 'angle',        label: 'Angle',  min: 0, max: 90,  step: 90, default: 0,  type: 'slider' }
  ],
  /* Position first, deliberately. On this gradient it is not one setting
     among many — it is the one that decides what the thing looks like, and
     burying it under four sliders would say otherwise. */
  SaaS: [
    { id: 'position',  label: 'Bloom Position', type: 'xy', default: [30, 35],
      hint: 'Drag to place the light. Arrow keys nudge, Home recentres, double-click resets.' },
    { id: 'size',      label: 'Bloom Size',   min: 10, max: 160, step: 1, default: 70, type: 'slider' },
    { id: 'softness',  label: 'Softness',     min: 10, max: 100, step: 1, default: 80, type: 'slider' },
    { id: 'intensity', label: 'Intensity',    min: 5,  max: 100, step: 1, default: 85, type: 'slider' },
    { id: 'blooms',    label: 'Blooms',       min: 1,  max: 3,   step: 1, default: 2,  type: 'slider' },
    { id: 'spread',    label: 'Spread',       min: 0,  max: 120, step: 1, default: 55, type: 'slider' },
    { id: 'drift',     label: 'Drift',        min: 0,  max: 200, step: 5, default: 30, type: 'slider' },
    { id: 'speed',     label: 'Drift Speed',  min: 0,  max: 60,  step: 1, default: 12, type: 'slider' }
  ],
  /* SATIN WAVES (id 'Metallic'). Nothing here changed when it moved out of
     Metal — the sliders always described a folded ramp being bent, which is
     what a wave is. Only the label and the section did. */
  Metallic: [
    { id: 'finish',      label: 'Finish',
      options: ['Chrome', 'Iridescent', 'Brushed', 'Y2K Chrome'],
      default: 'Chrome', type: 'select' },
    { id: 'bands',       label: 'Fold Count',       min: 2,  max: 60,  step: 1,  default: 6,   type: 'slider' },
    { id: 'tilt',        label: 'Fold Tilt',        min: 0,  max: 100, step: 1,  default: 12,  type: 'slider' },
    { id: 'speed',       label: 'Flow Speed',       min: 0,  max: 120, step: 1,  default: 20,  type: 'slider' },
    { id: 'ripple',      label: 'Liquid Ripple',    min: 0,  max: 500, step: 5,  default: 180, type: 'slider' },
    { id: 'rippleScale', label: 'Ripple Scale',     min: 20, max: 600, step: 10, default: 260, type: 'slider' },
    { id: 'swirl',       label: 'Swirl',            min: 0,  max: 300, step: 5,  default: 70,  type: 'slider' },
    { id: 'sheen',       label: 'Sheen',            min: 0,  max: 100, step: 1,  default: 45,  type: 'slider' },
    { id: 'softness',    label: 'Softness',         min: 0,  max: 40,  step: 1,  default: 2,   type: 'slider' }
  ],
  Antigravity: [
    { id: 'count',        label: 'Particles',    min: 50,  max: 2000, step: 50,  default: 500, type: 'slider' },
    { id: 'waveSpeed',    label: 'Drift Speed',  min: 0.05, max: 3,   step: 0.05, default: 0.4, type: 'slider' },
    { id: 'particleSize', label: 'Particle Size', min: 0.5, max: 10,  step: 0.5, default: 2,   type: 'slider' }
  ],
  Waves: [
    { id: 'waveSpeedX', label: 'Wave Speed', min: 0.005, max: 0.2, step: 0.005, default: 0.02, type: 'slider' },
    { id: 'waveAmpX',   label: 'Amplitude',  min: 5,     max: 200, step: 5,     default: 40,   type: 'slider' },
    { id: 'xGap',       label: 'Line Gap',   min: 4,     max: 60,  step: 1,     default: 12,   type: 'slider' }
  ],
  living: [
    { id: 'speed',    label: 'Shift Speed',  min: 1,   max: 60,  step: 1,   default: 10,  type: 'slider' },
    { id: 'softness', label: 'Turbulence',   min: 0,   max: 900, step: 1,   default: 250, type: 'slider' },
    { id: 'rotation', label: 'Evolution',    min: 0,   max: 250, step: 1,   default: 70,  type: 'slider' },
    { id: 'scale',    label: 'Scale',        min: 50,  max: 1200,step: 10,  default: 400, type: 'slider' },
    { id: 'opacity',  label: 'Opacity',      min: 10,  max: 100, step: 1,   default: 100, type: 'slider' }
  ],
  Silk: [
    { id: 'speed', label: 'Speed', min: 0.05, max: 3.0, step: 0.05, default: 0.3, type: 'slider' },
    { id: 'direction', label: 'Direction', min: 0, max: 360, step: 1, default: 163, type: 'slider' },
    { id: 'shape', label: 'Matte Shape', options: ['4-Point Star (Default)', '5-Point Star', 'Hexagon', 'Circle', 'Oval', 'Square', 'Rectangle'], default: '4-Point Star (Default)', type: 'select' }
  ],
  Aurora: [
    { id: 'speed', label: 'Speed', min: 0.05, max: 3.0, step: 0.05, default: 0.2, type: 'slider' },
    { id: 'direction', label: 'Direction', min: 0, max: 360, step: 1, default: 163, type: 'slider' },
    { id: 'shape', label: 'Matte Shape', options: ['4-Point Star (Default)', '5-Point Star', 'Hexagon', 'Circle', 'Oval', 'Square', 'Rectangle'], default: '4-Point Star (Default)', type: 'select' }
  ],
  Prism: [
    { id: 'speed', label: 'Speed', min: 0.05, max: 3.0, step: 0.05, default: 0.3, type: 'slider' },
    { id: 'direction', label: 'Direction', min: 0, max: 360, step: 1, default: 163, type: 'slider' },
    { id: 'shape', label: 'Matte Shape', options: ['4-Point Star (Default)', '5-Point Star', 'Hexagon', 'Circle', 'Oval', 'Square', 'Rectangle'], default: '4-Point Star (Default)', type: 'select' }
  ],
  Fiber: [
    { id: 'speed', label: 'Speed', min: 0.05, max: 3.0, step: 0.05, default: 1.4, type: 'slider' },
    { id: 'direction', label: 'Direction', min: 0, max: 360, step: 1, default: 163, type: 'slider' },
    { id: 'shape', label: 'Matte Shape', options: ['4-Point Star (Default)', '5-Point Star', 'Hexagon', 'Circle', 'Oval', 'Square', 'Rectangle'], default: '4-Point Star (Default)', type: 'select' }
  ],
  Veil: [
    { id: 'speed', label: 'Speed', min: 0.05, max: 3.0, step: 0.05, default: 0.15, type: 'slider' },
    { id: 'direction', label: 'Direction', min: 0, max: 360, step: 1, default: 163, type: 'slider' },
    { id: 'shape', label: 'Matte Shape', options: ['4-Point Star (Default)', '5-Point Star', 'Hexagon', 'Circle', 'Oval', 'Square', 'Rectangle'], default: '4-Point Star (Default)', type: 'select' }
  ],
  Pulse: [
    { id: 'speed', label: 'Speed', min: 0.05, max: 3.0, step: 0.05, default: 0.6, type: 'slider' },
    { id: 'direction', label: 'Direction', min: 0, max: 360, step: 1, default: 163, type: 'slider' },
    { id: 'shape', label: 'Matte Shape', options: ['4-Point Star (Default)', '5-Point Star', 'Hexagon', 'Circle', 'Oval', 'Square', 'Rectangle'], default: '4-Point Star (Default)', type: 'select' }
  ],
  Comet: [
    { id: 'speed', label: 'Speed', min: 0.05, max: 3.0, step: 0.05, default: 0.5, type: 'slider' },
    { id: 'direction', label: 'Direction', min: 0, max: 360, step: 1, default: 163, type: 'slider' },
    { id: 'shape', label: 'Matte Shape', options: ['4-Point Star (Default)', '5-Point Star', 'Hexagon', 'Circle', 'Oval', 'Square', 'Rectangle'], default: '4-Point Star (Default)', type: 'select' }
  ],
  ChromaFlare: [
    { id: 'rotationSpeed', label: 'Rotation Speed', min: 0, max: 120, step: 1, default: 50, type: 'slider' },
    { id: 'speed', label: 'Wave Speed', min: 0, max: 3, step: 0.05, default: 0.7, type: 'slider' },
    { id: 'direction', label: 'Wave Direction', min: 0, max: 360, step: 1, default: 140, type: 'slider' },
    { id: 'bend', label: 'Arc Bend', min: -100, max: 100, step: 1, default: 72, type: 'slider' },
    { id: 'horizontalDistort', label: 'Horiz Distort', min: -100, max: 100, step: 1, default: 94, type: 'slider' },
    { id: 'verticalDistort', label: 'Vert Distort', min: -100, max: 100, step: 1, default: -29, type: 'slider' },
    { id: 'star', label: 'Star', options: ['4-Point Star', '5-Point Star', '6-Point Star'], default: '4-Point Star', type: 'select' }
  ],
  /* FROSTED GLASS
     Now a real refracting surface rather than a coloured field with a bloom
     on it. There is a colour field, there is a sheet of glass in front of it
     with a rippled surface, and CC Glass bends the one through the other and
     lights it. So the sliders are the two halves of that:

       Colour Scale / Flow Speed   the field behind the glass.
       Surface Scale / Ripple      the shape of the sheet itself.
       Refraction                  how far the glass bends what is behind it.
       Relief / Specular / Roughness / Light Angle
                                   how the sheet catches light.
       Frost                       the final blur, which is what turns clear
                                   glass into frosted glass. Take it to 0 and
                                   you get a clear liquid-glass panel. */
  Glass: [
    { id: 'scale',       label: 'Colour Scale',   min: 50,  max: 900, step: 10, default: 420, type: 'slider' },
    { id: 'speed',       label: 'Flow Speed',     min: 0,   max: 120, step: 1,  default: 14,  type: 'slider' },
    { id: 'surfaceScale',label: 'Surface Scale',  min: 40,  max: 900, step: 10, default: 260, type: 'slider' },
    { id: 'ripple',      label: 'Surface Ripple', min: 0,   max: 400, step: 5,  default: 90,  type: 'slider' },
    { id: 'refraction',  label: 'Refraction',     min: 0,   max: 300, step: 5,  default: 110, type: 'slider' },
    { id: 'relief',      label: 'Relief',         min: 0,   max: 100, step: 1,  default: 45,  type: 'slider' },
    { id: 'lightAngle',  label: 'Light Angle',    min: 0,   max: 360, step: 1,  default: 315, type: 'slider' },
    { id: 'specular',    label: 'Specular',       min: 0,   max: 100, step: 1,  default: 55,  type: 'slider' },
    { id: 'roughness',   label: 'Roughness',      min: 1,   max: 100, step: 1,  default: 18,  type: 'slider' },
    { id: 'iridescence', label: 'Iridescence',    min: 0,   max: 100, step: 1,  default: 22,  type: 'slider' },
    { id: 'softness',    label: 'Frost',          min: 0,   max: 120, step: 1,  default: 10,  type: 'slider' }
  ],
  ReededGlass: [
    { id: 'lineSize',    label: 'Flute Width',     min: 6,  max: 200, step: 2,  default: 44,  type: 'slider' },
    { id: 'refraction',  label: 'Refraction',      min: 0,  max: 300, step: 5,  default: 90,  type: 'slider' },
    { id: 'orientation', label: 'Flute Direction', options: ['Vertical', 'Horizontal'], default: 'Vertical', type: 'select' },
    { id: 'speed',       label: 'Colour Drift',    min: 0,  max: 120, step: 1,  default: 14,  type: 'slider' },
    { id: 'scale',       label: 'Colour Scale',    min: 50, max: 900, step: 10, default: 420, type: 'slider' },
    { id: 'sheen',       label: 'Edge Sheen',      min: 0,  max: 100, step: 1,  default: 45,  type: 'slider' },
    { id: 'blur',        label: 'Surface Blur',    min: 0,  max: 60,  step: 1,  default: 6,   type: 'slider' }
  ],
  /* Anime Water runs on the same Cell Pattern engine as Cellular Mosaic, so
     it takes the same controls — the difference between the two is the
     defaults, not the machinery. Caustic labels, water numbers. */
  AnimeWater: [
    { id: 'pattern',    label: 'Surface Type',
      options: ['Static Plates', 'Plates', 'Bubbles', 'Crystals', 'Crystallize',
                'Static Crystals', 'Static Crystallize', 'Mixed Crystals', 'Static Mixed Crystals'],
      default: 'Static Plates', type: 'select' },
    { id: 'cells',      label: 'Caustic Density', min: 5, max: 200, step: 1, default: 91,  type: 'slider' },
    { id: 'dispersion', label: 'Irregularity',    min: 0, max: 100, step: 1, default: 100, type: 'slider' },
    { id: 'speed',      label: 'Flow Speed',      min: 0, max: 300, step: 5, default: 30,  type: 'slider' },
    { id: 'contrast',   label: 'Caustic Sharpness', min: 0, max: 400, step: 5, default: 325, type: 'slider' },
    { id: 'drift',      label: 'Current',         min: 0, max: 400, step: 5, default: 20,  type: 'slider' },
    { id: 'warp',       label: 'Surface Warp',    min: 0, max: 300, step: 5, default: 20,  type: 'slider' },
    { id: 'softness',   label: 'Softness',        min: 0, max: 80,  step: 1, default: 0,   type: 'slider' },
    { id: 'sheen',      label: 'Shimmer',         min: 0, max: 100, step: 1, default: 23,  type: 'slider' },
    { id: 'invert',     label: 'Light the Veins', options: ['On', 'Off'], default: 'On', type: 'select' },
    { id: 'shading',    label: 'Shading',         options: ['Blended', 'Flat'], default: 'Blended', type: 'select' }
  ],

  /* Anime Cells is the flat end of the same engine: no drift, no shimmer, no
     shading, and contrast at the top of the range so each cell is one colour
     with a drawn line around it. */

  /* THE FIVE ANIMAL PRINTS
     One builder, five sets of defaults, so a slider means the same thing on
     each of them.

     Coverage is the new one, and it is the control that was missing. Every
     one of these prints is a noise field cut at a threshold: below the cut is
     coat, above it is marking. Coverage *is* that cut, so it is the only
     honest way to ask for more stripe and less tiger. The old panel had no
     such slider — it offered "Stripe Weight", which drove Fractal Noise's
     Contrast, and contrast cannot move a threshold, it can only steepen the
     edge at whichever threshold you already have. Left at its maximum it
     drove the whole field past white and every print but the giraffe came out
     one flat colour.

     Evolution Speed is no longer 0 anywhere. A print that holds perfectly
     still is a texture; these are meant to be backgrounds. */
  Giraffe: [
    { id: 'scaleAll',  label: 'Pattern Scale',   min: 20, max: 300, step: 5, default: 100, type: 'slider' },
    { id: 'coverage',  label: 'Patch Coverage',  min: 5,  max: 95,  step: 1, default: 62,  type: 'slider' },
    { id: 'contrast',  label: 'Edge Sharpness',  min: 40, max: 400, step: 5, default: 400, type: 'slider' },
    { id: 'warp',      label: 'Irregularity',    min: 0,  max: 300, step: 5, default: 25,  type: 'slider' },
    { id: 'softness',  label: 'Edge Softness',   min: 0,  max: 40,  step: 1, default: 5,   type: 'slider' },
    { id: 'speed',     label: 'Evolution Speed', min: 0,  max: 100, step: 1, default: 5,   type: 'slider' }
  ],
  Tiger: [
    { id: 'scaleAll',  label: 'Pattern Scale',   min: 20, max: 300, step: 5, default: 100, type: 'slider' },
    { id: 'coverage',  label: 'Stripe Coverage', min: 5,  max: 95,  step: 1, default: 34,  type: 'slider' },
    { id: 'contrast',  label: 'Edge Sharpness',  min: 40, max: 400, step: 5, default: 340, type: 'slider' },
    { id: 'warp',      label: 'Irregularity',    min: 0,  max: 300, step: 5, default: 70,  type: 'slider' },
    { id: 'softness',  label: 'Edge Softness',   min: 0,  max: 40,  step: 1, default: 2,   type: 'slider' },
    { id: 'speed',     label: 'Evolution Speed', min: 0,  max: 100, step: 1, default: 6,   type: 'slider' }
  ],
  Zebra: [
    { id: 'scaleAll',  label: 'Pattern Scale',   min: 20, max: 300, step: 5, default: 100, type: 'slider' },
    { id: 'coverage',  label: 'Stripe Coverage', min: 5,  max: 95,  step: 1, default: 45,  type: 'slider' },
    { id: 'contrast',  label: 'Edge Sharpness',  min: 40, max: 400, step: 5, default: 400, type: 'slider' },
    { id: 'warp',      label: 'Irregularity',    min: 0,  max: 300, step: 5, default: 110, type: 'slider' },
    { id: 'softness',  label: 'Edge Softness',   min: 0,  max: 40,  step: 1, default: 2,   type: 'slider' },
    { id: 'speed',     label: 'Evolution Speed', min: 0,  max: 100, step: 1, default: 5,   type: 'slider' }
  ],
  /* Leopard is the one print with three colours, so Coverage sets where the
     ring starts and the core lands 20% of the range above it. Push Coverage
     up and the rosettes join into a single dark coat, which is roughly what
     happens to a real one. */
  Leopard: [
    { id: 'scaleAll',  label: 'Pattern Scale',    min: 20, max: 300, step: 5, default: 100, type: 'slider' },
    { id: 'coverage',  label: 'Rosette Coverage', min: 5,  max: 95,  step: 1, default: 30,  type: 'slider' },
    { id: 'contrast',  label: 'Edge Sharpness',   min: 40, max: 400, step: 5, default: 200, type: 'slider' },
    { id: 'warp',      label: 'Irregularity',     min: 0,  max: 300, step: 5, default: 30,  type: 'slider' },
    { id: 'softness',  label: 'Edge Softness',    min: 0,  max: 40,  step: 1, default: 3,   type: 'slider' },
    { id: 'speed',     label: 'Evolution Speed',  min: 0,  max: 100, step: 1, default: 4,   type: 'slider' }
  ],
  Cow: [
    { id: 'scaleAll',  label: 'Pattern Scale',   min: 20, max: 300, step: 5, default: 100, type: 'slider' },
    { id: 'coverage',  label: 'Patch Coverage',  min: 5,  max: 95,  step: 1, default: 42,  type: 'slider' },
    { id: 'contrast',  label: 'Edge Sharpness',  min: 40, max: 400, step: 5, default: 400, type: 'slider' },
    { id: 'warp',      label: 'Irregularity',    min: 0,  max: 300, step: 5, default: 40,  type: 'slider' },
    { id: 'softness',  label: 'Edge Softness',   min: 0,  max: 40,  step: 1, default: 4,   type: 'slider' },
    { id: 'speed',     label: 'Evolution Speed', min: 0,  max: 100, step: 1, default: 3,   type: 'slider' }
  ],

  /* Fur takes the two sliders that actually define it — how long the
     filaments are and how fine the noise that cuts them is — instead of the
     Irregularity slider the flat prints get. Fibre Size is the delicate one:
     it wants to be far below the shapes it is shredding, and once it climbs
     past about 20 the pelt turns back into an ordinary wobbled print. */
  Fur: [
    { id: 'scaleAll',  label: 'Coat Scale',      min: 20, max: 300,  step: 5,  default: 100, type: 'slider' },
    { id: 'coverage',  label: 'Guard Hair',      min: 5,  max: 95,   step: 1,  default: 45,  type: 'slider' },
    { id: 'warp',      label: 'Fibre Length',    min: 0,  max: 2000, step: 20, default: 900, type: 'slider' },
    { id: 'warpSize',  label: 'Fibre Size',      min: 1,  max: 40,   step: 1,  default: 3,   type: 'slider' },
    { id: 'contrast',  label: 'Coat Mottling',   min: 40, max: 400,  step: 5,  default: 180, type: 'slider' },
    { id: 'softness',  label: 'Edge Softness',   min: 0,  max: 40,   step: 1,  default: 1,   type: 'slider' },
    { id: 'speed',     label: 'Evolution Speed', min: 0,  max: 100,  step: 1,  default: 3,   type: 'slider' }
  ],

  /* SNAKESKIN NOW *IS* HAMMERED, and that is the whole point of the change.

     These were two entries on one recipe. Snakeskin ran
     buildMetalTexture(..., 'Hammered') with the shine dropped and the drift
     stopped, on the theory that the same dimple lattice reads as scales when
     it is lit like skin rather than like copper. Hammered Metal ran it with
     the shine up. Two presets, one height field, and the pair of them close
     enough that keeping both was offering the same gradient twice.

     Hammered is gone from the library and its settings are here. Specular is
     back at 95 and roughness at 14 — the hard, low-roughness response that
     made it the one tile on the first contact sheet anybody believed — and
     the drift is running again at 6, because a surface that holds perfectly
     still reads as a photograph of a surface.

     Scale stays at 110, which is the one number that was genuinely Snakeskin's
     rather than inherited. Hammered's lattice is 90px at scale 100, so 110
     puts the cells at 99px — about twenty across a 1920 frame, which is the
     proportion the reference boards show. The 45 it was set to before gave 48
     cells across, and 48 cells is a crinkle, not a field of scales.

     Existing saved presets keep whatever they stored, so nothing anybody has
     already made changes. */
  Snakeskin: [
    { id: 'scaleAll',    label: 'Scale Size',    min: 15, max: 200, step: 5, default: 110, type: 'slider' },
    { id: 'relief',      label: 'Scale Depth',   min: 0,  max: 100, step: 1, default: 55,  type: 'slider' },
    { id: 'bands',       label: 'Reflections',   min: 1,  max: 40,  step: 1, default: 4,   type: 'slider' },
    { id: 'brushLength', label: 'Stretch',       min: 0,  max: 200, step: 5, default: 0,   type: 'slider' },
    { id: 'warp',        label: 'Irregularity',  min: 0,  max: 250, step: 5, default: 25,  type: 'slider' },
    { id: 'lightAngle',  label: 'Light Angle',   min: 0,  max: 360, step: 1, default: 310, type: 'slider' },
    { id: 'lightHeight', label: 'Light Height',  min: 0,  max: 100, step: 1, default: 38,  type: 'slider' },
    { id: 'specular',    label: 'Specular',      min: 0,  max: 100, step: 1, default: 95,  type: 'slider' },
    { id: 'roughness',   label: 'Roughness',     min: 1,  max: 100, step: 1, default: 14,  type: 'slider' },
    { id: 'sheen',       label: 'Bloom',         min: 0,  max: 100, step: 1, default: 22,  type: 'slider' },
    { id: 'softness',    label: 'Softness',      min: 0,  max: 40,  step: 1, default: 0,   type: 'slider' },
    { id: 'speed',       label: 'Drift Speed',   min: 0,  max: 60,  step: 1, default: 6,   type: 'slider' }
  ],

  /* THE MOLTEN METALS — Copper, Gold, Silver.

     One shader, one geometry, three palettes. The defaults below are not
     chosen numbers, they are the positions at which the sliders reproduce the
     recipe that was tuned by hand in After Effects and read back off the
     layer — see MOLTEN in jsx/main.jsx. Moving one moves away from a metal
     that is known to work, which is a fine thing to do deliberately and a bad
     thing to do by accident, so they are all here rather than hidden.

       Relief       scales the shader's Height and Displacement together, and
                    those are NEGATIVE on these three. It changes how deep the
                    surface is without flipping the sign that makes the bright
                    band fall into the trough of a fold instead of sitting on
                    its ridge.
       Reflections  33 by default, not the 6 the old metals used. Six wide
                    bands is a showroom mirror; thirty-three narrow ones is
                    what a curved liquid surface does to a window.
       Crumple      adds to the measured displacement rather than replacing
                    it, so 0 is the tuned pour and up is more violent. */
  Copper: [
    { id: 'scaleAll',    label: 'Surface Scale', min: 20, max: 300, step: 5, default: 100, type: 'slider' },
    { id: 'relief',      label: 'Relief',        min: 0,  max: 100, step: 1, default: 30,  type: 'slider' },
    { id: 'bands',       label: 'Reflections',   min: 1,  max: 60,  step: 1, default: 33,  type: 'slider' },
    { id: 'warp',        label: 'Extra Churn',   min: 0,  max: 250, step: 5, default: 0,   type: 'slider' },
    { id: 'lightAngle',  label: 'Light Angle',   min: 0,  max: 360, step: 1, default: 58,  type: 'slider' },
    { id: 'lightHeight', label: 'Light Height',  min: 0,  max: 100, step: 1, default: 45,  type: 'slider' },
    { id: 'specular',    label: 'Specular',      min: 0,  max: 100, step: 1, default: 90,  type: 'slider' },
    { id: 'roughness',   label: 'Roughness',     min: 1,  max: 100, step: 1, default: 17,  type: 'slider' },
    { id: 'sheen',       label: 'Bloom',         min: 0,  max: 100, step: 1, default: 28,  type: 'slider' },
    { id: 'softness',    label: 'Softness',      min: 0,  max: 40,  step: 1, default: 0,   type: 'slider' },
    { id: 'speed',       label: 'Drift Speed',   min: 0,  max: 60,  step: 1, default: 7,   type: 'slider' }
  ],
  Gold: [
    { id: 'scaleAll',    label: 'Surface Scale', min: 20, max: 300, step: 5, default: 100, type: 'slider' },
    { id: 'relief',      label: 'Relief',        min: 0,  max: 100, step: 1, default: 30,  type: 'slider' },
    { id: 'bands',       label: 'Reflections',   min: 1,  max: 60,  step: 1, default: 33,  type: 'slider' },
    { id: 'warp',        label: 'Extra Churn',   min: 0,  max: 250, step: 5, default: 0,   type: 'slider' },
    { id: 'lightAngle',  label: 'Light Angle',   min: 0,  max: 360, step: 1, default: 72,  type: 'slider' },
    { id: 'lightHeight', label: 'Light Height',  min: 0,  max: 100, step: 1, default: 52,  type: 'slider' },
    { id: 'specular',    label: 'Specular',      min: 0,  max: 100, step: 1, default: 96,  type: 'slider' },
    { id: 'roughness',   label: 'Roughness',     min: 1,  max: 100, step: 1, default: 14,  type: 'slider' },
    { id: 'sheen',       label: 'Bloom',         min: 0,  max: 100, step: 1, default: 34,  type: 'slider' },
    { id: 'softness',    label: 'Softness',      min: 0,  max: 40,  step: 1, default: 0,   type: 'slider' },
    { id: 'speed',       label: 'Drift Speed',   min: 0,  max: 60,  step: 1, default: 7,   type: 'slider' }
  ],
  Silver: [
    { id: 'scaleAll',    label: 'Surface Scale', min: 20, max: 300, step: 5, default: 100, type: 'slider' },
    { id: 'relief',      label: 'Relief',        min: 0,  max: 100, step: 1, default: 30,  type: 'slider' },
    { id: 'bands',       label: 'Reflections',   min: 1,  max: 60,  step: 1, default: 33,  type: 'slider' },
    { id: 'warp',        label: 'Extra Churn',   min: 0,  max: 250, step: 5, default: 0,   type: 'slider' },
    { id: 'lightAngle',  label: 'Light Angle',   min: 0,  max: 360, step: 1, default: 44,  type: 'slider' },
    { id: 'lightHeight', label: 'Light Height',  min: 0,  max: 100, step: 1, default: 40,  type: 'slider' },
    { id: 'specular',    label: 'Specular',      min: 0,  max: 100, step: 1, default: 98,  type: 'slider' },
    { id: 'roughness',   label: 'Roughness',     min: 1,  max: 100, step: 1, default: 9,   type: 'slider' },
    { id: 'sheen',       label: 'Bloom',         min: 0,  max: 100, step: 1, default: 22,  type: 'slider' },
    { id: 'softness',    label: 'Softness',      min: 0,  max: 40,  step: 1, default: 0,   type: 'slider' },
    { id: 'speed',       label: 'Drift Speed',   min: 0,  max: 60,  step: 1, default: 7,   type: 'slider' }
  ],

  /* CRUMPLED FOIL takes a different set, because most of the metal sliders
     drive a reflection stage this preset does not have. Crease Depth and
     Crease Size are the two that matter — Size is a Turbulent Displace at
     around two pixels, and it is genuinely that small: at 10 the creases turn
     back into ordinary wobbles. */
  Foil: [
    { id: 'scaleAll',    label: 'Sheet Scale',   min: 20, max: 300,  step: 5, default: 100, type: 'slider' },
    { id: 'crumpleAmount', label: 'Crease Depth', min: 0, max: 1200, step: 10, default: 718, type: 'slider' },
    { id: 'crumpleSize', label: 'Crease Size',   min: 1,  max: 40,   step: 1, default: 2,   type: 'slider' },
    { id: 'relief',      label: 'Relief',        min: 0,  max: 100,  step: 1, default: 30,  type: 'slider' },
    { id: 'lightAngle',  label: 'Light Angle',   min: 0,  max: 360,  step: 1, default: 305, type: 'slider' },
    { id: 'lightHeight', label: 'Light Height',  min: 0,  max: 100,  step: 1, default: 67,  type: 'slider' },
    { id: 'specular',    label: 'Specular',      min: 0,  max: 100,  step: 1, default: 63,  type: 'slider' },
    /* 42, not 1. The control default overrides the preset table, so a
       Roughness of 1 here pinned the foil to a mirror no matter what
       METAL_SURFACES.Foil said — see the units note beside it. */
    { id: 'roughness',   label: 'Roughness',     min: 1,  max: 100,  step: 1, default: 42,  type: 'slider' },
    { id: 'softness',    label: 'Softness',      min: 0,  max: 40,   step: 1, default: 0,   type: 'slider' },
    { id: 'speed',       label: 'Drift Speed',   min: 0,  max: 60,   step: 1, default: 5,   type: 'slider' }
  ],

  /* BRUSHED STEEL, rebuilt against the foil rather than against the metals
     that never worked. Brush Length is the one that defines it: the blur runs
     along the grain and leaves the surface sharp across it. */
  Brushed: [
    { id: 'scaleAll',    label: 'Surface Scale', min: 20, max: 300, step: 5, default: 100, type: 'slider' },
    { id: 'relief',      label: 'Relief',        min: 0,  max: 100, step: 1, default: 30,  type: 'slider' },
    { id: 'bands',       label: 'Reflections',   min: 1,  max: 40,  step: 1, default: 5,   type: 'slider' },
    { id: 'brushLength', label: 'Brush Length',  min: 0,  max: 200, step: 5, default: 80,  type: 'slider' },
    { id: 'warp',        label: 'Crumple',       min: 0,  max: 250, step: 5, default: 0,   type: 'slider' },
    { id: 'lightAngle',  label: 'Light Angle',   min: 0,  max: 360, step: 1, default: 300, type: 'slider' },
    { id: 'lightHeight', label: 'Light Height',  min: 0,  max: 100, step: 1, default: 55,  type: 'slider' },
    { id: 'specular',    label: 'Specular',      min: 0,  max: 100, step: 1, default: 60,  type: 'slider' },
    { id: 'roughness',   label: 'Roughness',     min: 1,  max: 100, step: 1, default: 1,   type: 'slider' },
    { id: 'sheen',       label: 'Bloom',         min: 0,  max: 100, step: 1, default: 10,  type: 'slider' },
    { id: 'softness',    label: 'Softness',      min: 0,  max: 40,  step: 1, default: 0,   type: 'slider' },
    { id: 'speed',       label: 'Drift Speed',   min: 0,  max: 60,  step: 1, default: 4,   type: 'slider' }
  ],
  AnimeCells: [
    { id: 'pattern',    label: 'Cell Shape',
      options: ['Static Plates', 'Static Crystals', 'Static Crystallize',
                'Static Mixed Crystals', 'Plates', 'Crystals'],
      default: 'Static Plates', type: 'select' },
    { id: 'cells',      label: 'Cell Density',  min: 5, max: 200, step: 1, default: 120, type: 'slider' },
    { id: 'dispersion', label: 'Irregularity',  min: 0, max: 100, step: 1, default: 100, type: 'slider' },
    { id: 'contrast',   label: 'Line Weight',   min: 0, max: 400, step: 5, default: 400, type: 'slider' },
    { id: 'speed',      label: 'Evolution Speed', min: 0, max: 300, step: 5, default: 0, type: 'slider' },
    { id: 'drift',      label: 'Drift',         min: 0, max: 400, step: 5, default: 0,  type: 'slider' },
    { id: 'warp',       label: 'Organic Warp',  min: 0, max: 300, step: 5, default: 0,  type: 'slider' },
    { id: 'sheen',      label: 'Edge Glow',     min: 0, max: 100, step: 1, default: 0,  type: 'slider' },
    { id: 'invert',     label: 'Invert Cells',  options: ['On', 'Off'], default: 'On', type: 'select' },
    { id: 'shading',    label: 'Shading',       options: ['Flat', 'Blended'], default: 'Flat', type: 'select' }
  ],
  Heatmap: [
    { id: 'noiseScale', label: 'Thermal Scale', min: 10, max: 300, step: 10, default: 150, type: 'slider' },
    { id: 'speed', label: 'Thermal Shift', min: 10, max: 150, step: 5, default: 40, type: 'slider' },
    { id: 'contrast', label: 'Contrast', min: 20, max: 200, step: 5, default: 80, type: 'slider' }
  ],
  Halftone: [
    { id: 'shape', label: 'Dot Shape', options: ['Circle', 'Square', 'Triangle', 'Cross', 'Custom Text/Emoji'], default: 'Circle', type: 'select' },
    { id: 'customText', label: 'Custom Symbol', type: 'text', default: '💀' },
    { id: 'field',     label: 'Gradient Shape', options: ['Linear', 'Radial', 'Organic'], default: 'Linear', type: 'select' },
    { id: 'direction', label: 'Gradient Angle', min: 0,  max: 360, step: 1, default: 90,  type: 'slider' },
    { id: 'dotSize',   label: 'Dot Size',       min: 4,  max: 120, step: 1, default: 20,  type: 'slider' },
    { id: 'coverage',  label: 'Ink Coverage',   min: 10, max: 245, step: 1, default: 128, type: 'slider' },
    { id: 'contrast',  label: 'Tone Spread',    min: 20, max: 255, step: 5, default: 128, type: 'slider' },
    { id: 'warp',      label: 'Flow Warp',      min: 0,  max: 900, step: 10, default: 260, type: 'slider' },
    { id: 'angle',     label: 'Screen Angle',   min: 0,  max: 90,  step: 1, default: 45,  type: 'slider' },
    { id: 'edge',      label: 'Edge Hardness',  min: 1,  max: 100, step: 1, default: 82,  type: 'slider' },
    { id: 'speed',     label: 'Flow Speed',     min: 0,  max: 100, step: 1, default: 12,  type: 'slider' }
  ],
  AsciiMatrix: [
    { id: 'gridSize', label: 'Grid Size', min: 10, max: 150, step: 2, default: 40, type: 'slider' },
    { id: 'chars', label: 'Characters (Dark->Light)', type: 'text', default: ' .-+#@' },
    { id: 'speed', label: 'Gradient Speed', min: 1, max: 100, step: 1, default: 30, type: 'slider' },
    { id: 'colorize', label: 'Colorize Mode', options: ['Gradient Colors', 'Pure White', 'Matrix Green'], default: 'Gradient Colors', type: 'select' }
  ],
  Fluid: [
    { id: 'twirlAngle', label: 'Twirl Angle', min: -10, max: 10, step: 1, default: 1, type: 'slider' },
    { id: 'twirlRadius', label: 'Twirl Radius', min: 0, max: 100, step: 1, default: 30, type: 'slider' },
    { id: 'waveType', label: 'Wave Type', options: ['Sine', 'Square', 'Triangle', 'Sawtooth', 'Circle', 'Semicircle', 'Smooth Noise', 'Noise'], default: 'Circle', type: 'select' },
    { id: 'waveHeight', label: 'Wave Height', min: 0, max: 1000, step: 10, default: 500, type: 'slider' },
    { id: 'waveWidth', label: 'Wave Width', min: 0, max: 1000, step: 10, default: 660, type: 'slider' },
    { id: 'waveSpeed', label: 'Wave Speed', min: 0, max: 2, step: 0.1, default: 0.2, type: 'slider' },
    { id: 'waveDirection', label: 'Wave Direction', min: 0, max: 360, step: 1, default: 45, type: 'slider' },
    { id: 'noiseAmount', label: 'Noise Amount', min: 0, max: 100, step: 1, default: 4, type: 'slider' }
  ],
  Wavy: [
    { id: 'waveType', label: 'Wave Type', options: ['Sine', 'Square', 'Triangle', 'Sawtooth', 'Circle', 'Semicircle'], default: 'Sawtooth', type: 'select' },
    { id: 'waveHeight', label: 'Wave Height', min: 0, max: 500, step: 10, default: 160, type: 'slider' },
    { id: 'waveWidth', label: 'Wave Width', min: 0, max: 500, step: 10, default: 60, type: 'slider' },
    { id: 'waveDirection', label: 'Wave Direction', min: -180, max: 180, step: 1, default: -90, type: 'slider' },
    { id: 'waveSpeed', label: 'Wave Speed', min: 0, max: 5, step: 0.1, default: 0.6, type: 'slider' },
    { id: 'turbType', label: 'Turbulence Type', options: ['Turbulent', 'Bulge', 'Twist', 'Smooth'], default: 'Twist', type: 'select' },
    { id: 'turbAmount', label: 'Turbulence Amount', min: 0, max: 500, step: 10, default: 50, type: 'slider' },
    { id: 'turbSize', label: 'Turbulence Size', min: 10, max: 1000, step: 10, default: 100, type: 'slider' },
    { id: 'turbEvolution', label: 'Evolution Speed', min: 10, max: 200, step: 10, default: 50, type: 'slider' }
  ],
  Sunburst: [
    { id: 'rays',          label: 'Number of Rays', min: 3,    max: 120, step: 1, default: 18, type: 'slider' },
    { id: 'thickness',     label: 'Ray Thickness',  min: 5,    max: 95,  step: 1, default: 50, type: 'slider' },
    { id: 'rotationSpeed', label: 'Rotation Speed', min: -180, max: 180, step: 1, default: 15, type: 'slider' },
    { id: 'pulse',         label: 'Ray Pulse',      min: 0,    max: 100, step: 1, default: 0,  type: 'slider' },
    { id: 'softness',      label: 'Edge Softness',  min: 0,    max: 100, step: 1, default: 0,  type: 'slider' },
    { id: 'coreSize',      label: 'Centre Disc',    min: 0,    max: 100, step: 1, default: 0,  type: 'slider' },
    { id: 'centerX',       label: 'Centre X',       min: 0,    max: 100, step: 1, default: 50, type: 'slider' },
    { id: 'centerY',       label: 'Centre Y',       min: 0,    max: 100, step: 1, default: 50, type: 'slider' }
  ],
  TrailGradient: [
    /* Trail Width is the only rebuild here: it sets how many strokes there
       are and how wide each solid is, and a solid cannot be resized after the
       fact. Everything below is an effect property or an expression, so it
       lands on the drag. */
    { id: 'width',      label: 'Trail Width',  min: 10,  max: 200,  step: 5,  default: 60,  type: 'slider' },
    { id: 'cycleSpeed', label: 'Cycle Speed',  min: 100, max: 2000, step: 50, default: 600, type: 'slider' },
    { id: 'phase',      label: 'Phase Pattern',
      options: ['Linear', 'Sine', 'Mirror', 'Random', 'Counterflow'],
      default: 'Linear', type: 'select' },
    { id: 'spread',     label: 'Phase Spread', min: 0,   max: 200,  step: 5,  default: 100, type: 'slider' },
    { id: 'warpStyle',  label: 'Warp Style',
      options: ['Squeeze', 'Arc', 'Arch', 'Bulge', 'Flag', 'Wave', 'Fish',
                'Rise', 'Fisheye', 'Inflate', 'Twist', 'Flat'],
      default: 'Squeeze', type: 'select' },
    { id: 'warpAxis',   label: 'Warp Axis', options: ['Horizontal', 'Vertical'],
      default: 'Horizontal', type: 'select' },
    { id: 'bend',       label: 'Arc Bend',     min: -100, max: 100, step: 1,  default: 30,  type: 'slider' },
    { id: 'colorOrder', label: 'Colour Order', options: ['Palette', 'By Luminance'],
      default: 'Palette', type: 'select' }
  ],
  CellularMosaic: [
    { id: 'pattern',    label: 'Pattern Type',
      options: ['Bubbles', 'Crystals', 'Plates', 'Crystallize', 'Static Plates',
                'Static Crystals', 'Static Crystallize', 'Mixed Crystals', 'Static Mixed Crystals'],
      default: 'Bubbles', type: 'select' },
    { id: 'cells',      label: 'Cell Density',    min: 5, max: 200, step: 1, default: 50,  type: 'slider' },
    { id: 'dispersion', label: 'Dispersion',      min: 0, max: 100, step: 1, default: 50,  type: 'slider' },
    { id: 'speed',      label: 'Evolution Speed', min: 0, max: 300, step: 5, default: 80,  type: 'slider' },
    { id: 'contrast',   label: 'Cell Contrast',   min: 0, max: 400, step: 5, default: 140, type: 'slider' },
    { id: 'drift',      label: 'Drift',           min: 0, max: 400, step: 5, default: 60,  type: 'slider' },
    { id: 'warp',       label: 'Organic Warp',    min: 0, max: 300, step: 5, default: 30,  type: 'slider' },
    { id: 'softness',   label: 'Softness',        min: 0, max: 80,  step: 1, default: 4,   type: 'slider' },
    { id: 'sheen',      label: 'Cell Glow',       min: 0, max: 100, step: 1, default: 20,  type: 'slider' },
    { id: 'invert',     label: 'Invert Cells',    options: ['Off', 'On'], default: 'Off', type: 'select' },
    { id: 'shading',    label: 'Shading',         options: ['Blended', 'Flat'], default: 'Blended', type: 'select' }
  ],
  SonduckLiquid: [
    { id: 'speed', label: 'Speed', min: 1, max: 100, step: 1, default: 20, type: 'slider' }
  ],
  LavaLamp: [
    { id: 'blobSize', label: 'Blob Size',   min: 100, max: 900, step: 10, default: 420, type: 'slider' },
    /* Melt is Fractal Noise Contrast. Low, the field stays a cloud; high, the
       bright parts break into separate islands. It is the difference between
       a haze and a lamp, so it leads. */
    { id: 'melt',     label: 'Melt',        min: 80,  max: 400, step: 5,  default: 190, type: 'slider' },
    { id: 'rise',     label: 'Rise Speed',  min: 0,   max: 200, step: 5,  default: 45,  type: 'slider' },
    { id: 'wobble',   label: 'Wobble',      min: 0,   max: 300, step: 5,  default: 70,  type: 'slider' },
    { id: 'morph',    label: 'Morph Speed', min: 0,   max: 60,  step: 1,  default: 12,  type: 'slider' },
    { id: 'softness', label: 'Softness',    min: 0,   max: 60,  step: 1,  default: 10,  type: 'slider' },
    { id: 'heat',     label: 'Heat Glow',   min: 0,   max: 100, step: 1,  default: 35,  type: 'slider' }
  ],
  StackedSquares: [
    { id: 'speed', label: 'Speed', min: 1, max: 100, step: 1, default: 20, type: 'slider' }
  ],
  PrismaticBurst: [
    { id: 'speed', label: 'Speed', min: 10, max: 300, step: 10, default: 100, type: 'slider' },
    { id: 'rayCount', label: 'Ray Density', min: 2, max: 50, step: 1, default: 5, type: 'slider' },
    { id: 'distort', label: 'Distortion', min: 10, max: 500, step: 10, default: 250, type: 'slider' }
  ],
  WebThreads: [
    { id: 'speed', label: 'Speed', min: 0.1, max: 5, step: 0.1, default: 0.4, type: 'slider' },
    { id: 'threadCount', label: 'Thread Count', min: 1, max: 50, step: 1, default: 10, type: 'slider' },
    { id: 'frequency', label: 'Frequency', min: 1, max: 50, step: 1, default: 14, type: 'slider' },
    { id: 'spread', label: 'Spread', min: 0.01, max: 0.2, step: 0.01, default: 0.06, type: 'slider' },
    { id: 'taper', label: 'Taper', min: 1, max: 10, step: 0.1, default: 3, type: 'slider' },
    { id: 'position', label: 'Pinch Position', min: 0, max: 1, step: 0.01, default: 0.59, type: 'slider' },
    { id: 'thickness', label: 'Thickness', min: 0.1, max: 10, step: 0.1, default: 1.1, type: 'slider' },
    { id: 'glow', label: 'Glow', min: 0, max: 0.1, step: 0.01, default: 0.02, type: 'slider' }
  ]
};

/* Format a value for display: keep decimals only where the step needs them,
   so 0.30 stays 0.30 but 250 does not become 250.00. */
function formatCtrlValue(ctrl, value) {
  var n = parseFloat(value);
  if (isNaN(n)) return String(value);
  if (ctrl.type !== 'slider') return String(value);
  return (ctrl.step < 1) ? n.toFixed(2) : String(Math.round(n));
}

/* Paint the filled portion of a range input.
   Range inputs cannot style their own progress, so the track is a gradient
   whose stop is driven by a custom property. */
function paintRange(el) {
  const min = parseFloat(el.min), max = parseFloat(el.max);
  const pct = ((parseFloat(el.value) - min) / (max - min)) * 100;
  el.style.setProperty('--pct', pct + '%');
  /* The range input is invisible now; the capsule around it draws the fill. */
  const cap = el.closest('.ctrl-slider');
  if (cap) cap.style.setProperty('--pct', pct + '%');
}

/* -- THE XY PAD ------------------------------------------------------

   A Figma-style position control: a square of dots with a draggable handle.

   Some gradients are not about a ramp between corners at all. A SaaS-style
   background is mostly empty space with one big soft bloom pushed off to a
   side, and *where that bloom sits* is the entire design decision. Offering
   that as two sliders labelled X and Y is technically complete and
   completely unusable: nobody thinks in coordinates, they think 'up and to
   the left'.

   THE TRICK THAT MAKES THIS FREE

   The pad does not introduce a new value type. It writes into two ordinary
   hidden number inputs named ctrl-<id>X and ctrl-<id>Y, which means every
   system already in the panel keeps working with no changes at all:

     - getControlValues() reads them like any other control
     - the coalesced live-update path carries them to After Effects mid-drag
     - applyPolledControls() writes into them when a layer is selected in AE
     - loading a preset restores them

   and the pad listens to its own hidden inputs and moves the dot to match.
   So the dot follows After Effects as readily as After Effects follows the
   dot, and none of that needed writing twice.

   Values are 0-100 in both axes, X left to right and Y top to bottom, so
   they map onto a comp by multiplying by width and height. */

function buildXYPad(ctrl, item, reset, label) {
  var defX = (ctrl.default && ctrl.default.length) ? ctrl.default[0] : 50;
  var defY = (ctrl.default && ctrl.default.length) ? ctrl.default[1] : 50;

  var head = document.createElement('div');
  head.className = 'ctrl-row is-xy-head';
  head.appendChild(label);
  head.appendChild(reset);

  var readout = document.createElement('span');
  readout.className = 'xy-readout';
  head.appendChild(readout);
  item.appendChild(head);

  /* The values themselves. Hidden rather than absent: everything downstream
     finds a control with getElementById('ctrl-' + key), so these ARE the
     control as far as the rest of the panel is concerned. */
  var fx = document.createElement('input');
  fx.type = 'hidden';
  fx.id = 'ctrl-' + ctrl.id + 'X';
  fx.value = defX;

  var fy = document.createElement('input');
  fy.type = 'hidden';
  fy.id = 'ctrl-' + ctrl.id + 'Y';
  fy.value = defY;

  item.appendChild(fx);
  item.appendChild(fy);

  var pad = document.createElement('div');
  pad.className = 'xy-pad';
  pad.tabIndex = 0;
  pad.setAttribute('role', 'application');
  pad.setAttribute('aria-label', ctrl.label + ' position. Arrow keys to nudge.');

  var dot = document.createElement('div');
  dot.className = 'xy-dot';
  pad.appendChild(dot);
  item.appendChild(pad);

  if (ctrl.hint) {
    var hint = document.createElement('p');
    hint.className = 'ctrl-hint';
    hint.textContent = ctrl.hint;
    item.appendChild(hint);
  }

  function paint() {
    var x = parseFloat(fx.value), y = parseFloat(fy.value);
    if (isNaN(x)) x = defX;
    if (isNaN(y)) y = defY;
    dot.style.left = x + '%';
    dot.style.top = y + '%';
    readout.textContent = Math.round(x) + ', ' + Math.round(y);
  }

  function commit(x, y) {
    fx.value = Math.max(0, Math.min(100, x)).toFixed(1);
    fy.value = Math.max(0, Math.min(100, y)).toFixed(1);
    paint();
    if (typeof window.triggerRealtimeUpdate === 'function') window.triggerRealtimeUpdate();
  }

  /* Pointer events rather than mouse events, and setPointerCapture rather
     than a document-level listener. Capture is what keeps the drag alive
     when the pointer leaves the pad. Without it the dot sticks at the edge
     the moment you overshoot, which is exactly when you are trying to push
     the bloom right off the frame. */
  /* The rect is measured once, when the drag starts, and reused for the whole
     drag. Re-measuring on every move looks more correct and is not: the
     inspector is a scrolling column, so anything that scrolls it mid-drag
     moves the pad out from under a pointer that has not moved, and the handle
     lurches. Freezing the frame of reference at pointerdown makes the drag
     immune to layout shifting underneath it. */
  var rect = null;

  function fromEvent(e) {
    var r = rect || pad.getBoundingClientRect();
    if (!r.width || !r.height) return;
    commit(((e.clientX - r.left) / r.width) * 100,
           ((e.clientY - r.top) / r.height) * 100);
  }

  var dragging = false;

  pad.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    dragging = true;
    rect = pad.getBoundingClientRect();
    pad.classList.add('is-dragging');
    try { pad.setPointerCapture(e.pointerId); } catch (err) { }

    /* preventScroll is load-bearing. Focusing an element scrolls it into
       view, and the pad lives near the bottom of a scrolling inspector -- so
       without this, grabbing it scrolls the column, the pad moves, and the
       first thing the drag does is throw the handle to an edge. It cost an
       afternoon to find because it only shows on one axis: scrolling is
       vertical, so X behaved perfectly and Y pinned itself to 100. */
    pad.focus({ preventScroll: true });

    fromEvent(e);
  });

  pad.addEventListener('pointermove', function (e) {
    if (dragging) fromEvent(e);
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    rect = null;
    pad.classList.remove('is-dragging');
    try { pad.releasePointerCapture(e.pointerId); } catch (err) { }
  }
  pad.addEventListener('pointerup', endDrag);
  pad.addEventListener('pointercancel', endDrag);

  /* Arrow keys, because a pad alone cannot hit 50,50 exactly and dead
     centre is a value people genuinely want. Shift is the coarse step,
     Home recentres. */
  pad.addEventListener('keydown', function (e) {
    var step = e.shiftKey ? 10 : 1;
    var x = parseFloat(fx.value), y = parseFloat(fy.value);
    var handled = true;
    switch (e.key) {
      case 'ArrowLeft':  x -= step; break;
      case 'ArrowRight': x += step; break;
      case 'ArrowUp':    y -= step; break;
      case 'ArrowDown':  y += step; break;
      case 'Home':       x = 50; y = 50; break;
      default: handled = false;
    }
    if (!handled) return;
    e.preventDefault();
    commit(x, y);
  });

  pad.addEventListener('dblclick', function () { commit(defX, defY); });
  reset.addEventListener('click', function () { commit(defX, defY); });

  /* When After Effects pushes values back (the sync poller, or a preset
     being loaded) it writes the hidden inputs and fires 'input' on them.
     Listening here keeps the dot honest without anyone downstream having to
     remember to move it. */
  fx.addEventListener('input', paint);
  fy.addEventListener('input', paint);

  paint();
}

function renderControls(type) {
  const container = document.getElementById('controls-container');
  if (!container) return;

  const controls = GRADIENT_CONTROLS[type] || [];
  container.innerHTML = '';

  if (!controls.length) {
    container.innerHTML =
      '<p class="ctrl-empty">This gradient has no adjustable settings yet — ' +
      'the colours above still apply.</p>';
    return;
  }

  const group = document.createElement('div');
  group.className = 'ctrl-group';

  controls.forEach(ctrl => {
    const item = document.createElement('div');
    item.className = 'ctrl';
    item.dataset.id = ctrl.id;

    const reset = document.createElement('button');
    reset.className = 'ctrl-reset';
    reset.type = 'button';
    reset.title = 'Reset to ' + ctrl.default;
    reset.setAttribute('aria-label', 'Reset ' + ctrl.label + ' to default');
    reset.textContent = '⟲';

    const label = document.createElement('span');
    label.className = 'ctrl-label';
    label.textContent = ctrl.label;

    if (ctrl.type === 'xy') {
      buildXYPad(ctrl, item, reset, label);

    } else if (ctrl.type === 'select' || ctrl.type === 'text') {
      /* Selects, text fields and sliders share one capsule, so a column of
         mixed controls still reads as a single list rather than as three
         different kinds of widget stacked up. */
      const row = document.createElement('div');
      row.className = 'ctrl-row' + (ctrl.type === 'select' ? ' has-select' : '');
      row.appendChild(label);

      let input;
      if (ctrl.type === 'select') {
        input = document.createElement('select');
        ctrl.options.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt;
          option.textContent = opt;
          input.appendChild(option);
        });
        input.value = ctrl.default;
        input.addEventListener('change', function () {
          if (ctrl.id === 'shape') syncCustomTextVisibility(this.value);
          if (typeof window.triggerRealtimeUpdate === 'function') window.triggerRealtimeUpdate();
        });
        reset.addEventListener('click', () => {
          input.value = ctrl.default;
          input.dispatchEvent(new Event('change'));
        });
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.value = ctrl.default;
        input.addEventListener('input', function () {
          if (typeof window.triggerRealtimeUpdate === 'function') window.triggerRealtimeUpdate();
        });
        reset.addEventListener('click', () => {
          input.value = ctrl.default;
          input.dispatchEvent(new Event('input'));
        });
      }
      input.className = 'custom-select';
      input.id = 'ctrl-' + ctrl.id;

      label.setAttribute('for', input.id);
      row.appendChild(reset);
      row.appendChild(input);
      item.appendChild(row);

      if (ctrl.id === 'shape') setTimeout(() => syncCustomTextVisibility(input.value), 10);

    } else {
      /* The capsule is the slider. The range input is invisible and stretched
         across everything but the number field, so the drag target is the
         width of the panel instead of a 4px track, and the fill behind the
         label carries the value. */
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'ctrl-range';
      slider.id = 'ctrl-' + ctrl.id;
      slider.min = ctrl.min;
      slider.max = ctrl.max;
      slider.step = ctrl.step;
      slider.value = ctrl.default;
      slider.setAttribute('aria-label', ctrl.label);

      const num = document.createElement('input');
      num.type = 'number';
      num.className = 'ctrl-num';
      num.id = 'num-' + ctrl.id;
      num.min = ctrl.min;
      num.max = ctrl.max;
      num.step = ctrl.step;
      num.value = formatCtrlValue(ctrl, ctrl.default);

      const commit = (source) => {
        if (source !== num) num.value = formatCtrlValue(ctrl, slider.value);
        paintRange(slider);
        if (typeof window.triggerRealtimeUpdate === 'function') window.triggerRealtimeUpdate();
      };

      slider.addEventListener('input', () => commit(slider));

      num.addEventListener('input', () => {
        const v = parseFloat(num.value);
        if (isNaN(v)) return;                       // mid-typing, leave it alone
        slider.value = Math.min(ctrl.max, Math.max(ctrl.min, v));
        paintRange(slider);
        if (typeof window.triggerRealtimeUpdate === 'function') window.triggerRealtimeUpdate();
      });

      // Clamp only on blur, so typing "1" on the way to "150" is not fought.
      num.addEventListener('blur', () => {
        let v = parseFloat(num.value);
        if (isNaN(v)) v = ctrl.default;
        v = Math.min(ctrl.max, Math.max(ctrl.min, v));
        slider.value = v;
        num.value = formatCtrlValue(ctrl, v);
        commit(num);
      });

      reset.addEventListener('click', () => {
        slider.value = ctrl.default;
        num.value = formatCtrlValue(ctrl, ctrl.default);
        commit(num);
      });

      const cap = document.createElement('div');
      cap.className = 'ctrl-slider';
      cap.appendChild(slider);
      cap.appendChild(label);
      cap.appendChild(reset);
      cap.appendChild(num);
      item.appendChild(cap);
      paintRange(slider);
    }

    group.appendChild(item);
  });

  container.appendChild(group);
}

/* The Custom Text field only makes sense for one shape option. */
function syncCustomTextVisibility(shapeValue) {
  const textInput = document.getElementById('ctrl-customText');
  if (!textInput) return;
  const row = textInput.closest('.ctrl');
  if (row) row.style.display = (shapeValue === 'Custom Text/Emoji') ? '' : 'none';
}

function getControlValues(type) {
  const controls = GRADIENT_CONTROLS[type] || [];
  const vals = {};
  controls.forEach(ctrl => {
    /* An xy pad is two values under one label, so it reports as two keys.
       Flat numbers rather than a nested array on purpose: this payload is
       JSON-stringified into ExtendScript, and flat is one less thing for a
       1999 JavaScript engine to get wrong. */
    if (ctrl.type === 'xy') {
      const ex = document.getElementById('ctrl-' + ctrl.id + 'X');
      const ey = document.getElementById('ctrl-' + ctrl.id + 'Y');
      const dx = (ctrl.default && ctrl.default.length) ? ctrl.default[0] : 50;
      const dy = (ctrl.default && ctrl.default.length) ? ctrl.default[1] : 50;
      vals[ctrl.id + 'X'] = ex ? parseFloat(ex.value) : dx;
      vals[ctrl.id + 'Y'] = ey ? parseFloat(ey.value) : dy;
      return;
    }

    const el = document.getElementById('ctrl-' + ctrl.id);
    if (el) {
      vals[ctrl.id] = (ctrl.type === 'select') ? el.value : parseFloat(el.value);
    } else {
      vals[ctrl.id] = ctrl.default;
    }
  });
  return vals;
}


/* ── Config integrity check ────────────────────────────────────────────
   GRADIENT_CONTROLS carries slider definitions for several types that have
   no card in GRADIENT_LIBRARY and no builder in jsx/main.jsx. They are kept
   deliberately as a roadmap, but nothing renders them, so log them once
   rather than leaving the next reader to work that out from three files. */
(function reportUnimplementedTypes() {
  if (typeof GRADIENT_LIBRARY === 'undefined') return;

  const shipped = GRADIENT_LIBRARY.map(g => g.id);
  const planned = Object.keys(GRADIENT_CONTROLS).filter(k => shipped.indexOf(k) === -1);
  const missingControls = shipped.filter(id => !GRADIENT_CONTROLS[id]);

  if (planned.length) {
    console.info('[Living Gradients] Controls defined but not shipped (no card, no builder):', planned.join(', '));
  }
  if (missingControls.length) {
    console.warn('[Living Gradients] Cards with no control definitions — these render an empty inspector:', missingControls.join(', '));
  }
})();
