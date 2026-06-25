/**
 * 同步引擎
 *
 * 负责与远程同步服务器双向同步日记数据。
 * 全量比对 + updated_at 时间戳冲突策略（较新者胜）。
 *
 * 同步服务器端点（sync-server.mjs）：
 *   GET/PUT /data/diary.json  — 拉取/推送全量数据
 *   POST /upload               — 上传图片
 *   GET/DELETE /uploads/:file  — 获取/删除图片
 *   GET /ping                  — 健康检查
 */

import type { DiaryDataFile } from './file-store'
import type { DiaryEntry } from './types'
import { getBackend } from './file-store'

export interface SyncResult {
  pushed: number
  pulled: number
  errors: string[]
}

export class SyncService {
  private serverUrl: string
  private timer: ReturnType<typeof setInterval> | null = null
  private onStatus?: (status: string) => void

  constructor(serverUrl: string, onStatus?: (status: string) => void) {
    // 确保 URL 末尾没有斜杠
    this.serverUrl = serverUrl.replace(/\/+$/, '')
    this.onStatus = onStatus
  }

  private setStatus(s: string) {
    this.onStatus?.(s)
  }

  /* ==================== 网络请求 ==================== */

  private async request(path: string, options: RequestInit = {}): Promise<Response> {
    return fetch(`${this.serverUrl}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers as Record<string, string>) },
      ...options,
    })
  }

  /**
   * 测试连接
   *
   * 不仅检查 HTTP 可达性，还验证响应确实是同步服务器的格式
   *（包含 entries 数组和 nextId 字段的 JSON）。
   */
  async ping(): Promise<boolean> {
    if (!this.serverUrl) return false
    try {
      const res = await fetch(`${this.serverUrl}/data/diary.json`, {
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) return false
      const body = await res.json()
      // 验证确实是同步服务器的数据格式
      return Array.isArray(body.entries) && typeof body.nextId === 'number'
    } catch {
      return false
    }
  }

  /**
   * 拉取远程全量数据
   */
  private async fetchRemoteData(): Promise<DiaryDataFile | null> {
    try {
      const res = await this.request('/data/diary.json', { signal: AbortSignal.timeout(10000) })
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  }

  /**
   * 推送全量数据到远程
   */
  private async pushRemoteData(data: DiaryDataFile): Promise<boolean> {
    try {
      const res = await this.request('/data/diary.json', {
        method: 'PUT',
        body: JSON.stringify(data, null, 2),
        signal: AbortSignal.timeout(10000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  /**
   * 上传单张图片到远程
   */
  private async uploadImage(filename: string, data: ArrayBuffer): Promise<boolean> {
    try {
      const blob = new Blob([data])
      const fd = new FormData()
      fd.append('file', blob, filename)
      const res = await fetch(`${this.serverUrl}/upload`, {
        method: 'POST',
        body: fd,
        signal: AbortSignal.timeout(30000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  /**
   * 从远程下载单张图片
   */
  private async downloadImage(filename: string): Promise<ArrayBuffer | null> {
    try {
      const res = await fetch(`${this.serverUrl}/uploads/${filename}`, {
        signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) return null
      return res.arrayBuffer()
    } catch {
      return null
    }
  }

  /* ==================== 核心同步逻辑 ==================== */

  /**
   * 全量同步
   *
   * 流程：
   * 1. 拉取远程数据
   * 2. 读取本地数据
   * 3. 比对每条条目 updated_at，较新者胜
   * 4. 将合并结果写回本地和远程
   * 5. 同步图片
   */
  async fullSync(): Promise<SyncResult> {
    const result: SyncResult = { pushed: 0, pulled: 0, errors: [] }

    this.setStatus('syncing')

    // 1. 拉取远程数据
    const remote = await this.fetchRemoteData()
    if (!remote) {
      result.errors.push('无法连接到同步服务器')
      this.setStatus('error')
      return result
    }

    // 2. 读取本地数据
    const store = await getBackend()
    const localEntries = await store.getAllEntries()
    const localNextId = await store.getNextId()

    // 3. 建立条目索引（优先用 uuid，没有则用 id）
    function key(e: DiaryEntry): string {
      return e.uuid || `id:${e.id}`
    }

    const localMap = new Map<string, DiaryEntry>()
    for (const e of localEntries) localMap.set(key(e), e)

    const remoteMap = new Map<string, DiaryEntry>()
    for (const e of remote.entries) remoteMap.set(key(e), e)

    const allKeys = new Set([...localMap.keys(), ...remoteMap.keys()])
    const mergedEntries: DiaryEntry[] = []

    for (const k of allKeys) {
      const local = localMap.get(k)
      const remoteEntry = remoteMap.get(k)

      if (!local && remoteEntry) {
        mergedEntries.push(remoteEntry)
        result.pulled++
      } else if (local && !remoteEntry) {
        mergedEntries.push(local)
        result.pushed++
      } else if (local && remoteEntry) {
        const lt = new Date(local.updated_at).getTime()
        const rt = new Date(remoteEntry.updated_at).getTime()
        if (lt >= rt) {
          mergedEntries.push(local)
          if (lt > rt) result.pushed++
        } else {
          mergedEntries.push(remoteEntry)
          result.pulled++
        }
      }
    }

    // 4. 写回本地，清理旧 ID 残留
    const mergedUuids = new Set<string>()
    for (const entry of mergedEntries) {
      if (entry.uuid) mergedUuids.add(entry.uuid)
      await store.putEntry(entry)
    }

    // 如果有条目通过 uuid 匹配但 id 变了，删掉旧 id 的残留
    if (mergedUuids.size > 0) {
      const allAfter = await store.getAllEntries()
      for (const existing of allAfter) {
        if (existing.uuid && mergedUuids.has(existing.uuid) && !mergedEntries.find(e => e.id === existing.id && e.uuid === existing.uuid)) {
          await store.removeEntry(existing.id)
        }
      }
    }

    // 更新本地 nextId
    const maxId = mergedEntries.reduce((m, e) => Math.max(m, e.id), 0)
    const mergedNextId = Math.max(localNextId, remote.nextId, maxId + 1)
    await store.setNextId(mergedNextId)

    // 5. 推送到远程
    const mergedData: DiaryDataFile = { entries: mergedEntries, nextId: mergedNextId }
    const pushOk = await this.pushRemoteData(mergedData)
    if (!pushOk) {
      result.errors.push('推送数据到服务器失败')
    }

    // 6. 同步图片
    await this.syncImages(mergedEntries, result)

    this.setStatus('connected')
    return result
  }

  /**
   * 同步图片文件
   * 上传本地有但远程无的图片，下载远程有但本地无的
   */
  private async syncImages(entries: DiaryEntry[], result: SyncResult): Promise<void> {
    const imageRegex = /!\[.*?\]\((\/uploads\/[^)]+)\)|<img[^>]+src="(\/uploads\/[^"]+)"/g
    const allFilenames = new Set<string>()

    // 收集所有条目引用的图片
    for (const entry of entries) {
      let match: RegExpExecArray | null
      while ((match = imageRegex.exec(entry.content)) !== null) {
        const url = match[1] || match[2]
        const filename = url.replace('/uploads/', '')
        allFilenames.add(filename)
      }
    }

    const store = await getBackend()

    for (const filename of allFilenames) {
      // 尝试从远程获取
      const remoteBuf = await this.downloadImage(filename)
      const localBuf = await store.getImage(filename)

      if (localBuf && !remoteBuf) {
        // 本地有、远程无 → 上传
        const ok = await this.uploadImage(filename, localBuf)
        if (!ok) result.errors.push(`上传图片失败: ${filename}`)
      } else if (!localBuf && remoteBuf) {
        // 远程有、本地无 → 下载
        await store.putImage(filename, remoteBuf)
      }
    }
  }

  /* ==================== 自动同步 ==================== */

  /**
   * 启动定时自动同步
   */
  start(intervalMs = 30000): void {
    this.stop()
    this.timer = setInterval(async () => {
      const online = await this.ping()
      if (online) {
        await this.fullSync()
      } else {
        this.setStatus('disconnected')
      }
    }, intervalMs)
  }

  /**
   * 停止自动同步
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}