/**
 * 服务器入口文件
 * 负责初始化 Express 应用、数据库和所有中间件
 *
 * 启动流程：
 * 1. 初始化数据库（创建表和触发器）
 * 2. 配置 Express 中间件（CORS、JSON 解析、静态文件服务）
 * 3. 挂载 API 路由
 * 4. 启动 HTTP 服务器
 * 5. 注册优雅关闭处理（确保数据库连接正常释放）
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDatabase, closeDatabase } from './database';
import apiRouter from './routes';
import uploadRouter from './upload';
import importExportRouter from './import-export';

const PORT = process.env.PORT || 4567;

// 创建 Express 应用实例
const app = express();

/**
 * 中间件配置
 *
 * cors(): 允许跨域请求
 * - 开发时前后端分离运行（Vite 在 5173，Express 在 4567），必须开启 CORS
 * - 生产环境前后端打包在一起则不需要，但开启也不会有问题
 *
 * express.json(): 解析 JSON 请求体
 * - 限制 10MB 防止恶意超大请求
 *
 * express.urlencoded(): 解析 URL 编码的表单数据
 */
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/**
 * 静态文件服务
 * 将前端构建产物（client/dist）作为静态资源提供
 * 生产环境时，Express 同时充当静态文件服务器和 API 服务器
 */
app.use(express.static(path.join(__dirname, '..', '..', 'client', 'dist')));

/**
 * 上传文件静态服务
 * 让浏览器可以通过 /uploads/filename.jpg 访问上传的图片
 */
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

/**
 * API 路由挂载
 * 所有 /api 开头的请求都交给 apiRouter 处理
 */
app.use('/api', apiRouter);
app.use('/api', uploadRouter);
app.use('/api', importExportRouter);

/**
 * SPA 回退路由（catch-all route）
 *
 * 为什么需要这个？
 * Vue Router 使用 history 模式时，URL 如 /entries/123 不对应任何真实文件
 * 当用户直接访问这样的 URL 或刷新页面时，服务器需要返回 index.html
 * 让 Vue Router 接管路由，而不是返回 404
 *
 * 注意：这个路由必须放在所有其他路由之后
 */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'client', 'dist', 'index.html'));
});

/**
 * 启动服务器
 * 1. 初始化数据库
 * 2. 监听指定端口
 */
function startServer(): void {
  // 初始化数据库（创建表结构和触发器）
  initDatabase();

  app.listen(PORT, () => {
    console.log(`[Server] 日记应用服务器已启动: http://localhost:${PORT}`);
    console.log(`[Server] API 地址: http://localhost:${PORT}/api`);
  });
}

/**
 * 优雅关闭处理
 *
 * 为什么要处理这些信号？
 * - SIGINT: 用户按 Ctrl+C 时触发
 * - SIGTERM: 进程管理器（如 PM2、Docker）发送的终止信号
 *
 * 如果不处理这些信号，数据库连接可能不会被正确关闭，
 * 导致 WAL 文件残留或数据损坏
 */
process.on('SIGINT', () => {
  console.log('\n[Server] 收到 SIGINT 信号，正在关闭...');
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Server] 收到 SIGTERM 信号，正在关闭...');
  closeDatabase();
  process.exit(0);
});

// 启动！
startServer();
