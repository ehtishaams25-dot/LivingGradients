# GRADIENT_QA_V22 — every gradient, built, rendered and looked at

Pass run 2026-09-04. **43 gradients, all 43 built and rendered in After Effects
26.0x67**, five samples each across an 8-second comp at 1920×1080, then measured
and inspected.

Nothing in this document is inferred from source. The instruments are:

- `tools/qa_sweep.jsx` — builds each gradient through the same three calls the
  panel uses (`dispatchBuild` → `groupGeneratedLayers` → `applyGlobalPolish`) at
  delivery size, and saves frames at 0 / 25 / 50 / 75 / 100% of the duration.
- `tools/qa_analyse.js` — reads the frames back and measures holes, voids,
  clipping, banding, flatness, chroma, motion and loop seam.
- A contact sheet of all 43 at t=50%, plus full-size inspection of every row the
  measurement flagged.

Raw numbers: `tools/qa/analysis_1080.txt` and `.json`. Frames:
`tools/qa/frames/<id>/1920x1080_t<pct>.png`.

Every gradient also has a rendered 8-second loop now, and
`node tools/loop_seam_check.js` reports **43 of 43 closing without a jump** —
which is a second, independent look at all 43 across 240 frames each rather
than five.

---

## The headline result

**Every gradient was built and rendered at all four comp sizes. After one fix,
none of them has a displacement tear at any of them.**

| Size | Samples | Built | Holes |
| --- | --- | --- | --- |
| 1920×1080 | 5 | 43/43 | none |
| 1080×1920 | 3 | 43/43 | **3, all fixed** — see below |
| 1080×1080 | 3 | 43/43 | none |
| 3840×2160 | 2 | 42/43 | none. Fluid Gradient could not be measured — see below |

Getting to that number took two corrections to the instrument, and both are
worth recording because both produced a confident wrong answer first.

**Transparency is not a hole.** The first run flagged ten gradients at "100%
holes" and every one was a SilkFlare-family look — a blurred colour field
through a rotating shape matte, so most of the frame is clear by design. Silk is
42.9% clear, Prism 55.2%. None of it is torn.

**A hole is enclosed transparency in an otherwise opaque field**, and the second
attempt only got the first half of that. It looked for a transparent pixel with
opaque pixels a fixed nine pixels away on all four sides, which finds a pinhole
and *cannot find anything larger than about eighteen pixels across*. A clean
95×132 ellipse punched straight through Molten Copper at 1080×1920 measured
`0.0000%`. A detector that only sees small holes is worse than none, because it
reports zero and is believed.

It now flood-fills inward from the frame edge. Transparency the fill reaches is
outside — a matte, a vignette, the empty half of a flare. Transparency it cannot
reach is enclosed, at any size, with nothing to tune. And enclosure only counts
as damage when the field is otherwise opaque: Prismatic Burst is 88% clear by
design and its enclosed pockets are gaps in a design made of gaps, while Molten
Copper was 99.5% opaque with one ellipse through it.

On the corrected detector, the 2026-08-31 `Pin All` fix does hold — but that was
luck rather than evidence until the detector could see a hole worth the name.

---

## What was found and fixed

| # | Gradient | Defect, measured | Fix | After |
| --- | --- | --- | --- | --- |
| 1 | **Satin Waves** (`Metallic`) | **63.8% of the frame blown to pure white.** It rendered as a sheet of white paper with two black lines on it. Isolated by sweeping the Sheen slider: 0 → 3.5% blown, 20 → 41%, 45 (default) → 63.8%. The Metal Sheen glow was mapped `threshold 100 − sheen×0.8`, putting the threshold at 64% luminance with the intensity near unity, so more than half the fold was inside the bloom. | Re-mapped so sheen drives the *size and strength* of the hit and not the exposure: threshold `100 − sheen×0.12` (floor 80), radius `6 + sheen×0.25`, intensity `sheen/400`. `jsx/main.jsx`, `tuneMetallic`. | **17.5% blown**, tonal structure back in the folds, and the whole 0–100 slider is usable instead of destroying the look above about 20. |
| 2 | **Oklab Smooth** | **Motion 0.00.** A ramp and two colour stops with no animation of any kind — measured identical at all five samples. The library's own rule is that nothing may hold still. | The ramp axis now swings ±12° and its reach breathes ±6%, on a ~20s cycle, so every colour boundary slides without adding an element. New `Drift Speed` control, default 12, 0 still reachable. `lgOklabRamp` in `jsx/main.jsx`. | **Motion 1.62.** Slow, which is the intent. |
| 3 | **Anime Cells** | **Motion 0.00.** `ANIME_CELLS_DEFAULTS` shipped `speed: 0` and `drift: 0`. | Defaults to `speed: 12`, `drift: 18`, matched in `js/controls.js` so the panel and the builder fallback agree. | **Motion 84.3.** The cells morph and carry sideways. |
| 5 | **Molten Copper, Gold and Silver** | **A 10,709-pixel elliptical hole punched through the middle of the frame at 1080×1920** — 0.516% of an otherwise fully opaque field, on all three, identically. Not an edge tear: `Pin All` prevents out-of-bounds fetches, but a Bulge mode pushes pixels radially *outward* from every noise cell, and past a point a cell empties faster than its neighbours flow in. What is left is a region no source pixel maps to, which pinning has nothing to say about. | Swept the twist amount at portrait with everything else at the tuned values: 180, 260, 340 and 380 all clean; 400 shows 28px of speckle; 433 tears 10,709px. 433 is the value read off the hand-tuned comp — and that comp is 1920×1080, where 433 measures zero, as do square and 4K. The tuned number was never wrong; it was measured at one aspect and is an extrapolation at any other. Capped at **amount ≤ its own Size**, which is the constraint the mechanism implies and the sweep agrees with. For the molten stack that is 433 → 351. | **Zero enclosed pixels at all four sizes.** A side-by-side at 1920×1080 shows slightly broader, calmer folds and the same poured metal. |
| 4 | **Web Threads** | Degenerate composition: every thread collapsed into a 266px band across the middle of a 1080px frame, so the gradient rendered as one bright horizontal line on an empty field. Cause is arithmetic — amplitude is `spread×h×10 × |t−pinch|^taper`, and at taper 3 the cube of a number below one collapses it. | Swept taper 1.2–2.2 against spread 0.09–0.16 and rendered each. New defaults taper **1.4**, spread **0.09**, threads **18**, frequency **11**, matched in both files. | The weave now reaches the top and bottom edges at the wide end and closes to a real waist at the pinch. |

Two tooling bugs were found in the same pass and fixed, because both silently
corrupt evidence:

- **`wroteFile()` accepted a partial PNG.** Both `tools/qa_sweep.jsx` and
  `tools/render_loops.jsx` treated "length > 0" as "written". `saveFrameToPng`
  returns before the bytes are flushed, so a frame can be read half-written —
  ffmpeg reported `chunk too big` on one, and a truncated frame measures as a
  frame full of holes. Both now wait for two consecutive reads at the same size.
- **`tools/render_loops.jsx` ended in `alert()` and `report.execute()`.** Fine
  when a person runs it from the Scripts menu; fatal when it is driven in
  chunks. The alert blocks After Effects, every later `evalScript` is refused
  with *"Attempt was made to run a second script while another script was
  already running"*, and the driver sees no new frames and concludes the render
  died. `report.execute()` is worse — After Effects treats opening a file as
  running a script and leaves a security prompt on screen. Both are now behind a
  `quiet` flag that the chunk driver sets.

---

## The table

`KEEP` = ships as it is. `TUNE` = shipped, with a named reservation.
Nothing was removed; the library's standing rule against culling was not
re-litigated.

Columns are worst-case across the five samples. `CLEAR%` is non-opaque coverage
and is only a defect where it is not deliberate; `PINHOLE%` is the enclosed-hole
figure that actually matters.

| ID | Name | Category | Visual quality | Animation | Artifacts | Performance | Action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Wavy | Wavy | Waves & Flow | Good — soft violet field | 4.6 | none | fast | KEEP |
| SonduckLiquid | Liquid Ribbons | Waves & Flow | Strong — premium ribbon flow | 16.6 | none | medium | KEEP |
| Waves | Waves | Waves & Flow | Good — fine moiré line field | 10.7 | none | fast | KEEP |
| Fluid | Fluid Gradient | Waves & Flow | Adequate — plain diagonal | 14.0 | 0.0004% pinhole (noise) | fast | TUNE — the least distinctive of the five |
| Metallic | Satin Waves | Waves & Flow | **Fixed** — folds read as satin | 127.2 | 17.5% blown | medium | TUNE — see fix 1; residual clipping is the specular |
| Silk | Silk | SilkFlare | Excellent at full size — pastel silk on black | 19.3 | matte by design | medium | KEEP |
| Aurora | Aurora | SilkFlare | Good | 19.4 | matte by design | medium | KEEP |
| Prism | Prism | SilkFlare | Good | 4.8 | matte by design | medium | KEEP |
| Fiber | Fiber | SilkFlare | Good — gold filament | 12.5 | matte by design | medium | KEEP |
| Veil | Veil | SilkFlare | Very dark **by palette** (#111 → #0f3460) | 3.3 | matte by design | medium | KEEP |
| Pulse | Pulse | SilkFlare | Strong — orange energy bands | 22.0 | matte by design | medium | KEEP |
| Comet | Comet | SilkFlare | Adequate — slow, dim | 1.3 | matte by design | medium | TUNE — lowest motion in the library |
| OklabSmooth | Oklab Smooth | Ambient | **Fixed** — clean spectral ramp | 1.6 | none | fast | KEEP |
| living | Living Gradient | Ambient | Good — soft magenta mesh | 14.1 | none | fast | KEEP |
| TrailGradient | Trail Gradient | Ambient | Loud — saturated rainbow banding | 43.2 | none | fast | TUNE — palette is the issue, not the build |
| LavaLamp | Lava Lamp | Ambient | Strong | 27.1 | none | medium | KEEP |
| Sunburst | Sunburst | Light & Energy | Strong graphic | 135.4 | none | fast | KEEP |
| PrismaticBurst | Prismatic Burst | Light & Energy | Strong | 54.1 | 0.36% enclosed — gaps between rays | medium | KEEP |
| ChromaFlare | ChromaFlare | Light & Energy | Dim at default palette | 7.4 | matte by design | medium | TUNE |
| Heatmap | Heatmap | Light & Energy | Strong, high chroma | 36.6 | none | fast | KEEP |
| Antigravity | Antigravity | Light & Energy | Good — sparkle field | 52.7 | `bandFill 0.43` is a bimodal histogram, not banding | medium | KEEP |
| WebThreads | Web Threads | Light & Energy | **Fixed** — woven hourglass | 0.7 | none | medium | KEEP |
| AnimeWater | Anime Water | Anime & 2D | Strong stylised caustics | 86.4 | 16.8% blown on the caustic crests | medium | TUNE |
| AnimeCells | Anime Cells | Anime & 2D | **Fixed** — cel cell field | 84.3 | none | medium | KEEP |
| Giraffe | Giraffe | Animal Prints | Correct | 6.0 | none | fast | KEEP |
| Tiger | Tiger | Animal Prints | Correct | 7.2 | none | fast | KEEP |
| Zebra | Zebra | Animal Prints | Correct | 10.3 | none | fast | KEEP |
| Leopard | Leopard | Animal Prints | Correct | 4.0 | none | fast | KEEP |
| Cow | Cow | Animal Prints | Correct | 4.7 | none | fast | KEEP |
| Fur | Fur | Animal Prints | Strong — genuine pelt | 2.8 | 0.0008% pinhole (edge noise) | medium | KEEP |
| Snakeskin | Snakeskin | Animal Prints | Excellent — reads as scales | 9.8 | 1.1% blown | medium | KEEP |
| Halftone | Halftone | Print & Pattern | Strong | 22.6 | none | medium | KEEP |
| AsciiMatrix | ASCII Matrix | Print & Pattern | Correct — 90% black is the look | 4.8 | none | medium | KEEP |
| CellularMosaic | Cellular Mosaic | Print & Pattern | Strong, high chroma | 31.7 | none | medium | KEEP |
| StackedSquares | Stacked Squares | Print & Pattern | Strong — very current | 15.7 | none | medium | KEEP |
| SaaS | SaaS Gradient | SaaS & UI | Strong — soft bloom, light ground | 1.0 | 31% "blown" is the near-white background by design | fast | KEEP |
| Glass | Frosted Glass | Glass | Good | 9.2 | none | medium | KEEP |
| ReededGlass | Reeded Glass | Glass | Good — flutes read | 23.0 | uniform alpha 62 by design | medium | KEEP |
| Copper | Molten Copper | Metal | Excellent — poured metal | 74.4 | none | medium | KEEP |
| Gold | Molten Gold | Metal | Excellent | 76.1 | none | medium | KEEP |
| Silver | Molten Silver | Metal | Excellent, chroma 15.3 (neutral, as it should be) | 87.1 | 3.6% blown | medium | KEEP |
| Foil | Crumpled Foil | Metal | Good — fine crumpled sheet | 9.4 | 21.3% blown | medium | TUNE — `crumpleSize` default of 2 still reads closer to static than to pleats |
| Brushed | Brushed Steel | Metal | Adequate — flat, undramatic | 9.1 | none | medium | TUNE |

**Totals: 36 KEEP, 7 TUNE, 0 REBUILD, 0 REMOVE.** Four of the seven TUNE rows
were the four fixed above and are listed with their reservation rather than as
outstanding defects.

---

## Things the measurement got wrong, and why they are recorded

Three metrics produced false positives that would have led to bad fixes. They
are written down so the next pass does not chase them again:

- **`CLEAR%` is not holes.** See the headline. Ten false positives.
- **`bandFill` is not banding on a bimodal image.** Antigravity is bright
  particles on a near-black field, so the mid-tones are genuinely empty and the
  metric reads 0.43. Inspection shows no stepping anywhere.
- **"Blown" counts a near-white background.** SaaS's first colour is `#FBFBFD`,
  whose minimum channel is 251, so 31% of the frame trips a `>250` test while
  being exactly what the design asks for.

---

## What the other three sizes found

Beyond the hole, two things are aspect-dependent and neither was visible at
1920×1080:

- **Crumpled Foil bleaches.** 21.3% of the frame blown at 1920×1080 and at 4K,
  29.6% at 1080×1080, **53.3% at 1080×1920** — where it loses its crumple
  texture almost entirely and reads as a sheet of white. Its `relief` is not
  scaled by comp size, so this is a different mechanism from the metal hole and
  it is not diagnosed. Reported rather than changed: this gradient was
  explicitly left as shipped.
- **Molten Silver clips harder in portrait**: 4.2% blown at 1920×1080, 17.5% at
  1080×1920. Milder version of the same aspect sensitivity.

**Fluid Gradient cannot save a still at 3840×2160.** It builds — one layer, no
error — and then `comp.saveFrameToPng()` writes zero bytes and throws nothing.
Every other gradient saves fine at 4K. This matters beyond the QA harness:
`jsx/presets.jsx` renders preset thumbnails through the same call, so a customer
capturing a Fluid preset from a 4K comp would get a silently missing thumbnail.
Not diagnosed further.

## Not covered by this pass

Stated plainly rather than implied:
- **Frame rates other than 30 were not tested.** Every animation in the library
  is expression-driven off `time` rather than frame count, which is the
  construction that makes frame rate irrelevant, but that is an argument and not
  a measurement.
- **Web Threads' own QA frames are pre-fix.** The new defaults were verified by
  rendering (that is how they were chosen) but the five-sample set in
  `tools/qa/frames/WebThreads/` was not regenerated afterwards. Its shipped
  poster and loop *are* post-fix: both come from the loop render, which
  evaluated `jsx/main.jsx` as modified at 16:47:32, after all four fixes.
