# Changelog

## 2.3.0 — unreleased

Browsing the library no longer changes the gradient in your composition. The
Fluid tab and Batch Select are gone. Everything else in this release is the
same interface with the hierarchy sorted out.

Stamp the version with `.	oolsuild.ps1 -Version 2.3.0` before packaging.

### Browsing cannot change your comp — P0

- **Clicking a gradient in Browse used to repaint the one already applied.**
  Both halves are fixed rather than conditioned away.
  - The panel now distinguishes **browsing** (what am I looking at), **draft**
    (what am I configuring) and **active** (what is applied). The draft only
    reaches After Effects while the panel is *bound* to a layer, and browsing to
    another gradient unbinds. See the binding block at the top of `js/main.js`
    and the section in `V22_ARCHITECTURE.md`.
  - Live updates now name the layer they mean. Applying stamps a token into the
    layer's `LIVING_GRADIENT_DATA` comment, and every update afterwards carries
    it. `lgLiveTargets()` resolves that token, or the *tagged* layers the user
    has selected, and otherwise does nothing — the old fallback was "every
    tagged layer in the composition", which is how one update reached gradients
    nobody was editing. Selecting an untagged layer can no longer collect a
    Noise effect either.
  - Loading the inspector — from a card, a preset, or a layer read back off the
    comp — is no longer indistinguishable from a user edit.
- **The inspector header says which state you are in**: DRAFT, or a live dot
  when the panel is driving a layer. It is painted from the same binding the
  updates use, so it cannot claim one thing while the panel does another.

### Removed

- **The Fluid tab**, its WebGL simulation, `js/liquidEther.js`,
  `lib/three.min.js`, the four cursor-response modes and the `getLayerInfo()`
  host bridge that fed it. Primary navigation is Browse, Edit, Presets.
- **Batch Select** in its entirety — the toolbar, the selection state, the tick
  overlay, its styling, and `generateBatch()` in the JSX. It is not replaced.
- Neither removal touches the **Fluid Trail**, which is a different feature: it
  still builds a liquid trail that follows a layer and mattes the gradient into
  it, and it still has all five of its controls. It moved into Advanced.
- The **Fluid Gradient** preset in Waves & Flow is also unrelated and unchanged.

### Browse

- **A search field and family chips** where the Batch Select toolbar was. Type
  to narrow by name, tap to narrow by family; they compose. Searching matches
  the family too, so "metal" finds Molten Gold. Neither touches After Effects.
- Family headings hide when nothing under them matches, and there is a real
  empty state rather than a blank grid.

### Edit

- **Advanced.** Posterize Time and Fluid Trail were sitting at the same size and
  weight as Noise and Glow, which get used every time. They are folded into a
  disclosure that names what is inside, and it remembers being opened.
- **Colour tools.** Four identical unlabelled icon buttons became two labelled
  ones — Pick and Shuffle — and an overflow holding extract-from-image and
  import-palette. Both still work exactly as they did.
- **Save This moved to the end of the tab.** In a docked one-column panel it sat
  between the colours and the settings, which put the whole of Settings below a
  box about filing things away.
- The header opens naming the gradient it is showing, instead of "No Layer
  Selected".

### Presets

- The **Capture button and the "+" button** held nearly the same six items
  between them, and Capture's menu was only on right-click. They are now one
  split button: Capture still fires in one click, and the arrow beside it opens
  everything both menus used to offer.

### Four new SaaS gradients, and how they nearly shipped broken

- **Mesh Bloom**, **Spotlight**, **Corner Glow** and **Twilight Mesh**, on the
  builder the existing SaaS preset already used. 47 gradients in total.
- They went in once on the strength of their **canvas previews**, which are
  hand-drawn imitations of what the builder produces. Built in After Effects
  for the first time, Mesh Bloom was missing a third of its composition, it and
  Twilight Mesh had converged on the same geometry, Spotlight had no core, and
  Corner Glow was clipping 42% of the frame to flat white. All four were pulled
  back out, fixed, re-rendered and measured. `GRADIENT_QA_V23.md` has the
  numbers and the scores; they now measure zero holes, zero blown highlights,
  bandFill 0.99–1.00 and a loop seam under 0.1, at 1080p, portrait, square and
  4K.
- **Every one of them ships a poster rendered from the real builder**, not a
  canvas placeholder.
- The SaaS card painter now does the same arithmetic as the builder rather than
  positions matched by eye, so a card is a fair likeness at any settings.

### The SaaS drift now loops

`wiggle()` is not periodic, so an eight-second SaaS background did not meet
itself at the loop point — measured on the **shipped** preset as a seam of 1.42
against a per-frame motion of 0.95. Replaced with a Lissajous figure on the
comp's own duration, where both frequencies are whole numbers of cycles, so
t=duration lands on t=0 exactly. Seams now measure 0.04–0.09. This reaches
every SaaS-family gradient, including the one that already shipped.

### A candidate system, so this cannot happen again

- **`js/candidates.js`** — a development registry the panel does not load. A
  gradient cannot reach Browse without having been built in After Effects and
  looked at.
- **Three render tools were reading control defaults as literal text** out of
  `js/controls.js`, so any control set generated at run time was invisible to
  them and they silently built the base defaults instead. The first four
  renders of the new presets were four renders of a fifth gradient. All three
  now read `SAAS_VARIANTS` where it is literal, in `js/presets.js`.
- **`tools/render_cards.jsx`** gained `ONLY`/`SILENT` knobs (a 47-gradient run
  outlives the scripting bridge, and its `alert()` blocks both), and its
  `index.json` now merges rather than replaces and no longer discards the
  `loops` list.
- **`saveFrameToPng` was being checked before the bytes landed** in
  `render_cards.jsx`. It only ever failed for files that were *not already on
  disk*, so re-rendering an existing poster passed and every new gradient
  failed — latent since the tool was written, and only reachable the day
  somebody added something.

### Renamed: Digivero is gone

The vendor name was never the author's and has been removed everywhere. The
panel, LICENCE, docs and store links now say **Mohammed Ehtishaam Shaikh**.

- Extension id `com.digivero.livinggradients` → **`com.ehtishaam.livinggradients`**.
- Preset folder `%APPDATA%\Digivero\...` → **`%APPDATA%\Ehtishaam\...`**, with a
  one-time migration: the old tree is **copied** across on first run, the
  original is left where it is, and a banner says what moved and where. Copied
  and not moved on purpose — the worst case is two copies rather than none.
- Store links now point at `ehtishaam.gumroad.com`, including the build's
  outbound-host allowlist.
- The signing certificate's organisation changes, so the next release needs
  `.\tools\build.ps1 -NewCert` once.

### Fixed: `-Version` was corrupting the manifest

`$manifestXml.Save()` round-tripped `CSXS/manifest.xml` through .NET's XML
writer, which reformatted every element onto one line, added a BOM, and wrote
each em dash in the comments back out as the three cp1252 characters it had
been mistaken for. One `-Version 2.3.0` run was enough. The bump is two
regexes on the raw UTF-8 text now, and a `-Version` run leaves the file
byte-identical apart from the number.

### Interface

- **The header no longer overlaps itself at panel width.** Three flex children
  all wanted to shrink and the tab bar could not, so at 400px the wordmark and
  "Browse" were drawn on top of each other.
- The type scale went up about a point across the board; the control labels you
  read while working were smaller than the headings you read once.
- Sliders, number fields, toggle rows and the small square buttons all grew to a
  30px minimum target.
- A spacing scale, so a gap is chosen rather than guessed.

### Docs

- `V22_ARCHITECTURE.md` gains the browsing/draft/active section and loses the
  Fluid one. `V22_FUTURE_IDEAS.md` is new and holds what this pass deliberately
  did not build. `V22_AUDIT.md` and `V22_RELEASE_QA.md` are left alone as dated
  records of 2.2.0.

## 2.2.0 — 2026-09-04

Living Gradients is now a **one-time purchase**. The three-day trial is gone,
every card in Browse shows a real render instead of a drawing of one, and the
Fluid tab's cursor is on the pointer rather than behind it.

### Licensing

- **The 3-day trial is removed entirely.** No trial button, no countdown, no
  badge, no expiry, no migration, and no trial fields left in storage. The panel
  has exactly three states: unlicensed, licensed, activation error.
- The activation screen now says **"Activate your purchase"** and
  **"One-time purchase. No subscription."**
- Gumroad activation is unchanged, including the refund and chargeback checks
  and the purchase-email match. Deactivation still clears the key and returns to
  the activation screen.
- The development bypass stays guarded and the build still refuses to package
  while it is on.

### Previews — the grid stops guessing

- **Every one of the 43 gradients now ships a poster rendered from the real
  builder**, replacing the canvas painters that several gradients shared. The
  painters remain as the fallback for anything unrendered, which is what a fresh
  checkout wants.
- **Animated hover loops for the whole library**, rather than the four metals:
  43 loops, 8 seconds each at 30fps, VP9 in WebM. Every poster is now pulled
  from frame 0 of its own encoded loop, so hovering a card cannot jump.
- **Every loop closes.** `tools/loop_seam_check.js` is new and measures the step
  from a loop's last frame back to its first against an ordinary frame-to-frame
  step: 43 of 43 close, 0 that jump.
- The six noisiest loops are encoded at a higher CRF, which took the preview
  payload from 20.0 MB to 16.4 MB with no visible difference.
- `tools/poster_from_qa.js` is new: it writes posters from the QA frames for any
  gradient that has no loop yet, and leaves alone any gradient that has one —
  because that poster has to keep coming from frame 0 of the encoded loop.

### Fluid — the cursor is the cursor

- **Four responsiveness modes: Snappy (default), Smooth, Fluid, Elastic**,
  selectable on the Fluid tab and remembered.
- **Snappy measures 0px of head error against the pointer.** Smooth 15.7px,
  Fluid 49.7px, Elastic 38.9px mean with 92.1px of deliberate overshoot.
- The simulation now splats **along the path the pointer took**, using the
  sub-frame samples `getCoalescedEvents()` already had, instead of one impulse
  per frame at the last known position. A fast stroke is a stroke rather than a
  dotted line, and the frame's momentum is divided between the steps so the step
  count changes smoothness and not strength.
- Handing over from the idle demo takes **50ms on Snappy instead of 250ms**.
- Two forced layouts per pointer event are gone; the container rect is cached
  and invalidated on resize and scroll.
- A stationary pointer no longer costs a zero-force draw call every frame.

### Gradients

Every gradient in the library was built and rendered in After Effects at
1920×1080 and sampled at five points across its animation. Full record in
`GRADIENT_QA_V22.md`.

- **Every gradient built and rendered at all four comp sizes** — 1920×1080,
  1080×1920, 1080×1080 and 3840×2160 — and after one fix none of them tears at
  any of them.
- **Molten Copper, Gold and Silver punched a 10,709-pixel hole through the
  middle of the frame in portrait.** `Pin All` stops an out-of-bounds fetch at
  the layer edge, but a Bulge mode pushes pixels radially outward from every
  noise cell, and past a point the cell empties faster than its neighbours flow
  in — leaving a region no source pixel maps to, which pinning cannot help. The
  displacement amount is now capped at its own Size, which is the constraint the
  mechanism implies: 433 becomes 351, the folds get slightly broader, and the
  hole is gone at every size.
- **Satin Waves**: 63.8% of the frame was blown to pure white — it rendered as
  white paper with two black lines. The Sheen control was mapped as an exposure
  rather than a highlight. Re-mapped so only the crests catch light: **17.5%**,
  the folds have tonal structure again, and the whole 0–100 range is usable
  instead of destroying the look above about 20.
- **Oklab Smooth** was completely static — measured at 0.00 change across eight
  seconds. Its ramp axis now swings and its reach breathes, on a ~20s cycle,
  with a new **Drift Speed** control.
- **Anime Cells** was also static: it shipped with both Evolution Speed and
  Drift defaulting to 0. Now 12 and 18.
- **Web Threads** collapsed every thread into a 266px band across the middle of
  a 1080px frame, so it rendered as a bright line on an empty field. New
  defaults (taper 1.4, spread 0.09, 18 threads, frequency 11) chosen by
  rendering the sweep; the weave now fills the frame and closes to a real waist.

- Frame-rate independence verified: four gradients across four builders render a
  pixel-identical frame at the same wall-clock moment at 24, 30 and 60fps.

### Backend

- **`js/service.js` is removed.** It pointed at a Cloudflare Worker that has
  never been deployed, so the notification bell could never ring and the
  feedback form could never send. A support channel that swallows messages is
  worse than no channel.
- **"Check for updates"** in the footer menu now opens the product page, which
  is a real destination carrying the current version. `server/worker.js` stays
  in the repository; re-wiring it is a 2.3 item.
- The build now fails on **any** absolute URL in panel JavaScript outside a
  two-host Gumroad allowlist, which catches a re-added placeholder, a leftover
  localhost endpoint and a debug webhook under one rule.

### Fixed

- **The panel reported its version as the literal string `__PANEL_VERSION__`.**
  The version of record moved onto `<html data-panel-version>` when
  `js/service.js` went, and nothing stamped it. `tools/build.ps1` now stamps it
  and **fails the build** if the placeholder is missing, because a version that
  silently falls back to a default is the failure being fixed.
- **Exported presets and backups were stamped `2.0.0`.** `exportPresets()` read
  a global that only `service.js` defined, and fell through to a hardcoded
  default. Both readers now go through one `lgPanelVersion()`.
- `js/service.js` was shipping in the package while nothing loaded it.
- **A partial PNG was being accepted as a finished frame.** `saveFrameToPng`
  returns before the bytes are flushed, so a frame could be read half-written —
  ffmpeg reported `chunk too big` on one, and a truncated frame measures as a
  frame full of holes. The render tools now wait for two consecutive reads at
  the same size.
- **`tools/render_loops.jsx` could not be run unattended.** It finished with
  `alert()` and `report.execute()`; the alert blocks After Effects so every
  later script is refused, and `report.execute()` leaves a security prompt on
  screen because After Effects treats opening a file as running a script. Both
  are now behind a `quiet` flag.
- The frame-write wait was too short for heavy stacks and failed three
  gradients at frame 16–25 with nothing wrong except impatience.
- Empty directories are no longer left inside `css/previews` in the package.
- **The render tools could delete comps they did not create.** All five decided
  which project items were theirs by comparing an item's index against the
  item count recorded before building. Project item indices are not stable —
  the panel enumerates in its own order and every removal shifts everything
  after it — so over a long run the sweep reached pre-existing items and moved
  them into a folder that is deleted at the end. Every tool now snapshots what
  existed before it started and treats only what is not in that list as its own.

### Tooling

- `tools/qa_sweep.jsx` — builds any subset of the library at any comp size and
  saves frames across the animation. Resumable, and everything it creates lives
  under `GRADIENT_PLUGIN_DEV` with a `GPDEV_` prefix.
- `tools/qa_analyse.js` — reads those frames back and measures enclosed holes,
  black voids, crushed blacks, blown highlights, banding, flatness, chroma,
  motion and loop seam.
- `tools/poster_from_qa.js` — posters for anything without a loop yet.
- `tools/qa/drive_loops.sh` — drives the loop render in chunks past the bridge's
  30-second cap.
- **`tools/dropdown_audit.js` — a fourth build gate, and the one that has been
  missing.** The other three all passed in green through the two worst bugs this
  product has had, both of which were a dropdown set to the wrong *value* rather
  than the wrong index. It binds each write to its own effect, range-checks the
  literal against that effect's option count, and asserts the semantics that
  have been wrong before: Turbulent Displace `Pinning` = 11 (Pin All), CC Toner
  `Tones` = 3 (Pentone).

### Compatibility

Unchanged: After Effects CC 2018 (15.0) and newer, Windows and macOS. Presets
saved in 2.1.0 and earlier rebuild exactly as before — no preset format changed,
and no gradient id was renamed or removed.
