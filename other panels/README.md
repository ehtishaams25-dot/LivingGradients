# Living Gradients v2 — CEP Extension
**by Digivero** · After Effects Plugin

---

## What's Included

8 animated gradient types, fully generated in After Effects via ExtendScript:

| Type | Description |
|------|-------------|
| Living Gradient | Animated color-shift gradient with breathing scale |
| Starry Wave | Star field with wave warp distortion |
| Aurora Drift | Horizontal light bands with turbulent displacement |
| Light Rays | Volumetric radial rays from source point |
| Fluid Wave | Organic wave morphing blobs |
| Slash Beams | Diagonal animated light streaks |
| Plasma Pulse | Fractal noise with colorama morphing |
| Chromatic Halo | Multi-ring iridescent spinner |

---

## Installation

### Windows
1. Copy the `LivingGradients` folder to:
   ```
   C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\
   ```
   or per-user:
   ```
   C:\Users\[YourName]\AppData\Roaming\Adobe\CEP\extensions\
   ```

### macOS
1. Copy the `LivingGradients` folder to:
   ```
   /Library/Application Support/Adobe/CEP/extensions/
   ```
   or per-user:
   ```
   ~/Library/Application Support/Adobe/CEP/extensions/
   ```

### Enable Debug Mode (First-Time Setup)
CEP extensions need to be signed **or** run in debug mode.

**Windows** — Run regedit and set:
```
HKEY_CURRENT_USER\SOFTWARE\Adobe\CSXS.11  →  PlayerDebugMode = 1
```
(Use CSXS.10 for AE 2023, CSXS.11 for AE 2024, CSXS.12 for AE 2025)

**macOS** — Run in Terminal:
```bash
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
```

### Open the Panel
After Effects → **Window → Extensions → Living Gradients**

---

## License Activation

1. Purchase on Gumroad — you'll receive a license key by email.
2. Open the panel in After Effects.
3. Paste your license key and click **Activate**.
4. The key is validated against Gumroad's API and stored locally.

> **Note:** Requires internet connection for first-time activation only.

---

## Gumroad Setup (for you, Ehtishaam)

1. In `js/license.js`, update:
   ```js
   const GUMROAD_PRODUCT_PERMALINK = 'livinggradients'; // ← your product permalink
   ```
   and:
   ```js
   cs.openURLInDefaultBrowser('https://digivero.gumroad.com/l/livinggradients');
   ```

2. In Gumroad, make sure **License Key** is enabled on your product
   (Product → Edit → Pricing → enable "Generate a license key").

---

## File Structure

```
LivingGradients/
├── CSXS/
│   └── manifest.xml          # CEP config (bundle ID, AE version range)
├── css/
│   └── styles.css            # Panel UI styles
├── js/
│   ├── license.js            # Gumroad validation logic
│   ├── controls.js           # Per-type slider configs
│   └── main.js               # UI logic, CSInterface bridge
├── jsx/
│   └── main.jsx              # ExtendScript — all 8 gradient builders
├── index.html                # Panel HTML
└── README.md                 # This file
```

---

## Customization Notes

- **Colors:** Each gradient fully respects the 4 color pickers.
- **Adding new types:** Add to `GRADIENT_CONTROLS` in `controls.js`, add a card in `index.html`, add a `buildXxx()` function in `main.jsx`, and add a `case 'xxx':` in the switch.
- **CEP signing:** For distribution without debug mode, use Adobe's ZXPSignCmd tool to sign the extension as a `.zxp`.

---

## Requirements

- After Effects 2022 or later (tested up to 2025)
- Internet connection for license activation
- CEP debug mode OR signed `.zxp`

---

*Living Gradients v2 · © 2025 Digivero · All rights reserved*
