/**
 * 共享类型定义
 * 定义前后端共用的数据结构，确保类型一致性
 */

/** 日记条目 - 数据库中的完整记录结构 */
export interface DiaryEntry {
  id: number;
  title: string;
  content: string;
  mood: string;
  weather: string;
  tags: string;
  favorited: boolean;
  pinned_at: string | null;
  show_in_timeline: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 创建日记请求体 - 不含 id 和时间戳（由服务器自动生成） */
export interface CreateEntryRequest {
  title: string;
  content: string;
  mood?: string;
  weather?: string;
  tags?: string;
  date?: string;
}

/** 更新日记请求体 - 所有字段可选（只更新提供的字段） */
export interface UpdateEntryRequest {
  title?: string;
  content?: string;
  mood?: string;
  weather?: string;
  tags?: string;
}

/** API 统一响应格式 - 包裹所有接口返回数据 */
export interface ApiResponse<T = any> {
  success: boolean;        // 请求是否成功
  data?: T;                // 成功时返回的数据
  message?: string;        // 失败时的错误信息
  total?: number;          // 列表查询时返回总数（用于分页）
}

/** 日记列表查询参数 */
export interface ListQueryParams {
  search?: string;         // 搜索关键词（匹配标题和内容）
  mood?: string;           // 按心情筛选
  page?: number;           // 页码，默认 1
  limit?: number;          // 每页条数，默认 20
  sort?: 'asc' | 'desc';  // 排序方向，默认 desc（最新在前）
}
