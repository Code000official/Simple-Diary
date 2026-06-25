@echo off
echo ============================================
echo   日记应用 - 开发服务器
echo   前端: http://localhost:4173
echo   数据存储在浏览器 IndexedDB 中
echo   按 Ctrl+C 关闭
echo ============================================
echo.

cd client
call npx vite
pause