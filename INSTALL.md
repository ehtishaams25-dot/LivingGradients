# Installing Living Gradients

Quit After Effects first. All three routes end the same way: **Window >
Extensions > Living Gradients**.

## 1. ZXP Installer — the easy one

Drag `LivingGradients-2.1.0.zxp` onto the free
[aescripts ZXP Installer](https://aescripts.com/learn/zxp-installer/).

That is it. The panel is signed, so nothing else has to be configured.

## 2. ExManCmd — Adobe's own installer

Adobe's command-line installer, if you would rather not add another app. Download
it from Adobe, then:

```bash
ExManCmd.exe /install "LivingGradients-2.1.0.zxp"
```

macOS:

```bash
./ExManCmd --install "LivingGradients-2.1.0.zxp"
```

## 3. By hand — and what it costs you

A `.zxp` is a signed ZIP. You can unzip it into the extensions folder yourself:

| Platform | Folder |
| --- | --- |
| Windows | `%APPDATA%\Adobe\CEP\extensions\com.digivero.livinggradients` |
| macOS | `~/Library/Application Support/Adobe/CEP/extensions/com.digivero.livinggradients` |

The catch: a folder copied in by hand has no signature for CEP to check, so CEP
refuses to load it unless **PlayerDebugMode** is on. That is a registry value
(Windows) or a defaults key (macOS) that relaxes Adobe's signature enforcement
for *every* extension on the machine, not just this one — which is why the two
routes above are better.

If you want it anyway:

**Windows** — After Effects 2021 and newer use CSXS.11; older releases use 9 or
10, so set whichever matches, or all of them:

```powershell
Set-ItemProperty -Path HKCU:\Software\Adobe\CSXS.11 -Name PlayerDebugMode -Value 1
```

**macOS**:

```bash
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
```

## After installing

Turn on **Preferences > Scripting & Expressions > Allow Scripts to Write Files
and Access Network**, then **restart After Effects**. The setting is not picked
up until it restarts.

Without it the panel works, but preset thumbnails cannot be rendered — and the
panel will tell you so on a card at the top rather than leaving you to guess.

## Uninstalling

Remove the extension folder listed above, or use ZXP Installer's remove button.

Your presets are **not** in that folder and are not removed with it. They live
in `%APPDATA%\Digivero\LivingGradients\v2` (Windows) or
`~/Library/Application Support/Digivero/LivingGradients/v2` (macOS). Delete that
folder too if you genuinely want them gone.
