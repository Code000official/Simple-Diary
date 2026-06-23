/**
 * API 路由模块
 * 定义所有 RESTful API 端点的处理逻辑
 *
 * API 设计原则：
 * - RESTful 风格：用 HTTP 动词表达操作类型（GET/POST/PUT/DELETE）
 * - 统一响应格式：所有接口返回 { success, data/message, total } 结构
 * - 无状态：不使用 session，每个请求独立处理（将来可扩展 JWT 认证）
 *
 * 与数据库模块的交互：
 * - 不直接操作数据库文件，而是通过 database.ts 提供的函数
 * - 这样做的好处：如果将来切换到 SQLite 或其他数据库
 *   只需要修改 database.ts，路由代码不需要改动
 */

import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import {
  queryEntries,
  getEntryById,
  createEntry,
  updateEntry,
  deleteEntry,
  queryEntriesByMonth,
  queryDeletedEntries,
  restoreEntry,
  permanentlyDeleteEntry,
} from './database';
import type { DiaryEntry, ApiResponse } from './types';

const router = Router();

/**
 * GET /api/entries
 * 获取日记列表，支持搜索、筛选、排序和分页
 *
 * 查询参数：
 *   search  - 关键词搜索（模糊匹配标题和内容）
 *   mood    - 按心情筛选
 *   page    - 页码（从 1 开始，默认 1）
 *   limit   - 每页条数（默认 20，最大 100）
 *   sort    - 排序方向（asc 或 desc，默认 desc）
 *
 * 实现逻辑：
 * 1. 从 URL 查询参数中提取所有筛选条件
 * 2. 将字符串参数转为数字，并设置合理范围
 * 3. 调用 queryEntries 函数获取数据
 * 4. 包装成统一的 API 响应格式返回
 *
 * 为什么限制 limit 最大 100？
 * - 防止客户端请求过多数据导致内存和带宽问题
 * - 对于日记应用，单页 20 条已经足够
 */
router.get('/entries', (req: Request, res: Response) => {
  const { search, mood, page = '1', limit = '20', sort = 'desc' } = req.query;

  // 参数类型转换和验证
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const sortDirection = sort === 'asc' ? 'asc' : 'desc';

  try {
    // 调用数据库查询函数
    const { data, total } = queryEntries({
      search: search as string | undefined,
      mood: mood as string | undefined,
      page: pageNum,
      limit: limitNum,
      sort: sortDirection,
    });

    // 构建成功响应
    const response: ApiResponse<DiaryEntry[]> = {
      success: true,
      data,
      total,
    };

    res.json(response);
  } catch (error) {
    console.error('[API] 获取日记列表失败:', error);

    const response: ApiResponse = {
      success: false,
      message: '获取日记列表失败',
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/entries/calendar?year=2024&month=6
 * 获取指定年月的日记，按日期分组
 *
 * 查询参数：
 *   year  - 年份
 *   month - 月份（1-12）
 */
router.get('/entries/calendar', (req: Request, res: Response) => {
  const { year, month } = req.query;

  const yearNum = Number(year);
  const monthNum = Number(month);

  if (!yearNum || !monthNum || monthNum < 1 || monthNum > 12) {
    const response: ApiResponse = {
      success: false,
      message: '参数错误：需要有效的 year 和 month',
    };
    res.status(400).json(response);
    return;
  }

  try {
    const grouped = queryEntriesByMonth(yearNum, monthNum);

    const response: ApiResponse<{ [date: string]: DiaryEntry[] }> = {
      success: true,
      data: grouped,
    };

    res.json(response);
  } catch (error) {
    console.error('[API] 获取日历数据失败:', error);

    const response: ApiResponse = {
      success: false,
      message: '获取日历数据失败',
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/entries/deleted
 * 获取回收站中的日记列表
 */
router.get('/entries/deleted', (req: Request, res: Response) => {
  try {
    const data = queryDeletedEntries();

    const response: ApiResponse<DiaryEntry[]> = {
      success: true,
      data,
      total: data.length,
    };

    res.json(response);
  } catch (error) {
    console.error('[API] 获取回收站列表失败:', error);

    const response: ApiResponse = {
      success: false,
      message: '获取回收站列表失败',
    };

    res.status(500).json(response);
  }
});

/**
 * POST /api/entries/:id/restore
 * 从回收站恢复日记
 */
router.post('/entries/:id/restore', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const entry = await restoreEntry(Number(id));

    if (!entry) {
      const response: ApiResponse = {
        success: false,
        message: '日记不存在或不在回收站中',
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<DiaryEntry> = {
      success: true,
      data: entry,
    };

    res.json(response);
  } catch (error) {
    console.error('[API] 恢复日记失败:', error);

    const response: ApiResponse = {
      success: false,
      message: '恢复日记失败',
    };

    res.status(500).json(response);
  }
});

/**
 * 清理日记内容中不再被任何条目引用的图片文件
 *
 * 从 content 中提取所有 /uploads/ 图片 URL，检查其他条目是否还在使用，
 * 如果完全孤立则删除物理文件。软删除时可传入当前条目 ID 以排除自身引用。
 */
function cleanupOrphanedImages(content: string, excludeEntryId?: number): void {
  const imageRegex = /!\[.*?\]\((\/uploads\/[^)]+)\)|<img[^>]+src="(\/uploads\/[^"]+)"/g;
  const imageUrls: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = imageRegex.exec(content)) !== null) {
    imageUrls.push(match[1] || match[2]);
  }

  if (imageUrls.length === 0) return;

  const activeEntries = queryEntries({ limit: 10000 }).data;
  const deletedEntries = queryDeletedEntries().filter(e => e.id !== excludeEntryId);
  const allEntries = [...activeEntries, ...deletedEntries];

  for (const url of imageUrls) {
    const stillReferenced = allEntries.some(e => e.content && e.content.includes(url));
    if (!stillReferenced) {
      const filename = url.replace('/uploads/', '');
      const filePath = path.join(process.cwd(), 'data', 'uploads', filename);
      try {
        fs.unlinkSync(filePath);
      } catch (fileError) {
        console.error('[API] 删除孤立图片文件失败:', fileError);
      }
    }
  }
}

/**
 * DELETE /api/entries/:id/permanent
 * 永久删除日记（从回收站彻底删除）
 */
router.delete('/entries/:id/permanent', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const entry = getEntryById(Number(id));

    if (!entry) {
      const response: ApiResponse = {
        success: false,
        message: '日记不存在',
      };
      res.status(404).json(response);
      return;
    }

    await permanentlyDeleteEntry(Number(id));
    cleanupOrphanedImages(entry.content);

    const response: ApiResponse = {
      success: true,
      message: '日记已永久删除',
    };

    res.json(response);
  } catch (error) {
    console.error('[API] 永久删除日记失败:', error);

    const response: ApiResponse = {
      success: false,
      message: '永久删除日记失败',
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/entries/:id
 * 获取单条日记详情
 *
 * 路径参数：
 *   id - 日记的唯一标识符
 *
 * 实现逻辑：
 * 1. 从路径参数中提取 id 并转为数字
 * 2. 调用 getEntryById 查找日记
 * 3. 如果不存在，返回 404 错误
 * 4. 存在则返回日记详情
 *
 * 为什么需要独立的详情接口？
 * - 列表接口返回数据（可能截断内容预览）
 * - 详情接口返回完整数据（包括完整内容）
 * - 分离关注点，列表查询更快
 */
router.get('/entries/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const entry = getEntryById(Number(id));

    if (!entry) {
      const response: ApiResponse = {
        success: false,
        message: '日记不存在',
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<DiaryEntry> = {
      success: true,
      data: entry,
    };

    res.json(response);
  } catch (error) {
    console.error('[API] 获取日记详情失败:', error);

    const response: ApiResponse = {
      success: false,
      message: '获取日记详情失败',
    };

    res.status(500).json(response);
  }
});

/**
 * POST /api/entries
 * 创建新日记
 *
 * 请求体（CreateEntryRequest）：
 *   title   - 必填，日记标题
 *   content - 必填，日记正文
 *   mood    - 可选，默认 'neutral'
 *   weather - 可选，默认 ''
 *   tags    - 可选，默认 ''
 *
 * 实现逻辑：
 * 1. 从请求体中提取字段
 * 2. 校验必填字段（标题不能为空）
 * 3. 调用 createEntry 创建日记
 * 4. 返回新创建的日记（含 id 和时间戳）
 *
 * 为什么标题是唯一必填的？
 * - 内容可以为空（用户可能只记个标题就走了）
 * - 心情、天气、标签都是可选的辅助信息
 * - 标题是日记的基本标识，必须有
 */
router.post('/entries', async (req: Request, res: Response) => {
  const { title, content, mood, weather, tags, date, show_in_timeline } = req.body;

  if (!title || !String(title).trim()) {
    const response: ApiResponse = {
      success: false,
      message: '标题不能为空',
    };
    res.status(400).json(response);
    return;
  }

  try {
    const newEntry = await createEntry({
      title: String(title),
      content: String(content || ''),
      mood: mood ? String(mood) : undefined,
      weather: weather ? String(weather) : undefined,
      tags: tags ? String(tags) : undefined,
      date: date ? String(date) : undefined,
      show_in_timeline: show_in_timeline !== undefined ? Boolean(show_in_timeline) : undefined,
    });

    const response: ApiResponse<DiaryEntry> = {
      success: true,
      data: newEntry,
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('[API] 创建日记失败:', error);

    const response: ApiResponse = {
      success: false,
      message: '创建日记失败',
    };

    res.status(500).json(response);
  }
});

/**
 * PUT /api/entries/:id
 * 更新已有日记
 *
 * 路径参数：
 *   id - 要更新的日记 ID
 *
 * 请求体（UpdateEntryRequest）- 所有字段可选：
 *   title   - 新标题
 *   content - 新内容
 *   mood    - 新心情
 *   weather - 新天气
 *   tags    - 新标签
 *
 * 实现逻辑：
 * 1. 从路径参数中提取 id
 * 2. 从请求体中提取要更新的字段
 * 3. 调用 updateEntry 函数（内部会处理部分更新逻辑）
 * 4. 如果日记不存在，返回 404
 * 5. 返回更新后的完整日记数据
 *
 * 为什么使用 PUT 而不是 PATCH？
 * - PUT 语义上表示"完整替换"
 * - 但我们通过"未提供的字段保持原值"实现了部分更新的效果
 * - 这种设计更简单，前端代码更容易编写
 */
router.put('/entries/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, content, mood, weather, tags, date, favorited, pinned_at, show_in_timeline } = req.body;

  try {
    const updatedEntry = await updateEntry(Number(id), {
      title: title !== undefined ? String(title) : undefined,
      content: content !== undefined ? String(content) : undefined,
      mood: mood !== undefined ? String(mood) : undefined,
      weather: weather !== undefined ? String(weather) : undefined,
      tags: tags !== undefined ? String(tags) : undefined,
      date: date !== undefined ? String(date) : undefined,
      favorited: favorited !== undefined ? Boolean(favorited) : undefined,
      pinned_at: pinned_at !== undefined ? pinned_at : undefined,
      show_in_timeline: show_in_timeline !== undefined ? Boolean(show_in_timeline) : undefined,
    });

    if (!updatedEntry) {
      const response: ApiResponse = {
        success: false,
        message: '日记不存在',
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<DiaryEntry> = {
      success: true,
      data: updatedEntry,
    };

    res.json(response);
  } catch (error) {
    console.error('[API] 更新日记失败:', error);

    const response: ApiResponse = {
      success: false,
      message: '更新日记失败',
    };

    res.status(500).json(response);
  }
});

/**
 * DELETE /api/entries/:id
 * 软删除日记（移入回收站）
 */
router.delete('/entries/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const entry = getEntryById(Number(id));

    if (!entry) {
      const response: ApiResponse = {
        success: false,
        message: '日记不存在',
      };
      res.status(404).json(response);
      return;
    }

    await deleteEntry(Number(id));

    const response: ApiResponse = {
      success: true,
      message: '日记已移入回收站',
    };

    res.json(response);
  } catch (error) {
    console.error('[API] 删除日记失败:', error);

    const response: ApiResponse = {
      success: false,
      message: '删除日记失败',
    };

    res.status(500).json(response);
  }
});export default router;
