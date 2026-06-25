#!/bin/bash
set -e

echo "============================================"
echo "  日记同步服务器 - 启动脚本"
echo "  默认端口: 3457"
echo "  按 Ctrl+C 关闭"
echo "============================================"
echo

# 1. 检测 Node.js
if ! command -v node &> /dev/null; then
  echo "[错误] 未找到 Node.js，请先安装: https://nodejs.org"
  exit 1
fi
echo "[OK] Node.js $(node --version)"

# 2. 检测 sync-server.mjs 是否存在
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SYNC_SERVER="$SCRIPT_DIR/sync-server.mjs"
if [ ! -f "$SYNC_SERVER" ]; then
  echo "[错误] 未找到 sync-server.mjs (期望路径: $SYNC_SERVER)"
  exit 1
fi

# 3. 设置环境变量（可被外部覆盖）
export PORT="${PORT:-3457}"
export DATA_DIR="${DATA_DIR:-$SCRIPT_DIR/data/sync}"

echo "[OK] 端口: $PORT"
echo "[OK] 数据目录: $DATA_DIR"

# 4. 检查数据目录是否可写
mkdir -p "$DATA_DIR/uploads" 2>/dev/null || {
  echo "[错误] 无法创建数据目录: $DATA_DIR"
  exit 1
}
if [ ! -w "$DATA_DIR" ]; then
  echo "[错误] 数据目录不可写: $DATA_DIR"
  exit 1
fi
echo "[OK] 数据目录就绪"

# 5. 检查端口是否被占用
if command -v ss &> /dev/null; then
  if ss -tlnp | grep -q ":$PORT "; then
    echo "[警告] 端口 $PORT 已被占用"
  fi
elif command -v lsof &> /dev/null; then
  if lsof -i :$PORT &> /dev/null; then
    echo "[警告] 端口 $PORT 已被占用"
  fi
fi

# 6. 启动
echo
echo "============================================"
echo "  启动同步服务器..."
echo "============================================"
echo

cd "$SCRIPT_DIR"
node sync-server.mjs