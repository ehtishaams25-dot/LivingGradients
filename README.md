# Living Gradients

A gradient engine for After Effects. Forty-odd procedural looks — liquid metal,
frosted and reeded glass, halftone, animal prints, anime cel water, aurora,
chrome — each built out of native effects rather than footage, so every one of
them is resolution-independent, recolourable, and yours to take apart.

Pick a look, set its palette, dial it in, and it builds itself in your comp.
Then keep it: any gradient the panel makes can be captured back as a preset,
with the whole recipe intact.

- **Version:** 2.1.0
- **Requires:** After Effects CC 2018 (15.0) or newer, on Windows or macOS
- **Panel:** Window > Extensions > Living Gradients

## Install

1. Quit After Effects.
2. Install `LivingGradients-2.1.0.zxp` with any ZXP installer — the
   [aescripts ZXP Installer](https://aescripts.com/learn/zxp-installer/) is the
   usual one, and Adobe's own `ExManCmd` works too.
3. Start After Effects and open **Window > Extensions > Living Gradients**.

The panel is signed, so it installs without turning on developer mode. See
[INSTALL.md](INSTALL.md) if you would rather not use an installer.

## Presets

A **preset** is the whole recipe: which gradient, every slider on it, the
palette, the grain and glow, the posterize step, the fluid trail. Applying one
rebuilds it exactly — at whatever size the comp you apply it to happens to be,
because the dimensions are never part of the preset.

There are three ways to make one, and they exist because they match three
different things you might have in your hand:

| You have | Do this |
| --- | --- |
| A gradient already built in a comp | **Capture** — in the Presets tab, or from the inspector |
| Settings dialled in but not applied | **Save as preset** in the inspector |
| A file somebody sent you | Drag it onto the panel |

**Capture from comp** reads the settings the panel wrote onto the layer when it
built the gradient. That makes it exact rather than approximate — it is the same
instruction played back — but it also means capture only works on gradients this
panel made. A gradient built by hand has nothing to read.

**Capture every gradient in this comp** (right-click the Capture button) turns a
whole project into a folder of presets in one pass.

A **palette** is a preset with only the colours in it. Applying one recolours a
gradient you have already built without rebuilding it, so nothing you tweaked by
hand afterwards is lost.

### Collections

Presets live in one library. A collection is a *view* of that library, so the
same preset can appear in as many collections as you like and editing it in one
changes it everywhere — there is only one of it.

Removing a preset from a collection therefore does not delete it. It goes back to
being unplaced, and **Add from library** will find it again with an "unused"
badge. Only **Delete preset** deletes anything, and it asks first.

### Sharing

- **Export** a collection or a single preset to a `.lgcollection` / `.lgrad`
  file. Thumbnails travel with it.
- **Import** by dragging the file onto the panel, or from the footer menu.
- Importing never overwrites: a preset arriving with a name you already have is
  given a numbered one, because two people editing "the same" preset in two
  libraries is normal and silently replacing one with the other loses work.

## Where your presets are kept

Outside the extension, so updating or reinstalling never costs you one:

| Platform | Folder |
| --- | --- |
| Windows | `%APPDATA%\Digivero\LivingGradients\v2` |
| macOS | `~/Library/Application Support/Digivero/LivingGradients/v2` |

Inside it, `library.json` is the index, `presets/` holds each preset as its own
file, `thumbs/` holds their pictures, and `backups/` holds rolling copies of the
index. If `library.json` is ever damaged, the panel rebuilds it from `presets/` —
you lose the folder arrangement, not the presets.

**Back up everything** in the footer menu writes the whole library, settings
included, to a single file. **Restore** puts it back, and keeps a copy of what
was there first.

**Reveal data folder** opens it in Explorer or Finder. Copying that folder to
another machine moves your library.

## What the panel needs from After Effects

Preset thumbnails are one real frame rendered from your comp, which means After
Effects has to be allowed to write a temporary file. If it is not, the panel
says so on a card at the top rather than quietly never showing a thumbnail.

Turn on **Preferences > Scripting & Expressions > Allow Scripts to Write Files
and Access Network**, then **restart After Effects** — the setting is not picked
up until it restarts.

Everything else works without it.

## Updating

Install the new `.zxp` over the old one. Your presets are untouched — they live
in the folder above, not in the extension. The panel checks for new versions on
its own and tells you through the bell in the footer; that check sends only the
panel's version number and can be turned off in Settings.

## If something goes wrong

**Menu > Help** in the footer covers the common cases. **Menu > Send feedback**
sends a message with your After Effects version, panel version, language and
platform attached — that context is usually the difference between a report that
can be fixed and one that cannot.

If the panel opens blank, close and reopen it. That is almost always a stale
browser cache inside After Effects rather than lost work, and your presets are
still on disk.

## For developers

```
index.html          the panel
css/styles.css      surfaces, brand accent, type scale
css/shelf.css       control/motion tokens, the shelf, the chrome
js/store.js         the data folder — atomic writes, rolling backups
js/library.js       presets, collections, folders, search, import/export
js/ui.js            toasts, modals, menus, banners
js/service.js       version check, messages, feedback
js/shelf.js         the Presets tab
js/footer.js        the bell and the menu
js/boot.js          start-up order
js/main.js          the gradient half of the panel
jsx/main.jsx        the builders
jsx/presets.jsx     capture, thumbnail render, apply
server/worker.js    the three endpoints service.js talks to
tools/build.ps1     stage, stamp, sign, package
```

Load order is documented at the top of `js/boot.js` and mirrored in
`index.html`. Each module explains its own reasoning in its header — that is
where the design decisions are recorded, not here.

Building:

```powershell
.\tools\build.ps1 -NewCert      # once, to make a signing certificate
.\tools\build.ps1               # signed .zxp into dist/
.\tools\build.ps1 -Version 2.2.0
```

`AE_SCRIPTING_RULES.md` and `LEARNINGS_AND_GOALS.md` carry the hard-won rules
about scripting After Effects itself. Read them before touching `jsx/main.jsx`.
