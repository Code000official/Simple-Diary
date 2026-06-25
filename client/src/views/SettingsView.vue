<template>
  <div class="settings-view">
    <h1 class="page-title">设置</h1>

    <div class="settings-section">
      <h2 class="section-title">服务器同步</h2>
      <p class="section-desc">配置家庭服务器地址后，日记数据会自动跨设备同步。</p>

      <div class="sync-setting">
        <div class="sync-row">
          <span class="setting-label">服务器地址</span>
          <input
            class="sync-url-input"
            :value="serverUrl"
            @change="handleUrlChange"
            placeholder="http://localhost:3457"
          />
        </div>

        <div class="sync-row">
          <span class="setting-label">状态</span>
          <span :class="['sync-status-badge', syncStatus]">
            <span class="sync-dot"></span>
            {{ statusLabel }}
          </span>
        </div>

        <div class="sync-row">
          <span class="setting-label">自动同步</span>
          <label class="toggle-label">
            <input type="checkbox" :checked="autoSync" @change="handleAutoSyncChange" />
            <span class="toggle-slider"></span>
            <span class="toggle-text">{{ autoSync ? '每 30 秒' : '关闭' }}</span>
          </label>
        </div>

        <div class="sync-actions">
          <button class="btn btn-outline" :disabled="syncing || !serverUrl" @click="handleTest">
            {{ testing ? '测试中...' : '测试连接' }}
          </button>
          <button class="btn btn-primary" :disabled="syncing || !serverUrl" @click="handleSync">
            <span v-if="syncing" class="loading-spinner-sm"></span>
            {{ syncing ? '同步中...' : '立即同步' }}
          </button>
        </div>

        <div v-if="lastSyncTime" class="sync-info">
          最后同步: {{ lastSyncTime }}
        </div>
        <div v-if="lastError" class="sync-info sync-error">
          错误: {{ lastError }}
        </div>
        <div v-if="syncMsg" :class="['sync-info', syncMsgType]">
          {{ syncMsg }}
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h2 class="section-title">数据管理</h2>
      <p class="section-desc">导出所有日记和图片为备份文件，或从备份文件恢复数据。</p>

      <div class="action-cards">
        <div class="action-card card">
          <div class="card-icon">📤</div>
          <div class="card-body">
            <h3 class="card-title">导出数据</h3>
            <p class="card-desc">将所有日记内容导出为 .json 文件下载</p>
          </div>
          <button class="btn btn-primary" :disabled="loading" @click="handleExport">
            <span v-if="loading && action === 'export'" class="loading-spinner-sm"></span>
            {{ loading && action === 'export' ? '导出中...' : '导出' }}
          </button>
        </div>

        <div class="action-card card">
          <div class="card-icon">📥</div>
          <div class="card-body">
            <h3 class="card-title">导入数据</h3>
            <p class="card-desc">从之前导出的 .json 备份文件恢复数据</p>
          </div>
          <button class="btn btn-outline" :disabled="loading" @click="triggerImport">
            {{ loading && action === 'import' ? '导入中...' : '导入' }}
          </button>
          <input ref="fileInputRef" type="file" accept=".json" class="hidden-input" @change="handleImport" />
        </div>
      </div>

      <div v-if="message" :class="['message', messageType]">{{ message }}</div>
    </div>

    <div class="settings-section">
      <h2 class="section-title">回收站</h2>
      <p class="section-desc">已删除的日记会移入回收站，你可以在这里恢复或永久删除。</p>
      <router-link to="/trash" class="btn btn-outline">
        🗑️ 进入回收站
      </router-link>
    </div>

    <div class="settings-section">
      <h2 class="section-title">图片上传</h2>
      <p class="section-desc">设置上传图片的最大文件大小限制。</p>
      <div class="upload-size-setting">
        <span class="setting-label">最大图片大小</span>
        <div class="size-options">
          <button
            v-for="opt in UPLOAD_SIZE_OPTIONS"
            :key="opt.value"
            :class="['size-btn', { active: selectedSize === opt.value }]"
            @click="selectSize(opt.value)"
          >{{ opt.label }}</button>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h2 class="section-title">数据存储</h2>
      <p class="section-desc">日记数据存储在本地的纯文件目录中。配置服务器同步后，多台设备的数据会自动保持一致。</p>
      <div class="data-dir-setting">
        <span class="setting-label">数据目录</span>
        <div class="data-dir-input-row">
          <input
            class="data-dir-input"
            :value="dataDir"
            @change="handleDirChange"
            placeholder="./data/"
          />
        </div>
        <p class="data-dir-hint">开发模式下数据由本地文件服务器管理，保存在项目 data/ 目录下。</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { exportData, importData } from '../api'
import { UPLOAD_SIZE_OPTIONS, getMaxUploadSizeMB, setMaxUploadSizeMB } from '../composables/useUploadConfig'
import { useDataConfig } from '../composables/useDataConfig'
import { useSyncConfig } from '../composables/useSyncConfig'
import { SyncService } from '../sync'

const { dataDir, setDataDir } = useDataConfig()
const {
  serverUrl, syncStatus, autoSync, lastSyncTime, lastError,
  setServerUrl, setSyncStatus, setAutoSync, setLastSyncTime, setLastError,
} = useSyncConfig()

const fileInputRef = ref<HTMLInputElement | null>(null)
const loading = ref(false)
const action = ref<'export' | 'import' | ''>('')
const message = ref('')
const messageType = ref<'success' | 'error'>('success')
const selectedSize = ref(getMaxUploadSizeMB())

function selectSize(mb: number): void {
  selectedSize.value = mb
  setMaxUploadSizeMB(mb)
}

function handleDirChange(event: Event): void {
  const input = event.target as HTMLInputElement
  setDataDir(input.value)
}

async function handleExport(): Promise<void> {
  loading.value = true; action.value = 'export'; message.value = ''
  try { await exportData(); showMessage('导出成功', 'success') }
  catch (error) { showMessage(error instanceof Error ? error.message : '导出失败', 'error') }
  finally { loading.value = false; action.value = '' }
}

function triggerImport(): void {
  // Tauri 模式下直接用原生对话框，不需要隐藏 input
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    handleTauriImport()
  } else {
    fileInputRef.value?.click()
  }
}

async function handleTauriImport(): Promise<void> {
  loading.value = true; action.value = 'import'; message.value = ''
  try { const r = await importData(); showMessage(r.message || '导入成功', 'success') }
  catch (error) { showMessage(error instanceof Error ? error.message : '导入失败', 'error') }
  finally { loading.value = false; action.value = '' }
}

async function handleImport(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement; const file = target.files?.[0]
  if (!file) return; loading.value = true; action.value = 'import'; message.value = ''
  try { const r = await importData(file); showMessage(r.message || '导入成功', 'success') }
  catch (error) { showMessage(error instanceof Error ? error.message : '导入失败', 'error') }
  finally { loading.value = false; action.value = ''; target.value = '' }
}

function showMessage(msg: string, type: 'success' | 'error'): void { message.value = msg; messageType.value = type }

/* ==================== 同步相关 ==================== */

const syncMsg = ref('')
const syncMsgType = ref<'success' | 'error' | ''>('')
const testing = ref(false)
const syncing = ref(false)

const statusLabel = computed(() => {
  const map: Record<string, string> = { idle: '未配置', connecting: '连接中', connected: '已连接', syncing: '同步中', error: '错误' }
  return map[syncStatus.value] || syncStatus.value
})

function handleUrlChange(event: Event) {
  setServerUrl((event.target as HTMLInputElement).value)
  setSyncStatus('idle')
}

function handleAutoSyncChange(event: Event) {
  setAutoSync((event.target as HTMLInputElement).checked)
}

async function handleTest() {
  if (!serverUrl.value) return
  testing.value = true
  setSyncStatus('connecting')
  syncMsg.value = ''
  const svc = new SyncService(serverUrl.value)
  const ok = await svc.ping()
  setSyncStatus(ok ? 'connected' : 'error')
  syncMsg.value = ok ? '连接成功' : '无法连接到服务器'
  syncMsgType.value = ok ? 'success' : 'error'
  if (ok) setLastError(null)
  testing.value = false
}

async function handleSync() {
  if (!serverUrl.value) return
  syncing.value = true
  syncMsg.value = ''
  const svc = new SyncService(serverUrl.value, (s) => {
    if (s === 'syncing') setSyncStatus('syncing')
  })
  const ok = await svc.ping()
  if (!ok) {
    setSyncStatus('error')
    syncMsg.value = '无法连接到服务器'
    syncMsgType.value = 'error'
    syncing.value = false
    return
  }
  setSyncStatus('syncing')
  const result = await svc.fullSync()
  if (result.errors.length === 0) {
    setSyncStatus('connected')
    setLastError(null)
    syncMsg.value = `同步完成 (推送 ${result.pushed}, 拉取 ${result.pulled})`
    syncMsgType.value = 'success'
    setLastSyncTime(new Date().toLocaleString('zh-CN'))
  } else {
    setSyncStatus('error')
    setLastError(result.errors.join('; '))
    syncMsg.value = '同步部分失败: ' + result.errors.join('; ')
    syncMsgType.value = 'error'
  }
  syncing.value = false
}
</script>

<style scoped>
.settings-view { max-width: 800px; }
.page-title { font-family: var(--font-serif); font-size: 2rem; font-weight: 600; margin-bottom: var(--space-xl); color: var(--color-text); }
.settings-section { margin-bottom: var(--space-2xl); }
.section-title { font-family: var(--font-serif); font-size: 1.3rem; font-weight: 600; margin-bottom: var(--space-sm); color: var(--color-text); }
.section-desc { color: var(--color-text-secondary); font-size: 0.95rem; margin-bottom: var(--space-lg); }
.action-cards { display: flex; flex-direction: column; gap: var(--space-md); }
.action-card { display: flex; align-items: center; gap: var(--space-lg); padding: var(--space-lg); }
.card-icon { font-size: 2rem; flex-shrink: 0; }
.card-body { flex: 1; min-width: 0; }
.card-title { font-family: var(--font-serif); font-size: 1.1rem; font-weight: 600; margin-bottom: var(--space-xs); color: var(--color-text); }
.card-desc { font-size: 0.9rem; color: var(--color-text-secondary); line-height: 1.5; }
.hidden-input { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; }
.message { margin-top: var(--space-md); padding: var(--space-md); border-radius: var(--radius-sm); font-size: 0.95rem; }
.message.success { background: #E8F5E9; color: #2E7D32; }
.message.error { background: #FFEBEE; color: #C62828; }
.loading-spinner-sm { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.upload-size-setting {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  flex-wrap: wrap;
}

.setting-label {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--color-text);
  min-width: 120px;
}

.size-options {
  display: flex;
  gap: var(--space-xs);
  flex-wrap: wrap;
}

.size-btn {
  padding: var(--space-xs) var(--space-md);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.size-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-text);
}

.size-btn.active {
  border-color: var(--color-primary);
  background: rgba(107, 68, 35, 0.08);
  color: var(--color-text);
  font-weight: 500;
}

.data-dir-setting {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.data-dir-input-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.data-dir-input {
  padding: var(--space-sm) var(--space-md);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-card);
  color: var(--color-text);
  font-size: 0.9rem;
  font-family: var(--font-mono, monospace);
  width: 100%;
  max-width: 360px;
  outline: none;
  transition: border-color var(--transition-fast);
}

.data-dir-input:focus {
  border-color: var(--color-primary);
}

.data-dir-hint {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  opacity: 0.7;
}

/* ===== 同步配置 ===== */
.sync-setting {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.sync-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.sync-url-input {
  padding: var(--space-sm) var(--space-md);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-card);
  color: var(--color-text);
  font-size: 0.9rem;
  font-family: var(--font-mono, monospace);
  width: 100%;
  max-width: 360px;
  outline: none;
  transition: border-color var(--transition-fast);
}

.sync-url-input:focus {
  border-color: var(--color-primary);
}

.sync-status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 0.9rem;
  padding: 2px 10px;
  border-radius: 12px;
  background: var(--color-bg-card);
}

.sync-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.sync-status-badge.idle .sync-dot { background: #9E9E9E; }
.sync-status-badge.connecting .sync-dot { background: #FFA726; animation: pulse 1s infinite; }
.sync-status-badge.connected .sync-dot { background: #66BB6A; }
.sync-status-badge.syncing .sync-dot { background: #42A5F5; animation: pulse 0.5s infinite; }
.sync-status-badge.error .sync-dot { background: #EF5350; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.sync-actions {
  display: flex;
  gap: var(--space-sm);
}

.toggle-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
}

.toggle-label input { display: none; }

.toggle-slider {
  width: 36px;
  height: 20px;
  background: var(--color-border);
  border-radius: 10px;
  position: relative;
  transition: background var(--transition-fast);
}

.toggle-slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  transition: transform var(--transition-fast);
}

.toggle-label input:checked + .toggle-slider {
  background: var(--color-primary);
}

.toggle-label input:checked + .toggle-slider::after {
  transform: translateX(16px);
}

.toggle-text {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.sync-info {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.sync-info.sync-error {
  color: #EF5350;
}

.sync-msg { font-size: 0.85rem; }
.sync-msg.success { color: #66BB6A; }
.sync-msg.error { color: #EF5350; }
</style>
