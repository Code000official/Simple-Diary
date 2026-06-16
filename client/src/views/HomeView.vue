<!--
  首页视图 - 日记列表
  职责：
  1. 展示所有日记条目（按时间倒序）
  2. 提供关键词搜索功能
  3. 提供心情筛选功能
  4. 支持分页加载
  5. 支持删除日记（带确认对话框）

  数据流：
  - 组件挂载时加载第一页数据
  - 用户输入搜索关键词时，防抖后重新查询
  - 选择心情筛选时，立即重新查询
  - 点击加载更多时，加载下一页数据
-->
<template>
  <div class="home">
    <!-- 搜索和筛选区域 -->
    <div class="search-bar">
      <!-- 搜索输入框 -->
      <div class="search-input-wrapper">
        <span class="search-icon">🔍</span>
        <input
          v-model="searchQuery"
          type="text"
          class="input search-input"
          placeholder="搜索日记标题或内容..."
          @input="onSearchInput"
        />
        <!-- 清除按钮：有搜索内容时才显示 -->
        <button
          v-if="searchQuery"
          class="btn-clear"
          @click="clearSearch"
        >✕</button>
      </div>

      <!-- 心情筛选标签 -->
      <div class="mood-filter">
        <button
          v-for="mood in MOOD_OPTIONS"
          :key="mood.value"
          :class="['mood-tag', { active: selectedMood === mood.value }]"
          :title="mood.label"
          @click="toggleMood(mood.value)"
        >
          {{ mood.emoji }}
        </button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading && entries.length === 0" class="loading">
      <div class="loading-spinner"></div>
      <p>正在加载日记...</p>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!loading && entries.length === 0" class="empty-state">
      <div class="emoji">📝</div>
      <p v-if="searchQuery || selectedMood">没有找到匹配的日记</p>
      <p v-else>还没有写过日记，开始记录你的第一篇吧！</p>
      <router-link to="/edit" class="btn btn-primary btn-lg">
        写第一篇日记
      </router-link>
    </div>

    <!-- 日记列表 -->
    <div v-else class="entry-list">
      <div
        v-for="entry in entries"
        :key="entry.id"
        class="entry-card card"
      >
        <!-- 卡片头部：标题 + 心情 -->
        <div class="entry-header">
          <router-link :to="`/detail/${entry.id}`" class="entry-title-link">
            <h2 class="entry-title">{{ entry.title }}</h2>
          </router-link>
          <span v-if="entry.mood" class="entry-mood" :title="getMoodLabel(entry.mood)">
            {{ getMoodEmoji(entry.mood) }}
          </span>
        </div>

        <!-- 内容预览（截取前 150 个字符） -->
        <router-link :to="`/detail/${entry.id}`" class="entry-content-link">
          <p class="entry-content">{{ truncateContent(entry.content) }}</p>
        </router-link>

        <!-- 底部信息栏：日期、标签、操作按钮 -->
        <div class="entry-footer">
          <div class="entry-meta">
            <!-- 创建时间（格式化为友好的中文格式） -->
            <span class="entry-date">{{ formatDate(entry.created_at) }}</span>

            <!-- 标签列表 -->
            <div v-if="entry.tags" class="entry-tags">
              <span
                v-for="tag in parseTags(entry.tags)"
                :key="tag"
                class="tag"
              >
                {{ tag }}
              </span>
            </div>
          </div>

          <!-- 操作按钮组 -->
          <div class="entry-actions">
            <router-link :to="`/edit/${entry.id}`" class="btn btn-ghost btn-sm">
              编辑
            </router-link>
            <button
              class="btn btn-ghost btn-sm btn-danger-text"
              @click="confirmDelete(entry)"
            >
              删除
            </button>
          </div>
        </div>
      </div>

      <!-- 加载更多按钮 -->
      <div v-if="hasMore" class="load-more">
        <button
          class="btn btn-outline"
          :disabled="loading"
          @click="loadMore"
        >
          <span v-if="loading" class="loading-spinner-sm"></span>
          {{ loading ? '加载中...' : '加载更多' }}
        </button>
      </div>

      <!-- 到底了 -->
      <div v-else-if="entries.length > 0" class="no-more">
        <span>— 到底啦 —</span>
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <teleport to="body">
      <transition name="fade">
        <div
          v-if="showDeleteModal"
          class="modal-overlay"
          @click.self="cancelDelete"
        >
          <div class="modal-content">
            <h3>确认删除</h3>
            <p>确定要删除「{{ deleteTarget?.title }}」吗？此操作不可撤销。</p>
            <div class="modal-actions">
              <button class="btn btn-outline" @click="cancelDelete">取消</button>
              <button class="btn btn-danger" @click="doDelete">删除</button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
    <ConfirmDialog :show="dialogShow" :options="dialogOptions" @confirm="dialogOnConfirm" @cancel="dialogOnCancel" />
  </div>
</template>

<script setup lang="ts">
/**
 * HomeView 组件逻辑
 *
 * 核心功能：
 * 1. 日记列表的加载和展示
 * 2. 搜索和筛选（防抖处理）
 * 3. 分页加载
 * 4. 删除操作（带确认对话框）
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { DiaryEntry } from '../types'
import { MOOD_OPTIONS } from '../types'
import { fetchEntries, deleteEntry } from '../api'
import { useDialog } from '../composables/useDialog'
import ConfirmDialog from '../components/ConfirmDialog.vue'

/* ==================== 响应式状态 ==================== */

/** 日记列表数据 */
const entries = ref<DiaryEntry[]>([])

/** 加载状态（true 表示正在加载中） */
const loading = ref(false)

/** 搜索关键词 */
const searchQuery = ref('')

/** 当前选中的心情筛选 */
const selectedMood = ref('')

/** 当前页码（从 1 开始） */
const currentPage = ref(1)

/** 每页条数 */
const pageSize = 20

/** 后端返回的总数 */
const totalCount = ref(0)

/** 是否还有更多数据可加载 */
const hasMore = computed(() => entries.value.length < totalCount.value)

/** 删除确认对话框的显示状态 */
const showDeleteModal = ref(false)

/** 待删除的日记条目 */
const deleteTarget = ref<DiaryEntry | null>(null)

const { show: dialogShow, options: dialogOptions, confirm: dialogConfirm, onConfirm: dialogOnConfirm, onCancel: dialogOnCancel } = useDialog()

/** 防抖定时器 ID */
let searchTimer: ReturnType<typeof setTimeout> | null = null

/* ==================== 数据加载方法 ==================== */

/**
 * 加载日记列表
 *
 * 实现逻辑：
 * 1. 设置 loading 状态（显示加载动画）
 * 2. 调用 API 获取数据
 * 3. 根据是首次加载还是翻页，决定替换还是追加数据
 * 4. 更新总数（用于分页判断）
 * 5. 错误处理：显示错误提示
 *
 * @param append - 是否追加数据（false = 替换，true = 追加到列表末尾）
 */
async function loadEntries(append = false): Promise<void> {
  loading.value = true
  try {
    const response = await fetchEntries({
      search: searchQuery.value || undefined,
      mood: selectedMood.value || undefined,
      page: currentPage.value,
      limit: pageSize,
    })

    if (response.success && response.data) {
      if (append) {
        // 追加模式：将新数据追加到现有列表末尾（加载更多时使用）
        entries.value = [...entries.value, ...response.data]
      } else {
        // 替换模式：直接替换现有列表（首次加载或搜索时使用）
        entries.value = response.data
      }
      totalCount.value = response.total || 0
    }
  } catch (error) {
    console.error('加载日记列表失败:', error)
    await dialogConfirm({ title: '提示', message: '加载日记失败，请检查网络连接', alertOnly: true })
  } finally {
    loading.value = false
  }
}

/**
 * 加载下一页数据
 *
 * 实现逻辑：
 * 1. 页码 +1
 * 2. 以 append 模式加载（追加到现有列表）
 */
function loadMore(): void {
  currentPage.value++
  loadEntries(true)
}

/* ==================== 搜索和筛选 ==================== */

/**
 * 搜索输入处理（带防抖）
 *
 * 为什么需要防抖？
 * 用户快速输入时，每个字符变化都会触发搜索
 * 如果不做防抖，会发出大量请求（如输入"旅行"会发出 3 次请求）
 * 防抖确保用户停止输入 300ms 后才发起请求
 *
 * 防抖原理：
 * 1. 每次输入变化时，清除之前的定时器
 * 2. 设置新的 300ms 定时器
 * 3. 只有定时器到期（用户停止输入 300ms）才执行搜索
 */
function onSearchInput(): void {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  searchTimer = setTimeout(() => {
    currentPage.value = 1  // 搜索时重置到第一页
    loadEntries(false)     // 替换模式加载
  }, 300)
}

/**
 * 清除搜索内容并重新加载
 */
function clearSearch(): void {
  searchQuery.value = ''
  currentPage.value = 1
  loadEntries(false)
}

/**
 * 切换心情筛选
 *
 * 实现逻辑：
 * 1. 如果点击已选中的心情，取消筛选（再次点击取消）
 * 2. 否则设置新的心情筛选
 * 3. 重置页码并重新加载
 *
 * @param mood - 心情标识符
 */
function toggleMood(mood: string): void {
  selectedMood.value = selectedMood.value === mood ? '' : mood
  currentPage.value = 1
  loadEntries(false)
}

/* ==================== 删除操作 ==================== */

/**
 * 显示删除确认对话框
 *
 * @param entry - 要删除的日记
 */
function confirmDelete(entry: DiaryEntry): void {
  deleteTarget.value = entry
  showDeleteModal.value = true
}

/**
 * 取消删除（关闭对话框）
 */
function cancelDelete(): void {
  showDeleteModal.value = false
  deleteTarget.value = null
}

/**
 * 执行删除操作
 *
 * 实现逻辑：
 * 1. 调用 API 删除日记
 * 2. 成功后从本地列表中移除该条目（避免重新请求）
 * 3. 更新总数
 * 4. 关闭对话框
 */
async function doDelete(): Promise<void> {
  if (!deleteTarget.value) return

  try {
    const response = await deleteEntry(deleteTarget.value.id)
    if (response.success) {
      // 从本地列表中移除（乐观更新，提升用户体验）
      entries.value = entries.value.filter(e => e.id !== deleteTarget.value!.id)
      totalCount.value--
    }
  } catch (error) {
    console.error('删除日记失败:', error)
    await dialogConfirm({ title: '提示', message: '删除失败，请重试', alertOnly: true })
  } finally {
    cancelDelete()
  }
}

/* ==================== 工具函数 ==================== */

/**
 * 获取心情对应的 emoji
 * @param moodValue - 心情标识符
 * @returns 对应的 emoji 字符
 */
function getMoodEmoji(moodValue: string): string {
  const mood = MOOD_OPTIONS.find(m => m.value === moodValue)
  return mood?.emoji || ''
}

/**
 * 获取心情的中文标签
 * @param moodValue - 心情标识符
 * @returns 对应的中文名称
 */
function getMoodLabel(moodValue: string): string {
  const mood = MOOD_OPTIONS.find(m => m.value === moodValue)
  return mood?.label || ''
}

/**
 * 截断内容文本
 * 将长文本截取到指定长度，超出部分用省略号代替
 * 用于列表页的内容预览，避免单条日记占据过多空间
 *
 * @param content - 原始文本
 * @param maxLength - 最大长度（默认 150 字符）
 * @returns 截断后的文本
 */
function truncateContent(content: string, maxLength = 150): string {
  if (!content) return ''
  // 去除换行和多余空格，只保留纯文本
  const cleanContent = content.replace(/\n/g, ' ').trim()
  if (cleanContent.length <= maxLength) return cleanContent
  return cleanContent.substring(0, maxLength) + '...'
}

/**
 * 格式化日期字符串
 * 将 ISO 格式的时间戳转为友好的中文日期格式
 *
 * 示例：
 *   输入: "2024-01-15 14:30:00"
 *   输出: "2024年1月15日 下午2:30"
 *
 * 实现逻辑：
 * 1. 尝试解析输入字符串为 Date 对象
 * 2. 按照中文习惯格式化（年月日 + 时分）
 * 3. 根据小时数判断上午/下午
 * 4. 解析失败时返回原始字符串（容错处理）
 *
 * @param dateString - ISO 格式的时间字符串
 * @returns 格式化后的中文日期字符串
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    // 检查日期是否有效
    if (isNaN(date.getTime())) return dateString

    const year = date.getFullYear()
    const month = date.getMonth() + 1  // getMonth() 返回 0-11
    const day = date.getDate()
    const hours = date.getHours()
    const minutes = date.getMinutes()

    // 将 24 小时制转换为 12 小时制（上午/下午）
    const period = hours < 12 ? '上午' : '下午'
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours

    return `${year}年${month}月${day}日 ${period}${displayHours}:${String(minutes).padStart(2, '0')}`
  } catch {
    return dateString
  }
}

/**
 * 解析标签字符串
 * 将逗号分隔的标签字符串转为数组，并过滤空标签
 *
 * 示例：
 *   输入: "旅行, 美食,, 摄影"
 *   输出: ["旅行", "美食", "摄影"]
 *
 * @param tagsString - 逗号分隔的标签字符串
 * @returns 标签数组
 */
function parseTags(tagsString: string): string[] {
  if (!tagsString) return []
  return tagsString
    .split(',')
    .map(tag => tag.trim())      // 去除每个标签的首尾空格
    .filter(tag => tag.length > 0) // 过滤空字符串
}

/* ==================== 生命周期 ==================== */

/**
 * 组件挂载时加载第一页数据
 *
 * onMounted 的优势：
 * - 确保 DOM 已渲染完毕
 * - 适合发起异步请求（数据加载后直接更新视图）
 */
onMounted(() => {
  loadEntries()
})

/**
 * 组件卸载时清理防抖定时器
 *
 * 为什么需要清理？
 * - 如果用户在搜索输入后立即离开页面
 * - 定时器到期后仍会尝试调用 API
 * - 这可能导致内存泄漏或意外请求
 */
onUnmounted(() => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
})
</script>

<style scoped>
/* 搜索栏 */
.search-bar {
  margin-bottom: var(--space-lg);
}

.search-input-wrapper {
  position: relative;
  margin-bottom: var(--space-md);
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 1rem;
  pointer-events: none;
}

.search-input {
  padding-left: 38px;
  padding-right: 38px;
  border-radius: var(--radius-lg);
  font-size: 1rem;
}

.btn-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 50%;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-clear:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: var(--color-text);
}

/* 心情筛选标签 */
.mood-filter {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.mood-tag {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--color-border);
  background: var(--color-bg-card);
  font-size: 1.2rem;
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mood-tag:hover {
  border-color: var(--color-primary);
  transform: scale(1.1);
}

.mood-tag.active {
  border-color: var(--color-primary);
  background-color: rgba(107, 68, 35, 0.1);
  transform: scale(1.1);
}

/* 加载状态 */
.loading {
  text-align: center;
  padding: var(--space-2xl);
  color: var(--color-text-secondary);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto var(--space-md);
}

.loading-spinner-sm {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 日记卡片列表 */
.entry-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.entry-card {
  padding: var(--space-xl);
  transition: all var(--transition-normal);
}

.entry-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

/* 卡片头部 */
.entry-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-sm);
}

.entry-title-link {
  text-decoration: none;
  color: inherit;
  flex: 1;
}

.entry-title {
  font-family: var(--font-serif);
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.4;
}

.entry-title-link:hover .entry-title {
  color: var(--color-primary);
}

.entry-mood {
  font-size: 1.5rem;
  flex-shrink: 0;
  line-height: 1;
}

/* 内容预览 */
.entry-content-link {
  text-decoration: none;
  color: inherit;
  display: block;
  margin-bottom: var(--space-md);
}

.entry-content {
  color: var(--color-text-secondary);
  font-size: 0.95rem;
  line-height: 1.7;
}

.entry-content-link:hover .entry-content {
  color: var(--color-text);
}

/* 底部信息栏 */
.entry-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--color-border);
}

.entry-meta {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.entry-date {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.entry-tags {
  display: flex;
  gap: var(--space-xs);
  flex-wrap: wrap;
}

.tag {
  padding: 2px 8px;
  background-color: var(--color-bg-input);
  color: var(--color-text-secondary);
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
}

.entry-actions {
  display: flex;
  gap: var(--space-xs);
}

.btn-danger-text {
  color: var(--color-danger) !important;
}

.btn-danger-text:hover {
  background-color: var(--color-danger-light) !important;
  color: var(--color-danger) !important;
}

/* 加载更多 */
.load-more {
  text-align: center;
  padding: var(--space-lg);
}

.no-more {
  text-align: center;
  padding: var(--space-lg);
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

/* 响应式 */
@media (max-width: 640px) {
  .entry-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .entry-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
