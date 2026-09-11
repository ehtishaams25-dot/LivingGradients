#!/usr/bin/env bash
# Waits for the current render to finish, refreshes the manifest, then encodes.
#
# WHY THE MANIFEST NEEDS REFRESHING. render_loops.jsx writes render.json from
# the ids it walked this run, so a scoped run - "only these three" - leaves a
# manifest naming three gradients, and encode_loops.ps1 encodes exactly what the
# manifest names. One more pass at full scope with force off walks all 43,
# skips every one of them in a second or two, and writes a manifest that names
# them all. That is the tool's own design being used rather than worked around.
#
# NOTHING IS FIRED WHILE AFTER EFFECTS IS BUSY. A script sent to a busy After
# Effects is refused with a modal, and a modal blocks everything behind it. So
# this waits for the frame count to stop moving AND stay still, rather than
# assuming the last frame means the run has returned.
set -u

ROOT="D:/Ehtishaam/Files/Mine/New Branding/Scripts/Gradients combined script/v2/LivingGradients"
WORK="C:/Users/Admin/AppData/Local/Temp/lg_loops"
SESSION="C:/Users/Admin/AppData/Roaming/creative-adapters/after_effects.json"
FRAMES_PER_SEQ=270
TOTAL=$(grep -c "^  { id: '" "$ROOT/js/presets.js")

frames() { find "$WORK" -name 'f*.png' 2>/dev/null | wc -l; }
# A gradient is DONE if it has a complete sequence OR it already has a .webm.
# Counting sequences alone can never reach 43: Copper, Gold and Silver were
# encoded in an earlier session and their frame folders cleaned up afterwards,
# so waiting for 43 sequences waits forever for three gradients that were
# finished before this run began.
ids_list() {
  grep -oE "^  \{ id: '[^']+'" "$ROOT/js/presets.js" | sed "s/.*'\\(.*\\)'/\\1/"
}

done_count() {
  local n=0 id
  for id in $(ids_list); do
    if [ -f "$ROOT/css/previews/$id.webm" ]; then n=$((n+1)); continue; fi
    if [ "$(ls "$WORK/$id" 2>/dev/null | wc -l)" -ge "$FRAMES_PER_SEQ" ]; then n=$((n+1)); fi
  done
  echo "$n"
}

echo "$(date +%T)  waiting for $TOTAL complete sequences (have $(done_count))"
until [ "$(done_count)" -ge "$TOTAL" ]; do sleep 20; done
echo "$(date +%T)  all $TOTAL sequences complete"

# Frames stop appearing before the script returns - it still has a manifest and
# a report to write. Wait for two quiet minutes before speaking to it.
quiet=0; last=$(frames)
until [ "$quiet" -ge 4 ]; do
  sleep 30
  now=$(frames)
  if [ "$now" -eq "$last" ]; then quiet=$((quiet+1)); else quiet=0; fi
  last=$now
done
echo "$(date +%T)  After Effects has been idle for two minutes"

cat > "$ROOT/tools/qa/loops.json" <<'JSON'
{ "only": [], "force": false, "quiet": true }
JSON

TOK=$(python -c "import json;print(json.load(open(r'$SESSION'))['token'])")
python - <<PY
import json
root = '$ROOT'
open(r'C:\Users\Admin\AppData\Local\Temp\lg_payload.json','w',encoding='utf-8').write(
    json.dumps({'script': '\$.evalFile(new File("' + root + '/tools/render_loops.jsx"));'}))
PY
echo "$(date +%T)  refreshing the manifest at full scope"
curl -s -m 180 -X POST http://127.0.0.1:53210/eval \
  -H "X-Bridge-Token: $TOK" -H "Content-Type: application/json" \
  --data-binary @"C:\Users\Admin\AppData\Local\Temp\lg_payload.json" \
  -o /dev/null -w "  manifest pass: HTTP %{http_code} in %{time_total}s\n"

ids=$(python -c "
import json
m = json.load(open(r'$WORK/render.json'))
print(len(m['ids']))
")
echo "$(date +%T)  manifest names $ids ids"

# The manifest lists ids with a SEQUENCE, and Copper, Gold and Silver have a
# finished .webm and no sequence, so a short manifest is expected rather than
# wrong. Encoding is driven by the manifest, but the index encode_loops.ps1
# writes afterwards is built from what is actually in css/previews - so those
# three keep the loops they already have.
if [ "$ids" -lt 1 ]; then
  echo "manifest names nothing - not encoding. Check tools/render_loops_report.txt"
  exit 1
fi

echo "$(date +%T)  encoding"
powershell -NoProfile -ExecutionPolicy Bypass -File "$ROOT/tools/encode_loops.ps1" 2>&1 | tail -40
