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

# Read as UTF-8 explicitly rather than through Get-Content's default encoding,
# and keep the raw text: the [xml] cast is for READING the version out. Writing
# goes back through the text, never through $manifestXml.Save().
$manifestText = [System.IO.File]::ReadAllText($Manifest, (New-Object System.Text.UTF8Encoding $false))
[xml] $manifestXml = $manifestText

if ($Version) {
    if ($Version -notmatch '^\d+\.\d+\.\d+$') {
        throw "Version must look like 2.1.0, got '$Version'."
    }

    # WHY NOT $manifestXml.Save().
    #
    # It round-trips the file through .NET's XML writer, which reformats every
    # element onto one line, adds a BOM, and -- because the document had been
    # read through PowerShell's default encoding -- writes each em dash in the
    # comments back out as the three cp1252 characters it was mistaken for. One
    # run of `-Version 2.3.0` was enough to leave the manifest reading
    # "Living Gradients aEUR" CEP extension manifest".
    #
    # This is the same failure the index.html stamping further down already
    # documents. It took longer to notice here only because the damage lands in
    # comments, where nothing breaks and nobody looks.
    #
    # Two attributes, two regexes, and every other byte in the file untouched.
    $manifestText = [regex]::Replace($manifestText,
        '(ExtensionBundleVersion=")[^"]*(")', "`${1}$Version`${2}")
    $manifestText = [regex]::Replace($manifestText,
        '(<Extension Id="[^"]*"\s+Version=")[^"]*(")', "`${1}$Version`${2}")

    [System.IO.File]::WriteAllText($Manifest, $manifestText, (New-Object System.Text.UTF8Encoding $false))
    [xml] $manifestXml = $manifestText
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
# candidates.js is the gradient workshop — index.html does not load it and
# only the render tools read it, so shipping it puts development notes and
# unreleased gradient definitions in a customer's extensions folder for no
# benefit. It is caught here rather than by narrowing the allowlist, because
# the allowlist is per-folder and js/ is otherwise entirely shippable.
$Purge = @('*.bak', '*.jsxbin', 'test_*.js', '*.map', '.DS_Store', 'Thumbs.db',
           'candidates.js')
foreach ($pattern in $Purge) {
    Get-ChildItem $StageDir -Recurse -Filter $pattern -Force -ErrorAction SilentlyContinue |
        ForEach-Object { Remove-Item $_.FullName -Force; Say "  - $($_.Name)" 'DarkGray' }
}

# The remote-debugging descriptor. Its presence is what lets anything on the
# machine attach to the panel's CEF instance, and it has no business in a
# release build.
$debugFile = Join-Path $StageDir '.debug'
if (Test-Path $debugFile) { Remove-Item $debugFile -Force; Say '  - .debug' 'DarkGray' }

# css/previews is now wired up: js/preview.js reads index.json and loads the
# card renders it names. So the folder ships - but only what the index names,
# and nothing else at all.
#
# INDEX.JSON IS THE ALLOWLIST, and matching filenames against the library was
# the wrong way to do it. tools/render_cards.jsx writes the index, so the index
# is by definition the set of files that exist and are wanted. Two things went
# wrong with the filename approach on the first run:
#
#   - PowerShell's -contains is case-INSENSITIVE, so silk.png matched the
#     gradient id "Silk" and 603KB of source art shipped. That is two thirds of
#     the package, and it is the exact file this block was originally written to
#     keep out.
#   - Windows filesystems are case-insensitive too, so silk.png and Silk.png are
#     one file. Source art has no business sitting in the folder whose names are
#     now generated.
#
# The budget is a hard failure, not a warning. Forty-eight stills is exactly the
# kind of thing that grows a megabyte at a time until somebody notices the .zxp
# is 40MB, and by then it has shipped.
#
# Raised from 6144 when the hover loops arrived. The whole library is roughly
# 11MB of VP9 plus 6.5MB of posters, so 24576 leaves headroom without leaving
# so much that the number stops meaning anything.
$PreviewBudgetKB = 24576

$previews = Join-Path $StageDir 'css\previews'
if (Test-Path $previews) {
    $indexFile = Join-Path $previews 'index.json'
    $keep = @()
    if (Test-Path $indexFile) {
        # Parsed as JSON rather than regexed for quoted words. The index now
        # carries two arrays that mean different things - "cards" are posters
        # and "loops" are videos - and a gradient can legitimately be in the
        # first and not the second, so which list a name came from decides
        # which extension it is allowed to ship with.
        $index = Get-Content $indexFile -Raw -Encoding utf8 | ConvertFrom-Json
        foreach ($name in @($index.cards)) { $keep += ($name + '.png') }
        foreach ($name in @($index.loops)) { $keep += ($name + '.webm') }
        $keep += 'index.json'
    }

    if ($keep.Count -le 1) {
        # No index, or an index naming nothing. Either way there is nothing to
        # ship and the painters in js/preview.js cover every gradient.
        Remove-Item $previews -Recurse -Force
        Say '  - css/previews (no index.json; run tools/render_loops.jsx)' 'DarkGray'
    } else {
        $droppedKB = 0; $dropped = 0
        Get-ChildItem $previews -Recurse -File | ForEach-Object {
            # -cnotcontains: case-SENSITIVE. See the note above.
            if ($keep -cnotcontains $_.Name) {
                $droppedKB += [math]::Round($_.Length / 1KB)
                $dropped++
                Remove-Item $_.FullName -Force
            }
        }
        if ($dropped) { Say "  - $dropped file(s) not in index.json ($droppedKB KB)" 'DarkGray' }

        # Dropping every file out of css/previews/incoming leaves the folder
        # itself, and Adobe's own guidance is to ship no empty directories.
        Get-ChildItem $previews -Recurse -Directory |
            Sort-Object { $_.FullName.Length } -Descending |
            ForEach-Object {
                if (-not (Get-ChildItem $_.FullName -Force)) {
                    Remove-Item $_.FullName -Force
                    Say "  - css/previews/$($_.Name)/ (empty)" 'DarkGray'
                }
            }

        $remaining = @(Get-ChildItem $previews -Recurse -File)
        $keptKB = [math]::Round(($remaining | Measure-Object Length -Sum).Sum / 1KB)
        $posters = @($remaining | Where-Object { $_.Extension -eq '.png' }).Count
        $vids = @($remaining | Where-Object { $_.Extension -eq '.webm' }).Count
        Say "  + css/previews ($posters posters, $vids loops, $keptKB KB)"
        if ($keptKB -gt $PreviewBudgetKB) {
            throw "css/previews is $keptKB KB, over the $PreviewBudgetKB KB budget. Re-run tools/encode_loops.ps1 with a higher -Crf (say 36); no AE re-render is needed."
        }
    }
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

# The version the panel reports lives on the <html> element, and js/ui.js
# lgPanelVersion() is the only thing that reads it. It used to be a
# PANEL_VERSION declaration inside js/service.js; that file went with the
# undeployed backend, and the two readers it left behind showed the raw
# placeholder in About and stamped a hardcoded 2.0.0 into every exported bundle.
#
# THIS IS A HARD FAILURE, not a warning. A version that quietly falls back to a
# default is the exact failure being fixed here, and About is the only place a
# customer can read it, so a build that cannot stamp it is a build that ships
# the wrong number.

$indexPath = Join-Path $StageDir 'index.html'
$index = Get-Content $indexPath -Raw -Encoding utf8
if ($index -notmatch 'data-panel-version="__PANEL_VERSION__"') {
    if ($index -match 'data-panel-version="([^"]*)"') {
        throw "index.html carries data-panel-version=$($Matches[1]) instead of the __PANEL_VERSION__ placeholder. Restore the placeholder in the source; only the staged copy is ever stamped."
    }
    throw 'index.html has no data-panel-version attribute on the html element. js/ui.js lgPanelVersion() reads it and About shows it; without it the panel cannot report its version.'
}
$index = $index -replace 'data-panel-version="__PANEL_VERSION__"', "data-panel-version=`"$BundleVersion`""
Set-Content $indexPath $index -Encoding utf8 -NoNewline
Say "  index.html data-panel-version -> $BundleVersion" 'Green'

# Cache busters. After Effects caches panel assets aggressively, and a user who
# updates without seeing the change is a support ticket. Every build gets a
# fresh query string.
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

    # The two static audits. Both check things that are invisible on this
    # machine and break on a customer's, which is the worst category there is:
    #
    #   index_audit  every indexed property write in jsx/main.jsx against a real
    #                dump from an installed After Effects. A wrong index is
    #                harmless on an English host, because the name resolves
    #                first, and sets a DIFFERENT parameter everywhere else. It
    #                found fifty of them.
    #
    #   live_audit   every gradient in the library has a live tuner, every tuner
    #                named exists, and every layer name a tuner waits for is one
    #                some builder assigns. Twelve gradients shipped with sliders
    #                that did nothing and reported success.
    #
    #   panel_audit  the fourteen files in js/ share one global scope. Two of
    #                them defining `setStatus` is a silent replacement; two
    #                defining the same `const` is a SyntaxError that shows up as
    #                a blank panel in After Effects and nowhere else.
    #
    # Run against the repo, not the stage: they read tools/, which does not ship.
    #
    # KEEP DOUBLE-QUOTED STRINGS IN THIS FILE ASCII. This script has no BOM, so
    # Windows PowerShell 5.1 decodes it with the system ANSI codepage; an em dash
    # (E2 80 94) comes through as three cp1252 characters and the third of them
    # is U+201D, a smart double quote, which PowerShell accepts as a string
    # delimiter. One em dash inside a "..." here closed the string early and the
    # whole file stopped parsing 250 lines later. Comments are unaffected and
    # single-quoted strings are unaffected, which is why the em dashes elsewhere
    # in this file have always been harmless.
    foreach ($audit in @(
        @{ Name = 'effect indices'; Script = 'tools\index_audit.js' },
        @{ Name = 'live tuners';    Script = 'tools\live_audit.js' },
        @{ Name = 'panel globals';  Script = 'tools\panel_audit.js' },
        # The fourth, added in 2.2.0. The other three all passed in green
        # through Pinning being written as option 1 when Pin All is option 11,
        # and through CC Toner mode 3 being read as Tritone when it is Pentone.
        # A wrong dropdown VALUE hides in exactly the place a wrong index
        # cannot: the property resolves, the write succeeds, and the effect
        # does something else.
        @{ Name = 'dropdown values'; Script = 'tools\dropdown_audit.js' }
    )) {
        $auditPath = Join-Path $Root $audit.Script
        if (-not (Test-Path $auditPath)) {
            Say "  $($audit.Name): $($audit.Script) is missing - audit skipped" 'DarkYellow'
            continue
        }
        $out = & node $auditPath 2>&1
        if ($LASTEXITCODE -ne 0) {
            $out | ForEach-Object { Say "    $_" 'DarkYellow' }
            throw "$($audit.Name) audit failed. Run 'node $($audit.Script)' for the detail."
        }
        Say "  $($audit.Name) audit clean" 'Green'
    }
} else {
    Say '  node not found — skipping the syntax check and both audits' 'DarkYellow'
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

# NO PANEL CODE MAY REACH A HOST THAT IS NOT REAL.
#
# js/service.js used to hold an API_PLACEHOLDER and this checked whether it had
# been replaced. The file is gone: the Cloudflare Worker in server/ was never
# deployed, so the bell and the feedback form could only ever fail silently, and
# a support channel that swallows messages is worse than no channel.
#
# What replaces it is stricter. The panel is allowed to talk to exactly two
# hosts - Gumroad's licence API, and Gumroad's product page via the OS browser -
# and this fails the build on any other absolute URL in a request position. It
# catches a re-added placeholder, a leftover localhost endpoint and a debug
# webhook with the same rule.
# www.w3.org is the SVG namespace literal, never a request. Everything else
# on this list is Gumroad.
$allowedHosts = @('api.gumroad.com', 'ehtishaam.gumroad.com', 'www.w3.org')
$offenders = @()
Get-ChildItem (Join-Path $StageDir 'js') -Filter *.js -File | ForEach-Object {
    $body = Get-Content $_.FullName -Raw -Encoding utf8
    foreach ($m in [regex]::Matches($body, 'https?://([A-Za-z0-9\.\-]+)')) {
        $host_ = $m.Groups[1].Value
        if ($allowedHosts -notcontains $host_) {
            $offenders += "$($_.Name) -> $host_"
        }
    }
}
if ($offenders.Count) {
    throw ("Panel JavaScript points at hosts outside the allowlist: " + ($offenders -join '; ') +
           ". Every one of these ships enabled. Remove it, or add the host to `$allowedHosts with a reason.")
}
Say '  no panel code reaches a host outside the Gumroad allowlist' 'Green'

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

    # Both the organisation and the common name are quoted. They contain
    # spaces, and ZXPSignCmd takes positional arguments: unquoted, "Mohammed
    # Ehtishaam Shaikh" arrives as three of them and the certificate comes out
    # with the wrong fields, or not at all.
    & $tool -selfSignedCert IN Maharashtra 'Mohammed Ehtishaam Shaikh' 'Mohammed Ehtishaam Shaikh' $CertPassword $CertPath
    if ($LASTEXITCODE -ne 0) { throw 'Certificate creation failed.' }

    Say "Certificate written to $CertPath" 'Green'

    if ($generated) {
        $pwFile = Join-Path $PSScriptRoot 'certificate-password.txt'
        # ASCII, not utf8. PowerShell 5.1's -Encoding utf8 writes a BOM, so the
        # file begins EF BB BF and anything that does not strip it - `cat`, a
        # shell script, a CI step - reads three junk characters in front of the
        # password and ZXPSignCmd answers "Failed to parse certificate", which
        # points at the certificate rather than at the password. The password is
        # generated from an ASCII alphabet, so nothing is lost.
        Set-Content $pwFile $CertPassword -Encoding ascii -NoNewline
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

# AN UNSIGNED BUILD NEVER TAKES THE SHIPPABLE FILENAME.
#
# It used to. -SkipSign wrote LivingGradients-<version>.zxp, the same path the
# signed build writes, so a single verification run silently replaced the
# package you were about to release with one that no installer will accept —
# same name, same version, same folder, and nothing on disk to tell them apart.
# You find out when the installer refuses it, or worse, when a customer does.
#
# Unsigned builds are now clearly labelled and cannot collide.
$ZxpPath = if ($SkipSign) {
    Join-Path $DistDir "LivingGradients-$BundleVersion-UNSIGNED.zxp"
} else {
    Join-Path $DistDir "LivingGradients-$BundleVersion.zxp"
}
if (Test-Path $ZxpPath) { Remove-Item $ZxpPath -Force }

if ($SkipSign) {
    # An unsigned zip with a .zxp name. Installs only with PlayerDebugMode on,
    # so it is for testing the packaging itself, never for release.
    Compress-Archive -Path (Join-Path $StageDir '*') -DestinationPath "$ZxpPath.zip" -Force
    Move-Item "$ZxpPath.zip" $ZxpPath -Force
    Say "Unsigned package: $ZxpPath" 'Yellow'
    Say 'This will NOT install without PlayerDebugMode. Do not ship it.' 'Yellow'

    # If a signed package for this version is sitting next to it, say so — the
    # two are one tab-complete apart and only one of them installs.
    $signedTwin = Join-Path $DistDir "LivingGradients-$BundleVersion.zxp"
    if (Test-Path $signedTwin) {
        Say "  the signed $BundleVersion package is still there and is the one to install." 'DarkGray'
    }
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

# UNSIGNED BUILDS DO NOT GET ONE, and do not touch the one that is there.
#
# The other half of the trap above: this block wiped and rebuilt the release
# folder on every run, so a -SkipSign verification build replaced a finished
# release with a folder whose .zxp no installer accepts — while still printing
# "Release folder:" in green. A directory that says release and contains
# something unshippable is worse than no directory.
if ($SkipSign) {
    Say '  skipped: unsigned builds get no release folder.' 'DarkGray'
    $existing = Join-Path $DistDir "LivingGradients_$BundleVersion"
    if (Test-Path $existing) {
        Say "  the signed release folder for $BundleVersion is untouched." 'DarkGray'
    }
} else {
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
}

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
