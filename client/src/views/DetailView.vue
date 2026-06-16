<!--
  详情视图 - 查看单篇日记
  职责：
  1. 展示日记的完整内容
  2. 显示元信息（心情、天气、标签、时间）
  3. 提供编辑和删除操作入口
  4. 删除操作带确认对话框

  数据流：
  - 组件挂载时根据 id 从 API 加载日记数据
  - 数据加载完成后渲染到页面
  - 删除成功后跳转回首页
-->
<template>
  <div class="detail-view">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <p>正在加载日记...</p>
    </div>

    <!-- 错误状态（日记不存在） -->
    <div v-else-if="!entry" class="empty-state">
      <div class="emoji">🔍</div>
      <p>日记不存在或已被删除</p>
      <router-link to="/" class="btn btn-primary">返回首页</router-link>
    </div>

    <!-- 日记详情 -->
    <article v-else class="entry-detail">
      <!-- 顶部导航：返回按钮 + 操作按钮 -->
      <div class="detail-nav">
        <router-link to="/" class="btn btn-ghost">
          ← 返回列表
        </router-link>
        <div class="detail-actions">
          <router-link :to="`/edit/${entry.id}`" class="btn btn-outline btn-sm">
            编辑
          </router-link>
          <button
            class="btn btn-ghost btn-sm btn-danger-text"
            @click="confirmDelete"
          >
            删除
          </button>
        </div>
      </div>

      <!-- 标题区域 -->
      <header class="entry-header">
        <h1 class="entry-title">{{ entry.title }}</h1>
        <div class="entry-meta">
          <!-- 心情和天气信息 -->
          <div class="meta-tags">
            <span v-if="entry.mood && entry.mood !== 'neutral'" class="meta-tag">
              {{ getMoodEmoji(entry.mood) }} {{ getMoodLabel(entry.mood) }}
            </span>
            <span v-if="entry.weather" class="meta-tag">
              {{ getWeatherEmoji(entry.weather) }} {{ getWeatherLabel(entry.weather) }}
            </span>
          </div>

          <!-- 时间信息 -->
          <div class="entry-times">
            <span class="time-item">
              <span class="time-label">创建于</span>
              <span class="time-value">{{ formatDate(entry.created_at) }}</span>
            </span>
            <span v-if="entry.updated_at !== entry.created_at" class="time-item">
              <span class="time-label">更新于</span>
              <span class="time-value">{{ formatDate(entry.updated_at) }}</span>
            </span>
          </div>
        </div>
      </header>

      <!-- 标签列表 + 时间线开关 -->
      <div class="entry-tags">
        <span
          v-for="tag in parseTags(entry.tags)"
          :key="tag"
          class="tag"
        >
          #{{ tag }}
        </span>
        <button
          class="timeline-toggle"
          :class="{ hidden: !entry.show_in_timeline }"
          @click="toggleTimelineVis"
        >
          {{ entry.show_in_timeline ? '📜 在时间线中' : '📜 已隐藏' }}
        </button>
      </div>

      <!-- 正文内容 - Markdown 渲染 -->
      <div class="entry-content markdown-body" v-html="renderedContent" @click="onContentClick"></div>
    </article>

    <Lightbox :show="!!lightboxSrc" :src="lightboxSrc" @close="lightboxSrc = ''" />
    <ConfirmDialog :show="dialogShow" :options="dialogOptions" @confirm="dialogOnConfirm" @cancel="dialogOnCancel" />
  </div>
</template>

<script setup lang="ts">
/**
 * DetailView 组件逻辑
 *
 * 核心功能：
 * 1. 根据路由参数 id 从 API 加载日记数据
 * 2. 展示日记的完整内容和元信息
 * 3. 提供编辑和删除操作
 * 4. 删除操作带确认对话框
 *
 * 设计决策：
 * - 使用 props 接收路由参数（而非 useRoute()）
 * - 内容使用 pre-wrap 显示（保留用户格式）
 * - 使用 v-html 不安全，改用文本直接渲染
 */

import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked'
import type { DiaryEntry } from '../types'
import { MOOD_OPTIONS, WEATHER_OPTIONS } from '../types'
import { fetchEntry, deleteEntry, updateEntry } from '../api'
import { useDialog } from '../composables/useDialog'
import Lightbox from '../components/Lightbox.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const route = useRoute()
const router = useRouter()

const { show: dialogShow, options: dialogOptions, confirm: dialogConfirm, onConfirm: dialogOnConfirm, onCancel: dialogOnCancel } = useDialog()

/** 日记 ID（从路由参数获取） */
const entryId = computed(() => Number(route.params.id))

marked.setOptions({ gfm: true, breaks: true })

function mdToHtml(text: string): string {
  if (!text) return ''
  if (/^<[^>]+>/.test(text.trim())) return text
  return (marked.parse(text) as string)
    .replace(/<img src="([^"]+)"/g, '<img class="markdown-img" src="$1"')
}

/**
 * 渲染日记内容：HTML 直接输出，旧 Markdown 实时转换
 */
const renderedContent = computed(() => {
  if (!entry.value?.content) return ''
  return mdToHtml(entry.value.content)
})

/* ==================== 响应式状态 ==================== */

/** 日记数据 */
const entry = ref<DiaryEntry | null>(null)

/** 加载状态 */
const loading = ref(false)

/** 防止重复删除 */
const deleting = ref(false)

/** 图片预览 */
const lightboxSrc = ref('')

/* ==================== 数据加载 ==================== */

/**
 * 加载日记详情
 *
 * 实现逻辑：
 * 1. 设置 loading 状态
 * 2. 调用 API 获取日记数据
 * 3. 成功时更新 entry 引用
 * 4. 失败时显示错误状态
 */
async function loadEntry(): Promise<void> {
  loading.value = true
  entry.value = null

  try {
    const response = await fetchEntry(entryId.value)
    if (response.success && response.data) {
      entry.value = response.data
    }
  } catch (error) {
    console.error('加载日记详情失败:', error)
  } finally {
    loading.value = false
  }
}

/* ==================== 删除操作 ==================== */

/**
 * 确认并执行删除操作
 *
 * 实现逻辑：
 * 1. 弹出确认对话框
 * 2. 用户确认后调用 API 删除日记
 * 3. 成功后跳转回首页
 * 4. 失败时弹出错误提示
 */
async function confirmDelete(): Promise<void> {
  if (!entry.value || deleting.value) return
  const ok = await dialogConfirm({
    title: '确认删除',
    message: `确定要删除「${entry.value.title}」吗？将移入回收站，可在设置中恢复。`,
    confirmText: '删除',
    confirmClass: 'btn-danger'
  })
  if (!ok) return
  await doDelete()
}

async function doDelete(): Promise<void> {
  if (!entry.value || deleting.value) return
  deleting.value = true

  try {
    const response = await deleteEntry(entry.value.id)
    if (response.success) {
      router.push('/')
    } else {
      await dialogConfirm({ title: '操作失败', message: response.message || '删除失败', alertOnly: true })
    }
  } catch (error) {
    console.error('删除日记失败:', error)
    await dialogConfirm({ title: '操作失败', message: '删除失败，请重试', alertOnly: true })
  } finally {
    deleting.value = false
  }
}

function onContentClick(e: MouseEvent): void {
  const img = (e.target as HTMLElement).closest('img')
  if (img) {
    lightboxSrc.value = img.src
  }
}

async function toggleTimelineVis(): Promise<void> {
  if (!entry.value) return
  const newVal = !entry.value.show_in_timeline
  try {
    await updateEntry(entry.value.id, { show_in_timeline: newVal })
    entry.value.show_in_timeline = newVal
    console.log(`[时间线] ${entry.value.title} → ${newVal ? '显示' : '隐藏'}`)
  } catch (error) {
    console.error('[时间线] 切换失败:', error)
  }
}

/* ==================== 工具函数 ==================== */

/**
 * 获取心情 emoji
 * @param moodValue - 心情标识符
 * @returns 对应的 emoji
 */
function getMoodEmoji(moodValue: string): string {
  const mood = MOOD_OPTIONS.find(m => m.value === moodValue)
  return mood?.emoji || ''
}

/**
 * 获取心情中文标签
 * @param moodValue - 心情标识符
 * @returns 中文名称
 */
function getMoodLabel(moodValue: string): string {
  const mood = MOOD_OPTIONS.find(m => m.value === moodValue)
  return mood?.label || ''
}

/**
 * 获取天气 emoji
 * @param weatherValue - 天气标识符
 * @returns 对应的 emoji
 */
function getWeatherEmoji(weatherValue: string): string {
  const w = WEATHER_OPTIONS.find(item => item.value === weatherValue)
  return w?.emoji || ''
}

/**
 * 获取天气中文标签
 * @param weatherValue - 天气标识符
 * @returns 中文名称
 */
function getWeatherLabel(weatherValue: string): string {
  const w = WEATHER_OPTIONS.find(item => item.value === weatherValue)
  return w?.label || ''
}

/**
 * 格式化日期为中文友好格式
 *
 * 示例：
 *   输入: "2024-01-15 14:30:00"
 *   输出: "2024年1月15日 下午2:30"
 *
 * @param dateString - ISO 格式时间字符串
 * @returns 格式化后的中文日期
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString

    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hours = date.getHours()
    const minutes = date.getMinutes()

    const period = hours < 12 ? '上午' : '下午'
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours

    return `${year}年${month}月${day}日 ${period}${displayHours}:${String(minutes).padStart(2, '0')}`
  } catch {
    return dateString
  }
}

/**
 * 解析标签字符串为数组
 *
 * @param tagsString - 逗号分隔的标签字符串
 * @returns 过滤空值后的标签数组
 */
function parseTags(tagsString: string): string[] {
  if (!tagsString) return []
  return tagsString
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
}

/* ==================== 生命周期和监听 ==================== */

/**
 * 组件挂载时加载日记数据
 */
onMounted(() => {
  loadEntry()
})

/**
 * 监听路由参数变化
 * 当从日记 A 的详情页跳转到日记 B 的详情页时
 * 组件复用，需要重新加载数据
 */
watch(
  () => route.params.id,
  () => {
    loadEntry()
  }
)
</script>

<style scoped>
.detail-view {
  max-width: 800px;
}

/* 加载和空状态 */
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

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 日记详情容器 */
.entry-detail {
  background-color: var(--color-bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--color-border);
  padding: var(--space-xl);
}

/* 顶部导航 */
.detail-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-xl);
}

.detail-actions {
  display: flex;
  gap: var(--space-sm);
}

.btn-danger-text {
  color: var(--color-danger) !important;
}

.btn-danger-text:hover {
  background-color: var(--color-danger-light) !important;
  color: var(--color-danger) !important;
}

/* 标题区域 */
.entry-header {
  margin-bottom: var(--space-lg);
}

.entry-title {
  font-family: var(--font-serif);
  font-size: 2rem;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.4;
  margin-bottom: var(--space-md);
}

.entry-meta {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.meta-tags {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.meta-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  background-color: var(--color-bg-input);
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.entry-times {
  display: flex;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.time-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.time-label {
  color: var(--color-text-muted);
}

.time-value {
  color: var(--color-text-secondary);
}

/* 标签列表 */
.entry-tags {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
  margin-bottom: var(--space-lg);
  padding-bottom: var(--space-lg);
  border-bottom: 1px solid var(--color-border);
}

.tag {
  padding: var(--space-xs) var(--space-sm);
  background-color: var(--color-bg-input);
  color: var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-weight: 500;
}

.timeline-toggle {
  margin-left: auto;
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-card);
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.timeline-toggle:hover {
  border-color: var(--color-primary);
  color: var(--color-text);
}

.timeline-toggle.hidden {
  opacity: 0.5;
}

/* 正文内容 */
.entry-content {
  padding-top: var(--space-sm);
  min-height: 100px;
}

/* 响应式 */
@media (max-width: 640px) {
  .entry-detail {
    padding: var(--space-md);
  }

  .entry-title {
    font-size: 1.5rem;
  }

  .entry-times {
    flex-direction: column;
  }
}
</style>
