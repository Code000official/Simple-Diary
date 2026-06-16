<!--
  编辑视图 - 新建和编辑日记
  职责：
  1. 提供日记编辑表单（标题、内容、心情、天气、标签）
  2. 根据路由参数判断是新建还是编辑模式
  3. 编辑模式下加载已有数据填充表单
  4. 表单验证和提交

  设计思路：
  - 新建和编辑共用同一组件，通过 id 参数区分
  - 使用 textarea 实现多行输入，支持回车换行
  - 心情和天气使用 emoji 标签选择，直观友好
  - 标签使用逗号分隔的输入方式，简单易用

  数据流：
  - 路由进入 → 检查是否有 id 参数
  - 有 id → 调用 API 获取日记数据 → 填充表单
  - 无 id → 显示空表单
  - 用户填写表单 → 点击保存 → 调用 API 创建/更新 → 跳转回首页
-->
<template>
  <div class="edit-view">
    <!-- 页面标题 -->
    <h1 class="page-title">
      {{ isEditing ? '编辑日记' : '写日记' }}
    </h1>

    <!-- 加载状态（编辑模式下加载已有数据时显示） -->
    <div v-if="loadingEntry" class="loading">
      <div class="loading-spinner"></div>
      <p>正在加载日记...</p>
    </div>

    <!-- 编辑表单 -->
    <form v-else class="entry-form" @submit.prevent="handleSubmit">
      <div v-if="showDraftBanner" class="draft-banner">
        <span>📝 检测到上次未发布的草稿</span>
        <div class="draft-banner-actions">
          <button class="btn btn-primary btn-sm" @click="restoreDraft">恢复</button>
          <button class="btn btn-outline btn-sm" @click="discardDraft">不要了</button>
        </div>
      </div>
      <div v-if="draftSaving" class="draft-notice draft-saving">
        自动保存中...
      </div>

      <!-- 标题输入 -->
      <div class="form-group">
        <label for="title" class="form-label">标题</label>
        <input
          id="title"
          v-model="form.title"
          type="text"
          class="input title-input"
          placeholder="今天想写点什么..."
          required
        />
      </div>

      <!-- 日期选择 -->
      <div class="form-group">
        <label class="form-label">日期</label>
        <input
          v-model="entryDate"
          type="date"
          class="input date-input"
        />
      </div>

      <!-- 正文内容 -->
      <div class="form-group">
        <label class="form-label">内容</label>
        <MarkdownEditor v-model="form.content" />
      </div>

      <!-- 心情选择 -->
      <div class="form-group">
        <label class="form-label">今天心情</label>
        <div class="option-group">
          <button
            v-for="mood in MOOD_OPTIONS"
            :key="mood.value"
            type="button"
            :class="['option-btn', { active: form.mood === mood.value }]"
            @click="form.mood = mood.value"
          >
            <span class="option-emoji">{{ mood.emoji }}</span>
            <span class="option-label">{{ mood.label }}</span>
          </button>
        </div>
      </div>

      <!-- 天气选择 -->
      <div class="form-group">
        <label class="form-label">天气</label>
        <div class="option-group">
          <button
            v-for="w in WEATHER_OPTIONS"
            :key="w.value"
            type="button"
            :class="['option-btn', { active: form.weather === w.value }]"
            @click="form.weather = w.value"
          >
            <span class="option-emoji">{{ w.emoji }}</span>
            <span class="option-label">{{ w.label }}</span>
          </button>
        </div>
      </div>

      <!-- 标签输入 -->
      <div class="form-group">
        <label for="tags" class="form-label">标签</label>
        <input
          id="tags"
          v-model="form.tags"
          type="text"
          class="input"
          placeholder="多个标签用逗号分隔，如：旅行,美食,摄影"
        />
        <p class="form-hint">用逗号分隔多个标签，方便日后查找</p>
      </div>

      <!-- 时间线显示 -->
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" v-model="showInTimeline" class="checkbox-input" />
          📜 在时间线中显示
        </label>
      </div>

      <!-- 操作按钮 -->
      <div class="form-actions">
        <router-link to="/" class="btn btn-outline">
          取消
        </router-link>
        <button
          type="submit"
          class="btn btn-primary btn-lg"
          :disabled="saving"
        >
          <span v-if="saving" class="loading-spinner-sm"></span>
          {{ saving ? '保存中...' : (isEditing ? '保存修改' : '发布日记') }}
        </button>
      </div>
    </form>
    <ConfirmDialog :show="dialogShow" :options="dialogOptions" @confirm="dialogOnConfirm" @cancel="dialogOnCancel" />
  </div>
</template>

<script setup lang="ts">
/**
 * EditView 组件逻辑
 *
 * 核心功能：
 * 1. 根据路由参数判断新建/编辑模式
 * 2. 编辑模式下加载已有数据
 * 3. 表单数据管理
 * 4. 提交创建/更新请求
 *
 * 设计决策：
 * - 使用 props 接收路由参数（而非 useRoute()）
 *   好处：路由变化时 props 自动更新，无需监听 $route
 * - 表单数据使用响应式对象
 *   好处：任何字段变化都会自动反映到模板
 * - 保存按钮禁用 + loading 状态
 *   好处：防止重复提交
 */

import { ref, computed, reactive, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { CreateEntryRequest } from '../types'
import { MOOD_OPTIONS, WEATHER_OPTIONS } from '../types'
import { fetchEntry, createEntry, updateEntry } from '../api'
import MarkdownEditor from '../components/MarkdownEditor.vue'
import { useDialog } from '../composables/useDialog'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const route = useRoute()
const router = useRouter()
const { show: dialogShow, options: dialogOptions, confirm: dialogConfirm, onConfirm: dialogOnConfirm, onCancel: dialogOnCancel } = useDialog()

/**
 * 路由参数 id
 * - 存在时为编辑模式
 * - 不存在时为新建模式
 * - computed 确保路由变化时自动更新
 */
const entryId = computed(() => {
  const id = route.params.id
  return id ? Number(id) : null
})

/** 是否为编辑模式 */
const isEditing = computed(() => entryId.value !== null)

/* ==================== 响应式状态 ==================== */

/** 表单数据 - 使用 reactive 管理对象内的所有字段 */
const form = reactive<CreateEntryRequest>({
  title: '',
  content: '',
  mood: 'neutral',
  weather: '',
  tags: '',
})

/** 日记日期 */
function defaultDate(): string {
  if (route.query.date) return route.query.date as string
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const entryDate = ref(defaultDate())
const showInTimeline = ref(true)

/** 是否正在加载已有日记数据（仅编辑模式） */
const loadingEntry = ref(false)

/** 是否正在保存 */
const saving = ref(false)

/** 草稿自动保存 */
const DRAFT_KEY = 'diary_draft'
const draftSaving = ref(false)
const showDraftBanner = ref(false)
const draftData = ref<{ title: string; content: string; mood: string; weather: string; tags: string; date: string } | null>(null)
let draftTimer: ReturnType<typeof setTimeout> | null = null

/* ==================== 数据加载 ==================== */

/**
 * 加载已有日记数据（编辑模式）
 *
 * 实现逻辑：
 * 1. 设置 loading 状态
 * 2. 调用 API 获取日记详情
 * 3. 将获取的数据填充到表单
 * 4. 如果日记不存在，跳转回首页
 *
 * 为什么需要这个？
 * 编辑模式下，用户点击"编辑"按钮进入此页面
 * 此时需要从服务器获取日记的最新数据，填充到表单中
 * 这确保了用户编辑的是最新版本的数据
 */
async function loadEntry(): Promise<void> {
  if (!entryId.value) return

  loadingEntry.value = true
  try {
    const response = await fetchEntry(entryId.value)
    if (response.success && response.data) {
      form.title = response.data.title
      form.content = response.data.content
      form.mood = response.data.mood
      form.weather = response.data.weather
      form.tags = response.data.tags
      entryDate.value = response.data.created_at.slice(0, 10)
      showInTimeline.value = response.data.show_in_timeline
    } else {
      // 日记不存在，提示用户并跳转回首页
      await dialogConfirm({ title: '提示', message: '日记不存在', alertOnly: true })
      router.push('/')
    }
  } catch (error) {
    console.error('加载日记失败:', error)
    await dialogConfirm({ title: '操作失败', message: '加载日记失败，请重试', alertOnly: true })
    router.push('/')
  } finally {
    loadingEntry.value = false
  }
}

/* ==================== 草稿自动保存 ==================== */

function saveDraft(): void {
  if (isEditing.value) return
  try {
    const data = { title: form.title, content: form.content, mood: form.mood, weather: form.weather, tags: form.tags, date: entryDate.value }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
  } catch { /* storage full */ }
}

function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY)
}

function checkDraft(): void {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    if (!data || (!data.title && !data.content)) return
    draftData.value = data
    showDraftBanner.value = true
  } catch { /* ignore */ }
}

function restoreDraft(): void {
  const data = draftData.value
  if (!data) return
  form.title = data.title || ''
  form.content = data.content || ''
  form.mood = data.mood || 'neutral'
  form.weather = data.weather || ''
  form.tags = data.tags || ''
  if (data.date) entryDate.value = data.date
  showDraftBanner.value = false
}

function discardDraft(): void {
  clearDraft()
  showDraftBanner.value = false
}

watch([() => form.title, () => form.content, () => form.mood, () => form.weather, () => form.tags, entryDate], () => {
  if (isEditing.value) return
  if (draftTimer) clearTimeout(draftTimer)
  draftSaving.value = true
  draftTimer = setTimeout(() => {
    saveDraft()
    draftSaving.value = false
  }, 500)
}, { deep: true })

/* ==================== 表单提交 ==================== */

/**
 * 处理表单提交
 *
 * 实现逻辑：
 * 1. 防止重复提交（检查 saving 状态）
 * 2. 基础验证（标题不能为空）
 * 3. 根据模式调用不同的 API
 *    - 新建模式：调用 createEntry
 *    - 编辑模式：调用 updateEntry
 * 4. 成功后跳转回首页
 * 5. 失败时显示错误提示
 *
 * 为什么用 async/await？
 * - API 调用是异步操作
 * - async/await 让异步代码看起来像同步代码
 * - 更容易理解执行流程和错误处理
 */
async function handleSubmit(): Promise<void> {
  // 防止重复提交
  if (saving.value) return

  // 表单验证：标题是必填的
  if (!form.title.trim()) {
    await dialogConfirm({ title: '提示', message: '请输入标题', alertOnly: true })
    return
  }

  saving.value = true
  try {
    if (isEditing.value && entryId.value) {
      const response = await updateEntry(entryId.value, { ...form, date: entryDate.value, show_in_timeline: showInTimeline.value } as any)
      if (response.success) {
        clearDraft()
        router.push('/')
      } else {
        await dialogConfirm({ title: '操作失败', message: response.message || '保存失败', alertOnly: true })
      }
    } else {
      const entryData = { ...form, date: entryDate.value, show_in_timeline: showInTimeline.value }
      const response = await createEntry(entryData)
      if (response.success) {
        clearDraft()
        router.push('/')
      } else {
        await dialogConfirm({ title: '操作失败', message: response.message || '创建失败', alertOnly: true })
      }
    }
  } catch (error) {
    console.error('保存日记失败:', error)
    await dialogConfirm({ title: '操作失败', message: '保存失败，请重试', alertOnly: true })
  } finally {
    saving.value = false
  }
}

/* ==================== 生命周期和监听 ==================== */

/**
 * 组件挂载时，如果是编辑模式则加载已有数据
 */
onMounted(() => {
  if (isEditing.value) {
    loadEntry()
  } else {
    checkDraft()
  }
})

onUnmounted(() => {
  if (draftTimer) clearTimeout(draftTimer)
})

/**
 * 监听路由参数变化
 *
 * 为什么需要这个？
 * 用户可能从编辑日记 A 页面，直接通过 URL 跳转到编辑日记 B
 * 此时路由参数变化，但组件没有重新创建
 * 需要重新加载数据并填充表单
 *
 * 场景示例：
 * /edit/1 → /edit/2（用户修改了 URL）
 * 组件复用，但需要重新加载 id=2 的数据
 */
watch(
  () => route.params.id,
  (newId) => {
    if (newId) {
      loadEntry()
    } else {
      form.title = ''
      form.content = ''
      form.mood = 'neutral'
      form.weather = ''
      form.tags = ''
      checkDraft()
    }
  }
)
</script>

<style scoped>
.edit-view {
  max-width: 1000px;
}

.page-title {
  font-family: var(--font-serif);
  font-size: 2rem;
  font-weight: 600;
  margin-bottom: var(--space-xl);
  color: var(--color-text);
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

/* 表单样式 */
.entry-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.form-label {
  font-weight: 500;
  color: var(--color-text);
  font-size: 0.95rem;
}

.label-hint {
  font-weight: 400;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.form-hint {
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

/* 标题输入框特殊样式 */
.title-input {
  font-size: 1.35rem;
  font-family: var(--font-serif);
  padding: var(--space-lg);
}

.date-input {
  max-width: 200px;
  font-size: 0.95rem;
  padding: var(--space-sm) var(--space-md);
}

.draft-notice {
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  background: #FFF8E1;
  color: #8D6E00;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 0.9rem;
  color: var(--color-text);
  cursor: pointer;
}

.checkbox-input {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary);
}

.draft-saving {
  background: #E3F2FD;
  color: #1565C0;
}


/* 心情和天气选项组 */
.option-group {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.option-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: var(--space-md) var(--space-lg);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-card);
  cursor: pointer;
  transition: all var(--transition-fast);
  min-width: 80px;
}

.option-btn:hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
}

.option-btn.active {
  border-color: var(--color-primary);
  background-color: rgba(107, 68, 35, 0.08);
}

.option-emoji {
  font-size: 1.4rem;
  line-height: 1;
}

.option-label {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

/* 操作按钮区 */
.form-actions {
  display: flex;
  gap: var(--space-md);
  justify-content: flex-end;
  padding-top: var(--space-lg);
  border-top: 1px solid var(--color-border);
}

/* 响应式 */
@media (max-width: 640px) {
  .option-group {
    gap: var(--space-xs);
  }

  .option-btn {
    padding: var(--space-xs) var(--space-sm);
    min-width: 56px;
  }
}
</style>
