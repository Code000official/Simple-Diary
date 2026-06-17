#!/bin/bash
set -e

echo "============================================"
echo "  日记应用 - 一键打包脚本"
echo "  产物：server/dist/diary-app.exe (Windows)"
echo "         server/dist/diary-app-linux (Linux)"
echo "============================================"
echo

echo "[1/4] 构建前端 (Vue)"
cd client
npm run build
cd ..

echo "[2/4] 编译后端 (TypeScript)"
cd server
npm run build

echo "[3/4] 复制前端产物到后端"
rm -rf dist/public
cp -r ../client/dist dist/public

echo "[4/4] 打包双平台可执行文件"
npm run bundle

cd ..

echo
echo "============================================"
echo "  打包完成！"
echo
echo "  Windows: server/dist/diary-app.exe"
echo "  Linux:   server/dist/diary-app-linux"
echo "============================================"
