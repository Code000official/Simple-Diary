/**
 * 通用格式化工具
 *
 * 收编各视图重复实现的日期、心情、天气、标签格式化函数。
 * 所有函数对无效/空输入都安全返回空串或原值，不抛异常。
 */

import { MOOD_OPTIONS, WEATHER_OPTIONS } from '../types'

/** 解析时间字符串，无效时返回 null */
function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? null : d
}

/* ==================== 心情 / 天气 ==================== */

export function getMoodEmoji(mood: string): string {
  return MOOD_OPTIONS.find(m => m.value === mood)?.emoji || ''
}

export function getMoodLabel(mood: string): string {
  return MOOD_OPTIONS.find(m => m.value === mood)?.label || ''
}

export function getWeatherEmoji(weather: string): string {
  return WEATHER_OPTIONS.find(w => w.value === weather)?.emoji || ''
}

export function getWeatherLabel(weather: string): string {
  return WEATHER_OPTIONS.find(w => w.value === weather)?.label || ''
}

/* ==================== 日期 ==================== */

/** 完整中文格式："2024年1月15日 下午2:30" */
export function formatDateFull(dateStr: string | null | undefined): string {
  const d = parseDate(dateStr)
  if (!d) return dateStr || ''
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hours = d.getHours()
  const minutes = d.getMinutes()

  const period = hours < 12 ? '上午' : '下午'
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return `${year}年${month}月${day}日 ${period}${displayHours}:${String(minutes).padStart(2, '0')}`
}

/** 短横线格式："2024-01-15 14:30" */
export function formatDateDash(dateStr: string | null | undefined): string {
  const d = parseDate(dateStr)
  if (!d) return dateStr || ''
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 极短格式："9月2日" */
export function formatDateShort(dateStr: string | null | undefined): string {
  const d = parseDate(dateStr)
  if (!d) return dateStr || ''
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/* ==================== 标签 ==================== */

/** 逗号分隔标签字符串 → 去空去空的数组 */
export function parseTags(tagsString: string | null | undefined): string[] {
  if (!tagsString) return []
  return tagsString.split(',').map(t => t.trim()).filter(Boolean)
}

/** 展示用标签摘要："旅行 · 美食 …"（超过 max 个省略） */
export function displayTags(tags: string, max = 2): string {
  const list = parseTags(tags)
  if (list.length === 0) return ''
  return list.slice(0, max).join(' · ') + (list.length > max ? ' …' : '')
}
