/* ============================================
   PRESETS.JS — Dynamic Library of Gradient Styles
   ============================================ */

/* How many colours a gradient takes, and what each one is for.

   Four swatches for everything was a panel convention, not a property of the
   gradients — Halftone genuinely has an ink and a paper, Sunburst has rays and
   a backdrop, and forcing those into four anonymous slots meant the builder
   had to guess which was which (it sorted them by luminance and hoped).

   A type listed here gets exactly these slots, labelled. Anything not listed
   keeps four unlabelled ones and behaves as it always has. `defaultColors` in
   the library below supplies the starting values and must match the length. */
const COLOR_ROLES = {
  Metallic:       ['Shadow', 'Base Metal', 'Bright', 'Highlight'],
  Halftone:       ['Ink A', 'Ink B', 'Paper'],
  Sunburst:       ['Ray A', 'Ray B', 'Backdrop'],
  LiquidWaves:    ['Deep', 'Mid', 'Bright', 'Crest'],
  Glass:          ['Shadow', 'Body', 'Sheen', 'Flare'],
  ReededGlass:    ['Deep', 'Mid', 'Bright', 'Crest'],
  CellularMosaic: ['Void', 'Wall', 'Cell', 'Core'],
  AnimeWater:     ['Deep', 'Mid Water', 'Surface', 'Caustic'],
  AnimeCells:     ['Outline', 'Fill', 'Accent', 'Line'],
  Giraffe:        ['Coat', 'Patches'],
  Tiger:          ['Coat', 'Stripes'],
  Zebra:          ['Coat', 'Stripes'],
  Cow:            ['Coat', 'Patches'],
  Leopard:        ['Coat', 'Rosette Ring', 'Rosette Core'],

  /* The shaded metals. These four are not a ramp between corners — they are
     the four things a lit metal surface is made of, and the shader uses each
     one for a different job:

       Shadow      what the surface reflects where nothing is lighting it
       Base Metal  the body colour — the part that says copper, not steel
       Bright      the reflected environment's light side
       Highlight   the specular hit itself

     Getting these in the wrong order is the difference between gold and mud,
     which is why they are named rather than sorted by luminance. */
  Brushed:        ['Shadow', 'Base Metal', 'Bright', 'Highlight'],
  Polished:       ['Shadow', 'Base Metal', 'Bright', 'Highlight'],
  Hammered:       ['Shadow', 'Base Metal', 'Bright', 'Highlight'],
  Foil:           ['Shadow', 'Base Metal', 'Bright', 'Highlight'],
  Gold:           ['Shadow', 'Base Metal', 'Bright', 'Highlight'],
  Copper:         ['Shadow', 'Base Metal', 'Bright', 'Highlight'],
  Mercury:        ['Shadow', 'Base Metal', 'Bright', 'Highlight'],
  Gunmetal:       ['Shadow', 'Base Metal', 'Bright', 'Highlight']
};

/* The slots for a type: its declared roles, or four unlabelled. */
function colorRolesFor(type) {
  return COLOR_ROLES[type] || [null, null, null, null];
}

const GRADIENT_LIBRARY = [

  /* WAVES & FLOW
     Anything that reads as moving liquid or a travelling wave. Grouped by
     what it looks like, not by where the recipe came from. */
  { id: 'Wavy', category: 'Waves & Flow', label: 'Wavy', cssClass: 'preview-living', defaultColors: ['#0055FF', '#FF0055', '#5500FF', '#000000'] },
  { id: 'LiquidWaves', category: 'Waves & Flow', label: 'Liquid Waves', cssClass: 'preview-liquid', defaultColors: ['#FF0055', '#5500FF', '#00DDFF', '#FFAA00'] },
  { id: 'SonduckLiquid', category: 'Waves & Flow', label: 'Liquid Ribbons', cssClass: 'preview-sonduckliquid', defaultColors: ['#FF3366', '#33CCFF', '#111111', '#111111'] },
  { id: 'Waves', category: 'Waves & Flow', label: 'Waves', cssClass: 'preview-waves', defaultColors: ['#5227FF', '#000000', '#111111', '#111111'] },
  { id: 'Fluid', category: 'Waves & Flow', label: 'Fluid Gradient', cssClass: 'preview-liquid', defaultColors: ['#0099CC', '#0033FF', '#CC00FF', '#4A0080'] },

  /* SILKFLARE ENGINE
     One builder, seven presets. These are finished — do not refactor them
     into the shared engine without a side-by-side render first. */
  { id: 'Silk', category: 'SilkFlare Engine', label: 'Silk', cssClass: 'preview-silk', defaultColors: ['#FFB3C6', '#BDE0FE', '#CAFFBF', '#FDFFB6'] },
  { id: 'Aurora', category: 'SilkFlare Engine', label: 'Aurora', cssClass: 'preview-sf-aurora', defaultColors: ['#00FF99', '#00AAFF', '#AA00FF', '#001133'] },
  { id: 'Prism', category: 'SilkFlare Engine', label: 'Prism', cssClass: 'preview-prism', defaultColors: ['#FF00FF', '#00FFFF', '#FF00AA', '#00FF88'] },
  { id: 'Fiber', category: 'SilkFlare Engine', label: 'Fiber', cssClass: 'preview-fiber', defaultColors: ['#FFD700', '#FFA500', '#B8860B', '#4A3800'] },
  { id: 'Veil', category: 'SilkFlare Engine', label: 'Veil', cssClass: 'preview-veil', defaultColors: ['#111111', '#1a1a2e', '#16213e', '#0f3460'] },
  { id: 'Pulse', category: 'SilkFlare Engine', label: 'Pulse', cssClass: 'preview-pulse', defaultColors: ['#FF4500', '#FF6B00', '#CC2200', '#440000'] },
  { id: 'Comet', category: 'SilkFlare Engine', label: 'Comet', cssClass: 'preview-comet', defaultColors: ['#006994', '#0099CC', '#00CED1', '#003366'] },

  /* AMBIENT & ORGANIC
     Soft, slow, no hard edges. The backdrop end of the library. */
  { id: 'OklabSmooth', category: 'Ambient & Organic', label: 'Oklab Smooth', cssClass: 'preview-living', defaultColors: ['#FF0000', '#00FFFF', '#FF00FF', '#FFFF00'] },
  { id: 'living', category: 'Ambient & Organic', label: 'Living Gradient', cssClass: 'preview-living', defaultColors: ['#FF6B35', '#FF3366', '#CC00FF', '#0033FF'] },
  { id: 'TrailGradient', category: 'Ambient & Organic', label: 'Trail Gradient', cssClass: 'preview-trail', defaultColors: ['#FF0055', '#5500FF', '#00DDFF', '#FFAA00'] },
  { id: 'LavaLamp', category: 'Ambient & Organic', label: 'Lava Lamp', cssClass: 'preview-lavalamp', defaultColors: ['#FFCC00', '#FF3300', '#990000', '#009900'] },
  { id: 'TwirlShapes', category: 'Ambient & Organic', label: 'Twirl Shapes', cssClass: 'preview-twirlshapes', defaultColors: ['#00FF99', '#FF0055', '#111111', '#111111'] },

  /* LIGHT & ENERGY
     Rays, bursts, threads and heat — anything whose subject is the light
     itself rather than the surface it falls on. */
  { id: 'Sunburst', category: 'Light & Energy', label: 'Sunburst', cssClass: 'preview-sunburst', defaultColors: ['#FF4500', '#FFD700', '#1A0A00'] },
  { id: 'PrismaticBurst', category: 'Light & Energy', label: 'Prismatic Burst', cssClass: 'preview-prismatic', defaultColors: ['#FF00FF', '#00FFFF', '#00FF88', '#000000'] },
  { id: 'ChromaFlare', category: 'Light & Energy', label: 'ChromaFlare', cssClass: 'preview-chromaflare', defaultColors: ['#FF00FF', '#00FFFF', '#FF00AA', '#00FF88'] },
  { id: 'Heatmap', category: 'Light & Energy', label: 'Heatmap', cssClass: 'preview-heat', defaultColors: ['#000033', '#FF0000', '#FFFF00', '#FFFFFF'] },
  { id: 'Antigravity', category: 'Light & Energy', label: 'Antigravity', cssClass: 'preview-antigravity', defaultColors: ['#FF9FFC', '#5227FF', '#FF00FF', '#111111'] },
  { id: 'WebThreads', category: 'Light & Energy', label: 'Web Threads', cssClass: 'preview-webthreads', defaultColors: ['#230a89', '#ac07a7', '#882828', '#111111'] },

  /* ANIME & 2D
     Flat, drawn backgrounds rather than gradients — the section to grow as
     more 2D looks land. Both of these run on the Cell Pattern engine. */
  { id: 'AnimeWater', category: 'Anime & 2D', label: 'Anime Water', cssClass: 'preview-anime-water', defaultColors: ['#02141F', '#0A3A52', '#1E88A8', '#CFF6FF'] },
  { id: 'AnimeCells', category: 'Anime & 2D', label: 'Anime Cells', cssClass: 'preview-anime-water', defaultColors: ['#12000E', '#FF00FF', '#FF66FF', '#FFE600'] },

  /* ANIMAL PRINTS
     Five presets on one builder. Two or three swatches each rather than four:
     these are flat prints, so the palette is the coat and its markings, not a
     ramp between corners. */
  { id: 'Giraffe', category: 'Animal Prints', label: 'Giraffe', cssClass: 'preview-cellular', defaultColors: ['#F3E0C0', '#C4703A'] },
  { id: 'Tiger', category: 'Animal Prints', label: 'Tiger', cssClass: 'preview-cellular', defaultColors: ['#F08A21', '#1A1008'] },
  { id: 'Zebra', category: 'Animal Prints', label: 'Zebra', cssClass: 'preview-cellular', defaultColors: ['#F5F2EC', '#14110E'] },
  { id: 'Leopard', category: 'Animal Prints', label: 'Leopard', cssClass: 'preview-cellular', defaultColors: ['#E3C078', '#2E1A08', '#A8762E'] },
  { id: 'Cow', category: 'Animal Prints', label: 'Cow', cssClass: 'preview-cellular', defaultColors: ['#F7F5F0', '#191714'] },

  /* PRINT & PATTERN
     Screens, grids and cells. Repeating structure you can count. */
  { id: 'Halftone', category: 'Print & Pattern', label: 'Halftone', cssClass: 'preview-halftone', defaultColors: ['#12101A', '#5227FF', '#F4F1EA'] },
  { id: 'AsciiMatrix', category: 'Print & Pattern', label: 'ASCII Matrix', cssClass: 'preview-ascii', defaultColors: ['#000000', '#004400', '#00AA00', '#00FF00'] },
  { id: 'CellularMosaic', category: 'Print & Pattern', label: 'Cellular Mosaic', cssClass: 'preview-cellular', defaultColors: ['#00FF99', '#00AAFF', '#AA00FF', '#001133'] },
  { id: 'StackedSquares', category: 'Print & Pattern', label: 'Stacked Squares', cssClass: 'preview-stackedsquares', defaultColors: ['#FF3300', '#FFCC00', '#FF0066', '#9900FF'] },

  /* GLASS
     Surfaces you see *through*. Both of these are a colour field with a
     surface in front of it, and the surface is the preset — the frosted one
     is a rippled sheet, the reeded one is a row of flutes. */
  { id: 'Glass', category: 'Glass', label: 'Frosted Glass', cssClass: 'preview-glass', defaultColors: ['#0B1622', '#3E6E8C', '#BFE3F0', '#FFFFFF'] },
  { id: 'ReededGlass', category: 'Glass', label: 'Reeded Glass', cssClass: 'preview-reeded', defaultColors: ['#003366', '#0099CC', '#00CED1', '#E6E6FA'] },

  /* LIQUID METAL
     Flow, not surface. These two are about metal *moving* — bands of
     reflection sliding over each other — which is a different look from a
     still metal plate and belongs in its own section rather than sitting at
     the top of Metal pretending to be one of them. */
  { id: 'Metallic', category: 'Liquid Metal', label: 'Liquid Chrome', cssClass: 'preview-pulse', defaultColors: ['#05070C', '#3E5A78', '#B9D4E8', '#FFFFFF'] },
  { id: 'Mercury', category: 'Liquid Metal', label: 'Liquid Mercury', cssClass: 'preview-pulse', defaultColors: ['#04070A', '#6C7A85', '#C3D2DB', '#FFFFFF'] },

  /* METAL
     A lit metal surface, shaded rather than drawn. Each of these is a height
     field under a real light — CC Glass's Blinn-Phong shader with Metal at
     full, so the specular takes the metal's own colour instead of the
     light's. That is the whole reason gold reads as gold here and read as a
     yellow gradient before.

     The palettes are the metals. Shadow / Base Metal / Bright / Highlight, in
     that order, and the order is load-bearing. */
  { id: 'Polished', category: 'Metal', label: 'Polished Chrome', cssClass: 'preview-pulse', defaultColors: ['#05070C', '#46586B', '#B7CBDD', '#FFFFFF'] },
  { id: 'Brushed', category: 'Metal', label: 'Brushed Steel', cssClass: 'preview-pulse', defaultColors: ['#16191C', '#5C6570', '#AEB8C2', '#F2F6FA'] },
  { id: 'Gold', category: 'Metal', label: 'Molten Gold', cssClass: 'preview-pulse', defaultColors: ['#2B1A05', '#A9791C', '#F0C05A', '#FFF2C4'] },
  { id: 'Copper', category: 'Metal', label: 'Polished Copper', cssClass: 'preview-pulse', defaultColors: ['#2A0E06', '#9E4B22', '#E08A55', '#FFD9BE'] },
  { id: 'Gunmetal', category: 'Metal', label: 'Gunmetal', cssClass: 'preview-pulse', defaultColors: ['#07090B', '#2E3946', '#6E7F92', '#C9D8E4'] },
  { id: 'Hammered', category: 'Metal', label: 'Hammered Metal', cssClass: 'preview-pulse', defaultColors: ['#0E1113', '#4A535B', '#9BA7B2', '#E8EEF4'] },
  { id: 'Foil', category: 'Metal', label: 'Crumpled Foil', cssClass: 'preview-pulse', defaultColors: ['#0A0C0F', '#6E7A86', '#C6D2DC', '#FFFFFF'] }
];
