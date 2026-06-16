/**
 * 数据库模块 - JSON 文件存储方案
 *
 * 为什么选择 JSON 文件而不是 SQLite？
 * - 零原生依赖，不需要编译 C++ 扩展
 * - 纯 JavaScript 实现，跨平台兼容性最好
 * - 对于日记应用的数据量（几千条记录），性能完全够用
 * - 将来迁移到移动端时，可以轻松替换为 SQLite
 *
 * 实现原理：
 * 1. 维护一个内存中的数据数组
 * 2. 读写操作直接操作内存
 * 3. 每次写操作后将完整数据持久化到 JSON 文件
 * 4. 应用启动时从 JSON 文件加载数据到内存
 *
 * 数据持久化策略：
 * - 使用 writeFileSync 同步写入，确保数据一致性
 * - 写入临时文件后重命名，防止写入过程中断电导致数据损坏
 */

import fs from 'fs';
import path from 'path';

/** 日记条目接口 - 与后端 types.ts 中的定义一致 */
interface DiaryEntry {
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

/** JSON 数据库的根结构 */
interface DatabaseSchema {
  entries: DiaryEntry[];
  nextId: number;  // 下一个可用的 ID（自增计数器）
}

/** 数据库文件路径：存放在 server 目录下 */
const DB_PATH = path.join(__dirname, '..', 'diary.json');

/** 内存中的数据库实例 */
let db: DatabaseSchema = {
  entries: [],
  nextId: 1,
};

/**
 * 初始化数据库
 *
 * 实现逻辑：
 * 1. 检查数据库文件是否存在
 * 2. 如果存在，读取并解析 JSON 文件到内存
 * 3. 如果不存在，创建空数据库
 * 4. 确保 nextId 是正确的（取最大 id + 1）
 *
 * 为什么要在内存中维护数据？
 * - 读取操作不需要每次从磁盘读取，性能更好
 * - 查询和筛选可以直接在内存中完成
 * - 写入时一次性同步到磁盘
 */
export function initDatabase(): void {
  try {
    if (fs.existsSync(DB_PATH)) {
      // 数据库文件存在，读取数据
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      db = JSON.parse(data);
      console.log(`[DB] 已加载 ${db.entries.length} 条日记`);
    } else {
      // 数据库文件不存在，初始化空数据库
      db = { entries: [], nextId: 1 };
      saveToDisk();
      console.log('[DB] 已创建新的数据库文件');
    }

    // 迁移：为缺少 deleted_at 的旧条目补充默认值
    let migrated = false;
    for (const entry of db.entries) {
      if ((entry as any).deleted_at === undefined) {
        (entry as any).deleted_at = null;
        migrated = true;
      }
    }
    if (migrated) {
      try {
        fs.writeFileSync(DB_PATH + '.tmp', JSON.stringify(db), 'utf-8');
        fs.unlinkSync(DB_PATH);
        fs.renameSync(DB_PATH + '.tmp', DB_PATH);
      } catch (e) {
        console.error('[DB] 迁移数据保存失败:', e);
      }
      console.log('[DB] 已迁移旧数据：补充 deleted_at 字段');
    }

    // 确保 nextId 正确（防御性编程：防止手动修改 JSON 文件导致 ID 冲突）
    const maxId = db.entries.reduce((max, entry) => Math.max(max, entry.id), 0);
    if (db.nextId <= maxId) {
      db.nextId = maxId + 1;
    }
  } catch (error) {
    console.error('[DB] 数据库初始化失败:', error);
    // 初始化失败时使用空数据库，不影响应用启动
    db = { entries: [], nextId: 1 };
  }
}

/**
 * 将内存数据持久化到磁盘
 *
 * 实现逻辑：
 * 1. 将数据序列化为格式化的 JSON（便于调试时手动查看）
 * 2. 先写入临时文件，再重命名（原子操作）
 *
 * 为什么要用临时文件 + 重命名？
 * - 如果直接用 writeFileSync 写入，在写入过程中断电或崩溃
 *   可能导致 JSON 文件损坏（写了一半）
 * - 先写临时文件，即使失败也只损坏临时文件
 * - 重命名是文件系统的原子操作，要么成功要么不发生
 *
 * 注意：在 Windows 上，重命名操作可能会失败如果目标文件已存在
 * 所以我们先删除目标文件再重命名
 */
async function saveToDisk(): Promise<void> {
  try {
    const tempPath = DB_PATH + '.tmp';
    const data = JSON.stringify(db);

    await fs.promises.writeFile(tempPath, data, 'utf-8');
    await fs.promises.unlink(DB_PATH).catch(() => {});
    await fs.promises.rename(tempPath, DB_PATH);
  } catch (error) {
    console.error('[DB] 保存数据到磁盘失败:', error);
    throw error;
  }
}

/**
 * 获取所有日记条目（支持筛选、排序、分页）
 *
 * @param options - 查询选项
 * @param options.search - 搜索关键词（模糊匹配标题和内容）
 * @param options.mood - 按心情筛选
 * @param options.page - 页码（从 1 开始）
 * @param options.limit - 每页条数
 * @param options.sort - 排序方向（asc 或 desc）
 * @returns 包含数据和总数的结果对象
 *
 * 实现逻辑：
 * 1. 从内存数组开始筛选
 * 2. 如果有搜索关键词，使用 includes() 进行模糊匹配
 * 3. 如果有心情筛选，使用严格相等匹配
 * 4. 排序后计算总数
 * 5. 应用分页（slice）
 *
 * 为什么用 includes() 而不是正则？
 * - includes() 简单直观，满足基本需求
 * - 正则表达式对用户输入需要转义，增加复杂度
 * - 用户搜索场景不需要正则的高级功能
 *
 * 为什么不区分大小写？
 * - 中文不区分大小写
 * - 英文搜索时用户通常期望不区分大小写
 * - 使用 toLowerCase() 统一转为小写后比较
 */
export function queryEntries(options: {
  search?: string;
  mood?: string;
  page?: number;
  limit?: number;
  sort?: 'asc' | 'desc';
} = {}): { data: DiaryEntry[]; total: number } {
  const { search, mood, page = 1, limit = 20, sort = 'desc' } = options;

  // 复制数组避免修改原数据，默认排除已删除的条目
  let filtered = db.entries.filter(e => !e.deleted_at);

  // 关键词搜索：同时匹配标题和内容
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(entry =>
      entry.title.toLowerCase().includes(searchLower) ||
      entry.content.toLowerCase().includes(searchLower)
    );
  }

  // 心情筛选
  if (mood) {
    filtered = filtered.filter(entry => entry.mood === mood);
  }

  // 排序：置顶优先，再按创建时间排序
  filtered.sort((a, b) => {
    if (a.pinned_at && b.pinned_at) {
      const pa = new Date(a.pinned_at).getTime();
      const pb = new Date(b.pinned_at).getTime();
      if (pa !== pb) return sort === 'asc' ? pa - pb : pb - pa;
    } else if (a.pinned_at) {
      return -1;
    } else if (b.pinned_at) {
      return 1;
    }
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    return sort === 'asc' ? timeA - timeB : timeB - timeA;
  });

  // 计算总数（分页前）
  const total = filtered.length;

  // 分页：计算偏移量并截取
  const offset = (Math.max(1, page) - 1) * limit;
  const data = filtered.slice(offset, offset + limit);

  return { data, total };
}

/**
 * 根据 ID 获取单条日记
 *
 * @param id - 日记 ID
 * @returns 日记条目，不存在则返回 undefined
 *
 * 实现逻辑：
 * - 使用 find() 在内存数组中查找
 * - 时间复杂度 O(n)，对于日记应用的数据量完全够用
 * - 如果将来数据量很大，可以考虑使用 Map 结构
 */
export function getEntryById(id: number): DiaryEntry | undefined {
  return db.entries.find(entry => entry.id === id);
}

/**
 * 创建新日记
 *
 * @param data - 日记数据（不含 id 和时间戳）
 * @returns 新创建的完整日记条目
 *
 * 实现逻辑：
 * 1. 从 nextId 获取新 ID，然后自增
 * 2. 设置创建时间和更新时间
 * 3. 将新条目添加到数组开头（最新在前）
 * 4. 持久化到磁盘
 *
 * 为什么添加到数组开头？
 * - 日记列表默认按时间倒序显示
 * - 新日记在开头可以更快地在后续查询中被找到
 * - 但这不影响排序逻辑（排序在查询时进行）
 *
 * 注意：这里使用本地时间格式
 * ISO 8601 格式：2024-01-15T14:30:00.000Z
 * 但为了显示友好，我们使用：2024-01-15 14:30:00
 */
export async function createEntry(data: {
  title: string;
  content: string;
  mood?: string;
  weather?: string;
  tags?: string;
  date?: string;
  show_in_timeline?: boolean;
}): Promise<DiaryEntry> {
  const now = data.date
    ? `${data.date} ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`
    : new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

  const entry: DiaryEntry = {
    id: db.nextId++,
    title: data.title.trim(),
    content: data.content || '',
    mood: data.mood || 'neutral',
    weather: data.weather || '',
    tags: data.tags || '',
    favorited: false,
    pinned_at: null,
    show_in_timeline: data.show_in_timeline !== undefined ? data.show_in_timeline : true,
    deleted_at: null,
    created_at: now,
    updated_at: now,
  };

  db.entries.unshift(entry);
  await saveToDisk();

  return entry;
}

/**
 * 更新日记
 *
 * @param id - 要更新的日记 ID
 * @param data - 要更新的字段（部分更新）
 * @returns 更新后的完整日记，不存在则返回 undefined
 *
 * 实现逻辑：
 * 1. 查找目标条目
 * 2. 使用 Object.assign 合并更新（未提供的字段保持原值）
 * 3. 更新 updated_at 时间戳
 * 4. 持久化
 *
 * 为什么用 Object.assign？
 * - 它会将 source 中的属性复制到 target 上
 * - 只复制提供的属性，未提供的不会覆盖原值
 * - 等效于 SQL 的 UPDATE ... SET col = COALESCE(?, col)
 */
export async function updateEntry(id: number, data: {
  title?: string;
  content?: string;
  mood?: string;
  weather?: string;
  tags?: string;
  date?: string;
  favorited?: boolean;
  pinned_at?: string | null;
  show_in_timeline?: boolean;
}): Promise<DiaryEntry | undefined> {
  const entry = db.entries.find(e => e.id === id);
  if (!entry) return undefined;

  if (data.title !== undefined) entry.title = data.title.trim();
  if (data.content !== undefined) entry.content = data.content;
  if (data.mood !== undefined) entry.mood = data.mood;
  if (data.weather !== undefined) entry.weather = data.weather;
  if (data.tags !== undefined) entry.tags = data.tags;
  if (data.date !== undefined) {
    const timePart = entry.created_at.includes(' ') ? entry.created_at.slice(11) : ''
    entry.created_at = timePart ? `${data.date} ${timePart}` : data.date
  }
  if (data.favorited !== undefined) entry.favorited = data.favorited;
  if (data.pinned_at !== undefined) entry.pinned_at = data.pinned_at;
  if (data.show_in_timeline !== undefined) entry.show_in_timeline = data.show_in_timeline;

  entry.updated_at = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

  await saveToDisk();
  return entry;
}

/**
 * 软删除日记（移入回收站）
 *
 * @param id - 要删除的日记 ID
 * @returns 是否删除成功
 */
export async function deleteEntry(id: number): Promise<boolean> {
  const entry = db.entries.find(e => e.id === id);
  if (!entry) return false;

  entry.deleted_at = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  await saveToDisk();
  return true;
}

/**
 * 获取回收站中的日记列表
 */
export function queryDeletedEntries(): DiaryEntry[] {
  return db.entries
    .filter(e => e.deleted_at !== null)
    .sort((a, b) => {
      const da = a.deleted_at || a.created_at;
      const db2 = b.deleted_at || b.created_at;
      return new Date(db2).getTime() - new Date(da).getTime();
    });
}

/**
 * 从回收站恢复日记
 *
 * @param id - 日记 ID
 * @returns 恢复后的条目，不存在则返回 undefined
 */
export async function restoreEntry(id: number): Promise<DiaryEntry | undefined> {
  const entry = db.entries.find(e => e.id === id);
  if (!entry || !entry.deleted_at) return undefined;

  entry.deleted_at = null;
  entry.updated_at = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  await saveToDisk();
  return entry;
}

/**
 * 永久删除日记（从回收站彻底删除）
 *
 * @param id - 日记 ID
 * @returns 是否删除成功
 */
export async function permanentlyDeleteEntry(id: number): Promise<boolean> {
  const index = db.entries.findIndex(e => e.id === id);
  if (index === -1) return false;

  db.entries.splice(index, 1);
  await saveToDisk();
  return true;
}

/**
 * 查询指定年月的日记，按日期分组
 *
 * @param year - 年份，如 2024
 * @param month - 月份，1-12
 * @returns 按日期分组的日记，key 为 "YYYY-MM-DD"
 *
 * 实现逻辑：
 * 1. 根据 year/month 计算该月的起始和结束时间
 * 2. 筛选 created_at 在该时间范围内的条目
 * 3. 按日期分组（created_at 前 10 位是日期 YYYY-MM-DD）
 * 4. 每组内按创建时间倒序排列
 */
export function queryEntriesByMonth(year: number, month: number): { [date: string]: DiaryEntry[] } {
  const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endStr = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const startTime = new Date(startStr).getTime();
  const endTime = new Date(endStr).getTime();

  // 筛选该月条目
  const monthEntries = db.entries.filter(entry => {
    const t = new Date(entry.created_at).getTime();
    return t >= startTime && t < endTime;
  });

  // 按日期分组
  const grouped: { [date: string]: DiaryEntry[] } = {};
  for (const entry of monthEntries) {
    const date = entry.created_at.substring(0, 10); // "YYYY-MM-DD"
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(entry);
  }

  // 每组按创建时间倒序
  for (const date of Object.keys(grouped)) {
    grouped[date].sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return timeB - timeA;
    });
  }

  return grouped;
}

/**
 * 关闭数据库
 * 在 JSON 文件方案中，数据已经实时持久化到磁盘
 * 这个函数是占位符，确保与 SQLite 方案的接口一致
 * 将来如果切换到 SQLite，只需在这个函数中关闭连接即可
 */
export function closeDatabase(): void {
  console.log('[DB] 数据库已关闭');
}
