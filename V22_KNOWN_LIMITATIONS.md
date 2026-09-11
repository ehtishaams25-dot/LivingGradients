# V22_KNOWN_LIMITATIONS

What is not finished, not verified, or deliberately left alone in 2.2.0.
Written so that nobody has to rediscover any of it.

---

## Not verified

**All four comp sizes are now measured** — 1920×1080, 1080×1920, 1080×1080 and
3840×2160 — and section 33 is closed. What it found is in
`GRADIENT_QA_V22.md`; what it left open is here.

**Fluid Gradient cannot be verified at 3840×2160.** It builds without error and
then `comp.saveFrameToPng()` writes zero bytes and throws nothing. Every other
gradient saves fine at 4K, so this is specific to that stack. The consequence
reaches customers: `jsx/presets.jsx` renders preset thumbnails through the same
call, so capturing a Fluid preset from a 4K comp would produce a silently
missing thumbnail. Not diagnosed.

**Crumpled Foil bleaches in portrait.** 21.3% of the frame blown at 1920×1080,
29.6% at square, **53.3% at 1080×1920**, where the crumple texture is almost
gone and it reads as a sheet of white. Its `relief` is not scaled by comp size,
so this is a different mechanism from the metal hole and it is not diagnosed.
Left alone deliberately: this gradient was explicitly to be shipped as it is,
and that instruction was given about its crease size, not about this. It is a
decision waiting on its owner rather than a thing nobody noticed.

**Frame rates are measured now, not argued.** Copper, Sunburst, Anime Water and
Cellular Mosaic — four different builders — were built at 24, 30 and 60fps and
the frame at t=4s is pixel-identical at all three. Every animation is
expression-driven off `time` rather than frame count, and that now has evidence
behind it.

**Web Threads' stored QA frames are pre-fix.** Its new defaults were chosen by
rendering a sweep and looking at it, so the fix itself is measured; the
five-sample set in `tools/qa/frames/WebThreads/` was not regenerated afterwards.
This no longer affects anything shipped — its poster and loop both come from the
loop render, which ran after all four gradient fixes — but the stored frames and
the numbers in `analysis_1080.txt` describe the old build for that one row.

**Licensing was exercised in a browser, not against Gumroad.** The unlicensed
state, the activation screen, deactivation and the absence of every trial path
were all verified. A real key was not purchased, so a successful activation and
a refunded-licence rejection are untested against the live endpoint. The code
path is unchanged from 2.1.0.

---

## Not built

**Glow Border.** `SAAS_GRADIENT_RESEARCH.md` concludes this is the one genuine
gap in the library — nothing among the 43 puts energy on an *edge*, they all
fill a field — and it is the most likely of the researched techniques to be
asked for by a working motion designer. It is scoped there (one gradient drawn
twice, sharp on top and blurred beneath, both rotating) and it is not built,
because it needs a shape whose corner radius, inset and thickness are
art-directable. That is a new control cluster rather than new sliders on an
existing gradient.

**Opposing-drift octaves.** The cheapest single change that would make the
smooth families read as alive rather than as one slowly sliding sheet: two noise
layers with opposite Evolution signs instead of one with Complexity 3. Applied
to Oklab Smooth's new drift only; Aurora and Living Gradient would gain most and
were not touched.

**A dropdown-value audit — built, but only half of what it should be.**
`tools/dropdown_audit.js` is new in 2.2.0 and is now the fourth build gate. It
does two things: range-checks every literal written to a dropdown against that
effect's own option count, and asserts a small table of semantics this project
has already paid to learn — Turbulent Displace `Pinning` must be 11 (Pin All),
CC Toner `Tones` must be 3 (Pentone) — each with the reason next to it.

What it cannot do is check a dropdown nobody has written down yet.
`tools/effect_probe_report.txt` records how many options each dropdown has but
not what they are *called*, so 11 literal writes that come from a variable and
every option whose meaning is not in the KNOWN table go unchecked. Extending
`tools/effect_probe.jsx` to dump option names would let the table be derived
rather than curated.

Two things it caught while being written, which is the argument for having it:
"Pinning" is a property on Wave Warp as well as on Turbulent Displace, with
different options and different meanings, so a name-only check fires on the
wrong three lines — writes have to be bound to their effect. And the probe marks
Cell Pattern's `Disperse` as a one-option dropdown when it is a 0‑1 slider, so
anything treating "has options" as "is a menu" fails a perfectly good 0.55.

**`server/worker.js` is not deployed.** It is written and locally tested. No
Cloudflare credentials were available in this session, so nothing was deployed
and nothing pretends to be. Rather than ship a bell that could never ring, the
panel's network surface is now exactly one host — Gumroad's licence API — and
"Check for updates" opens the product page. Re-wiring it is a 2.3 item and the
build's host allowlist will need the new host added, deliberately, with a
reason.

---

## Deliberately left alone

**The SilkFlare Engine is transparent, and that is the design.** Silk, Aurora,
Prism, Fiber, Veil, Pulse and Comet are a blurred colour field seen through a
rotating shape matte, so most of the frame is genuinely clear — Silk 42.9%,
Prism 55.2%. The first run of the V2.2 measurement flagged all seven as "100%
holes" and it was wrong to. They are light *elements* rather than backgrounds,
and stacking one over footage is the intended use. Making them opaque would look
identical over black and would destroy that.

**Reeded Glass renders at a uniform alpha of 62.** Same reasoning: it is glass.

**ASCII Matrix is 90% pure black.** That is the look.

**The library was not culled.** The standing rule against it was not
re-litigated. Seven gradients are marked TUNE in `GRADIENT_QA_V22.md` with a
named reservation each; none was removed.

---

## Residual defects, accepted for this release

| What | Measured | Why it ships |
| --- | --- | --- |
| **Satin Waves** still blows 17.5% of the frame to white | was 63.8% | The remaining clipping is the specular on a chrome surface, which is what a specular does. The look now has tonal structure and the full slider range is usable. Further reduction means changing what the gradient is. |
| **Crumpled Foil**'s `crumpleSize` default of 2 reads closer to fine static than to pleats | 21.3% blown | Inherited and deliberately unresolved: 2 is documented as read off a hand-tuned sheet, and a sweep at 2/8/16/26/40 shows real pleat structure only at 40. It is a taste call and it is the owner's to make, not a bug to fix. |
| **Comet** has the lowest motion in the library at 1.28 | — | Slow by design; flagged rather than changed. |
| **Anime Water** clips 16.8% on the caustic crests | — | The crests are the subject. |

---

## Traps that are still traps

**`tools/render_cards.jsx` is superseded and dangerous.** It writes 336×240
posters where the loops need 480×270 ones to crop identically, so running it puts
a sideways jump into every card it touches, and it carries the same
`File.exists` staleness bug the other render tools had to fix. It was not
deleted in 2.2.0 because deleting a tool is a decision for whoever owns the
repository. **Do not run it.**

**The render tools used to be able to delete your comps. Fixed — but check any
new tool for the same pattern.** All five shared a sweep that decided which
project items belonged to the run by comparing an item's *index* against
`app.project.numItems` recorded beforehand. Indices are not stable: the Project
panel enumerates in its own order and every removal shifts everything after it.
Over a long run the count falls below the indices of pre-existing items and the
sweep reaches them — into a folder that is then deleted whole. Now every tool
snapshots the items that existed before it started and treats only the ones not
in that list as its own. Any new tool that touches `app.project.items` needs the
same helper: `lgSnapshotItems()` / `lgWasHereBefore()`.

**Two folders with the same `ExtensionBundleId`** means After Effects loads one,
and not the one you just wrote. Always install with `sync_to_cep.ps1`.

**`tools/build.ps1` string literals must be ASCII.** The file has no BOM, so
PowerShell 5.1 decodes it as ANSI; an em dash inside `"..."` becomes a smart
quote, closes the string early, and the file stops parsing 250 lines later.
Comments and `'...'` are unaffected.

**Anything driving After Effects unattended must set `quiet`.** An `alert()`
blocks the application, and every subsequent `evalScript` is then refused with
*"Attempt was made to run a second script while another script was already
running"* — which looks exactly like the render having died, so a naive driver
re-fires and stacks up more modals. `report.execute()` is worse: After Effects
treats opening a file as running a script and leaves a security prompt on
screen. Both are behind the flag now; the lesson generalises to any new tool.
