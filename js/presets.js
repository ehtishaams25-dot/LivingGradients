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
  CellularMosaic: ['Void', 'Wall', 'Cell', 'Core']
};

/* The slots for a type: its declared roles, or four unlabelled. */
function colorRolesFor(type) {
  return COLOR_ROLES[type] || [null, null, null, null];
}

const GRADIENT_LIBRARY = [
  // LIVING & ABSTRACT
  { id: 'OklabSmooth', category: 'Living & Abstract', label: 'Oklab Smooth', cssClass: 'preview-living', defaultColors: ['#FF0000', '#00FFFF', '#FF00FF', '#FFFF00'] },
  { id: 'living', category: 'Living & Abstract', label: 'Living Gradient', cssClass: 'preview-living', defaultColors: ['#FF6B35', '#FF3366', '#CC00FF', '#0033FF'] },
  { id: 'Fluid', category: 'Living & Abstract', label: 'Fluid Gradient', cssClass: 'preview-liquid', defaultColors: ['#0099CC', '#0033FF', '#CC00FF', '#4A0080'] },
  { id: 'Wavy', category: 'Living & Abstract', label: 'Wavy', cssClass: 'preview-living', defaultColors: ['#0055FF', '#FF0055', '#5500FF', '#000000'] },
  { id: 'LiquidWaves', category: 'Living & Abstract', label: 'Liquid Waves', cssClass: 'preview-liquid', defaultColors: ['#FF0055', '#5500FF', '#00DDFF', '#FFAA00'] },
  { id: 'TrailGradient', category: 'Living & Abstract', label: 'Trail Gradient', cssClass: 'preview-trail', defaultColors: ['#FF0055', '#5500FF', '#00DDFF', '#FFAA00'] },

  // SILKFLARE ENGINE
  { id: 'Silk', category: 'SilkFlare Engine', label: 'Silk', cssClass: 'preview-silk', defaultColors: ['#FFB3C6', '#BDE0FE', '#CAFFBF', '#FDFFB6'] },
  { id: 'Aurora', category: 'SilkFlare Engine', label: 'Aurora', cssClass: 'preview-sf-aurora', defaultColors: ['#00FF99', '#00AAFF', '#AA00FF', '#001133'] },
  { id: 'Prism', category: 'SilkFlare Engine', label: 'Prism', cssClass: 'preview-prism', defaultColors: ['#FF00FF', '#00FFFF', '#FF00AA', '#00FF88'] },
  { id: 'Fiber', category: 'SilkFlare Engine', label: 'Fiber', cssClass: 'preview-fiber', defaultColors: ['#FFD700', '#FFA500', '#B8860B', '#4A3800'] },
  { id: 'Veil', category: 'SilkFlare Engine', label: 'Veil', cssClass: 'preview-veil', defaultColors: ['#111111', '#1a1a2e', '#16213e', '#0f3460'] },
  { id: 'Pulse', category: 'SilkFlare Engine', label: 'Pulse', cssClass: 'preview-pulse', defaultColors: ['#FF4500', '#FF6B00', '#CC2200', '#440000'] },
  { id: 'Comet', category: 'SilkFlare Engine', label: 'Comet', cssClass: 'preview-comet', defaultColors: ['#006994', '#0099CC', '#00CED1', '#003366'] },

  // PROCEDURAL & RETRO
  { id: 'Heatmap', category: 'Procedural & Retro', label: 'Heatmap', cssClass: 'preview-heat', defaultColors: ['#000033', '#FF0000', '#FFFF00', '#FFFFFF'] },
  { id: 'Halftone', category: 'Procedural & Retro', label: 'Halftone', cssClass: 'preview-halftone', defaultColors: ['#FF0055', '#FFAA00', '#110018'] },
  { id: 'AsciiMatrix', category: 'Procedural & Retro', label: 'ASCII Matrix', cssClass: 'preview-ascii', defaultColors: ['#000000', '#004400', '#00AA00', '#00FF00'] },
  { id: 'ChromaFlare', category: 'Procedural & Retro', label: 'ChromaFlare', cssClass: 'preview-chromaflare', defaultColors: ['#FF00FF', '#00FFFF', '#FF00AA', '#00FF88'] },
  { id: 'Sunburst', category: 'Procedural & Retro', label: 'Sunburst', cssClass: 'preview-sunburst', defaultColors: ['#FF4500', '#FFD700', '#1A0A00'] },
  { id: 'CellularMosaic', category: 'Procedural & Retro', label: 'Cellular Mosaic', cssClass: 'preview-cellular', defaultColors: ['#00FF99', '#00AAFF', '#AA00FF', '#001133'] },
  { id: 'Metallic', category: 'Procedural & Retro', label: 'Metallic', cssClass: 'preview-pulse', defaultColors: ['#05070C', '#3E5A78', '#B9D4E8', '#FFFFFF'] },

  // GLASS & REFRACTION
  { id: 'Glass', category: 'Glass & Refraction', label: 'Frosted Glass', cssClass: 'preview-glass', defaultColors: ['#FFFFFF', '#A9E4EB', '#DFE9F5', '#E6E6FA'] },
  { id: 'ReededGlass', category: 'Glass & Refraction', label: 'Reeded Glass', cssClass: 'preview-reeded', defaultColors: ['#003366', '#0099CC', '#00CED1', '#E6E6FA'] },

  // ANIME
  { id: 'AnimeWater', category: 'Anime Styles', label: 'Anime Water', cssClass: 'preview-anime-water', defaultColors: ['#00B4DB', '#0083B0', '#005C97', '#363795'] },

  // SONDUCKFILM TUTORIAL GRADIENTS
  { id: 'SonduckLiquid', category: 'Sonduck Gradients', label: 'Liquid Waves', cssClass: 'preview-sonduckliquid', defaultColors: ['#FF3366', '#33CCFF', '#111111', '#111111'] },
  { id: 'TwirlShapes', category: 'Sonduck Gradients', label: 'Twirl Shapes', cssClass: 'preview-twirlshapes', defaultColors: ['#00FF99', '#FF0055', '#111111', '#111111'] },
  { id: 'LavaLamp', category: 'Sonduck Gradients', label: 'Lava Lamp', cssClass: 'preview-lavalamp', defaultColors: ['#FFCC00', '#FF3300', '#990000', '#009900'] },
  { id: 'StackedSquares', category: 'Sonduck Gradients', label: 'Stacked Squares', cssClass: 'preview-stackedsquares', defaultColors: ['#FF3300', '#FFCC00', '#FF0066', '#9900FF'] },

  // WEB STUDIO CLONES
  { id: 'PrismaticBurst', category: 'Web Studio Clones', label: 'Prismatic Burst', cssClass: 'preview-prismatic', defaultColors: ['#FF00FF', '#00FFFF', '#00FF88', '#000000'] },
  { id: 'Antigravity', category: 'Web Studio Clones', label: 'Antigravity', cssClass: 'preview-antigravity', defaultColors: ['#FF9FFC', '#5227FF', '#FF00FF', '#111111'] },
  { id: 'Waves', category: 'Web Studio Clones', label: 'Waves', cssClass: 'preview-waves', defaultColors: ['#5227FF', '#000000', '#111111', '#111111'] },
  { id: 'WebThreads', category: 'Web Studio Clones', label: 'Web Threads', cssClass: 'preview-webthreads', defaultColors: ['#230a89', '#ac07a7', '#882828', '#111111'] },

  // AI CUSTOM PROCEDURAL STYLE
  { id: 'ai_custom', category: 'Experimental', label: 'AI Generated', cssClass: 'preview-living', defaultColors: [] }
];
