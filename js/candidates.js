/* ============================================
   CANDIDATES.JS — the workshop, not the shop
   ============================================

   Gradients being developed. NOTHING HERE IS IN THE PRODUCT.

   THIS FILE IS NOT LOADED BY index.html, and that is the whole point. A
   candidate cannot appear in Browse, cannot be applied, and cannot be saved
   as a preset, because the panel has never heard of it. The only thing that
   reads this file is tools/qa_sweep.jsx, which builds these in After Effects
   under GRADIENT_PLUGIN_DEV and renders frames for review.

   WHY THIS EXISTS

   Four SaaS presets shipped into the production library in 2.3.0 having never
   been built in After Effects once. They looked right, because what they
   looked right *in* was a canvas painter in js/preview.js — a hand-drawn
   imitation of what the builder ought to produce. The first time they were
   rendered for real, one was missing a third of its composition, two had
   converged on the same geometry, and one was clipping 42% of the frame to
   flat white.

   So: a gradient earns its way into js/presets.js by being rendered at
   delivery size, looked at, measured and scored. Not before.

   THE LOOP

     candidate here
       -> tools/qa_sweep.jsx builds and renders it at 1920x1080
       -> the frames are looked at, and tools/qa_analyse.js measures them
       -> scored, and the notes say what the render actually showed
       -> if it passes, it moves to js/presets.js and gets a rendered poster
          and loop from tools/render_cards.jsx and tools/render_loops.jsx
       -> if it does not, it stays here or is deleted, and the notes say why

   THE SHAPE OF AN ENTRY

     id             matches a case in dispatchBuild() in jsx/main.jsx
     label          what it would be called in Browse
     category       which section it would join
     defaultColors  MUST come before `controls` — tools/qa_sweep.jsx finds it
                    with a regex that stops at the first closing brace
     controls       the exact control values to build with. Not optional, and
                    not read from js/controls.js: a control set generated at
                    run time is invisible to the render tools, which then
                    silently build the base defaults instead. That is not
                    hypothetical — it is how the four above came to be
                    reviewed on four renders of a fifth gradient.
     status         'untested' | 'rejected' | 'approved'
     scores         visual / originality / practicality / animation /
                    controls / performance, out of 10, filled in after looking
     notes          what the render actually showed

   Roughly 8/10 overall to ship.

   ── WHAT HAS BEEN THROUGH HERE ──────────────────────────────────────

   APPROVED, and now in js/presets.js. GRADIENT_QA_V23.md has the
   measurements, the scores, and the three tooling bugs the exercise found:

     SaaSMesh       Mesh Bloom      8.3
     SaaSSpotlight  Spotlight       8.6
     SaaSCorner     Corner Glow     8.5
     SaaSTwilight   Twilight Mesh   8.7

   REJECTED: none yet.

   ── IN THE WORKSHOP NOW: VECTOR & FLAT ──────────────────────────────

   Four candidates, and they are the first in this library built from
   SILHOUETTES rather than from a field. VECTOR_GRADIENT_RESEARCH.md is the
   reasoning; the short version is that every one of the 54 shipped gradients
   evaluates a function at every pixel, none of them has an edge, and that is
   why the panel cannot currently produce a border, a light sweep, an arc or
   a papercut stack.

   READ THIS BEFORE JUDGING THE FIRST RENDER

   Three things about these four are unlike anything that has been through
   here, and each will look like a defect if it is not expected:

   1. THE SHAPE OPERATOR MATCHNAMES ARE UNVERIFIED. Trim Paths, Wiggle Paths
      and Repeater-on-a-stroke have never been written from this project, and
      tools/effect_probe.jsx cannot see shape operators — it only dumps layer
      effects. tools/shape_probe.jsx is new and dumps them. RUN IT FIRST. If
      Trim Paths does not apply, Arc Stack builds full circles rather than
      arcs and looks merely wrong rather than broken; if Wiggle Paths resolves
      to Wiggle Transform instead, Papercut's bands slide about with straight
      edges. Both failures report through LG.warn rather than throwing.

   2. THE CANVAS PREVIEWS DO NOT EXIST YET, AND THAT IS DELIBERATE.
      GRADIENT_QA_V23.md is the record of four gradients reviewed on drawings
      of themselves. A hand-drawn imitation of a hard-edged shape is far more
      convincing than a hand-drawn imitation of noise, so for this family the
      painter is more dangerous, not less. Nothing gets a card until it has
      been rendered.

   3. NO INDICES ARE PASSED to any shape property, only names. LG.find tries
      the index last but does try it, and a guessed index that resolves sets
      the wrong parameter and reports success. Once shape_probe has run, the
      real numbers can go in.

   Expected weak points, stated in advance so a bad render is diagnosis
   rather than surprise: Light Bar's seam at the loop point if `span` is too
   short for the blur; Arc Stack's outer rings clipping out of frame, since
   Repeater Scale compounds; Glow Border's twin reading as a halo rather than
   as emission if `glow` is too wide. */

var GRADIENT_CANDIDATES = [

  /* The cheapest of the four and the one to build first — no new controls
     and no new shape operators, so its only job is to prove the
     solid-plus-shape-matte route end to end before anything is built on it. */
  {
    id: 'LightBar',
    label: 'Light Bar',
    category: 'Vector & Flat',
    defaultColors: ['#05070E', '#131A2E', '#6E8CFF', '#FFFFFF'],
    controls: { angle: 24, width: 16, softness: 55, speed: 22, brightness: 70, trail: 55 },
    status: 'untested',
    scores: null,
    notes: 'Not built yet. Watch the loop seam: the sweep is time % period, ' +
           'which is only safe while the bar clears the frame at both ends.'
  },

  /* Introduces Trim Paths, and the "one ramp, many rings, colour by
     position" trick that Hard Stripes and Grid Fade would both reuse. */
  {
    id: 'ArcStack',
    label: 'Arc Stack',
    category: 'Vector & Flat',
    defaultColors: ['#141024', '#E0553F', '#F0A93F', '#F5EDE0'],
    controls: { rings: 7, gap: 17, thickness: 4.5, arc: 58, startSize: 24, centerX: 12, centerY: 88, speed: 8, softness: 0, fade: 45 },
    status: 'untested',
    scores: null,
    notes: 'Not built yet. Repeater Scale compounds, so ring 7 is much larger ' +
           'than the gap suggests — check it has not left the frame.'
  },

  /* The one SAAS_GRADIENT_RESEARCH.md called the largest hole in the library.
     Shares its geometry cluster with Edge Glow, which is why that one is
     nearly free once this lands. */
  {
    id: 'GlowBorder',
    label: 'Glow Border',
    category: 'Vector & Flat',
    defaultColors: ['#06060B', '#5B4BFF', '#FF5FA8', '#3ED6C5'],
    controls: { inset: 7, radius: 4.5, thickness: 0.9, speed: 40, glow: 55, glowOpacity: 62 },
    status: 'untested',
    scores: null,
    notes: 'Not built yet. Both rings must turn in phase; a glow that lags ' +
           'its own edge reads as a printing error rather than as light.'
  },

  /* Introduces Wiggle Paths, and is the only one of the four that is strong
     in light mode — a mode the library is thin in. */
  {
    id: 'Papercut',
    label: 'Papercut Stack',
    category: 'Vector & Flat',
    defaultColors: ['#F7F2E7', '#F0B060', '#C9553F', '#3A2044'],
    controls: { bands: 5, wave: 26, detail: 1.6, horizon: 32, shadow: 55, drift: 16 },
    status: 'untested',
    scores: null,
    notes: 'Not built yet. The only one with no matte and no solid: flat Fill ' +
           'is scriptable, so each band carries its own colour directly.'
  }
];

/* Node reads this file directly; the panel never does. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GRADIENT_CANDIDATES: GRADIENT_CANDIDATES };
}
