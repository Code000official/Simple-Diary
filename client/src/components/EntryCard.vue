<!--
  日记卡片组件 — 桌面端与移动端各自独立的呈现
  - 桌面（mobile=false）：横向网格中的卡片，封面固定高度、摘要 3 行，
    hover 上浮
  - 移动（mobile=true）：瀑布流中的紧凑小块，封面按原始比例展示、
    摘要 4 行，无 hover 位移（触屏），高度天然参差
  - 卡片日期由 dateField 决定（跟随列表当前排序字段）
-->
<template>
  <div
    :class="['entry-card-item', 'card', mobile ? 'entry-card-mobile' : 'entry-card-desktop',
      { 'card-selected': selected, 'managing-noimg': mobile && manageMode && !entry.firstImg }]"
    @click="onCardClick"
    @contextmenu.prevent="emit('contextmenu', $event)"
  >
    <div v-if="manageMode" class="card-checkbox" @click.stop>
      <input
        type="checkbox"
        :checked="selected"
        @change="emit('toggle-select')"
      />
    </div>

    <!-- 桌面端保留占位块（原布局）；移动端无图时不渲染，让高度随内容变化 -->
    <div
      v-if="entry.firstImg || !mobile"
      class="card-img"
      @click.stop="onImgClick"
    >
      <img v-if="entry.firstImg" :src="resolvedSrc || entry.firstImg" alt="" loading="lazy" />
    </div>

    <div class="card-body">
      <div class="card-title-row">
        <h2 class="card-title" v-html="highlight(entry.title)"></h2>
        <button
          class="card-fav-btn"
          :class="{ favorited: entry.favorited }"
          @click.stop="manageMode ? emit('toggle-select') : emit('toggle-fav')"
          title="收藏"
        >⭐</button>
      </div>
      <div class="card-meta">
        <span class="card-mood">{{ getMoodEmoji(entry.mood) }}</span>
        <span v-if="entry.tags" class="card-tags">{{ displayTags(entry.tags) }}</span>
        <span class="card-date">{{ formatDate(dateField === 'updatedAt' ? entry.updatedAt : entry.createdAt) }}</span>
      </div>
      <p class="card-excerpt" v-html="highlight(entry.excerpt)"></p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EntryMeta } from '../types'
import { getMoodEmoji, displayTags, formatDateShort as formatDate } from '../utils/format'

interface Props {
  entry: EntryMeta
  /** 已解析的封面图 URL（ObjectURL），为空时回退 entry.firstImg */
  resolvedSrc?: string
  manageMode?: boolean
  selected?: boolean
  mobile?: boolean
  searchQuery?: string
  /** 卡片日期显示哪个时间，跟随当前排序字段 */
  dateField?: 'updatedAt' | 'createdAt'
}

const props = withDefaults(defineProps<Props>(), {
  resolvedSrc: '',
  manageMode: false,
  selected: false,
  mobile: false,
  searchQuery: '',
  dateField: 'createdAt',
})

const emit = defineEmits<{
  (e: 'open'): void
  (e: 'toggle-select'): void
  (e: 'toggle-fav'): void
  (e: 'open-image', src: string): void
  (e: 'contextmenu', event: MouseEvent): void
}>()

function onCardClick(): void {
  if (props.manageMode) {
    emit('toggle-select')
  } else {
    emit('open')
  }
}

function onImgClick(): void {
  if (props.manageMode) {
    emit('toggle-select')
  } else {
    emit('open-image', props.resolvedSrc || props.entry.firstImg)
  }
}

function highlight(text: string): string {
  if (!props.searchQuery || !text) return escapeHtml(text)
  const q = props.searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escaped = escapeHtml(text)
  return escaped.replace(new RegExp(`(${q})`, 'gi'), '<mark>$1</mark>')
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
</script>

<style scoped>
.entry-card-item {
  display: flex;
  flex-direction: column;
  cursor: pointer;
  overflow: hidden;
  transition: all var(--transition-normal);
  position: relative;
  /* 屏外卡片跳过布局与绘制，长列表滚动更顺滑（尤其移动端 WebView）。
   * 规范保证：滚入视口、查找定位、键盘聚焦时会自动恢复渲染，
   * 无障碍树随之完整暴露；瀑布流分列不依赖 JS 测量高度，估算值安全 */
  content-visibility: auto;
  contain-intrinsic-size: auto 200px;
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
  background: color-mix(in srgb, var(--color-bg-card) 90%, transparent);
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
  background: var(--color-warning-bg);
  color: var(--color-warning);
  padding: 0 2px;
  border-radius: 2px;
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

/* ==================== 桌面端：网格卡片 ==================== */

/* 仅在真正有 hover 的设备上启用上浮，避免触屏出现粘滞态 */
@media (hover: hover) {
  .entry-card-desktop:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-md);
  }

  .entry-card-desktop:hover .card-title {
    color: var(--color-primary);
  }
}

/* ==================== 移动端：瀑布流小块 ==================== */

.entry-card-mobile .card-img {
  height: auto;
  max-height: 240px;
}

.entry-card-mobile .card-img img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 240px;
  object-fit: cover;
}

.entry-card-mobile .card-body {
  padding: var(--space-sm) var(--space-md) var(--space-md);
  gap: 6px;
}

.entry-card-mobile .card-title {
  font-size: 0.98rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.entry-card-mobile .card-excerpt {
  font-size: 0.84rem;
  -webkit-line-clamp: 4;
}

.entry-card-mobile .card-fav-btn {
  /* 触屏没有 hover 提示，常态稍微提亮以示可点 */
  opacity: 0.45;
}

/* 移动端无图卡片在管理模式下，标题让开左上角的复选框 */
.managing-noimg .card-title-row {
  padding-left: 28px;
}
</style>
