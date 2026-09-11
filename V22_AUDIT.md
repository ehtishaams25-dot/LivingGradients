# V22_AUDIT — Living Gradients, commercial finishing pass

Audited 2026-09-04 against the working tree on `lg/pre-fix-snapshot`.
Manifest version at audit time: **2.1.0**. Target: **2.2.0**.

Method: every claim below is either read out of the source, produced by running
one of the repo's own audits, or measured through the live After Effects bridge.
Where a claim is inherited from `HANDOFF.md` and has not been re-verified, it is
marked *(inherited)*.

---

## 1. Current architecture

| Layer | Where | State |
| --- | --- | --- |
| CEP panel shell | `index.html`, `CSXS/manifest.xml` | Works. AEFT 15.0-99.9, 340x700 default, `--enable-nodejs --mixed-context`. |
| Browser/UI side | `js/*.js`, 14 files, one shared global scope | Works. `panel_audit.js` gates the scope. |
| ExtendScript side | `jsx/main.jsx` (7030 lines), `jsx/presets.jsx` | Works. ES3 only. `LG.set(fx,name,idx,val)` resolves by display name first, index last. |
| AE bridge | `CSInterface.evalScript`, guarded by `lgHostReady()` | Works. Never `typeof CSInterface`. |
| Fluid system | `js/liquidEther.js` + `lib/three.min.js` (vendored) | Renders. Perceived latency is the open problem — see section 4. |
| Preset system | `js/store.js`, `js/library.js`, `js/shelf.js`, `jsx/presets.jsx` | Works. Recipe stamped on the layer as `LIVING_GRADIENT_DATA`; capture is a read, not a reverse-engineer. |
| Preview system | `js/preview.js` + `css/previews/index.json` | Architecture complete and correct. **Content is 4/43.** |
| Licensing | `js/license.js` | Gumroad activation only. Trial already gone from the working tree. |
| Backend | `server/worker.js` + `js/service.js` | Worker written, **never deployed**. `service.js` is now orphaned — see section 3. |
| Build | `tools/build.ps1` | Works, allowlist-staged, signs with `tools/certificate.p12` (valid to 2037-11-11). **Version stamping is broken by the working tree — see section 3.** |

**Library:** 43 gradients across 11 categories (Waves & Flow 5, SilkFlare
Engine 7, Ambient & Organic 4, Light & Energy 6, Anime & 2D 2, Animal Prints 7,
Print & Pattern 4, SaaS & UI 1, Glass 2, Metal 5). Down from 48 historically:
nine metals were cut, six came back measured, Hammered was absorbed by Snakeskin.

**Static audits — all three pass as of this audit:**

```
index_audit  362 indexed writes checked, 295 correct, 0 wrong, 67 not checkable
live_audit   43 of 43 gradients have a live-update path
panel_audit  166 top-level names, 0 problems, 1 worth a look (service.js orphan)
```

**After Effects bridge is live.** Flue 1.0.31, AE 26.0x67, project open is
`For claude living gradients 1.aep` — one empty 1920x1080/30fps/60s comp named
`For Claude Living gradients`, zero layers. Scripting file/network security is
enabled (`Pref_SCRIPTING_FILE_NETWORK_SECURITY = 1`), so `saveFrameToPng` works.
Nothing in that project belongs to another agent; it is a sandbox prepared for
this work. All dev structure is still created under `GRADIENT_PLUGIN_DEV` with
`GPDEV_` comp names, per section 0 of the brief.

---

## 2. Feature status

| Feature requested | Status | Evidence |
| --- | --- | --- |
| Trial removal | **Working** (done in working tree, unverified in a build) | Repo-wide grep for `trial`, `3-day`, `72 hour`, `TRIAL_*` returns only three prose false positives in `jsx/main.jsx` and one comment in `tools/matchname_audit.jsx`. |
| Paid Gumroad activation | **Working** | `js/license.js:180` posts to `api.gumroad.com/v2/licenses/verify`, checks `refunded`/`chargebacked` and email match. |
| Dev bypass guarded | **Working** | `LG_DEV_BYPASS_LICENSE = false`; `build.ps1:344` throws if true, and `:347` throws if the flag has vanished. |
| License UX copy | **Working** | "Activate your purchase" / "One-time purchase. No subscription." already in `index.html`. |
| `type: 'xy'` joystick control | **Working** | `js/controls.js:16` (`position` on SaaS), rendered at `:750`, read at `:889`. Reusable by any builder. |
| SaaS gradient | **Working** | `SaaS` preset, `SaaS & UI` category, four roles including `Background` first. |
| Preview architecture (poster/loop/painter, lazy, one-at-a-time, reduced motion, codec check) | **Working** | `js/preview.js:700-853`; `previewCanPlayLoops()` asks the browser for VP9. |
| Preview **content** | **Broken — 4 of 43** | `css/previews/index.json` lists Copper, Gold, Metallic, Silver only. 39 gradients show a canvas painter that the project's own notes call a known-wrong fallback. |
| Preview tooling | **Partially working** | `render_loops.jsx`, `queue_loops.jsx`, `encode_loops.ps1`, `import_previews.ps1` all real. `render_cards.jsx` is a documented trap (wrong 336x240 size, `File.exists` bug). |
| Fluid responsiveness | **Partially working** | Simulation is correct; the input path is not. See section 4. |
| Responsiveness modes (SNAPPY/SMOOTH/FLUID/ELASTIC) | **Not implemented** | No mode concept exists in `liquidEther.js`. |
| Backend / update check / feedback | **Broken by removal** | `js/service.js` is no longer loaded but still ships. See section 3. |
| Version stamping | **Broken** | See section 3. |
| Gradient visual QA | **Not started** | No gradient has been rendered and inspected in this pass. |

---

## 3. Known issues, with locations

### P0 — release blockers

**P0-1 · The panel reports its version as the literal string `__PANEL_VERSION__`.**
`index.html:2` carries `data-panel-version="__PANEL_VERSION__"` and
`js/footer.js:12` reads it, but `tools/build.ps1:218-250` only knows how to
stamp `var PANEL_VERSION = '...'` in `js/service.js` — a file that is no longer
loaded. Every shipped build would show `Version __PANEL_VERSION__` in About.

**P0-2 · Exported presets and backups are stamped `2.0.0`.**
`js/library.js:578` reads `LG_PANEL_VERSION`, which only `js/service.js:418`
ever defined. With `service.js` unloaded the fallback fires, so every
`.lgrad` / `.lgcollection` a customer exports claims to come from 2.0.0.

**P0-3 · `js/service.js` ships and nothing loads it.**
`panel_audit.js` reports it. 16.5 KB of dead code, plus a network module aimed
at an undeployed placeholder host. Either wire it back or stop shipping it.

**P0-4 · Manifest is still 2.1.0.** `CSXS/manifest.xml:17-21`.

**P0-5 · 39 of 43 gradients have no rendered preview.** The grid's whole job is
telling gradients apart, and the painters demonstrably fail at it — the project's
own record is that Copper, Gold and Silver rendered as one shape in three tints.
`PREVIEW_FAMILY` still routes all five metals through one painter and the seven
SilkFlare presets through four.

**P0-6 · No gradient has been visually verified in this pass.** The brief's rule
and the project's own rule agree: measurement beats derivation. Until every
gradient is built and rendered, no claim about holes, banding or animation is
evidence.

### P1 — major quality

**P1-1 · Fluid input path drops sub-frame motion.** `js/liquidEther.js:473`
applies exactly one circular impulse per rendered frame at `Mouse.coords` with
force `Mouse.diff/2 x mouse_force`. Fast movement therefore deposits one widely
spaced blob per frame instead of a stroke, which reads as the head lagging. No
`getCoalescedEvents()`, no path interpolation.

**P1-2 · First movement always costs 250 ms.** `takeoverDuration: 0.25`
(`:23`, applied at `:204-214`) lerps the head from wherever the auto-demo left
it to the pointer. This is the most literal source of the "dragging through
molasses" complaint, and it fires again after every 3 s idle
(`autoResumeDelay: 3000`).

**P1-3 · Layout thrash on every mousemove.** `_onMouseMove` calls
`isPointInside()` which calls `getBoundingClientRect()`, then a second
`getBoundingClientRect()` in the takeover branch (`:145-186`). Two forced
layouts per pointer event inside a CEP panel.

**P1-4 · No dropdown-value audit.** `HANDOFF.md` records that Pin All was being
written as option 1 for the entire library (it is option 11) and that CC Toner
mode 3 is Pentone, not Tritone — two bugs that every existing audit passed in
green, because the audits check *indices* and *paths*, never *values*.
`effect_probe_report.txt` records how many options a dropdown has but not what
they are called.

**P1-5 · `tools/render_cards.jsx` is a live trap.** Documented as superseded;
writes 336x240 posters where the loops need 480x270, and carries the same
`File.exists` staleness bug that `render_loops.jsx` had to fix. It still sits in
`tools/` looking runnable.

### P2 — polish

- **P2-1** `Foil` (Crumpled Foil) defaults `crumpleSize` to 2 and reads as fine
  vertical static rather than a crumpled sheet *(inherited — flagged as a taste
  call, not a bug)*.
- **P2-2** `LG_REACH_PER_AMOUNT` is still an inferred number; the calibration
  pass (`reach_calibrate.jsx` then `reach_measure.js`) was never run.
- **P2-3** No `CHANGELOG.md` exists.
- **P2-4** `tools/` carries four `.txt` report files and three large `.png`
  artefacts. Not shipped in the package, but they are the only record of several
  measurements and they are undated.

### P3 — V2.3

- Preset Studio, comp-structure recorder (both scoped in `HANDOFF.md`).
- Deploying `server/worker.js` and re-enabling update checks.

---

## 4. Fluid: where the latency actually is

The simulation is not the problem and should not be replaced.
`Mouse.setCoords()` writes the raw pointer position straight into `coords`, so
there is **no smoothing on the head at all** — the head is already 1:1 in
principle. What makes it feel slow:

1. **One impulse per frame.** The visible thing is the *velocity field* mapped
   through the palette, not a dye. A single splat per frame, spaced by however
   far the pointer travelled, gives a dotted stroke whose brightest region lags
   behind the newest splat.
2. **The 250 ms takeover lerp** on the first movement after any idle.
3. **`resolution: 0.5`** — the sim grid is half the canvas, so the head is soft
   and resolves late.
4. **`mouseMoved` is held true for 100 ms** after motion stops (`:158`).

The fix is therefore: splat along the pointer's path using coalesced events,
collapse the takeover for the responsive modes, cache the rect, and expose the
head/trail split as SNAPPY / SMOOTH / FLUID / ELASTIC with SNAPPY as default.
Raising `mouseForce` is explicitly not the fix and makes the sim violent.

---

## 5. Recommended implementation order

1. **P0-1 to P0-4** — version, orphaned service, manifest. Small, mechanical,
   and they gate every build after them.
2. **AE safety structure** — `GRADIENT_PLUGIN_DEV`, `GPDEV_` comps.
3. **P0-6 / P0-5** — build and render all 43, record `GRADIENT_QA_V22.md`, fix
   what the renders show, then generate the missing previews from the same
   renders.
4. **P1-1 to P1-3** — fluid input path and responsiveness modes.
5. **P1-4** — dropdown-value audit, so the class of bug that produced the last
   two release blockers cannot recur silently.
6. SaaS research and any new presets that clear the section 39/40 bar.
7. UI polish, then the release QA matrix and the signed 2.2.0 package.
