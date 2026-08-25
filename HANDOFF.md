# Living Gradients — handoff

Paste this into a fresh chat to bring anyone (or any assistant) up to speed.
Current as of **2026-08-25, v2.1.0**.

---

## What this is

A CEP panel for After Effects that builds ~33 procedural gradients out of
native effects — liquid metal, glass, halftone, animal prints, anime cel water,
aurora, chrome. No footage; everything is resolution-independent and
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
js/preview.js       canvas painters for the cards
jsx/main.jsx        the builders (~5700 lines)
jsx/presets.jsx     capture, thumbnail render, apply
server/worker.js    Cloudflare Worker: /version /messages /feedback
tools/build.ps1     stage, stamp, check, sign, package, install
```

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

**Open:** deploy the Worker and set `API`. `LICENSE.txt` does not exist and the
build skips it.

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
  small render produces wrong diagnoses.
