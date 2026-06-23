@echo off
chcp 65001 >nul
echo ============================================
echo   日记应用 - 一键打包脚本
echo   产物：server/dist/Simple-diary.exe (Windows)
echo         server/dist/Simple-diary-linux (Linux)
echo ============================================
echo.

echo [1/4] 构建前端 (Vue)
cd client
call npm run build
if %errorlevel% neq 0 (
  echo 前端构建失败！
  pause
  exit /b 1
)
cd ..

echo [2/4] 编译后端 (TypeScript)
cd server
call npm run build
if %errorlevel% neq 0 (
  echo 后端编译失败！
  pause
  exit /b 1
)

echo [3/4] 复制前端产物到后端
if exist dist\public rmdir /s /q dist\public
xcopy ..\client\dist dist\public\ /e /i /q >nul

echo [4/4] 打包双平台可执行文件
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
