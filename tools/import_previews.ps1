#requires -Version 5.1
<#
=======================================================================
LIVING GRADIENTS - IMPORT PREVIEWS
-----------------------------------------------------------------------
For bringing in card previews you made yourself, instead of rendering them
with tools/render_loops.jsx.

    1. Put one video per gradient in  css/previews/incoming/
       Name each file after the gradient id:  Silver.mp4, Copper.mov, ...
       Any format ffmpeg reads - mp4, mov, webm, gif, avi, an image sequence
       folder. Any size, any aspect ratio, any length.

    2. Run:
       powershell -ExecutionPolicy Bypass -File tools/import_previews.ps1

That is the whole job. This works out the rest:

  - resizes and crops to 640x360 (16:9), filling the frame rather than
    letterboxing it
  - encodes VP9/WebM, which is the codec the panel is certain to be able to
    play
  - pulls the poster still the card shows at rest out of frame 0, at 480x270
    so it crops identically to the video and hovering does not make the
    picture jump
  - writes css/previews/index.json, which is what tells the panel these exist

Filenames are matched to gradient ids case-insensitively and corrected, so
silver.mp4 and SILVER.mp4 both land as Silver. A name that is not a gradient
id is reported and skipped rather than silently ignored.

USEFUL SWITCHES

  -Seconds 8        trim every clip to 8s (default: keep full length)
  -Crossfade 1      close the loop on clips that do not already loop, by
                    crossfading the last 1s over the first 1s. Leave it off
                    if your clips already loop cleanly - it costs a second.
  -Crf 32           quality. Lower is better looking and bigger. 28-36 useful.
  -Only Silver,Gold do just these
  -Force            redo ids that already have a .webm

ASCII only, no BOM - see the note at the top of tools/build.ps1.
=======================================================================
#>

[CmdletBinding()]
param(
    [double]   $Seconds   = 0,
    [double]   $Crossfade = 0,
    [int]      $Crf       = 32,
    [string[]] $Only      = @(),
    [switch]   $Force,
    [string]   $FfmpegPath = 'ffmpeg'
)

$ErrorActionPreference = 'Stop'

function Say([string]$m, [string]$c = 'Gray') { Write-Host $m -ForegroundColor $c }
function Step([string]$m) { Write-Host ''; Write-Host "== $m" -ForegroundColor Cyan }

$Root     = Split-Path -Parent $PSScriptRoot
$Previews = Join-Path $Root 'css\previews'
$Incoming = Join-Path $Previews 'incoming'

$OUT_W = 640; $OUT_H = 360      # the loop
$POS_W = 480; $POS_H = 270      # the poster. Same 16:9 on purpose.

# -- 1. CHECKS ---------------------------------------------------------

Step 'Checking'

$ff = Get-Command $FfmpegPath -ErrorAction SilentlyContinue
if (-not $ff) {
    throw "ffmpeg not found. Install it and put it on PATH, or pass -FfmpegPath 'C:\path\to\ffmpeg.exe'."
}
$ffprobe = Join-Path (Split-Path -Parent $ff.Source) 'ffprobe.exe'
if (-not (Test-Path $ffprobe)) { $ffprobe = 'ffprobe' }
Say "  ffmpeg   $($ff.Source)"

if (-not (Test-Path $Incoming)) { New-Item -ItemType Directory -Path $Incoming -Force | Out-Null }

# The ids, read from the library rather than copied. A second copy of the list
# is a second thing to forget to update.
$presetsSrc = Get-Content (Join-Path $Root 'js\presets.js') -Raw -Encoding utf8
$libraryIds = @()
foreach ($m in [regex]::Matches($presetsSrc, "id:\s*'([^']+)'")) { $libraryIds += $m.Groups[1].Value }
$libraryIds = @($libraryIds | Select-Object -Unique)
Say "  library  $($libraryIds.Count) gradients"

$sources = @(Get-ChildItem $Incoming -File | Where-Object { $_.Extension -ne '.md' })
if ($sources.Count -eq 0) {
    Say ''
    Say "  Nothing in $Incoming" 'Yellow'
    Say ''
    Say '  Put one video per gradient there, named after the gradient id:' 'Yellow'
    Say '    Silver.mp4   Copper.mov   Gold.webm   Metallic.gif' 'Yellow'
    Say ''
    Say '  Any format, any size, any length. Then run this again.' 'Yellow'
    return
}
Say "  incoming $($sources.Count) file(s)"

# -- 2. CONVERT --------------------------------------------------------

Step 'Converting'

# Fill the 16:9 frame and crop the overflow, rather than letterboxing it.
# Cropping the sides of a background gradient loses nothing; two black bars in
# every card would be the most visible thing in the grid.
$fit = "scale=${OUT_W}:${OUT_H}:force_original_aspect_ratio=increase,crop=${OUT_W}:${OUT_H},setsar=1"

$done = 0; $failed = 0; $skipped = 0
$n = 0

foreach ($src in $sources) {
    $n++
    $base = [System.IO.Path]::GetFileNameWithoutExtension($src.Name)

    # Case-insensitive match, corrected to the library's spelling. Windows
    # filenames are case-insensitive but the panel's ids are not, and "silver"
    # not matching "Silver" is a maddening way to lose an afternoon.
    $id = $libraryIds | Where-Object { $_ -ieq $base } | Select-Object -First 1
    if (-not $id) {
        Say ("  [{0}/{1}] {2,-20} SKIP  not a gradient id" -f $n, $sources.Count, $src.Name) 'Yellow'
        $failed++
        continue
    }
    if ($Only.Count -gt 0 -and ($Only -notcontains $id)) { continue }

    $webm   = Join-Path $Previews "$id.webm"
    $poster = Join-Path $Previews "$id.png"

    if ((Test-Path $webm) -and (-not $Force)) {
        Say ("  [{0}/{1}] {2,-20} have  (-Force to redo)" -f $n, $sources.Count, $id) 'DarkGray'
        $skipped++
        continue
    }

    $filter = "[0:v]$fit[v]"
    $extra  = @()

    if ($Seconds -gt 0) { $extra += @('-t', $Seconds) }

    if ($Crossfade -gt 0) {
        $durRaw = & $ffprobe -v error -select_streams v:0 -show_entries format=duration `
                   -of default=nw=1:nk=1 $src.FullName
        $dur = [double] $durRaw
        if ($Seconds -gt 0 -and $Seconds -lt $dur) { $dur = $Seconds }
        $keep = $dur - $Crossfade
        if ($keep -le $Crossfade) {
            Say ("  [{0}/{1}] {2,-20} SKIP  too short to crossfade {3}s" -f $n, $sources.Count, $id, $Crossfade) 'Yellow'
            $failed++
            continue
        }
        # Tail first. That ordering is what makes output frame 0 continuous
        # with the last frame of the body; swapping the two puts the jump back
        # exactly where it was. See tools/encode_loops.ps1 for the full note.
        $filter = "[0:v]$fit,split=2[a][b];" +
                  "[a]trim=start=${keep},setpts=PTS-STARTPTS[tail];" +
                  "[b]trim=0:${keep},setpts=PTS-STARTPTS[body];" +
                  "[tail][body]xfade=transition=fade:duration=${Crossfade}:offset=0[v]"
    }

    $args = @(
        '-hide_banner', '-loglevel', 'error', '-y',
        '-i', $src.FullName
    ) + $extra + @(
        '-filter_complex', $filter,
        '-map', '[v]',
        '-c:v', 'libvpx-vp9',
        '-pix_fmt', 'yuv420p',
        '-b:v', '0', '-crf', $Crf,
        '-row-mt', '1',
        '-deadline', 'good', '-cpu-used', '2',
        '-an',
        $webm
    )

    & $FfmpegPath @args
    if ($LASTEXITCODE -ne 0) {
        Say ("  [{0}/{1}] {2,-20} FAIL  ffmpeg exit {3}" -f $n, $sources.Count, $id, $LASTEXITCODE) 'Red'
        $failed++
        continue
    }

    # Poster out of the ENCODED loop, so it is exactly the frame the video
    # starts on. Taken from the source instead, it would be a different picture
    # and every card would flick the moment it was hovered.
    & $FfmpegPath -hide_banner -loglevel error -y -i $webm -frames:v 1 `
        -vf "scale=${POS_W}:${POS_H}:flags=lanczos" -compression_level 9 -pred mixed $poster
    if ($LASTEXITCODE -ne 0) {
        Say ("  [{0}/{1}] {2,-20} FAIL  poster exit {3}" -f $n, $sources.Count, $id, $LASTEXITCODE) 'Red'
        $failed++
        continue
    }

    $kb = [math]::Round(((Get-Item $webm).Length + (Get-Item $poster).Length) / 1KB)
    Say ("  [{0}/{1}] {2,-20} ok    {3} KB   (from {4})" -f $n, $sources.Count, $id, $kb, $src.Name) 'Green'
    $done++
}

# -- 3. INDEX ----------------------------------------------------------

Step 'Writing index.json'

# Scanned off disk, so this run does not drop what an earlier one wrote.
# Written last, so it can only ever name files that exist.
$cards = @(); $loops = @()
foreach ($f in Get-ChildItem $Previews -File) {
    $b = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
    # -ccontains: case-SENSITIVE, so a stray silk.png cannot be indexed as the
    # gradient id "Silk".
    if ($libraryIds -ccontains $b) {
        if ($f.Extension -eq '.png')  { $cards += $b }
        if ($f.Extension -eq '.webm') { $loops += $b }
    }
}
$cards = @($cards | Sort-Object); $loops = @($loops | Sort-Object)

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('{')
[void]$sb.AppendLine('  "rendered": "' + (Get-Date).ToString('yyyy-MM-dd HH:mm:ss') + '",')
foreach ($pair in @(@('cards', $cards), @('loops', $loops))) {
    $key = $pair[0]; $list = @($pair[1])
    [void]$sb.AppendLine('  "' + $key + '": [')
    for ($i = 0; $i -lt $list.Count; $i++) {
        $comma = ','; if ($i -eq $list.Count - 1) { $comma = '' }
        [void]$sb.AppendLine('    "' + $list[$i] + '"' + $comma)
    }
    $tail = '  ],'; if ($key -eq 'loops') { $tail = '  ]' }
    [void]$sb.AppendLine($tail)
}
[void]$sb.AppendLine('}')

# No BOM: JSON.parse in the panel chokes on one, and every card fails at once.
[System.IO.File]::WriteAllText((Join-Path $Previews 'index.json'), $sb.ToString(),
    (New-Object System.Text.UTF8Encoding($false)))

Say "  $($cards.Count) poster(s), $($loops.Count) loop(s)"

# -- 4. SUMMARY --------------------------------------------------------

Step 'Done'

Say "  imported $done   skipped $skipped   failed $failed"

$allKB = [math]::Round((Get-ChildItem $Previews -File | Measure-Object Length -Sum).Sum / 1KB)
$budget = 24576
if ($allKB -gt $budget) {
    Say "  css/previews is $allKB KB - over the $budget KB budget in tools/build.ps1" 'Yellow'
    Say '  Re-run with a higher -Crf (say 36).' 'Yellow'
} else {
    Say "  css/previews is $allKB KB, within the $budget KB budget"
}

$missing = @($libraryIds | Where-Object { $loops -cnotcontains $_ })
if ($missing.Count -gt 0) {
    Say ''
    Say "  Still on the painted fallback ($($missing.Count)):"
    Say ('    ' + ($missing -join ', '))
}

Say ''
Say '  Check it: python -m http.server 8099   then  http://127.0.0.1:8099/index.html'
