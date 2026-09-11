<#
  LIVING GRADIENTS - TRAIL COVERAGE CHECK
  ---------------------------------------------------------------------
  Reads the frames tools/trail_lab.jsx wrote and answers the questions a
  builder cannot answer about itself.

  IS THE FRAME COVERED. Every trail ends in a Warp, and a Warp pinches the
  layer inside its own edges. When the bank behind it is not big enough the
  frame shows black where the image ran out. Nothing throws: the effect
  applied, the values took, the layer count is right, every static audit
  passes, and the picture has a hole in it.

  IS IT COVERED ON EVERY FRAME. Motion Tile renders nothing at all when its
  tiling lands on certain alignments, so a trail can be flawless at one
  moment and empty at the next. The whole bank did that at time zero for a
  while - a black flash at the head of every loop, invisible to any check
  that sampled one frame, or two frames that both happened to be fine. So
  every frame the lab wrote is measured and the WORST one is reported.

  DOES IT MOVE. Compared per pixel, not by average brightness: a scrolling
  pattern keeps almost exactly the same average while every pixel in it
  changes, and an earlier version of this file called that "not moving".

  Two readings, because they mean different things:

    EDGE    a 12% band around the rim, where a warp pinch shows. Anything
            above about a percent is the bug.
    FRAME   the whole picture. A dark gradient is legitimately dark, so a
            high frame reading alone is not a fault - it is a fault when
            the edge reading is high too, or when it is near total.

  Usage:
      powershell -ExecutionPolicy Bypass -File tools/trail_check.ps1
#>

Add-Type -AssemblyName System.Drawing

$dir = Join-Path (Split-Path -Parent $PSScriptRoot) 'tools/qa/trail'
if (-not (Test-Path $dir)) { Write-Output "no renders yet: $dir"; exit 1 }

# Near-black, not black. A gradient's own darkest colour is rarely 0,0,0 and
# After Effects' background is, so the threshold sits below any palette in the
# library and above the compositing floor.
$BLACK = 10

function Read-Frame([string]$path) {
    $bmp = [System.Drawing.Bitmap]::FromFile($path)
    try {
        $w = $bmp.Width; $h = $bmp.Height
        $step = [Math]::Max(1, [int]($w / 200))     # sample, do not walk 2M pixels
        $edgeX = [int]($w * 0.12); $edgeY = [int]($h * 0.12)
        $all = 0; $allBlack = 0; $edge = 0; $edgeBlack = 0
        $sum = 0.0
        $luma = New-Object System.Collections.Generic.List[double]
        for ($y = 0; $y -lt $h; $y += $step) {
            for ($x = 0; $x -lt $w; $x += $step) {
                $p = $bmp.GetPixel($x, $y)
                $l = ($p.R + $p.G + $p.B) / 3
                $sum += $l
                $luma.Add($l)
                $all++
                if ($l -le $BLACK) { $allBlack++ }
                if ($x -lt $edgeX -or $x -ge ($w - $edgeX) -or $y -lt $edgeY -or $y -ge ($h - $edgeY)) {
                    $edge++
                    if ($l -le $BLACK) { $edgeBlack++ }
                }
            }
        }
        [pscustomobject]@{
            Frame = 100.0 * $allBlack / $all
            Edge  = 100.0 * $edgeBlack / $edge
            Mean  = $sum / $all
            Luma  = $luma
        }
    } finally { $bmp.Dispose() }
}

$expected = @('TrailGradient','HorizonTrail','IrisTrail','RippleTrail',
              'MoltenTrail','HazeTrail','SignalTrail','LatticeTrail')

$tags = Get-ChildItem $dir -Filter '*_t0.png' | ForEach-Object { $_.BaseName -replace '_t0$', '' }

'{0,-26} {1,7} {2,7} {3,7} {4,8} {5,5}  {6}' -f 'GRADIENT', 'EDGE%', 'FRAME%', 'MEAN', 'MOVED', 'FRMS', 'VERDICT'
'-' * 94

# A tag with no frame at all is the failure this file exists for: After
# Effects declining to build an oversized canvas writes no file and reports no
# error. A report listing only what it found would show that as silence.
foreach ($want in $expected) {
    if (-not (Test-Path (Join-Path $dir "${want}_t0.png"))) {
        '{0,-26} {1,7} {2,7} {3,7} {4,8} {5,5}  {6}' -f $want, '-', '-', '-', '-', '0', 'NO RENDER - saveFrameToPng wrote nothing'
    }
}

foreach ($tag in ($tags | Sort-Object)) {
    $frames = @()
    for ($i = 0; $i -lt 8; $i++) {
        $f = Join-Path $dir "${tag}_t${i}.png"
        if (Test-Path $f) { $frames += (Read-Frame $f) }
    }
    if ($frames.Count -eq 0) { continue }

    # The worst frame, not the first one.
    $worstEdge  = ($frames | Measure-Object -Property Edge  -Maximum).Maximum
    $worstFrame = ($frames | Measure-Object -Property Frame -Maximum).Maximum
    $darkest    = ($frames | Measure-Object -Property Mean  -Minimum).Minimum
    $meanAll    = ($frames | Measure-Object -Property Mean  -Average).Average

    # Motion: the LEAST change between any two consecutive frames. Least,
    # because a gradient that stalls for one stretch and moves in another is
    # still a gradient with a stall in it.
    $moved = 'n/a'
    if ($frames.Count -gt 1) {
        $worstMove = [double]::MaxValue
        for ($k = 1; $k -lt $frames.Count; $k++) {
            $a = $frames[$k - 1].Luma; $b = $frames[$k].Luma
            $n = [Math]::Min($a.Count, $b.Count)
            $acc = 0.0
            for ($j = 0; $j -lt $n; $j++) { $acc += [Math]::Abs($a[$j] - $b[$j]) }
            $d = $acc / [Math]::Max(1, $n)
            if ($d -lt $worstMove) { $worstMove = $d }
        }
        $moved = '{0:N2}' -f $worstMove
    }

    $verdict = @()
    if ($worstEdge -gt 1.0)   { $verdict += 'CUTS AT THE EDGE' }
    if ($darkest -lt 6)       { $verdict += 'A FRAME RENDERED EMPTY' }
    elseif ($meanAll -lt 12)  { $verdict += 'almost black - did it build?' }
    # Mean absolute difference in levels, 0-255. A static frame scores 0.
    if ($moved -ne 'n/a' -and [double]$moved -lt 1.5) { $verdict += 'NOT MOVING' }
    if (-not $verdict)        { $verdict = @('ok') }

    '{0,-26} {1,7:N2} {2,7:N2} {3,7:N1} {4,8} {5,5}  {6}' -f `
        $tag, $worstEdge, $worstFrame, $meanAll, $moved, $frames.Count, ($verdict -join '; ')
}
