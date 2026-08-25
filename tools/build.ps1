<#
    build.ps1 — package Living Gradients as a signed .zxp

    WHY THIS EXISTS

    Right now the panel ships by copying a folder into the CEP extensions
    directory with sync_to_cep.ps1. That is fine for developing and wrong for
    shipping, for three reasons:

      1. It copies everything — .git, .debug, backups, the tools folder, the
         renders. .debug in particular is a remote-debugging port left open on
         every customer's machine.
      2. An unsigned folder only loads with PlayerDebugMode turned on, so every
         customer has to edit their registry. A signed .zxp does not.
      3. There is no version discipline. The manifest says one thing, the panel
         reports another, and the update check compares them.

    This does the whole thing: stage only what ships, stamp the version from
    the manifest into the panel, sign, and produce a release folder that looks
    like something you bought.

    USAGE

        # everyday: build a signed zxp with the self-signed cert
        .\tools\build.ps1

        # first time only — make the certificate
        .\tools\build.ps1 -NewCert

        # release: bump the version everywhere, then build
        .\tools\build.ps1 -Version 2.2.0

        # install what you just built into your own AE
        .\tools\build.ps1 -Install

    ZXPSignCmd

    Adobe's signing tool. It is not installed with anything — download it from
    Adobe's CEP resources repository and put it in tools/, or point -SignTool
    at wherever you keep it:

        https://github.com/Adobe-CEP/CEP-Resources/tree/master/ZXPSignCMD

    A self-signed certificate is enough for a .zxp to install without
    PlayerDebugMode. It is not a code-signing certificate from a CA and users
    may see it described as self-signed; that is normal for Adobe panels and is
    what the vast majority of paid AE panels ship with.
#>

[CmdletBinding()]
param(
    [string] $Version,
    [switch] $NewCert,
    [switch] $Install,
    [switch] $SkipSign,
    [string] $SignTool,
    [switch] $Timestamp,
    # Read from the environment, never hardcoded. See the certificate section
    # below for where it comes from and where to keep it.
    [string] $CertPassword = $env:LG_CERT_PASSWORD
)

$ErrorActionPreference = 'Stop'

$Root      = Split-Path -Parent $PSScriptRoot
$BuildDir  = Join-Path $Root 'build'
$StageDir  = Join-Path $BuildDir 'stage'
$DistDir   = Join-Path $Root 'dist'
$CertPath  = Join-Path $Root 'tools\certificate.p12'
$Manifest  = Join-Path $Root 'CSXS\manifest.xml'

function Say($message, $colour = 'Gray') { Write-Host $message -ForegroundColor $colour }
function Step($message) { Write-Host "`n== $message" -ForegroundColor Cyan }

# ── 1. VERSION ────────────────────────────────────────────────────────
#
# The manifest is the single source of truth. Everything else is stamped from
# it, so "the panel says 2.0.0 but the installer registered 2.1.0" cannot
# happen — which matters because the update check compares those two numbers.

Step 'Version'

# -Raw: without it Get-Content hands back an array of lines and the cast to
# XmlDocument reports a confusing type error instead of the real parse problem.
[xml] $manifestXml = Get-Content $Manifest -Raw

if ($Version) {
    if ($Version -notmatch '^\d+\.\d+\.\d+$') {
        throw "Version must look like 2.1.0, got '$Version'."
    }
    $manifestXml.ExtensionManifest.ExtensionBundleVersion = $Version
    $manifestXml.ExtensionManifest.ExtensionList.Extension.Version = $Version
    $manifestXml.Save($Manifest)
    Say "Manifest bumped to $Version" 'Green'
}

$BundleVersion = $manifestXml.ExtensionManifest.ExtensionBundleVersion
$BundleId      = $manifestXml.ExtensionManifest.ExtensionBundleId
Say "Building $BundleId $BundleVersion"

# ── 2. STAGE ──────────────────────────────────────────────────────────
#
# An allowlist, not a denylist. A denylist silently ships whatever you added
# last week and forgot about, and that is how .debug files reach customers.

Step 'Staging'

if (Test-Path $BuildDir) { Remove-Item $BuildDir -Recurse -Force }
New-Item -ItemType Directory -Path $StageDir -Force | Out-Null

$Include = @(
    'index.html',
    'CSXS',
    'css',
    'js',
    'jsx',
    'lib',
    'icons',
    'LICENSE.txt'
)

foreach ($item in $Include) {
    $source = Join-Path $Root $item
    if (-not (Test-Path $source)) {
        Say "  skipped (missing): $item" 'DarkYellow'
        continue
    }
    Copy-Item $source -Destination $StageDir -Recurse -Force
    Say "  + $item"
}

# Things that must never ship, removed after the copy so a nested one cannot
# hide from the allowlist.
$Purge = @('*.bak', '*.jsxbin', 'test_*.js', '*.map', '.DS_Store', 'Thumbs.db')
foreach ($pattern in $Purge) {
    Get-ChildItem $StageDir -Recurse -Filter $pattern -Force -ErrorAction SilentlyContinue |
        ForEach-Object { Remove-Item $_.FullName -Force; Say "  - $($_.Name)" 'DarkGray' }
}

# The remote-debugging descriptor. Its presence is what lets anything on the
# machine attach to the panel's CEF instance, and it has no business in a
# release build.
$debugFile = Join-Path $StageDir '.debug'
if (Test-Path $debugFile) { Remove-Item $debugFile -Force; Say '  - .debug' 'DarkGray' }

# css/previews holds source art that nothing in the panel references — silk.png
# alone was 617KB, roughly two thirds of the shipped package. Kept in the
# repository, kept out of the build. If a preview image is ever wired up, take
# this out and the size report below will keep it honest.
$previews = Join-Path $StageDir 'css\previews'
if (Test-Path $previews) {
    $freed = [math]::Round((Get-ChildItem $previews -Recurse -File | Measure-Object Length -Sum).Sum / 1KB)
    Remove-Item $previews -Recurse -Force
    Say "  - css/previews (unreferenced, $freed KB)" 'DarkGray'
}

# ── 3. STAMP ──────────────────────────────────────────────────────────

Step 'Stamping version'

# Every Get-Content below reads with -Encoding utf8, explicitly.
#
# Windows PowerShell 5.1's Get-Content has no BOM to go on for our BOM-less
# UTF-8 sources, so it falls back to the system ANSI codepage. An em dash --
# bytes E2 80 94 -- came back as three cp1252 characters, and Set-Content then
# wrote those three characters back out as UTF-8. That is why the shipped panel
# showed "Mood Preset" wrapped in mojibake while the file in the repo was
# perfectly fine: the corruption happened during the build, not in the source.
# Read and write with the same explicit encoding or the round-trip is lossy.

$servicePath = Join-Path $StageDir 'js\service.js'
if (Test-Path $servicePath) {
    $service = Get-Content $servicePath -Raw -Encoding utf8
    $stamped = $service -replace "var PANEL_VERSION = '[^']*';", "var PANEL_VERSION = '$BundleVersion';"
    if ($stamped -eq $service) {
        Say '  WARNING: PANEL_VERSION not found in service.js — the update check will compare the wrong number.' 'Yellow'
    } else {
        Set-Content $servicePath $stamped -Encoding utf8 -NoNewline
        Say "  js/service.js -> $BundleVersion" 'Green'
    }
}

# Cache busters. After Effects caches panel assets aggressively, and a user who
# updates without seeing the change is a support ticket. Every build gets a
# fresh query string.
$indexPath = Join-Path $StageDir 'index.html'
$stampToken = $BundleVersion.Replace('.', '') + (Get-Date -Format 'MMddHHmm')
$index = Get-Content $indexPath -Raw -Encoding utf8
$index = $index -replace '\?v=\d+"', "?v=$stampToken`""
Set-Content $indexPath $index -Encoding utf8 -NoNewline
Say "  index.html cache-buster -> v=$stampToken" 'Green'

# ── 4. SANITY ─────────────────────────────────────────────────────────
#
# Cheap checks that catch the failures which are invisible until a customer
# hits them. A panel that ships with a syntax error opens as a white rectangle
# and gives no clue why.

Step 'Checking'

$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    $bad = @()
    Get-ChildItem (Join-Path $StageDir 'js') -Filter *.js | ForEach-Object {
        & node --check $_.FullName 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { $bad += $_.Name }
    }
    if ($bad.Count) { throw "Syntax errors in: $($bad -join ', ')" }
    Say "  $(@(Get-ChildItem (Join-Path $StageDir 'js') -Filter *.js).Count) js files parse" 'Green'
} else {
    Say '  node not found — skipping the syntax check' 'DarkYellow'
}

foreach ($required in @('index.html', 'jsx\main.jsx', 'jsx\presets.jsx', 'lib\CSInterface.js', 'CSXS\manifest.xml')) {
    if (-not (Test-Path (Join-Path $StageDir $required))) { throw "Missing from the build: $required" }
}
Say '  required files present' 'Green'

# The licence bypass. This is the one check that stops a build being given away
# for free, so it is a hard failure rather than a warning — a warning scrolls
# past and the .zxp still gets uploaded.
$licensePath = Join-Path $StageDir 'js\license.js'
if (Test-Path $licensePath) {
    $license = Get-Content $licensePath -Raw -Encoding utf8
    if ($license -match 'LG_DEV_BYPASS_LICENSE\s*=\s*true') {
        throw 'LG_DEV_BYPASS_LICENSE is true in js/license.js. This build would let anyone in. Set it to false before packaging.'
    }
    if ($license -notmatch 'LG_DEV_BYPASS_LICENSE') {
        Say '  WARNING: the licence bypass flag is gone from license.js — check the licence path still runs.' 'Yellow'
    } else {
        Say '  licence check is live' 'Green'
    }
}

# Anything still pointing at a placeholder API host would ship a bell and a
# feedback button that silently do nothing.
$svc = Get-Content (Join-Path $StageDir 'js\service.js') -Raw -Encoding utf8
if ($svc -match "var API = 'https://api\.digivero\.dev/living-gradients'") {
    Say '  WARNING: js/service.js still points at the placeholder API host. Updates, messages and feedback will not work.' 'Yellow'
}

# The CDN dependency. Not fatal, but a panel that needs the internet to finish
# loading is a panel that fails on a locked-down edit suite.
if ((Get-Content $indexPath -Raw -Encoding utf8) -match 'src="https?://') {
    Say '  WARNING: index.html still loads a script from the internet. Vendor it into lib/.' 'Yellow'
}

# ── 5. CERTIFICATE ────────────────────────────────────────────────────

function Resolve-SignTool {
    if ($SignTool -and (Test-Path $SignTool)) { return $SignTool }
    foreach ($candidate in @(
        (Join-Path $PSScriptRoot 'ZXPSignCmd.exe'),
        (Join-Path $PSScriptRoot 'ZXPSignCmd-64.exe'),
        (Join-Path $Root 'ZXPSignCmd.exe')
    )) {
        if (Test-Path $candidate) { return $candidate }
    }
    $onPath = Get-Command ZXPSignCmd -ErrorAction SilentlyContinue
    if ($onPath) { return $onPath.Source }
    return $null
}

$tool = Resolve-SignTool

if ($NewCert) {
    Step 'Creating a certificate'
    if (-not $tool) { throw 'ZXPSignCmd not found. See the header of this script for where to get it.' }
    if (Test-Path $CertPath) {
        throw "A certificate already exists at $CertPath. Creating a new one changes your publisher identity, so updates signed with it read as a different product. Delete it deliberately if that is really what you want."
    }

    # Generated, not chosen. A password typed by a human ends up in shell
    # history, and a password written into this script ends up in the
    # repository; both defeat the point of the .p12 being encrypted at all.
    if (-not $CertPassword) {
        Add-Type -AssemblyName System.Web
        $CertPassword = [System.Web.Security.Membership]::GeneratePassword(28, 6)
        $generated = $true
    }

    & $tool -selfSignedCert IN Maharashtra Digivero 'Digivero' $CertPassword $CertPath
    if ($LASTEXITCODE -ne 0) { throw 'Certificate creation failed.' }

    Say "Certificate written to $CertPath" 'Green'

    if ($generated) {
        $pwFile = Join-Path $PSScriptRoot 'certificate-password.txt'
        Set-Content $pwFile $CertPassword -Encoding utf8 -NoNewline
        Say ''
        Say 'CERTIFICATE PASSWORD (shown once):' 'Yellow'
        Say "    $CertPassword" 'White'
        Say ''
        Say "Also written to $pwFile, which is gitignored." 'DarkGray'
        Say 'Put it in your password manager, delete that file, then set it for future builds with:' 'Yellow'
        Say '    $env:LG_CERT_PASSWORD = "<the password>"' 'DarkGray'
    }

    Say ''
    Say 'Back up certificate.p12 somewhere safe. Signing future updates with a different certificate makes them look like a different product to the installer, and there is no way to migrate users across.' 'Yellow'
}

# ── 6. PACKAGE ────────────────────────────────────────────────────────

Step 'Packaging'

New-Item -ItemType Directory -Path $DistDir -Force | Out-Null
$ZxpPath = Join-Path $DistDir "LivingGradients-$BundleVersion.zxp"
if (Test-Path $ZxpPath) { Remove-Item $ZxpPath -Force }

if ($SkipSign) {
    # An unsigned zip with a .zxp name. Installs only with PlayerDebugMode on,
    # so it is for testing the packaging itself, never for release.
    Compress-Archive -Path (Join-Path $StageDir '*') -DestinationPath "$ZxpPath.zip" -Force
    Move-Item "$ZxpPath.zip" $ZxpPath -Force
    Say "Unsigned package: $ZxpPath" 'Yellow'
    Say 'This will NOT install without PlayerDebugMode. Do not ship it.' 'Yellow'
} else {
    if (-not $tool)              { throw 'ZXPSignCmd not found. See the header of this script, or pass -SkipSign to build an unsigned test package.' }
    if (-not (Test-Path $CertPath)) { throw "No certificate at $CertPath. Run: .\tools\build.ps1 -NewCert" }
    if (-not $CertPassword) {
        throw 'No certificate password. Set it with:  $env:LG_CERT_PASSWORD = "<the password>"   (or pass -CertPassword).'
    }

    # TIMESTAMPING IS OFF BY DEFAULT, AND THAT IS DELIBERATE.
    #
    # -tsa asks a timestamp authority to countersign, so the package keeps
    # validating after the certificate expires. It is the right thing to do and
    # it does not work: ZXPSignCmd 4.1.103 crashes outright (access violation,
    # exit -1073741819) on the responses from digicert, sectigo and globalsign,
    # and returns its own errors 35/36 for starfield, geotrust and apple. The
    # servers are reachable; the tool cannot parse what they send back.
    #
    # It matters less than it looks, because ZXPSignCmd issues self-signed
    # certificates with 4096 days of validity — this one runs to November 2037.
    # Long before then the tool will have been fixed or replaced.
    #
    # Pass -Timestamp to try anyway, e.g. after an Adobe update.
    if ($Timestamp) {
        & $tool -sign $StageDir $ZxpPath $CertPath $CertPassword -tsa http://timestamp.digicert.com
        if ($LASTEXITCODE -ne 0) {
            Say '  timestamping failed; falling back to an untimestamped signature' 'Yellow'
            if (Test-Path $ZxpPath) { Remove-Item $ZxpPath -Force }
            & $tool -sign $StageDir $ZxpPath $CertPath $CertPassword
        }
    } else {
        & $tool -sign $StageDir $ZxpPath $CertPath $CertPassword
    }
    if ($LASTEXITCODE -ne 0) { throw 'Signing failed.' }

    & $tool -verify $ZxpPath -certinfo
    Say "Signed package: $ZxpPath" 'Green'
}

$size = [math]::Round((Get-Item $ZxpPath).Length / 1MB, 2)
Say "$size MB"

# What is actually taking up the space. A package that quietly doubles between
# releases is always one file, and this is how you find it without unzipping.
Say ""
Say "Largest files in the build:" "DarkGray"
Get-ChildItem $StageDir -Recurse -File |
    Sort-Object Length -Descending |
    Select-Object -First 5 |
    ForEach-Object {
        $rel = $_.FullName.Substring($StageDir.Length + 1)
        Say ("  {0,8:N0} KB  {1}" -f ($_.Length / 1KB), $rel) "DarkGray"
    }

# ── 7. RELEASE FOLDER ─────────────────────────────────────────────────
#
# What the customer actually downloads. The .zxp alone is a file nobody knows
# what to do with; Code Runner ships a folder with a README and a starter
# collection beside it, and that is why nobody has to ask how to install it.

Step 'Release folder'

$ReleaseDir = Join-Path $DistDir "LivingGradients_$BundleVersion"
if (Test-Path $ReleaseDir) { Remove-Item $ReleaseDir -Recurse -Force }
New-Item -ItemType Directory -Path $ReleaseDir -Force | Out-Null

Copy-Item $ZxpPath -Destination $ReleaseDir
foreach ($doc in @('README.md', 'LICENSE.txt', 'INSTALL.md')) {
    $source = Join-Path $Root $doc
    if (Test-Path $source) { Copy-Item $source -Destination $ReleaseDir }
}

$starter = Join-Path $Root 'starter'
if (Test-Path $starter) {
    Copy-Item $starter -Destination (Join-Path $ReleaseDir 'Presets') -Recurse
    Say '  + starter presets'
}

Say "Release folder: $ReleaseDir" 'Green'

# ── 8. INSTALL ────────────────────────────────────────────────────────

if ($Install) {
    Step 'Installing locally'

    $extRoot = Join-Path $env:APPDATA 'Adobe\CEP\extensions'
    $target  = Join-Path $extRoot $BundleId

    # Two folders declaring the same ExtensionBundleId is a real CEP failure
    # mode: After Effects picks one, usually not the one you just wrote, and
    # you spend an afternoon wondering why your change did nothing. Any older
    # install under a different folder name goes first.
    if (Test-Path $extRoot) {
        Get-ChildItem $extRoot -Directory | ForEach-Object {
            $m = Join-Path $_.FullName 'CSXS\manifest.xml'
            if ((Test-Path $m) -and ($_.FullName -ne $target)) {
                try {
                    [xml] $other = Get-Content $m -Raw
                    if ($other.ExtensionManifest.ExtensionBundleId -eq $BundleId) {
                        $mb = [math]::Round((Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum / 1MB, 1)
                        Remove-Item $_.FullName -Recurse -Force
                        Say "  removed a duplicate install: $($_.Name) ($mb MB)" 'Yellow'
                    }
                } catch { }
            }
        }
    }

    # Wipe rather than copy over. Copying over leaves every file a previous
    # sync put there — which is how an installed panel ends up carrying build
    # output, a .debug file and 18MB of repository.
    if (Test-Path $target) { Remove-Item $target -Recurse -Force }
    New-Item -ItemType Directory -Path $target -Force | Out-Null
    Copy-Item (Join-Path $StageDir '*') -Destination $target -Recurse -Force

    $installed = [math]::Round((Get-ChildItem $target -Recurse -File | Measure-Object Length -Sum).Sum / 1MB, 2)
    Say "Installed to $target ($installed MB)" 'Green'

    # A hand-copied folder carries no signature, so CEP refuses it unless debug
    # mode is on. This is the developer path only — customers install the .zxp.
    # The CSXS number tracks the CEP runtime, and After Effects releases have
    # spanned 9 through 12, so check the range rather than guessing one.
    $debugOn = $false
    foreach ($v in 9..12) {
        $key = "HKCU:\Software\Adobe\CSXS.$v"
        $val = (Get-ItemProperty -Path $key -Name PlayerDebugMode -ErrorAction SilentlyContinue).PlayerDebugMode
        if ($val -eq '1') { $debugOn = $true; Say "  PlayerDebugMode is on for CSXS.$v" 'DarkGray' }
    }
    if (-not $debugOn) {
        Say ''
        Say '  PlayerDebugMode is off, so this hand-copied build will not load.' 'Yellow'
        Say '  Either install the signed .zxp from dist\, or turn it on yourself:' 'Yellow'
        Say '    9..12 | ForEach-Object { $k = "HKCU:\Software\Adobe\CSXS.$_"; if (-not (Test-Path $k)) { New-Item $k -Force | Out-Null }; Set-ItemProperty $k PlayerDebugMode 1 }' 'DarkGray'
    }

    Say ''
    Say 'Reopen the panel from Window > Extensions to pick this up.' 'DarkGray'
}

Step 'Done'
Say "$BundleId $BundleVersion" 'Green'
