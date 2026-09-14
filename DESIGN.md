# Simple Diary — 设计系统契约

> 本文件是前端视觉的唯一事实来源。任何颜色、字号、间距、圆角、阴影都必须引用这里的令牌
> （实现于 `client/src/assets/main.css` 的 CSS 变量）。需要新令牌时先改这里和 main.css。

## 0. 方向声明

**纸墨手账（Paper & Ink Journal）**：一本摊开在暖光下的私人手账。
氛围是温润、安静、私密的；签名材质是**暖纸面 + 墨棕主色 + 衬线标题**；
访客记住的那一刻是**时间线页的墨点年份轴**。拒绝冷色 SaaS 仪表盘感。

## 1. 色彩

单主色（墨棕）+ 中性纸色阶 + 少量语义色。所有中性色统一暖调（禁止冷暖灰混用）。

### 纸面（Light）
| 令牌 | 值 | 用途 |
|---|---|---|
| `--color-bg` | `#F6F1E8` | 页面底，深一档的米纸 |
| `--color-bg-card` | `#FFFCF7` | 卡片，比底更亮的暖白 |
| `--color-bg-input` | `#F1EADE` | 输入框 |
| `--color-text` | `#2C1E12` | 正文墨色 |
| `--color-text-secondary` | `#85715A` | 次级 |
| `--color-text-muted` | `#AB9B85` | 弱化 |
| `--color-border` | `#E8DFCF` | 边框 |
| `--color-border-strong` | `#D8CBB4` | 强边框/hover 边框 |

### 墨色（Brand）
`--color-primary #6B4423` · `-light #8B6543` · `-dark #4A2F16`
主色淡染统一用令牌，不再写 rgba 字面量：
`--color-primary-wash-1: rgba(107,68,35,.04)`（hover 面）
`--color-primary-wash-2: rgba(107,68,35,.08)`（选中/激活面）
`--color-primary-wash-3: rgba(107,68,35,.14)`（按下/强激活）

### 语义色（各自带暗色变体，见 main.css）
success `#4E9455` / warning `#B07A1F` / info `#3E7BA6` / danger `#C94F47`
及软底 `--color-success-bg` 等（浅主题为同色系 10% 明度底，暗主题为深色透底）。

### 暗色（墨夜）
背景从纯黑改为**带棕的暖黑**：`#171210` 页面、`#211B16` 卡片、`#2C241D` 输入；
文字 `#E9DED2`。阴影加深且保持暖色相。

## 2. 阴影（暖色相，方向一致：上方光源）

```
--shadow-sm: 0 1px 2px rgba(64,44,26,.06), 0 1px 3px rgba(64,44,26,.04)
--shadow-md: 0 2px 6px rgba(64,44,26,.07), 0 6px 16px rgba(64,44,26,.06)
--shadow-lg: 0 4px 10px rgba(64,44,26,.08), 0 12px 32px rgba(64,44,26,.10)
```

## 3. 字体与字阶

- 正文无衬线：系统栈（离线约束，禁外链字体）：`-apple-system, Segoe UI, PingFang SC, Microsoft YaHei`
- 标题衬线 `--font-serif`：`Georgia, 'Palatino Linotype', 'STZhongsong', 'Noto Serif SC', serif`
  （Windows 中文标题落 STZhongsong 而非默认宋体；CJK 一律不用斜体）
- 数字数据位（统计数、日期列）启用 `font-variant-numeric: tabular-nums`
- 字重阶梯只用 400 / 500 / 600 / 700；大标题负 tracking（-0.01em）
- 层级示例：页面题 1.9rem serif 700 · 区块题 1.1rem serif 600 · 正文 0.95rem

## 4. 几何与间距

- 圆角节奏：内元素 sm 6px → 容器 md 10px → 大容器/弹层 lg 16px（不平均用力）
- 间距令牌不变（xs4/sm8/md16/lg24/xl32/2xl48），≥1024px 放大档保留
- 内容最大宽度按页面既有设定（800–1200px），列表正文行长 ≤ 65ch

## 5. 组件原语与状态

每个原语必须实现齐全的状态：
- **按钮** btn / -primary / -outline / -danger / -ghost / -sm / -lg：
  hover（面色变化 + 100ms）、active（scale .97）、focus-visible（3px wash 外环）、disabled
- **输入** input/textarea/select：focus = 主色边 + wash 外环（box-shadow 令牌）
- **卡片** card：默认有边有淡影；可交互卡片 hover 上浮 1px + md 影
- **弹层** modal-overlay/content：入场动画 200ms（translateY 8px→0 + opacity，GPU 合成属性）
- **空状态** empty-state：图标座（圆形 wash 底）+ 引导文案
- **骨架屏** skeleton：pulse 动画保留

## 6. 图标

UI 装饰一律内联 SVG 描边图标（stroke=currentColor, width 2, round cap），不引第三方库，
不用 emoji 作界面图标。**例外**：心情表情是用户数据的语义符号，保留 emoji。

## 7. 动效

- 时长只允许 fast 150ms / normal 250ms 两档缓动 ease
- 只动画 transform / opacity（GPU 合成）
- 动效必须有信息含义（反馈状态/指示可达区）；装饰性循环动画仅限"同步中"脉冲一处
- `@media (prefers-reduced-motion: reduce)` 下关闭过渡与动画

## 8. 无障碍

- 键盘焦点必须有可见环（`:focus-visible` 全局规则）
- 触控目标 ≥ 44×44px（移动端断点强制）
- 正文对比度 ≥ 4.5:1；muted 仅用于辅助信息

## 9. 响应式

- 断点：≤768px 移动（顶栏布局）/ 861–1023 平板 / ≥1024 桌面放大间距
- **状态栏隔离（Android edge-to-edge）**：MainActivity 通过 JS 桥注入 `--safe-area-top`
  （状态栏高度），`.sidebar`/`.main` 顶部 padding 让出该区域，顶栏背景延伸覆盖；
  未注入环境（浏览器/桌面）回退 0；状态栏图标深浅跟随应用内主题
- **首页列表双布局（PC 与手机分开做，不复用同一套排版）**：
  - 桌面：横向自动填充网格，封面固定高、摘要 3 行、等高对齐，默认按创建时间倒序（置顶优先）
  - 移动：瀑布流多列（默认 2 列，1–3 列可选，记忆于 localStorage `diary_mobile_columns`），
    列内纵向排列、默认按编辑时间倒序（置顶优先）
  - 排序方式（编辑时间/创建时间）两端可在工具栏各自选择、分别记忆于 localStorage
    `diary_sort`（`{mobile, desktop}`），不跨端共享
  - 卡片无固定行高——封面按原始比例（上限 240px）、无图不占位、摘要 4 行，
    高度随内容自然参差；触屏设备关闭 hover 位移（`@media (hover: hover)`）
  - 卡片两种形态实现于 `EntryCard.vue` 的 `mobile` 变体，列表容器在 `BrowseView.vue`
- 全高元素用 `min-height: 100dvh` 思路，避免 WebView 地址栏跳动（逐步替换中）

## 10. 接受的技术债

- 未捆绑离线 webfont：中文衬线依赖系统字体，Android WebView 将回退无衬线——接受
- 浏览器目标以 Chromium/WebView 为主，未做 Firefox 老版本回归
- `100vh` 在深层视图中的完全替换延后到移动端专项
