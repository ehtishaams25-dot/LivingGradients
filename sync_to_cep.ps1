# Development install: put the current working tree into After Effects.
#
# This used to be its own Copy-Item with its own exclusion list, which drifted
# from the one in tools/build.ps1 — so what you tested and what you shipped were
# assembled by two different sets of rules. It had also, over time, copied the
# entire repository into the extensions folder: build output, dist, the tools
# directory, 'other panels', and a .debug file leaving a remote-debugging port
# open. Eighteen megabytes of it.
#
# Now it delegates. build.ps1 stages from one allowlist, and -Install wipes the
# destination before copying, so nothing stale survives a sync.
#
# Needs PlayerDebugMode on, because a hand-copied folder has no signature.
# For a release, run tools\build.ps1 on its own to get a signed .zxp.

& "$PSScriptRoot\tools\build.ps1" -SkipSign -Install
