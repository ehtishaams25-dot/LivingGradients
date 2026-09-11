# V22_ARCHITECTURE — how Living Gradients is put together

Current as of 2.2.0, 2026-09-04. This is the map. The reasoning behind each
decision lives in the header of the file that made it; this says where to look.

---

## The shape of it

```
                        After Effects
                             │
       ┌─────────────────────┴─────────────────────┐
       │              CEP extension                │
       │  com.ehtishaam.livinggradients             │
       │                                           │
       │   index.html ── the panel                 │
       │        │                                  │
       │   js/*.js ─── Chromium, one shared scope   │
       │        │                                  │
       │        │  CSInterface.evalScript           │
       │        ▼                                  │
       │   jsx/*.jsx ── ExtendScript, ES3          │
       │        │                                  │
       └────────┼──────────────────────────────────┘
                ▼
        the user's composition

   %APPDATA%\Ehtishaam\LivingGradients\v2   presets, outside the extension
   api.gumroad.com                          activation, the only network call
```

**Two JavaScript engines, and they are not alike.** `js/*.js` is a modern
Chromium. `jsx/*.jsx` is ExtendScript — ES3 from 1999, with no `let`, `const`,
arrow functions, `map`, `filter`, `forEach`, `trim` or `toISOString`. Identical
code behaves differently either side of `evalScript`, and ExtendScript shares one
global scope with every other script the user has installed, so nothing may be
added to a built-in prototype.

**`typeof CSInterface !== 'undefined'` is the wrong guard.** CSInterface.js
defines the class in any browser. What is missing outside After Effects is
`window.__adobe_cep__`. Use `lgHostReady()`. That is also what makes
`python -m http.server` a usable way to develop the interface.

---

## The browser half

Load order is fixed by `index.html` and documented at the top of `js/boot.js`.
All fourteen files share one global scope, which `tools/panel_audit.js` polices.

| File | Owns |
| --- | --- |
| `js/store.js` | the data folder — atomic writes, rolling backups, `fs` with a `window.cep.fs` fallback. **Everything it exports by name is a function**; `LGStore.available` is one, so `if (LGStore.available)` is always true and is a bug the audit catches. |
| `js/library.js` | presets, collections, folders, fuzzy search, import/export, settings |
| `js/ui.js` | toasts, modals, menus, banners, `lgHostReady()`, `lgPanelVersion()` |
| `js/license.js` | Gumroad activation, and the only place a licence is read or written |
| `js/presets.js` | `GRADIENT_LIBRARY` — the 47 gradients, their categories, palettes and colour roles, and `SAAS_VARIANTS` |
| `js/controls.js` | the per-gradient slider schemas, including `type: 'xy'` |
| `js/preview.js` | the canvas painters, the render index, and what a card may use |
| `js/colorpicker.js` | the browser-only fallback picker |
| `js/shelf.js` | the Presets tab |
| `js/footer.js` | the menu, settings, help, about, backup and restore |
| `js/main.js` | the gradient half of the panel — tabs, inspector, build, live update |
| `js/boot.js` | start-up order |
| `lib/` | `CSInterface.js`. `three.min.js` went with the Fluid tab in 2.3.0 |

---

## The ExtendScript half

`jsx/main.jsx` is about 7,000 lines and is the builders. `jsx/presets.jsx` is
capture, thumbnail render and apply.

**One entry point.** `generateGradient(payloadJson)` reads the active comp, then:

```
dispatchBuild(comp, type, colors, controls, w, h, dur)
        ↓ builder adds its layers
groupGeneratedLayers(comp, payload, addedCount)
        ↓ precomposes when there is more than one
applyGlobalPolish(comp, payload, layer)
        ↓ grain, glow, posterize, and the recipe stamp
```

**An index is a fallback, and a wrong one is worse than none.**
`LG.set(fx, name, idx, value)` tries the display name, then a normalised scan of
the effect's own properties, then the index. On an English host the name always
wins, so a wrong index sits in the file looking correct for years and then sets a
*different* parameter on a host in another language.
`tools/effect_probe_report.txt` is the ground truth and
`node tools/index_audit.js` checks every one against it.

**A wrong dropdown *value* hides where a wrong index cannot.** `Pinning` was
being written as option 1 for the whole library; Pin All is option 11. Every
audit passed in green while every displacement in the product ran unpinned.
`tools/dropdown_audit.js` is the fourth gate and exists for this: it binds each
write to its effect, range-checks the literal, and asserts the handful of
semantics that have been wrong before.

**The shared construction.** Most of the library is one idea: build a moving
greyscale field, then map that field onto the user's colours through CC Toner.
The split matters — a displaced smooth gradient is still a smooth gradient,
because there is no structure in it to fold. Fractal Noise with Overflow set to
Wrap Back arrives already banded into ribbons, and displacing *those* reads as
liquid.

---

## Presets

`applyGlobalPolish()` stamps the whole build payload onto the generated layer as
`layer.comment = 'LIVING_GRADIENT_DATA:' + JSON.stringify(p)`, and that payload
is exactly what `generateGradient()` consumes.

So **capture is a read, not a reverse-engineer** — exact by construction. The
cost is that it only works on layers this panel made.

- `kind: 'gradient'` — the whole recipe. **Never stores dimensions**, so it
  rebuilds at any comp size.
- `kind: 'palette'` — colours only. Recolours without rebuilding, so hand-tweaks
  survive.

A preset exists once in the library; a collection holds a reference to it.
Removing from a collection is soft. Only Delete destroys.

Stored outside the extension so updates never cost a preset:
`%APPDATA%\Ehtishaam\LivingGradients\v2` on Windows,
`~/Library/Application Support/Ehtishaam/LivingGradients/v2` on macOS — resolved
through `CSInterface.getSystemPath(SystemPath.USER_DATA)`, never `process.env`,
which is absent exactly when the Node fallback is needed.

---

## Previews

Three layers per card, and which one you see depends on what has been rendered:

```
canvas painter  ── always, drawn immediately, a known-wrong imitation
     ↓
css/previews/<id>.png   ── the poster, over it, if the index names it
     ↓
css/previews/<id>.webm  ── the loop, over both, from the first hover
```

`css/previews/index.json` carries a `cards` list and a `loops` list and is the
allowlist for the panel and for `tools/build.ps1` alike. No index means no
requests at all, which is what a fresh checkout wants. A gradient may have a
poster and no loop; the two lists exist for exactly that.

Loops are VP9 in WebM because VP9 is always compiled into Chromium and H.264 is
not. `previewCanPlayLoops()` asks the browser rather than guessing from a version
number; if the answer is no, every card still shows its poster.

**Poster and loop must be the same aspect ratio** — one `object-fit: cover` rule
crops both, so a mismatch makes the picture jump sideways on hover. Both are
16:9: 640×360 video, 480×270 poster. Where a loop exists the poster comes from
frame 0 of the *encoded* loop, not the source sequence, because the crossfade
means those are not the same frame.

**The pipeline, and it is one pipeline:**

```
tools/render_loops.jsx     build at 1920x1080, save 270 frames at 640x360
   or tools/queue_loops.jsx    the same thing through the render queue
   or tools/import_previews.ps1   video you made yourself
        ↓
tools/encode_loops.ps1     crossfade the tail over the head, encode VP9,
                           pull the poster, write index.json
```

`tools/poster_from_qa.js` is the shortcut for a library that is not fully
rendered yet: posters from the QA frames for anything with no loop, and hands off
anything that has one.

---

## Browsing, drafting, and what is actually applied

Three states that were one set of variables until 2.3.0, which is the whole of
the bug where clicking through the library repainted a gradient already sitting
in the comp.

| | question | where it lives |
|---|---|---|
| **Browsing** | what am I looking at? | the selected card in the grid |
| **Draft** | what am I configuring? | `selectedType`, `state.colors`, the controls |
| **Active** | what is actually applied? | one layer in After Effects |

Clicking a card writes to the **draft**. The draft only reaches After Effects
while the panel is **bound** to a layer, and there are exactly two ways to
become bound:

- **Apply to Composition**, or applying a preset from the shelf. The panel mints
  a token (`lgId`), sends it with the build, and the builder stamps it into the
  layer's `LIVING_GRADIENT_DATA` comment.
- **Selecting a Living Gradients layer in the timeline.** The sync poller adopts
  it, flagged `viaSelection`, and gives it back when the selection is cleared.
  A layer the panel *built* is not given back on deselection — clicking
  elsewhere in the timeline is not "stop editing".

Browsing to a different gradient **unbinds**. That is the fix, and it is one
line in the card's click handler in `js/main.js`.

Two guards enforce it, both at the top of the two functions that talk to the
host — `sendLiveUpdate()` and `triggerColorUpdate()`:

```js
if (!lgIsBound() || lgIsLoading()) return;
```

`lgIsLoading()` is the second half. Filling the inspector from a card, a preset
or a layer read back off the comp moves the same controls a pair of hands would,
and every one of those movements used to fire the same "the user changed
something" path. `lgWhileLoading(fn)` holds the door shut for the duration, at
the one choke point every push goes through, so no caller has to remember.

On the host side `lgLiveTargets(comp, lgId)` resolves the target: the layer
carrying that token, else the *tagged* layers the user has selected, else
nothing. There is deliberately no third rule — it used to fall back to every
tagged layer in the composition, which is how one stray update reached gradients
nobody was editing.

The inspector header says which state you are in. See `paintLiveBadge()`.

---

## Build

`tools/build.ps1` stages from an **allowlist**, not a denylist, then:

1. stamps `data-panel-version` into the staged `index.html` from
   `CSXS/manifest.xml` — **and fails if the placeholder is missing**;
2. rewrites the cache-buster query strings;
3. syntax-checks every JS file;
4. runs all four static audits and fails on any of them;
5. refuses to build while `LG_DEV_BYPASS_LICENSE` is true, *and* refuses if the
   flag has been deleted;
6. fails on any absolute URL in panel JavaScript outside the Gumroad allowlist;
7. prunes `css/previews` to exactly what `index.json` names, drops empty
   directories, and fails over a 24 MB budget;
8. signs with `tools/certificate.p12` (valid to 2037-11-11 — **never regenerate
   it**; a different certificate makes updates look like a different product).

Unsigned builds write `LivingGradients-<version>-UNSIGNED.zxp` and get no release
folder, so they cannot collide with a shippable package.

`CSXS/manifest.xml` is the single version of record. Change it there and nowhere
else, or pass `-Version` and let the build write it.

---

## Development

```powershell
.\sync_to_cep.ps1              # dev install
.\tools\build.ps1              # signed .zxp into dist\
.\tools\build.ps1 -Version 2.2.0
```

```bash
node tools/index_audit.js      # every indexed property write
node tools/live_audit.js       # every gradient has a live tuner that resolves
node tools/panel_audit.js      # shared-scope collisions and dead script tags
node tools/dropdown_audit.js   # dropdown VALUES, bound to their own effect
python -m http.server 8099     # the interface, without After Effects
```

Two folders declaring the same `ExtensionBundleId` means After Effects loads
one, and not the one you just wrote. `build.ps1 -Install` sweeps duplicates
before copying, which is why `sync_to_cep.ps1` is the fix and hand-copying the
repository into the extensions folder is never it.
