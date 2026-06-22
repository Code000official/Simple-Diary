#!/bin/bash
set -e

echo "============================================"
echo "  日记应用 - 一键打包脚本"
echo "  产物：server/dist/diary-app.exe (Windows)"
echo "         server/dist/diary-app-linux (Linux)"
echo "============================================"
echo
echo "[1/6] 安装前端依赖"
cd client
npm install
cd ..

echo "[2/6] 构建前端 (Vue)"
cd client
npm run build
cd ..

echo "[3/6] 安装后端依赖"
cd server
npm install

echo "[4/6] 编译后端 (TypeScript)"
cd server
npm run build

echo "[5/6] 复制前端产物到后端"
rm -rf dist/public
cp -r ../client/dist dist/public

echo "[6/6] 打包双平台可执行文件"
npm run bundle

cd ..

echo
echo "============================================"
echo "  打包完成！"
echo
echo "  Windows: server/dist/diary-app.exe"
echo "  Linux:   server/dist/diary-app-linux"
echo "============================================"
