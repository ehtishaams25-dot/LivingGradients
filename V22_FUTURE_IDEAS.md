# V22_FUTURE_IDEAS — things found while doing the UX pass, deliberately not built

Opened 2026-09-05, during the UI-direction correction pass.

Everything here was noticed while doing something else. None of it is in the
scope of that pass, so none of it was built. This file exists so that "we should
also…" has somewhere to go that is not the codebase.

Each entry says what it is, why it was left, and where the work would start.

---

## 1. The colour palette tool

**Explicitly out of scope**, by instruction. The plan is a standalone palette
tool that later folds into Living Gradients: empty palettes, favourite colours,
saved palettes, palette presets, image upload, automatic extraction, and using
extracted colours inside a gradient.

Nothing of it was started, and the two pieces the panel already has —
extract-from-image and import-palette — were left exactly as they were. They
moved behind the overflow in the colour tools row, but neither was extended,
and no palette storage of any kind was added.

**When it happens, note:** `js/library.js` already stores palette-kind records
(`rec.kind === 'palette'`), and `lgApplyPalette()` in `jsx/presets.jsx` already
recolours a selected gradient from one. A palette tool would have a place to
land rather than a schema to invent.

---

## 2. ~~Rendered previews for the four new SaaS presets~~ — DONE

Done in 2.3.0. All four were built in After Effects, rendered at delivery size,
measured, scored and given real posters and loops. See `GRADIENT_QA_V23.md`.
All 47 gradients now have both, and `tools/loop_seam_check.js` reports 47 loops
checked, 0 that jump.

## 2b. The library is still the main outstanding job

The brief that opened this work asked to roughly **double** the useful size of
the library, across twelve focus areas: SaaS, 2D/vector, glass, premium,
minimal, dark mode, light mode, AI, iridescent, lighting, gradient borders and
product backgrounds.

What was actually delivered is the **pipeline** plus the first family through
it: a candidate system, three fixed render tools, and four SaaS gradients that
went idea → build → render → measure → fix → re-render → score → ship. 43 → 47.

The remaining eleven areas are untouched, and several of them need genuinely
new builders rather than new parameter sets on `buildSaaS`:

- **2D / vector** (§8) — shape layers with heavy feathering and no fractal
  noise. Nothing in the library is built this way; it is the biggest gap.
- **Gradient borders** (§17) — an edge construction, not a field.
- **Lighting** (§16) — rim, side, top, bottom, sweep. Simple masked ramps, and
  a large amount of value for the work.
- **Edge Glow** (§7) — colour at the edges with a calm centre; wants an
  inverted mask, which the bloom engine cannot express.

Everything else on the list — Soft Product Bloom, Layered Mesh, Horizon,
Product Backlight, Ambient Mesh, the dark- and light-mode sets — is reachable
as parameter sets on the existing SaaS engine, which is what §20 asks for. That
is rows in `SAAS_VARIANTS` plus a pass through the candidate loop, and it is
the cheapest remaining win.

---

## 3. Opposing drift between noise octaves

From `SAAS_GRADIENT_RESEARCH.md` §1, and its own verdict was "no new preset; a
technique to fold into existing ones". One Fractal Noise with Complexity 3 moves
as a single sheet. Two, with opposite Evolution signs and blended, do not — and
that is most of why the web versions read as alive rather than as a sliding
texture.

Aurora and Living Gradient are the two named as gaining most. Both are shipped,
tuned looks, so this is a change to something that currently works: it needs a
side-by-side render before and after, not a confident edit.

---

## 4. Grain defaults to zero

Also from the research doc, §2: every current web generator ships a grain slider
and has it **on by default**, because a wide soft ramp bands at 8-bit and fine
monochrome grain dithers the step away.

`applyGlobalPolish()` already does exactly the right thing. The gap is only that
the panel opens at 0 and makes the user find it. Changing a default changes what
every existing preset builds, so it is a release decision rather than a tweak —
and worth taking, on the SaaS family in particular, where the backgrounds are
wide and flat and band the most.

---

## 5. The precomp takes the gradient's id, not its label

`applyGlobalPolish()` names the grouped precomp `(p.type) + ' Gradient'`, so the
new presets land in the timeline as `SaaSMesh Gradient` rather than
`Mesh Bloom Gradient`. It has always worked this way and no id was ever ugly
before, because until now every id read like its label.

Fixable by sending `label` in the build payload alongside `type`. Left alone
because renaming layers changes what `lgFindStampedIn()` and the capture path
see, and that is not a one-line change to make casually.

---

## 6. Two QA documents still describe the Fluid tab

`V22_AUDIT.md` and `V22_RELEASE_QA.md` were written against 2.2.0 and contain
sections about the fluid simulation, its responsiveness modes and its input
latency. The tab is gone as of 2.3.0.

They were left as they are on purpose: they are dated records of a release that
happened, not living documentation, and rewriting history to match the present
makes both useless. `V22_ARCHITECTURE.md`, which *is* living documentation, was
updated.

If a 2.3.0 release QA pass is run, it wants its own file rather than an edit to
the old one.

---

## 7. Remembering the Browse filter between sessions

The search field and the family chips reset when the panel reloads. Remembering
them is two lines against `LGLibrary.setSetting`.

Left out because it is not obviously right: a remembered filter is also a
remembered way to open the panel and find most of your library missing, which is
the failure the empty state was written for. If it is added, it should probably
remember the family and not the search text.
