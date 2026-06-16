<template>
  <div class="tags-view">
    <h1 class="page-title">🏷️ 标签管理</h1>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else>
      <p class="section-desc">重命名、合并或删除标签。修改会同步更新所有相关日记。</p>
      <div v-if="allTags.length === 0" class="empty-tags">暂无标签</div>
      <div v-else class="tag-manage-list">
        <div v-for="tag in allTags" :key="tag" class="tag-manage-row">
          <span class="tag-manage-name">{{ tag }}</span>
          <div class="tag-manage-actions">
            <button class="btn btn-ghost btn-sm" @click="startRenameTag(tag)">重命名</button>
            <button class="btn btn-ghost btn-sm" @click="mergeTag(tag)">合并</button>
            <button class="btn btn-ghost btn-sm btn-danger-text" @click="deleteTag(tag)">删除</button>
          </div>
        </div>
      </div>
      <div v-if="tagMessage" :class="['message', tagMessageType]">{{ tagMessage }}</div>
      <div v-if="batchProgress.total > 0" class="batch-progress">
        <div class="batch-progress-text">正在处理 {{ batchProgress.done }}/{{ batchProgress.total }} 篇日记...</div>
        <div class="batch-progress-track"><div class="batch-progress-fill" :style="{ width: (batchProgress.total > 0 ? batchProgress.done / batchProgress.total * 100 : 0) + '%' }"></div></div>
      </div>
    </div>
    <ConfirmDialog :show="dialogShow" :options="dialogOptions" @confirm="dialogOnConfirm" @cancel="dialogOnCancel" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fetchEntries, updateEntry } from '../api'
import type { DiaryEntry } from '../types'
import { useDialog } from '../composables/useDialog'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const allEntries = ref<DiaryEntry[]>([])
const loading = ref(true)
const tagMessage = ref('')
const tagMessageType = ref<'success' | 'error'>('success')
const batchProgress = ref({ done: 0, total: 0 })
const { show: dialogShow, options: dialogOptions, confirm: dialogConfirm, onConfirm: dialogOnConfirm, onCancel: dialogOnCancel } = useDialog()

const allTags = computed(() => {
  const set = new Set<string>()
  for (const e of allEntries.value) {
    if (!e.tags) continue
    for (const t of e.tags.split(',').map(t => t.trim()).filter(Boolean)) set.add(t)
  }
  return Array.from(set).sort()
})

function showTagMessage(msg: string, type: 'success' | 'error'): void {
  tagMessage.value = msg; tagMessageType.value = type; setTimeout(() => { tagMessage.value = '' }, 3000)
}

async function reload(): Promise<void> {
  const res = await fetchEntries({ limit: 10000 })
  if (res.success && res.data) allEntries.value = res.data
}

async function batchUpdate(entries: DiaryEntry[], transform: (e: DiaryEntry) => string | null, label: string): Promise<void> {
  batchProgress.value = { done: 0, total: entries.length }
  let ok = 0
  for (const e of entries) {
    try {
      const newTags = transform(e)
      if (newTags !== null && newTags !== e.tags) {
        await updateEntry(e.id, { tags: newTags })
        ok++
      }
    } catch (error) { console.error(`处理失败: ${e.id}`, error) }
    batchProgress.value.done++
  }
  batchProgress.value = { done: 0, total: 0 }
  await reload()
  showTagMessage(`✅ ${label}：完成 ${ok}/${entries.length} 篇`, 'success')
}

async function startRenameTag(oldTag: string): Promise<void> {
  const newName = prompt(`重命名「${oldTag}」为：`, oldTag)
  if (!newName || newName === oldTag) return
  if (newName.includes(',')) { showTagMessage('标签名不能包含逗号', 'error'); return }
  const affected = allEntries.value.filter(e => e.tags?.includes(oldTag))
  await batchUpdate(affected, e => {
    const list = e.tags.split(',').map(t => t.trim())
    return list.map(t => t === oldTag ? newName : t).filter(Boolean).join(',')
  }, `重命名「${oldTag}」→「${newName}」`)
}

async function mergeTag(sourceTag: string): Promise<void> {
  const target = prompt(`将「${sourceTag}」合并到哪个标签？`)
  if (!target || target === sourceTag) return
  if (target.includes(',')) { showTagMessage('标签名不能包含逗号', 'error'); return }
  const affected = allEntries.value.filter(e => e.tags?.includes(sourceTag))
  await batchUpdate(affected, e => {
    const list = e.tags.split(',').map(t => t.trim()).filter(t => t !== sourceTag)
    if (!list.includes(target)) list.push(target)
    return list.join(',')
  }, `合并「${sourceTag}」→「${target}」`)
}

async function deleteTag(tag: string): Promise<void> {
  const ok = await dialogConfirm({ title: '删除标签', message: `确定要删除标签「${tag}」吗？`, confirmText: '删除', confirmClass: 'btn-danger' })
  if (!ok) return
  const affected = allEntries.value.filter(e => e.tags?.includes(tag))
  await batchUpdate(affected, e => {
    return e.tags.split(',').map(t => t.trim()).filter(t => t !== tag).join(',')
  }, `删除「${tag}」`)
}

onMounted(reload)
</script>

<style scoped>
.tags-view { max-width: 800px; }
.page-title { font-family: var(--font-serif); font-size: 2rem; font-weight: 600; margin-bottom: var(--space-xl); color: var(--color-text); }
.loading { padding: var(--space-lg); text-align: center; color: var(--color-text-secondary); }
.section-desc { color: var(--color-text-secondary); font-size: 0.95rem; margin-bottom: var(--space-lg); }
.empty-tags { color: var(--color-text-muted); font-size: 0.9rem; padding: var(--space-md) 0; }
.tag-manage-list { display: flex; flex-direction: column; gap: var(--space-xs); }
.tag-manage-row { display: flex; align-items: center; justify-content: space-between; padding: var(--space-sm) var(--space-md); background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
.tag-manage-name { font-size: 0.95rem; color: var(--color-text); font-weight: 500; }
.tag-manage-actions { display: flex; gap: var(--space-xs); }
.btn-danger-text { color: var(--color-danger) !important; }
.btn-danger-text:hover { background-color: var(--color-danger-light) !important; color: var(--color-danger) !important; }
.batch-progress { margin-top: var(--space-md); }
.batch-progress-text { font-size: 0.85rem; color: var(--color-text-secondary); margin-bottom: var(--space-xs); }
.batch-progress-track { height: 6px; background: var(--color-bg-input); border-radius: 3px; overflow: hidden; }
.batch-progress-fill { height: 100%; background: var(--color-primary); border-radius: 3px; transition: width 0.3s ease; }
.message { margin-top: var(--space-md); padding: var(--space-md); border-radius: var(--radius-sm); font-size: 0.95rem; }
.message.success { background: #E8F5E9; color: #2E7D32; }
.message.error { background: #FFEBEE; color: #C62828; }
</style>
