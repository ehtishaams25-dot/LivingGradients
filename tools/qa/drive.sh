#!/usr/bin/env bash
# Drives tools/qa_sweep.jsx through the Flue bridge in chunks.
#   tools/qa/drive.sh <width> <height> <times-json> <chunk> [force]
# Chunked because one evalScript that runs for twenty minutes is one that can
# only fail all at once, and the sweep is resumable by design.
set -u
ROOT="D:/Ehtishaam/Files/Mine/New Branding/Scripts/Gradients combined script/v2/LivingGradients"
BRIDGE="C:/Users/Admin/AppData/Local/Python/pythoncore-3.14-64/Lib/site-packages/adapters/after_effects_adapter/after_effects_bridge.py"
W="${1:-1920}"; H="${2:-1080}"; TIMES="${3:-[0,0.25,0.5,0.75,1.0]}"; CHUNK="${4:-4}"; FORCE="${5:-false}"
TOTAL=$(grep -cE "^  \{ id: '" "$ROOT/js/presets.js")
echo "sweeping $TOTAL gradients at ${W}x${H}, times=$TIMES, chunk=$CHUNK, force=$FORCE"
i=0
while [ "$i" -lt "$TOTAL" ]; do
  cat > "$ROOT/tools/qa/config.json" <<EOF
{ "from": $i, "count": $CHUNK, "width": $W, "height": $H,
  "fps": 30, "duration": 8, "times": $TIMES,
  "keepComps": false, "force": $FORCE }
EOF
  echo "--- $i .. $((i+CHUNK-1)) ---"
  echo "\$.evalFile(new File(\"$ROOT/tools/qa_sweep.jsx\"));" \
    | py "$BRIDGE" --stdin 2>&1 \
    | python -c "import sys,json;d=json.load(sys.stdin);r=d.get('result',d);
print('\n'.join('  %-16s %-8s layers=%-3s frames=%d %s' % (x['id'],x['status'],x['layers'],len(x['frames']),x['detail'][:70]) for x in r.get('results',[]))) if isinstance(r,dict) and 'results' in r else print('  BRIDGE:',str(r)[:300])"
  i=$((i+CHUNK))
done
echo "sweep done"
