# GRADIENT_QA_V23 — the SaaS family, measured

What happened when four gradients that had shipped without ever being built in
After Effects were finally built in After Effects.

Renders: `tools/qa_sweep.jsx` into `GRADIENT_PLUGIN_DEV / 01_TEST_COMPS`, frames
to `tools/qa/frames/`. Numbers: `tools/qa_analyse.js`. Nothing outside that
folder was touched and the project was never saved.

---

## 1. What the first honest render showed

The four SaaS presets added in 2.3.0 — Mesh Bloom, Spotlight, Corner Glow,
Twilight Mesh — went into `js/presets.js` on the strength of their canvas
previews. The canvas painter is a hand-drawn imitation of what the builder
ought to produce, so what had actually been reviewed was a drawing.

Built for real at 1920×1080:

| | what the card showed | what After Effects built |
|---|---|---|
| Mesh Bloom | three blooms, pastel mesh | **two** blooms; identical to SaaS Gradient |
| Spotlight | a light above the fold | one dim wash, no core |
| Corner Glow | warm corner accent | the same composition again, in orange |
| Twilight Mesh | dark mesh | the only one with a shape of its own |

### The bug underneath was in the tooling, not the gradients

`tools/qa_sweep.jsx`, `tools/render_cards.jsx` and `tools/queue_loops.jsx` all
read control defaults as **literal text** out of `js/controls.js`. The SaaS
variants' sliders are *derived* there at run time from `SAAS_VARIANTS`, so all
three tools found nothing and silently built with the base SaaS defaults.

So the first four renders were four renders of a fifth gradient. Four presets
were very nearly rejected on evidence about something else.

Fixed in all three tools: they now also read `SAAS_VARIANTS` where it is
literal text, in `js/presets.js`. Anything under development states its own
numbers in `js/candidates.js`, which the sweep reads directly.

---

## 2. What was wrong once they were rendered honestly

Real defects, found by looking and by measuring:

- **Mesh Bloom filled the frame corner to corner.** Pretty, and nowhere to put
  a headline. Negative space is a feature; weight moved to the lower left.
- **Mesh Bloom and Twilight Mesh had converged on the same geometry** — same
  spread, same centre, differing only in palette. That is a cosmetic duplicate
  wearing two names. Mesh Bloom is now airy and diffuse, Twilight dense and
  saturated, with different centres of gravity.
- **Spotlight had no core.** At size 150 the bloom was wider than the frame, so
  it read as an evenly dim wash rather than as a light. Reduced to 125, and
  intensity to 100.
- **Corner Glow clipped 42.6% of the frame to flat white.** A `#FFFFFF` page
  under a 96% bloom is a third of the picture with no information in it. The
  page is `#FAF9F7` and the bloom is 88%. (`#FDFCFA` was tried first and sits
  on exactly the 250 threshold — passing a check by one level is not passing.)
- **Nothing in the family looped.** See §3.

---

## 3. The loop seam — an engine bug, on the shipped gradient too

The SaaS blooms drifted with `wiggle()`, which is not periodic. Over an
eight-second comp the position at t=8 has no relation to the position at t=0,
so the gradient does not loop — and these are backgrounds, which is the one
kind of clip that always gets looped.

Measured on the **shipped** SaaS preset: seam 1.42 against a per-frame motion
of 0.95, i.e. the jump at the loop point was larger than a whole quarter of the
animation.

Replaced with a Lissajous figure on the comp's own duration: both frequencies
are whole numbers of cycles across `thisComp.duration`, so t=duration lands on
t=0 to the pixel, and two different whole numbers keep the path from being a
circle. Same slider, same feel.

| | seam before | seam after |
|---|---|---|
| SaaS Gradient | 1.42 | 0.08 |
| Spotlight | 2.08 | 0.06 |
| Twilight Mesh | 1.38 | 0.09 |

This fix reaches every SaaS-family gradient including the one that already
shipped.

---

## 4. Final measurements

`tools/qa_analyse.js`, five samples across the loop, 1920×1080.
`ENCL%` is transparency enclosed by opaque pixels — the zero-tolerance item.

| gradient | ENCL% | VOIDS% | CRUSH% | BLOWN% | bandFill | motion | seam | flags |
|---|---|---|---|---|---|---|---|---|
| Mesh Bloom | 0.0000 | 0.000 | 0.000 | 0.000 | 1.00 | 3.15 | 0.05 | — |
| Spotlight | 0.0000 | 0.000 | 0.000 | 0.000 | 1.00 | 4.64 | 0.06 | — |
| Corner Glow | 0.0000 | 0.000 | 0.000 | 0.000 | 0.99 | 2.34 | 0.04 | — |
| Twilight Mesh | 0.0000 | 0.000 | 0.000 | 0.000 | 0.99 | 3.55 | 0.09 | — |

No holes, no voids, no crushed blacks, no blown highlights, no banding, motion
present on all four, and the loop closes.

### Resolution independence

Built and measured at **1920×1080, 1080×1920, 1080×1080 and 3840×2160**. The 4K
numbers match the 1080p numbers to a decimal (chroma 40.0/40.1, 72.1/71.4,
55.8/55.5, 94.0/95.9), which is what "resolution independent" has to mean for
an engine measured in shortest-axis units. Compositions hold in portrait and
square; Spotlight and Corner Glow are arguably better in portrait than in
landscape.

---

## 5. Scores

Out of 10. Roughly 8 overall to ship.

| | visual | originality | practicality | animation | controls | performance | **overall** |
|---|---|---|---|---|---|---|---|
| Mesh Bloom | 8 | 7 | 9 | 8 | 9 | 9 | **8.3** |
| Spotlight | 8.5 | 8 | 9 | 8.5 | 9 | 9 | **8.6** |
| Corner Glow | 8.5 | 8 | 9 | 8 | 9 | 9 | **8.5** |
| Twilight Mesh | 9 | 8 | 8.5 | 8.5 | 9 | 9 | **8.7** |

Originality is the weakest column and honestly so: these are the archetypal
product-page compositions, not new inventions. They earn their place because
nothing in the library did them, not because nobody has done them before.

**All four approved.** Moved from `js/candidates.js` to `js/presets.js`, and
given rendered posters from `tools/render_cards.jsx` — no canvas placeholder is
shipping as a card for any of them.

---

## 6. What this changed outside the four gradients

- `js/candidates.js` — new. A development registry the panel never loads, so a
  gradient cannot reach Browse without being rendered first.
- `tools/qa_sweep.jsx` — reads candidates, and takes per-gradient control
  overrides (`controlsById`) so a batch can be built each with its own numbers.
- `tools/render_cards.jsx` — gained `ONLY`/`SILENT` knobs (a 47-gradient run
  outlives the scripting bridge, and its `alert()` blocks both), a fix for
  `saveFrameToPng` being checked before the bytes land, and an `index.json`
  that merges rather than replaces and no longer discards the `loops` list.
- All three render tools — read `SAAS_VARIANTS` from `js/presets.js`.
- `jsx/main.jsx` — the SaaS drift is periodic.

The `saveFrameToPng` race deserves its own line: it only ever failed for files
that were **not already on disk**, so re-rendering an existing poster passed and
every new gradient failed. It had been latent since the tool was written and
could only show up the day somebody added something.
