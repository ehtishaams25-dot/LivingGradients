# VECTOR_GRADIENT_RESEARCH — the 2D/vector gap, and what fills it

Researched 2026-09-05, against the library as it stands at 54 gradients.

`V22_FUTURE_IDEAS.md` §2b calls 2D/vector "the biggest gap" and stops there.
This is the work that was owed. Nothing here is built.

Same bar as `SAAS_GRADIENT_RESEARCH.md`: a candidate earns a row only if it is
a **visual system nothing in the library already is**. Several ideas that look
new turn out to be an existing builder with different numbers, and those are
named and dropped rather than quietly padded into the list.

---

## 1. The gap, stated precisely

The library is not short of looks. It is short of *one kind of construction*.

Every one of the 54 gradients is a **field**: a continuous function evaluated
at every pixel. Four flavours of it —

| construction | where | count |
|---|---|---|
| noise-driven field | Fractal Noise / Turbulent Displace into a colour map | ~30 |
| ramp-driven field | Ramp, 4-Colour Gradient, Colorama, polar warps | ~12 |
| bloom-driven field | soft solids blurred and stacked (the SaaS engine) | 5 |
| pattern-driven field | Cell Pattern, Mosaic, Halftone, Venetian Blinds | ~7 |

None of them contains a **countable set of forms with their own silhouettes**.
There is no frame in the library where you could point and say "there are five
things here, and that one is in front."

`buildStackedSquares()` is the single exception, and even it is half-hearted:
five rounded rects, flat white fills, colour arriving from a 4-Colour Gradient
underneath and a Drop Shadow doing the separation. It is the only builder that
calls `addShape()` for anything other than a matte.

That is the gap. Not "more colours" or "more motion" — **edges**. A discrete
shape has an inside, an outside and a boundary, and a field has none of those.
It is why the library cannot currently produce a gradient border, a papercut
stack, an arc, a light bar, or any of the flat editorial work that is most of
what "2D gradient" means to a designer in 2026.

It is also, usefully, the cheapest gap to close, because shapes render fast and
have no evolution to tune.

---

## 2. The constraint that decides every design below

**You cannot script a gradient fill on a shape layer.**

`ADBE Vector Grad Colors` — the stop data on Gradient Fill and Gradient Stroke —
has `propertyValueType` of `NO_VALUE`. It throws on read and on write. This is
not a version quirk or a locale problem; it is a decade-old hole in the
ExtendScript API with an open Adobe feature request against it and no
workaround that survives contact with an existing layer. (`applyPreset()` can
carry a gradient in, but it lands as a *new group*, not onto the group you
built, which makes it useless to a parameterised builder.)

So the obvious construction for this family — "draw a shape, fill it with the
user's ramp" — **is not available**, and any plan written without knowing that
will die on its first build.

**This project has already been bitten by it once.** `buildOklabSmooth` — the
first card in the library — shipped as a plain white-to-black ramp with none of
the palette in it, because it was setting a Gradient Fill's `Colors` from a
flat array and every stop was being rejected. The attempt sat inside an empty
catch with a comment guessing at version differences, so it never surfaced. The
note is still in `jsx/main.jsx` above that function. The constraint is not
new information; it is information the codebase learned once and did not write
down anywhere a plan would find it.

### The construction that does work, and is already in the codebase

Colour goes on a **solid**, geometry goes on a **shape**, and the shape mattes
the solid.

    solid  + ADBE Ramp / ADBE 4ColorGradient / Colorama   <- the user's colours
    shape  (no fill needed, or flat white)                <- the silhouette
           shape.moveBefore(solid)
           solid.setTrackMatte(shape, TrackMatteType.ALPHA)

`buildSilkFlare()` already does exactly this at `jsx/main.jsx:1733` — a star
shape matting a blob comp — so this is a proven route in this project, not a
theory. `ADBE Set Matte3` is the alternative where a track matte would eat a
layer slot.

**Every candidate below is costed on that basis.** The one-line version: a 2D
gradient is a *matte generator*, and the colour engine is the one the library
already has.

Second-order consequences worth knowing before anything is scoped:

- **Feather.** Shape layers have no per-shape feather. Soft edges come from
  `ADBE Fast Box Blur` on the matte layer (blur the *matte*, not the colour),
  or Mask Feather if masks are used instead of shapes. Blurring the matte is
  better: it keeps the colour ramp crisp while the silhouette goes soft.
- **Path operators are entirely unused.** The codebase uses only Repeater
  (`ADBE Vector Filter - Repeater`) and Round Corners (`- RC`). Offset Paths,
  Trim Paths, Zigzag, Wiggle Paths, Pucker & Bloat and Merge Paths are all
  untouched, and all of them are the natural machinery for this family.
- **Loop safety.** Every candidate below animates on `time` through rotation,
  offset or trim — all trivially loopable, unlike noise Evolution.
  `tools/loop_seam_check.js` should pass these more easily than the noise
  families, not less.

---

## 3. The candidates

Ranked. Each says what it is, how it is built, what new machinery it needs, and
why it is not something the library already ships.

### Tier 1 — the ones that close a category by themselves

#### 3.1 Glow Border *(edge energy)*

Already scoped in `SAAS_GRADIENT_RESEARCH.md` §3 and parked in
`V22_KNOWN_LIMITATIONS.md`. Restated here because the matte finding in §2
removes the reason it was parked.

**What you see.** A band of colour travelling around the perimeter of a
rounded rectangle, reading as *light* rather than as a coloured outline. The
current standard treatment on dark-theme SaaS and AI product cards.

**Construction.** One ramp, drawn twice. A rounded-rect shape with a *stroke*
and no fill mattes a solid carrying a 4-Colour Gradient; the whole thing
rotates on `time`. Duplicate it, Fast Box Blur ~40, blend Screen at ~60%,
place beneath. The two-copy structure is the entire trick — the blurred twin
is what makes the bright stops spill outward and read as emission.

**New machinery.** A border control cluster: corner radius, inset, thickness.
That is what stopped it before, and it is genuinely a new cluster rather than
sliders on an existing one. Everything else is stock.

**Why it is not a duplicate.** Nothing among 54 puts energy on an edge. They
all fill a field. This is the largest hole in the library by usefulness per
unit of work, and "glowing outline around a card" is a shot motion designers
are actually briefed for.

**Cost.** Medium — low build, one new control cluster.

---

#### 3.2 Light Bar *(the sheen sweep)*

**What you see.** A long, soft, angled bar of light crossing an otherwise calm
field, the way a highlight travels across glass or brushed metal in a product
shot. The most-used single move in tech advertising, and the library cannot do
it.

**Construction.** A rotated rect shape, very tall and narrow, heavily blurred,
matting a solid holding a two-stop Ramp. Position driven off `time` so it
crosses the frame and wraps. Add or Screen over a base ramp layer. Optionally a
second, wider, dimmer bar trailing it at a different rate so the two never
synchronise — same principle as the opposing-drift note in the SaaS research.

**New machinery.** None. Solid + Ramp + shape matte + Fast Box Blur, all
already used elsewhere.

**Why it is not a duplicate.** Sunburst is radial rays from a point. Metallic
is a folded ramp. Neither produces a single travelling highlight with a
direction and a speed. The closest thing in the library is nothing.

**Cost.** Low. The cheapest genuinely new look on the list, and it should
probably be built first as the proof that the matte route works.

---

#### 3.3 Papercut Stack *(layered flat bands)*

**What you see.** Four to seven stacked horizontal bands with soft wavy tops,
each flat-coloured a step along the ramp, each casting a short shadow onto the
one below. Reads as cut paper or as stylised terrain. Editorial, print-adjacent,
and strong in light mode — a mode the library is thin in.

**Construction.** One wide rect path per band with `ADBE Vector Filter - Wiggle`
(Wiggle Paths) at low Detail giving it a soft crest, or a Zigzag at high
smoothness. Repeater in Y for the stack, or explicit layers if each band needs
its own colour. Each band mattes a solid tinted to one stop of the ramp — or,
cheaper, the whole stack mattes one Ramp solid and the *shadows* do the
separation. Drop Shadow with Distance small and Softness high. Animate by
drifting each band's Wiggle Paths phase at a different rate.

**New machinery.** Wiggle Paths and/or Zigzag — both stock, neither currently
used. A per-band count control.

**Why it is not a duplicate.** Stacked Squares stacks concentric squares from a
centre; this stacks bands from an edge, and the silhouettes are organic rather
than geometric. Different composition, different use.

**Cost.** Medium.

---

#### 3.4 Arc Stack *(concentric rings / rainbow arcs)*

**What you see.** Concentric arcs radiating from a corner or an edge, each a
flat step of the ramp, with even gaps. The retro-editorial "sunrise" mark that
runs through current brand work, and one of the few looks that survives being
printed.

**Construction.** An ellipse path, stroked, with `ADBE Vector Filter - Trim`
(Trim Paths) cutting it to an arc. Repeater with a Scale transform of ~118%
per copy for the concentric expansion, and a per-copy opacity falloff. The
whole shape group mattes a Ramp solid, so each ring reads a different colour by
virtue of *where it sits in the ramp* — which is the trick that makes this
cheap. Animate with Trim Offset for a chase, or Repeater scale for a pulse.

**New machinery.** Trim Paths. A ring-count and ring-gap control.

**Why it is not a duplicate.** Ring and radio-wave shapes appear nowhere.
Sunburst is filled wedges from a centre; this is unfilled strokes, and the gaps
are half the look.

**Cost.** Low–medium.

---

### Tier 2 — strong, but each overlaps something by a little

#### 3.5 Hard Stripes *(optical, no blur)*

**What you see.** High-contrast vertical stripes of *varying* width, producing
an optical rhythm rather than a texture. This is the "anti-flat by friction"
move that current background writing keeps naming: the reaction against
mathematically perfect smoothness, achieved with pure geometry and zero noise.

**Construction.** A rect Repeater with an expression driving each copy's width
from its index — a sine or a golden-ratio series, so the rhythm reads as
composed rather than random. Mattes a Ramp solid. Animate by drifting the
expression's phase; the stripes appear to breathe without anything moving.

**Overlap.** `ADBE Venetian Blinds` is already used elsewhere and produces
*even* stripes. The whole point here is uneven, so the overlap is smaller than
it looks — but it is real, and this should follow Tier 1.

**Cost.** Low.

---

#### 3.6 Blob Field *(vector metaballs)*

**What you see.** Three to six organic blobs with defined silhouettes, drifting
and overlapping, each carrying a slice of the ramp. The Y2K/product-page look
that every Figma mesh-gradient plugin ships.

**Construction.** Ellipse paths with Pucker & Bloat to break the circle,
wiggled positions, `ADBE Vector Filter - Merge` set to Add so overlapping blobs
fuse into one silhouette. That merged silhouette mattes a 4-Colour Gradient
solid. Fast Box Blur on the matte controls how liquid the fusion reads.

**Overlap — and this one is serious.** The SaaS engine already makes soft
coloured masses on a ground, and at high blur these two converge to the same
frame. The distinction only holds at *low* blur, where the blobs keep a visible
edge and the SaaS blooms cannot. **Recommendation: build it deliberately
edge-forward, or do not build it.** A soft version of this is `SaaSMesh` with
different numbers, and `GRADIENT_QA_V23.md` already records what happens when
two presets converge on the same geometry and nobody notices until render.

**Cost.** Medium.

---

#### 3.7 Edge Glow *(inverted vignette)*

Named in `V22_FUTURE_IDEAS.md` §7 as unreachable by the bloom engine. It is
reachable by this one.

**What you see.** Colour pooled at the frame edges with a calm, empty centre —
the inverse of every vignette. Excellent as a product background, because the
middle is left free for the product.

**Construction.** A full-frame rect, `ADBE Vector Filter - Offset` (Offset
Paths) at a negative amount to inset it, Merge Paths set to Subtract against
the outer frame, giving a band. Heavy blur on that matte, over a Ramp. That
Offset Paths → Subtract pair is the general-purpose "make a band from any
shape" move, and it is worth building once as a helper.

**Overlap.** Shares the border geometry cluster with Glow Border (§3.1), so if
that is built this is nearly free. Build them together or not at all.

**Cost.** Low *if* §3.1 lands first. Medium standalone.

---

#### 3.8 Grid Fade *(structure meeting a ramp)*

**What you see.** A dot or line grid that fades across the frame under a
gradient, so the structure dissolves into flat colour. The default backdrop of
AI and developer-tool marketing. The library has no orthogonal structure at
all — everything in it is organic or radial.

**Construction.** `ADBE Grid` or a two-axis dot Repeater as the matte; a Ramp
solid as the colour; a second Ramp as a luma matte on the grid itself so it
fades directionally. Animate by drifting grid offset — one of the few looks
that is *better* for moving in a straight line.

**Overlap.** Ascii Matrix is a grid of glyphs, but it is a text texture and
reads as content, not structure. Cellular Mosaic is irregular by design.

**Cost.** Low.

---

### Tier 3 — named for completeness, recommended against for now

- **Bauhaus / Memphis Blocks.** Four or five large flat primitives on a flat
  ground. Genuinely absent, genuinely on-trend — but composition *is* the look,
  and a parameterised builder producing arbitrary arrangements will produce
  mostly bad ones. This wants presets that are fixed compositions, which is a
  different product decision. Left.
- **Synthwave Bands.** Hard horizontal bands tightening toward a horizon over a
  soft ramp. Buildable (Repeater with an exponential Y offset), but it is a
  single strong period reference rather than a reusable system, and Sunburst
  already occupies the warm-radial-retro slot.
- **Chevron / Zigzag.** Zigzag on a stroke, Repeater down the frame. Cheap, but
  it is Hard Stripes (§3.5) with a different path operator, and would read as
  padding.
- **Holographic Foil.** Spectral iridescence where hue shifts with surface
  angle — a real absence, since Crumpled Foil is achromatic metal. But it is a
  *field* technique (Colorama with a cyclic ramp driven by a smooth gradient),
  not a vector one, so it belongs to different work. Worth its own entry on the
  eleven-area list; not part of this family.

---

## 4. What this would do to the library

Tier 1 alone is four gradients and a new category — call it **Vector & Flat** —
which already has one resident filed in the wrong place: Stacked Squares sits
under Print & Pattern and belongs here.

| | now | after Tier 1 | after Tier 1+2 |
|---|---|---|---|
| gradients | 54 | 58 | 62 |
| categories | 11 | 12 | 12 |
| built from shapes | 1 | 5 | 9 |

It also lands three of the eleven untouched brief areas — 2D/vector, gradient
borders and lighting — rather than one.

---

## 5. Suggested order, and why

1. **Light Bar** (§3.2). No new machinery, no new controls. Its real job is to
   prove the solid-plus-shape-matte route end to end through
   `js/candidates.js` → `qa_sweep` → measure → score, before anything is built
   on top of it.
2. **Arc Stack** (§3.4). Introduces Trim Paths and the "one ramp, many rings,
   colour by position" trick that §3.5 and §3.8 both reuse.
3. **Glow Border + Edge Glow** (§3.1, §3.7) together. They share the border
   geometry cluster; building either alone pays that cost twice.
4. **Papercut Stack** (§3.3). Introduces Wiggle Paths, and is the only one of
   the four that is strong in light mode.

Every one goes through `js/candidates.js` first. `GRADIENT_QA_V23.md` is the
record of what happens when gradients ship on the strength of their canvas
previews, and the canvas painter in `js/preview.js` will be *worse* at these
than at the noise families — a hand-drawn imitation of a hard-edged shape is
much more convincing than a hand-drawn imitation of noise, and therefore much
more dangerous.

---

## 5a. What is in the workshop as of 2026-09-06

All four of Tier 1 are written and none has been built in After Effects. They
are candidates, in the strict sense the workshop means: **not in the product,
not in Browse, not applicable, and with no cards.**

| where | what |
|---|---|
| `jsx/main.jsx` | `buildLightBar`, `buildArcStack`, `buildGlowBorder`, `buildPapercut`, plus the `lgVectorMatte` / `lgVectorGroup` / `lgShapeOp` helpers and `lgPapercutColor` |
| `jsx/main.jsx` | four cases in `dispatchBuild()`, written separately rather than as one shared branch so `live_audit` can see them |
| `js/candidates.js` | four entries with their own numbers, verified against `qa_sweep`'s own parsing regexes |
| `tools/shape_probe.jsx` | **new, and run this first** |

**`tools/shape_probe.jsx` exists because `effect_probe.jsx` cannot see shape
operators** — it only dumps layer effects, so Trim Paths, Wiggle Paths, Offset
Paths and Merge Paths have never had their matchNames or indices measured from
this project. The probe applies every one of them to a scratch shape layer and
reports what applied, every property, and each property's clamp. The trap it
exists for:

    Wiggle Paths      ADBE Vector Filter - Roughen
    Wiggle Transform  ADBE Vector Filter - Wiggler

Both apply cleanly. Swap them and the bands slide about with straight edges
instead of the edge being shaped — a silent wrong build, which is the failure
mode this project meets most often.

For the same reason **no index is passed to any shape property** in the four
builders, only names. `LG.find` tries the index last but does try it, and a
guessed index that resolves sets the wrong parameter and reports success. Once
the probe has run, real numbers can replace the nulls.

### Two magnitude errors, found before rendering rather than after

Both were the same mistake — a softness scaled off the comp rather than off the
thing being softened — and both are the class of bug `V22_KNOWN_LIMITATIONS.md`
records for Crumpled Foil's unscaled relief:

- **Light Bar.** Blur off the comp's short side put a ~209px blur on a ~173px
  bar at the defaults. The beam would have dissolved completely. Now a fraction
  of the bar's own width.
- **Glow Border.** Same scaling put a ~166px blur on a ~10px stroke — coloured
  fog with no edge in it. The CSS pattern this comes from blurs a ~2px ring by
  ~40px, so the glow is now a multiple of the stroke, and that ratio is what
  makes it read as emission rather than as a halo.

### The probe crashed After Effects twice, and the cause is still open

Recorded in full because the first diagnosis was confidently wrong, and the
second run is what disproved it.

**Run 1.** `shape_probe.jsx` found each property's option count the way
`effect_probe.jsx` does — push 100000 in, read where it lands. AE 26.0.0.67
died: `EXCEPTION_ACCESS_VIOLATION` reading `0x1c0`, in

    extendscript -> Scripting -> AEGPDriver
      -> BEE_CmdAddToIndexedStreamGroup
        -> BEEp_CmdLayerLeaving
          -> TDB_StreamBase::GetDisplayName

It took the report and the sandbox project's unsaved state with it. Since
`Repeater > Copies` at 100000 is self-evidently a terrible idea — shape
operator parameters are not only numbers, some *generate geometry* — that was
assumed to be the cause and all value-probing was removed.

**Run 2, with every write gone, crashed identically.** So the writes were
probably never the cause. `BEE_CmdAddToIndexedStreamGroup` **is**
`addProperty`, and `GetDisplayName` dereferencing null at `0x1c0` is a stream
with no name yet. Something in the operator list cannot be constructed by
script in this context and takes the application down on the spot.

**Which operator is still unknown.** Suspects, in order:

| matchName | why |
|---|---|
| `ADBE Vector Shape - Group` | "Path" — a bezier path with no path data |
| `ADBE Vector Filter - Merge` | Merge Paths, which wants more than one path |
| `ADBE Vector Graphic - G-Fill` | Gradient Fill, whose `Colors` is `NO_VALUE` |

**None of the three is used by any of the four builders.** Arc Stack needs Trim
and Repeater, Papercut needs Wiggle Paths, Glow Border needs Rect and Stroke,
Light Bar needs Rect and Fill. So the family is not blocked on this — the probe
is.

**Both symptoms looked like a bridge fault, not a script fault.** The POST
never returned; After Effects went on answering `Responding: True` with no
visible dialog for a while. The truth was in
`%APPDATA%\Adobe\After Effects\26.0\logs\AfterFX_*.crash` both times. When an
AE script "hangs", read the crash log before blaming the bridge.

**The probe now reports as it goes**, which is the change that matters: every
operator is flushed to `tools/shape_probe_report.txt` before the next is
attempted, and `tools/shape_probe_progress.txt` names the operator currently
being tried. A crash now *names its own cause* instead of destroying the
evidence. `$.global.LG_SHAPE_PROBE_SKIP` excludes known-fatal matchNames so a
later run can get past them. It remains read-only apart from one 8px seed
rectangle, which is there because `Trim Paths` and `Merge Paths` act on the
paths above them and an empty group is the other known way to crash AE.

**Two crashes on one afternoon is the real lesson here.** Both came from firing
a script at a live After Effects on a theory rather than on a measurement,
which is the same mistake `GRADIENT_QA_V23.md` records in a different costume.
The next run should skip all three suspects, not test them.

### Gates

`live_audit`, `index_audit`, `dropdown_audit` and `panel_audit` all PASS.
`panel_audit`'s standing note that `js/candidates.js` ships and nothing loads it
is the intended arrangement, not a regression.

### What is still owed before any of these could ship

1. Run `tools/shape_probe.jsx`, then fill in the shape property indices.
2. Run `tools/qa_sweep.jsx` and *look at the frames*.
3. `COLOR_ROLES` entries in `js/presets.js` — each of the four has named roles
   (`Ground / Ground Glow / Beam / Beam Core`, and so on) and none is written
   down yet, because roles on a preset that does not exist would be a fiction.
4. Slider definitions in `js/controls.js`, a canvas preview in `js/preview.js`,
   a live-tune path, and rendered poster and loop.

### Expected weak points, stated in advance

So that a bad first render is diagnosis rather than surprise: Light Bar's seam
at the loop point if `span` is too short for the blur; Arc Stack's outer rings
leaving the frame, because Repeater Scale compounds and ring 7 is much larger
than `gap` suggests; Glow Border's twin reading as a halo rather than as light;
Papercut's bands showing a straight edge, which would mean Wiggle Paths did not
apply.

---

## 6. Sources

- Studio 2am, *Grain, Glass & Gradient: 2026 Background Design Trends* —
  https://studio2am.co/blogs/news/grain-glass-and-gradient-the-background-is-having-a-moment
- Awwwards, *Trendy Gradients in Web Design* —
  https://www.awwwards.com/gradients-in-web-design-elements.html
- Superdesign, *Aurora UI: The CSS Gradient Recipe, Real Examples, and When It Breaks* —
  https://superdesign.dev/styles/aurora
- Theo Soti, *How to Create Animated Gradient Borders in CSS* —
  https://theosoti.com/blog/animated-gradient-borders/
- Adobe Community, *A usable PropertyValueType for ADBE Vector Grad Colors* —
  https://community.adobe.com/t5/after-effects-ideas/a-usable-propertyvaluetype-for-adbe-vector-grad-colors/idc-p/14758806
- Adobe Community, *Why can not I read the color values of Gradient Fill or Stroke in the after effects script?* —
  https://community.adobe.com/t5/after-effects-discussions/why-can-not-i-read-the-color-values-of-gradient-fill-or-stroke-in-the-after-effects-script/m-p/8885630
- Adobe Help, *Overview of shape layers, paths, and vector graphics* —
  https://helpx.adobe.com/after-effects/using/overview-shape-layers-paths-vector.html
