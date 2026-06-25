/**
 * 同步配置
 *
 * 管理同步服务器的连接信息和同步状态。
 */
import { ref } from 'vue'

export type SyncStatus = 'idle' | 'connecting' | 'connected' | 'syncing' | 'error'

const SRV_KEY = 'diary-sync-server-url'
const AUTO_KEY = 'diary-sync-auto'

/* 全局单例状态（跨组件共享） */
const _serverUrl = ref(localStorage.getItem(SRV_KEY) || 'http://localhost:3457')
const _syncStatus = ref<SyncStatus>('idle')
const _autoSync = ref(localStorage.getItem(AUTO_KEY) === 'true') // 默认关闭
const _lastSyncTime = ref<string | null>(null)
const _lastError = ref<string | null>(null)

export function useSyncConfig() {
  function setServerUrl(url: string) {
    _serverUrl.value = url
    localStorage.setItem(SRV_KEY, url)
  }

  function setSyncStatus(s: SyncStatus) {
    _syncStatus.value = s
  }

  function setAutoSync(on: boolean) {
    _autoSync.value = on
    localStorage.setItem(AUTO_KEY, String(on))
  }

  function setLastSyncTime(t: string | null) {
    _lastSyncTime.value = t
  }

  function setLastError(e: string | null) {
    _lastError.value = e
  }

  return {
    serverUrl: _serverUrl,
    syncStatus: _syncStatus,
    autoSync: _autoSync,
    lastSyncTime: _lastSyncTime,
    lastError: _lastError,
    setServerUrl,
    setSyncStatus,
    setAutoSync,
    setLastSyncTime,
    setLastError,
  }
}