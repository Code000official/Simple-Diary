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
            📅 <span>{{ (selectedDateStart || selectedDateEnd) ? dateLabel : '日期' }}<span v-if="!selectedDateStart && !selectedDateEnd" class="hide-sm">筛选</span></span>
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
            🏷️ <span>{{ selectedTags.length > 0 ? `标签 (${selectedTags.length})` : '标签' }}<span v-if="selectedTags.length === 0" class="hide-sm">筛选</span></span>
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
        <div class="filter-btn-wrapper">
          <button
            class="btn btn-outline btn-sm filter-btn"
            @click="toggleSortPicker"
            title="排序方式"
          >
            <svg class="sort-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="4" y1="6" x2="14" y2="6" />
              <line x1="4" y1="12" x2="11" y2="12" />
              <line x1="4" y1="18" x2="8" y2="18" />
              <path d="M17 6v12" />
              <polyline points="14 15 17 18 20 15" />
            </svg>
            <span>{{ sortLabel }}</span>
            <span class="arrow-down">▾</span>
          </button>
          <div v-if="showSortPicker" class="tag-picker sort-picker">
            <div class="tag-picker-header">
              <span class="picker-title">排序方式</span>
              <button class="btn btn-ghost btn-sm" @click="closeSortPicker">✕</button>
            </div>
            <div class="sort-picker-body">
              <button
                v-for="opt in SORT_OPTIONS"
                :key="opt.value"
                :class="['sort-option', { active: currentSort === opt.value }]"
                @click="applySort(opt.value)"
              >
                <span>{{ opt.label }}</span>
                <svg v-if="currentSort === opt.value" class="sort-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <button
          v-if="isManageMode && selectedIds.size > 0"
          class="btn btn-outline btn-sm filter-btn btn-delete"
          @click="deleteSelected"
        >🗑️ 删除 ({{ selectedIds.size }})</button>
        <div v-if="isMobile" class="cols-switch" role="group" aria-label="显示列数">
          <button
            v-for="n in 3"
            :key="n"
            :class="['cols-btn', { active: mobileColumnCount === n }]"
            :title="`${n} 列`"
            :aria-pressed="mobileColumnCount === n"
            @click="setMobileColumnCount(n)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <g v-if="n === 1">
                <rect x="7" y="4" width="10" height="16" rx="1.5" />
              </g>
              <g v-else-if="n === 2">
                <rect x="4" y="4" width="7" height="16" rx="1.5" />
                <rect x="13" y="4" width="7" height="16" rx="1.5" />
              </g>
              <g v-else>
                <rect x="3.5" y="4" width="4.5" height="16" rx="1.5" />
                <rect x="9.75" y="4" width="4.5" height="16" rx="1.5" />
                <rect x="16" y="4" width="4.5" height="16" rx="1.5" />
              </g>
            </svg>
          </button>
        </div>
        <button
          :class="['btn', isManageMode ? 'btn-primary' : 'btn-outline', 'btn-sm', 'manage-btn']"
          @click="toggleManageMode"
        >
          {{ isManageMode ? '完成' : '管理' }}
        </button>
      </div>
    </div>

    <!-- 加载骨架屏：跟随当前布局形态（桌面网格 / 手机按所选列数） -->
    <div v-if="loading" class="skeleton-grid" :style="isMobile ? { gridTemplateColumns: `repeat(${mobileColumnCount}, 1fr)` } : undefined">
      <div v-for="i in (isMobile ? 6 : 12)" :key="i" class="skeleton-card card">
        <div class="skeleton sk-img"></div>
        <div class="sk-body">
          <div class="skeleton sk-line" style="width: 72%"></div>
          <div class="skeleton sk-line" style="width: 92%"></div>
          <div class="skeleton sk-line" style="width: 55%"></div>
        </div>
      </div>
    </div>

    <template v-else>
      <!-- 加载失败：给出明确提示与重试入口，而不是伪装成"没有日记" -->
      <div v-if="loadError" class="error-state">
        <p>日记加载失败，请检查数据存储是否可用</p>
        <button class="btn btn-primary" @click="loadAll">重试</button>
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

      <!-- PC 端：横向自动填充网格，卡片等高对齐 -->
      <div v-else-if="!isMobile" class="card-grid">
        <EntryCard
          v-for="entry in filteredEntries"
          :key="entry.id"
          :entry="entry"
          :resolved-src="resolvedImages.get(entry.id)"
          :manage-mode="isManageMode"
          :selected="selectedIds.has(entry.id)"
          :search-query="searchQuery"
          :date-field="currentSort"
          @open="goDetail(entry.id)"
          @toggle-select="toggleSelection(entry.id)"
          @toggle-fav="toggleFav(entry)"
          @open-image="openLightbox"
          @contextmenu="openContextMenu($event, entry)"
        />
      </div>

      <!-- 手机端：瀑布流，列数可选（1–3），列内纵向排列，卡片高度随内容变化 -->
      <div v-else class="masonry" :style="{ '--masonry-cols': mobileColumnCount }">
        <div v-for="(col, ci) in masonryColumns" :key="ci" class="masonry-col">
          <EntryCard
            v-for="entry in col"
            :key="entry.id"
            mobile
            :entry="entry"
            :resolved-src="resolvedImages.get(entry.id)"
            :manage-mode="isManageMode"
            :selected="selectedIds.has(entry.id)"
            :search-query="searchQuery"
            :date-field="currentSort"
            @open="goDetail(entry.id)"
            @toggle-select="toggleSelection(entry.id)"
            @toggle-fav="toggleFav(entry)"
            @open-image="openLightbox"
            @contextmenu="openContextMenu($event, entry)"
          />
        </div>
      </div>
      </template>
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
import type { DiaryEntry, EntryMeta } from '../types'
import { fetchEntries, deleteEntry, updateEntry, resolveImageUrl } from '../api'
import { getMoodEmoji } from '../utils/format'
import Lightbox from '../components/Lightbox.vue'
import EntryCard from '../components/EntryCard.vue'
import { useDialog } from '../composables/useDialog'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const router = useRouter()
const { show: dialogShow, options: dialogOptions, confirm: dialogConfirm, onConfirm: dialogOnConfirm, onCancel: dialogOnCancel } = useDialog()

/* ==================== 移动端 / 桌面端分布局 ==================== */

/** 与 App.vue 顶栏断点一致：≤768px 走移动端布局 */
const MOBILE_QUERY = '(max-width: 768px)'

const isMobile = ref(window.matchMedia(MOBILE_QUERY).matches)

function onMediaChange(e: MediaQueryListEvent): void {
  isMobile.value = e.matches
}

let mediaQuery: MediaQueryList | null = null

/** 移动端瀑布流列数（1–3），记忆在 localStorage，默认 2 列 */
const MOBILE_COLUMNS_KEY = 'diary_mobile_columns'

const mobileColumnCount = ref(
  Math.min(3, Math.max(1, Number.parseInt(localStorage.getItem(MOBILE_COLUMNS_KEY) || '2', 10) || 2))
)

function setMobileColumnCount(n: number): void {
  mobileColumnCount.value = n
  localStorage.setItem(MOBILE_COLUMNS_KEY, String(n))
}

/* ==================== 排序方式（两端各自记忆） ==================== */

type SortField = 'updatedAt' | 'createdAt'

const SORT_OPTIONS: Array<{ value: SortField; label: string }> = [
  { value: 'updatedAt', label: '编辑时间' },
  { value: 'createdAt', label: '创建时间' },
]

/** 默认与原行为一致：手机端按编辑时间，桌面端按创建时间（置顶始终最前） */
const SORT_DEFAULTS: Record<'mobile' | 'desktop', SortField> = {
  mobile: 'updatedAt',
  desktop: 'createdAt',
}

const SORT_KEY = 'diary_sort'

function loadSortPrefs(): Record<'mobile' | 'desktop', SortField> {
  try {
    const raw = localStorage.getItem(SORT_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      return {
        mobile: parsed.mobile === 'createdAt' || parsed.mobile === 'updatedAt' ? parsed.mobile : SORT_DEFAULTS.mobile,
        desktop: parsed.desktop === 'createdAt' || parsed.desktop === 'updatedAt' ? parsed.desktop : SORT_DEFAULTS.desktop,
      }
    }
  } catch {
    // 解析失败时回退默认值
  }
  return { ...SORT_DEFAULTS }
}

const sortPrefs = ref<Record<'mobile' | 'desktop', SortField>>(loadSortPrefs())

const showSortPicker = ref(false)

/** 当前生效的排序：跟随所在端 */
const currentSort = computed<SortField>(() => isMobile.value ? sortPrefs.value.mobile : sortPrefs.value.desktop)

const sortLabel = computed(() => {
  const opt = SORT_OPTIONS.find(o => o.value === currentSort.value)
  return (isMobile.value ? '' : '排序：') + (opt?.label || '')
})

function setSortPrefs(next: Record<'mobile' | 'desktop', SortField>): void {
  sortPrefs.value = next
  localStorage.setItem(SORT_KEY, JSON.stringify(next))
}

function applySort(field: SortField): void {
  const key = isMobile.value ? 'mobile' : 'desktop'
  setSortPrefs({ ...sortPrefs.value, [key]: field })
  closeSortPicker()
}

function toggleSortPicker(): void {
  if (showSortPicker.value) {
    closeSortPicker()
    return
  }
  showTagPicker.value = false
  showDatePicker.value = false
  showSortPicker.value = true
}

function closeSortPicker(): void {
  showSortPicker.value = false
}

const entries = ref<DiaryEntry[]>([])
const loading = ref(false)
/** 加载失败标记：与"没有日记"区分开，给重试入口 */
const loadError = ref(false)
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
    updatedAt: e.updated_at,
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
    // 置顶之后：按当前端所选的排序字段倒序（默认手机=编辑时间，桌面=创建时间）
    const field = currentSort.value
    return new Date(b[field]).getTime() - new Date(a[field]).getTime()
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

/** 瀑布流分列：按顺序轮流放入各列，保证从左到右的阅读顺序，
 *  列内卡片高度随内容自然变化 */
const masonryColumns = computed<EntryMeta[][]>(() => {
  const n = mobileColumnCount.value
  const cols: EntryMeta[][] = Array.from({ length: n }, () => [])
  filteredEntries.value.forEach((entry, i) => {
    cols[i % n].push(entry)
  })
  return cols
})

const lastYearEntries = computed(() => {
  const now = new Date()
  const target = `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return entriesMeta.value.filter(e => e.createdAt.startsWith(target))
})

onMounted(() => {
  loadAll()
  document.addEventListener('click', handleClickOutside)
  mediaQuery = window.matchMedia(MOBILE_QUERY)
  mediaQuery.addEventListener('change', onMediaChange)
})

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
  document.removeEventListener('click', handleClickOutside)
  mediaQuery?.removeEventListener('change', onMediaChange)
})

function handleClickOutside(e: MouseEvent): void {
  const target = e.target as HTMLElement
  if (showTagPicker.value && !target.closest('.tag-picker') && !target.closest('.filter-btn-wrapper')) {
    closeTagPicker()
  }
  if (showDatePicker.value && !target.closest('.date-picker') && !target.closest('.filter-btn-wrapper')) {
    closeDatePicker()
  }
  if (showSortPicker.value && !target.closest('.sort-picker') && !target.closest('.filter-btn-wrapper')) {
    closeSortPicker()
  }
  if (contextMenu.value.show && !target.closest('.context-menu') && !target.closest('.context-overlay')) {
    closeContextMenu()
  }
}

async function loadAll(): Promise<void> {
  loading.value = true
  loadError.value = false
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
    loadError.value = true
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
  showSortPicker.value = false
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
  showSortPicker.value = false
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
  background: var(--color-primary-wash-1);
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

/* PC 端：横向自动填充网格 */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-md);
}

/* 手机端：瀑布流。列数由 --masonry-cols 控制（1–3），
 * 各列独立纵向排列，卡片高度随内容自然变化 */
.masonry {
  display: grid;
  grid-template-columns: repeat(var(--masonry-cols, 2), 1fr);
  gap: var(--space-sm);
  align-items: start;
}

.masonry-col {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-width: 0;
}

/* 列数切换（仅移动端渲染） */
.cols-switch {
  display: inline-flex;
  align-items: stretch;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-bg-card);
}

.cols-btn {
  width: 44px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.cols-btn + .cols-btn {
  border-left: 1px solid var(--color-border);
}

.cols-btn.active {
  background: var(--color-primary-wash-2);
  color: var(--color-primary);
}

.cols-btn svg {
  width: 18px;
  height: 18px;
}

/* 排序选择器 */
.sort-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.sort-picker {
  min-width: 180px;
  /* 按钮靠近屏幕右缘时向左展开，避免溢出 */
  left: auto;
  right: 0;
}

.sort-picker-body {
  display: flex;
  flex-direction: column;
  padding: var(--space-xs);
}

.sort-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  text-align: left;
  transition: all var(--transition-fast);
}

.sort-option:hover {
  background: var(--color-primary-wash-1);
  color: var(--color-text);
}

.sort-option.active {
  color: var(--color-primary);
  font-weight: 600;
}

.sort-check {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* 加载骨架屏 */
.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-md);
}

.skeleton-card {
  overflow: hidden;
}

.skeleton {
  background: var(--color-bg-input);
  animation: skeleton-pulse 1.4s ease-in-out infinite;
}

.sk-img {
  height: 140px;
}

.sk-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: var(--space-md);
}

.sk-line {
  height: 14px;
  border-radius: var(--radius-sm);
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

/* 加载失败 */
.error-state {
  text-align: center;
  padding: var(--space-2xl);
  color: var(--color-text-secondary);
}

.error-state p {
  margin-bottom: var(--space-md);
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
  background: var(--color-primary-wash-1);
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
  background: var(--color-primary-wash-1);
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
  background: var(--color-primary-wash-1);
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

@media (max-width: 768px) {
  .browse-header {
    margin-bottom: var(--space-md);
  }

  /* 移动端收窄按钮文案：日期筛选 → 日期 */
  .hide-sm {
    display: none;
  }

  /* 搜索占一整行，筛选按钮按自然宽度排列，放不下自动换行 */
  .browse-toolbar {
    gap: var(--space-xs) var(--space-sm);
  }

  .search-input-wrapper {
    width: 100%;
  }

  .search-input {
    width: 100%;
  }

  .filter-btn-wrapper,
  .filter-btn,
  .cols-switch {
    flex: 0 0 auto;
  }

  .filter-btn {
    justify-content: center;
    padding: 0 var(--space-sm);
  }
}
</style>
