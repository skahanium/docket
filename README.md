# Docket

本地优先、离线可用的桌面任务管理应用，基于 Tauri v2 + Solid.js + SQLite。

## 特性

- 完全离线运行，数据存储在本地 SQLite 数据库（WAL 模式）
- 任务管理：创建、编辑、完成、归档、重复规则
- 子任务：可追踪进度，列表一次查询批量加载
- 日历视图：月历网格、拖拽改期
- 日程排程：按工作日/节假日自动排程、上午/下午时间块
- 专注计时：独立置顶小窗
- 分类与标签：筛选与组织
- 提醒通知：后台轮询 + 系统通知（含每日摘要、逾期提醒，可设置关闭）
- 统计与分析：完成趋势、预估 vs 实际、专注热力图、每日回顾
- **单例运行**：重复启动唤起已有窗口
- **托盘常驻**：关闭主窗口隐藏到托盘，托盘可显示/隐藏桌面任务面板
- **桌面任务面板**：悬浮只读清单（今日 + 逾期），点击打开主窗口
- 设置：工作时间、节假日（可选联网同步）、通知、数据库路径（本地文件备份）
- 系统托盘、深色/浅色主题

## 技术栈

| 层       | 技术 |
| -------- | ---- |
| 桌面框架 | Tauri v2 |
| 前端 UI  | Solid.js + TypeScript + Vite |
| 样式     | Tailwind CSS v4 + CSS Modules |
| 数据库   | SQLite（rusqlite bundled，单文件 `docket.db`） |
| 通知     | tauri-plugin-notification（提醒后台线程） |

## 快速开始

```bash
npm install
npm run tauri dev

# Rust 测试（含 command 集成测试）
cd src-tauri && cargo test

# 前端测试
npm test

# 从 Rust 模型重新生成 TypeScript 契约（修改 models / 命令 DTO 后执行）
npm run generate:bindings

# CI：确认 generated.ts 与 Rust 一致
npm run check:bindings
```

### 系统要求

- Rust 1.77+
- Node.js 18+
- **Windows:** Visual Studio Build Tools（C++）、WebView2
- **macOS:** Xcode Command Line Tools

## 项目结构

```
src-tauri/src/
├── main.rs / lib.rs    # 入口、托盘、命令注册
├── db.rs               # 迁移、索引、节假日种子、is_workday
├── models.rs           # Serde 领域模型
├── recurrence.rs       # 重复任务日期计算
├── scheduler.rs        # 提醒轮询（tauri-plugin-notification）
├── bindings_export.rs  # Specta TS 导出后处理
├── time.rs             # HH:MM 时间工具（排程/分析共用）
└── commands/
    ├── tasks.rs        # 任务 CRUD、批量列表查询
    ├── subtasks.rs
    ├── categories.rs / tags.rs
    ├── calendar.rs / stats.rs   # get_stats_panel 合并统计 IPC
    ├── schedule.rs     # 日程排程
    ├── focus.rs
    ├── reminders.rs
    ├── settings.rs     # 工作时间、节假日、数据库路径
    ├── analytics.rs    # 负载摘要、每日回顾（统计走 stats.rs）

src/
├── App.tsx / focus.tsx
├── stores/             # Solid 根 store、createResource、invalidate
├── bindings/           # 按领域拆分的 invoke + types（见下）
│   ├── types.ts        # 重新导出 generated.ts
│   ├── generated.ts    # Specta 生成，勿手改
│   ├── tasks.ts / calendar.ts / stats.ts / settings.ts …
└── components/         # TaskList、Calendar、Schedule、StatsPanel、SettingsPanel …
```

## 架构

**前端只负责渲染与交互；业务规则、持久化、提醒调度均在 Rust 侧。**

```
用户操作 → Solid 组件
    → stores / bindings → invoke()
    → Tauri Command → rusqlite → docket.db
    → invalidateAfterTaskMutation() → 刷新列表/日历/详情/统计
```

### 为何业务逻辑放在 Rust

1. **本地优先**：单进程内完成读写，无 HTTP 层，延迟低、可离线。
2. **数据一致性**：事务、外键、迁移集中在 `db.rs`，避免前后端双份校验漂移。
3. **类型安全**：领域模型与 SQL 同在 Rust，减少 IPC 边界上的无效状态。
4. **长期演进**：列表查询已做批量加载（固定 3 次查询）+ 索引，便于继续优化而不改 UI。

### 前端契约与主要 IPC

| 领域 | 代表命令 | 说明 |
|------|----------|------|
| 任务 | `list_tasks`, `create_task`, … | 列表为批量查询，无 N+1 |
| 统计 | `get_stats_panel` | 一次返回统计卡片、周预估/实际、专注热力图 |
| 设置 | `get_settings`, `get_notification_settings`, `get_database_path`, … | 设置页；节假日同步需用户确认（S2） |
| 桌面面板 | `get_desktop_panel_snapshot`, `focus_task_from_panel` | 托盘切换显示；只读 |
| 备份 | （无 JSON 命令） | 设置页展示/打开 `docket.db` 路径，直接复制文件即可 |

`bindings/types.ts` 重新导出 `generated.ts`（`npm run generate:bindings` / `npm run check:bindings`）。**不提供** JSON 导入导出。长任务列表 ≥40 条时窗口化虚拟滚动。任务变更后调用 `invalidateAfterTaskMutation()` 刷新多视图。

> `docs/superpowers/` 为早期规划稿，可能与当前实现不一致；**以本 README 与代码为准**。

### 错误处理（Rust）

命令层内部使用 `AppError`（`thiserror`），经 `Result<_, String>` 返回给前端，例如 `task not found (id=…)`、`database lock poisoned`。

## 数据库

- 路径：系统应用数据目录下的 `docket.db`
- 迁移：`_migrations` 表版本化（当前 v4 含查询索引）
- 完整性：启动时 `PRAGMA integrity_check`

## 许可证

MIT
