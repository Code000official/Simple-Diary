# Simple Diary

一本本地优先的私人日记应用：纸墨手账风格，数据完全存放在自己手里。

- **本地优先**：所有日记与图片保存在本机，不依赖任何账号和云服务
- **可选自托管同步**：提供一个极简同步服务器（纯文件存储、无数据库），适合部署在家庭服务器 / NAS 上，多台设备间双向同步
- **跨平台**：浏览器 Web 版、Linux / Windows 桌面版（Tauri 2）、Android 版

## 功能

- **写作**：Markdown 正文（实时编辑器）、心情与天气标记、标签、收藏、置顶
- **回顾**：
  - 浏览页 —— 桌面端横向网格 / 移动端多列瀑布流（双布局独立设计）
  - 时间线 —— 墨点年份轴，可挑选条目是否上榜
  - 日历视图、写作统计、回收站（软删除，可恢复）
- **图片**：插入本地图片，点击全屏查看（Lightbox）
- **导入 / 导出**：JSON 全量备份
- **设计**：暖纸面 + 墨棕主色 + 衬线标题的「纸墨手账」设计系统，含暗色「墨夜」主题；移动端适配（含 Android edge-to-edge 状态栏安全区）

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + TypeScript + Vite + vue-router + marked |
| 本地存储 | Web 端 IndexedDB（Dexie）；桌面 / Android 端经 Tauri 直接读写文件系统 |
| 桌面 / 移动壳 | Tauri 2（Rust） |
| 同步服务器 | Node.js 单文件（`sync-server.mjs`），无数据库、纯文件存储 |

## 快速开始（开发）

依赖：Node.js、Rust（桌面 / Android 构建另需系统库，见下文）。

```sh
./rundev.sh        # 仅前端，http://localhost:4173，数据存浏览器 IndexedDB
```

桌面端开发模式（带 Tauri 窗口）：

```sh
./client/node_modules/.bin/tauri dev
```

## 构建发布

| 目标 | 命令 | 产物 |
|---|---|---|
| Linux | `./build.sh [deb rpm appimage]` | `src-tauri/target/release/bundle/` |
| Windows | `build.bat` | `src-tauri/target/release/bundle/` |
| Android | `./build-android.sh [apk\|aab]` | `src-tauri/gen/android/app/build/outputs/` |

三个脚本都会依次完成：检查环境 → 安装前端依赖 → 构建前端 → 打包，并把前端产物复制到 `data/client/`（供同步服务器托管 Web 版）。

额外依赖：

- **Linux 桌面**：Tauri 系统库（webkit2gtk-4.1、gtk3 等），脚本会检测并给出各发行版安装命令
- **Android**：Android SDK + NDK、JDK 17/21；脚本会自动安装 Rust Android 编译目标并处理 debug 签名

## 多设备同步 / 自托管（可选）

同步服务器零依赖（仅需 Node.js），克隆项目后在服务器上运行：

```sh
./sync-server.sh              # 后台启动，立即可访问，关掉终端也继续运行
./sync-server.sh install      # 进阶：注册为 systemd 服务（开机自启 + 崩溃自动重启）
./sync-server.sh uninstall    # 卸载 systemd 服务
./sync-server.sh stop | status | log   # 日常管理
```

- 默认端口 `3457`（`PORT` 环境变量可改），数据目录 `./data/`（`DATA_DIR` 可改）
- 数据就是两个东西：`data/diary.json` + `data/uploads/` 图片目录，直接复制即备份
- 在各设备端的「设置」里填入服务器地址即可双向同步；策略为全量比对，冲突时 `updated_at` 较新者胜
- **Web 版托管**：若服务器上存在 `data/client/`（在本机 `./build.sh` 后把该目录一并上传），浏览器直接访问 `http://<服务器>:3457/` 即可使用 Web 版日记；未部署时仅提供同步 API
- 请求体大小限制：JSON 数据 50MB、图片上传 200MB，超限返回 413

> 注意：同步服务器**没有认证**，请只在可信的内网环境中使用，或自行在前面加一层反代认证。

## 数据存放位置

| 运行环境 | 位置 |
|---|---|
| 浏览器 | IndexedDB |
| 桌面 / Android | 系统应用数据目录下 `data/diary.json` + `data/uploads/` |
| 同步服务器 | `./data/diary.json` + `./data/uploads/` |

## 目录结构

```
client/          Vue 3 前端（views/ 页面、components/ 组件、sync.ts 同步引擎）
src-tauri/       Tauri 壳：Rust 命令（文件读写）、Android 工程（gen/）
server/          旧版 Express + SQLite 后端，已被纯前端 + sync-server 方案取代，仅存档
sync-server.mjs  轻量同步服务器（当前使用）
sync-server.sh   同步服务器一键管理脚本（启动/停止/systemd 安装）
data/            同步服务器数据目录 + 托管的 Web 版前端产物
DESIGN.md        设计系统契约（颜色、字阶、组件状态等的唯一事实来源）
```

## 设计系统

视觉规范见 [DESIGN.md](DESIGN.md)：所有颜色、字号、间距、圆角、阴影均以 CSS 变量令牌定义于 `client/src/assets/main.css`，改样式先改契约。

## 许可证

[GPL-2.0-only](LICENSE)
