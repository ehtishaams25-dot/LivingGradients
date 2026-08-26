# Living Gradients — handoff

Paste this into a fresh chat to bring anyone (or any assistant) up to speed.
Current as of **2026-08-25, v2.1.0**.

---

## What this is

A CEP panel for After Effects that builds 39 procedural gradients out of
native effects — glass, halftone, animal prints, anime cel water, aurora, silk,
SaaS blooms. No footage; everything is resolution-independent and recolourable.
Sold by Digivero, licensed through Gumroad.

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
js/preview.js       canvas painters for the cards, and the real renders
js/colorpicker.js   the fallback colour picker (browser only)
jsx/main.jsx        the builders (~6300 lines)
jsx/presets.jsx     capture, thumbnail render, apply
server/worker.js    Cloudflare Worker: /version /messages /feedback
tools/build.ps1     stage, stamp, check, sign, package, install
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
  metal's stack now fits its overhang exactly. On top of that each metal carries
  a `<kind> Base` layer — the same reflection, undisplaced and blurred, sitting
  beneath the surface — so a tear can only read as a soft patch, never a void.
  That part does not depend on the constant being right.
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
2. Run `tools/render_cards.jsx` once for the real card images.
3. Run `tools/reach_calibrate.jsx`, then `node tools/reach_measure.js`, and put
   the measured slope into `LG_REACH_PER_AMOUNT`. It is the last inferred number
   in the file.
4. **Look at the metals in a comp.** Everything above is structural and backed by
   rendered evidence, but nothing has been rendered since it was written, and
   this project's own record is that source-reading diagnoses were wrong and
   rendering ones were right.

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
- **The preset id `Metallic` is labelled "Liquid Chrome".** The id was
  deliberately not renamed so saved presets and existing layer stamps keep
  resolving.
- **Snakeskin routes to `buildMetalTexture(..., 'Hammered')` on purpose.** The
  dimple lattice that reads as beaten metal *is* a field of scales; only the
  lighting said metal. Do not give it its own builder.
- **`tools/contact_sheet.jsx` is the review instrument**, and it must build at
  1920×1080 and scale down — many builders carry hard-coded pixel values, so a
  small render produces wrong diagnoses. `tools/render_cards.jsx` follows the
  same rule for the card images.
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
- **Card previews are renders first, painters second.** `css/previews/<id>.png`
  from `tools/render_cards.jsx`, with `js/preview.js` painting immediately and
  swapping the image in when it loads. `index.json` in that folder is the
  allowlist for both the panel and the build — without it, no image requests are
  made at all.
- **PowerShell string literals in `tools/build.ps1` must be ASCII.** The file has
  no BOM, so PowerShell 5.1 decodes it as ANSI; an em dash inside a `"..."`
  becomes a smart double quote, closes the string early, and the file stops
  parsing 250 lines later. Comments and `'...'` are unaffected, which is why the
  em dashes already in there have always been harmless.
