@echo off
chcp 65001 >nul
echo ============================================
echo   日记应用 - Android 构建脚本
echo   产物：src-tauri/gen/android/ (APK/AAB)
echo ============================================
echo.

REM ------ 1. 环境检测 ------

echo [1/5] 检测 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [错误] 未找到 Node.js，请安装: https://nodejs.org
  pause
  exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo [OK] Node.js %%i

echo [2/5] 检测 Rust Android 目标
set "CARGO_PATH=%USERPROFILE%\.cargo\bin"
if not exist "%CARGO_PATH%\rustup.exe" (
  echo [错误] 未找到 Rust，请安装: https://rustup.rs
  pause
  exit /b 1
)

"%CARGO_PATH%\rustup" target list --installed 2>&1 | findstr "aarch64-linux-android" >nul
if %errorlevel% neq 0 (
  echo [提示] 缺少 Android 编译目标，正在安装...
  "%CARGO_PATH%\rustup" target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android i686-linux-android
  if %errorlevel% neq 0 (
    echo [错误] Android 目标安装失败！
    pause
    exit /b 1
  )
)
echo [OK] Rust Android 目标已安装

REM ------ 2. 安装前端依赖 ------

echo [3/5] 安装前端依赖
cd client
call npm install
if %errorlevel% neq 0 (
  echo 前端依赖安装失败！
  pause
  exit /b 1
)

REM ------ 3. 构建前端 ------

echo [4/5] 构建前端 (Vue)
call npm run build
if %errorlevel% neq 0 (
  echo 前端构建失败！
  pause
  exit /b 1
)
cd ..

REM ------ 4. 初始化/构建 Android ------

echo [5/5] 构建 Android APK
echo.
echo [提示] 如果是首次构建，需要先执行 Android 初始化。
echo       初始化只需要做一次，会下载 Android SDK 工具并生成
echo       src-tauri/gen/android/ 目录。
echo.

if not exist "src-tauri\gen\android" (
  echo [首次构建] 正在初始化 Android 项目...
  call client\node_modules\.bin\tauri android init
  if %errorlevel% neq 0 (
    echo Android 初始化失败！请确保已安装:
    echo   - Android Studio (含 Android SDK)
    echo   - NDK（Android Studio SDK Manager 中安装）
    echo   - 设置 ANDROID_HOME 和 NDK 环境变量
    pause
    exit /b 1
  )
  echo [OK] Android 项目初始化完成
)

echo 正在构建 Android APK（首次编译较慢，需下载依赖）...
call client\node_modules\.bin\tauri android build
if %errorlevel% neq 0 (
  echo Android 构建失败！
  pause
  exit /b 1
)

echo.
echo ============================================
echo  Android 构建完成！
echo.
echo  APK 位置：src-tauri/gen/android/app/build/outputs/apk/
echo  AAB 位置：src-tauri/gen/android/app/build/outputs/bundle/
echo ============================================
pause