# Living Gradients — handoff

Paste this into a fresh chat to bring anyone (or any assistant) up to speed.
Current as of **2026-08-25, v2.1.0**.

---

## What this is

A CEP panel for After Effects that builds 46 procedural gradients out of
native effects — molten metal, glass, halftone, animal prints, anime cel water,
aurora, silk, SaaS blooms. No footage; everything is resolution-independent and
recolourable. Sold by Digivero, licensed through Gumroad.

```
index.html          the panel
css/styles.css      surfaces, brand accent, type scale  (49 tokens)
css/shelf.css       control/motion tokens, shelf, chrome (+40 tokens)
js/store.js         the data folder — atomic writes, rolling backups
js/library.js       presets, collections, folders, fuzzy search, import/export
js/ui.js            toasts, modals, menus, banners, lgHostReady()
js/service.js       version check, messages, feedback
js/shelf.js         the Presets tab
js/footer.js        the bell and the menu
js/boot.js          start-up order (documented at the top of the file)
js/main.js          the gradient half of the panel
js/controls.js      per-gradient slider schemas
js/preview.js       canvas painters for the cards, the posters and the loops
js/colorpicker.js   the fallback colour picker (browser only)
jsx/main.jsx        the builders (~6300 lines)
jsx/presets.jsx     capture, thumbnail render, apply
server/worker.js    Cloudflare Worker: /version /messages /feedback
tools/build.ps1     stage, stamp, check, sign, package, install
tools/recipe_dump.jsx  read a hand-tuned comp back out as text
```

**Three static audits gate the build.** They check things that are invisible on
an English host with a working data folder and break on a customer's machine, so
`tools/build.ps1` fails on any of them rather than warning:

```
tools/index_audit.js   every indexed property write in jsx/main.jsx against the
                       real host dump in tools/effect_probe_report.txt. Found 50
                       wrong indices the first time it ran.
tools/live_audit.js    every gradient has a live tuner, every tuner named
                       exists, every layer name a tuner waits for is one some
                       builder actually assigns.
tools/panel_audit.js   duplicate top-level names across js/*.js (they share one
                       scope), store predicates read instead of called, script
                       tags that point at nothing.
```

Run all three with `node tools/<name>.js`. They take under a second.

Every module explains its own reasoning in its header. That is where the design
decisions live — not in this file.

**Read before touching `jsx/main.jsx`:** `AE_SCRIPTING_RULES.md` and
`LEARNINGS_AND_GOALS.md` (§2.5, §2.6 and §3 especially).

---

## The two rules that catch everyone

**1. Two JavaScript engines.** `js/*.js` is modern Chromium. `jsx/*.jsx` is
ES3 from 1999 — no `toISOString`, `forEach`, `map`, `filter`, `trim`, `let`,
`const` or arrow functions. Identical-looking code behaves differently on each
side of `evalScript`. Never polyfill onto a built-in prototype; ExtendScript
shares one global scope with every other script the user has installed.

**2. `typeof CSInterface !== 'undefined'` is the wrong guard.** CSInterface.js
defines the class in any browser. What is missing outside After Effects is
`window.__adobe_cep__`. Use `window.lgHostReady()`.

**3. An index is only a fallback, and a wrong one is worse than none.**
`LG.set(fx, name, idx, val)` tries the display name, then a normalised scan of
the effect's own properties, then the index. On an English host the name always
wins, so a wrong index sits in the file looking correct for years — and on a
host in another language it sets a *different* parameter rather than failing.
`tools/effect_probe_report.txt` is the ground truth and
`node tools/index_audit.js` checks every one. Never write an index from memory.

**4. Everything store.js exports by name is a function.** `LGStore.available` is
`haveFs`, so `if (LGStore.available)` is always true and sends a write down a
path that cannot work. `panel_audit` catches it.

Because of #2 you can develop the UI in a plain browser:

```bash
python -m http.server 8099
# open http://127.0.0.1:8099/index.html
```

---

## Presets — how they work

`applyGlobalPolish()` in `jsx/main.jsx` stamps the full build payload onto every
generated layer as `layer.comment = 'LIVING_GRADIENT_DATA:' + JSON.stringify(p)`,
and that payload is exactly what `generateGradient()` consumes.

So **capture is a read, not a reverse-engineer.** It is exact by construction.
The cost: it only works on layers this panel made.

Two kinds:
- `kind: 'gradient'` — the whole recipe. Rebuilds at any comp size, so a preset
  must **never** store dimensions.
- `kind: 'palette'` — colours only. Recolours a built gradient without
  rebuilding, so hand-tweaks survive.

**Library vs collections:** a preset exists once in the library; a collection
holds a *reference*. Removing from a collection is soft — it shows as "unused"
in Add from library. Only Delete destroys.

**Where they live** (outside the extension, so updates never cost a preset):

| Platform | Folder |
| --- | --- |
| Windows | `%APPDATA%\Digivero\LivingGradients\v2` |
| macOS | `~/Library/Application Support/Digivero/LivingGradients/v2` |

Resolved via `CSInterface.getSystemPath(SystemPath.USER_DATA)` — **not**
`process.env`, which is absent exactly when the Node fallback is needed and
produced a relative path. Atomic writes, rolling backups, one file per preset
in `presets/` so a truncated index rebuilds.

**After Effects cannot save `.ffx` from script.** No API exists. Our JSON format
is the only option, and better — an `.ffx` is one layer, these gradients are six
plus a precomp and a matte.

---

## Building and installing

```powershell
.\sync_to_cep.ps1              # dev install (delegates to build.ps1)
.\tools\build.ps1              # signed .zxp into dist\
.\tools\build.ps1 -Version 2.2.0
```

`sync_to_cep.ps1` is a thin wrapper on `build.ps1 -SkipSign -Install` on
purpose — two separate copy rules had drifted, and the old one was putting the
entire 18 MB repo into the extensions folder including an open `.debug` port.
Now 1.29 MB.

The build **stages from an allowlist**, strips `.debug`, drops unreferenced
`css/previews`, stamps the version from `CSXS/manifest.xml` into
`js/service.js`, syntax-checks every JS file, and **refuses to build while
`LG_DEV_BYPASS_LICENSE` is true** in `js/license.js`.

**Two install traps, both hit for real:**

1. **`-SkipSign` used to overwrite the shippable package.** Same filename, same
   version, same folder as the signed build — so one verification run replaced a
   release with something no installer accepts, and printed "Release folder:" in
   green while doing it. Unsigned builds now write
   `LivingGradients-<version>-UNSIGNED.zxp` and skip the release folder
   entirely. They cannot collide.

2. **Two folders with the same `ExtensionBundleId` means After Effects loads
   one, and not the one you just wrote.** A hand-copied `LivingGradients` folder
   (the whole repo, 197MB, `.debug` included) sat next to
   `com.digivero.livinggradients` and AE served the stale one — the panel looked
   like the change had not happened. `build.ps1 -Install` sweeps any other folder
   declaring the same bundle id before copying, so **`.\sync_to_cep.ps1` is the
   fix**; never copy the repo into the extensions folder by hand.

If a change appears to do nothing, check for duplicates before debugging the
change:

```powershell
Get-ChildItem "$env:APPDATA\Adobe\CEP\extensions" -Directory |
  Where-Object { Test-Path "$($_.FullName)\CSXS\manifest.xml" } |
  Where-Object { (Select-String -Path "$($_.FullName)\CSXS\manifest.xml" -Pattern 'com.digivero.livinggradients' -Quiet) } |
  Select-Object Name, FullName
```

**Signing:**
- `tools/certificate.p12`, valid to **2037-11-11**. Password in
  `$env:LG_CERT_PASSWORD`.
- **Never regenerate it.** A different certificate makes future updates look
  like a different product to the installer, with no migration path.
- Timestamping is off deliberately: ZXPSignCmd 4.1.103 crashes on
  digicert/sectigo/globalsign TSA responses and errors on the rest. `-Timestamp`
  retries if Adobe fixes it. The 11-year cert makes it non-critical.
- Adobe's own known issue: sign on the platform it will run on, and never ship
  symlinks or `.DS_Store` — that is what causes blank panels.

---

## Backend

`server/worker.js` — one Cloudflare Worker, three routes the panel calls
(`/version`, `/messages`, `/feedback`) plus `/admin/*` behind a bearer token.
Fully tested locally; **not yet deployed**. `js/service.js` still points at the
placeholder `https://api.digivero.dev/living-gradients`, and the build warns
about it. See `server/README.md`.

Privacy: the version and message checks send only the panel version. Feedback
sends what the user typed plus the context block *shown to them in the dialog*
before sending. No identifiers, no telemetry.

---

## State right now

Working and tested in After Effects: preset capture, the Presets tab, settings,
collections, folders, search, import/export, backups.

**Done 2026-08-25:** the whole preset system; the data folder; in-panel dialogs
replacing 6 `alert()`/`confirm()` calls; the footer bell + menu; the diagnostics
banners; three.js vendored to `lib/` (was a CDN fetch, so the Fluid tab needed
internet); the licence bypass turned from buried dead code into a guarded flag;
the build/sign pipeline; **Snakeskin** added to Animal Prints.

**Done 2026-08-26 (later) — the metals came back, measured instead of derived.**

The metals were cut earlier the same day because no amount of reasoning about
Blinn-Phong was producing metal. They are back, and the reason they work now is
a change of method rather than a change of numbers: the panel built a copper,
it was tuned by hand in After Effects until it read as poured metal, and the
finished effect stack was read back off the layer into `MOLTEN` in
`jsx/main.jsx`. **Where the derivation and the measurement disagree, the
measurement wins.** That is the rule this section is really about.

The four settings that mattered, none of which the derived version would have
found:

| | derived | measured |
| --- | --- | --- |
| Motion Tile height | 100 | **25** — the fold is squeezed before it is bent |
| Metal Twist mode | Twist Smoother | **Bulge Smoother** — pushes out along the normal instead of rotating |
| Metal Environment mode | Turbulent Smoother | **Turbulent** — hard enough to break the fold's regularity |
| Reflection bands | 6 | **33** — a thin bright line down the fold, not a wash across it |

- **Molten Copper, Molten Gold, Molten Silver** are one recipe with three
  palettes and a few degrees of light between them. Deliberately: they are the
  same pour, and giving each its own geometry is what made the last set look
  like unrelated accidents.
- **Crumpled Foil needs almost none of the stack.** No ramp, no fold, no twist,
  no environment, no toner, no bloom — `bare: true` switches the whole
  reflection stage off. Everything that makes foil foil is in the height map,
  and the height map is Fractal Noise through a **Cross Displacement at Size 2**.
  A displacement finer than the field shreds it instead of bending it — the
  same mechanism as Fur, found from the other end.
- **Snakeskin absorbed Hammered Metal.** They were two entries on one recipe;
  Snakeskin now carries Hammered's own settings (specular 95, roughness 14,
  drift 6) and Hammered is gone from the library.
- **Liquid Chrome is Satin Waves, in Waves & Flow.** It has no height field, no
  shader and no light — it is a folded ramp being bent, which is a wave. The
  id stays `Metallic` so every saved preset and every `LIVING_GRADIENT_DATA`
  stamp keeps resolving.
- **Polished Chrome and Gunmetal stay cut.** Their recipes remain in
  `METAL_SURFACES` and in `SHADED` so presets saved on them still build and
  still update live; nothing offers them.
- **CC Toner index 3 is Tritone, not Pentone.** ***Corrected 2026-08-31: this
  is exactly backwards. Mode 3 is Pentone, all five stops are live, and the
  claim below that Brights and Darktones are inert is what let `lgToneTri()`
  write three of them and leave two at CC Toner's tan defaults. See the
  2026-08-31 section.*** The molten metals use `lgToneTri()` and take three
  colours because three is what the palette means — but it now fills all five
  stops so the mode cannot matter.
- **A measured recipe is not budgeted.** `lgDisplaceBudget` converts overhang
  into an Amount at a flat 3.2px per unit; the molten stack asks for 433 + 229,
  which that model says needs 2118px of overhang against the 972px that exists
  — and the hand-tuned comp has no holes anywhere. Reach depends on the mode
  and the Size, neither of which the model looks at. What actually makes holes
  impossible is **Pin All** — which `lgTurbSet` *believed* it was setting on
  every one of them and ***was not: it wrote option 1, and Pin All is option
  11. Corrected 2026-08-31; see that section.*** Specs
  that state their amounts get them; specs that derive amounts from the Crumple
  slider still go through the budget, because those are guesses.
- **`tools/recipe_dump.jsx`** — select layers, run it, and it writes every
  effect on every one of them with its enabled flag and every property value,
  following precomps one level down. It exists because a screenshot cannot show
  whether an effect is switched on or which option a dropdown is really set to,
  and those are the two things that decide a look.

**Done 2026-08-26 — the metals removed, the picker handed back to the host.**

- **The nine metals are gone from the library.** Liquid Chrome and Liquid
  Mercury, and the seven shaded plates (Polished Chrome, Brushed Steel, Molten
  Gold, Polished Copper, Gunmetal, Hammered Metal, Crumpled Foil). Every attempt
  to make them read as lit metal rather than as a striped ramp either failed or
  only held at one comp size, and a look that convinces in the card and lies in
  the render is worse than no look. 48 gradients became 39. `buildMetalTexture`
  and `pvMetalCard` stay because **Snakeskin** runs on the hammered height
  field; nothing else reaches them. Presets a customer already saved carry their
  own recipe and still rebuild.
- **A swatch opens After Effects' colour picker.** `openNativeColorPicker()` in
  `jsx/main.jsx` adds a shape layer named `TEMP_COLOR_PICKER`, puts a Color
  Control on it, selects the property, fires `app.executeCommand(2240)` ("Edit
  Value...") and reads the value back — the same trick the first version used,
  **without the `beginUndoGroup()` that made it fatal**. Nothing is open across
  the modal, so there is no undo-group mismatch, and the removal is in a
  `finally`. `$.colorPicker()` is the fallback when no comp is open; it is the
  *operating system's* dialog, not the host's, which is why it is second.
  `js/colorpicker.js` is now the browser fallback and nothing else — it is how
  the panel's interface is still developed without After Effects.
- **The Fluid tab compiled nothing.** Two of its shaders wrote `px.x*2`, and
  GLSL ES 1.00 does not promote int to float in arithmetic, so both programs
  failed to link and the tab rendered black. `2` → `2.0`, eight places.
- **Copy CSS / Copy SVG told the truth.** Both fired
  `navigator.clipboard.writeText()` and relabelled themselves on the next line
  without awaiting it. The Clipboard API needs the document focused and a CEP
  panel loses focus constantly, so the button said "Copied CSS!" over an
  unchanged clipboard. Now: await, fall back to `execCommand('copy')`, and say
  "Copy failed" when both refuse.
- **The Browse toolbar covered its own strip.** Sticky at `top:-16px` with the
  panel's padding outside its box, so cards scrolled through the transparent
  16px above it. Negative margins pull it out to the panel edges.

**Done 2026-08-26 — the endgame pass.**

- **The colour picker moved into the panel.** `js/colorpicker.js` — saturation
  field, hue rail, hex and RGB fields, recents on disk, and the palette's own
  roles down the side. *Superseded the next day: a swatch opens After Effects'
  own picker now, and this runs only when there is no host. See the entry
  above.*
- **50 wrong effect indices fixed**, and `tools/index_audit.js` written so they
  cannot come back. Motion Tile's Output Width was index 1 — Tile Center — in
  five places. Turbulent Displace's Evolution was 5, which is Complexity, in
  six. Every 4-Color Gradient point and colour in ASCII Matrix was off by one
  and Extract's four points by two. The Noise effect has no property called
  "Use Color Noise", so the global Grain slider was never forced to monochrome.
- **Live update for the twelve that had none**, plus `LIVE_ALIAS` for Snakeskin:
  it builds through `buildMetalTexture(..., 'Hammered')`, so its layers are
  called `Hammered Metal`, and every lookup for `Snakeskin Metal` found nothing
  and reported success. `live_audit` now reports 48 of 48.
- **The holes are budgeted against a measured model, and backstopped anyway.**
  `LG_REACH_PER_AMOUNT` replaces the `LG_DISPLACE_HEADROOM` guess and every
  metal's stack now fits its overhang exactly. On top of that each metal carried
  a `<kind> Base` layer — the same reflection, undisplaced and blurred, sitting
  beneath the surface — so a tear could only read as a soft patch, never a void.
  ***Stale: the Base layer was removed afterwards. `buildMetalTexture` builds
  two layers for a shaded finish and one for a molten one, and the live update
  deletes a stale Base when it finds one. Nothing has backstopped a tear since;
  what was actually holding the metals up was oversize alone, with the pinning
  broken underneath it. Corrected 2026-08-31.***
- **CC Glass Displacement is capped by the height field's finest feature.**
  `tools/bisect/06` is smooth flowing ribbons and `07`, whose only difference is
  CC Glass switching on, is wrinkled foil. Foil's field is about 16px across and
  the build was asking for 56px of bending. Height is untouched, so the surface
  is lit exactly as hard as it was.
- **Licence and trial moved out of localStorage** into `license.json` in the data
  folder, with a one-time migration. Clearing the extension's cache is the
  standard fix for a blank panel — and it used to deactivate a paid product.
- `LICENSE.txt` written. The webfonts moved off a blocking `@import`.
  `service.js` makes no requests at all while `API` is still the placeholder, and
  can be repointed from `settings.json` without a rebuild.

**Open:**

1. Deploy the Worker and set `API`.
2. Run `tools/render_loops.jsx` for the remaining gradients. The metals went
   first; clear `ONLY` at the top of the script and it renders whatever has no
   `.webm` yet, so it can be run in chunks. Then `tools/encode_loops.ps1`.
3. Run `tools/reach_calibrate.jsx`, then `node tools/reach_measure.js`, and put
   the measured slope into `LG_REACH_PER_AMOUNT`. It is the last inferred number
   in the file.
4. **Look at the metals in a comp.** Everything above is structural and backed by
   rendered evidence, but nothing has been rendered since it was written, and
   this project's own record is that source-reading diagnoses were wrong and
   rendering ones were right.

**Done 2026-08-27 - the grid stops guessing: posters, and loops on hover.**

The browse grid was forty-three hand-written canvas painters imitating what the
builders ought to produce. The failure that forced this was visible in one
screenshot: Molten Copper, Molten Gold and Molten Silver were *identical* on
screen - one wavy shape in three tints - because `PREVIEW_FAMILY` routes all
three through `pvMetalCard`. Three gradients that look nothing alike in a comp
were indistinguishable in the thing whose whole job is telling them apart.

So the cards show renders now, and move when you point at them:

- `tools/render_loops.jsx` builds each gradient at 1920x1080 (the usual rule -
  the builders carry hard-coded pixel values), scales it to cover a 640x360 comp
  and writes a 270-frame PNG sequence with `saveFrameToPng`. Deliberately not the
  render queue: `outputModule.setSettings` did not exist until AE 2020 and the
  manifest supports 15.0+. **Resumable** - `ONLY` scopes a run, anything with a
  finished `.webm` or a complete sequence is skipped, and a failure deletes its
  own last frame so a half-sequence is never mistaken for a whole one.
- `tools/encode_loops.ps1` closes the loop and encodes it. The gradients do not
  loop on their own - the motion drifts - so 9s is rendered and 8s is kept, with
  the 1s tail crossfaded over the head. **The tail has to be the first xfade
  input.** That ordering is what makes output frame 0 continuous with the last
  body frame; swapping the two puts the jump straight back and the filter graph
  looks equally reasonable either way. Verified numerically on a synthetic ramp
  before any real footage existed: the step across the seam came out at exactly
  1.00, the same as any ordinary frame-to-frame step.
- The panel stacks canvas, poster, loop. Nothing is fetched until the index says
  it exists; no video is created until the first hover; one plays at a time;
  leaving and coming back resumes rather than restarts. `prefers-reduced-motion`
  and a VP9 capability check each fall back to the poster alone.
- `$PreviewBudgetKB` in `tools/build.ps1` went 6144 -> 24576, and the allowlist
  now reads `index.json` as JSON so `cards` can ship `.png` and `loops` `.webm`.
  The stale `css/previews/silk.png` is gone.

The first run found two bugs that had been sitting in committed code:

- **`File.exists` answers as of when the File object was built.** Every frame
  failed its write check with 300KB of perfectly good PNG on disk, because the
  `File` is necessarily constructed before the frame is saved into it and the
  object caches that first answer. `wroteFile()` in `render_loops.jsx` builds a
  fresh `File` per attempt and retries briefly, since `saveFrameToPng` can also
  return before the bytes land. **`tools/render_cards.jsx` has the identical bug
  at its own `!png.exists` check** and has simply never been run.
- **Satin Waves could not build at all.** `tuneMetallic` read `o.foldHeight`
  with no `o` in scope - the line had been pasted in from `tuneMetalSurface`,
  where `var o = lgDefaults(spec, ctrl)` exists, into a function that uses
  `METAL_FINISHES`, which has no `foldHeight` at all. Every build of it threw
  `ReferenceError: o is undefined`, in the panel exactly as in the render tools.
  Now a literal 100. Found only because a render tool tried to build all four.

**Open on this:** only the four metals are rendered. The rest of the library
still shows painters, which is the designed fallback and costs nothing - but the
grid is not finished until they are rendered too.

**Three ways to get card art in, and they all end at the same encoder.**
`tools/queue_loops.jsx` builds every gradient and puts it in the AE render
queue as a PNG sequence - the fast path, and the one to reach for: the queue
has a progress bar, a time estimate and a Pause button, where
`tools/render_loops.jsx` calls `saveFrameToPng` 270 times per gradient with the
application frozen throughout. `tools/import_previews.ps1` skips After Effects
entirely and takes video you made yourself out of `css/previews/incoming/`, in
any format at any size. All three feed `tools/encode_loops.ps1`, which is the
only thing that writes `index.json`.

`queue_loops.jsx` leaves an `LG LOOP QUEUE` folder in the project on purpose -
the queue renders after the script exits, so the comps cannot be swept up the
way `render_loops.jsx` sweeps them. Set `CLEANUP = true` at the top and run it
again once the render is done.

**Do not use `applyTemplate` for render or output settings.** Template names are
localised, and this project has already been bitten once by a locale-dependent
lookup. `outputModule.setSettings()` takes English keys on every locale.

**And do not assume setSettings took.** On AE 2026 the default output module is
H.264, and asking for `Format` and `Output File Info` in one call left it on
H.264 - changing the format resets the output path, so the two must be set
separately, in that order. `queue_loops.jsx` reads the format back after every
attempt, tries a few spellings, then searches the output-module templates for
one whose name mentions png, and if none of that lands it **keeps AE's format
and sets only the path**. A lossy intermediate at 640x360 is not visible after
the VP9 encode, and is much better than a run that refuses to start.
`encode_loops.ps1` takes a movie or a sequence without being told which.

**The encoder does not assume where a sequence starts.** `render_loops.jsx`
names its own frames from 0, the render queue names them from a `[#####]`
placeholder, and ffmpeg's own image muxer starts at 1. `encode_loops.ps1` reads
the first filename and derives the stem, the digit width and the start number
from it.

**`tools/render_cards.jsx` is superseded and is now a trap.** It writes 336x240
posters, and the loops need 480x270 ones to crop identically; running it would
put a sideways jump into every card it touched. `tools/encode_loops.ps1` writes
the posters now. Delete it or fix its size and its `exists` check - do not run
it as it stands.

---

## Agreed next three, in order

**1. SaaS gradient + joystick control.** The SaaS look is mostly clean space
with one big soft bloom off to a side, so *position is the subject* — which is
why these ship together. The joystick is a Figma-style 2D pad emitting x/y 0–1.
Add a `type: 'xy'` control kind to `js/controls.js` that every other builder can
reuse. The coalesced live-update path already carries it while dragging.

**2. Preset Studio.** A "Create preset" button that names it, opens a dedicated
comp, lets the user build, then saves. Honest scope: a guided wrapper around
capture, because a preset is a recipe *for our builders*.

**3. Comp structure recorder.** Walk any comp and serialise every layer, effect,
parameter, keyframe, expression, mask, blend mode and track matte to JSON, then
rebuild on apply. The real "drop anything in, get a preset out". ~600–900 lines
of ExtendScript.

It **must** ship with validation. What breaks: footage/image/audio layers (media
cannot be embedded — reject), third-party effects (needs "requires X"), text
layers (font substitution), expressions referencing layers outside the comp, and
very large comps (need a cap). Note that an expression is code that runs on the
recipient's machine when they apply a shared preset — it cannot touch files, but
it can hang After Effects.

---

## Library conventions that are not obvious

- **Keep all the gradients.** Culling was proposed once and overruled. Do not
  re-propose it.
- **Categories describe what a gradient looks like, not where the recipe came
  from.**
- **SilkFlare Engine (Silk, Aurora, Prism, Fiber, Veil, Pulse, Comet) is
  finished and off-limits.**
- **Nothing new may hold still.** A static surface reads as a photograph rather
  than a background. Default drift speed is never 0 — Snakeskin is the one
  deliberate exception, because a drifting reflection is a metal cue.
- **The preset id `Metallic` is labelled "Satin Waves".** The id was
  deliberately not renamed when the label changed, so saved presets and existing
  layer stamps keep resolving. Expect the id and the label to disagree; the id
  is the one anything in code should key off.
- **Snakeskin routes to `buildMetalTexture(..., 'Hammered')` on purpose.** The
  dimple lattice that reads as beaten metal *is* a field of scales; only the
  lighting said metal. Do not give it its own builder.
- **`tools/contact_sheet.jsx` is the review instrument**, and it must build at
  1920×1080 and scale down — many builders carry hard-coded pixel values, so a
  small render produces wrong diagnoses. `tools/render_cards.jsx` and
  `tools/render_loops.jsx` follow the same rule for the card art.
- **A slider's range must be a range the build can deliver.** The metal Crumple
  went to 400 while the height map's overhang could only pay for 188, so the top
  half of the control did nothing — and Foil's own default of 240 was being
  silently clamped. `HEIGHT_PAD / LG_REACH_PER_AMOUNT` is the cap, and the
  slider now stops exactly there.
- **On CC Glass, Height is lighting and Displacement is bending.** They are not
  two strengths of one thing. Bending further than the distance between one bump
  and the next tears the reflection across the surface instead of flowing it
  over; lighting has no such limit. When a metal reads as crinkled, Displacement
  is the one to pull back.
- **Card previews are loops first, posters second, painters third.** Every
  `.card-preview` stacks all three, and which one you see is decided by what has
  been rendered: the canvas painter always (an imitation, and the only thing an
  unrendered gradient has), `css/previews/<id>.png` over it if there is one, and
  `css/previews/<id>.webm` over both from the first hover onward. `index.json`
  carries a `cards` list and a `loops` list and is the allowlist for the panel
  and the build alike — without it, nothing is requested at all, which is what a
  fresh checkout wants.

- **The painters are not just a fallback, they are a known-wrong fallback.**
  Several gradients share one: `PREVIEW_FAMILY` routes Copper, Gold and Silver
  all through `pvMetalCard`, so the grid showed one wavy shape in three tints for
  three gradients that look nothing alike in a comp. That is why the renders
  exist. Do not spend effort making a painter more accurate — render it instead.

- **Poster and loop must stay the same aspect ratio.** Both are cropped by one
  `object-fit: cover` rule, so if they differ the picture jumps sideways the
  instant a card is hovered, which reads as a glitch rather than a preview. Both
  are 16:9 today (640×360 video, 480×270 poster). The poster is pulled from
  frame 0 of the *encoded* loop, not from the source sequence, because the
  crossfade means those are not the same frame.

- **The loops are VP9 in WebM, and the panel checks before using them.** Adobe's
  CEF build is not guaranteed to carry proprietary codecs, so H.264 is not safe
  and there is no version test that reliably predicts it; `previewCanPlayLoops()`
  asks the browser instead. If the answer is no, every card still shows its
  poster and the grid simply stops moving.
- **PowerShell string literals in `tools/build.ps1` must be ASCII.** The file has
  no BOM, so PowerShell 5.1 decodes it as ANSI; an em dash inside a `"..."`
  becomes a smart double quote, closes the string early, and the file stops
  parsing 250 lines later. Comments and `'...'` are unaffected, which is why the
  em dashes already in there have always been harmless.

---

**Done 2026-08-31 — the metals, measured through a live bridge.**

After Effects was driven directly from the shell this session (Flue's CEP
bridge), so every claim below was rendered and looked at rather than reasoned
out of the source. That is the same rule the metals were rebuilt under, applied
to the diagnosis instead of the recipe.

Three bugs, all of them settings rather than structure, and two of the three
were in code that reads as if it already knew better.

- **`Pinning` was option 1, and Pin All is option 11.** Every Turbulent
  Displace in the library ran unpinned. The index was right — `index_audit.js`
  checks that property 12 is Pinning, and it is — so the audit passed in green
  while the *value* was wrong. **A wrong dropdown value hides in exactly the
  place a wrong index cannot, and nothing here checks for it.**

  Measured: Copper built at 1920×1080, the comp then grown to the metal layer's
  own 5376×3024 so all four edges were in frame, a pure green solid underneath
  so torn alpha could not be read as a dark pixel, all seventeen options
  rendered and the green counted. Option 11 is the only one that tears nowhere.
  Option 1 was leaving **6.64% of the visible frame as hard black voids** — the
  holes hanging off the top of Molten Copper, Gold and Silver.

  One line, twelve call sites. This was never a metal bug; it was in everything
  that displaces, which is why the symptom looked different every time it was
  chased.

- **`lgToneTri` filled three of five stops.** Mode 3 is Pentone, not Tritone —
  `lgToneStops` thirty lines below has always said so and has always written all
  five. So the file held both readings of the same number and acted on the wrong
  one. The two unwritten stops kept CC Toner's defaults: **#c0aa78 and #40320a,
  a tan and a dark olive.** Molten Silver's palette is three neutrals and it
  rendered visibly gold — mean chroma 29.3 against a palette chroma of 14.
  Copper and Gold hid it by being warm already. Sweeping the mode does not fix
  it, because the wrong colours are in the stops; `lgToneTri` now fills all five
  from the palette and the mode stops mattering. Silver came back to 15.3.

- **Crumpled Foil's palette did nothing.** `toner: false` disabled CC Toner, and
  CC Toner is the only thing on a metal that reads the palette — so the panel
  drew four swatches (Shadow, Base Metal, Bright, Highlight) and none of them
  changed a pixel. It rendered at 0.00 mean chroma beside Brushed Steel's 14.35
  off the same shading path. `bare` switches off a stage that is not part of the
  look; a dead colour control is not that.

**Still open on the metals, and it needs your eye, not another render.**
Crumpled Foil reads as fine vertical static rather than as a crumpled sheet.
`crumpleSize` is a real user slider ("Crease Size", 1–40) and it works — the
default of 2 is what makes it static. Swept 2/8/16/26/40: at 40 it has real
pleat structure, at 2 it is noise. **The default was not changed**, because 2 is
documented as read off the tuned sheet and this is a taste call. Renders are in
the session scratchpad.

**A gap worth closing.** The three audits check indices, live paths and panel
scope. Nothing checks that a dropdown *value* means what the code says it means,
and two of today's three bugs were exactly that. `effect_probe_report.txt`
records how many options each dropdown has but not what they are called, so the
check does not exist yet.
