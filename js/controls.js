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
  Metallic: [
    { id: 'finish',      label: 'Finish',
      options: ['Chrome', 'Iridescent', 'Brushed', 'Y2K Chrome'],
      default: 'Chrome', type: 'select' },
    { id: 'bands',       label: 'Reflection Bands', min: 2,  max: 60,  step: 1,  default: 6,   type: 'slider' },
    { id: 'tilt',        label: 'Band Tilt',        min: 0,  max: 100, step: 1,  default: 12,  type: 'slider' },
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
    { id: 'specular',    label: 'Specular',       min: 0,   max: 150, step: 1,  default: 85,  type: 'slider' },
    { id: 'roughness',   label: 'Roughness',      min: 1,   max: 100, step: 1,  default: 8,   type: 'slider' },
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

  /* THE SHADED METALS
     Eight presets, one shader, so a slider means the same thing on every one
     of them. These are not texture sliders any more — they are the inputs a
     renderer takes:

       Relief       how deep the surface actually is. 0 is a mirror.
       Reflections  how much environment the metal has to reflect. Few wide
                    bands is a showroom; many narrow ones is a workshop.
       Light Angle / Light Height
                    where the lamp is. Height is elevation: low is raking
                    light that finds every scratch, high is overhead and
                    flattens the surface out.
       Specular / Roughness
                    the material response. High specular with low roughness
                    is a polished mirror; drop specular and raise roughness
                    and the same surface turns to cast iron.

     Drift Speed is never 0 by default. A metal that holds perfectly still
     reads as a photograph of metal rather than as a living background. */
  Polished: [
    { id: 'scaleAll',    label: 'Surface Scale', min: 20, max: 300, step: 5, default: 100, type: 'slider' },
    { id: 'relief',      label: 'Relief',        min: 0,  max: 100, step: 1, default: 12,  type: 'slider' },
    { id: 'bands',       label: 'Reflections',   min: 1,  max: 40,  step: 1, default: 5,   type: 'slider' },
    { id: 'brushLength', label: 'Brush Length',  min: 0,  max: 200, step: 5, default: 0,   type: 'slider' },
    { id: 'warp',        label: 'Crumple',       min: 0,  max: 400, step: 5, default: 60,  type: 'slider' },
    { id: 'lightAngle',  label: 'Light Angle',   min: 0,  max: 360, step: 1, default: 315, type: 'slider' },
    { id: 'lightHeight', label: 'Light Height',  min: 0,  max: 100, step: 1, default: 55,  type: 'slider' },
    { id: 'specular',    label: 'Specular',      min: 0,  max: 150, step: 1, default: 110, type: 'slider' },
    { id: 'roughness',   label: 'Roughness',     min: 1,  max: 100, step: 1, default: 4,   type: 'slider' },
    { id: 'sheen',       label: 'Bloom',         min: 0,  max: 100, step: 1, default: 25,  type: 'slider' },
    { id: 'softness',    label: 'Softness',      min: 0,  max: 40,  step: 1, default: 0,   type: 'slider' },
    { id: 'speed',       label: 'Drift Speed',   min: 0,  max: 60,  step: 1, default: 6,   type: 'slider' }
  ],
  Brushed: [
    { id: 'scaleAll',    label: 'Surface Scale', min: 20, max: 300, step: 5, default: 100, type: 'slider' },
    { id: 'relief',      label: 'Relief',        min: 0,  max: 100, step: 1, default: 30,  type: 'slider' },
    { id: 'bands',       label: 'Reflections',   min: 1,  max: 40,  step: 1, default: 3,   type: 'slider' },
    { id: 'brushLength', label: 'Brush Length',  min: 0,  max: 200, step: 5, default: 80,  type: 'slider' },
    { id: 'warp',        label: 'Crumple',       min: 0,  max: 400, step: 5, default: 0,   type: 'slider' },
    { id: 'lightAngle',  label: 'Light Angle',   min: 0,  max: 360, step: 1, default: 300, type: 'slider' },
    { id: 'lightHeight', label: 'Light Height',  min: 0,  max: 100, step: 1, default: 32,  type: 'slider' },
    { id: 'specular',    label: 'Specular',      min: 0,  max: 150, step: 1, default: 70,  type: 'slider' },
    { id: 'roughness',   label: 'Roughness',     min: 1,  max: 100, step: 1, default: 28,  type: 'slider' },
    { id: 'sheen',       label: 'Bloom',         min: 0,  max: 100, step: 1, default: 14,  type: 'slider' },
    { id: 'softness',    label: 'Softness',      min: 0,  max: 40,  step: 1, default: 0,   type: 'slider' },
    { id: 'speed',       label: 'Drift Speed',   min: 0,  max: 60,  step: 1, default: 4,   type: 'slider' }
  ],
  Gold: [
    { id: 'scaleAll',    label: 'Surface Scale', min: 20, max: 300, step: 5, default: 100, type: 'slider' },
    { id: 'relief',      label: 'Relief',        min: 0,  max: 100, step: 1, default: 26,  type: 'slider' },
    { id: 'bands',       label: 'Reflections',   min: 1,  max: 40,  step: 1, default: 4,   type: 'slider' },
    { id: 'brushLength', label: 'Brush Length',  min: 0,  max: 200, step: 5, default: 0,   type: 'slider' },
    { id: 'warp',        label: 'Crumple',       min: 0,  max: 400, step: 5, default: 120, type: 'slider' },
    { id: 'lightAngle',  label: 'Light Angle',   min: 0,  max: 360, step: 1, default: 320, type: 'slider' },
    { id: 'lightHeight', label: 'Light Height',  min: 0,  max: 100, step: 1, default: 45,  type: 'slider' },
    { id: 'specular',    label: 'Specular',      min: 0,  max: 150, step: 1, default: 120, type: 'slider' },
    { id: 'roughness',   label: 'Roughness',     min: 1,  max: 100, step: 1, default: 8,   type: 'slider' },
    { id: 'sheen',       label: 'Bloom',         min: 0,  max: 100, step: 1, default: 34,  type: 'slider' },
    { id: 'softness',    label: 'Softness',      min: 0,  max: 40,  step: 1, default: 0,   type: 'slider' },
    { id: 'speed',       label: 'Drift Speed',   min: 0,  max: 60,  step: 1, default: 8,   type: 'slider' }
  ],
  Copper: [
    { id: 'scaleAll',    label: 'Surface Scale', min: 20, max: 300, step: 5, default: 100, type: 'slider' },
    { id: 'relief',      label: 'Relief',        min: 0,  max: 100, step: 1, default: 22,  type: 'slider' },
    { id: 'bands',       label: 'Reflections',   min: 1,  max: 40,  step: 1, default: 4,   type: 'slider' },
    { id: 'brushLength', label: 'Brush Length',  min: 0,  max: 200, step: 5, default: 0,   type: 'slider' },
    { id: 'warp',        label: 'Crumple',       min: 0,  max: 400, step: 5, default: 90,  type: 'slider' },
    { id: 'lightAngle',  label: 'Light Angle',   min: 0,  max: 360, step: 1, default: 330, type: 'slider' },
    { id: 'lightHeight', label: 'Light Height',  min: 0,  max: 100, step: 1, default: 48,  type: 'slider' },
    { id: 'specular',    label: 'Specular',      min: 0,  max: 150, step: 1, default: 105, type: 'slider' },
    { id: 'roughness',   label: 'Roughness',     min: 1,  max: 100, step: 1, default: 10,  type: 'slider' },
    { id: 'sheen',       label: 'Bloom',         min: 0,  max: 100, step: 1, default: 28,  type: 'slider' },
    { id: 'softness',    label: 'Softness',      min: 0,  max: 40,  step: 1, default: 0,   type: 'slider' },
    { id: 'speed',       label: 'Drift Speed',   min: 0,  max: 60,  step: 1, default: 7,   type: 'slider' }
  ],
  Gunmetal: [
    { id: 'scaleAll',    label: 'Surface Scale', min: 20, max: 300, step: 5, default: 100, type: 'slider' },
    { id: 'relief',      label: 'Relief',        min: 0,  max: 100, step: 1, default: 34,  type: 'slider' },
    { id: 'bands',       label: 'Reflections',   min: 1,  max: 40,  step: 1, default: 6,   type: 'slider' },
    { id: 'brushLength', label: 'Brush Length',  min: 0,  max: 200, step: 5, default: 20,  type: 'slider' },
    { id: 'warp',        label: 'Crumple',       min: 0,  max: 400, step: 5, default: 40,  type: 'slider' },
    { id: 'lightAngle',  label: 'Light Angle',   min: 0,  max: 360, step: 1, default: 290, type: 'slider' },
    { id: 'lightHeight', label: 'Light Height',  min: 0,  max: 100, step: 1, default: 26,  type: 'slider' },
    { id: 'specular',    label: 'Specular',      min: 0,  max: 150, step: 1, default: 55,  type: 'slider' },
    { id: 'roughness',   label: 'Roughness',     min: 1,  max: 100, step: 1, default: 45,  type: 'slider' },
    { id: 'sheen',       label: 'Bloom',         min: 0,  max: 100, step: 1, default: 8,   type: 'slider' },
    { id: 'softness',    label: 'Softness',      min: 0,  max: 40,  step: 1, default: 0,   type: 'slider' },
    { id: 'speed',       label: 'Drift Speed',   min: 0,  max: 60,  step: 1, default: 4,   type: 'slider' }
  ],
  Hammered: [
    { id: 'scaleAll',    label: 'Surface Scale', min: 20, max: 300, step: 5, default: 100, type: 'slider' },
    { id: 'relief',      label: 'Relief',        min: 0,  max: 100, step: 1, default: 55,  type: 'slider' },
    { id: 'bands',       label: 'Reflections',   min: 1,  max: 40,  step: 1, default: 4,   type: 'slider' },
    { id: 'brushLength', label: 'Brush Length',  min: 0,  max: 200, step: 5, default: 0,   type: 'slider' },
    { id: 'warp',        label: 'Crumple',       min: 0,  max: 400, step: 5, default: 25,  type: 'slider' },
    { id: 'lightAngle',  label: 'Light Angle',   min: 0,  max: 360, step: 1, default: 310, type: 'slider' },
    { id: 'lightHeight', label: 'Light Height',  min: 0,  max: 100, step: 1, default: 38,  type: 'slider' },
    { id: 'specular',    label: 'Specular',      min: 0,  max: 150, step: 1, default: 95,  type: 'slider' },
    { id: 'roughness',   label: 'Roughness',     min: 1,  max: 100, step: 1, default: 14,  type: 'slider' },
    { id: 'sheen',       label: 'Bloom',         min: 0,  max: 100, step: 1, default: 22,  type: 'slider' },
    { id: 'softness',    label: 'Softness',      min: 0,  max: 40,  step: 1, default: 0,   type: 'slider' },
    { id: 'speed',       label: 'Drift Speed',   min: 0,  max: 60,  step: 1, default: 6,   type: 'slider' }
  ],
  Foil: [
    { id: 'scaleAll',    label: 'Surface Scale', min: 20, max: 300, step: 5, default: 100, type: 'slider' },
    { id: 'relief',      label: 'Relief',        min: 0,  max: 100, step: 1, default: 70,  type: 'slider' },
    { id: 'bands',       label: 'Reflections',   min: 1,  max: 40,  step: 1, default: 8,   type: 'slider' },
    { id: 'brushLength', label: 'Brush Length',  min: 0,  max: 200, step: 5, default: 0,   type: 'slider' },
    { id: 'warp',        label: 'Crumple',       min: 0,  max: 400, step: 5, default: 240, type: 'slider' },
    { id: 'lightAngle',  label: 'Light Angle',   min: 0,  max: 360, step: 1, default: 305, type: 'slider' },
    { id: 'lightHeight', label: 'Light Height',  min: 0,  max: 100, step: 1, default: 30,  type: 'slider' },
    { id: 'specular',    label: 'Specular',      min: 0,  max: 150, step: 1, default: 130, type: 'slider' },
    { id: 'roughness',   label: 'Roughness',     min: 1,  max: 100, step: 1, default: 6,   type: 'slider' },
    { id: 'sheen',       label: 'Bloom',         min: 0,  max: 100, step: 1, default: 30,  type: 'slider' },
    { id: 'softness',    label: 'Softness',      min: 0,  max: 40,  step: 1, default: 0,   type: 'slider' },
    { id: 'speed',       label: 'Drift Speed',   min: 0,  max: 60,  step: 1, default: 10,  type: 'slider' }
  ],
  /* Mercury is the same shader with the height field turned into blobs rather
     than tooling — a liquid, so Relief is high, Roughness near zero, and it
     moves faster than any of the plates. */
  Mercury: [
    { id: 'scaleAll',    label: 'Blob Scale',    min: 20, max: 300, step: 5, default: 100, type: 'slider' },
    { id: 'relief',      label: 'Relief',        min: 0,  max: 100, step: 1, default: 85,  type: 'slider' },
    { id: 'bands',       label: 'Reflections',   min: 1,  max: 40,  step: 1, default: 3,   type: 'slider' },
    { id: 'brushLength', label: 'Brush Length',  min: 0,  max: 200, step: 5, default: 0,   type: 'slider' },
    { id: 'warp',        label: 'Surface Churn', min: 0,  max: 400, step: 5, default: 160, type: 'slider' },
    { id: 'lightAngle',  label: 'Light Angle',   min: 0,  max: 360, step: 1, default: 315, type: 'slider' },
    { id: 'lightHeight', label: 'Light Height',  min: 0,  max: 100, step: 1, default: 60,  type: 'slider' },
    { id: 'specular',    label: 'Specular',      min: 0,  max: 150, step: 1, default: 140, type: 'slider' },
    { id: 'roughness',   label: 'Roughness',     min: 1,  max: 100, step: 1, default: 2,   type: 'slider' },
    { id: 'sheen',       label: 'Bloom',         min: 0,  max: 100, step: 1, default: 38,  type: 'slider' },
    { id: 'softness',    label: 'Softness',      min: 0,  max: 40,  step: 1, default: 0,   type: 'slider' },
    { id: 'speed',       label: 'Flow Speed',    min: 0,  max: 60,  step: 1, default: 14,  type: 'slider' }
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
  LiquidWaves: [
    { id: 'speed',      label: 'Flow Speed',   min: 1,  max: 200, step: 1,  default: 30,  type: 'slider' },
    { id: 'scale',      label: 'Wave Scale',   min: 20, max: 900, step: 10, default: 260, type: 'slider' },
    { id: 'turbulence', label: 'Turbulence',   min: 0,  max: 600, step: 10, default: 140, type: 'slider' },
    { id: 'bands',      label: 'Band Density', min: 40, max: 600, step: 10, default: 200, type: 'slider' },
    { id: 'complexity', label: 'Complexity',   min: 1,  max: 10,  step: 1,  default: 4,   type: 'slider' },
    { id: 'blur',       label: 'Softness',     min: 0,  max: 100, step: 1,  default: 6,   type: 'slider' }
  ],
  TrailGradient: [
    { id: 'width', label: 'Trail Width', min: 10, max: 200, step: 5, default: 60, type: 'slider' },
    { id: 'cycleSpeed', label: 'Cycle Speed', min: 100, max: 2000, step: 50, default: 600, type: 'slider' },
    { id: 'bend', label: 'Arc Bend', min: -100, max: 100, step: 1, default: 30, type: 'slider' }
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
  TwirlShapes: [
    { id: 'speed', label: 'Speed', min: 1, max: 100, step: 1, default: 20, type: 'slider' }
  ],
  LavaLamp: [
    { id: 'speed', label: 'Speed', min: 1, max: 100, step: 1, default: 15, type: 'slider' }
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

    if (ctrl.type === 'select' || ctrl.type === 'text') {
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
