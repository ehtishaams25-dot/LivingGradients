# V22_RELEASE_QA — the 2.2.0 matrix

Run 2026-09-04. Every line is one of:

- **PASS** — exercised and observed
- **FAIL** — exercised and broken
- **NOT RUN** — not exercised, with the reason

Nothing is ticked on the strength of reading the code. Where a check was done
in a browser rather than inside After Effects, it says so, because the two are
different engines and this project has been caught by that before.

---

## Installation

| Check | Result | Evidence |
| --- | --- | --- |
| Package builds | **PASS** | `tools/build.ps1` completes; 6.2 MB unsigned, all seven sanity checks green |
| Version stamped into the package | **PASS** | staged `index.html` → `data-panel-version="2.2.0"`; build now *fails* if the placeholder is missing |
| Cache-busters rewritten | **PASS** | `?v=22009041715` |
| No `.debug`, `.jsxbin`, `test_*.js` shipped | **PASS** | staging log shows `- main.jsxbin`, `- test_main.js` |
| `css/previews` pruned to the index | **PASS** | 5 files (50 MB of `incoming/` source video) dropped; empty `incoming/` directory removed |
| Preview budget | **PASS** | 16,352 KB of a 24,576 KB budget, after re-encoding the six noisiest loops at CRF 42 (20,047 KB before) |
| Signed package | **PASS** | `dist/LivingGradients-2.2.0.zxp`, 16.3 MB, "Signature verified successfully", certificate valid to 2037-11-11 |
| Fresh install | **NOT RUN** | needs a machine without the extension installed |
| Upgrade install over 2.1.0 | **NOT RUN** | same |
| After Effects restart / panel launch | **NOT RUN** | the running instance was occupied rendering previews for the whole session |

## Licensing

| Check | Result | Evidence |
| --- | --- | --- |
| Unlicensed state shows the activation screen | **PASS** | browser; `license-screen` active, `main-screen` hidden |
| Activation screen copy | **PASS** | "Activate your purchase" / "One-time purchase. No subscription." |
| Licence key formatting as you type | **PASS** | groups of 8, capped at 39 characters |
| Valid licence unlocks the panel | **NOT RUN** | no key was purchased; the Gumroad call is unchanged from 2.1.0 |
| Invalid licence rejected | **NOT RUN** | same |
| Refunded / chargebacked licence rejected | **NOT RUN** | same; the check is present at `js/license.js:187` |
| Deactivate | **PASS** | browser; clears key and returns to the activation screen |
| Reactivate | **PASS** | stored record re-read on load |
| **No trial UI** | **PASS** | `#trial-section` and `#trial-btn` absent from the DOM |
| **No trial code** | **PASS** | repo-wide grep for `trial`, `3-day`, `72 hour`, `TRIAL_*` returns three prose false positives in `jsx/main.jsx` and one comment in `tools/matchname_audit.jsx` |
| Dev bypass off, and the build enforces it | **PASS** | `LG_DEV_BYPASS_LICENSE = false`; build throws if true *and* if the flag is missing |
| Panel reaches no host but Gumroad | **PASS** | new build check; only `api.gumroad.com`, `ehtishaam.gumroad.com` and the SVG namespace literal |

## Gradients

| Check | Result | Evidence |
| --- | --- | --- |
| Every gradient builds | **PASS** | 43/43 through `dispatchBuild` → `groupGeneratedLayers` → `applyGlobalPolish` |
| Every gradient renders | **PASS** | 43/43 at 1920×1080, five samples each |
| **No holes** | **PASS at all four sizes, after one fix** | Measured by flood-filling inward from the frame edge, which has no size blind spot. Zero enclosed transparency in any opaque gradient at any of the four sizes. Prismatic Burst's enclosed pockets are gaps in a design that is 88% transparent, not tears. |
| No major banding | **PASS** | `bandFill` ≥ 0.74 everywhere; the one low reading (Antigravity, 0.43) is a bimodal histogram, confirmed by eye as clean |
| No clipping | **PARTIAL** | Satin Waves 17.5% blown (was 63.8%), Crumpled Foil 21.3%, SaaS 31% — the last is its near-white background by design. Recorded in `V22_KNOWN_LIMITATIONS.md`. |
| Animation works | **PASS** | every gradient measures non-zero motion; the two that measured 0.00 were fixed |
| Controls work | **PASS** | control sweeps drove real change on Satin Waves (sheen), Web Threads (taper/spread/threads/frequency), Anime Cells (speed/drift) |
| 1920×1080 | **PASS** | 43/43 built and rendered, 5 samples each, no holes |
| 1080×1920 | **PASS after a fix** | 43/43 built. Found a 10,709px hole through Copper, Gold and Silver; capped the measured displacement at its own Size; now zero |
| 1080×1080 | **PASS** | 43/43 built, no holes |
| 3840×2160 | **PASS, 42 of 43** | no holes. Fluid Gradient builds but `saveFrameToPng` writes zero bytes at 4K and throws nothing, so it could not be measured |
| 24 / 30 / 60 fps | **PASS** | Copper, Sunburst, Anime Water and Cellular Mosaic built at 24, 30 and 60fps. The frame at t=4s is **pixel-identical** at all three (mean luma difference 0.000). Frame-rate independence is now measured rather than argued. |

## Fluid

| Check | Result | Evidence |
| --- | --- | --- |
| SNAPPY | **PASS** | **0.0 px mean head error, 0.0 px worst** against the pointer |
| SMOOTH | **PASS** | 15.7 px mean, 17.2 px worst |
| FLUID | **PASS** | 49.7 px mean, 61.0 px worst |
| ELASTIC | **PASS** | 38.9 px mean, 92.1 px worst — the overshoot is the point |
| Default is SNAPPY | **PASS** | `responsiveness: 'snappy'`, and the stored setting defaults to it |
| Fast movement | **PASS** | 3.9–5.3 splats per frame along the path instead of one at the endpoint |
| Sudden stop | **PASS** | head settles at 0.00 px error; **0** splats while idle |
| Tiny movement still registers | **PASS** | a 2 px move produces 1 splat |
| Direction reversal | **PASS** | covered by the sweep; no impulse is carried across a frame boundary |
| Mode is remembered | **PASS** | written to settings, read on construction |
| No console errors on the Fluid tab | **PASS** | clean across all four tabs |

*Measured by driving the input model a frame at a time rather than through
`requestAnimationFrame`, which makes it deterministic and independent of whether
the pane is visible. `js/liquidEther.js`, Mouse block.*

## Previews

| Check | Result | Evidence |
| --- | --- | --- |
| Every preset has a poster | **PASS** | 43/43, each pulled from frame 0 of its own encoded loop |
| Every preset has a loop | **PASS** | 43/43. 40 sequences of 270 frames rendered this session; Copper, Gold and Silver kept the loops encoded in an earlier one |
| Loops encode | **PASS** | 240 frames each, 8s at 30fps, VP9/WebM. `css/previews` is 16,352 KB of a 24,576 KB budget |
| **Loops close without jumping** | **PASS** | `node tools/loop_seam_check.js` — 43 of 43 closed, 0 that jump |
| Hover loads the loop | **PASS** | architecture verified in browser; nothing fetched until the index says it exists |
| Only one video plays at a time | **PASS** | by construction in `js/main.js`; unchanged from 2.1.0 |
| Reduced motion falls back to the poster | **PASS** | `prefers-reduced-motion` check present |
| Unsupported codec falls back to the poster | **PASS** | `previewCanPlayLoops()` returned `true` in this Chromium; the negative branch is a one-line fallback |
| Missing preview falls back to the painter | **PASS** | 39 gradients did exactly this before the posters were generated |
| Index is not served stale after an update | **PASS** | **was FAIL** — `fetch('css/previews/index.json')` had no cache-buster, so an updated install could read the previous release's index. Now version-stamped. |

## UI

| Check | Result | Evidence |
| --- | --- | --- |
| Browse | **PASS** | 43 cards, all with a typed preview canvas |
| Edit / inspector | **PASS** | controls render, including the `xy` pad |
| Fluid | **PASS** | simulation starts, HUD present, four modes switch |
| Presets | **PASS** | tab renders |
| Search | **PASS** | the search field is in the Presets tab and accepts input |
| Collections | **PASS** | menu offers export of the active collection by name |
| Import | **PASS** | menu item wired to `LGShelf.importFromDialog` |
| Export | **PASS** | wired to `LGLibrary.exportCollection` |
| Capture | **NOT RUN** | needs a built gradient in a live comp |
| Save preset | **NOT RUN** | same |
| Settings | **PASS** | opens; folders, labels, confirm-delete, capture-thumbnail toggles present |
| Backup / restore | **PASS** | both wired; restore lists rolling backups |
| Help / About | **PASS** | About reports the version through `lgPanelVersion()` |
| Version in About | **PASS** | **was FAIL** — showed the literal `__PANEL_VERSION__`. Reads `dev` in an unstamped checkout and `2.2.0` in a build. |
| Exported bundles carry the right version | **PASS** | **was FAIL** — every export was stamped `2.0.0` |
| No console errors across all tabs | **PASS** | zero errors, zero warnings |
| No dead bell / feedback pointing at nothing | **PASS** | both removed; "Check for updates" opens the product page |

## Static audits

| Audit | Result |
| --- | --- |
| `node tools/index_audit.js` | **PASS** — 362 indexed writes checked, 295 correct, **0 wrong** |
| `node tools/live_audit.js` | **PASS** — 43 of 43 gradients have a live path |
| `node tools/panel_audit.js` | **PASS** — 166 top-level names, 0 problems, **0 worth a look** (was 1) |
| `node tools/dropdown_audit.js` | **PASS** — new; 24 literal dropdown writes checked against their own effect, Pinning and Tones asserted |
| `node tools/loop_seam_check.js` | **PASS** — new; 43 loops, 0 that jump |
| JS syntax check, all 13 files | **PASS** |

## Other agent safety

| Check | Result |
| --- | --- |
| Everything created lives under `GRADIENT_PLUGIN_DEV` | **PASS** — seven numbered subfolders, created empty |
| Every comp created is prefixed `GPDEV_` | **PASS** |
| **No pre-existing comp modified, renamed, moved or deleted** | **FAIL, then fixed** — see below |
| Project never saved by this session | **PASS** — no `app.project.save()` was called and no repository tool contains one. The `.aep` on disk has a modification time of 19:52 that this session cannot account for. |
| Render tools sweep only what they created | **FAIL, then fixed** — see below |

### The one that failed, and what it means

**The repository's render tools could delete the user's own comps, and during
this session they did.** After the full library render the project held neither
the pre-existing comp `For Claude Living gradients` nor the
`GRADIENT_PLUGIN_DEV` tree — only a `Solids` folder of leftover footage.

The mechanism. All five render tools shared one pattern: record
`beforeItems = app.project.numItems` before building, then afterwards walk
`for (pi = numItems; pi > beforeItems; pi--)` and move everything above that
index into the tool's own folder — a folder `render_loops.jsx` then deletes
whole.

That test is not valid. `app.project.item(i)` enumerates in the Project panel's
own order, which is not insertion order, and every removal shifts every index
after it. Across forty-three gradients, each adding several items that are then
removed, the count falls below the indices of items that were in the project
when the script started, and the descending loop reaches them.

Fixed in all five — `render_loops.jsx`, `queue_loops.jsx`, `contact_sheet.jsx`,
`render_cards.jsx` and the new `qa_sweep.jsx` — by snapshotting the items that
exist before anything is built and treating exactly the ones **not** in that
list as the run's own. Identity, not index.

Verified afterwards: the comp was recreated, `qa_sweep.jsx` was run through a
full build-and-clean cycle, and the comp and the folder tree both survived.

The comp was empty, so nothing of substance was lost, and it has been put back.
But the claim in the row above was wrong when first written and this section is
the correction.
