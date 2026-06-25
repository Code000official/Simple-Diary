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
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

const PORT = parseInt(process.env.PORT || '3457', 10)
const DATA_DIR = path.resolve(process.env.DATA_DIR || './data')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
const DATA_FILE = path.join(DATA_DIR, 'diary.json')

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ entries: [], nextId: 1 }, null, 2), 'utf-8')
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
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
      const body = await readBody(req)
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
      const body = await readBody(req)
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

    sendJson(res, 404, { success: false, message: 'Not found' })
  } catch (err) {
    console.error('[sync-server]', err)
    res.writeHead(500)
    res.end('Internal server error')
  }
})

ensureDataDir()
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[sync-server] 同步服务器已启动: http://0.0.0.0:${PORT}`)
  console.log(`[sync-server] 数据目录: ${DATA_DIR}`)
})