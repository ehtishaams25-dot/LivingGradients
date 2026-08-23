# Living Gradients & Liquid Ether: Core Learnings & Vision

This document serves as a master reference for the overarching goals, architectural philosophies, and strict technical learnings established while developing premium After Effects tools like **Living Gradients** and **Liquid Ether**.

---

## 1. Our Vision: What We Strive to Achieve

### 1.1. Premium, Programmatic Visuals
The core objective is to automate the creation of highly complex, visually stunning assets directly inside After Effects. Instead of forcing users to manually stack effects, write expressions, and adjust blending modes, our tools act as a procedural engine. By executing a single script, we instantly generate intricate visuals (like Huawei/Apple-style Aurora Mesh Gradients) using native AE effects.

### 1.2. Bridging Modern Web Tech with AE
We strive to push the boundaries of what an After Effects panel can do by utilizing the Common Extensibility Platform (CEP). We are bringing modern web technologies—like **Three.js fluid simulations** and interactive canvases—into AE. We want panels that don't just click buttons, but actively react to the AE environment in real-time (e.g., a WebGL fluid simulation tracking the velocity of an AE Null object).

### 1.3. Native-Feeling User Experience
Our tools must feel like native Adobe panels. This means:
*   **Fully Dockable & Responsive:** Panels must dock flawlessly and reflow their UI perfectly when resized.
*   **Polished Onboarding:** Integrating seamless systems like Gumroad API license verification.
*   **Interactive Feedback:** Providing real-time visual feedback (like crosshairs matching layer positions) so the user always feels in control.

---

## 2. Architectural Architecture & Core Learnings

### 2.1. The Three Distinct APIs (Never Mix Them)
Understanding the boundary between the UI and the AE DOM is critical.
1.  **ExtendScript (.jsx):** The engine that manipulates After Effects (layers, comps, effects). It is an older ES3 JavaScript engine. It has **no** access to the DOM, Node.js, `fetch()`, or modern JS syntax (use `var`, not `let`/`const`).
2.  **CEP (Common Extensibility Platform):** The HTML/CSS/JS Chromium browser that renders the panel. You can use modern ES6+ here. It communicates with ExtendScript exclusively via `CSInterface.evalScript()`.
3.  **UXP (Universal Extensibility Platform):** Adobe's future plugin architecture, but currently incomplete for AE. We rely on CEP for stability.

### 2.2. The Art of the Dockable Panel
To ensure panels behave correctly in the AE workspace, strict rules apply:
*   **CEP Docking:** Controlled entirely by `<Geometry>` in `CSXS/manifest.xml`. The HTML/CSS must use `100%` widths/heights and `ResizeObserver`. Never hardcode pixel dimensions for the panel body.
*   **ScriptUI Docking:** Must use `new Window("palette", ...)` (never `"dialog"`). The script must reside in `Scripts/ScriptUI Panels/`. Always use layout managers (`w.layout.layout(true)`) and bind `w.layout.resize()` to the `onResizing` event.
*   **External Web Content:** Always use a `<webview>` (not an `<iframe>`) in CEP to bypass `X-Frame-Options` restrictions.

### 2.3. Procedural Generation Techniques (The "Aurora" Playbook)
When programmatically building visuals via `.jsx`, we adhere to these aesthetic and technical patterns:
*   **Organic Movement:** We use `loopOut("pingpong")` expressions combined with randomized multi-waypoint keyframes to make gradient points drift naturally.
*   **Depth through Layering:** A premium look requires multiple layers (e.g., a Base Ramp, a Primary Sweep, a Secondary Sweep with complementary colors, a Hot Core glow, and an Ambient color wash).
*   **Fluid Distortion:** Applying `Turbulent Displace` with a `time * speed` expression on the Evolution property to create liquid, morphing shapes.
*   **Banding Prevention:** Always topping complex gradients with an adjustment layer containing a subtle `Noise` effect to dither 8-bit artifacts.
*   **Robust Effect Targeting:** Always using fallback arrays to find effects across different AE language versions (e.g., `["ADBE 4-Color Gradient", "4 Color Gradient"]`).

### 2.4. LLM Hallucinations & "Never Do" Rules
To maintain a stable codebase, the following mistakes must be strictly avoided:
1.  **NEVER** use `fetch()` inside ExtendScript. Network calls happen in CEP and pass data via `evalScript()`.
2.  **NEVER** use `$.evalScript()`. The correct bridge method is `CSInterface.evalScript()`.
3.  **NEVER** access `app.project.activeItem` without first verifying it is not null and is an instance of `CompItem`.
4.  **NEVER** use `w.show()` at the bottom of a ScriptUI panel file; it breaks docking. Use `w.layout.layout(true)` for dockable windows.
5.  **NEVER** generate a CEP extension without bundling Adobe's `CSInterface.js` file.

### 2.5. Procedural Rules Learned The Hard Way (Aug 2026 pass)

These came out of a round where seven gradients rendered wrong. Every one was a
category error rather than a typo.

1.  **Displacing a smooth gradient does nothing.** A four-colour ramp pushed
    through Turbulent Displace is still a smooth ramp — there is no structure in
    it to fold. To get liquid, chrome, or glass, build the image in *greyscale*
    first (Fractal Noise with **Overflow = Wrap Back**, which folds values past
    white back down into bands) and only then map it to colour.
2.  **CC Toner is the only scriptable gradient map.** Colorama looks correct and
    is not: its Output Cycle has no settable value type. `CC Toner` in Pentone
    mode gives five colour stops that `setValue` reaches. Sort the palette by
    luminance before assigning stops, or the mapping reads as noise.
3.  **Never force `app.project.linearBlending`.** It fixes the grey midpoint on
    a ramp and simultaneously redefines every blend mode in the project. Stacks
    built on Hard Mix, Color, Overlay or Hard Light stop meaning what they were
    dialled in to mean. Fix muddy colour in the colours themselves (Oklab), not
    with a project-wide switch.
4.  **Set layer-reference parameters last.** `Displacement Map Layer` stores an
    index. Assign it, then add or reorder a layer, and it is pointing somewhere
    else. Build the entire stack, then wire the references.
5.  **Tile the cell, not the frame.** CC RepeTile repeats *the layer*. A ramp
    painted across a full-width solid tiles as one full-width ramp. One flute
    has to be one flute wide before tiling it means anything.
6.  **Geometry should be geometry.** Rays, grids and wedges built from shape
    layers plus a Repeater have nothing to resolve at runtime. Faking them with
    Venetian Blinds through Polar Coordinates depends on parameters that can
    silently refuse to set, and the failure mode is a completely different image.
7.  **Resolve properties by name, then by scan, then by index.** A wrong index
    sets the wrong parameter *silently*, which is worse than not setting it.
    Several long-standing indices in this codebase were simply wrong.
8.  **Match a helper's arity at the call site.** `safeEx(prop, expr)` against a
    `safeEx(fx, name, idx, expr)` signature reads the expression as a property
    name and fails quietly. Seven animations were dead this way.
9.  **The panel only ever sees the wrapper.** Generated layers get precomposed
    into one `<Type> Gradient` layer, so any live-update code that scans the
    active comp's top level finds nothing. Walk the tree.

10. **An effect's parameter groups are decoration, not structure.** Fractal
    Noise reports `Transform` as a group with *zero children*; `Scale`,
    `Scale Width` and `Rotation` are siblings of it at indices 8-12. So
    `fx.property('Transform').property('Scale')` resolves to nothing and, inside
    a `try/catch`, fails silently. Address effect parameters flat, always.
11. **Resolve every dropdown against the machine, never from memory.** CC Toner's
    Pentone is option **3**, not 4 — 4 is Solarize, and setting it made every
    palette come back wrong. Polar Coordinates' Interpolation is a **0-1**
    parameter, not 0-100, and setting 100 throws rather than clamping. Run
    `tools/effect_probe.jsx`: it dumps every property with its real index and
    clamp ceiling, and renders each dropdown's options as a labelled grid.

### 2.6. Verified Parameter Reference (AE 26, en_IN — from tools/effect_probe_report.txt)

*   **Fractal Noise** `ADBE Fractal Noise` — Fractal Type 1 (20 opts), Noise Type 2
    (4; Spline = 4), Contrast 4, Brightness 5, Overflow 6 (4; **Wrap Back = 3**),
    Rotation 8, Uniform Scaling 9, Scale 10, Scale Width 11, Scale Height 12,
    Offset Turbulence 13, **Complexity 16**, Sub Influence (%) 18, **Evolution 24**.
    The turbulent types are bright-biased — compensate Brightness when raising
    Contrast or the field clips to white.
*   **Turbulent Displace** — Displacement 1 (11 opts), Amount 2, Size 3,
    Offset 4, Complexity 5, Evolution 6.
*   **CC Toner** — Tones 1 (5 opts, **Pentone = 3**), Highlights 2, Brights 3,
    Midtones 4, Darktones 5, Shadows 6.
*   **Cell Pattern** — Cell Pattern 1 (13 opts), Invert 2, Contextual Slider 3,
    Disperse 5 (**range 0-1**), Size 6, Offset 7, Evolution 13.
*   **Glow** `ADBE Glo2` — Threshold 2, Radius 3, Intensity 4, Glow Colors 7
    (3 opts), Color Looping 8 (4), Color Loops 9, Color A 12, Color B 13.
*   **Motion Tile** `ADBE Tile` — Tile Center 1, Tile Width 2, Tile Height 3,
    Output Width 4, Output Height 5, Mirror Edges 6, Phase 7.
*   **Fast Box Blur** `ADBE Box Blur2` — Radius 1, Iterations 2, Blur Dimensions 3
    (1 = H&V, 2 = Horizontal, 3 = Vertical), Repeat Edge Pixels 4.
*   **Gradient Ramp** `ADBE Ramp` — Start 1, Start Color 2, End 3, End Color 4,
    Ramp Shape 5 (2 opts).
*   **Extract** — Channel 2, Black Point 3, White Point 4, Black Softness 5,
    White Softness 6.
*   **Displacement Map** — Layer 1, Use For H 2 (11 opts), Max H 3, Use For V 4,
    Max V 5, Behavior 6.
*   **4-Color Gradient** `ADBE 4ColorGradient` — Point 1 is index **2**, Color 1
    is **3**, and so on; index 1 is the "Positions & Colors" group.
*   **CC RepeTile** — Expand Right 1, Left 2, Down 3, Up 4, Tiling 5 (17 opts).
*   **Posterize Time** — Frame Rate 1.
*   **Missing on this machine:** VR Color Gradient, PE Thick Stroke.

---
*Generated for the Living Gradients & Liquid Ether Ecosystem.*
