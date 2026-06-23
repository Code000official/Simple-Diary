@echo off
chcp 65001 >nul
echo ============================================
echo   日记应用 - 一键打包脚本
echo   产物：server/dist/Simple-diary.exe (Windows)
echo         server/dist/Simple-diary-linux (Linux)
echo ============================================
echo.

echo [1/6] 安装前端依赖
cd client
call npm install
if %errorlevel% neq 0 (
  echo 前端依赖安装失败！
  pause
  exit /b 1
)

echo [2/6] 构建前端 (Vue)
call npm run build
if %errorlevel% neq 0 (
  echo 前端构建失败！
  pause
  exit /b 1
)
cd ..

echo [3/6] 安装后端依赖
cd server
call npm install
if %errorlevel% neq 0 (
  echo 后端依赖安装失败！
  pause
  exit /b 1
)

echo [4/6] 编译后端 (TypeScript)
call npm run build
if %errorlevel% neq 0 (
  echo 后端编译失败！
  pause
  exit /b 1
)

echo [5/6] 复制前端产物到后端
if exist dist\public rmdir /s /q dist\public
xcopy ..\client\dist dist\public\ /e /i /q >nul

echo [6/6] 打包双平台可执行文件
call npm run bundle
if %errorlevel% neq 0 (
  echo 打包失败！
  pause
  exit /b 1
)

cd ..

echo.
echo ============================================
echo  打包完成！
echo.
echo  Windows: server\dist\Simple-diary.exe
echo  Linux:   server\dist\Simple-diary-linux
echo ============================================
pause
