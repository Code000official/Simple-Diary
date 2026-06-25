<!--
  Markdown 编辑器组件
  核心功能：
  1. 支持 Markdown 语法编辑（标题、加粗、斜体、链接、列表等）
  2. 支持图片上传（点击按钮选择文件 + 粘贴板粘贴）
  3. 实时预览 Markdown 渲染效果
  4. 工具栏快捷操作

  使用场景：
  - 在 EditView 中作为日记正文编辑器
  - 支持 v-model 双向绑定（通过 modelValue + update:modelValue）

  设计决策：
  - 左右分栏：左边编辑，右边预览（桌面端）
  - 移动端：编辑和预览标签切换
  - 图片上传自动插入 Markdown 语法
  - 粘贴图片自动上传并插入
-->
<template>
  <div class="markdown-editor">
    <!-- 工具栏 -->
    <div class="editor-toolbar">
      <!-- 文本格式化按钮组 -->
      <div class="toolbar-group">
        <button type="button" class="toolbar-btn" title="标题 (Ctrl+H)" @click="insertFormat('heading')">
          <span class="toolbar-icon">H</span>
        </button>
        <button type="button" class="toolbar-btn" title="加粗 (Ctrl+B)" @click="insertFormat('bold')">
          <span class="toolbar-icon"><b>B</b></span>
        </button>
        <button type="button" class="toolbar-btn" title="斜体 (Ctrl+I)" @click="insertFormat('italic')">
          <span class="toolbar-icon"><i>I</i></span>
        </button>
        <button type="button" class="toolbar-btn" title="引用" @click="insertFormat('quote')">
          <span class="toolbar-icon">❝</span>
        </button>
        <button type="button" class="toolbar-btn" title="代码" @click="insertFormat('code')">
          <span class="toolbar-icon">‹›</span>
        </button>
        <button type="button" class="toolbar-btn" title="列表" @click="insertFormat('list')">
          <span class="toolbar-icon">☰</span>
        </button>
      </div>

      <!-- 插入按钮组 -->
      <div class="toolbar-group">
        <button type="button" class="toolbar-btn" title="插入链接" @click="insertFormat('link')">
          <span class="toolbar-icon">🔗</span>
        </button>
        <button type="button" class="toolbar-btn" title="插入图片" @click="triggerImageUpload">
          <span class="toolbar-icon">🖼️</span>
        </button>
      </div>

      <!-- 视图切换 -->
      <div class="toolbar-group toolbar-right">
        <button
          type="button"
          :class="['toolbar-btn', 'toolbar-toggle', { active: viewMode === 'edit' }]"
          @click="viewMode = 'edit'"
        >编辑</button>
        <button
          type="button"
          :class="['toolbar-btn', 'toolbar-toggle', { active: viewMode === 'split' }]"
          @click="viewMode = 'split'"
        >分屏</button>
        <button
          type="button"
          :class="['toolbar-btn', 'toolbar-toggle', { active: viewMode === 'preview' }]"
          @click="viewMode = 'preview'"
        >预览</button>
      </div>
    </div>

    <!-- 编辑区域 -->
    <div class="editor-body" :class="`mode-${viewMode}`">
      <!-- 编辑面板 -->
      <div v-show="viewMode !== 'preview'" class="editor-pane">
        <!--
          关键点：
          1. ref="textareaRef" 用于获取 DOM 引用（光标操作、粘贴处理）
          2. @input 触发 v-model 更新
          3. @paste 拦截粘贴事件（检测图片）
          4. @keydown 监听快捷键（Ctrl+B 等）
          5. placeholder 提供输入提示
        -->
        <textarea
          ref="textareaRef"
          :value="modelValue"
          class="editor-textarea"
          placeholder="开始写点什么... 支持 Markdown 语法"
          @input="onInput"
          @paste="onPaste"
          @keydown="onKeydown"
        ></textarea>

        <!-- 图片上传隐藏 input -->
        <!--
          为什么用 hidden input + JS 触发？
          - <input type="file"> 样式难以自定义
          - 用 hidden input + button 的模式更灵活
          - 用户点击工具栏按钮 → JS 触发 hidden input 点击 → 弹出文件选择框
        -->
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          class="hidden-file-input"
          @change="onFileSelect"
        />
      </div>

      <!-- 预览面板 -->
      <div v-show="viewMode !== 'edit'" class="preview-pane">
        <div class="preview-content markdown-body" v-html="renderedContent"></div>
      </div>
    </div>

    <!-- 上传状态提示 -->
    <div v-if="uploading" class="upload-status">
      <div class="upload-spinner"></div>
      <span>正在上传图片...</span>
    </div>

    <ConfirmDialog :show="dialogShow" :options="dialogOptions" @confirm="dialogOnConfirm" @cancel="dialogOnCancel" />
  </div>
</template>

<script setup lang="ts">
/**
 * Markdown 编辑器组件逻辑
 *
 * 核心功能：
 * 1. Markdown 文本编辑
 * 2. 图片上传（文件选择 + 粘贴）
 * 3. 实时 Markdown 预览
 * 4. 快捷键支持
 *
 * Props/Events 设计：
 * - modelValue: 编辑器内容（支持 v-model）
 * - update:modelValue: 内容变化时触发
 *
 * 内部状态：
 * - viewMode: 视图模式（edit/split/preview）
 * - uploading: 是否正在上传图片
 */

import { ref, computed, onMounted, onUnmounted, watch, nextTick, shallowRef } from 'vue'
import { marked } from 'marked'
import { uploadImage, resolveContentImages } from '../api'
import { getMaxUploadSizeBytes, getMaxUploadSizeMB } from '../composables/useUploadConfig'
import { useDialog } from '../composables/useDialog'
import ConfirmDialog from './ConfirmDialog.vue'

/* ==================== Props & Events ==================== */

/**
 * 组件 Props
 *
 * modelValue - 编辑器的内容文本（支持 Markdown 格式）
 * 使用 modelValue + update:modelValue 模式实现 v-model
 */
const props = defineProps<{
  modelValue: string
}>()

/**
 * 组件事件
 *
 * update:modelValue - 内容变化时通知父组件更新
 * 这是 Vue 3 v-model 的标准实现方式
 */
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

/* ==================== 响应式状态 ==================== */

/**
 * textarea DOM 引用
 * 用于：
 * 1. 在光标位置插入文本（工具栏按钮操作）
 * 2. 获取和设置光标位置
 * 3. 拦截粘贴事件
 */
const textareaRef = ref<HTMLTextAreaElement | null>(null)

/**
 * 隐藏的 file input 引用
 * 用于通过 JS 触发文件选择对话框
 */
const fileInputRef = ref<HTMLInputElement | null>(null)

/**
 * 视图模式
 * - 'edit': 纯编辑模式（只显示 textarea）
 * - 'split': 分屏模式（左编辑 + 右预览）
 * - 'preview': 纯预览模式（只显示渲染结果）
 */
const viewMode = ref<'edit' | 'split' | 'preview'>('split')

/**
 * 图片上传状态
 * true 时显示上传中提示，禁用上传按钮
 */
const uploading = ref(false)

const { show: dialogShow, options: dialogOptions, confirm: dialogConfirm, onConfirm: dialogOnConfirm, onCancel: dialogOnCancel } = useDialog()

/* ==================== Markdown 渲染 ==================== */

/**
 * 配置 marked 渲染器
 *
 * 为什么需要配置？
 * - 默认的 marked 配置会添加 <p> 标签包裹
 * - 我们需要自定义一些行为（如图片大小限制）
 * - sanitize 不再需要（我们控制内容来源）
 */
marked.setOptions({
  gfm: true,
  breaks: true,
})

function renderMarkdown(text: string): string {
  if (!text) return '<p class="preview-empty">预览区域 - 在左侧输入 Markdown 内容</p>'
  const html = marked.parse(text) as string
  return html.replace(/<img src="([^"]+)"/g, '<img class="markdown-img" src="$1"')
}

const renderedContent = shallowRef(renderMarkdown(props.modelValue))

let previewTimer: ReturnType<typeof setTimeout> | null = null
watch(() => props.modelValue, (val) => {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(async () => {
    const html = renderMarkdown(val)
    renderedContent.value = await resolveContentImages(html)
  }, 200)
}, { immediate: true })

onUnmounted(() => {
  if (previewTimer) clearTimeout(previewTimer)
})

/* ==================== 输入处理 ==================== */

/**
 * 处理 textarea 输入事件
 *
 * 实现逻辑：
 * 1. 获取 textarea 的当前值
 * 2. 通过 emit 通知父组件更新 modelValue
 *
 * 为什么不用 v-model？
 * - textarea 的 v-model 在某些情况下会有光标跳动问题
 * - 手动处理 input 事件更可控
 * - 特别是在插入图片 Markdown 时，需要精确控制光标位置
 */
function onInput(event: Event): void {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
}

/* ==================== 快捷键处理 ==================== */

/**
 * 处理键盘快捷键
 *
 * 支持的快捷键：
 * - Ctrl+H: 插入标题
 * - Ctrl+B: 加粗
 * - Ctrl+I: 斜体
 *
 * 为什么要拦截这些快捷键？
 * - 提供与常见编辑器一致的操作体验
 * - 用户不需要记忆 Markdown 语法
 * - 快捷键比工具栏按钮更快捷
 *
 * @param event - 键盘事件对象
 */
function onKeydown(event: KeyboardEvent): void {
  // 只处理 Ctrl/Cmd 组合键
  if (!event.ctrlKey && !event.metaKey) return

  switch (event.key.toLowerCase()) {
    case 'h':
      event.preventDefault()  // 阻止浏览器默认行为（如打开历史记录）
      insertFormat('heading')
      break
    case 'b':
      event.preventDefault()
      insertFormat('bold')
      break
    case 'i':
      event.preventDefault()
      insertFormat('italic')
      break
  }
}

/* ==================== 格式化插入 ==================== */

/**
 * 在光标位置插入 Markdown 格式文本
 *
 * 实现逻辑：
 * 1. 获取 textarea 的当前值和光标位置
 * 2. 根据格式类型生成对应的 Markdown 文本
 * 3. 将格式文本插入到光标位置
 * 4. 更新 textarea 的值并通过 emit 通知父组件
 * 5. 恢复光标位置（在插入的文本之后）
 *
 * 为什么需要手动管理光标？
 * - 直接修改 textarea.value 会丢失光标位置
 * - 需要记录插入前的光标位置，插入后恢复
 * - 这是 textarea 操作的标准模式
 *
 * @param format - 格式类型
 */
function insertFormat(format: string): void {
  const textarea = textareaRef.value
  if (!textarea) return

  const start = textarea.selectionStart   // 选区开始位置
  const end = textarea.selectionEnd       // 选区结束位置
  const text = textarea.value
  const selectedText = text.substring(start, end)  // 用户选中的文本

  // 根据格式类型生成 Markdown 文本
  let insert = ''
  let cursorOffset = 0  // 插入后光标应该移动的距离

  switch (format) {
    case 'heading':
      // 标题：在行首插入 ## ，如果已有标题标记则移除
      insert = `## ${selectedText || '标题'}`
      cursorOffset = selectedText ? insert.length : 3
      break
    case 'bold':
      // 加粗：用 ** 包裹选中文本
      insert = `**${selectedText || '加粗文字'}**`
      cursorOffset = selectedText ? insert.length : 2
      break
    case 'italic':
      // 斜体：用 * 包裹选中文本
      insert = `*${selectedText || '斜体文字'}*`
      cursorOffset = selectedText ? insert.length : 1
      break
    case 'quote':
      // 引用：在行首插入 >
      insert = `> ${selectedText || '引用文字'}`
      cursorOffset = selectedText ? insert.length : 2
      break
    case 'code':
      // 代码：用 ` 包裹选中文本
      insert = `\`${selectedText || '代码'}\``
      cursorOffset = selectedText ? insert.length : 1
      break
    case 'list':
      // 列表：在行首插入 - 
      insert = `- ${selectedText || '列表项'}`
      cursorOffset = selectedText ? insert.length : 2
      break
    case 'link':
      // 链接：插入 [文本](url) 格式
      insert = `[${selectedText || '链接文字'}](url)`
      cursorOffset = selectedText ? insert.length - 1 : 1
      break
    case 'image':
      // 图片：插入 ![alt](url) 格式
      insert = `![${selectedText || '图片描述'}](url)`
      cursorOffset = selectedText ? insert.length - 1 : 2
      break
  }

  // 将格式文本插入到光标位置
  // 使用 slice 拼接：光标前的文本 + 插入文本 + 光标后的文本
  const newText = text.slice(0, start) + insert + text.slice(end)
  emit('update:modelValue', newText)

  nextTick(() => {
    textarea.focus()
    textarea.selectionStart = start + cursorOffset
    textarea.selectionEnd = start + cursorOffset
  })
}

/* ==================== 图片上传 ==================== */

/**
 * 触发文件选择对话框
 *
 * 实现逻辑：
 * 1. 通过 ref 获取隐藏的 file input 元素
 * 2. 调用 .click() 方法触发文件选择
 *
 * 为什么不直接用 <input type="file">？
 * - 原生 file input 样式难以自定义
 * - 通过 button + hidden input 模式可以完全控制外观
 */
function triggerImageUpload(): void {
  fileInputRef.value?.click()
}

/**
 * 处理文件选择
 *
 * 实现逻辑：
 * 1. 获取用户选择的文件
 * 2. 验证文件类型和大小
 * 3. 调用上传 API
 * 4. 成功后在光标位置插入 Markdown 图片语法
 *
 * @param event - 文件选择事件
 */
async function onFileSelect(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  // 验证文件类型
  if (!file.type.startsWith('image/')) {
    await dialogConfirm({ title: '提示', message: '请选择图片文件', alertOnly: true })
    return
  }

  // 验证文件大小
  const maxBytes = getMaxUploadSizeBytes()
  if (file.size > maxBytes) {
    const maxMB = getMaxUploadSizeMB()
    await dialogConfirm({ title: '提示', message: maxMB > 0 ? `图片不能超过 ${maxMB}MB` : '当前设置不允许上传图片', alertOnly: true })
    return
  }

  // 上传图片
  await uploadAndInsert(file)

  // 清空 input 的值，这样即使选择同一文件也能触发 change 事件
  target.value = ''
}

/**
 * 处理粘贴事件
 *
 * 为什么要拦截粘贴？
 * - 用户经常从其他应用复制图片（如截图工具）
 * - 直接粘贴图片比选择文件更快捷
 * - 这是现代编辑器的标准功能
 *
 * 实现逻辑：
 * 1. 检查剪贴板中是否有图片数据
 * 2. 如果有，阻止默认粘贴行为
 * 3. 从剪贴板中提取图片文件
 * 4. 上传图片并插入 Markdown 语法
 * 5. 如果没有图片，让默认粘贴行为正常执行（粘贴文本）
 *
 * 剪贴板 API 说明：
 * - clipboardData.items 包含所有粘贴项（文本、图片等）
 * - item.type 可以判断类型（text/plain, image/png 等）
 * - item.getAsFile() 可以将图片项转为 File 对象
 *
 * @param event - 粘贴事件对象
 */
async function onPaste(event: ClipboardEvent): Promise<void> {
  const clipboardData = event.clipboardData
  if (!clipboardData) return

  for (let i = 0; i < clipboardData.items.length; i++) {
    const item = clipboardData.items[i]

    if (item.type.startsWith('image/')) {
      event.preventDefault()

      const file = item.getAsFile()
      if (file) {
          const maxBytes = getMaxUploadSizeBytes()
          if (file.size > maxBytes) {
            const maxMB = getMaxUploadSizeMB()
            await dialogConfirm({ title: '提示', message: maxMB > 0 ? `图片不能超过 ${maxMB}MB` : '当前设置不允许上传图片', alertOnly: true })
            return
          }
          await uploadAndInsert(file)
      }
      return
    }
  }
}

/**
 * 上传图片并插入到编辑器
 *
 * 这是图片上传的核心函数，被文件选择和粘贴共用
 *
 * 实现逻辑：
 * 1. 设置 uploading 状态（显示加载提示）
 * 2. 调用 API 上传图片
 * 3. 成功后生成 Markdown 图片语法
 * 4. 在光标位置插入 Markdown 文本
 * 5. 恢复光标到插入位置之后
 * 6. 错误处理（显示错误提示）
 *
 * @param file - 要上传的图片文件
 */
async function uploadAndInsert(file: File): Promise<void> {
  uploading.value = true

  try {
    // 调用上传 API
    const response = await uploadImage(file)

    if (response.success && response.data) {
      // 生成 Markdown 图片语法
      const imageMarkdown = `![图片](${response.data.url})`

      // 在光标位置插入
      const textarea = textareaRef.value
      if (textarea) {
        const start = textarea.selectionStart
        const text = textarea.value

        // 插入图片 Markdown（前后各加一个换行，确保图片独立成段）
        const newText = text.slice(0, start) + imageMarkdown + text.slice(start)
        emit('update:modelValue', newText)

        nextTick(() => {
          textarea.focus()
          const newPos = start + imageMarkdown.length
          textarea.selectionStart = newPos
          textarea.selectionEnd = newPos
        })
      }
    } else {
      await dialogConfirm({ title: '提示', message: response.message || '图片上传失败', alertOnly: true })
    }
  } catch (error) {
    console.error('图片上传失败:', error)
    await dialogConfirm({ title: '提示', message: '图片上传失败，请重试', alertOnly: true })
  } finally {
    uploading.value = false
  }
}

/* ==================== 生命周期 ==================== */

/**
 * 组件挂载时设置初始光标位置
 */
onMounted(() => {
  if (textareaRef.value) {
    textareaRef.value.focus()
  }
})
</script>

<style scoped>
/* 编辑器容器 */
.markdown-editor {
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-bg-card);
}

/* ==================== 工具栏 ==================== */
.editor-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-bg-input);
  border-bottom: 1px solid var(--color-border);
  flex-wrap: wrap;
}

.toolbar-group {
  display: flex;
  gap: 2px;
}

.toolbar-right {
  margin-left: auto;
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.85rem;
  transition: all var(--transition-fast);
}

.toolbar-btn:hover {
  background: rgba(107, 68, 35, 0.1);
  color: var(--color-text);
}

.toolbar-icon {
  font-size: 0.9rem;
  font-family: var(--font-sans);
}

.toolbar-toggle {
  width: auto;
  padding: 0 var(--space-sm);
  font-size: 0.78rem;
}

.toolbar-toggle.active {
  background: var(--color-primary);
  color: white;
}

/* ==================== 编辑区域 ==================== */
.editor-body {
  display: flex;
  min-height: 500px;
}

.editor-body.mode-edit .editor-pane {
  flex: 1;
}

.editor-body.mode-preview .preview-pane {
  flex: 1;
}

.editor-body.mode-split .editor-pane,
.editor-body.mode-split .preview-pane {
  flex: 1;
}

/* 编辑面板 */
.editor-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border);
}

.mode-split .editor-pane {
  border-right: 1px solid var(--color-border);
}

.mode-preview .editor-pane {
  display: none;
}

.mode-edit .preview-pane {
  display: none;
}

.editor-textarea {
  flex: 1;
  width: 100%;
  padding: var(--space-lg);
  border: none;
  outline: none;
  resize: none;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
  font-size: 0.95rem;
  line-height: 1.8;
  color: var(--color-text);
  background: transparent;
  tab-size: 2;
}

.editor-textarea::placeholder {
  color: var(--color-text-muted);
}

/* 隐藏的文件上传 input */
.hidden-file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

/* ==================== 预览面板 ==================== */
.preview-pane {
  flex: 1;
  padding: var(--space-lg);
  overflow-y: auto;
  background: var(--color-bg-card);
}

.mode-edit .preview-pane {
  display: none;
}

/* 预览区域的 Markdown 样式在全局 CSS 中定义（.markdown-body） */

.preview-empty {
  color: var(--color-text-muted);
  font-style: italic;
}

/* ==================== 上传状态 ==================== */
.upload-status {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-input);
  border-top: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}

.upload-spinner {
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

/* ==================== 响应式 ==================== */
@media (max-width: 768px) {
  .editor-body {
    flex-direction: column;
    min-height: 300px;
  }

  .editor-pane {
    border-right: none;
    border-bottom: 1px solid var(--color-border);
  }

  .mode-split .preview-pane {
    min-height: 200px;
  }

  .toolbar-right {
    width: 100%;
    justify-content: center;
    margin-top: var(--space-xs);
  }
}
</style>
