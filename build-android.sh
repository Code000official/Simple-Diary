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

echo "[1/6] 检查构建环境"
for cmd in node npm cargo rustup; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    case "$cmd" in
      node|npm) echo "[错误] 未找到 $cmd，请安装：https://nodejs.org" ;;
      *)        echo "[错误] 未找到 $cmd，请安装：https://rustup.rs" ;;
    esac
    exit 1
  fi
done

# JDK 选择：Gradle/AGP 最高支持 Java 21，不能用更新的版本
jdk_major() {
  "$1/bin/java" -version 2>&1 | head -1 | sed -E 's/.*version "([0-9]+).*/\1/'
}
JDK_OK=""
if [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/java" ]; then
  MAJOR=$(jdk_major "$JAVA_HOME")
  if [ "$MAJOR" -le 21 ] 2>/dev/null; then
    JDK_OK="$JAVA_HOME"
  else
    echo "[提示] JAVA_HOME ($JAVA_HOME) 是 Java $MAJOR，Gradle 不支持，改用系统里合适的 JDK"
  fi
fi
if [ -z "$JDK_OK" ]; then
  for c in /usr/lib/jvm/*17* /usr/lib/jvm/*21* "$HOME"/.jdks/*17* "$HOME"/.jdks/*21*; do
    if [ -x "$c/bin/javac" ]; then
      JDK_OK="$c"
      break
    fi
  done
fi
if [ -z "$JDK_OK" ]; then
  echo "[错误] 未找到 Java 17/21 的 JDK（Gradle/AGP 不支持更新的大版本）"
  echo "  例如：sudo dnf install java-21-openjdk-devel"
  exit 1
fi
export JAVA_HOME="$JDK_OK"
echo "[OK] JAVA_HOME=$JAVA_HOME（Java $(jdk_major "$JAVA_HOME")）"

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

# 接受 SDK 许可证（Gradle 构建时才能自动补装缺失的 platform/build-tools）
SDKMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
if [ -x "$SDKMANAGER" ]; then
  yes | "$SDKMANAGER" --licenses >/dev/null 2>&1 || true
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

echo "[2/6] 安装前端依赖"
if ! (cd client && npm install); then
  echo "[错误] 前端依赖安装失败！"
  exit 1
fi

# ---------- 3. 构建前端 ----------

echo "[3/6] 构建前端 (Vue)"
if ! (cd client && npm run build); then
  echo "[错误] 前端构建失败！"
  exit 1
fi

# ---------- 4. 初始化 Android 项目（仅首次） ----------

echo "[4/6] 准备 Android 项目"
if [ ! -d "src-tauri/gen/android" ]; then
  echo "[首次构建] 正在初始化 Android 项目..."
  if ! ./client/node_modules/.bin/tauri android init; then
    echo "[错误] Android 项目初始化失败！"
    exit 1
  fi
  echo "[OK] Android 项目初始化完成"
fi

# gradle 任务会执行 `node tauri android android-studio-script`，
# 但 node 不解析裸入口名，需要链接到 CLI 的 JS 入口（重新 init 后会丢失）
if [ ! -e "src-tauri/tauri" ] && [ -f "client/node_modules/@tauri-apps/cli/tauri.js" ]; then
  ln -s ../client/node_modules/@tauri-apps/cli/tauri.js src-tauri/tauri
  echo "[OK] 已创建符号链接 src-tauri/tauri → tauri CLI"
fi

# 同步服务器为内网 http:// 地址，Android 9+ 默认拦截明文流量，
# 放开 usesCleartextTraffic（tauri android init 重新生成后需再次 patch）
GRADLE_KTS="src-tauri/gen/android/app/build.gradle.kts"
if [ -f "$GRADLE_KTS" ] && grep -q 'manifestPlaceholders\["usesCleartextTraffic"\] = "false"' "$GRADLE_KTS"; then
  sed -i 's|manifestPlaceholders\["usesCleartextTraffic"\] = "false"|manifestPlaceholders["usesCleartextTraffic"] = "true"|' "$GRADLE_KTS"
  echo "[OK] 已放开明文 HTTP（usesCleartextTraffic=true），app 才能连接内网 http:// 同步服务器"
fi

# Gradle 发行版从 services.gradle.org 下载常超时，切换为国内镜像
GRADLE_MIRROR_HOST="${GRADLE_MIRROR_HOST:-mirrors.cloud.tencent.com/gradle}"
WRAPPER_PROPS="src-tauri/gen/android/gradle/wrapper/gradle-wrapper.properties"
if [ -f "$WRAPPER_PROPS" ] && grep -q "services\.gradle\.org/distributions" "$WRAPPER_PROPS"; then
  sed -i "s|services\.gradle\.org/distributions|$GRADLE_MIRROR_HOST|" "$WRAPPER_PROPS"
  echo "[OK] Gradle 发行版下载地址已切换为镜像：$GRADLE_MIRROR_HOST"
fi

# ---------- 5. 构建 Android ----------

echo "[5/6] 构建 Android $TARGET（首次编译较慢，需下载 Gradle 依赖）..."
if ! ./client/node_modules/.bin/tauri android build "${TAURI_ARGS[@]}"; then
  echo "[错误] Android 构建失败！"
  exit 1
fi

# ---------- 6. debug 签名（仅 APK） ----------

APK_DIR="src-tauri/gen/android/app/build/outputs/apk/universal/release"
SIGNED_APK=""
if [ "$TARGET" = "apk" ]; then
  echo "[6/6] 为 APK 应用 debug 签名（本地测试可直装；正式发布请配置自己的 keystore）"
  UNSIGNED_APK="$APK_DIR/app-universal-release-unsigned.apk"
  if [ -f "$UNSIGNED_APK" ]; then
    BUILD_TOOLS="$(ls -d "$ANDROID_HOME"/build-tools/* 2>/dev/null | sort -V | tail -1)"
    KEYSTORE="$HOME/.android/debug.keystore"
    APP_VERSION="$(node -p "require('$ROOT_DIR/src-tauri/tauri.conf.json').version")"
    SIGNED_APK="$APK_DIR/SimpleDiary-${APP_VERSION}-universal-debug-signed.apk"
    if [ ! -f "$KEYSTORE" ]; then
      "$JAVA_HOME/bin/keytool" -genkeypair -v -keystore "$KEYSTORE" \
        -storepass android -alias androiddebugkey -keypass android \
        -keyalg RSA -keysize 2048 -validity 10000 \
        -dname "CN=Android Debug,O=Android,C=US" >/dev/null 2>&1
    fi
    if "$BUILD_TOOLS/zipalign" -f 4 "$UNSIGNED_APK" "$SIGNED_APK" &&
       "$BUILD_TOOLS/apksigner" sign --ks "$KEYSTORE" \
         --ks-pass pass:android --key-pass pass:android "$SIGNED_APK" 2>/dev/null; then
      echo "[OK] 已签名：$SIGNED_APK"
    else
      SIGNED_APK=""
      echo "[警告] debug 签名失败，未签名 APK 无法直接安装：$UNSIGNED_APK"
    fi
  else
    echo "[提示] 未找到未签名产物（可能已配置正式签名），跳过 debug 签名"
  fi
fi

echo
echo "============================================"
echo "  Android 构建完成！"
echo
if [ "$TARGET" = "apk" ]; then
  echo "  APK 位置：src-tauri/gen/android/app/build/outputs/apk/"
  if [ -n "$SIGNED_APK" ]; then
    echo "  可直接安装：$SIGNED_APK"
  fi
else
  echo "  AAB 位置：src-tauri/gen/android/app/build/outputs/bundle/"
fi
echo "============================================"
