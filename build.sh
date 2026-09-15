#!/bin/bash
set -e

# 确保 Rust/Cargo 在 PATH 中
export PATH="$HOME/.cargo/bin:$PATH"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "============================================"
echo "  日记应用 - Linux 桌面构建脚本"
echo "  产物："
echo "    client/dist/（前端静态文件，供同步服务器托管）"
echo "    src-tauri/target/release/bundle/（Linux 安装包）"
echo "============================================"
echo

# 可选：通过参数指定打包格式（默认构建全部：deb/rpm/appimage）
# 用法：./build.sh            → 全部格式
#       ./build.sh deb rpm   → 仅指定格式
BUNDLE_ARGS=()
if [ $# -gt 0 ]; then
  BUNDLE_ARGS=(--bundles "$(IFS=,; echo "$*")")
fi

# ---------- 1. 环境检查 ----------

echo "[1/5] 检查构建环境"
MISSING=0
for cmd in node npm cargo rustc pkg-config; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[错误] 未找到 $cmd"
    MISSING=1
  fi
done
if [ "$MISSING" -ne 0 ]; then
  echo "  请安装 Node.js (https://nodejs.org) 和 Rust (https://rustup.rs)"
  exit 1
fi

MISSING_LIBS=()
for lib in webkit2gtk-4.1 gtk+-3.0 libsoup-3.0 javascriptcoregtk-4.1; do
  pkg-config --exists "$lib" || MISSING_LIBS+=("$lib")
done
if [ ${#MISSING_LIBS[@]} -gt 0 ]; then
  echo "[错误] 缺少 Tauri Linux 依赖库：${MISSING_LIBS[*]}"
  echo "  Debian/Ubuntu: sudo apt install libwebkit2gtk-4.1-dev build-essential libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev"
  echo "  Fedora:        sudo dnf install webkit2gtk4.1-devel gtk3-devel libsoup3-devel javascriptcoregtk4.1-devel librsvg2-devel"
  echo "  Arch:          sudo pacman -S --needed webkit2gtk-4.1 gtk3"
  exit 1
fi
echo "[OK] 构建环境完整"

# ---------- 2. 安装前端依赖 ----------

echo "[2/5] 安装前端依赖"
if ! (cd client && npm install); then
  echo "[错误] 前端依赖安装失败！"
  exit 1
fi

# ---------- 3. 构建前端 ----------

echo "[3/5] 构建前端 (Vue)"
if ! (cd client && npm run build); then
  echo "[错误] 前端构建失败！"
  exit 1
fi

# ---------- 4. 复制前端产物到数据目录 ----------

echo "[4/5] 复制前端产物到数据目录（供同步服务器托管 web 版）"
rm -rf data/client
cp -r client/dist data/client

# ---------- 5. 打包 Tauri Linux 应用 ----------

echo "[5/5] 打包 Tauri Linux 应用"
# NO_STRIP：linuxdeploy 内置的 strip 无法识别新版系统库的 .relr.dyn 段，
# 跳过它（发行版库已 strip，Rust 构建也已去除调试信息）
if ! NO_STRIP=1 ./client/node_modules/.bin/tauri build "${BUNDLE_ARGS[@]}"; then
  echo "[错误] Tauri 打包失败！请检查上方错误信息"
  echo "  （网络受限时 AppImage 打包可能失败，可改用：./build.sh deb rpm）"
  exit 1
fi

echo
echo "============================================"
echo "  Linux 构建完成！"
echo
echo "  前端产物：client/dist/"
echo "  数据目录：data/"
echo "  可执行文件：src-tauri/target/release/simple-diary"
echo "  安装包：src-tauri/target/release/bundle/"
echo "    deb      → bundle/deb/"
echo "    rpm      → bundle/rpm/"
echo "    appimage → bundle/appimage/"
echo
echo "  开发时运行：./rundev.sh（前端）/ ./client/node_modules/.bin/tauri dev（桌面）"
echo "============================================"
