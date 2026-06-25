<template>
  <div class="browse-view">
    <div class="browse-header">
      <div class="browse-toolbar">
        <div class="search-input-wrapper">
          <input
            v-model="searchQuery"
            type="text"
            class="input search-input"
            placeholder="搜索日记..."
            @input="onSearchInput"
          />
        </div>
        <button
          :class="['btn', 'btn-sm', 'filter-btn', showFavoritedOnly ? 'btn-primary' : 'btn-outline']"
          @click="showFavoritedOnly = !showFavoritedOnly"
          title="仅显示收藏"
        >⭐ {{ showFavoritedOnly ? '已收藏' : '收藏' }}</button>
        <div class="filter-btn-wrapper">
          <button
            class="btn btn-outline btn-sm filter-btn"
            @click="openDatePicker"
          >
            📅 {{ dateLabel }}
            <span class="arrow-down">▾</span>
          </button>
          <div v-if="showDatePicker" class="tag-picker date-picker">
            <div class="tag-picker-header">
              <span class="picker-title">按日期筛选</span>
              <button class="btn btn-ghost btn-sm" @click="closeDatePicker">✕</button>
            </div>
            <div class="date-picker-body">
              <label class="date-field">
                <span class="date-field-label">开始日期</span>
                <input v-model="pendingDateStart" type="date" class="input date-input" />
              </label>
              <label class="date-field">
                <span class="date-field-label">结束日期</span>
                <input v-model="pendingDateEnd" type="date" class="input date-input" />
              </label>
            </div>
            <div class="tag-picker-footer">
              <button class="btn btn-primary btn-sm" @click="clearDates">清除</button>
              <button
                v-if="hasDateChanges"
                class="btn btn-primary btn-sm"
                @click="confirmDates"
              >确认</button>
            </div>
          </div>
        </div>
        <div class="filter-btn-wrapper">
          <button
            class="btn btn-outline btn-sm filter-btn"
            @click="openTagPicker"
          >
            🏷️ {{ selectedTags.length > 0 ? `标签 (${selectedTags.length})` : '标签筛选' }}
            <span class="arrow-down">▾</span>
          </button>
          <div v-if="showTagPicker" class="tag-picker">
            <div class="tag-picker-header">
              <input
                v-model="tagSearchQuery"
                type="text"
                class="input tag-search-input"
                placeholder="搜索标签..."
              />
              <button class="btn btn-ghost btn-sm" @click="closeTagPicker">✕</button>
            </div>
            <div class="tag-picker-body">
              <label
                v-for="tag in filteredTags"
                :key="tag"
                :class="['tag-option', { active: pendingTags.includes(tag) }]"
              >
                <input
                  type="checkbox"
                  :checked="pendingTags.includes(tag)"
                  @change="togglePendingTag(tag)"
                  class="tag-checkbox"
                />
                {{ tag }}
              </label>
              <div v-if="filteredTags.length === 0" class="tag-empty">无匹配标签</div>
            </div>
            <div class="tag-picker-footer">
              <button class="btn btn-primary btn-sm" @click="clearPendingTags">清除</button>
              <button
                v-if="hasTagChanges"
                class="btn btn-primary btn-sm"
                @click="confirmTags"
              >确认</button>
            </div>
          </div>
        </div>
        <button
          v-if="isManageMode && selectedIds.size > 0"
          class="btn btn-outline btn-sm filter-btn btn-delete"
          @click="deleteSelected"
        >🗑️ 删除 ({{ selectedIds.size }})</button>
        <button
          :class="['btn', isManageMode ? 'btn-primary' : 'btn-outline', 'btn-sm', 'manage-btn']"
          @click="toggleManageMode"
        >
          {{ isManageMode ? '完成' : '管理' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
    </div>

    <template v-else>
      <div v-if="lastYearEntries.length > 0 && !searchQuery && !showFavoritedOnly" class="on-this-day card">
        <div class="otd-header">
          <span class="otd-icon">🕰️</span>
          <span class="otd-label">去年的今天</span>
        </div>
        <div class="otd-list">
          <div
            v-for="entry in lastYearEntries"
            :key="entry.id"
            class="otd-entry"
            @click="goDetail(entry.id)"
          >
            <span class="otd-mood">{{ getMoodEmoji(entry.mood) }}</span>
            <span class="otd-title">{{ entry.title }}</span>
          </div>
        </div>
      </div>

      <div v-if="filteredEntries.length === 0" class="empty-state">
      <p>没有找到匹配的日记</p>
    </div>

    <div v-else class="card-grid">
      <div
        v-for="entry in filteredEntries"
        :key="entry.id"
        :class="['card-item card', { 'card-selected': selectedIds.has(entry.id) }]"
        @click="isManageMode ? toggleSelection(entry.id) : goDetail(entry.id)"
        @contextmenu.prevent="openContextMenu($event, entry)"
      >
        <div v-if="isManageMode" class="card-checkbox" @click.stop>
          <input
            type="checkbox"
            :checked="selectedIds.has(entry.id)"
            @change="toggleSelection(entry.id)"
          />
        </div>
        <div class="card-img" @click.stop="isManageMode ? toggleSelection(entry.id) : openLightbox(resolvedImages.get(entry.id) || entry.firstImg)">
          <img v-if="entry.firstImg" :src="resolvedImages.get(entry.id) || entry.firstImg" alt="" />
        </div>
        <div class="card-body">
          <div class="card-title-row">
            <h2 class="card-title" v-html="highlight(entry.title)"></h2>
            <button
              class="card-fav-btn"
              :class="{ favorited: entry.favorited }"
              @click.stop="isManageMode ? toggleSelection(entry.id) : toggleFav(entry)"
              title="收藏"
            >⭐</button>
          </div>
          <div class="card-meta">
            <span class="card-mood">{{ getMoodEmoji(entry.mood) }}</span>
            <span v-if="entry.tags" class="card-tags">{{ displayTags(entry.tags) }}</span>
            <span class="card-date">{{ formatDate(entry.createdAt) }}</span>
          </div>
          <p class="card-excerpt" v-html="highlight(entry.excerpt)"></p>
        </div>
      </div>
    </div>
    </template>

    <teleport to="body">
      <transition name="fade">
        <div
          v-if="contextMenu.show"
          class="context-overlay"
          @click="closeContextMenu"
          @contextmenu.prevent
        >
          <div
            class="context-menu"
            :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
            @click.stop
          >
            <button class="context-item" @click="pinEntry(contextMenu.entry!)">
              📌 {{ contextMenu.entry?.pinnedAt ? '取消置顶' : '置顶' }}
            </button>
            <button class="context-item" @click="toggleFav(contextMenu.entry!)">
              ⭐ {{ contextMenu.entry?.favorited ? '取消收藏' : '收藏' }}
            </button>
            <div class="context-divider"></div>
            <button class="context-item" @click="editEntry(contextMenu.entry!)">
              ✏️ 编辑
            </button>
            <button class="context-item context-danger" @click="deleteEntryFromMenu(contextMenu.entry!)">
              🗑️ 删除
            </button>
          </div>
        </div>
      </transition>
    </teleport>

    <Lightbox :show="!!lightboxSrc" :src="lightboxSrc" @close="closeLightbox" />
    <ConfirmDialog :show="dialogShow" :options="dialogOptions" @confirm="dialogOnConfirm" @cancel="dialogOnCancel" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import type { DiaryEntry } from '../types'
import { MOOD_OPTIONS } from '../types'
import { fetchEntries, deleteEntry, updateEntry, resolveImageUrl } from '../api'
import Lightbox from '../components/Lightbox.vue'
import { useDialog } from '../composables/useDialog'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const router = useRouter()
const { show: dialogShow, options: dialogOptions, confirm: dialogConfirm, onConfirm: dialogOnConfirm, onCancel: dialogOnCancel } = useDialog()

interface EntryMeta {
  id: number
  title: string
  content: string
  mood: string
  tags: string
  tagList: string[]
  firstImg: string
  excerpt: string
  createdAt: string
  favorited: boolean
  pinnedAt: string | null
}

const entries = ref<DiaryEntry[]>([])
const loading = ref(false)
const searchQuery = ref('')
const selectedTags = ref<string[]>([])
const pendingTags = ref<string[]>([])
const showTagPicker = ref(false)
const tagSearchQuery = ref('')

const selectedDateStart = ref('')
const selectedDateEnd = ref('')
const pendingDateStart = ref('')
const pendingDateEnd = ref('')
const showDatePicker = ref(false)
const showFavoritedOnly = ref(false)
const contextMenu = ref({ show: false, x: 0, y: 0, entry: null as EntryMeta | null })
const lightboxSrc = ref('')

const isManageMode = ref(false)
const selectedIds = ref(new Set<number>())

/** 已解析的图片 URL 缓存（entry id → ObjectURL） */
const resolvedImages = ref(new Map<number, string>())

async function resolveFirstImg(id: number, url: string): Promise<void> {
  if (!url || !url.startsWith('/uploads/')) return
  const resolved = await resolveImageUrl(url)
  if (resolved !== url) {
    resolvedImages.value.set(id, resolved)
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null

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
  const result = entries.value.map(e => ({
    id: e.id,
    title: e.title,
    content: e.content,
    mood: e.mood,
    tags: e.tags,
    tagList: e.tags ? e.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    firstImg: extractFirstImage(e.content),
    excerpt: excerptText(e.content),
    createdAt: e.created_at,
    favorited: e.favorited,
    pinnedAt: e.pinned_at,
  }))
  result.sort((a, b) => {
    if (a.pinnedAt && b.pinnedAt) {
      const pa = new Date(a.pinnedAt).getTime()
      const pb = new Date(b.pinnedAt).getTime()
      if (pa !== pb) return pb - pa
    } else if (a.pinnedAt) {
      return -1
    } else if (b.pinnedAt) {
      return 1
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
  return result
})

const allTags = computed(() => {
  const tagSet = new Set<string>()
  for (const entry of entriesMeta.value) {
    for (const tag of entry.tagList) {
      tagSet.add(tag)
    }
  }
  return Array.from(tagSet).sort()
})

const filteredTags = computed(() => {
  if (!tagSearchQuery.value) return allTags.value
  const q = tagSearchQuery.value.toLowerCase()
  return allTags.value.filter(t => t.toLowerCase().includes(q))
})

const hasTagChanges = computed(() => {
  if (pendingTags.value.length !== selectedTags.value.length) return true
  return pendingTags.value.some(t => !selectedTags.value.includes(t))
})

const hasDateChanges = computed(() => {
  return pendingDateStart.value !== selectedDateStart.value || pendingDateEnd.value !== selectedDateEnd.value
})

const dateLabel = computed(() => {
  if (!selectedDateStart.value && !selectedDateEnd.value) return '日期筛选'
  if (selectedDateStart.value && selectedDateEnd.value) return `${selectedDateStart.value.slice(5)} ~ ${selectedDateEnd.value.slice(5)}`
  if (selectedDateStart.value) return `${selectedDateStart.value.slice(5)} 起`
  return `截至 ${selectedDateEnd.value.slice(5)}`
})

const filteredEntries = computed(() => {
  let result = entriesMeta.value

  if (showFavoritedOnly.value) {
    result = result.filter(e => e.favorited)
  }

  if (selectedTags.value.length > 0) {
    result = result.filter(entry =>
      entry.tagList.some(t => selectedTags.value.includes(t))
    )
  }

  if (selectedDateStart.value || selectedDateEnd.value) {
    result = result.filter(entry => {
      const d = entry.createdAt.slice(0, 10)
      if (selectedDateStart.value && d < selectedDateStart.value) return false
      if (selectedDateEnd.value && d > selectedDateEnd.value) return false
      return true
    })
  }

  return result
})

const lastYearEntries = computed(() => {
  const now = new Date()
  const target = `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return entriesMeta.value.filter(e => e.createdAt.startsWith(target))
})

onMounted(() => {
  loadAll()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
  document.removeEventListener('click', handleClickOutside)
})

function handleClickOutside(e: MouseEvent): void {
  const target = e.target as HTMLElement
  if (showTagPicker.value && !target.closest('.tag-picker') && !target.closest('.filter-btn-wrapper')) {
    closeTagPicker()
  }
  if (showDatePicker.value && !target.closest('.date-picker') && !target.closest('.filter-btn-wrapper')) {
    closeDatePicker()
  }
  if (contextMenu.value.show && !target.closest('.context-menu') && !target.closest('.context-overlay')) {
    closeContextMenu()
  }
}

async function loadAll(): Promise<void> {
  loading.value = true
  try {
    const response = await fetchEntries({ search: searchQuery.value || undefined, limit: 1000 })
    if (response.success && response.data) {
      entries.value = response.data
      // 异步解析卡片封面图片
      resolvedImages.value = new Map()
      for (const entry of response.data) {
        const img = extractFirstImage(entry.content)
        if (img && img.startsWith('/uploads/')) {
          resolveFirstImg(entry.id, img)
        }
      }
    }
  } catch (error) {
    console.error('加载失败:', error)
  } finally {
    loading.value = false
  }
}

function onSearchInput(): void {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    loadAll()
  }, 300)
}

function openTagPicker(): void {
  if (showTagPicker.value) {
    closeTagPicker()
    return
  }
  showDatePicker.value = false
  pendingTags.value = [...selectedTags.value]
  tagSearchQuery.value = ''
  showTagPicker.value = true
}

function closeTagPicker(): void {
  showTagPicker.value = false
}

function togglePendingTag(tag: string): void {
  const idx = pendingTags.value.indexOf(tag)
  if (idx === -1) {
    pendingTags.value.push(tag)
  } else {
    pendingTags.value.splice(idx, 1)
  }
}

function clearPendingTags(): void {
  pendingTags.value = []
}

function confirmTags(): void {
  selectedTags.value = [...pendingTags.value]
  showTagPicker.value = false
}

function openDatePicker(): void {
  if (showDatePicker.value) {
    closeDatePicker()
    return
  }
  showTagPicker.value = false
  pendingDateStart.value = selectedDateStart.value
  pendingDateEnd.value = selectedDateEnd.value
  showDatePicker.value = true
}

function closeDatePicker(): void {
  showDatePicker.value = false
}

function clearDates(): void {
  pendingDateStart.value = ''
  pendingDateEnd.value = ''
}

function confirmDates(): void {
  selectedDateStart.value = pendingDateStart.value
  selectedDateEnd.value = pendingDateEnd.value
  showDatePicker.value = false
}

async function toggleFav(entry: EntryMeta): Promise<void> {
  const newVal = !entry.favorited
  try {
    await updateEntry(entry.id, { favorited: newVal })
    entries.value = entries.value.map(e => e.id === entry.id ? { ...e, favorited: newVal } : e)
    console.log(`[收藏] ${entry.title} → ${newVal ? '已收藏' : '取消收藏'}`)
  } catch (error) {
    console.error('[收藏] 操作失败:', error)
  }
}

function openContextMenu(e: MouseEvent, entry: EntryMeta): void {
  contextMenu.value = { show: true, x: e.clientX, y: e.clientY, entry }
}

function closeContextMenu(): void {
  contextMenu.value = { ...contextMenu.value, show: false }
}

function openLightbox(src: string): void {
  lightboxSrc.value = src
}

function closeLightbox(): void {
  lightboxSrc.value = ''
}

async function pinEntry(entry: EntryMeta): Promise<void> {
  const newPinned = entry.pinnedAt ? null : new Date().toISOString()
  try {
    await updateEntry(entry.id, { pinned_at: newPinned })
    entries.value = entries.value.map(e => e.id === entry.id ? { ...e, pinned_at: newPinned } : e).slice()
    console.log(`[置顶] ${entry.title} → ${newPinned ? '已置顶' : '取消置顶'}`)
  } catch (error) {
    console.error('[置顶] 操作失败:', error)
  }
  closeContextMenu()
}

function editEntry(entry: EntryMeta): void {
  router.push(`/edit/${entry.id}`)
  closeContextMenu()
}

async function deleteEntryFromMenu(entry: EntryMeta): Promise<void> {
  closeContextMenu()
  const ok = await dialogConfirm({ title: '删除日记', message: `确定要删除「${entry.title}」吗？将移入回收站，可在设置中恢复。`, confirmText: '删除', confirmClass: 'btn-danger' })
  if (!ok) return
  try {
    await deleteEntry(entry.id)
    entries.value = entries.value.filter(e => e.id !== entry.id)
    console.log(`[删除] ${entry.title}`)
  } catch (error) {
    console.error('[删除] 操作失败:', error)
    await dialogConfirm({ title: '操作失败', message: '删除失败，请稍后再试', alertOnly: true })
  }
}

function toggleManageMode(): void {
  isManageMode.value = !isManageMode.value
  if (!isManageMode.value) {
    selectedIds.value = new Set()
  }
}

function toggleSelection(id: number): void {
  const set = new Set(selectedIds.value)
  if (set.has(id)) {
    set.delete(id)
  } else {
    set.add(id)
  }
  selectedIds.value = set
}

async function deleteSelected(): Promise<void> {
  const ids = Array.from(selectedIds.value)
  const ok = await dialogConfirm({ title: '批量删除', message: `确定要删除选中的 ${ids.length} 篇日记吗？将移入回收站，可在设置中恢复。`, confirmText: '删除', confirmClass: 'btn-danger' })
  if (!ok) return
  let failCount = 0
  for (const id of ids) {
    try {
      await deleteEntry(id)
    } catch (error) {
      console.error('删除失败:', id, error)
      failCount++
    }
  }
  selectedIds.value = new Set()
  isManageMode.value = false
  loadAll()
  if (failCount > 0) {
    await dialogConfirm({ title: '操作完成', message: `删除完成，其中 ${failCount} 篇删除失败，请稍后再试`, alertOnly: true })
  }
}

function goDetail(id: number): void {
  router.push(`/detail/${id}`)
}

function getMoodEmoji(moodValue: string): string {
  const mood = MOOD_OPTIONS.find(m => m.value === moodValue)
  return mood?.emoji || ''
}

function displayTags(tags: string): string {
  const list = tags.split(',').map(t => t.trim()).filter(Boolean)
  return list.slice(0, 2).join(' · ') + (list.length > 2 ? ' …' : '')
}

function highlight(text: string): string {
  if (!searchQuery.value || !text) return escapeHtml(text)
  const q = searchQuery.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escaped = escapeHtml(text)
  return escaped.replace(new RegExp(`(${q})`, 'gi'), '<mark>$1</mark>')
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    const m = d.getMonth() + 1
    const day = d.getDate()
    return `${m}月${day}日`
  } catch {
    return dateStr
  }
}
</script>

<style scoped>


.browse-header {
  margin-bottom: var(--space-xl);
}

.browse-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.search-input-wrapper {
  position: relative;
}

.search-input {
  width: 240px;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-lg);
  font-size: 0.9rem;
}

.filter-btn-wrapper {
  position: relative;
}

.filter-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 0.85rem;
  border-radius: var(--radius-lg);
  height: 40px;
  padding: 0 var(--space-md);
}

.manage-btn {
  margin-left: auto;
  border-radius: var(--radius-lg);
  height: 40px;
}

.btn-delete {
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.btn-delete:hover {
  background: var(--color-danger-light);
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.arrow-up, .arrow-down {
  font-size: 0.7rem;
}

.tag-picker {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 50;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  min-width: 220px;
  max-width: 280px;
  overflow: hidden;
}

.tag-picker-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
  border-bottom: 1px solid var(--color-border);
}

.tag-search-input {
  flex: 1;
  font-size: 0.85rem;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  min-width: 0;
}

.tag-picker-body {
  display: flex;
  flex-direction: column;
  padding: var(--space-xs);
  max-height: 280px;
  overflow-y: auto;
}

.tag-option {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.88rem;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.tag-option:hover {
  background: rgba(107, 68, 35, 0.05);
  color: var(--color-text);
}

.tag-option.active {
  color: var(--color-primary);
  font-weight: 500;
}

.tag-checkbox {
  accent-color: var(--color-primary);
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.tag-empty {
  padding: var(--space-md);
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.date-picker {
  min-width: 260px;
}

.picker-title {
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--color-text);
}

.date-picker-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md);
}

.date-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.date-field-label {
  font-size: 0.82rem;
  color: var(--color-text-secondary);
}

.date-input {
  font-size: 0.88rem;
  padding: var(--space-sm);
  border-radius: var(--radius-sm);
}

.tag-picker-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm);
  border-top: 1px solid var(--color-border);
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-md);
}

.card-item {
  display: flex;
  flex-direction: column;
  cursor: pointer;
  overflow: hidden;
  transition: all var(--transition-normal);
  position: relative;
}

.card-item:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-md);
}

.card-selected {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.card-checkbox {
  position: absolute;
  top: var(--space-sm);
  left: var(--space-sm);
  z-index: 10;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255,255,255,0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
}

.card-checkbox input {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary);
  cursor: pointer;
}

.card-item:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-md);
}

.card-img {
  width: 100%;
  height: 170px;
  flex-shrink: 0;
  overflow: hidden;
  background: var(--color-bg-input);
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-body {
  display: flex;
  flex-direction: column;
  padding: var(--space-md);
  min-width: 0;
  gap: var(--space-xs);
}

.card-title {
  font-family: var(--font-serif);
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.4;
  word-break: break-word;
  flex: 1;
  min-width: 0;
}

.card-title-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-xs);
}

.card-fav-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0;
  line-height: 1;
  opacity: 0.3;
  transition: all var(--transition-fast);
}

.card-fav-btn:hover {
  opacity: 0.7;
  transform: scale(1.15);
}

.card-fav-btn.favorited {
  opacity: 1;
}

mark {
  background: #FFE082;
  color: inherit;
  padding: 0 2px;
  border-radius: 2px;
}

[data-theme="dark"] mark {
  background: #8D6E00;
  color: #FFF;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.card-mood {
  font-size: 1rem;
  flex-shrink: 0;
}

.card-tags {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-date {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  margin-left: auto;
  flex-shrink: 0;
}

.card-excerpt {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
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

.context-overlay {
  position: fixed;
  inset: 0;
  z-index: 900;
}

.context-menu {
  position: fixed;
  z-index: 901;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  min-width: 160px;
  padding: var(--space-xs);
  display: flex;
  flex-direction: column;
}

.context-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.88rem;
  color: var(--color-text);
  text-align: left;
  transition: background var(--transition-fast);
}

.context-item:hover {
  background: rgba(107, 68, 35, 0.06);
}

.context-danger {
  color: var(--color-danger);
}

.context-danger:hover {
  background: var(--color-danger-light);
}

.context-divider {
  height: 1px;
  background: var(--color-border);
  margin: var(--space-xs) 0;
}

.on-this-day {
  padding: var(--space-md) var(--space-lg);
  margin-bottom: var(--space-lg);
  background: rgba(107, 68, 35, 0.03);
  border-left: 3px solid var(--color-primary);
}

.otd-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.otd-icon {
  font-size: 1.2rem;
}

.otd-label {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
}

.otd-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.otd-entry {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.otd-entry:hover {
  background: rgba(107, 68, 35, 0.06);
}

.otd-mood {
  font-size: 0.95rem;
  flex-shrink: 0;
}

.otd-title {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.empty-state {
  text-align: center;
  padding: var(--space-2xl);
  color: var(--color-text-muted);
}

@media (max-width: 450px) {
  .search-input {
    width: 100%;
  }
}
</style>
