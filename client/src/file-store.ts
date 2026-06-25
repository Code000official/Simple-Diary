/**
 * 文件存储后端
 *
 * 统一数据访问层，支持两种后端：
 * - HttpFileBackend：开发模式，通过 HTTP 与本地文件服务器通信
 * - IndexedDbBackend：IndexedDB 兜底缓存
 *
 * 所有组件通过 api.ts 访问，不直接使用本模块。
 */

import Dexie, { type Table } from 'dexie'
import type { DiaryEntry } from './types'

/* ==================== 数据格式 ==================== */

export interface DiaryDataFile {
  entries: DiaryEntry[]
  nextId: number
}

/* ==================== 后端接口 ==================== */

export interface StoreBackend {
  getAllEntries(): Promise<DiaryEntry[]>
  getEntry(id: number): Promise<DiaryEntry | undefined>
  putEntry(entry: DiaryEntry): Promise<void>
  removeEntry(id: number): Promise<void>

  getImage(filename: string): Promise<ArrayBuffer | undefined>
  putImage(filename: string, data: ArrayBuffer): Promise<string>
  deleteImage(filename: string): Promise<void>

  getNextId(): Promise<number>
  setNextId(id: number): Promise<void>
}

/* ==================== HTTP 后端（开发模式） ==================== */

export class HttpFileBackend implements StoreBackend {
  private serverUrl: string

  constructor(serverUrl = '') {
    this.serverUrl = serverUrl
  }

  private get dataUrl() {
    return `${this.serverUrl}/data/diary.json`
  }

  private get uploadsBase() {
    return `${this.serverUrl}/uploads`
  }

  private async readDataFile(): Promise<DiaryDataFile> {
    const res = await fetch(this.dataUrl)
    if (!res.ok) {
      if (res.status === 404) {
        return { entries: [], nextId: 1 }
      }
      throw new Error(`读取数据文件失败: ${res.status}`)
    }
    return res.json()
  }

  private async writeDataFile(data: DiaryDataFile): Promise<void> {
    const res = await fetch(this.dataUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data, null, 2),
    })
    if (!res.ok) {
      throw new Error(`写入数据文件失败: ${res.status}`)
    }
  }

  async getAllEntries(): Promise<DiaryEntry[]> {
    const data = await this.readDataFile()
    return data.entries
  }

  async getEntry(id: number): Promise<DiaryEntry | undefined> {
    const data = await this.readDataFile()
    return data.entries.find(e => e.id === id)
  }

  async putEntry(entry: DiaryEntry): Promise<void> {
    const data = await this.readDataFile()
    const idx = data.entries.findIndex(e => e.id === entry.id)
    if (idx >= 0) {
      data.entries[idx] = entry
    } else {
      data.entries.push(entry)
    }
    if (entry.id >= data.nextId) {
      data.nextId = entry.id + 1
    }
    await this.writeDataFile(data)
  }

  async removeEntry(id: number): Promise<void> {
    const data = await this.readDataFile()
    data.entries = data.entries.filter(e => e.id !== id)
    await this.writeDataFile(data)
  }

  async getImage(filename: string): Promise<ArrayBuffer | undefined> {
    const res = await fetch(`${this.uploadsBase}/${filename}`)
    if (!res.ok) return undefined
    return res.arrayBuffer()
  }

  async putImage(filename: string, data: ArrayBuffer): Promise<string> {
    const blob = new Blob([data])
    const formData = new FormData()
    formData.append('file', blob, filename)
    const res = await fetch(`${this.serverUrl}/upload`, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) {
      throw new Error(`上传图片失败: ${res.status}`)
    }
    const body = await res.json()
    const serverUrl = body?.data?.url || `/uploads/${filename}`
    return serverUrl
  }

  async deleteImage(filename: string): Promise<void> {
    await fetch(`${this.uploadsBase}/${filename}`, { method: 'DELETE' })
  }

  async getNextId(): Promise<number> {
    const data = await this.readDataFile()
    return data.nextId
  }

  async setNextId(id: number): Promise<void> {
    const data = await this.readDataFile()
    data.nextId = id
    await this.writeDataFile(data)
  }
}

/* ==================== Dexie (IndexedDB) 后端 ==================== */

class DiaryDatabase extends Dexie {
  entries!: Table<DiaryEntry, number>
  images!: Table<{ filename: string; data: ArrayBuffer }, string>

  constructor() {
    super('SimpleDiary')
    this.version(1).stores({
      entries: '&id',
    })
    this.version(2).stores({
      entries: '&id',
      images: '&filename',
    })
  }
}

export class IndexedDbBackend implements StoreBackend {
  private db: DiaryDatabase

  constructor() {
    this.db = new DiaryDatabase()
  }

  async getAllEntries(): Promise<DiaryEntry[]> {
    return this.db.entries.toArray()
  }

  async getEntry(id: number): Promise<DiaryEntry | undefined> {
    return this.db.entries.get(id)
  }

  async putEntry(entry: DiaryEntry): Promise<void> {
    await this.db.entries.put(entry)
  }

  async removeEntry(id: number): Promise<void> {
    await this.db.entries.delete(id)
  }

  /* ---- 图片存 IndexedDB，刷新不丢失 ---- */

  async getImage(filename: string): Promise<ArrayBuffer | undefined> {
    const record = await this.db.images.get(filename)
    return record?.data
  }

  async putImage(filename: string, data: ArrayBuffer): Promise<string> {
    await this.db.images.put({ filename, data })
    return `/uploads/${filename}`
  }

  async deleteImage(filename: string): Promise<void> {
    await this.db.images.delete(filename)
  }

  async getNextId(): Promise<number> {
    const all = await this.db.entries.toArray()
    if (all.length === 0) return 1
    return Math.max(...all.map(e => e.id)) + 1
  }

  async setNextId(_id: number): Promise<void> {
    // Dexie auto-increment 不需要显式维护 nextId
  }
}

/* ==================== 工厂函数 ==================== */

let _backend: StoreBackend | null = null

/**
 * 获取当前后端实例
 *
 * 检测运行时环境并自动选择：
 * - Tauri 环境 → Tauri 文件系统后端
 * - 有 dev-server → HTTP 后端
 * - 兜底 → IndexedDB 后端
 */
export async function getBackend(): Promise<StoreBackend> {
  if (_backend) return _backend
  if (!_backendPromise) {
    _backendPromise = createBackend()
  }
  _backend = await _backendPromise
  return _backend
}

let _backendPromise: Promise<StoreBackend> | null = null

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function createBackend(): Promise<StoreBackend> {
  // Tauri 原生环境
  if (isTauri()) {
    console.log('[Store] 使用 Tauri 后端（文件系统）')
    const { TauriFileBackend } = await import('./file-store-tauri')
    return new TauriFileBackend()
  }
  // 默认使用 IndexedDB 后端，无需额外服务器
  console.log('[Store] 使用 IndexedDB 后端（本地存储）')
  return new IndexedDbBackend()
}


/**
 * 强制选择后端（供设置页面切换）
 */
export function resetBackend(): void {
  _backend = null
  _backendPromise = null
}

export async function createDevBackend(serverUrl: string): Promise<StoreBackend> {
  return new HttpFileBackend(serverUrl)
}