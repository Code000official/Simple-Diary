@echo off
chcp 65001 >nul
echo ============================================
echo   日记应用 - 构建脚本
echo   产物：
echo     client/dist/（前端静态文件）
echo     src-tauri/target/release/（Tauri 桌面应用）
echo ============================================
echo.

echo [1/4] 安装前端依赖
cd client
call npm install
if %errorlevel% neq 0 (
  echo 前端依赖安装失败！
  pause
  exit /b 1
)

echo [2/4] 构建前端 (Vue)
call npm run build
if %errorlevel% neq 0 (
  echo 前端构建失败！
  pause
  exit /b 1
)
cd ..

echo [3/4] 复制前端产物到数据目录
if exist data\client rmdir /s /q data\client
xcopy client\dist data\client\ /e /i /q >nul

echo [4/4] 打包 Tauri 桌面应用
REM 从项目根目录运行（client/node_modules/.bin/tauri 由 client/package.json 安装）
call client\node_modules\.bin\tauri build
if %errorlevel% neq 0 (
  echo Tauri 打包失败！请确保已安装 Rust 和 VS Build Tools
  pause
  exit /b 1
)

echo.
echo ============================================
echo  构建完成！
echo.
echo  前端产物：client/dist/
echo  数据目录：data/
echo  Tauri 应用安装包：src-tauri/target/release/bundle/
echo.
echo  开发时运行：cd client ^&^& npx vite
echo  Tauri 开发运行：cd client ^&^& npx tauri dev
echo  （或者：client\node_modules\.bin\tauri dev，从项目根目录运行）
echo ============================================
pause