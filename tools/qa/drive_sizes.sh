#!/usr/bin/env bash
# Runs tools/qa_sweep.jsx over the whole library at one comp size.
#
#   tools/qa/drive_sizes.sh <width> <height> <times-json> [chunk]
#
# WHY NOT THE FLUE CLI. Its client gives up after 30 seconds, and a chunk of
# 4K builds takes longer than that. The render carries on regardless - but the
# NEXT fire then lands on a busy After Effects, which refuses it with a modal,
# and modals stack until nothing works. So this posts to the bridge's eval URL
# directly with curl's own timeout and waits for each chunk to actually return
# before sending the next. Strictly sequential, by construction.
#
# qa_sweep.jsx contains no alert() of any kind, so even a genuine timeout here
# cannot leave a dialog on screen.
set -u

ROOT="D:/Ehtishaam/Files/Mine/New Branding/Scripts/Gradients combined script/v2/LivingGradients"
SESSION="C:/Users/Admin/AppData/Roaming/creative-adapters/after_effects.json"
PAYLOAD="C:/Users/Admin/AppData/Local/Temp/lg_sweep_payload.json"

W="${1:-1080}"; H="${2:-1920}"; TIMES="${3:-[0,0.5,1.0]}"; CHUNK="${4:-4}"
PER_CHUNK_TIMEOUT=1200

TOTAL=$(grep -c "^  { id: '" "$ROOT/js/presets.js")
URL=$(python -c "import json;print(json.load(open(r'$SESSION'))['url'])")
TOK=$(python -c "import json;print(json.load(open(r'$SESSION'))['token'])")

python - <<PY
import json
root = '$ROOT'
open(r'$PAYLOAD', 'w', encoding='utf-8').write(
    json.dumps({'script': '\$.evalFile(new File("' + root + '/tools/qa_sweep.jsx"));'}))
PY

echo "$(date +%T)  sweeping $TOTAL gradients at ${W}x${H}, times=$TIMES"
i=0
while [ "$i" -lt "$TOTAL" ]; do
  cat > "$ROOT/tools/qa/config.json" <<EOF
{ "from": $i, "count": $CHUNK, "width": $W, "height": $H,
  "fps": 30, "duration": 8, "times": $TIMES,
  "keepComps": false, "force": true }
EOF
  out=$(curl -s -m "$PER_CHUNK_TIMEOUT" -X POST "$URL" \
          -H "X-Bridge-Token: $TOK" -H "Content-Type: application/json" \
          --data-binary @"$PAYLOAD")
  if [ -z "$out" ]; then
    echo "  $(date +%T)  [$i..] no response within ${PER_CHUNK_TIMEOUT}s - stopping rather than firing again"
    exit 1
  fi
  echo "$out" | python -c "
import sys, json
try:
    d = json.load(sys.stdin)
except Exception as e:
    print('  unparseable reply:', str(e)[:120]); raise SystemExit
r = d.get('result', d)
if not isinstance(r, dict) or 'results' not in r:
    print('  bridge:', str(r)[:200]); raise SystemExit
for x in r['results']:
    print('  %-16s %-8s layers=%-3s frames=%d %s' % (
        x['id'], x['status'], x['layers'], len(x['frames']), x['detail'][:60]))
"
  i=$((i+CHUNK))
done
echo "$(date +%T)  ${W}x${H} done"
