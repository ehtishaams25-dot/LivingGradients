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
  Halftone:       ['Ink A', 'Ink B', 'Paper'],
  Sunburst:       ['Ray A', 'Ray B', 'Backdrop'],
  LavaLamp:       ['Lamp Fluid', 'Blob Edge', 'Blob Body', 'Blob Core'],
  Glass:          ['Shadow', 'Body', 'Sheen', 'Flare'],
  ReededGlass:    ['Deep', 'Mid', 'Bright', 'Crest'],
  CellularMosaic: ['Void', 'Wall', 'Cell', 'Core'],
  AnimeWater:     ['Deep', 'Mid Water', 'Surface', 'Caustic'],
  AnimeCells:     ['Outline', 'Fill', 'Accent', 'Line'],
  Giraffe:        ['Coat', 'Patches'],
  Tiger:          ['Coat', 'Stripes'],
  Zebra:          ['Coat', 'Stripes'],
  Cow:            ['Coat', 'Patches'],
  Fur:            ['Undercoat', 'Guard Hair'],
  Leopard:        ['Coat', 'Rosette Ring', 'Rosette Core'],
  Snakeskin:      ['Deep Scale', 'Body', 'Bright Scale', 'Sheen'],

  /* Liquid Chrome was a metal, was never a plate, and is now filed with the
     waves it always looked like. Its roles say so: this is a ramp folded into
     ribbons, so the slots are the ribbon's tones and not a lit surface's. */
  Metallic:       ['Deep', 'Mid', 'Bright', 'Crest'],

  /* THE MOLTEN METALS TAKE THREE COLOURS, AND THAT IS NOT A SIMPLIFICATION.

     CC Toner in Tritone has three stops. It was being handed five, and two of
     them — Brights and Darktones — are inert in that mode, so two of the four
     swatches on these gradients moved nothing at all. Three named slots is
     what the shader actually consumes:

       Shadow      what the surface reflects where nothing is lighting it
       Base Metal  the body colour — the part that says copper, not steel
       Highlight   the specular hit itself

     A four-colour preset saved before this still works: the builder takes the
     first, the middle and the last. */
  Copper:         ['Shadow', 'Base Metal', 'Highlight'],
  Gold:           ['Shadow', 'Base Metal', 'Highlight'],
  Silver:         ['Shadow', 'Base Metal', 'Highlight'],

  /* The other three still run the five-stop ramp, so they keep four. */
  Brushed:        ['Shadow', 'Base Metal', 'Bright', 'Highlight'],
  Foil:           ['Shadow', 'Base Metal', 'Bright', 'Highlight'],

  /* The only gradient in the library whose first swatch is the BACKGROUND
     rather than a stop in a ramp. In this look the background is most of what
     you see, so it gets the first slot and says so. */
  SaaS:           ['Background', 'Bloom', 'Accent Bloom', 'Third Bloom']
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
  { id: 'SonduckLiquid', category: 'Waves & Flow', label: 'Liquid Ribbons', cssClass: 'preview-sonduckliquid', defaultColors: ['#FF3366', '#33CCFF', '#111111', '#111111'] },
  { id: 'Waves', category: 'Waves & Flow', label: 'Waves', cssClass: 'preview-waves', defaultColors: ['#5227FF', '#000000', '#111111', '#111111'] },
  { id: 'Fluid', category: 'Waves & Flow', label: 'Fluid Gradient', cssClass: 'preview-liquid', defaultColors: ['#0099CC', '#0033FF', '#CC00FF', '#4A0080'] },

  /* SATIN WAVES — filed by what it looks like, which is the rule everywhere
     else in this library and was not being applied to this one.

     It was called Liquid Chrome and sat at the top of Metal. It is a ramp
     folded into a mirrored triangle wave and then bent: bands of tone pouring
     over each other, which is a wave. It has no height field, no shader and
     no light, so it is not a lit surface and never was — the only thing metal
     about it was the palette it shipped with.

     THE ID IS STILL 'Metallic' ON PURPOSE. Every saved preset and every
     LIVING_GRADIENT_DATA stamp on a layer somebody has already built refers
     to it by that id. Renaming the id would orphan all of them to rename a
     label. */
  { id: 'Metallic', category: 'Waves & Flow', label: 'Satin Waves', cssClass: 'preview-pulse', defaultColors: ['#05070C', '#3E5A78', '#B9D4E8', '#FFFFFF'] },

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
  { id: 'LavaLamp', category: 'Ambient & Organic', label: 'Lava Lamp', cssClass: 'preview-lavalamp', defaultColors: ['#1A0033', '#8C1A00', '#FF4400', '#FFDD44'] },

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

  /* Fur is the one that came out of trying to make gold and getting a
     pelt instead. It is a two-tone coat shredded into filaments by a
     Turbulent Displace whose noise is finer than the shapes it is
     pushing — see the note in jsx/main.jsx. */
  { id: 'Fur', category: 'Animal Prints', label: 'Fur', cssClass: 'preview-cellular', defaultColors: ['#D9A441', '#4A2408'] },

  /* Snakeskin came out of Hammered Metal, not out of the animal-print builder.
     The dimple lattice that makes hammered copper read as beaten metal is,
     geometrically, a field of scales — what said "metal" was never the shape,
     it was the lighting: a hard specular, low roughness and a drifting
     reflection. Drop the shine, tighten the cells, give it a reptile palette,
     and the same height field reads as a snake.

     So this shares buildMetalTexture's 'Hammered' path deliberately rather
     than getting a builder of its own. Two implementations of one height field
     would drift, and this one is already right. */
  { id: 'Snakeskin', category: 'Animal Prints', label: 'Snakeskin', cssClass: 'preview-cellular', defaultColors: ['#141A12', '#3E5230', '#8CA35C', '#E4E9C9'] },

  /* PRINT & PATTERN
     Screens, grids and cells. Repeating structure you can count. */
  { id: 'Halftone', category: 'Print & Pattern', label: 'Halftone', cssClass: 'preview-halftone', defaultColors: ['#12101A', '#5227FF', '#F4F1EA'] },
  { id: 'AsciiMatrix', category: 'Print & Pattern', label: 'ASCII Matrix', cssClass: 'preview-ascii', defaultColors: ['#000000', '#004400', '#00AA00', '#00FF00'] },
  { id: 'CellularMosaic', category: 'Print & Pattern', label: 'Cellular Mosaic', cssClass: 'preview-cellular', defaultColors: ['#00FF99', '#00AAFF', '#AA00FF', '#001133'] },
  { id: 'StackedSquares', category: 'Print & Pattern', label: 'Stacked Squares', cssClass: 'preview-stackedsquares', defaultColors: ['#FF3300', '#FFCC00', '#FF0066', '#9900FF'] },

  /* SAAS & UI
     Backgrounds for interfaces rather than for footage: mostly empty, one big
     soft bloom carrying all the colour, and a position control instead of an
     angle. The section to grow if more product-page looks get added. */
  { id: 'SaaS', category: 'SaaS & UI', label: 'SaaS Gradient', cssClass: 'preview-living', defaultColors: ['#FBFBFD', '#7C5CFF', '#FF6FB1', '#3ED6C5'] },

  /* GLASS
     Surfaces you see *through*. Both of these are a colour field with a
     surface in front of it, and the surface is the preset — the frosted one
     is a rippled sheet, the reeded one is a row of flutes. */
  { id: 'Glass', category: 'Glass', label: 'Frosted Glass', cssClass: 'preview-glass', defaultColors: ['#0B1622', '#3E6E8C', '#BFE3F0', '#FFFFFF'] },
  { id: 'ReededGlass', category: 'Glass', label: 'Reeded Glass', cssClass: 'preview-reeded', defaultColors: ['#003366', '#0099CC', '#00CED1', '#E6E6FA'] },

  /* METAL
     Six, down from nine, and the three at the top are the only ones that were
     ever going to work — because they were not derived, they were measured.
     The panel built a copper, it was tuned by hand in After Effects until it
     read as poured metal, and the finished effect stack was read back off the
     layer into MOLTEN in jsx/main.jsx. Gold and Silver are that same pour with
     a different palette and a few degrees of light.

     The three that are gone: Polished Chrome and Gunmetal, which never came
     good, and Hammered Metal, which Snakeskin already was — Snakeskin now
     carries Hammered's settings and Hammered is no longer offered twice.

     Molten first, then the three surfaces. */
  { id: 'Copper', category: 'Metal', label: 'Molten Copper', cssClass: 'preview-pulse', defaultColors: ['#2A0E06', '#C2622B', '#FFD9BE'] },
  { id: 'Gold', category: 'Metal', label: 'Molten Gold', cssClass: 'preview-pulse', defaultColors: ['#2B1A05', '#C99A2E', '#FFF2C4'] },
  { id: 'Silver', category: 'Metal', label: 'Molten Silver', cssClass: 'preview-pulse', defaultColors: ['#0B0E12', '#7E8B99', '#FFFFFF'] },

  /* Crumpled Foil is the one that turned out to need almost none of the
     stack: no ramp, no fold, no twist, no environment. Just the height map —
     fractal noise shredded by a two-pixel cross displacement — with the
     shader on top of it. See METAL_SURFACES.Foil. */
  { id: 'Foil', category: 'Metal', label: 'Crumpled Foil', cssClass: 'preview-pulse', defaultColors: ['#0A0C0F', '#6E7A86', '#C6D2DC', '#FFFFFF'] },
  { id: 'Brushed', category: 'Metal', label: 'Brushed Steel', cssClass: 'preview-pulse', defaultColors: ['#16191C', '#5C6570', '#AEB8C2', '#F2F6FA'] }
];
