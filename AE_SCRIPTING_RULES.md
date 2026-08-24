# After Effects Scripting — Rules of the House

Everything in here was paid for. Each rule is a bug this panel actually
shipped, and most of them shipped *silently* — the script ran, reported
success, and produced a black frame.

The rules are ordered by how much time they save.

---

## 0. The meta-rule: probe, never remember

**Do not write effect parameter code from memory, from a tutorial, or from a
forum post. Dump the effect on the machine you are targeting and read the
answer.**

`tools/effect_probe.jsx` does this. It applies every effect the panel uses to a
throwaway solid and writes out, per parameter: index, display name, matchName,
type, and whether it is a dropdown and how many options it has.

Why this beats research: the last pass of this project derived CC Glass's
parameter indices by reasoning from CC Blobbylize's dump — the same Light and
Shading block, same names, same order. The reasoning was sound. It was also
wrong by exactly one place, because CC Glass has both a `Height` and a
`Displacement` where Blobbylize has only `Cut Away`, and everything below the
Surface group shifts down. A forum post would not have caught that; a
thirty-second probe on this machine did.

Forums and tutorials are for **technique** — what to build. The probe is for
**syntax** — how to address it. Never swap those two round.

---

## 1. Parameter groups are decoration, not structure

Fractal Noise shows a `Transform` group containing Scale, Scale Width and
Rotation. That group reports **zero children**. Scale Width is property 11 of
the effect, a flat sibling of the group header.

```javascript
fx.property('Transform').property('Scale Width')   // resolves to nothing
fx.property('Scale Width')                          // works
fx.property(11)                                     // works
```

Every `fn.property('Transform').property(...)` in the first version of this
panel failed silently inside a `try/catch`. Not one scale or stretch setting on
any gradient was ever applied, which is most of the reason they all came out as
the same undifferentiated cloud.

The same is true of CC Glass's `Surface` / `Light` / `Shading`, Cell Pattern's
`Tiling Options`, and Turbulent Displace's `Evolution Options`.

---

## 2. Resolve by display name first, index last

Order of attempts, in `LG.find`:

1. `fx.property(name)` — exact display name. Right on an English host.
2. A scan of the effect's own properties with name normalised (lowercase,
   punctuation stripped) — survives the small renames AE makes between
   versions, e.g. `Offset (Turbulence)` vs `Offset Turbulence`.
3. The 1-based index, **last**, for a non-English host.

The index used to come second. Several call sites carried indices that were
never right — Turbulent Displace's Complexity is property 5, not 4 — and **a
wrong index sets the wrong parameter silently**, which is strictly worse than
setting nothing. Name first means a wrong index can only ever be reached on a
host where the name already missed.

Corollary: keep the index in the call anyway. It costs nothing and it is the
only thing standing between a localised host and a dead panel.

---

## 3. `setValue` throws past a parameter's range. It does not clamp.

CC Glass's `Specular` is 0..100. Passing 110 raises an exception; the parameter
keeps its previous value.

This is the single most expensive rule in the file, because the exception lands
inside whatever `try/catch` you wrapped the write in, and what you get is a
metal with no highlight and no error message. The first shaded-metal contact
sheet came back with `cannot set 'Specular'` on five of eight presets — every
one of them a preset whose table asked for more than 100.

**Clamp at the one place that writes the parameter, not in the eight tables
that feed it.** And make the panel's slider max match the parameter's real
range, so the interface cannot ask for something the effect will refuse.

Ranges worth knowing:

| Parameter | Range | Notes |
|---|---|---|
| CC Glass / Blobbylize `Ambient`, `Diffuse`, `Specular`, `Metal`, `Light Intensity`, `Light Height` | 0..100 | throws past 100 |
| CC Glass `Roughness` | ~0..1 | shown as `0.100`; not a percentage |
| CC Glass `Height`, `Displacement` | signed, wide | negatives invert the relief |
| Fractal Noise `Contrast`, `Brightness` | wide | see rule 7 |
| Turbulent Displace `Size` | 1..1000 | throws above 1000 — and a Size that never lands keeps the default of 100, see rule 8 |
| Extract `Black Point` / `White Point` | 0..255 | unlike Levels |

---

## 4. Layer-valued parameters store an index, not a pointer

`Displacement Map Layer`, CC Glass's `Bump Map`, CC Blobbylize's `Blob Layer` —
all of them hold a layer **index**. An ExtendScript layer reference is likewise
bound to the index it was taken at.

So this is a bug:

```javascript
var map   = comp.layers.add(mapComp);
var glass = comp.layers.addSolid(...);
LG.set(fx, 'Bump Map', 2, map.index);   // correct right now
comp.layers.add(somethingElse);          // everything shifts by one
```

and so is assigning the source before a later `layers.add` inserts above it.
Reeded Glass lost its refraction entirely to exactly this — five writes landed
on the wrong layer and the flutes came out flat.

**Rule: build the whole layer stack first. Then re-find every layer you need
*by name* against the finished comp. Then assign.**

```javascript
var glassNow = null, mapNow = null;
for (var i = 1; i <= comp.numLayers; i++) {
    var l = comp.layer(i);
    if (l.name === 'Glass Colour')  glassNow = l;
    else if (l.name === 'Glass Surface') mapNow = l;
}
if (glassNow && mapNow) LG.set(findFx(glassNow, ['CC Glass']), 'Bump Map', 2, mapNow.index);
```

---

## 5. A bare `try/catch` is how a panel lies to you

Every rule above produces a silent failure. If the failures stay silent you
will spend your time re-tuning numbers that were never applied.

Collect them:

```javascript
set: function (fx, name, idx, val, context) {
    if (!fx) return false;
    var p = this.find(fx, name, idx);
    if (p) { try { p.setValue(val); return true; } catch (x) { } }
    record((context ? context + ' — ' : '') + "cannot set '" + name + "'");
    return false;
}
```

and print the collected list at the end of a build. `cannot set 'Specular'`
took about four seconds to diagnose once it was written down, and would have
taken an afternoon of squinting at renders otherwise.

Be honest about coverage, too: builders that never call the wrapper cannot
report anything, and a report that does not say so is worse than no report.
`tools/contact_sheet_report.txt` names those builders explicitly.

---

## 6. Enable and disable stages. Do not add and remove them.

Effect order is part of the build. If a slider at zero *removes* an effect, the
next slider move re-adds it at the end of the stack, and any effect that
referenced a position now points somewhere else.

```javascript
var td = lgFxNamed(s, ['ADBE Turbulent Displace'], 'Metal Crumple');
lgTurbSet(td, { amount: warp, ... });
try { td.enabled = warp > 0; } catch (e) { }   // costs nothing to render
```

Related: when a builder applies the **same effect twice**, look it up by the
name you gave it, not by matchName — otherwise both lookups return the first
one, the second set of values overwrites the first, and one of the two stages
silently never exists.

---

## 7. A gradient map is only as good as the histogram feeding it

This is the rule that is not about the API, and it is the one that has cost
this project the most renders.

Fractal Noise outputs exactly:

```
out = clip( 0.5 + (v - 0.5) * contrast/100 + brightness/100 )
```

Push `contrast` up and the value of `v` at which `out` crosses any given level
collapses toward the middle of the field. At contrast 400 the crossing sits
about 0.03 from the middle — so **which colour wins is decided almost entirely
by where the field's mean happens to be.**

And the mean is not 0.5 for every fractal type. The turbulent family (types
2–4) is built on folded noise and sits well above mid-grey. Two separate
all-one-colour bugs in this panel trace to that: an all-yellow frame, and four
of five animal prints rendering solid black.

**The worst case is a bump map.** A bright-biased field, soft-clamped, is
nearly white nearly everywhere with a few dark filaments through it — which is
to say it is *flat*. Hand that to a shader and the shader has nothing to shade,
so it looks like the shader is not applied at all. Seven of this panel's eight
metals were in exactly that state for two rounds: CC Glass was on the layer,
correctly wired, doing nothing. The eighth was the one whose map came from Cell
Pattern instead of noise, and it was the only one that ever looked like metal.
That is not a coincidence, it is the controlled experiment, and it was sitting
in the middle of a contact sheet for two rounds before anyone read it that way.

Practical rules:

- **Type 1 (Basic) is symmetric about mid-grey.** Use it whenever you intend to
  threshold, and whenever the output is going to be a height field. It is a structural property, not a tuned number.
- Where you need a genuinely uniform distribution, do not use noise at all —
  fold a **ramp** with Motion Tile in Mirror Edges mode. A triangle wave gives
  every tone an equal share of the frame *by construction*.
- If a threshold matters to the look, **expose it as a slider**. Contrast is
  not a threshold control; it only steepens the edge at whichever threshold you
  already have, and on a frame that is already 99% one colour it does nothing.
- `tools/print_threshold_check.js` sweeps a configuration across plausible
  field means and prints how far the result moves. A build that is only correct
  at one particular mean is a build that will come out flat somewhere.

---

## 8. Displacement size is relative to what you are displacing

Turbulent Displace has an `Amount` and a `Size`. Everyone reaches for Amount.
**Size is the one that decides what kind of thing you get**, and it decides it
by comparison with the features already in the image:

| Size vs. the features | What happens | What it is good for |
|---|---|---|
| Much **larger** | features move as whole shapes | pouring, flowing, folding |
| Comparable | features wobble | organic irregularity |
| Much **smaller** | features are shredded along their edges into filaments | fur, hair, fibre, frost |

Both ends of that table are in this panel, and they are the same effect:

- **Liquid metal** is mirrored bands displaced at Size ~600 — far bigger than
  the bands, so they move bodily and read as poured. An early version bent
  them at a size *below* the band width and got hairline marbling, because at
  that ratio a displacement does not move a band, it frays it.
- **Fur** is a two-tone coat displaced at Size 3 with Amount 900 — far smaller
  than the patches, so their edges shred into filaments leaning the way the
  Twist mode turns them.

If a build looks like marbled endpaper or a fingerprint when you wanted flow,
you are on the wrong row of that table. Raise Size; do not lower Amount.

---

## 9. Wrap Back's band count is emergent, not chosen

Fractal Noise's `Overflow > Wrap Back` folds every value past white back down
again. It is the obvious way to turn a smooth field into repeating light-dark
ribbons, and it has a trap: **the number of ribbons is however many times the
field's value happens to sweep through unity**, which depends on contrast, on
complexity, on the fractal type's own range, and — worst — on the local
gradient. Somewhere flat you get three bands. Somewhere a displacement has
compressed the field you get three hundred, as hairlines.

When you want a *chosen* number of even bands, fold a **ramp** with Motion Tile
in Mirror Edges mode instead. It is a triangle wave: exactly N cycles, even
distribution by construction, and continuous at every fold rather than
discontinuous. Then displace it (see rule 8) to make it organic.

Use Wrap Back when you want the count to be emergent — turbulent ribbon
fields where irregular banding is the point. Never when the count matters.

---

## 10. A sharp specular over a flat region is a switch, not a shade

Blinn-Phong specular is a function of the surface normal. Across a region where
the height field is genuinely flat, **the normal is constant** — so the whole
region gets the same specular value at once. With a low roughness (a tight
lobe) that value is either ~1 or ~0, so a flat area does not shade: it clips to
white or stays dark, with a hard edge exactly where the surface finally tilts.

This is what put a straight horizontal seam across the frosted glass and large
flat white patches on the polished metals. Two fixes, and you usually want
both:

- **Make sure the height field is never flat over an area you can see.** Give
  it low-frequency variation everywhere, not just detail in places.
- **Do not run roughness near zero** unless the surface really is a mirror
  with something interesting to reflect.

---

## 11. Height fields: blur them, and give them room

Any shader that lights a bump map (CC Glass, CC Blobbylize, CC Plastic, CC Mr.
Mercury) derives surface normals by **differencing** the map. A derivative
amplifies high frequencies, so pixel-level noise in the map arrives in the
shading multiplied.

- **Always blur the height field.** This is not cosmetic; without it, fine grain
  renders as salt-and-pepper rather than as tooling.
- **Put the height field in its own precomp.** It is then a finished image when
  it is sampled, with no dependence on effect render order.
- **Disable the map layer.** It is a bump source, not a picture.

And:

- **Displacement pulls pixels in from outside the layer.** To put a pixel
  here, Turbulent Displace fetches one from up to `Amount` away; past the
  layer's own edge there is nothing to fetch, and what you get is a hard-edged
  hole of pure transparency. Build displaced layers oversized — and then
  **treat the overhang as a budget and spend it**, rather than hoping:

  ```javascript
  var overhang = (h - h / OVERSIZE) / 2;        // vertical binds: frames are wide
  var budget   = overhang * 0.8;                // margin for the shader's own
  var wanted   = twistAmount + envAmount;
  if (wanted > budget) {                        // scale the stages to fit
      var fit = budget / wanted;
      twistAmount *= fit; envAmount *= fit;
  }
  ```

  30% oversize sounds generous and is not: on a 1080-tall comp it is 162px of
  vertical overhang, and two stacked displacements of 100 and 356 wanted 456.
  The holes came in from the top and bottom edges, which is exactly where they
  were. Derive the budget from the same constant the builder oversizes by, so
  the two cannot drift apart.

---

## 12. The exposure budget

In the CC light shaders, `Ambient` is how much of the source image comes
through unlit and `Diffuse` is how much the lamp adds. **They sum.**

Ambient 46 + Diffuse 55 is already at 101% before the specular goes on top,
which is exactly how the first shaded metals rendered as white bands with a few
dark lines through them. Keep the pair under about 90 and leave `Light
Intensity` near 100; that is what leaves headroom for a highlight to read as a
highlight rather than as clipping.

`Metal` is the term that makes metal look like metal: at 100 the specular takes
the *surface's* colour instead of the light's. That single parameter is the
difference between gold and yellow plastic. Set it to 0 for glass, so the
highlight comes back to white.

---

## 13. Animate with expressions, not keyframes

```javascript
LG.expr(fn, 'Evolution', 24, speed !== 0 ? 'time * ' + speed : 'value');
```

One property write, no keyframe management, works at any comp duration, and a
live update can change the speed without clearing anything. `'value'` at zero
speed leaves the property genuinely untouched rather than pinning it.

---

## 14. Build and live-update must run the same function

If the code that creates a layer and the code that responds to a slider are two
different functions, they will drift, and a slider will mean one thing on
creation and another thing on drag. Write `tuneX(layer, colors, ctrl)` and have
`buildX` call it.

Two traps that follow:

- **Recurse into precomps.** Once a build produces more than one layer it gets
  grouped, and a handler searching `comp.layer(i)` at the top level finds only
  the wrapper. Dragging a slider then appears to do nothing at all.
- **Update every layer the build made**, including the ones in other comps.
  A metal's Relief and Brush Length live on the height map, not on the picture;
  a handler that only reaches the picture moves the colour and leaves the
  surface exactly as it was.

---

## 15. Render it and look at it

`tools/contact_sheet.jsx` builds every preset at its own defaults, through the
same dispatch path the panel uses, and tiles them into one comp with a report
alongside. `tools/shader_lab.jsx` goes one level further for the builds that
are six effects deep: it shows the height map as an image and then switches the
picture layer's effects on one at a time, so the stage where a row goes wrong
is simply the stage that is wrong. Two rounds of metal fixes were reasoned from
finished frames before that script existed, and one of the two diagnoses was
only a hypothesis.

Twenty-five of this panel's thirty-two gradients had never once been rendered
and looked at. Every one of them was written the way the broken ones were:
from memory, against parameters that turned out not to exist, with the failure
swallowed. Fixing them one at a time from a verbal description of what looks
wrong is the slowest possible way to work.

Look at the sheet at full resolution, not as a thumbnail. The first shaded-metal
sheet looked *fine* at thumbnail size and was blown to white at 1:1.

---

## Verified parameter blocks

From `tools/effect_probe_report.txt`, AE 26.0, en_IN. **Re-run the probe rather
than trusting this table** — that is the whole point of rule 0.

CC Glass, CC Blobbylize, CC Mr. Mercury and CC Plastic all carry the same Light
and Shading block under the same display names, at different indices, because
their Surface groups are different sizes — and, in CC Plastic's case, because
its Light and Shading groups have extra members of their own. The shift is
**not** a single constant per effect.

### CC Glass

| idx | name | | idx | name |
|---|---|---|---|---|
| 1 | Surface *(group)* | | 13 | Light Height |
| 2 | Bump Map *(layer)* | | 14 | Light Position |
| 3 | Property *(6 opts)* | | 15 | Light Direction |
| 4 | Softness | | 17 | Shading *(group)* |
| 5 | Height | | 18 | Ambient |
| 6 | Displacement | | 19 | Diffuse |
| 8 | Light *(group)* | | 20 | Specular |
| 9 | Using *(2 opts)* | | 21 | Roughness |
| 10 | Light Intensity | | 22 | Metal |
| 11 | Light Color | | | |
| 12 | Light Type *(1 Distant, 2 Point)* | | | |

### CC Blobbylize

Identical from `Light` onward but **one lower** — it has `Cut Away` at 5 where
CC Glass has `Height` and `Displacement` at 5 and 6.

| idx | name | | idx | name |
|---|---|---|---|---|
| 2 | Blob Layer *(layer)* | | 12 | Light Height |
| 3 | Property | | 14 | Light Direction |
| 4 | Softness | | 17 | Ambient |
| 5 | Cut Away | | 18 | Diffuse |
| 8 | Using | | 19 | Specular |
| 9 | Light Intensity | | 20 | Roughness |
| 10 | Light Color | | 21 | Metal |
| 11 | Light Type | | | |

### CC Plastic

The one that breaks the pattern, and the reason a single integer offset from CC
Glass is not good enough. Its Light block sits **one** lower than CC Glass's —
but its Shading block is **two** lower again, because of `Ambient Light Color`,
and its Specular is **three** lower, because `Dust` sits in front of it.

| idx | name | | idx | name |
|---|---|---|---|---|
| 2 | Bump Layer *(layer)* | | 14 | Light Height |
| 3 | Property | | 16 | Light Direction |
| 4 | Softness | | 17 | Ambient Light Color |
| 5 | Height | | 20 | Ambient |
| 6 | Cut Min | | 21 | Diffuse |
| 7 | Cut Max | | 22 | **Dust** |
| 10 | Using | | 23 | Specular |
| 11 | Light Intensity | | 24 | Roughness |
| 12 | Light Color | | 25 | Metal |
| 13 | Light Type | | | |

`Dust` is unique to CC Plastic: a matte scatter across the whole surface, which
is what makes it the right shader for anything sandblasted or frosted.

### CC Mr. Mercury

A particle system with the same shading block bolted on: `Using` 17, `Light
Intensity` 18, `Light Color` 19, `Light Type` 20, `Light Height` 21, `Light
Direction` 23, `Ambient` 26, `Diffuse` 27, `Specular` 28, `Roughness` 29,
`Metal` 30, `Material Opacity` 31.

**Address these from a table, not from arithmetic.** One helper that takes a
per-effect index map is both shorter and correct; one helper that takes an
offset is shorter and wrong the moment CC Plastic turns up.

### Dropdowns worth writing down

| Effect | Parameter | Values |
|---|---|---|
| Fractal Noise | Fractal Type | 1 Basic, 2 Turbulent Smooth, 3 Turbulent Basic, 4 Turbulent Sharp … (20) |
| Fractal Noise | Noise Type | 4 = Spline |
| Fractal Noise | Overflow | 1 Clip, 2 Soft Clamp, 3 Wrap Back |
| Turbulent Displace | Displacement | 1 Turbulent, 2 Bulge, 3 Twist, 4 Turbulent Smoother, 5 Bulge Smoother, 6 Twist Smoother |
| CC Toner | Tones | 3 = Pentone (five stops) |
| Cell Pattern | Cell Pattern | 1 Bubbles, 2 Crystals, 3 Plates, 7 Static Plates, 8 Static Crystals … (13) |
| Glow | Glow Colors | 1 Original Colors, 2 A & B Colors |
| Glow | Color Looping | 3 = Triangle A>B>A |

`tools/effect_probe.jsx` also renders one comp per dropdown with every option
numbered, which is faster than guessing what option 7 looks like.

---

## The short version

1. Probe the host; never write parameter code from memory.
2. Groups are decoration — properties are flat siblings.
3. Name first, index last, always keep both.
4. `setValue` throws past range. Clamp once, at the writer.
5. Layer params are indices. Finish the stack, then re-find by name, then assign.
6. Never let a failure be silent.
7. Enable/disable stages; don't add/remove them.
8. Know your field's histogram before you map colours onto it.
9. Displacement Size vs. feature size decides flow-or-fray. Size, not Amount.
10. Wrap Back's band count is emergent. Fold a ramp when the count matters.
11. Never leave a flat region under a tight specular lobe.
12. Blur height fields; oversize anything you displace.
13. Ambient + Diffuse ≤ 90.
14. One function for build and for live update.
15. Render it. Look at it at 1:1 — and when 1:1 still leaves you guessing,
    render the stages separately (`tools/shader_lab.jsx`) instead of reasoning
    about which one is wrong.
