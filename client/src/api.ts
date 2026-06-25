/**
 * API 服务层 — 本地优先版本
 *
 * 所有函数签名与之前完全一致（组件零改动）。
 * 内部实现改为从本地文件存储后端读写数据，
 * 而非向远程服务器发 HTTP 请求。
 *
 * 读取操作 → 直接从 StoreBackend 获取
 * 写入操作 → 写入 StoreBackend（立即持久化）
 * 图片操作 → 本地 ArrayBuffer 存储 + ObjectURL 显示
 * 导入/导出 → 本地文件（JSON）处理
 */

import type { DiaryEntry, CreateEntryRequest, UpdateEntryRequest, ApiResponse } from './types'
import { getMaxUploadSizeMB } from './composables/useUploadConfig'
import { getBackend } from './file-store'

/**
 * 生成 ISO 时间戳（与服务端格式一致：YYYY-MM-DD HH:mm:ss）
 */
function now(): string {
  return new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '')
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/* ==================== 条目操作 ==================== */

/**
 * 获取日记列表（支持客户端搜索筛选）
 */
export async function fetchEntries(params: {
  search?: string
  mood?: string
  page?: number
  limit?: number
} = {}): Promise<ApiResponse<DiaryEntry[]>> {
  const store = await getBackend()
  const all = await store.getAllEntries()
  // 只返回未删除的条目
  let filtered = all.filter(e => !e.deleted_at)

  // 客户端搜索
  if (params.search) {
    const q = params.search.toLowerCase()
    filtered = filtered.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.content.toLowerCase().includes(q)
    )
  }

  // 按心情筛选
  if (params.mood) {
    filtered = filtered.filter(e => e.mood === params.mood)
  }

  // 按创建时间倒序
  filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const total = filtered.length
  const page = params.page || 1
  const limit = params.limit || 20
  const start = (page - 1) * limit
  const data = filtered.slice(start, start + limit)

  return { success: true, data, total }
}

/**
 * 获取单条日记详情
 */
export async function fetchEntry(id: number): Promise<ApiResponse<DiaryEntry>> {
  const store = await getBackend()
  const entry = await store.getEntry(id)
  if (!entry) {
    return { success: false, message: '日记不存在' }
  }
  return { success: true, data: entry }
}

/**
 * 创建新日记
 */
export async function createEntry(entry: CreateEntryRequest): Promise<ApiResponse<DiaryEntry>> {
  const store = await getBackend()
  const nextId = await store.getNextId()

  const dateStr = entry.date || fmtDate(new Date())
  const timePart = new Date().toTimeString().slice(0, 8)
  const timestamp = `${dateStr} ${timePart}`

  const newEntry: DiaryEntry = {
    id: nextId,
    uuid: crypto.randomUUID(),
    title: entry.title,
    content: entry.content || '',
    mood: entry.mood || '',
    weather: entry.weather || '',
    tags: entry.tags || '',
    favorited: false,
    pinned_at: null,
    show_in_timeline: entry.show_in_timeline !== undefined ? entry.show_in_timeline : true,
    deleted_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  }

  await store.putEntry(newEntry)
  await store.setNextId(nextId + 1)

  return { success: true, data: newEntry }
}

/**
 * 更新日记（部分更新）
 */
export async function updateEntry(id: number, data: UpdateEntryRequest): Promise<ApiResponse<DiaryEntry>> {
  const store = await getBackend()
  const entry = await store.getEntry(id)

  if (!entry) {
    return { success: false, message: '日记不存在' }
  }

  if (data.title !== undefined) entry.title = data.title
  if (data.content !== undefined) entry.content = data.content
  if (data.mood !== undefined) entry.mood = data.mood
  if (data.weather !== undefined) entry.weather = data.weather
  if (data.tags !== undefined) entry.tags = data.tags
  if (data.favorited !== undefined) entry.favorited = data.favorited
  if (data.pinned_at !== undefined) entry.pinned_at = data.pinned_at
  if (data.show_in_timeline !== undefined) entry.show_in_timeline = data.show_in_timeline
  if (data.date !== undefined) {
    const timePart = entry.created_at.includes(' ') ? entry.created_at.slice(11) : ''
    entry.created_at = timePart ? `${data.date} ${timePart}` : data.date
  }

  entry.updated_at = now()

  await store.putEntry(entry)

  return { success: true, data: entry }
}

/**
 * 软删除日记（移入回收站）
 */
export async function deleteEntry(id: number): Promise<ApiResponse> {
  const store = await getBackend()
  const entry = await store.getEntry(id)
  if (!entry) {
    return { success: false, message: '日记不存在' }
  }

  entry.deleted_at = now()
  entry.updated_at = now()
  await store.putEntry(entry)

  return { success: true, message: '日记已移入回收站' }
}

/**
 * 获取回收站中的日记列表
 */
export async function fetchDeletedEntries(): Promise<ApiResponse<DiaryEntry[]>> {
  const store = await getBackend()
  const all = await store.getAllEntries()
  const deleted = all
    .filter(e => e.deleted_at)
    .sort((a, b) => new Date(b.deleted_at!).getTime() - new Date(a.deleted_at!).getTime())

  return { success: true, data: deleted, total: deleted.length }
}

/**
 * 从回收站恢复日记
 */
export async function restoreEntry(id: number): Promise<ApiResponse<DiaryEntry>> {
  const store = await getBackend()
  const entry = await store.getEntry(id)
  if (!entry || !entry.deleted_at) {
    return { success: false, message: '日记不存在或不在回收站中' }
  }

  entry.deleted_at = null
  entry.updated_at = now()
  await store.putEntry(entry)

  return { success: true, data: entry }
}

/**
 * 永久删除日记（从回收站彻底删除）
 * 同时清理该日记引用的孤立图片
 */
export async function permanentlyDeleteEntry(id: number): Promise<ApiResponse> {
  const store = await getBackend()
  const entry = await store.getEntry(id)
  if (!entry) {
    return { success: false, message: '日记不存在' }
  }

  // 清理图片
  await cleanupOrphanedImages(entry.content, id)
  // 删除条目
  await store.removeEntry(id)

  return { success: true, message: '日记已永久删除' }
}

/**
 * 清理日记内容中不再被任何条目引用的图片
 */
async function cleanupOrphanedImages(content: string, excludeEntryId: number): Promise<void> {
  const store = await getBackend()
  const imageRegex = /!\[.*?\]\((\/uploads\/[^)]+)\)|<img[^>]+src="(\/uploads\/[^"]+)"/g
  const urls: string[] = []
  let match: RegExpExecArray | null
  while ((match = imageRegex.exec(content)) !== null) {
    urls.push(match[1] || match[2])
  }
  if (urls.length === 0) return

  const all = await store.getAllEntries()
  const remaining = all.filter(e => e.id !== excludeEntryId)

  for (const url of urls) {
    const stillUsed = remaining.some(e => e.content && e.content.includes(url))
    if (!stillUsed) {
      const filename = url.replace('/uploads/', '')
      await store.deleteImage(filename)
    }
  }
}

/**
 * 获取指定年月的日记（按日期分组）
 */
export async function fetchEntriesByMonth(year: number, month: number): Promise<ApiResponse<{ [date: string]: DiaryEntry[] }>> {
  const startStr = `${year}-${String(month).padStart(2, '0')}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const endStr = `${endYear}-${String(endMonth).padStart(2, '0')}-01`
  const startTime = new Date(startStr).getTime()
  const endTime = new Date(endStr).getTime()

  const store = await getBackend()
  const all = await store.getAllEntries()

  const grouped: { [date: string]: DiaryEntry[] } = {}
  for (const entry of all) {
    if (entry.deleted_at) continue
    const t = new Date(entry.created_at).getTime()
    if (t >= startTime && t < endTime) {
      const date = entry.created_at.substring(0, 10)
      if (!grouped[date]) grouped[date] = []
      grouped[date].push(entry)
    }
  }

  // 每组按创建时间倒序
  for (const date of Object.keys(grouped)) {
    grouped[date].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  return { success: true, data: grouped }
}

/* ==================== 图片操作 ==================== */

/**
 * 上传图片
 *
 * 本地模式：将文件以 ArrayBuffer 存入后端，生成 ObjectURL 用于显示
 */
export async function uploadImage(file: File): Promise<ApiResponse<{ url: string; filename: string }>> {
  // 校验大小
  const maxMB = getMaxUploadSizeMB()
  if (maxMB > 0 && file.size > maxMB * 1024 * 1024) {
    return { success: false, message: `图片大小超过限制 (${maxMB}MB)` }
  }

  // 校验类型
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return { success: false, message: '不支持的文件类型' }
  }

  const extMatch = file.name.match(/\.(\w+)$/)
  const ext = extMatch ? extMatch[1].toLowerCase() : 'png'
  const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp']
  if (!allowed.includes(ext)) {
    return { success: false, message: `不支持的文件扩展名: .${ext}` }
  }

  const ts = Date.now()
  const rand = Math.random().toString(36).substring(2, 10)
  const filename = `${ts}_${rand}.${ext}`

  const buffer = await file.arrayBuffer()
  const store = await getBackend()
  const serverUrl = await store.putImage(filename, buffer)

  const finalUrl = serverUrl || `/uploads/${filename}`

  return { success: true, data: { url: finalUrl, filename } }
}

/* ==================== 导入/导出（跨平台） ==================== */

/**
 * 检测是否在 Tauri 环境
 */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * 导出所有数据为 JSON 文件
 *
 * - 浏览器：触发 Blob 下载
 * - Tauri：弹出原生保存对话框，写入文件
 */
export async function exportData(): Promise<void> {
  const store = await getBackend()
  const all = await store.getAllEntries()
  const nextId = await store.getNextId()

  const data = JSON.stringify({ entries: all, nextId }, null, 2)
  const defaultName = `diary-export-${fmtDate(new Date())}.json`

  if (isTauri()) {
    // Tauri：原生保存对话框
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    const filePath = await save({
      defaultPath: defaultName,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!filePath) return  // 用户取消
    await writeTextFile(filePath, data)
  } else {
    // 浏览器：Blob 下载
    const blob = new Blob([data], { type: 'application/json' })
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = defaultName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  }
}

/**
 * 从 JSON 文件导入数据
 *
 * - 浏览器：接收 File 对象（由隐藏 input 触发）
 * - Tauri：弹出原生打开对话框，读取文件
 */
export async function importData(file?: File): Promise<ApiResponse> {
  let text: string

  if (isTauri()) {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const { readTextFile } = await import('@tauri-apps/plugin-fs')
      const selected = await open({
        multiple: false,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (!selected) {
        return { success: false, message: '已取消导入' }
      }
      text = await readTextFile(selected as string)
    } catch (err) {
      return { success: false, message: `读取文件失败: ${err instanceof Error ? err.message : '未知错误'}` }
    }
  } else {
    if (!file) {
      return { success: false, message: '请选择备份文件' }
    }
    text = await file.text()
  }

  try {
    const data = JSON.parse(text)
    if (!data.entries || !Array.isArray(data.entries)) {
      return { success: false, message: '无效的备份文件：缺少 entries 字段' }
    }

    const store = await getBackend()
    for (const entry of data.entries) {
      if (entry.id && entry.title !== undefined) {
        await store.putEntry(entry as DiaryEntry)
      }
    }

    // 计算合理 nextId：防导入的数据没有 nextId 字段
    const maxEntryId = data.entries.reduce((m: number, e: DiaryEntry) => Math.max(m, e.id || 0), 0)
    const importedNextId = data.nextId || maxEntryId + 1
    const localNextId = await store.getNextId()
    if (importedNextId > localNextId) {
      await store.setNextId(importedNextId)
    }

    return { success: true, message: `已导入 ${data.entries.length} 条日记` }
  } catch (err) {
    return { success: false, message: `导入失败: ${err instanceof Error ? err.message : '未知错误'}` }
  }
}

/* ==================== 图片 URL 解析（解决离线/本地存储图片显示问题） ==================== */

const _objectUrlCache = new Map<string, string>()

function detectMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp',
  }
  return map[ext || ''] || 'application/octet-stream'
}

/**
 * 将 /uploads/xxx 类型的图片 URL 解析为浏览器可显示的 ObjectURL。
 * 从本地存储后端（IndexedDB / Tauri fs / dev-server）加载图片数据。
 *
 * 结果会被缓存，多次调用同一 URL 返回同一个 ObjectURL。
 * 刷新页面或调用 clearImageCache() 后缓存失效。
 */
export async function resolveImageUrl(url: string): Promise<string> {
  if (!url || !url.startsWith('/uploads/')) return url
  if (_objectUrlCache.has(url)) return _objectUrlCache.get(url)!

  const filename = url.replace('/uploads/', '')
  const store = await getBackend()
  const data = await store.getImage(filename)
  if (!data) return url

  const blob = new Blob([data], { type: detectMime(filename) })
  const objectUrl = URL.createObjectURL(blob)
  _objectUrlCache.set(url, objectUrl)
  return objectUrl
}

/**
 * 将一段文本（Markdown 或 HTML）中所有 /uploads/xxx 图片引用
 * 替换为可显示的 ObjectURL。
 */
export async function resolveContentImages(content: string): Promise<string> {
  const regex = /\/uploads\/([^)"'\s]+)/g
  const matches: Array<{ full: string; filename: string }> = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    matches.push({ full: match[0], filename: match[1] })
  }
  if (matches.length === 0) return content

  let result = content
  for (const { full, filename } of matches) {
    const store = await getBackend()
    const data = await store.getImage(filename)
    if (data) {
      const blob = new Blob([data], { type: detectMime(filename) })
      const objectUrl = URL.createObjectURL(blob)
      result = result.replace(full, objectUrl)
    }
  }
  return result
}

/**
 * 清除所有缓存的 ObjectURL（避免内存泄漏）。
 */
export function clearImageCache(): void {
  for (const url of _objectUrlCache.values()) {
    URL.revokeObjectURL(url)
  }
  _objectUrlCache.clear()
}