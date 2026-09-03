#requires -Version 5.1
<#
=======================================================================
LIVING GRADIENTS - ENCODE LOOPS
-----------------------------------------------------------------------
Run after tools/render_loops.jsx:

    powershell -ExecutionPolicy Bypass -File tools/encode_loops.ps1

Takes the PNG sequences that script left in <temp>/lg_loops and turns each
one into two files the panel can use:

    css/previews/<id>.webm     the seamless 8s loop, played on hover
    css/previews/<id>.png      the poster still, shown at rest

then rewrites css/previews/index.json, which is the allowlist both
js/preview.js and tools/build.ps1 read.

CLOSING THE LOOP

The gradients do not loop on their own. Their motion drifts - Fractal Noise
evolutions, offsets that keep travelling - so frame 269 does not lead back
into frame 0, and playing the sequence on repeat gives a visible jump every
time it restarts.

So render_loops.jsx renders 9 seconds and this keeps 8. The extra second at
the end (the "tail") is crossfaded over the first second (the "head"):

    out[i] = tail[i] * (1 - i/T)  +  body[i] * (i/T)      for i < T
    out[i] = body[i]                                      for i >= T

At i = 0 the output is essentially tail[0], which is frame 240 - the natural
continuation of body's last frame, 239. So the restart is continuous. By i = T
the tail has faded out entirely and the rest of the loop is untouched body.

THE ORDER OF THE TWO INPUTS MATTERS. xfade fades input 1 OUT and input 2 IN,
so the tail has to be first. Swapping them puts the discontinuity back exactly
where it was, and it is not obvious from looking at the filter graph that
anything is wrong - it is only obvious when the loop lurches.

Smooth low-frequency fields hide a crossfade almost perfectly. Hard specular
hairlines - the metals - are the case where it can ghost. If one of them will
not settle, the first lever is a longer TAIL_SEC in render_loops.jsx; the
fallback is making that builder's motion genuinely cyclic, which is a much
bigger job and only worth it for the ones that need it.

ASCII only, no BOM, same as tools/build.ps1: Windows PowerShell 5.1 has no BOM
to go on for BOM-less UTF-8 sources and falls back to the system ANSI codepage,
which turns any non-ASCII character in a string literal into mojibake.
=======================================================================
#>

[CmdletBinding()]
param(
    # Encode only these ids. Default is everything with a rendered sequence.
    [string[]] $Only = @(),

    # Constant Rate Factor. Lower is better looking and bigger; VP9 CRF is
    # roughly 0-63. 32 puts a smooth 8s gradient loop around 150-350 KB.
    [int] $Crf = 32,

    # Re-encode ids that already have a .webm.
    [switch] $Force,

    [string] $FfmpegPath = 'ffmpeg'
)

$ErrorActionPreference = 'Stop'

function Say([string]$msg, [string]$color = 'Gray') {
    Write-Host $msg -ForegroundColor $color
}
function Step([string]$msg) {
    Write-Host ''
    Write-Host "== $msg" -ForegroundColor Cyan
}

$Root = Split-Path -Parent $PSScriptRoot
$Previews = Join-Path $Root 'css\previews'
$Work = Join-Path $env:TEMP 'lg_loops'

# -- 1. PRECONDITIONS --------------------------------------------------

Step 'Checking'

$ff = Get-Command $FfmpegPath -ErrorAction SilentlyContinue
if (-not $ff) {
    throw "ffmpeg not found. Install it and put it on PATH, or pass -FfmpegPath 'C:\path\to\ffmpeg.exe'."
}
Say "  ffmpeg   $($ff.Source)"

# VP9 rather than H.264 because VP9 is always compiled into Chromium, and the
# panel runs inside CEP's CEF build, where proprietary codecs are not
# guaranteed. A .webm the panel cannot decode is a black card.
$encoders = & $FfmpegPath -hide_banner -encoders 2>$null
if (($encoders | Select-String -SimpleMatch 'libvpx-vp9').Count -eq 0) {
    throw "This ffmpeg has no libvpx-vp9 encoder. A build with --enable-libvpx is needed."
}
Say '  libvpx-vp9   present'

$manifestFile = Join-Path $Work 'render.json'
if (-not (Test-Path $manifestFile)) {
    throw "No $manifestFile. Run tools/render_loops.jsx in After Effects first."
}

# The numbers come from the render, not from a second copy here. Change FPS or
# LOOP_SEC in render_loops.jsx and this follows.
$manifest = Get-Content $manifestFile -Raw -Encoding utf8 | ConvertFrom-Json
$fps         = [int] $manifest.fps
$loopSeconds = [double] $manifest.loopSeconds
$tailSeconds = [double] $manifest.tailSeconds
$totalFrames = [int] $manifest.totalFrames
$loopFrames  = [int] [math]::Round($loopSeconds * $fps)

Say "  sequences    $Work"
Say "  rendered     $($manifest.rendered)"
Say "  loop         $loopSeconds s + $tailSeconds s tail at $fps fps ($totalFrames frames)"
Say "  source size  $($manifest.width)x$($manifest.height)"

if (-not (Test-Path $Previews)) { New-Item -ItemType Directory -Path $Previews | Out-Null }

# The poster is the same 16:9 shape as the video, downscaled. Poster and video
# are cropped by the same CSS object-fit rule, so if their aspect ratios differ
# they crop differently and the picture jumps the instant you hover a card.
$posterW = 480
$posterH = [int] [math]::Round($posterW * $manifest.height / $manifest.width)

$ids = @($manifest.ids)
if ($Only.Count -gt 0) {
    $ids = @($ids | Where-Object { $Only -contains $_ })
    $missing = @($Only | Where-Object { $manifest.ids -notcontains $_ })
    foreach ($m in $missing) { Say "  ! -Only names '$m', which has no rendered sequence" 'Yellow' }
}
if ($ids.Count -eq 0) { throw 'Nothing to encode.' }

# -- 2. ENCODE ---------------------------------------------------------

Step "Encoding $($ids.Count) loop(s) at CRF $Crf"

$passDir = Join-Path $Work '_passlogs'
if (-not (Test-Path $passDir)) { New-Item -ItemType Directory -Path $passDir | Out-Null }

# split, take the tail and the body separately, crossfade tail over body.
# setpts=PTS-STARTPTS on each because trim leaves the original timestamps
# behind, and xfade reads timestamps, not frame counts.
$filter = "[0:v]split=2[a][b];" +
          "[a]trim=start_frame=${loopFrames}:end_frame=${totalFrames},setpts=PTS-STARTPTS[tail];" +
          "[b]trim=start_frame=0:end_frame=${loopFrames},setpts=PTS-STARTPTS[body];" +
          "[tail][body]xfade=transition=fade:duration=${tailSeconds}:offset=0,format=yuv420p[v]"

$results = @()
$totalKB = 0
$n = 0

foreach ($id in $ids) {
    $n++
    $seq = Join-Path $Work $id
    $webm = Join-Path $Previews "$id.webm"
    $poster = Join-Path $Previews "$id.png"

    # A SEQUENCE OR A MOVIE - WHICHEVER IS ACTUALLY THERE.
    #
    # render_loops.jsx and a cooperative render queue both leave a PNG sequence.
    # But AE 2026 defaults its output module to H.264 and will not always be
    # talked out of it, so queue_loops.jsx is allowed to give up and keep AE's
    # own format rather than fail the run. Either way the frames are in the same
    # per-id folder, so look rather than assume - and the filter graph below is
    # frame-indexed, so it does not care which one it got.
    $inputArgs = @()
    $frames = @(Get-ChildItem $seq -Filter '*.png' -File -ErrorAction SilentlyContinue |
                Sort-Object Name)

    if ($frames.Count -gt 0) {
        if ($frames.Count -lt $totalFrames) {
            Say ("  [{0}/{1}] {2,-16} SKIP  {3}/{4} frames - not rendered yet?" -f `
                 $n, $ids.Count, $id, $frames.Count, $totalFrames) 'Yellow'
            continue
        }
        # WHERE THE SEQUENCE STARTS IS ASKED, NOT ASSUMED. render_loops.jsx
        # names its frames from 0, the render queue names them from a [#####]
        # placeholder tied to the comp's first frame, and ffmpeg's own image
        # muxer starts at 1. Read it off the first filename instead.
        $firstName = $frames[0].BaseName
        $digits = [regex]::Match($firstName, '(\d+)$')
        if (-not $digits.Success) {
            Say ("  [{0}/{1}] {2,-16} SKIP  no frame number in '{3}'" -f `
                 $n, $ids.Count, $id, $frames[0].Name) 'Yellow'
            continue
        }
        $width = $digits.Groups[1].Value.Length
        $stem = $firstName.Substring(0, $firstName.Length - $width)
        $pattern = Join-Path $seq ("{0}%0{1}d.png" -f $stem, $width)
        $inputArgs = @('-framerate', $fps,
                       '-start_number', [int] $digits.Groups[1].Value,
                       '-i', $pattern)
    }
    else {
        $movie = @(Get-ChildItem $seq -File -ErrorAction SilentlyContinue |
                   Where-Object { $_.Extension -imatch '^\.(mp4|mov|avi|mkv|mxf|webm)$' } |
                   Sort-Object Length -Descending | Select-Object -First 1)
        if ($movie.Count -eq 0) {
            Say ("  [{0}/{1}] {2,-16} SKIP  nothing rendered into {3}" -f `
                 $n, $ids.Count, $id, $seq) 'Yellow'
            continue
        }
        $inputArgs = @('-i', $movie[0].FullName)
    }
    if ((Test-Path $webm) -and (-not $Force)) {
        $kb = [math]::Round((Get-Item $webm).Length / 1KB)
        $totalKB += $kb
        $results += [pscustomobject]@{ Id = $id; KB = $kb }
        Say ("  [{0}/{1}] {2,-16} have  {3} KB (-Force to redo)" -f $n, $ids.Count, $id, $kb) 'DarkGray'
        continue
    }

    $passlog = Join-Path $passDir $id

    # Two-pass. VP9 in constant-quality mode still gets a real quality gain from
    # the first pass knowing what is coming.
    $common = @(
        '-hide_banner', '-loglevel', 'error', '-y'
    ) + $inputArgs + @(
        '-filter_complex', $filter,
        '-map', '[v]',
        '-frames:v', $loopFrames,
        '-c:v', 'libvpx-vp9',
        '-b:v', '0', '-crf', $Crf,
        '-row-mt', '1',
        # One keyframe, at the start. The clip loops, so there is nothing to
        # seek to and every extra keyframe is wasted bytes.
        '-g', $loopFrames,
        '-an',
        '-passlogfile', $passlog
    )

    & $FfmpegPath @common '-pass' '1' '-deadline' 'good' '-cpu-used' '4' '-f' 'null' 'NUL'
    if ($LASTEXITCODE -ne 0) {
        Say ("  [{0}/{1}] {2,-16} FAIL  pass 1 (exit {3})" -f $n, $ids.Count, $id, $LASTEXITCODE) 'Red'
        continue
    }

    & $FfmpegPath @common '-pass' '2' '-deadline' 'good' '-cpu-used' '2' `
        '-auto-alt-ref' '1' '-lag-in-frames' '25' $webm
    if ($LASTEXITCODE -ne 0) {
        Say ("  [{0}/{1}] {2,-16} FAIL  pass 2 (exit {3})" -f $n, $ids.Count, $id, $LASTEXITCODE) 'Red'
        continue
    }

    # The poster comes out of the ENCODED loop, not out of frame 0 of the
    # sequence. Frame 0 of the sequence is pre-crossfade and is not what the
    # video starts on, so using it would make every card flick to a different
    # picture the moment it was hovered.
    & $FfmpegPath -hide_banner -loglevel error -y -i $webm -frames:v 1 `
        -vf "scale=${posterW}:${posterH}:flags=lanczos" `
        -compression_level 9 -pred mixed $poster
    if ($LASTEXITCODE -ne 0) {
        Say ("  [{0}/{1}] {2,-16} FAIL  poster (exit {3})" -f $n, $ids.Count, $id, $LASTEXITCODE) 'Red'
        continue
    }

    $kb = [math]::Round(((Get-Item $webm).Length + (Get-Item $poster).Length) / 1KB)
    $totalKB += $kb
    $results += [pscustomobject]@{ Id = $id; KB = $kb }
    Say ("  [{0}/{1}] {2,-16} ok    {3} KB" -f $n, $ids.Count, $id, $kb) 'Green'
}

Get-ChildItem $passDir -File -ErrorAction SilentlyContinue | Remove-Item -Force

# -- 3. INDEX ----------------------------------------------------------

Step 'Writing index.json'

# Scanned off disk rather than assumed from the loop above, so a run that
# encoded four ids does not drop the thirty-nine a previous run wrote. Written
# last, so it can only ever name files that exist - which is what lets
# js/preview.js ask for this one file and then request nothing that will 404.
$presetsSrc = Get-Content (Join-Path $Root 'js\presets.js') -Raw -Encoding utf8
$libraryIds = @()
foreach ($m in [regex]::Matches($presetsSrc, "id:\s*'([^']+)'")) {
    $libraryIds += $m.Groups[1].Value
}
$libraryIds = @($libraryIds | Select-Object -Unique)

# -ccontains: case-SENSITIVE. Windows filesystems are not, so a stray silk.png
# would otherwise be indexed as the gradient id "Silk" - which is exactly how
# 603 KB of source art shipped once already.
$cards = @()
$loops = @()
foreach ($f in Get-ChildItem $Previews -File) {
    $base = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
    if ($libraryIds -ccontains $base) {
        if ($f.Extension -eq '.png')  { $cards += $base }
        if ($f.Extension -eq '.webm') { $loops += $base }
    }
}
$cards = @($cards | Sort-Object)
$loops = @($loops | Sort-Object)

$sb = New-Object System.Text.StringBuilder
[void] $sb.AppendLine('{')
[void] $sb.AppendLine('  "rendered": "' + (Get-Date).ToString('yyyy-MM-dd HH:mm:ss') + '",')
[void] $sb.AppendLine('  "cards": [')
for ($i = 0; $i -lt $cards.Count; $i++) {
    $comma = ','
    if ($i -eq $cards.Count - 1) { $comma = '' }
    [void] $sb.AppendLine('    "' + $cards[$i] + '"' + $comma)
}
[void] $sb.AppendLine('  ],')
[void] $sb.AppendLine('  "loops": [')
for ($i = 0; $i -lt $loops.Count; $i++) {
    $comma = ','
    if ($i -eq $loops.Count - 1) { $comma = '' }
    [void] $sb.AppendLine('    "' + $loops[$i] + '"' + $comma)
}
[void] $sb.AppendLine('  ]')
[void] $sb.AppendLine('}')

# No BOM. JSON.parse in the panel chokes on one, and fetch().json() would fail
# for every card at once.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $Previews 'index.json'), $sb.ToString(), $utf8NoBom)

Say "  $($cards.Count) poster(s), $($loops.Count) loop(s)"

# -- 4. SUMMARY --------------------------------------------------------

Step 'Done'

$allKB = [math]::Round((Get-ChildItem $Previews -File | Measure-Object Length -Sum).Sum / 1KB)
Say "  css/previews is $allKB KB"

# Matches $PreviewBudgetKB in tools/build.ps1, where going over is a hard
# failure rather than a warning. Better to hear about it here, before a build.
$budget = 24576
if ($allKB -gt $budget) {
    Say "  ! over the $budget KB budget in tools/build.ps1." 'Yellow'
    Say '    Re-run with a higher -Crf (say 36). No AE re-render needed - the' 'Yellow'
    Say '    frames are still in the temp folder.' 'Yellow'
} else {
    Say "  within the $budget KB budget in tools/build.ps1"
}

if ($results.Count -gt 0) {
    $biggest = $results | Sort-Object KB -Descending | Select-Object -First 3
    Say ''
    Say '  largest:'
    foreach ($r in $biggest) { Say ("    {0,-16} {1} KB" -f $r.Id, $r.KB) }
}

Say ''
Say '  Look at the loops before rendering the rest. Play each .webm on repeat'
Say '  and watch the restart. The metals are the crossfade hard case.'
Say ''
Say "  $Previews"
