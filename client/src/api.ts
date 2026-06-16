/**
 * API 服务层
 * 封装所有与后端的 HTTP 通信
 *
 * 为什么需要单独的 api.ts？
 * - 集中管理所有 HTTP 请求，方便维护和修改
 * - 统一处理请求/响应格式转换
 * - 统一处理错误（将来可扩展：token 刷新、请求重试等）
 * - 组件中只需调用函数，不需要关心 fetch 的细节
 */

import type { DiaryEntry, CreateEntryRequest, UpdateEntryRequest, ApiResponse } from './types'
import { getMaxUploadSizeMB } from './composables/useUploadConfig'

/** API 基础路径 */
const API_BASE = '/api'

/**
 * 通用请求函数
 * 所有 API 调用都通过这个函数发起，确保：
 * 1. Content-Type 始终为 JSON
 * 2. 统一处理响应解析和错误
 * 3. 将来添加认证头时只需改这一个地方
 *
 * @param url - 请求路径（不含 /api 前缀）
 * @param options - fetch 的配置选项
 * @returns 解析后的 API 响应数据
 * @throws 如果网络错误或响应格式异常
 */
async function request<T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  // 解析响应体为 JSON
  const data = await response.json()

  // HTTP 状态码非 2xx 时，也作为错误处理
  if (!response.ok) {
    throw new Error(data.message || `请求失败 (${response.status})`)
  }

  return data as ApiResponse<T>
}

/**
 * 获取日记列表
 *
 * 支持的筛选和分页参数：
 * @param params.search - 关键词搜索
 * @param params.mood - 按心情筛选
 * @param params.page - 页码
 * @param params.limit - 每页条数
 *
 * 实现逻辑：
 * 1. 将参数对象转为 URLSearchParams（自动处理编码和空值过滤）
 * 2. 发起 GET 请求
 * 3. 返回包含 data 和 total 的响应
 */
export async function fetchEntries(params: {
  search?: string
  mood?: string
  page?: number
  limit?: number
} = {}): Promise<ApiResponse<DiaryEntry[]>> {
  // 过滤掉值为 undefined 的参数，避免 URL 中出现 ?search= 这样的空值
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value))
    }
  })

  const queryString = searchParams.toString()
  return request<DiaryEntry[]>(`/entries${queryString ? `?${queryString}` : ''}`)
}

/**
 * 获取单条日记详情
 *
 * @param id - 日记 ID
 * @returns 包含完整日记数据的响应
 */
export async function fetchEntry(id: number): Promise<ApiResponse<DiaryEntry>> {
  return request<DiaryEntry>(`/entries/${id}`)
}

/**
 * 创建新日记
 *
 * @param entry - 日记数据（标题和内容必填）
 * @returns 新创建的日记（含服务器生成的 id 和时间戳）
 */
export async function createEntry(entry: CreateEntryRequest): Promise<ApiResponse<DiaryEntry>> {
  return request<DiaryEntry>('/entries', {
    method: 'POST',
    body: JSON.stringify(entry),
  })
}

/**
 * 更新日记
 *
 * @param id - 要更新的日记 ID
 * @param entry - 要更新的字段（部分更新，未提供的字段保持不变）
 * @returns 更新后的完整日记数据
 */
export async function updateEntry(id: number, entry: UpdateEntryRequest): Promise<ApiResponse<DiaryEntry>> {
  return request<DiaryEntry>(`/entries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(entry),
  })
}

/**
 * 删除日记
 *
 * @param id - 要删除的日记 ID
 * @returns 删除结果
 */
export async function deleteEntry(id: number): Promise<ApiResponse> {
  return request(`/entries/${id}`, {
    method: 'DELETE',
  })
}

/**
 * 获取回收站中的日记列表
 */
export async function fetchDeletedEntries(): Promise<ApiResponse<DiaryEntry[]>> {
  return request<DiaryEntry[]>('/entries/deleted')
}

/**
 * 从回收站恢复日记
 */
export async function restoreEntry(id: number): Promise<ApiResponse<DiaryEntry>> {
  return request<DiaryEntry>(`/entries/${id}/restore`, { method: 'POST' })
}

/**
 * 永久删除日记
 */
export async function permanentlyDeleteEntry(id: number): Promise<ApiResponse> {
  return request(`/entries/${id}/permanent`, { method: 'DELETE' })
}

/**
 * 上传图片文件
 *
 * 为什么单独一个函数？
 * - 上传使用 FormData 格式，不是 JSON
 * - 不能设置 Content-Type 为 application/json（浏览器会自动设置 multipart 边界）
 * - 与普通 API 请求的逻辑不同
 *
 * @param file - 要上传的文件对象（来自 <input type="file"> 或剪贴板）
 * @returns 包含文件访问 URL 的响应
 *
 * 实现逻辑：
 * 1. 创建 FormData 对象并附加文件
 * 2. 发送 POST 请求到 /api/upload
 * 3. 返回服务器返回的文件 URL
 *
 * FormData 说明：
 * - FormData 是浏览器原生 API，用于构建 multipart/form-data 请求
 * - 它会自动设置正确的 Content-Type 和 boundary
 * - 服务器端使用 multer 中间件解析这种格式
 */
/**
 * 获取指定年月的日记（按日期分组）
 *
 * @param year - 年份
 * @param month - 月份（1-12）
 * @returns 按 "YYYY-MM-DD" 分组的日记
 */
export async function fetchEntriesByMonth(year: number, month: number): Promise<ApiResponse<{ [date: string]: DiaryEntry[] }>> {
  return request<{ [date: string]: DiaryEntry[] }>(`/entries/calendar?year=${year}&month=${month}`)
}

/**
 * 导出所有数据（日记 + 图片）为 zip 包
 */
export async function exportData(): Promise<void> {
  const response = await fetch(`${API_BASE}/export`)
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: '导出失败' }))
    throw new Error(err.message || '导出失败')
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `diary-export-${new Date().toISOString().slice(0, 10)}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 导入备份 zip 包
 * @param file - 备份文件
 */
export async function importData(file: File): Promise<ApiResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(`${API_BASE}/import`, {
    method: 'POST',
    body: formData,
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.message || '导入失败')
  }
  return data as ApiResponse
}

export async function uploadImage(file: File): Promise<ApiResponse<{ url: string; filename: string }>> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: {
      'x-upload-max-size': String(getMaxUploadSizeMB()),
    },
    body: formData,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || `上传失败 (${response.status})`)
  }

  return data as ApiResponse<{ url: string; filename: string }>
}
