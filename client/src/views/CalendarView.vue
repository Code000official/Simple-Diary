<template>
  <div class="calendar-view">
    <div class="calendar-layout">
      <!-- 左侧日历面板 -->
      <div class="calendar-panel">
        <!-- 日历头部：年月 + 导航 -->
        <div class="calendar-header">
          <button class="btn btn-ghost btn-icon" @click="prevMonth" title="上个月">
            ←
          </button>
          <h2 class="calendar-title">{{ year }}年{{ month }}月</h2>
          <button class="btn btn-ghost btn-icon" @click="nextMonth" title="下个月">
            →
          </button>
          <button class="btn btn-outline btn-sm today-btn" @click="goToday">今天</button>
        </div>

        <!-- 星期标题 -->
        <div class="weekday-header">
          <div v-for="d in weekdays" :key="d" class="weekday-cell">{{ d }}</div>
        </div>

        <!-- 日期网格 -->
        <div class="calendar-grid">
          <div
            v-for="(cell, idx) in calendarCells"
            :key="idx"
            :class="[
              'calendar-cell',
              { 'cell-empty': !cell, 'cell-other': cell && cell.otherMonth, 'cell-today': cell && cell.isToday, 'cell-selected': cell && cell.date === selectedDate, 'cell-has-entries': cell && cell.hasEntries }
            ]"
            @click="cell && selectDate(cell.date)"
          >
            <template v-if="cell">
              <span class="cell-day">{{ cell.day }}</span>
              <div v-if="cell.hasEntries" class="cell-dots">
                <span class="cell-dot"></span>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- 右侧日记面板 -->
      <div class="entries-panel">
        <div v-if="selectedDate" class="day-entries">
          <div class="day-entries-header">
            <h3 class="day-entries-title">{{ formatDayLabel(selectedDate) }}</h3>
            <router-link :to="`/edit?date=${selectedDate}`" class="btn btn-primary btn-sm">
              ✏️ 写日记
            </router-link>
          </div>

          <div v-if="loadingEntries" class="loading">
            <div class="loading-spinner"></div>
          </div>

          <div v-else-if="dayEntries.length === 0" class="empty-state">
            <p>这一天还没有写日记</p>
          </div>

          <div v-else class="entries-list">
            <div
              v-for="entry in dayEntries"
              :key="entry.id"
              class="entry-card card"
            >
              <div class="entry-header">
                <router-link :to="`/detail/${entry.id}`" class="entry-title-link">
                  <h4 class="entry-title">{{ entry.title }}</h4>
                </router-link>
                <span v-if="entry.mood" class="entry-mood">{{ getMoodEmoji(entry.mood) }}</span>
              </div>
              <div class="entry-footer">
                <span class="entry-time">{{ formatTime(entry.created_at) }}</span>
                <router-link :to="`/detail/${entry.id}`" class="btn btn-ghost btn-sm">
                  查看
                </router-link>
              </div>
            </div>
          </div>
        </div>

        <!-- 未选择日期时的提示 -->
        <div v-else class="empty-state hint">
          <p>点击日历上的日期查看当天日记</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { DiaryEntry } from '../types'
import { MOOD_OPTIONS } from '../types'
import { fetchEntriesByMonth } from '../api'

const route = useRoute()

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

const year = ref(new Date().getFullYear())
const month = ref(new Date().getMonth() + 1)
const selectedDate = ref('')
const dayEntries = ref<DiaryEntry[]>([])
const loadingEntries = ref(false)
const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`

/** 按月分组的日记数据 */
const entriesByDate = ref<{ [date: string]: DiaryEntry[] }>({})

/** 生成日历网格 */
const calendarCells = computed(() => {
  const firstDay = new Date(year.value, month.value - 1, 1)
  const lastDay = new Date(year.value, month.value, 0)
  const daysInMonth = lastDay.getDate()
  const startWeekday = firstDay.getDay() // 0=Sun

  // 上个月补齐
  const cells: ({ date: string; day: number; otherMonth: boolean; isToday: boolean; hasEntries: boolean } | null)[] = []
  const prevMonthLast = new Date(year.value, month.value - 1, 0)
  const prevDays = prevMonthLast.getDate()

  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = prevDays - i
    const m = month.value === 1 ? 12 : month.value - 1
    const y = month.value === 1 ? year.value - 1 : year.value
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ date: dateStr, day: d, otherMonth: true, isToday: dateStr === todayStr, hasEntries: !!entriesByDate.value[dateStr] })
  }

  // 当月
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year.value}-${String(month.value).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ date: dateStr, day: d, otherMonth: false, isToday: dateStr === todayStr, hasEntries: !!entriesByDate.value[dateStr] })
  }

  // 下个月补齐（凑满 6 行 = 42 格）
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) {
    const m = month.value === 12 ? 1 : month.value + 1
    const y = month.value === 12 ? year.value + 1 : year.value
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ date: dateStr, day: d, otherMonth: true, isToday: dateStr === todayStr, hasEntries: !!entriesByDate.value[dateStr] })
  }

  return cells
})

function prevMonth(): void {
  if (month.value === 1) {
    month.value = 12
    year.value--
  } else {
    month.value--
  }
}

function nextMonth(): void {
  if (month.value === 12) {
    month.value = 1
    year.value++
  } else {
    month.value++
  }
}

function goToday(): void {
  const now = new Date()
  year.value = now.getFullYear()
  month.value = now.getMonth() + 1
  const todayStr = `${year.value}-${String(month.value).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  selectDate(todayStr)
}

function selectDate(date: string): void {
  selectedDate.value = date
  loadDayEntries(date)
}

async function loadDayEntries(date: string): Promise<void> {
  loadingEntries.value = true
  dayEntries.value = []
  // 先从已缓存的分组中取
  if (entriesByDate.value[date]) {
    dayEntries.value = entriesByDate.value[date]
    loadingEntries.value = false
    return
  }
  loadingEntries.value = false
}

async function loadMonthData(): Promise<void> {
  try {
    const response = await fetchEntriesByMonth(year.value, month.value)
    if (response.success && response.data) {
      entriesByDate.value = response.data
      // 如果当前选中的日期在这个月，刷新 entries
      if (selectedDate.value && entriesByDate.value[selectedDate.value]) {
        dayEntries.value = entriesByDate.value[selectedDate.value]
      } else if (selectedDate.value) {
        dayEntries.value = []
      }
    }
  } catch (error) {
    console.error('加载日历数据失败:', error)
  }
}

function getMoodEmoji(moodValue: string): string {
  const mood = MOOD_OPTIONS.find(m => m.value === moodValue)
  return mood?.emoji || ''
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const weekdaysCN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekdaysCN[d.getDay()]}`
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    const h = d.getHours()
    const m = String(d.getMinutes()).padStart(2, '0')
    const period = h < 12 ? '上午' : '下午'
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${period}${display}:${m}`
  } catch {
    return dateStr
  }
}

// 查询参数中如果有 date 则选中，否则默认选中今天
onMounted(() => {
  if (route.query.date) {
    selectedDate.value = route.query.date as string
  } else {
    const now = new Date()
    selectedDate.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }
  loadMonthData()
})

// 月份变化时重新加载
watch([year, month], () => {
  loadMonthData()
})
</script>

<style scoped>
.calendar-view {
  max-width: 1200px;
}

.calendar-layout {
  display: flex;
  gap: var(--space-xl);
  align-items: flex-start;
}

.calendar-panel {
  flex: 0 0 480px;
  position: sticky;
  top: 80px;
}

.entries-panel {
  flex: 1;
  min-width: 0;
}

/* 日历头部 */
.calendar-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.calendar-title {
  font-family: var(--font-serif);
  font-size: 1.65rem;
  font-weight: 600;
  min-width: 180px;
  text-align: center;
  color: var(--color-text);
}

.btn-icon {
  width: 36px;
  height: 36px;
  font-size: 1.1rem;
  padding: 0;
}

.today-btn {
  margin-left: var(--space-sm);
}

/* 星期标题 */
.weekday-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 4px;
}

.weekday-cell {
  text-align: center;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-muted);
  padding: var(--space-xs) 0;
}

/* 日期网格 */
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: var(--space-xl);
}

.calendar-cell {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: var(--color-bg-card);
  border: 1.5px solid transparent;
  position: relative;
  min-height: 56px;
}

.calendar-cell:hover:not(.cell-empty) {
  border-color: var(--color-primary);
  background: rgba(107, 68, 35, 0.04);
}

.cell-empty {
  background: transparent;
  cursor: default;
}

.cell-other {
  opacity: 0.35;
}

.cell-today .cell-day {
  background: var(--color-primary);
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.cell-selected {
  border-color: var(--color-primary) !important;
  background: rgba(107, 68, 35, 0.08) !important;
}

.cell-day {
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-text);
  line-height: 1;
}

.cell-has-entries .cell-day {
  font-weight: 600;
}

.cell-dots {
  position: absolute;
  bottom: 4px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
}

.cell-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-primary);
}

/* 选中日期的日记列表 */
.day-entries {
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  padding: var(--space-lg);
  min-height: 300px;
}

.day-entries-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--color-border);
}

.day-entries-title {
  font-family: var(--font-serif);
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
}

/* 日记卡片 */
.entries-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.entry-card {
  padding: var(--space-md);
}

.entry-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.entry-title-link {
  text-decoration: none;
  color: inherit;
  flex: 1;
  min-width: 0;
}

.entry-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entry-title-link:hover .entry-title {
  color: var(--color-primary);
}

.entry-mood {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.entry-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.entry-time {
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.loading {
  text-align: center;
  padding: var(--space-lg);
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: var(--space-lg);
  color: var(--color-text-muted);
}

.hint {
  color: var(--color-text-muted);
}

/* 响应式 */
@media (max-width: 860px) {
  .calendar-layout {
    flex-direction: column;
  }

  .calendar-panel {
    flex: none;
    width: 100%;
    position: static;
  }

  .calendar-title {
    font-size: 1.2rem;
    min-width: 120px;
  }

  .calendar-cell {
    min-height: 40px;
  }

  .cell-today .cell-day {
    width: 28px;
    height: 28px;
  }
}
</style>
