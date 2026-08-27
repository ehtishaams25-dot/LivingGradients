Drop your card previews here.

One file per gradient, named after the gradient id:

    Silver.mp4
    Copper.mov
    Gold.webm
    Metallic.gif

Any format, any size, any aspect ratio, any length. Then run:

    powershell -ExecutionPolicy Bypass -File tools/import_previews.ps1

That resizes, crops, encodes, makes the poster still and writes index.json.
The ids are listed in js/presets.js. Files in this folder are never shipped -
tools/build.ps1 only stages what index.json names.
