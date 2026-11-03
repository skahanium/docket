# Docket

[![CI](https://github.com/skahanium/docket/actions/workflows/ci.yml/badge.svg)](https://github.com/skahanium/docket/actions/workflows/ci.yml)

本地优先、离线可用的桌面任务管理应用，基于 Tauri v2 + Solid.js + SQLite。

## 特性

- 完全离线运行，数据存储在本地 SQLite 数据库（WAL 模式）；界面使用系统字体，启动不访问 CDN
- 任务管理：创建、编辑、完成、归档、撤销完成、重复规则；今日按本机日历日计算，列表分「逾期 / 今日」两段。琐碎工作用任务；有程序的工作用**事项**
- **五视图**：今日、任务（可看归档）、事项、日历（点日见当天任务与排程）、进展（统计 + 周期指标）；启动默认今日。侧栏分类、标签是同级独立页（一页同时列出该分类或标签下的今日、任务、事项），不是这五页上的筛选
- **流程模板**与**事项**：从模板实例化或空白加步；今日一事一步（当前未完成步）；事项可归档/删除、可写说明；步骤可重命名/重排/删除，可关联本地文件/文件夹作依据（只记路径，不拷贝）。模板在设置中编辑，新建仍可选模板
- **到期日**：任务与步骤的 `due_date` 为本地日历日，可选 `HH:MM`；按日前缀归日，不引入第三种对象；重复任务生成的实例保留时刻
- **周期指标**：月/季/年在进展页，按办结事项自动计数（不进今日）
- 子任务：可追踪进度，列表一次查询批量加载
- 日历视图：月历网格计入任务与当前步到期；点日下方为当天任务列表与自动排程；从任务卡或议程拖到日格改期（保留已有时刻）
- 日程排程：挂在日历选中日下，按工作日/节假日自动排程、上午/下午时间块（仍只排任务）
- 专注计时：独立置顶小窗
- 分类与标签：侧栏点一项进入独立页，同时看该分类或标签下的今日安排、任务和事项；增删改仍在设置里
- 提醒通知：后台轮询 + 系统通知（含每日摘要、逾期提醒、pending 步骤到期，可设置关闭逾期/摘要）
- 统计与分析：完成趋势、预估 vs 实际、专注热力图、每日回顾（含当日完成步数与事项数）
- **单例运行**：重复启动唤起已有窗口
- **托盘常驻**：关闭主窗口隐藏到托盘，托盘可显示/隐藏桌面任务面板；菜单栏为钢笔 D 模板图标
- **应用标记**：深底钢笔笔锋 D（Dock / 启动画面同一套字）
- **桌面任务面板**：悬浮只读清单（今日 + 逾期），点击打开主窗口
- 设置：侧栏底部齿轮打开浮层，六页——常规（外观含主题、工作时间、节假日）、提醒与面板（通知、桌面面板）、分类、标签、模板、数据；开关自动保存，校验表单点「保存」
- 系统托盘、深色/浅色主题（顶栏太阳快捷切换；设置 → 常规 → 外观也可改）

## 技术栈

| 层       | 技术 |
| -------- | ---- |
| 桌面框架 | Tauri v2 |
| 前端 UI  | Solid.js + TypeScript + Vite |
| 样式     | Tailwind CSS v4 + CSS Modules |
| 数据库   | SQLite（rusqlite bundled，单文件 `docket.db`） |
| 通知     | tauri-plugin-notification（提醒后台线程） |
| 选路径   | tauri-plugin-dialog（仅 `dialog:allow-open`） |
| 打开路径 | tauri-plugin-opener |

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

# 从锁定几何重新导出 Dock / 托盘图标
npm run brand:icons
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
├── db.rs               # 迁移 v1–v6、索引、节假日种子、is_workday
├── models.rs           # Serde 领域模型（任务 / 事项 / 模板 / 指标）
├── agenda.rs           # 今日/逾期谓词、本地日边界、AgendaItem 合并
├── playbook.rs / matter.rs / cadence.rs / evidence.rs
├── recurrence.rs       # 重复任务日期计算
├── scheduler.rs        # 提醒轮询（tauri-plugin-notification）
├── bindings_export.rs  # Specta TS 导出后处理
├── time.rs             # 本地日历日与 HH:MM
└── commands/
    ├── tasks.rs        # 任务 CRUD、批量列表查询
    ├── playbooks.rs / matters.rs / cadences.rs / evidence.rs / agenda.rs
    ├── subtasks.rs
    ├── categories.rs / tags.rs
    ├── calendar.rs / stats.rs
    ├── schedule.rs / focus.rs / reminders.rs
    ├── settings.rs / analytics.rs / desktop_panel.rs

src/
├── App.tsx / focus.tsx
├── stores/             # Solid 根 store、createResource、invalidate
├── bindings/           # 按领域拆分的 invoke + types（见下）
│   ├── types.ts        # 重新导出 generated.ts
│   ├── generated.ts    # Specta 生成，勿手改
│   ├── tasks.ts / calendar.ts / stats.ts / settings.ts …
└── components/         # TaskList、Calendar、Schedule、StatsPanel、SettingsOverlay …

public/app-icon.svg · favicon.svg · wordmark.svg · tray-mark.svg
scripts/brand/export-icons.mjs   # npm run brand:icons → Dock / 托盘 PNG
src-tauri/icons/                 # ICNS/ICO；tray/ 为菜单栏模板
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
| 议程 | `list_agenda` | 今日/逾期：任务谓词 ∪ 各进行中事项的当前步；分类/标签独立页再按该项前端过滤 |
| 模板 | `list_playbooks`, `create_playbook`, `set_playbook_steps` | 实例化时拷贝步骤；创建后不能改 `playbook_id` |
| 事项 | `list_matters`, `create_matter`, `create_blank_matter`, `update_matter`, `archive_matter`, `restore_matter`, `delete_matter`, `update_matter_step`, `reorder_matter_steps`, `delete_matter_step`, `complete_matter_step`, `skip_matter_step`, `reopen_matter_step` | 与 tasks 分表；一事一步；默认列表不含归档 |
| 依据 | `add_step_link`, `remove_step_link`, `replace_step_link`, `open_step_link`, `reveal_step_link`, `pick_evidence_path` | 只存绝对路径；dialog 选路径，opener 打开 |
| 指标 | `list_cadences`, `create_cadence`, `update_cadence`, `get_cadence_progress` | 查询办结事项，不是累加器；不进今日 |
| 统计 | `get_stats_panel` | 一次返回统计卡片、周预估/实际、专注热力图 |
| 设置 | `get_settings`, `get_notification_settings`, `get_database_path`, … | 齿轮浮层；节假日同步需用户确认（S2） |
| 桌面面板 | `get_desktop_panel_snapshot`, `focus_task_from_panel`, `focus_matter_from_panel` | 托盘切换显示；只读调度清单 |
| 备份 | （无 JSON 命令） | 设置页「备份到…」一键存 `docket-YYYYMMDD-HHMM.db` 快照（VACUUM INTO，含 WAL 内容），或展示/打开 `docket.db` 路径直接复制；**不含**事项依据指向的卷宗文件 |

`bindings/types.ts` 重新导出 `generated.ts`（`npm run generate:bindings` / `npm run check:bindings`）。**不提供** JSON 导入导出。长任务列表 ≥40 条时窗口化虚拟滚动。任务变更后调用 `invalidateAfterTaskMutation()` 刷新多视图。

> 对象模型见 [`docs/plans/2026-10-29-matters-playbooks-cadences.md`](docs/plans/2026-10-29-matters-playbooks-cadences.md)；壳层见 [`docs/plans/2026-11-02-app-shell.md`](docs/plans/2026-11-02-app-shell.md)。`docs/superpowers/` 为早期规划稿（任务-only 设想已被事项模型取代）；**以本 README、`docs/README.md` 与代码为准**。

### 错误处理（Rust）

命令层内部使用 `AppError`（`thiserror`），经 `Result<_, String>` 返回给前端，例如 `task not found (id=…)`、`database lock poisoned`。

## 数据库

- 路径：系统应用数据目录下的 `docket.db`
- 迁移：`_migrations` 表版本化（当前 **v7**：v6 的指标过滤器 RESTRICT，外加 `matters.notes`、`matter_steps.due_notified`）
- 完整性：启动时 `PRAGMA integrity_check`

## 许可证

MIT
