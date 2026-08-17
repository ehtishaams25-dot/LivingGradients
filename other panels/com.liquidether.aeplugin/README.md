# Liquid Ether — After Effects CEP Panel

A fluid WebGL simulation panel that **tracks any layer's position in real time**
and drives the fluid background from it — the layer moves, the fluid reacts.

---

## Installation

### 1. Enable unsigned extensions (one-time setup)

After Effects CEP panels must be whitelisted during development.

**macOS**
```bash
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
```
*(Replace `11` with your CEP version — CSXS.9 for CC2019, .10 for CC2021, .11 for CC2022+)*

**Windows**
Open Registry Editor and set:
```
HKEY_CURRENT_USER\Software\Adobe\CSXS.11\PlayerDebugMode = 1
```

### 2. Copy the extension folder

| OS | Extensions folder |
|----|-------------------|
| macOS | `~/Library/Application Support/Adobe/CEP/extensions/` |
| Windows | `%APPDATA%\Adobe\CEP\extensions\` |

Copy the entire `com.liquidether.aeplugin` folder into that directory.

### 3. Open the panel in After Effects

1. Launch (or restart) After Effects
2. Go to **Window → Extensions → Liquid Ether**
3. The panel opens and begins the fluid auto-demo immediately

---

## How to use

1. **Select any layer** in your composition (shape, null, footage, text — anything with Position)
2. The fluid simulation instantly starts reacting to that layer's position
3. **Scrub the timeline** or **play the comp** — the fluid follows every keyframe
4. Move the layer with the **Selection tool** for live interactive painting

### Controls

| Control | Description |
|---------|-------------|
| **Track selected layer** toggle | Enable/disable AE position tracking. When off, you can interact with the fluid directly using your mouse in the panel |
| **Force** slider | How strongly the layer velocity pushes the fluid (1–60) |
| **Brush** slider | Radius of the force brush in simulation pixels (20–300) |
| **Colour presets** | 5 built-in palettes; click any swatch to hot-swap colours |

### Crosshair overlay

A small crosshair appears in the panel showing exactly where the tracked layer's
position maps onto the simulation viewport.

### Readout

The bottom of the panel shows:
- Layer position in composition pixels (X, Y)
- The name of the tracked layer
- Status dot (green = tracking, grey = idle/no selection)

---

## Tips

- **Null objects** work great as "fluid drivers" — attach expressions or use the puppet tool
- **Fast keyframes** create big velocity spikes → dramatic fluid eruptions
- Try tracking a **motion-blur heavy camera move** using a null parented to a layer
- The fluid is **transparent** (alpha background) — if you screen-record the panel and
  bring the footage into AE, it can be composited directly over any background

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Panel doesn't appear in Window menu | Re-check `PlayerDebugMode` registry/defaults key; restart AE |
| "No layer selected" even when layer is selected | Some layer types don't expose a Position property (guides, etc.) — try a null object |
| Fluid lags behind layer movement | Increase browser/CEP poll frequency isn't possible beyond ~30fps; this is a CEP limitation |
| Blank white panel | Make sure you have internet access (Three.js loads from CDN); or replace the CDN `<script>` tag in `index.html` with a local `three.min.js` |

### Using a local Three.js (no internet required)

1. Download `three.min.js` from https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
2. Save it into `com.liquidether.aeplugin/` folder
3. In `index.html`, replace:
   ```html
   <script src="https://cdnjs.cloudflare.com/.../three.min.js"></script>
   ```
   with:
   ```html
   <script src="./three.min.js"></script>
   ```

---

## File structure

```
com.liquidether.aeplugin/
├── CSXS/
│   └── manifest.xml        ← Extension metadata (targets AE CC 2019+)
├── index.html              ← CEP panel UI + fluid simulation (self-contained)
├── jsx/
│   └── main.jsx            ← ExtendScript: reads layer position from AE
└── README.md
```

---

## Compatibility

| Software | Version |
|----------|---------|
| After Effects | CC 2019 (16.0) and above |
| macOS | 10.14+ |
| Windows | 10+ |
