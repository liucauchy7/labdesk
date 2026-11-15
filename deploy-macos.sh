#!/bin/zsh
set -euo pipefail

app_source="${0:A:h}"
deploy_root="/Users/cauchyliu/Library/Application Support/NingLab/LabDesk"
runtime="$deploy_root/runtime"
data="$deploy_root/data"

mkdir -p "$runtime/public" "$runtime/android/dist" "$deploy_root/outputs" "$data"
rsync -a --delete "$app_source/public/" "$runtime/public/"
rsync -a "$app_source/android/dist/" "$runtime/android/dist/"
rsync -a "$app_source/storage/" "$data/"
cp "$app_source/server.py" "$runtime/server.py"
cp "$app_source/asr_worker.py" "$runtime/asr_worker.py"
if [ -f "$app_source/zones.local.json" ]; then cp "$app_source/zones.local.json" "$runtime/zones.local.json"; fi
cp "$app_source/pdf_worker.py" "$runtime/pdf_worker.py"
cp "$app_source/../outputs/260930-T.import.json" "$deploy_root/outputs/260930-T.import.json"
cp "$app_source/../数据平台落地方案.md" "$deploy_root/数据平台落地方案.md"

plist="/Users/cauchyliu/Library/LaunchAgents/cn.ninglab.labdesk-server.plist"
label="gui/$(id -u)/cn.ninglab.labdesk-server"
launchctl bootout "$label" 2>/dev/null || true
for attempt in 1 2 3 4 5; do
  if launchctl bootstrap "gui/$(id -u)" "$plist" 2>/dev/null; then
    break
  fi
  sleep 1
done
# wait until the port answers, retry the bootstrap once if it never came up
ready=0
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS -m 2 -o /dev/null "http://127.0.0.1:8767/"; then ready=1; break; fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  launchctl kickstart -k "$label" 2>/dev/null || true
  sleep 3
fi
