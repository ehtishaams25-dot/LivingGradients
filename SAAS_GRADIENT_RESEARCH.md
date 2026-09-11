# SAAS_GRADIENT_RESEARCH — what the web is doing, and which of it belongs in After Effects

Researched 2026-09-04 for V2.2.

The brief asks for the *technique*, not the artwork, and it asks whether each
one deserves a preset. Several of the answers below are "no", and the reason is
usually the same: the technique is interactive, and a gradient that is only
interesting while a pointer is moving over it has nothing to give a comp that
will be rendered to a file. Those are noted rather than dropped, because two of
them belong in the panel's **Fluid** tab instead, which is interactive.

Where a technique overlaps something Living Gradients already ships, this says
so and stops. The library already has forty-three looks; the bar for adding a
forty-fourth is that it is a visual system nothing in there already is.

---

## 1. The layered-simplex flowing gradient

**Reference:** Alex Harri's deconstruction of the flowing WebGL gradient, and
the same construction under Stripe's and Linear's marketing headers.

**Visual behaviour.** A soft colour field that appears to flow sideways while
also evolving in place. Nothing in it has an edge. It never repeats visibly even
though nothing in it is random.

**Construction principle.** Three passes, not one:

1. a background of **three stacked simplex octaves** at different frequencies,
   deliberately drifting in *opposing* directions, which is what stops the whole
   field sliding as one sheet;
2. two **wave layers** placed at fixed heights (35% and 80% of the canvas), each
   with its own noise offset so they never synchronise;
3. the noise value is not used as colour. It is used as a **coordinate into a
   gradient texture** — `texture2D(u_gradient, vec2(lightness, 0.5))`.

Time enters twice, and separately: `u_time` added to the sampling position
(flow) and a slower term evolving the noise itself (life). Published values are
roughly L 0.0015–0.018, S 0.04–0.6, F 0.034–0.043.

**After Effects equivalent.** This is *exactly* the split the library already
calls "make a moving greyscale field, then map that field onto the user's
colours" — Fractal Noise into CC Toner. The two things the shader does that our
builders mostly do not:

- **Opposing drift between octaves.** One Fractal Noise with Complexity 3 moves
  as one object. Two Fractal Noise layers with opposite Evolution signs, blended,
  do not. Cheap, and it is most of why the web version reads as alive.
- **Blur that varies with the field** rather than a constant blur, via
  `pow(t, 3..4)` so the frame has sharp regions and soft regions at once.

**Verdict: no new preset; a technique to fold into existing ones.** Aurora and
Living Gradient are the two that would gain most.

---

## 2. Grain over a smooth field

**Reference:** every generator on the current crop (meshgradient.com,
gradients.design) ships a grain slider, and it is on by default.

**Visual behaviour.** The gradient stops looking like a computer's idea of a
gradient. At 8-bit, a wide soft ramp bands; fine monochrome grain dithers the
step and the band disappears.

**After Effects equivalent.** Already built: `applyGlobalPolish()` adds
`ADBE Noise` with monochrome forced on, driven by the global Grain slider.

**Verdict: shipped. The gap is that it defaults to 0.** Section 6 of the brief
asks for grain where it solves banding, and the panel makes the user find it.
Worth reconsidering the default for the smooth families specifically.

---

## 3. The rotating conic ring (animated glow border)

**Reference:** the CSS `@property --angle` + `conic-gradient` pattern now
standard on dark-theme SaaS CTAs; two pseudo-elements, one crisp ring and one
blurred twin beneath it.

**Visual behaviour.** A full-spectrum band travels around the perimeter of a
shape. The blurred copy underneath is what makes it read as *light* rather than
as a coloured outline.

**Construction principle.** One gradient, drawn twice: sharp on top, blurred and
semi-transparent below. Both rotate together.

**After Effects equivalent.** A 4-Colour Gradient or Ramp on a solid, matted by a
stroked rounded-rectangle shape, the whole thing rotating; duplicate the layer,
Fast Box Blur ~40, Screen, opacity ~60%. The two-copy structure is the entire
trick and it transfers exactly.

**Cost.** Low. Two layers, one matte, one blur.

**Verdict: yes, a real candidate — and the library has no border-energy look at
all.** It is also the one on this list most likely to be used, because
"glowing outline around a card" is a shot motion designers are actually asked
for. Named `Glow Border` in the brief's own taxonomy.

**Why it is not in V2.2:** it needs a shape whose corner radius, inset and
thickness are art-directable, which is a new control cluster rather than new
sliders on an existing one. Scoped, not built. See `V22_KNOWN_LIMITATIONS.md`.

---

## 4. Cursor-reactive fields and spring-following trails

**Reference:** the WebGL "ghost cursor" pattern — a chain of dots each springing
toward the one ahead, rasterised to a canvas and handed to a shader as a
texture — and the simpler lerp-cursor pattern.

**Visual behaviour.** The field's focal point follows the pointer with a lag
that is deliberately non-uniform: the head is nearly exact, the tail drags.

**After Effects equivalent.** There isn't one, and that is the finding. A comp
has no pointer. The honest translation is a *position* that an artist keyframes,
which is a different feature — and the panel already has it as `type: 'xy'` on
the SaaS bloom.

**Verdict: no preset. It belongs in the Fluid tab, and V2.2 put it there.**
The head/trail split described in these references is exactly the model the
fluid simulation now uses: the head is placed on the pointer with no filter at
all under SNAPPY, and the inertia lives in the fluid rather than in the input.
Measured at 0.0px head error against the pointer; see `V22_RELEASE_QA.md`.

---

## 5. Domain-warped "liquid" distortion

**Reference:** the simplex-distortion liquid backgrounds sold as Framer
components; "liquid" here means viscous deformation, not fractal churn.

**Visual behaviour.** The field is pulled and folded rather than scrambled.
Shapes survive being distorted, which is what separates liquid from noise.

**Construction principle.** Displace by a noise field whose feature size is
*larger* than the features being displaced. Small-scale displacement shreds;
large-scale displacement flows.

**After Effects equivalent.** Turbulent Displace with a large Size and modest
Amount, rather than the reverse. The library already documents both sides of
this rule — Crumpled Foil uses a Size-2 Cross Displacement *because* a
displacement finer than the field shreds it, and Fur was found from the same
mechanism.

**Verdict: no new preset; the principle is already understood and used.**
Liquid Ribbons and Fluid Gradient are the existing members of this family.

---

## 6. Iridescence / thin-film

**Visual behaviour.** Hue shifts with the angle of the surface, not with
position. Cheap rainbow chrome shifts hue with *position*, which is why it looks
cheap.

**After Effects equivalent.** Already built, and built correctly: `Metallic`'s
Iridescent finish drives an `ADBE Glo2` with **Glow Colors: A & B** and
Triangle looping, so the bloom's hue cycles across each fold — i.e. with the
surface, not with the frame.

**Verdict: shipped.**

---

## 7. Aurora

**Visual behaviour.** Long soft luminous ribbons, slow vertical drift,
transparent at the edges.

**After Effects equivalent.** Shipped as `Aurora` in the SilkFlare Engine. Worth
recording what the render actually shows, because it is easy to misread: the
SilkFlare presets are a blurred colour field through a rotating shape matte, so
**most of the frame is genuinely transparent by design**. That is not a hole. It
also means they are light *elements* rather than backgrounds, and stacking one
over footage is the intended use.

**Verdict: shipped, and the transparency is a feature.** Documented here because
the V2.2 measurement pass initially flagged all seven of them as 100% holes.

---

## 8. What the research says the library is missing

Two gaps, and only two:

| Gap | Why it is a gap | Status |
| --- | --- | --- |
| **Glow Border** | No look in the library puts energy on an *edge*. Every one of the forty-three fills a field. | Scoped in section 3 above; not built in V2.2. |
| **Opposing-drift octaves** | The single cheapest change that would make the smooth families read as alive rather than as a slowly sliding sheet. | Technique note; not applied in V2.2 beyond the Oklab Smooth drift. |

Everything else the current web aesthetic is doing, this library already does,
and in several cases does with more control than the web version has — because a
shader's parameters are compiled in and these are sliders.

---

## Sources

- [A flowing WebGL gradient, deconstructed — Alex Harri](https://alexharri.com/blog/webgl-gradients)
- [How to Create Animated Gradient Borders in CSS — Theo Soti](https://theosoti.com/blog/animated-gradient-borders/)
- [A WebGL Ghost That Follows Your Cursor, Built with a Fragment Shader and Spring Physics — Aduok](https://www.aduok.in/blog/how-to-build-a-webgl-ghost-cursor)
- [Interactive Liquid Gradient Background with Three.js — Made By Beings](https://madebybeings.com/blog/interactive-liquid-gradient-background-with-three-js-a-step-by-step-tutorial)
- [Cursor-Reactive Gradients: Making CSS Respond to Mouse Position — DEV](https://dev.to/sammiihk/cursor-reactive-gradients-making-css-respond-to-mouse-position-5ga3)
- [Mesh — Create beautiful mesh gradients](https://meshgradient.com/)
- [WebGL Gradient Generator — gradients.design](https://gradients.design/webgl-gradient)
