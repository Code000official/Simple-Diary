/**
 * Tauri 文件系统后端
 *
 * 通过 Tauri invoke 调用 Rust 命令，直接读写本地文件系统。
 * 仅在 Tauri 运行时环境生效（通过 file-store.ts 中 isTauri() 检测后动态导入）。
 */

import { invoke } from '@tauri-apps/api/core'
import type { DiaryDataFile, StoreBackend } from './file-store'
import type { DiaryEntry } from './types'

export class TauriFileBackend implements StoreBackend {
  /* ==================== 条目操作 ==================== */

  async getAllEntries(): Promise<DiaryEntry[]> {
    const data = await this.readData()
    return data.entries
  }

  async getEntry(id: number): Promise<DiaryEntry | undefined> {
    const all = await this.getAllEntries()
    return all.find(e => e.id === id)
  }

  /**
   * 读写全量数据文件 → 修改 → 写回
   */
  private async readData(): Promise<DiaryDataFile> {
    const raw = await invoke<string>('read_data_file')
    return JSON.parse(raw)
  }

  private async modifyData<T>(fn: (data: DiaryDataFile) => T): Promise<T> {
    const raw = await invoke<string>('read_data_file')
    const data: DiaryDataFile = JSON.parse(raw)
    const result = fn(data)
    await invoke('write_data_file', { content: JSON.stringify(data, null, 2) })
    return result
  }

  async putEntry(entry: DiaryEntry): Promise<void> {
    await this.modifyData((data) => {
      const idx = data.entries.findIndex(e => e.id === entry.id)
      if (idx >= 0) {
        data.entries[idx] = entry
      } else {
        data.entries.push(entry)
      }
      if (entry.id >= data.nextId) {
        data.nextId = entry.id + 1
      }
    })
  }

  async removeEntry(id: number): Promise<void> {
    await this.modifyData((data) => {
      data.entries = data.entries.filter(e => e.id !== id)
    })
  }

  /* ==================== 图片操作 ==================== */

  async getImage(filename: string): Promise<ArrayBuffer | undefined> {
    try {
      const bytes = await invoke<number[]>('read_image', { filename })
      return new Uint8Array(bytes).buffer
    } catch {
      return undefined
    }
  }

  async putImage(filename: string, data: ArrayBuffer): Promise<string> {
    const bytes = Array.from(new Uint8Array(data))
    await invoke('write_image', { filename, data: bytes })
    return `/uploads/${filename}`
  }

  async deleteImage(filename: string): Promise<void> {
    await invoke('delete_image', { filename })
  }

  /* ==================== 元数据 ==================== */

  async getNextId(): Promise<number> {
    const data = await this.readData()
    return data.nextId
  }

  async setNextId(id: number): Promise<void> {
    await this.modifyData((data) => {
      if (id > data.nextId) data.nextId = id
    })
  }
}