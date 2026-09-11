<#
  LIVING GRADIENTS - TRAIL CONTACT SHEET
  ---------------------------------------------------------------------
  Tiles the frames tools/trail_lab.jsx rendered into one image, so the
  family can be taken in at a glance instead of opened one file at a time.

  It tiles the t1 frame (two seconds in) rather than t0, because t0 of a
  scrolling gradient is its least characteristic moment - every stroke is
  still at its start offset and the shear that makes a trail a trail has
  not happened yet.

  Usage:
      powershell -ExecutionPolicy Bypass -File tools/trail_sheet.ps1
#>

Add-Type -AssemblyName System.Drawing

$root  = Split-Path -Parent $PSScriptRoot
$dir   = Join-Path $root 'tools/qa/trail'
$out   = Join-Path $dir  'trail_sheet.png'

$order = @('TrailGradient','HorizonTrail','IrisTrail','RippleTrail',
           'MoltenTrail','HazeTrail','SignalTrail','LatticeTrail')

$CW = 420; $CH = 236; $GAP = 10; $COLS = 4
$rows = [Math]::Ceiling($order.Count / $COLS)
$W = $COLS * $CW + ($COLS + 1) * $GAP
$H = $rows * ($CH + 22) + ($rows + 1) * $GAP

$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::FromArgb(24, 24, 28))
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$font = New-Object System.Drawing.Font('Segoe UI', 11)
$brush = [System.Drawing.Brushes]::White

for ($i = 0; $i -lt $order.Count; $i++) {
    $tag = $order[$i]
    $f = Join-Path $dir "${tag}_t1.png"
    $col = $i % $COLS; $row = [Math]::Floor($i / $COLS)
    $x = $GAP + $col * ($CW + $GAP)
    $y = $GAP + $row * ($CH + 22 + $GAP)

    if (Test-Path $f) {
        $src = [System.Drawing.Bitmap]::FromFile($f)
        try { $g.DrawImage($src, $x, $y, $CW, $CH) } finally { $src.Dispose() }
    } else {
        $g.DrawString('no render', $font, [System.Drawing.Brushes]::Red, $x + 8, $y + $CH / 2)
    }
    $g.DrawString($tag, $font, $brush, $x + 2, $y + $CH + 3)
}

$g.Dispose()
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "wrote $out"
