<template>
  <div class="stats-view">
    <h1 class="page-title">📊 统计</h1>

    <div v-if="loading" class="stats-grid">
      <div v-for="i in 4" :key="i" class="stat-card card"><div class="skeleton skeleton-num"></div><div class="skeleton skeleton-label"></div></div>
    </div>
    <div v-else>
      <div class="stats-grid">
        <div class="stat-card card">
          <span class="stat-number">{{ stats.total }}</span>
          <span class="stat-label">总篇数</span>
        </div>
        <div class="stat-card card">
          <span class="stat-number">{{ stats.thisMonth }}</span>
          <span class="stat-label">本月</span>
        </div>
        <div class="stat-card card">
          <span class="stat-number">{{ stats.streak }}</span>
          <span class="stat-label">连续天数</span>
        </div>
        <div class="stat-card card">
          <span class="stat-number">{{ stats.totalWords }}</span>
          <span class="stat-label">总字数</span>
        </div>
      </div>

      <div class="mood-dist">
        <h3 class="subsection-title">心情分布</h3>
        <div class="mood-bars">
          <div v-for="m in stats.moodDist" :key="m.value" class="mood-bar-row">
            <span class="mood-bar-label">{{ m.emoji }} {{ m.label }}</span>
            <div class="mood-bar-track">
              <div class="mood-bar-fill" :style="{ width: stats.moodMax > 0 ? (m.count / stats.moodMax * 100) + '%' : '0%' }"></div>
            </div>
            <span class="mood-bar-count">{{ m.count }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { MOOD_OPTIONS } from '../types'
import { fetchEntries } from '../api'
import type { DiaryEntry } from '../types'

const entries = ref<DiaryEntry[]>([])
const loading = ref(true)

const stats = computed(() => {
  const e = entries.value
  const total = e.length
  const now = new Date()
  const thisMonth = e.filter(x => { const d = new Date(x.created_at); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() }).length

  const dates = Array.from(new Set(e.map(x => x.created_at.slice(0, 10)).filter(Boolean))).sort().reverse()
  let streak = 0
  for (let i = 0; i < dates.length; i++) {
    const ex = new Date(now); ex.setDate(ex.getDate() - i)
    const s = `${ex.getFullYear()}-${String(ex.getMonth() + 1).padStart(2, '0')}-${String(ex.getDate()).padStart(2, '0')}`
    if (dates[i] === s) { streak++ } else { break }
  }

  const totalWords = e.reduce((s, x) => s + (x.content?.length || 0) + (x.title?.length || 0), 0)
  const moodCount: Record<string, number> = {}
  for (const x of e) moodCount[x.mood || 'neutral'] = (moodCount[x.mood || 'neutral'] || 0) + 1
  const moodMax = Math.max(...Object.values(moodCount), 1)
  const moodDist = MOOD_OPTIONS.map(m => ({ ...m, count: moodCount[m.value] || 0 }))

  return { total, thisMonth, streak, totalWords, moodDist, moodMax }
})

onMounted(async () => {
  try {
    const res = await fetchEntries({ limit: 10000 })
    if (res.success && res.data) entries.value = res.data
  } catch (error) { console.error(error) } finally { loading.value = false }
})
</script>

<style scoped>
.stats-view { max-width: 800px; }
.page-title { font-family: var(--font-serif); font-size: 2rem; font-weight: 600; margin-bottom: var(--space-xl); color: var(--color-text); }
.loading { padding: var(--space-lg); text-align: center; color: var(--color-text-secondary); }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-md); margin-bottom: var(--space-lg); }
.stat-card { display: flex; flex-direction: column; align-items: center; padding: var(--space-lg); }
.stat-number { font-size: 2rem; font-weight: 700; color: var(--color-primary); font-family: var(--font-serif); }
.stat-label { font-size: 0.85rem; color: var(--color-text-secondary); margin-top: var(--space-xs); }
.subsection-title { font-family: var(--font-serif); font-size: 1.1rem; font-weight: 600; margin-bottom: var(--space-md); color: var(--color-text); }
.mood-dist { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-lg); }
.mood-bars { display: flex; flex-direction: column; gap: var(--space-sm); }
.mood-bar-row { display: flex; align-items: center; gap: var(--space-md); }
.mood-bar-label { width: 80px; font-size: 0.88rem; color: var(--color-text); flex-shrink: 0; }
.mood-bar-track { flex: 1; height: 20px; background: var(--color-bg-input); border-radius: var(--radius-sm); overflow: hidden; }
.mood-bar-fill { height: 100%; background: var(--color-primary); border-radius: var(--radius-sm); transition: width 0.5s ease; opacity: 0.6; }
.mood-bar-count { width: 30px; text-align: right; font-size: 0.85rem; color: var(--color-text-secondary); flex-shrink: 0; }

.skeleton { background: var(--color-bg-input); border-radius: var(--radius-sm); animation: pulse 1.5s ease-in-out infinite; }
.skeleton-num { width: 60px; height: 2rem; margin: 0 auto; }
.skeleton-label { width: 40px; height: 0.85rem; margin: var(--space-sm) auto 0; }
@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
</style>
