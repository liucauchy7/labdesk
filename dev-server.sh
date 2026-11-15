#!/bin/zsh
# 本地开发服务器：独立端口 + 独立数据目录，不影响线上 Mac Mini 的数据
set -euo pipefail
app_source="${0:A:h}"
port="${1:-8799}"
data_dir="${LAB_DEV_DATA:-/tmp/labdesk-dev}"
token="${LAB_DEV_TOKEN:-devtoken}"
mkdir -p "$data_dir"
export LAB_APP_TOKEN="$token"
export LAB_APP_DATA_DIR="$data_dir"
echo "Dev server: http://127.0.0.1:${port}/"
echo "Access code: ${token}"
echo "Data dir:    ${data_dir} (测试数据，随便删)"
exec python3 "$app_source/server.py" --host 127.0.0.1 --port "$port"
