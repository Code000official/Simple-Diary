#!/bin/bash
set -e

# 确保 Rust/Cargo 在 PATH 中
export PATH="$HOME/.cargo/bin:$PATH"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# 可选：通过参数指定产物类型
# 用法：./build-android.sh         → 构建 APK（默认）
#       ./build-android.sh aab    → 构建 AAB（Play 商店格式）
TARGET="${1:-apk}"
case "$TARGET" in
  apk) TAURI_ARGS=(--apk) ;;
  aab) TAURI_ARGS=(--aab) ;;
  *) echo "[错误] 未知参数：$TARGET（可选值：apk / aab）"; exit 1 ;;
esac

echo "============================================"
echo "  日记应用 - Android 构建脚本"
echo "  产物：$TARGET"
echo "============================================"
echo

# ---------- 1. 环境检查 ----------

echo "[1/5] 检查构建环境"
for cmd in node npm java cargo rustup; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    case "$cmd" in
      node|npm) echo "[错误] 未找到 $cmd，请安装：https://nodejs.org" ;;
      java)     echo "[错误] 未找到 java，请安装 JDK 17+（推荐 LTS 版本）" ;;
      *)        echo "[错误] 未找到 $cmd，请安装：https://rustup.rs" ;;
    esac
    exit 1
fi
done

# 自动推断 JAVA_HOME（Gradle 需要）
if [ -z "$JAVA_HOME" ] && command -v java >/dev/null 2>&1; then
  JAVA_BIN="$(readlink -f "$(command -v java)")"
  export JAVA_HOME="$(dirname "$(dirname "$JAVA_BIN")")"
  echo "[提示] 已自动设置 JAVA_HOME=$JAVA_HOME"
fi

# 检测 Android SDK
if [ -z "$ANDROID_HOME" ]; then
  if [ -n "$ANDROID_SDK_ROOT" ]; then
    export ANDROID_HOME="$ANDROID_SDK_ROOT"
  elif [ -d "$HOME/Android/Sdk" ]; then
    export ANDROID_HOME="$HOME/Android/Sdk"
  fi
fi
if [ -z "$ANDROID_HOME" ] || [ ! -d "$ANDROID_HOME" ]; then
  echo "[错误] 未找到 Android SDK，请安装 Android Studio 并设置 ANDROID_HOME"
  echo "  需要：SDK 平台工具 + NDK（在 SDK Manager 中安装）"
  echo "  默认检测路径：~/Android/Sdk"
  exit 1
fi
if ls "$ANDROID_HOME"/ndk/* >/dev/null 2>&1; then
  NDK_DIR="$(ls -d "$ANDROID_HOME"/ndk/* | sort -V | tail -1)"
  export NDK_HOME="$NDK_DIR"
  echo "[OK] Android SDK: $ANDROID_HOME"
  echo "[OK] Android NDK: $NDK_DIR"
else
  echo "[错误] $ANDROID_HOME 下未找到 NDK，请在 SDK Manager 中安装 NDK (Side by side)"
  exit 1
fi

# 检查 Rust Android 编译目标，缺失则安装
NEEDED_TARGETS="aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android"
INSTALLED_TARGETS="$(rustup target list --installed)"
TARGETS_TO_ADD=""
for t in $NEEDED_TARGETS; do
  echo "$INSTALLED_TARGETS" | grep -qx "$t" || TARGETS_TO_ADD="$TARGETS_TO_ADD $t"
done
if [ -n "$TARGETS_TO_ADD" ]; then
  echo "[提示] 缺少 Android 编译目标，正在安装：$TARGETS_TO_ADD"
  # shellcheck disable=SC2086
  rustup target add $TARGETS_TO_ADD
fi
echo "[OK] Rust Android 目标已就绪"

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

# ---------- 4. 初始化 Android 项目（仅首次） ----------

echo "[4/5] 准备 Android 项目"
if [ ! -d "src-tauri/gen/android" ]; then
  echo "[首次构建] 正在初始化 Android 项目..."
  if ! ./client/node_modules/.bin/tauri android init; then
    echo "[错误] Android 项目初始化失败！"
    exit 1
  fi
  echo "[OK] Android 项目初始化完成"
fi

# ---------- 5. 构建 Android ----------

echo "[5/5] 构建 Android $TARGET（首次编译较慢，需下载 Gradle 依赖）..."
if ! ./client/node_modules/.bin/tauri android build "${TAURI_ARGS[@]}"; then
  echo "[错误] Android 构建失败！"
  exit 1
fi

echo
echo "============================================"
echo "  Android 构建完成！"
echo
if [ "$TARGET" = "apk" ]; then
  echo "  APK 位置：src-tauri/gen/android/app/build/outputs/apk/"
else
  echo "  AAB 位置：src-tauri/gen/android/app/build/outputs/bundle/"
fi
echo "============================================"
