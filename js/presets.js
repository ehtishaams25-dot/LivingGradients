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
  /* MEASURED, NOT ASSUMED. Both of these were built five times — once as a
     reference and once per swatch with that swatch changed — and compared
     property by property. Indigo Swell answered to slot 1 alone and Ribbon
     Pour to slots 1 and 2; the rest of their swatches moved nothing at all,
     which is the "this one only uses one colour, all other colours are a
     waste" note.

     Both also had a hard-coded background solid underneath. Rather than hide
     the dead swatches, the ground is wired to the next slot in
     jsx/main.jsx — so the count is honest AND there is one more thing you can
     actually art-direct than there was before. */
  Waves:          ['Wave Line', 'Background'],
  SonduckLiquid:  ['Ribbon Deep', 'Ribbon Bright', 'Background'],

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

/* ── THE SaaS FAMILY ─────────────────────────────────────────────────

   Five presets, one builder. buildSaaS() in jsx/main.jsx is fully described
   by these eight numbers — where the light is, how big, how soft, how bright,
   how many blooms, how far apart, and how much they wander — so a new
   product-page look is a row in this table rather than a new builder. That is
   the same arrangement as the seven SilkFlare presets, and it is why they
   have stayed consistent.

   ONE TABLE, THREE READERS. js/controls.js builds each variant's sliders from
   it, js/preview.js paints each card from it, and jsx/main.jsx receives the
   result as ordinary control values.

   EVERY NUMBER BELOW WAS MEASURED, NOT CHOSEN.

   These four shipped once before, in 2.3.0, having never been built in After
   Effects. Rendering them for the first time showed one missing a third of
   its composition, three producing very nearly the same picture, and one
   clipping 42% of the frame to flat white. They were pulled back out, and
   they are here now because they went through js/candidates.js and
   tools/qa_sweep.jsx and came back clean at 1920x1080, 1080x1920, 1080x1080
   and 3840x2160: no holes, no voids, no blown highlights, bandFill 0.99-1.00,
   and a loop seam under 0.1. GRADIENT_QA_V23.md has the numbers and the
   scores. Change one of these and it needs rendering again. */
var SAAS_VARIANTS = {
  /* The generator look: three pastel fields, wide apart, on near-white. Airy
     and diffuse on purpose — it is the one that has to stay behind black
     body text. Weight low-left, so the top-right stays quiet. */
  SaaSMesh:      { positionX: 28, positionY: 40, size: 100, softness: 95, intensity: 70,  blooms: 3, spread: 88, drift: 45, speed: 9 },

  /* The dark hero: one light above the fold and nothing else, so the lower
     half stays black enough for white type. Size 125 rather than the 150 it
     started at — wider than the frame, a bloom has no core and reads as an
     evenly dim wash rather than as a light. */
  SaaSSpotlight: { positionX: 50, positionY: 18, size: 125, softness: 90, intensity: 100, blooms: 1, spread: 34, drift: 40, speed: 10 },

  /* The section header: a warm accent entering from the top-left, and a large
     clean diagonal for everything else. The page is #FAF9F7 rather than white
     because a white page under an 88% bloom is a third of the frame with no
     information in it. */
  SaaSCorner:    { positionX: 10, positionY: 8,  size: 108, softness: 70, intensity: 88,  blooms: 2, spread: 45, drift: 38, speed: 10 },

  /* The mesh after dark, and deliberately NOT Mesh Bloom in a dark palette:
     tighter spread, higher intensity, weight dropped to the lower left. The
     two had converged on the same geometry, which is a cosmetic duplicate
     wearing two names. Airy and diffuse there; dense and saturated here. */
  SaaSTwilight:  { positionX: 34, positionY: 64, size: 122, softness: 86, intensity: 94,  blooms: 3, spread: 58, drift: 55, speed: 10 }
};

/* Every variant reads its colours the way SaaS does: slot one is the page. */
(function shareSaaSRoles() {
  for (var id in SAAS_VARIANTS) {
    if (SAAS_VARIANTS.hasOwnProperty(id)) COLOR_ROLES[id] = COLOR_ROLES.SaaS;
  }
})();


/* The slots for a type: its declared roles, or four unlabelled. */
function colorRolesFor(type) {
  return COLOR_ROLES[type] || [null, null, null, null];
}

const GRADIENT_LIBRARY = [

  /* WAVES & FLOW
     Anything that reads as moving liquid or a travelling wave. Grouped by
     what it looks like, not by where the recipe came from. */
  { id: 'Wavy', category: 'Waves & Flow', label: 'Cobalt Flow', cssClass: 'preview-living', defaultColors: ['#2B4BD8', '#E05570', '#6B42C4', '#080A14'] },
  { id: 'SonduckLiquid', category: 'Waves & Flow', label: 'Ribbon Pour', cssClass: 'preview-sonduckliquid', defaultColors: ['#E04A67', '#46B4DC', '#12131A'] },
  { id: 'Waves', category: 'Waves & Flow', label: 'Indigo Swell', cssClass: 'preview-waves', defaultColors: ['#4A34C7', '#0A0A12'] },
  { id: 'Fluid', category: 'Waves & Flow', label: 'Liquid Field', cssClass: 'preview-liquid', defaultColors: ['#2E8FAD', '#2B47C9', '#9B44C4', '#2B1247'] },

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
  { id: 'Silk', category: 'SilkFlare Engine', label: 'Woven Silk', cssClass: 'preview-silk', defaultColors: ['#FFB3C6', '#BDE0FE', '#CAFFBF', '#FDFFB6'] },
  { id: 'Aurora', category: 'SilkFlare Engine', label: 'Polar Aurora', cssClass: 'preview-sf-aurora', defaultColors: ['#00FF99', '#00AAFF', '#AA00FF', '#001133'] },
  { id: 'Prism', category: 'SilkFlare Engine', label: 'Prism Split', cssClass: 'preview-prism', defaultColors: ['#FF00FF', '#00FFFF', '#FF00AA', '#00FF88'] },
  { id: 'Fiber', category: 'SilkFlare Engine', label: 'Gilded Fiber', cssClass: 'preview-fiber', defaultColors: ['#FFD700', '#FFA500', '#B8860B', '#4A3800'] },
  { id: 'Veil', category: 'SilkFlare Engine', label: 'Midnight Veil', cssClass: 'preview-veil', defaultColors: ['#111111', '#1a1a2e', '#16213e', '#0f3460'] },
  { id: 'Pulse', category: 'SilkFlare Engine', label: 'Ember Pulse', cssClass: 'preview-pulse', defaultColors: ['#FF4500', '#FF6B00', '#CC2200', '#440000'] },
  { id: 'Comet', category: 'SilkFlare Engine', label: 'Azure Comet', cssClass: 'preview-comet', defaultColors: ['#006994', '#0099CC', '#00CED1', '#003366'] },

  /* AMBIENT & ORGANIC
     Soft, slow, no hard edges. The backdrop end of the library. */
  { id: 'OklabSmooth', category: 'Ambient & Organic', label: 'Soft Spectrum', cssClass: 'preview-living', defaultColors: ['#F0885C', '#E05580', '#7B4BC9', '#24306B'] },
  { id: 'living', category: 'Ambient & Organic', label: 'Ember Drift', cssClass: 'preview-living', defaultColors: ['#EE7A45', '#E0556E', '#8B4BC9', '#2A3A99'] },
  { id: 'LavaLamp', category: 'Ambient & Organic', label: 'Lava Lamp', cssClass: 'preview-lavalamp', defaultColors: ['#170B24', '#7A2718', '#E06A3C', '#F0C877'] },

  /* TRAIL ENGINE
     One mechanism, eight looks. A bank of strokes, each carrying a tiled
     colour ramp, each scrolling at its own speed. What separates them is the
     shape of the bank and what happens to it on the way out — see the header
     over lgTrailBank in jsx/main.jsx.

     Vapor Trail moved here out of Ambient & Organic. It is the original and
     it is still the default one to reach for; it just has siblings now. */
  { id: 'TrailGradient', category: 'Trail Engine', label: 'Vapor Trail', cssClass: 'preview-trail', defaultColors: ['#DC4A6B', '#6B42C4', '#3FAFC9', '#E0A04A'] },
  { id: 'HorizonTrail', category: 'Trail Engine', label: 'Horizon Trail', cssClass: 'preview-trail', defaultColors: ['#1B1436', '#5B3A8C', '#D96C8A', '#F2C48A'] },
  { id: 'IrisTrail', category: 'Trail Engine', label: 'Iris Trail', cssClass: 'preview-trail', defaultColors: ['#0C0A1E', '#4F3FC9', '#C94FA8', '#4FC9C2'] },
  { id: 'RippleTrail', category: 'Trail Engine', label: 'Ripple Trail', cssClass: 'preview-trail', defaultColors: ['#04121F', '#0E5673', '#2FA8C4', '#CFF2FF'] },
  { id: 'MoltenTrail', category: 'Trail Engine', label: 'Molten Trail', cssClass: 'preview-trail', defaultColors: ['#12081A', '#8A2E5C', '#D9663F', '#F0D9A8'] },
  { id: 'HazeTrail', category: 'Trail Engine', label: 'Haze Trail', cssClass: 'preview-trail', defaultColors: ['#221A3A', '#6B4FA8', '#C98FB0', '#F0DCC4'] },
  { id: 'SignalTrail', category: 'Trail Engine', label: 'Signal Trail', cssClass: 'preview-trail', defaultColors: ['#232733', '#E03E52', '#F0C23E', '#3FA8C4'] },
  { id: 'LatticeTrail', category: 'Trail Engine', label: 'Lattice Trail', cssClass: 'preview-trail', defaultColors: ['#14100C', '#7A4A2E', '#C4A05C', '#E8DCC0'] },

  /* LIGHT & ENERGY
     Rays, bursts, threads and heat — anything whose subject is the light
     itself rather than the surface it falls on. */
  { id: 'Sunburst', category: 'Light & Energy', label: 'Solar Burst', cssClass: 'preview-sunburst', defaultColors: ['#D4753F', '#EFC489', '#17110C'] },

  /* RETIRED FROM BROWSE, 2.3.0 — reviewed and rejected by the owner.

     Prismatic Burst: "I don't even understand what this is, this is very bad,
     I think we should remove this." Tile Cascade: "this is bad, this is very
     very bad… we should remove this or try to improve it in some way."

     THE RECIPES STAY. Both keep their builders in jsx/main.jsx and their
     entries in LIVE_TUNERS, exactly as Polished Chrome and Gunmetal did when
     they were cut, so a preset somebody already saved on one still rebuilds
     and still updates live. Nothing offers them any more; nothing that exists
     is broken by that.

     To bring one back, uncomment its line. The poster and loop are still in
     css/previews — the build drops them from the package while they are not
     referenced by index.json, and picks them up again when they are. */
  // { id: 'PrismaticBurst', category: 'Light & Energy', label: 'Prismatic Burst', cssClass: 'preview-prismatic', defaultColors: ['#BE4FC9', '#3FB0C4', '#4FC994', '#0A0A12'] },

  /* BETA, AND THE CARD SAYS SO.

     "ChromaFlare is fine, Thermal Map is also fine, Zero Gravity is also fine,
     but these are very beta features so label it as beta so the user knows
     it's not polished." They ship; they are just honest about it. */
  { id: 'ChromaFlare', category: 'Light & Energy', label: 'Chroma Flare', cssClass: 'preview-chromaflare', defaultColors: ['#C24FB4', '#3FAFC4', '#CC4F8F', '#4FC48F'] , beta: true },
  { id: 'Heatmap', category: 'Light & Energy', label: 'Thermal Map', cssClass: 'preview-heat', defaultColors: ['#0C1030', '#BE3E2E', '#E4AF4E', '#F5EFE2'] , beta: true },
  { id: 'Antigravity', category: 'Light & Energy', label: 'Zero Gravity', cssClass: 'preview-antigravity', defaultColors: ['#F0CBEE', '#6B4FC9', '#C24FC9', '#101018'] , beta: true },
  { id: 'WebThreads', category: 'Light & Energy', label: 'Filament Web', cssClass: 'preview-webthreads', defaultColors: ['#2B2578', '#94429B', '#7A3C3C', '#101016'] },

  /* ANIME & 2D
     Flat, drawn backgrounds rather than gradients — the section to grow as
     more 2D looks land. Both of these run on the Cell Pattern engine. */
  { id: 'AnimeWater', category: 'Anime & 2D', label: 'Cel Water', cssClass: 'preview-anime-water', defaultColors: ['#02141F', '#0A3A52', '#1E88A8', '#CFF6FF'] },
  { id: 'AnimeCells', category: 'Anime & 2D', label: 'Cel Shade', cssClass: 'preview-anime-water', defaultColors: ['#150011', '#CC4FB8', '#E092D6', '#E8D45E'] },

  /* ANIMAL PRINTS
     Five presets on one builder. Two or three swatches each rather than four:
     these are flat prints, so the palette is the coat and its markings, not a
     ramp between corners. */
  { id: 'Giraffe', category: 'Animal Prints', label: 'Giraffe Coat', cssClass: 'preview-cellular', defaultColors: ['#F3E0C0', '#C4703A'] },
  { id: 'Tiger', category: 'Animal Prints', label: 'Tiger Stripe', cssClass: 'preview-cellular', defaultColors: ['#F08A21', '#1A1008'] },
  { id: 'Zebra', category: 'Animal Prints', label: 'Zebra Stripe', cssClass: 'preview-cellular', defaultColors: ['#F5F2EC', '#14110E'] },
  { id: 'Leopard', category: 'Animal Prints', label: 'Leopard Spot', cssClass: 'preview-cellular', defaultColors: ['#E3C078', '#2E1A08', '#A8762E'] },
  { id: 'Cow', category: 'Animal Prints', label: 'Cow Hide', cssClass: 'preview-cellular', defaultColors: ['#F7F5F0', '#191714'] },

  /* Fur is the one that came out of trying to make gold and getting a
     pelt instead. It is a two-tone coat shredded into filaments by a
     Turbulent Displace whose noise is finer than the shapes it is
     pushing — see the note in jsx/main.jsx. */
  { id: 'Fur', category: 'Animal Prints', label: 'Golden Pelt', cssClass: 'preview-cellular', defaultColors: ['#D9A441', '#4A2408'] },

  /* Snakeskin came out of Hammered Metal, not out of the animal-print builder.
     The dimple lattice that makes hammered copper read as beaten metal is,
     geometrically, a field of scales — what said "metal" was never the shape,
     it was the lighting: a hard specular, low roughness and a drifting
     reflection. Drop the shine, tighten the cells, give it a reptile palette,
     and the same height field reads as a snake.

     So this shares buildMetalTexture's 'Hammered' path deliberately rather
     than getting a builder of its own. Two implementations of one height field
     would drift, and this one is already right. */
  { id: 'Snakeskin', category: 'Animal Prints', label: 'Serpent Scale', cssClass: 'preview-cellular', defaultColors: ['#141A12', '#3E5230', '#8CA35C', '#E4E9C9'] },

  /* PRINT & PATTERN
     Screens, grids and cells. Repeating structure you can count. */
  { id: 'Halftone', category: 'Print & Pattern', label: 'Halftone Screen', cssClass: 'preview-halftone', defaultColors: ['#12101A', '#5227FF', '#F4F1EA'] },
  { id: 'AsciiMatrix', category: 'Print & Pattern', label: 'Terminal Grid', cssClass: 'preview-ascii', defaultColors: ['#060A07', '#14401F', '#2E9B4F', '#6FE08A'] },
  { id: 'CellularMosaic', category: 'Print & Pattern', label: 'Cellular Mosaic', cssClass: 'preview-cellular', defaultColors: ['#3FC496', '#3F9FC4', '#8B4FC9', '#0A1128'] },
  /* Retired from Browse — see the note on Prismatic Burst above. */
  // { id: 'StackedSquares', category: 'Print & Pattern', label: 'Tile Cascade', cssClass: 'preview-stackedsquares', defaultColors: ['#E05B3F', '#EFB44E', '#DC4A78', '#8B4FC9'] },

  /* SAAS & UI
     Backgrounds for interfaces rather than for footage: mostly empty, one big
     soft bloom carrying all the colour, and a position control instead of an
     angle. The section to grow if more product-page looks get added. */
  { id: 'SaaS',          category: 'SaaS & UI', label: 'Hero Bloom', cssClass: 'preview-living', defaultColors: ['#FBFBFD', '#7C5CFF', '#FF6FB1', '#3ED6C5'] },

  /* Four more on the same builder — SAAS_VARIANTS above holds the numbers
     that separate them, and they are four different jobs rather than four
     palettes: a light page mesh, a dark hero, a warm corner accent for a
     section header, and a dense mesh after dark. */
  { id: 'SaaSMesh',      category: 'SaaS & UI', label: 'Mesh Field',    cssClass: 'preview-living', defaultColors: ['#F7F5FF', '#8B7BFF', '#FF8FC7', '#5FD6D0'] },
  { id: 'SaaSSpotlight', category: 'SaaS & UI', label: 'Stage Light',     cssClass: 'preview-living', defaultColors: ['#07070C', '#5B6CFF', '#3C49C8', '#8C6BFF'] },
  { id: 'SaaSCorner',    category: 'SaaS & UI', label: 'Corner Glow',   cssClass: 'preview-living', defaultColors: ['#FAF9F7', '#F2703C', '#F5B93F', '#F0547F'] },
  { id: 'SaaSTwilight',  category: 'SaaS & UI', label: 'Twilight Mesh', cssClass: 'preview-living', defaultColors: ['#0B0A1F', '#6C3DF4', '#1E88E5', '#F0499C'] },

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


/* ═══════════════════════════════════════════════════════════════════════
   THE FILTER STACK
   ───────────────────────────────────────────────────────────────────────
   A gradient is a FIELD. A filter is a TREATMENT applied to that field.

   This is the architectural split the expansion brief asks for, and the
   reason it matters is arithmetic: eight filters over forty-seven base
   gradients is a library of hundreds of finished looks built from
   fifty-five things to maintain. Baking "Polar Aurora + Glass" in as its
   own preset would be the fifty-sixth thing to maintain, and it would
   drift away from Polar Aurora the first time Polar Aurora was touched.

   WHERE IT ATTACHES. jsx/main.jsx already collapses every build into one
   layer (groupGeneratedLayers) and then applies grain, glow and posterize
   to it (applyGlobalPolish). That collapse IS the base/treatment boundary
   — it exists so that what comes after affects the finished gradient
   rather than whichever element landed on top. The stack below is that
   same hook, made ordered and declarative rather than three hard-coded
   if-blocks.

   ONE TABLE, THREE READERS, same as SAAS_VARIANTS above:
     js/controls.js   builds each filter's sliders from `controls`
     js/preview.js    approximates the treatment on the card
     jsx/main.jsx     reads `fx` and writes the real effect stack

   ORDER IS NOT COSMETIC. Filters apply top-down in the order listed here,
   because that is the order in which they are physically true: you
   distort a surface before you light it, and you grain a photograph after
   it has been lit, never before. A dither applied under a glow is a glow
   of dithered pixels, which is mush. The UI may let a filter be dragged
   out of this order; this is the order it gets when it is added.

   NOTHING NEW HERE IS MARKED LIVE. Every entry carries `status`, and only
   'live' is offered in the panel. The brief's own gate applies: a filter
   is 'live' when it has been built on a real gradient in After Effects,
   rendered, and looked at. Until then it is 'draft' and the panel does
   not show it. See GRADIENT_QA_V23.md for how the last batch was gated. */

var FILTER_ORDER = [
  'displace', 'stripes', 'fractalGlass', 'glass',
  'dither', 'chromatic', 'bloom', 'grain'
];

var FILTERS = {

  /* ── DISPLACE ────────────────────────────────────────────────────────
     Moves the field around before anything else looks at it. First in the
     order because every other filter wants to treat the DISPLACED shape,
     not the shape it started as. */
  displace: {
    label: 'Displace',
    status: 'draft',
    fx: 'turbulentDisplace',
    blurb: 'Warps the field along a noise pattern.',
    controls: {
      amount:  { label: 'Amount',    min: 0,  max: 200, def: 45 },
      scale:   { label: 'Scale',     min: 2,  max: 300, def: 90 },
      detail:  { label: 'Detail',    min: 1,  max: 10,  def: 3  },
      speed:   { label: 'Speed',     min: 0,  max: 100, def: 20 },
      seed:    { label: 'Seed',      min: 0,  max: 999, def: 1  }
    },
    modes: ['Turbulent', 'Bulge', 'Twist', 'Vertical', 'Horizontal']
  },

  /* ── STRIPES ─────────────────────────────────────────────────────────
     The ridged/reeded references. Must DEFORM the field rather than lay a
     pattern over it — a repeated bar on top reads as a gradient with
     stripes drawn on, which is exactly the cheap result to avoid. Reeded
     Glass already does the deforming version; this generalises it. */
  stripes: {
    label: 'Stripes',
    status: 'draft',
    fx: 'venetianBlinds',
    blurb: 'Folds the field into ridges or flutes.',
    controls: {
      frequency: { label: 'Frequency', min: 2,  max: 200, def: 40 },
      width:     { label: 'Width',     min: 1,  max: 100, def: 50 },
      softness:  { label: 'Softness',  min: 0,  max: 100, def: 35 },
      distort:   { label: 'Distort',   min: 0,  max: 100, def: 20 },
      direction: { label: 'Direction', min: 0,  max: 360, def: 90 },
      phase:     { label: 'Phase',     min: 0,  max: 360, def: 0  }
    },
    modes: ['Vertical', 'Horizontal', 'Radial', 'Curved']
  },

  /* ── FRACTAL GLASS ───────────────────────────────────────────────────
     THE PRIORITY OF THE BRIEF, and the hardest thing in this table.

     The look in the reference is repeated refractive structure: soft
     ridges, bright and dark refraction bands, a little colour separation,
     complex but smooth. The failure mode is a pasted repeating texture
     sitting on top of an unrelated gradient.

     The construction that avoids that: a fractal noise field drives a
     DISPLACEMENT MAP of the gradient into itself, so the distortion is
     made of the gradient rather than applied to it. The stretch control
     is a directional blur on the noise BEFORE it displaces — that is what
     produces the vertical draw in the reference, and it is the same trick
     the strand look in the client's Animated BGs folder is built on. */
  fractalGlass: {
    label: 'Fractal Glass',
    status: 'draft',
    fx: 'displacementMap',
    blurb: 'Refracts the field through fractal structure.',
    controls: {
      amount:    { label: 'Amount',     min: 0,  max: 100, def: 55 },
      scale:     { label: 'Scale',      min: 5,  max: 400, def: 70 },
      detail:    { label: 'Detail',     min: 1,  max: 10,  def: 5  },
      roughness: { label: 'Roughness',  min: 0,  max: 100, def: 50 },
      stretch:   { label: 'Stretch',    min: 0,  max: 100, def: 60 },
      highlight: { label: 'Highlight',  min: 0,  max: 100, def: 30 },
      contrast:  { label: 'Contrast',   min: 0,  max: 200, def: 100 },
      speed:     { label: 'Speed',      min: 0,  max: 100, def: 15 },
      seed:      { label: 'Seed',       min: 0,  max: 999, def: 1  }
    }
  },

  /* ── GLASS ───────────────────────────────────────────────────────────
     A surface in FRONT of the field. Not blur-plus-opacity: that is the
     note the brief makes twice and it is the right note. What sells glass
     is the edge — a bright rim where the surface turns away from you —
     so Edge and Shine carry this filter, not Blur. */
  glass: {
    label: 'Glass',
    status: 'draft',
    fx: 'ccGlass',
    blurb: 'Puts a refractive surface in front of the field.',
    controls: {
      amount:    { label: 'Amount',     min: 0,  max: 100, def: 50 },
      refract:   { label: 'Refraction', min: 0,  max: 100, def: 40 },
      blur:      { label: 'Blur',       min: 0,  max: 50,  def: 8  },
      edge:      { label: 'Edge',       min: 0,  max: 100, def: 55 },
      shine:     { label: 'Shine',      min: 0,  max: 100, def: 45 },
      thickness: { label: 'Thickness',  min: 0,  max: 100, def: 30 }
    }
  },

  /* ── DITHER ──────────────────────────────────────────────────────────
     Modern digital dither, NOT retro pixel art — the brief is explicit and
     the difference is the cell size. An ordered pattern at 2-4px reads as
     a printed screen and stays premium; the same pattern at 12px reads as
     a 1994 GIF. Default sits at the low end on purpose. */
  dither: {
    label: 'Dither',
    status: 'draft',
    fx: 'mosaic',
    blurb: 'Breaks the blend into an ordered pattern.',
    controls: {
      amount:    { label: 'Amount',    min: 0, max: 100, def: 60 },
      scale:     { label: 'Scale',     min: 1, max: 24,  def: 3  },
      intensity: { label: 'Intensity', min: 0, max: 100, def: 50 },
      softness:  { label: 'Softness',  min: 0, max: 100, def: 20 }
    },
    modes: ['Ordered', 'Fine Grid', 'Dots', 'Noise', 'Directional']
  },

  /* ── CHROMATIC ───────────────────────────────────────────────────────
     Subtle by default. Chromatic aberration is a lens defect, and a
     gradient wearing an obvious one looks like a mistake rather than a
     photograph. Above about 6 it stops reading as a lens.

     No single AE effect does this: it is three channel-isolated copies of
     the layer offset against each other. fx is null and the builder in
     jsx/main.jsx owns the construction. */
  chromatic: {
    label: 'Chromatic',
    status: 'draft',
    fx: null,
    blurb: 'Separates the colour channels at the edges.',
    controls: {
      amount:    { label: 'Amount',    min: 0, max: 20,  def: 3  },
      direction: { label: 'Direction', min: 0, max: 360, def: 0  },
      edgeOnly:  { label: 'Edge Only', min: 0, max: 100, def: 70 }
    }
  },

  /* ── BLOOM ───────────────────────────────────────────────────────────
     Already live: applyGlobalPolish has driven ADBE Glo2 for several
     versions. Listing it here does not change what it does, it just moves
     it into the stack so it can be reordered and removed like the rest. */
  bloom: {
    label: 'Bloom',
    status: 'live',
    fx: 'glow',
    blurb: 'Blooms the brightest parts of the field.',
    controls: {
      amount:    { label: 'Amount',    min: 0, max: 100, def: 30 },
      threshold: { label: 'Threshold', min: 0, max: 100, def: 85 },
      radius:    { label: 'Radius',    min: 0, max: 200, def: 40 }
    }
  },

  /* ── GRAIN ───────────────────────────────────────────────────────────
     Last, because grain belongs to the photograph and not to the subject.
     Also already live. Monochrome is not a default, it is a rule — see the
     note in applyGlobalPolish about why coloured noise reads as a broken
     signal. */
  grain: {
    label: 'Grain',
    status: 'live',
    fx: 'noise',
    blurb: 'Adds film grain over the finished image.',
    controls: {
      amount:   { label: 'Amount',   min: 0, max: 100, def: 12 },
      scale:    { label: 'Scale',    min: 1, max: 100, def: 50 },
      contrast: { label: 'Contrast', min: 0, max: 100, def: 50 }
    }
  }
};

/* The filters the panel is allowed to offer today. */
function liveFilters() {
  var out = [];
  for (var i = 0; i < FILTER_ORDER.length; i++) {
    var k = FILTER_ORDER[i];
    if (FILTERS[k] && FILTERS[k].status === 'live') out.push(k);
  }
  return out;
}

/* Default control values for one filter, ready to drop into a stack entry. */
function filterDefaults(key) {
  var f = FILTERS[key], out = {}, c;
  if (!f) return out;
  for (c in f.controls) {
    if (f.controls.hasOwnProperty(c)) out[c] = f.controls[c].def;
  }
  return out;
}

/* A stack is an ordered array of { key, on, values }. Sorting on write
   rather than trusting insertion order means a stack that came off a
   saved preset from an older build still applies in the physically true
   order rather than the order somebody happened to click. */
function sortFilterStack(stack) {
  if (!stack || !stack.length) return [];
  var out = stack.slice(0);
  out.sort(function (a, b) {
    var ia = FILTER_ORDER.indexOf(a.key), ib = FILTER_ORDER.indexOf(b.key);
    if (ia < 0) ia = 99;
    if (ib < 0) ib = 99;
    return ia - ib;
  });
  return out;
}
