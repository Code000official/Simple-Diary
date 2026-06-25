/** 日记条目 - 与后端 types.ts 保持同步 */
export interface DiaryEntry {
  id: number
  uuid?: string        // 全局唯一 ID，用于跨设备同步去重
  title: string
  content: string
  mood: string
  weather: string
  tags: string
  favorited: boolean
  pinned_at: string | null
  show_in_timeline: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

/** 创建日记请求体 */
export interface CreateEntryRequest {
  title: string
  content: string
  mood?: string
  weather?: string
  tags?: string
  date?: string
  show_in_timeline?: boolean
}

/** 更新日记请求体 */
export interface UpdateEntryRequest {
  title?: string
  content?: string
  mood?: string
  weather?: string
  tags?: string
  date?: string
  favorited?: boolean
  pinned_at?: string | null
  show_in_timeline?: boolean
}

/** API 统一响应格式 */
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  total?: number
}

/** 心情选项 - 用于 UI 展示和数据映射 */
export const MOOD_OPTIONS = [
  { value: 'happy', label: '开心', emoji: '😊' },
  { value: 'excited', label: '兴奋', emoji: '🎉' },
  { value: 'calm', label: '平静', emoji: '😌' },
  { value: 'neutral', label: '一般', emoji: '😐' },
  { value: 'anxious', label: '焦虑', emoji: '😰' },
  { value: 'sad', label: '难过', emoji: '😢' },
] as const

/** 天气选项 */
export const WEATHER_OPTIONS = [
  { value: 'sunny', label: '晴天', emoji: '☀️' },
  { value: 'cloudy', label: '多云', emoji: '☁️' },
  { value: 'rainy', label: '雨天', emoji: '🌧️' },
  { value: 'snowy', label: '雪天', emoji: '❄️' },
  { value: 'windy', label: '大风', emoji: '🌬️' },
] as const
