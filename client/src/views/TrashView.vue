<template>
  <div class="trash-view">
    <h1 class="page-title">回收站</h1>
    <p class="page-desc">这里存放已删除的日记，你可以恢复或永久删除它们。</p>

    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
    </div>

    <template v-else>
      <div class="toolbar">
        <div class="toolbar-spacer"></div>
        <button
          v-if="isManageMode && selectedIds.size > 0"
          class="btn btn-primary btn-sm"
          @click="batchRestore"
        >↩ 恢复 ({{ selectedIds.size }})</button>
        <button
          v-if="isManageMode && selectedIds.size > 0"
          class="btn btn-outline btn-sm btn-danger-text"
          @click="batchPermanentDelete"
        >🗑️ 永久删除 ({{ selectedIds.size }})</button>
        <button
          :class="['btn', isManageMode ? 'btn-primary' : 'btn-outline', 'btn-sm']"
          @click="toggleManageMode"
        >{{ isManageMode ? '完成' : '管理' }}</button>
      </div>

      <div v-if="entries.length === 0" class="empty-state">
        <div class="empty-icon">🗑️</div>
        <p>回收站是空的</p>
      </div>

      <div v-else class="card-grid">
        <div
          v-for="entry in entriesMeta"
          :key="entry.id"
          :class="['card-item card', { 'card-selected': selectedIds.has(entry.id) }]"
          @click="isManageMode ? toggleSelection(entry.id) : goDetail(entry.id)"
        >
          <div v-if="isManageMode" class="card-checkbox" @click.stop>
            <input
              type="checkbox"
              :checked="selectedIds.has(entry.id)"
              @change="toggleSelection(entry.id)"
            />
          </div>
          <div v-if="entry.firstImg" class="card-img">
            <img :src="resolvedImages.get(entry.id) || entry.firstImg" alt="" />
          </div>
          <div class="card-body">
            <div class="card-title-row">
              <h2 class="card-title">{{ entry.title }}</h2>
            </div>
            <div class="card-meta">
              <span class="card-mood">{{ getMoodEmoji(entry.mood) }}</span>
              <span v-if="entry.tags" class="card-tags">{{ displayTags(entry.tags) }}</span>
              <span class="card-date">删除于 {{ formatDate(entry.deletedAt) }}</span>
            </div>
            <p class="card-excerpt">{{ entry.excerpt }}</p>
          </div>
          <div v-if="!isManageMode" class="card-actions">
            <button class="btn btn-primary btn-sm" @click.stop="handleRestore(entry.id)">恢复</button>
            <button class="btn btn-outline btn-sm btn-danger-text" @click.stop="handlePermanentDelete(entry.id)">永久删除</button>
          </div>
        </div>
      </div>
    </template>

    <ConfirmDialog :show="dialogShow" :options="dialogOptions" @confirm="dialogOnConfirm" @cancel="dialogOnCancel" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { DiaryEntry } from '../types'
import { MOOD_OPTIONS } from '../types'
import { fetchDeletedEntries, restoreEntry, permanentlyDeleteEntry, resolveImageUrl } from '../api'
import { useDialog } from '../composables/useDialog'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const router = useRouter()
const entries = ref<DiaryEntry[]>([])
const loading = ref(false)
const { show: dialogShow, options: dialogOptions, confirm: dialogConfirm, onConfirm: dialogOnConfirm, onCancel: dialogOnCancel } = useDialog()

const isManageMode = ref(false)
const selectedIds = ref(new Set<number>())

interface TrashEntryMeta {
  id: number
  title: string
  content: string
  mood: string
  tags: string
  tagList: string[]
  firstImg: string
  excerpt: string
  deletedAt: string
}

onMounted(() => load())

const resolvedImages = ref(new Map<number, string>())

async function resolveFirstImg(id: number, url: string): Promise<void> {
  if (!url || !url.startsWith('/uploads/')) return
  const resolved = await resolveImageUrl(url)
  if (resolved !== url) {
    resolvedImages.value.set(id, resolved)
  }
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const res = await fetchDeletedEntries()
    if (res.success && res.data) {
      entries.value = res.data
      resolvedImages.value = new Map()
      for (const entry of res.data) {
        const img = extractFirstImage(entry.content)
        if (img && img.startsWith('/uploads/')) {
          resolveFirstImg(entry.id, img)
        }
      }
    }
  } catch (error) {
    console.error('加载回收站失败:', error)
  } finally {
    loading.value = false
  }
}

async function handleRestore(id: number): Promise<void> {
  try {
    await restoreEntry(id)
    entries.value = entries.value.filter(e => e.id !== id)
  } catch (error) {
    console.error('恢复失败:', error)
    await dialogConfirm({ title: '操作失败', message: '恢复失败，请稍后再试', alertOnly: true })
  }
}

async function handlePermanentDelete(id: number): Promise<void> {
  const entry = entries.value.find(e => e.id === id)
  const ok = await dialogConfirm({ title: '永久删除', message: `确定要永久删除「${entry?.title}」吗？此操作不可撤销。`, confirmText: '永久删除', confirmClass: 'btn-danger' })
  if (!ok) return
  try {
    await permanentlyDeleteEntry(id)
    entries.value = entries.value.filter(e => e.id !== id)
  } catch (error) {
    console.error('永久删除失败:', error)
    await dialogConfirm({ title: '操作失败', message: '永久删除失败，请稍后再试', alertOnly: true })
  }
}

function toggleManageMode(): void {
  isManageMode.value = !isManageMode.value
  if (!isManageMode.value) selectedIds.value = new Set()
}

function toggleSelection(id: number): void {
  const set = new Set(selectedIds.value)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  selectedIds.value = set
}

async function batchRestore(): Promise<void> {
  const ids = Array.from(selectedIds.value)
  const ok = await dialogConfirm({ title: '批量恢复', message: `确定要恢复选中的 ${ids.length} 篇日记吗？`, confirmText: '恢复', confirmClass: 'btn-primary' })
  if (!ok) return
  let failCount = 0
  for (const id of ids) {
    try { await restoreEntry(id) }
    catch { failCount++ }
  }
  selectedIds.value = new Set()
  isManageMode.value = false
  load()
  if (failCount > 0) {
    await dialogConfirm({ title: '操作完成', message: `恢复完成，其中 ${failCount} 篇恢复失败，请稍后再试`, alertOnly: true })
  }
}

async function batchPermanentDelete(): Promise<void> {
  const ids = Array.from(selectedIds.value)
  const ok = await dialogConfirm({ title: '批量永久删除', message: `确定要永久删除选中的 ${ids.length} 篇日记吗？此操作不可撤销。`, confirmText: '永久删除', confirmClass: 'btn-danger' })
  if (!ok) return
  let failCount = 0
  for (const id of ids) {
    try { await permanentlyDeleteEntry(id) }
    catch { failCount++ }
  }
  selectedIds.value = new Set()
  isManageMode.value = false
  load()
  if (failCount > 0) {
    await dialogConfirm({ title: '操作完成', message: `删除完成，其中 ${failCount} 篇删除失败，请稍后再试`, alertOnly: true })
  }
}

function goDetail(id: number): void {
  router.push(`/detail/${id}`)
}

function isHtml(text: string): boolean {
  return /^<[^>]+>/.test(text.trim())
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

function extractFirstImage(content: string): string {
  const mdMatch = content.match(/!\[.*?\]\((.+?)\)/)
  if (mdMatch) return mdMatch[1]
  const htmlMatch = content.match(/<img[^>]+src="([^"]+)"/)
  if (htmlMatch) return htmlMatch[1]
  return ''
}

function excerptText(content: string): string {
  if (isHtml(content)) {
    return stripHtml(content).replace(/\s+/g, ' ').trim()
  }
  return content.replace(/!\[.*?\]\(.+?\)/g, '').replace(/[#*>`~\[\]]/g, '').replace(/\n+/g, ' ').trim()
}

const entriesMeta = computed(() => {
  return entries.value.map(e => ({
    id: e.id,
    title: e.title,
    content: e.content,
    mood: e.mood,
    tags: e.tags,
    tagList: e.tags ? e.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    firstImg: extractFirstImage(e.content),
    excerpt: excerptText(e.content).slice(0, 120),
    deletedAt: e.deleted_at || '',
  })).sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime())
})

function getMoodEmoji(moodValue: string): string {
  const mood = MOOD_OPTIONS.find(m => m.value === moodValue)
  return mood?.emoji || ''
}

function displayTags(tags: string): string {
  const list = tags.split(',').map(t => t.trim()).filter(Boolean)
  return list.slice(0, 2).join(' · ') + (list.length > 2 ? ' …' : '')
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return dateStr
  }
}
</script>

<style scoped>
.trash-view {
  max-width: 1000px;
}

.page-title {
  font-family: var(--font-serif);
  font-size: 2rem;
  font-weight: 600;
  margin-bottom: var(--space-sm);
  color: var(--color-text);
}

.page-desc {
  color: var(--color-text-secondary);
  font-size: 0.95rem;
  margin-bottom: var(--space-xl);
}

.toolbar {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
}

.toolbar-spacer {
  flex: 1;
}

.loading {
  text-align: center;
  padding: var(--space-2xl);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: var(--space-2xl);
  color: var(--color-text-muted);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: var(--space-md);
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: var(--space-md);
}

.card-item {
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: all var(--transition-fast);
  overflow: hidden;
  position: relative;
}

.card-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.card-selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1.5px var(--color-primary);
}

.card-checkbox {
  position: absolute;
  top: var(--space-sm);
  left: var(--space-sm);
  z-index: 1;
}

.card-checkbox input {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary);
  cursor: pointer;
}

.card-img {
  width: 100%;
  height: 160px;
  overflow: hidden;
  background: var(--color-bg-input);
}

.card-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-body {
  flex: 1;
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.card-title-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
}

.card-title {
  flex: 1;
  font-family: var(--font-serif);
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 0.8rem;
  color: var(--color-text-muted);
  flex-wrap: wrap;
}

.card-mood {
  font-size: 0.85rem;
}

.card-tags {
  color: var(--color-primary);
  font-weight: 500;
}

.card-date {
  margin-left: auto;
  white-space: nowrap;
}

.card-excerpt {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-actions {
  display: flex;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md) var(--space-md);
  border-top: 1px solid var(--color-border);
}

.btn-danger-text {
  color: var(--color-danger) !important;
  border-color: var(--color-danger) !important;
}

.btn-danger-text:hover {
  background: var(--color-danger-light) !important;
}
</style>
