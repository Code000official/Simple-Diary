#!/bin/bash
# ============================================================
#   Simple Diary 同步服务器 · 一键管理脚本
#
#   克隆项目后在服务器上：
#     ./sync-server.sh            # 后台启动，立即可访问（退出终端不影响）
#     ./sync-server.sh install    # 注册为 systemd 服务（开机自启、崩溃自动重启）
#
#   全部命令：
#     start / stop / restart / status / log / install / uninstall
#
#   可用环境变量：PORT（默认 3457）、DATA_DIR（默认 ./data）
# ============================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER="$DIR/sync-server.mjs"
PID_FILE="$DIR/.sync-server.pid"
LOG_FILE="$DIR/sync.log"
UNIT_NAME="simple-diary-sync"
UNIT_FILE="/etc/systemd/system/$UNIT_NAME.service"
PORT="${PORT:-3457}"

c_info() { printf '\033[1;36m[同步服务器]\033[0m %s\n' "$*"; }
c_err()  { printf '\033[1;31m[错误]\033[0m %s\n' "$*" >&2; }

# ---------- 通用检查 ----------

check_node() {
  if ! command -v node >/dev/null 2>&1; then
    c_err "未找到 node，请先安装 Node.js（https://nodejs.org）"
    exit 1
  fi
}

pid_of() {
  [ -f "$PID_FILE" ] || return 1
  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null)"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && { echo "$pid"; return 0; }
  return 1
}

wait_ping() {
  # 最多等 5 秒，确认服务可访问
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if node -e "fetch('http://127.0.0.1:$PORT/ping',{signal:AbortSignal.timeout(1000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
      return 0
    fi
    sleep 0.5
  done
  return 1
}

show_addresses() {
  local ip=""
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  c_info "本机访问:   http://localhost:$PORT/"
  [ -n "$ip" ] && c_info "局域网访问: http://$ip:$PORT/"
}

# ---------- start / stop / restart / status / log ----------

do_start() {
  check_node
  if pid="$(pid_of)"; then
    c_info "已在运行（PID $pid），无需重复启动。查看状态：./sync-server.sh status"
    exit 0
  fi
  c_info "启动 sync-server.mjs（后台运行，日志: $LOG_FILE）..."
  ( cd "$DIR" && PORT="$PORT" nohup node "$SERVER" >> "$LOG_FILE" 2>&1 & echo $! > "$PID_FILE" )
  if ! wait_ping; then
    c_err "启动后未检测到服务响应，最近日志："
    tail -n 20 "$LOG_FILE" || true
    exit 1
  fi
  c_info "启动成功（PID $(cat "$PID_FILE")）。退出终端后服务继续运行。"
  show_addresses
  c_info "如需开机自启，运行: ./sync-server.sh install"
}

do_stop() {
  if pid="$(pid_of)"; then
    c_info "停止进程 PID $pid ..."
    kill "$pid"
    for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.25; done
    kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
    c_info "已停止。"
  else
    c_info "没有正在运行的后台实例。"
  fi
  rm -f "$PID_FILE"
}

do_status() {
  if pid="$(pid_of)"; then
    c_info "运行中（PID $pid，端口 $PORT）"
    wait_ping && c_info "健康检查 /ping 通过" || c_err "进程存活但 /ping 无响应"
  else
    c_info "未在运行（后台方式）。"
  fi
  if systemctl is-active --quiet "$UNIT_NAME" 2>/dev/null; then
    c_info "systemd 服务 $UNIT_NAME 运行中"
  fi
}

do_log() {
  [ -f "$LOG_FILE" ] || { c_info "暂无日志文件 $LOG_FILE"; exit 0; }
  tail -n 50 -f "$LOG_FILE"
}

# ---------- install / uninstall（systemd） ----------

do_install() {
  check_node
  if [ "$(id -u)" -ne 0 ]; then
    command -v sudo >/dev/null 2>&1 || { c_err "需要 root 权限（或安装 sudo）来写入 systemd 服务"; exit 1; }
  fi

  if systemctl list-unit-files "$UNIT_NAME.service" 2>/dev/null | grep -q "$UNIT_NAME"; then
    c_info "检测到已存在的 $UNIT_NAME 服务，先执行覆盖更新。"
  fi

  # 手动实例若在跑，先停掉，避免端口冲突
  if pid="$(pid_of)"; then
    c_info "检测到手动启动的实例（PID $pid），先停止以交给 systemd 管理。"
    do_stop
  fi

  NODE_BIN="$(command -v node)"
  # 先在项目内生成 unit 文件，再（必要时用 sudo）放到 systemd 目录
  UNIT_TMP="$DIR/.${UNIT_NAME}.service.tmp"
  cat > "$UNIT_TMP" <<EOF
[Unit]
Description=Simple Diary sync server (sync-server.mjs)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$DIR
ExecStart=$NODE_BIN $SERVER
Environment=PORT=$PORT
Environment=DATA_DIR=$DIR/data
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
  c_info "写入 $UNIT_FILE ..."
  if [ "$(id -u)" -eq 0 ]; then
    mv "$UNIT_TMP" "$UNIT_FILE"
  else
    sudo mv "$UNIT_TMP" "$UNIT_FILE"
  fi

  c_info "启用并启动服务（开机自启 + 崩溃自动重启）..."
  if [ "$(id -u)" -eq 0 ]; then
    systemctl daemon-reload
    systemctl enable --now "$UNIT_NAME"
  else
    sudo systemctl daemon-reload
    sudo systemctl enable --now "$UNIT_NAME"
  fi

  if wait_ping; then
    c_info "systemd 服务安装完成，服务常驻运行，与终端无关。"
    show_addresses
    c_info "常用命令: systemctl status $UNIT_NAME / journalctl -u $UNIT_NAME -f"
  else
    c_err "服务已注册但未检测到响应，请查看: journalctl -u $UNIT_NAME -n 50"
    exit 1
  fi
}

do_uninstall() {
  if systemctl list-unit-files "$UNIT_NAME.service" 2>/dev/null | grep -q "$UNIT_NAME"; then
    if [ "$(id -u)" -eq 0 ]; then
      systemctl disable --now "$UNIT_NAME" || true
      rm -f "$UNIT_FILE"
      systemctl daemon-reload
    else
      sudo systemctl disable --now "$UNIT_NAME" || true
      sudo rm -f "$UNIT_FILE"
      sudo systemctl daemon-reload
    fi
    c_info "已卸载 systemd 服务 $UNIT_NAME。"
  else
    c_info "未安装 systemd 服务。"
  fi
  do_stop
}

# ---------- 入口 ----------

case "${1:-start}" in
  start)    do_start ;;
  stop)     do_stop ;;
  restart)  do_stop; do_start ;;
  status)   do_status ;;
  log)      do_log ;;
  install)  do_install ;;
  uninstall) do_uninstall ;;
  *)
    echo "用法: $0 {start|stop|restart|status|log|install|uninstall}"
    echo "  （不带参数默认 start）"
    exit 1
    ;;
esac
