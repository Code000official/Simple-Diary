<template>
  <div class="settings-view">
    <h1 class="page-title">设置</h1>

    <div class="settings-section">
      <h2 class="section-title">数据管理</h2>
      <p class="section-desc">导出所有日记和图片为备份文件，或从备份文件恢复数据。</p>

      <div class="action-cards">
        <div class="action-card card">
          <div class="card-icon">📤</div>
          <div class="card-body">
            <h3 class="card-title">导出数据</h3>
            <p class="card-desc">将所有日记内容和上传的图片打包为 .zip 文件下载</p>
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
            <p class="card-desc">从之前导出的 .zip 备份文件恢复数据（将覆盖现有数据）</p>
          </div>
          <button class="btn btn-outline" :disabled="loading" @click="triggerImport">
            {{ loading && action === 'import' ? '导入中...' : '导入' }}
          </button>
          <input ref="fileInputRef" type="file" accept=".zip" class="hidden-input" @change="handleImport" />
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
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { exportData, importData } from '../api'
import { UPLOAD_SIZE_OPTIONS, getMaxUploadSizeMB, setMaxUploadSizeMB } from '../composables/useUploadConfig'

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

async function handleExport(): Promise<void> {
  loading.value = true; action.value = 'export'; message.value = ''
  try { await exportData(); showMessage('导出成功', 'success') }
  catch (error) { showMessage(error instanceof Error ? error.message : '导出失败', 'error') }
  finally { loading.value = false; action.value = '' }
}

function triggerImport(): void { fileInputRef.value?.click() }

async function handleImport(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement; const file = target.files?.[0]
  if (!file) return; loading.value = true; action.value = 'import'; message.value = ''
  try { const r = await importData(file); showMessage(r.message || '导入成功', 'success') }
  catch (error) { showMessage(error instanceof Error ? error.message : '导入失败', 'error') }
  finally { loading.value = false; action.value = ''; target.value = '' }
}

function showMessage(msg: string, type: 'success' | 'error'): void { message.value = msg; messageType.value = type }
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
</style>
