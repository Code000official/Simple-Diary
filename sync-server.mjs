/**
 * 同步服务器 - 用于家庭服务器部署
 *
 * 作为日记数据的远程中转站，接受应用推送数据、响应拉取请求。
 * 无数据库、无认证（单用户场景），纯文件存储。
 *
 * 端口: 3457（可通过 PORT 环境变量修改）
 * 数据目录: ./data/sync/（可通过 DATA_DIR 环境变量修改）
 *
 * 端点:
 *   GET /data/diary.json    — 拉取数据
 *   PUT /data/diary.json    — 推送数据
 *   POST /upload             — 上传图片
 *   GET /uploads/:filename   — 获取图片
 *   DELETE /uploads/:filename — 删除图片
 *   GET /ping                — 健康检查
 *
 * Web 版托管（可选）:
 *   若存在 data/client/（build.sh 产出的前端静态文件），则同时作为网站根目录，
 *   浏览器直接访问 http://<host>:3457/ 即可使用 Web 版日记；
 *   未部署时只提供同步 API。未知路径回退到 index.html（Vue Router history 模式）。
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

const PORT = parseInt(process.env.PORT || '3457', 10)
const DATA_DIR = path.resolve(process.env.DATA_DIR || './data')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
const DATA_FILE = path.join(DATA_DIR, 'diary.json')
// Web 版前端产物目录（build.sh / build.bat 复制 client/dist 到这里），可选
const CLIENT_DIR = path.join(DATA_DIR, 'client')
// 请求体上限：JSON 数据 50MB，图片上传 200MB
const MAX_JSON_BYTES = 50 * 1024 * 1024
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ entries: [], nextId: 1 }, null, 2), 'utf-8')
  }
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', c => {
      size += c.length
      if (size > maxBytes) {
        // 暂停接收，让上层先把 413 响应写回，再在外层断开连接
        req.pause()
        const err = new Error('请求体超过大小限制')
        err.statusCode = 413
        reject(err)
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function parseMultipart(body, contentType) {
  const m = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)
  if (!m) return null
  const boundary = m[1] || m[2]
  const parts = body.toString('binary').split(`--${boundary}`)
  const files = []
  for (const part of parts) {
    if (!part.includes('Content-Disposition: form-data;')) continue
    const fn = part.match(/filename="([^"]*)"/)
    if (!fn) continue
    const headerEnd = part.indexOf('\r\n\r\n') + 4
    let contentEnd = part.length
    if (part.endsWith('\r\n--')) {
      contentEnd -= 4
    } else if (part.endsWith('\r\n')) {
      contentEnd -= 2
    }
    files.push({ filename: fn[1], data: Buffer.from(part.substring(headerEnd, contentEnd), 'binary') })
  }
  return files
}

/* ==================== Web 版静态托管 ==================== */

const MIME_TYPES = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json',
  map: 'application/json',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  txt: 'text/plain; charset=utf-8',
}

/**
 * 尝试用 data/client/ 服务静态文件（Web 版前端）。
 * 返回 true 表示已响应；false 表示目录未部署或路径非法，交回给后续 404。
 * 未知路径回退 index.html，支持 Vue Router history 模式刷新。
 */
function serveStatic(pn, isHead, res) {
  let decoded
  try {
    decoded = decodeURIComponent(pn)
  } catch {
    return false
  }
  // 拒绝路径穿越：规范化后必须仍位于 CLIENT_DIR 内
  if (decoded.includes('\0') || decoded.includes('..')) return false
  const full = path.normalize(path.join(CLIENT_DIR, decoded))
  if (full !== CLIENT_DIR && !full.startsWith(CLIENT_DIR + path.sep)) return false

  let filePath = full
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(CLIENT_DIR, 'index.html')
    if (!fs.existsSync(filePath)) return false // 未部署 Web 版 → 走原 404
  }

  const ext = path.extname(filePath).slice(1).toLowerCase()
  const headers = {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    // Vite 产物 assets/ 下文件名带内容 hash，可长缓存；入口与其余页面不缓存
    'Cache-Control': decoded.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
  }
  res.writeHead(200, headers)
  if (isHead) {
    res.end()
  } else {
    res.end(fs.readFileSync(filePath))
  }
  return true
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const pn = url.pathname

  try {
    // GET /ping
    if (pn === '/ping' && (req.method === 'GET' || req.method === 'HEAD')) {
      sendJson(res, 200, { status: 'ok' })
      return
    }

    // GET /data/diary.json
    if (pn === '/data/diary.json' && req.method === 'GET') {
      ensureDataDir()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(fs.readFileSync(DATA_FILE, 'utf-8'))
      return
    }

    // HEAD /data/diary.json（连接检测）
    if (pn === '/data/diary.json' && req.method === 'HEAD') {
      ensureDataDir()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end()
      return
    }

    // PUT /data/diary.json
    if (pn === '/data/diary.json' && req.method === 'PUT') {
      ensureDataDir()
      const body = await readBody(req, MAX_JSON_BYTES)
      // 简单的有效性检查
      try { JSON.parse(body) } catch { sendJson(res, 400, { success: false, message: '无效的 JSON' }); return }
      // 先写临时文件再重命名，防止写一半崩溃损坏
      const tmp = DATA_FILE + '.tmp'
      fs.writeFileSync(tmp, body, 'utf-8')
      fs.renameSync(tmp, DATA_FILE)
      sendJson(res, 200, { success: true })
      return
    }

    // POST /upload
    if (pn === '/upload' && req.method === 'POST') {
      const ct = req.headers['content-type'] || ''
      const body = await readBody(req, MAX_UPLOAD_BYTES)
      const files = parseMultipart(body, ct)
      if (!files || files.length === 0) {
        sendJson(res, 400, { success: false, message: '未找到文件' })
        return
      }
      const file = files[0]
      const ext = (file.filename.match(/\.(\w+)$/) || [])[1]?.toLowerCase() || 'bin'
      const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp']
      if (!allowed.includes(ext)) {
        sendJson(res, 400, { success: false, message: `不支持 .${ext}` })
        return
      }
      // 使用客户端传入的文件名（客户端已确保唯一）
      const newName = file.filename
      ensureDataDir()
      const dest = path.join(UPLOADS_DIR, newName)
      // 文件名冲突时追加时间戳
      const finalName = fs.existsSync(dest)
        ? `${path.basename(newName, path.extname(newName))}_${Date.now()}${path.extname(newName)}`
        : newName
      fs.writeFileSync(path.join(UPLOADS_DIR, finalName), file.data)

      sendJson(res, 200, {
        success: true,
        data: { url: `/uploads/${finalName}`, filename: finalName },
      })
      return
    }

    // GET /uploads/:filename
    if (pn.startsWith('/uploads/') && req.method === 'GET') {
      const filename = pn.slice('/uploads/'.length).replace(/[/\\]/g, '')
      if (!filename) { res.writeHead(400); res.end('Bad request'); return }
      const fp = path.join(UPLOADS_DIR, filename)
      if (!fs.existsSync(fp)) { res.writeHead(404); res.end('Not found'); return }
      const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }
      const ct = mime[path.extname(filename).slice(1).toLowerCase()] || 'application/octet-stream'
      res.writeHead(200, { 'Content-Type': ct })
      res.end(fs.readFileSync(fp))
      return
    }

    // DELETE /uploads/:filename
    if (pn.startsWith('/uploads/') && req.method === 'DELETE') {
      const filename = pn.slice('/uploads/'.length).replace(/[/\\]/g, '')
      if (!filename) { res.writeHead(400); res.end('Bad request'); return }
      const fp = path.join(UPLOADS_DIR, filename)
      if (fs.existsSync(fp)) fs.unlinkSync(fp)
      sendJson(res, 200, { success: true })
      return
    }

    // 其余 GET/HEAD 交给 Web 版静态托管（若已部署 data/client/）
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (serveStatic(pn, req.method === 'HEAD', res)) return
    }

    sendJson(res, 404, { success: false, message: 'Not found' })
  } catch (err) {
    if (err.statusCode) {
      sendJson(res, err.statusCode, { success: false, message: err.message })
      req.destroy() // 响应已写入，断开剩余上传，避免客户端继续发送大请求体
      return
    }
    console.error('[sync-server]', err)
    res.writeHead(500)
    res.end('Internal server error')
  }
})

ensureDataDir()
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[sync-server] 同步服务器已启动: http://0.0.0.0:${PORT}`)
  console.log(`[sync-server] 数据目录: ${DATA_DIR}`)
  if (fs.existsSync(path.join(CLIENT_DIR, 'index.html'))) {
    console.log(`[sync-server] Web 版已托管: http://<本机地址>:${PORT}/`)
  } else {
    console.log('[sync-server] 未发现 Web 版前端（data/client/），仅提供同步 API')
  }
})