#!/usr/bin/env bash
# Drives tools/render_loops.jsx to completion through the Flue bridge.
#
# WHY THIS EXISTS. The bridge's HTTP call times out after 30 seconds and the
# whole library is roughly three hours of rendering, so a single evalScript can
# never report success - but the render it started keeps going regardless, on
# After Effects' own thread. So this fires the script, ignores the timeout, and
# watches the frames appear on disk instead.
#
# A fire issued while After Effects is already rendering is dropped rather than
# queued: the client abandons the request on timeout and the panel never
# processes it. That is why this refires on a stall instead of assuming one
# fire is enough, and render_loops.jsx being resumable is what makes a refire
# cost only the sequence it interrupted.
#
# THE FINISH TEST IS THE SEQUENCE COUNT, not the report file. A scoped run
# writes a perfectly fresh report having rendered a single gradient, so report
# freshness answers "did something finish", which is not the question.
set -u

ROOT="D:/Ehtishaam/Files/Mine/New Branding/Scripts/Gradients combined script/v2/LivingGradients"
BRIDGE="C:/Users/Admin/AppData/Local/Python/pythoncore-3.14-64/Lib/site-packages/adapters/after_effects_adapter/after_effects_bridge.py"
WORK="C:/Users/Admin/AppData/Local/Temp/lg_loops"
FRAMES_PER_SEQ=270
STALL_LIMIT="${1:-6}"
POLL=30

TOTAL=$(grep -c "^  { id: '" "$ROOT/js/presets.js")

fire() {
  cat > "$ROOT/tools/qa/loops.json" <<'JSON'
{ "only": [], "force": false, "quiet": true }
JSON
  printf '$.evalFile(new File("%s/tools/render_loops.jsx"));\n' "$ROOT" \
    | py "$BRIDGE" --stdin > /dev/null 2>&1 &
  echo "$(date +%T)  fired render_loops"
}

frames() { find "$WORK" -name 'f*.png' 2>/dev/null | wc -l; }

complete() {
  local n=0 d
  for d in "$WORK"/*/; do
    [ -d "$d" ] || continue
    if [ "$(ls "$d" 2>/dev/null | wc -l)" -ge "$FRAMES_PER_SEQ" ]; then n=$((n+1)); fi
  done
  echo "$n"
}

echo "$(date +%T)  $TOTAL gradients, $(complete) already complete"
fire
last=$(frames); stalls=0
while :; do
  sleep "$POLL"
  now=$(frames)
  if [ "$now" -eq "$last" ]; then
    stalls=$((stalls+1))
    echo "$(date +%T)  $now frames, $(complete)/$TOTAL done (stall $stalls/$STALL_LIMIT)"
    if [ "$stalls" -ge "$STALL_LIMIT" ]; then
      if [ "$(complete)" -ge "$TOTAL" ]; then
        echo "$(date +%T)  all $TOTAL sequences complete"
        break
      fi
      fire
      stalls=0
    fi
  else
    stalls=0
    echo "$(date +%T)  $now frames (+$((now-last))), $(complete)/$TOTAL done"
  fi
  last=$now
done
echo "$(date +%T)  finished with $(frames) frames in $(complete) sequences"
