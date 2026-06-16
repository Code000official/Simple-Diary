<template>
  <div class="timeline-view">
    <h1 class="page-title">时间线</h1>

    <div v-if="loading" class="loading"><div class="loading-spinner"></div></div>
    <div v-else-if="groups.length === 0" class="empty-state">还没有日记</div>
    <div v-else class="timeline">
      <div v-for="year in groups" :key="year.year" class="year-group">
        <div class="year-header">{{ year.year }}</div>
        <div v-for="month in year.months" :key="month.month" class="month-group">
          <div class="month-header">{{ month.monthName }}</div>
          <div
            v-for="entry in month.entries"
            :key="entry.id"
            class="timeline-entry"
            @click="goDetail(entry.id)"
          >
            <span class="tl-date">{{ formatDate(entry.created_at) }}</span>
            <span class="tl-mood">{{ getMoodEmoji(entry.mood) }}</span>
            <span class="tl-title">{{ entry.title }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { DiaryEntry } from '../types'
import { MOOD_OPTIONS } from '../types'
import { fetchEntries } from '../api'

const router = useRouter()
const entries = ref<DiaryEntry[]>([])
const loading = ref(true)

const groups = computed(() => {
  const byYear: Record<number, { year: number; months: { month: number; monthName: string; entries: DiaryEntry[] }[] }> = {}
  for (const e of entries.value) {
    if (!e.show_in_timeline) continue
    const d = new Date(e.created_at)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    if (!byYear[y]) byYear[y] = { year: y, months: [] }
    let monthGroup = byYear[y].months.find(g => g.month === m)
    if (!monthGroup) {
      const names = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月']
      monthGroup = { month: m, monthName: names[m - 1], entries: [] }
      byYear[y].months.push(monthGroup)
    }
    monthGroup.entries.push(e)
  }
  const result = Object.values(byYear).sort((a, b) => b.year - a.year)
  for (const year of result) {
    year.months.sort((a, b) => b.month - a.month)
  }
  return result
})

onMounted(async () => {
  try {
    const res = await fetchEntries({ limit: 10000 })
    if (res.success && res.data) entries.value = res.data
  } catch (error) {
    console.error('加载失败:', error)
  } finally {
    loading.value = false
  }
})

function goDetail(id: number): void { router.push(`/detail/${id}`) }

function getMoodEmoji(mood: string): string {
  return MOOD_OPTIONS.find(m => m.value === mood)?.emoji || ''
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}
</script>

<style scoped>
.timeline-view {
  max-width: 800px;
}

.page-title {
  font-family: var(--font-serif);
  font-size: 2rem;
  font-weight: 600;
  margin-bottom: var(--space-xl);
  color: var(--color-text);
}

.year-group {
  margin-bottom: var(--space-xl);
}

.year-header {
  font-family: var(--font-serif);
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: var(--space-md);
  padding-bottom: var(--space-sm);
  border-bottom: 2px solid var(--color-primary);
}

.month-group {
  margin-bottom: var(--space-lg);
  margin-left: var(--space-lg);
}

.month-header {
  font-family: var(--font-serif);
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: var(--space-sm);
}

.timeline-entry {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
  margin-bottom: 2px;
}

.timeline-entry:hover {
  background: rgba(107, 68, 35, 0.05);
}

.tl-date {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  width: 60px;
  flex-shrink: 0;
}

.tl-mood {
  font-size: 1rem;
  flex-shrink: 0;
}

.tl-title {
  font-size: 0.95rem;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

@keyframes spin { to { transform: rotate(360deg); } }

.empty-state {
  text-align: center;
  padding: var(--space-2xl);
  color: var(--color-text-muted);
}
</style>
