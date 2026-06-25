/**
 * 数据目录配置
 *
 * 管理日记数据文件的存储路径。
 * - 在浏览器环境下，数据通过 dev-server 读写，目录路径仅用于展示
 * - 在 Tauri 生产环境下，目录路径将用于决定实际文件存储位置
 */
import { ref } from 'vue'

const STORAGE_KEY = 'diary-data-dir'

export function useDataConfig() {
  const dataDir = ref(localStorage.getItem(STORAGE_KEY) || './data/')

  function setDataDir(dir: string) {
    dataDir.value = dir
    localStorage.setItem(STORAGE_KEY, dir)
  }

  return { dataDir, setDataDir }
}

/**
 * 后端连接状态
 */
export type SyncStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

const _syncStatus = ref<SyncStatus>('disconnected')

export function useSyncStatus() {
  function setSyncStatus(s: SyncStatus) {
    _syncStatus.value = s
  }

  return { syncStatus: _syncStatus, setSyncStatus }
}