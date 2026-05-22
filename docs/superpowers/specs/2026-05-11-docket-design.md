# Docket 设计规格

> 日期：2026-05-11 | 状态：待审阅

## 概述

Docket 是一个本地运行、低负载、对老设备友好的桌面任务管理应用。跨平台（Windows + macOS），基于 Tauri v2 构建，采用 Solid.js 前端 + Rust 命令层架构。

---

## 技术栈

| 层 | 选型 |
|---|---|
| 桌面框架 | Tauri v2 |
| 前端 UI | Solid.js + TypeScript + Vite |
| 样式 | Tailwind CSS |
| 数据库 | SQLite（rusqlite 直连） |
| 系统通知 | tauri-plugin-notification |
| 系统托盘 | `tauri::tray` API |
| 打包 | tauri-bundler → .msi / .dmg |

**核心原则**：
- JS 只管渲染，所有业务逻辑、数据读写、提醒调度全在 Rust 侧
- 单文件 SQLite 数据库（`docket.db`），备份即复制
- 托盘常驻，后台轮询提醒
- 零网络依赖，完全离线

---

## 设计风格

遵循 **Vercel 简约风格**，贯穿全部界面——几何、克制、单一强调色。

**配色**

- 背景：`#FAFAFA`（浅） / `#0A0A0A`（深）
- 前景文字：`#171717` / `#EDEDED`
- 次级文字：`#737373` / `#A3A3A3`
- 边框/分割线：`#E5E5E5` / `#262626`
- 强调色：`#0070F3`（Vercel 蓝），仅用于选中态、主按钮、日期标记
- 悬停：`#F5F5F5` / `#1A1A1A`
- 完成态：`#10B981`（绿色勾）
- 逾期标记：`#EF4444`（红色点），仅用于警示，不做大面积色块

**图标**

- 导航图标：SVG 线条图标（`feather` 风格），2px 描边、`round` 线帽
- 应用图标：纯几何形状，单色，无渐变无阴影
- 不使用 emoji 作为功能性图标

**字体**

- 系统原生无衬线字体栈：`"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif`
- 等宽：`"JetBrains Mono", "Fira Code", monospace`（仅日期/时间戳）

**间距与圆角**

- 基准单位 4px，内边距 8px/12px/16px，卡片间距 8px
- 圆角：面板 8px，卡片 6px，按钮 6px，输入框 6px
- 卡片阴影 `0 1px 3px rgba(0,0,0,0.08)`，悬停 `0 4px 12px rgba(0,0,0,0.10)`
- 侧栏宽度 200px

**优先级标记**

- 不高亮色块，改用空心圆环：`○` 低 / `◉` 中 / `◉◉` 高
- 逾期任务左侧边缘加 2px 红色细线，不闪不跳

---

## 数据模型

### 表结构

**`categories`** — 分类（支持二级嵌套）

```
id         INTEGER  PK
name       TEXT     UNIQUE NOT NULL
color      TEXT     可空
parent_id   INTEGER  可空 FK→categories
```

**`tags`** — 标签（扁平）

```
id     INTEGER  PK
name   TEXT     UNIQUE NOT NULL
color  TEXT     可空
```

**`tasks`** — 主任务

```
id                    INTEGER  PK
title                 TEXT     NOT NULL
description           TEXT
status                TEXT     'active' | 'completed' | 'archived'
priority              INTEGER  0=低 / 1=中 / 2=高
due_date              TEXT     可空，ISO 日期
category_id           INTEGER  可空 FK → categories
recurrence_rule       TEXT     可空，JSON 字符串
recurrence_parent_id  INTEGER  可空，生成实例指向父任务
created_at            TEXT     ISO 8601
updated_at            TEXT     ISO 8601
completed_at          TEXT     可空
archived_at           TEXT     可空
```

**`task_tags`** — 任务-标签关联

```
task_id  INTEGER
tag_id   INTEGER
PRIMARY KEY (task_id, tag_id)
```

**`subtasks`** — 子任务

```
id            INTEGER  PK
task_id       INTEGER  FK → tasks CASCADE
title         TEXT     NOT NULL
status        TEXT     'pending' | 'completed'
sort_order    INTEGER  DEFAULT 0
created_at    TEXT
completed_at  TEXT     可空
```

**`reminders`** — 提醒

```
id        INTEGER  PK
task_id   INTEGER  FK → tasks CASCADE
remind_at TEXT     NOT NULL  (ISO datetime)
notified  INTEGER  DEFAULT 0
```

### 设计决策

- **不区分短期/长期任务**：所有任务结构统一，有无子任务决定是否显示进度条。
- **进度动态计算**：`已完成子任务数 / 总子任务数 × 100%`，不存字段。
- **筛选覆盖**：短期待办 = 无子任务且无截止日；周期复盘 = 有子任务；日期任务 = 有截止日。
- **重复任务**：模板+实例模式——父任务持有 `recurrence_rule`，标记完成时生成下一实例。
- **归档**：软删除（`status = 'archived'`），可恢复。

### recurrence_rule 格式

存储在 `tasks.recurrence_rule` 中的 JSON 结构：

```json
{
  "freq": "daily" | "weekly" | "monthly",
  "interval": 1,
  "days": [1, 3, 5],
  "end_type": "never" | "date" | "count",
  "end_date": "2026-12-31",
  "end_count": 10
}
```

- `freq`：重复频率
- `interval`：间隔倍数（如 `freq: "weekly", interval: 2` = 每两周）
- `days`：仅 weekly 有效，指定周几（1=周一…7=周日）
- `end_type`：`"never"` 永不停止，`"date"` 到指定日期为止，`"count"` 重复 N 次

---

## 界面设计

### 窗口布局

```
┌──────────────────────────────────────────────────────┐
│ Docket                   搜索…       + 新建     ⚙ — □ │  ← 顶栏，32px
├──────────┬───────────────────────────────────────────┤
│ 全部      │                                            │
│ 今日      │         主内容区                            │
│ 日历      │         (列表 / 日历 / 统计)                │
│          │                                            │
│ ————————  │                                            │
│ 工作      │                                            │
│ 个人      │                                            │
│ + 分类    │                                            │
│ ————————  │                                            │
│ 设计      │                                            │
│ 项目      │                                            │
│ + 标签    │                                            │
│ ————————  │                                            │
│ 统计      │                                            │
│ 归档      │                                            │
└──────────┴───────────────────────────────────────────┘
  ← 200px →                ← flex-1 →
```

侧栏分区：**视图区**（全部/今日/日历）+ **分类区**（可折叠）+ **标签区**（可折叠）+ **功能区**（统计/归档）。当前选中项左侧 2px 蓝色竖线，文字 `#0070F3`。

### 五个主视图

1. **全部任务**：默认视图。排序（优先级/截止日/创建时间）、过滤（分类/标签/状态/关键字）。列表形式。
2. **今日视图**：筛选 `due_date = today OR (priority >= 2 AND status = 'active')`。列表形式，逾期任务标红点。
3. **日历视图**：月历网格，与任务深度联动（见下方）。
4. **统计面板**：指标卡片 + 7 天完成趋势折线。
5. **归档**：只读列表，显示已完成日期和归档日期，可恢复至 active。

### 日历视图规格

日历与任务列表**深度联动**——不是独立页面，是同一数据的两面。

**月历网格**

- 标准月视图，顶栏显示月份名 + ← 上月 / 下月 → 箭头
- 每个日期格内：当天的日期数字 + 任务指示点（最多 3 个，超出显示 `+N`）
- 指示点颜色：蓝色 = 有任务未完成，绿色 = 全部完成
- 点击日期 → 主区域切换为右侧「当日任务列表」，日历保留在左侧作为选择器

**联动机制**

- 在日历上点击日期 → `list_tasks` 过滤 `due_date = 选中日期` → 列表刷新
- 在任务列表上拖拽任务到日历日期 → 更新 `due_date`
- 在任务详情面板修改截止日 → 日历对应日期指示点实时更新
- 重复任务生成的实例自动出现在对应日期格中

**从日历快速创建**

- 双击日期格 → 弹出迷你创建框（标题 + 回车 → `create_task` 自动带该 `due_date`）
- Ctrl+点击日期 → 多选日期范围 → Ctrl+N → 创建跨日任务

**布局模式**

- 默认：日历占据主区域，点击日期后右侧滑出当日列表
- 可切换：日历 + 列表左右分栏（各 50%），实时同步

### 任务卡片

```
┌──────────────────────────────────────────┐
│ ☐ 完成 Q2 设计稿           [🔴 高]       │
│ 明天 14:00 截止       🏷 设计  🏷 项目    │
│ ▬▬▬▬▬▬▬░░░ 70%       3/5 子任务        │
├──────────────────────────────────────────┤
│ ☑ 确定配色方案                            │
│ ☐ 首页布局                               │
│ ☐ 响应式适配                              │
└──────────────────────────────────────────┘
```

- 详情面板：右侧滑出。
- 创建入口：顶栏「+ 新建」按钮，弹出对话框。

---

## Tauri Commands API

### 任务

```
create_task(title, description?, priority?, due_date?, category_id?, recurrence_rule?) → Task
update_task(id, title?, description?, priority?, due_date?, category_id?) → Task
complete_task(id) → Task    # 设 status='completed'，设 completed_at；有 recurrence_rule 则自动调 generate_next_occurrence
delete_task(id) → ()        # 级联删子任务、提醒、标签关联
get_task(id) → Task (含 tags, subtasks, reminders)
list_tasks(filters: {status?, category_id?, tag_id?, due_date?, search_query?, today_view?: bool}, sort: {field, direction}) → [TaskSummary]
```

### 子任务

```
add_subtask(task_id, title) → Subtask
update_subtask(id, title?, status?) → Subtask
delete_subtask(id) → ()
reorder_subtasks(task_id, ordered_ids: Vec<i64>) → ()
```

### 分类 & 标签

```
create_category(name, color?, parent_id?) → Category
list_categories() → [Category]

create_tag(name, color?) → Tag
list_tags() → [Tag]

add_tag_to_task(task_id, tag_id) → ()
remove_tag_from_task(task_id, tag_id) → ()
```

### 提醒

```
add_reminder(task_id, remind_at) → Reminder
remove_reminder(id) → ()
```

### 重复任务（内部）

> `generate_next_occurrence` 为 Rust 内部函数，由 `complete_task` 自动调用，不暴露给前端。

```
generate_next_occurrence(parent_task_id) → Task
```

### 统计

```
get_stats_panel(heatmap_days?) → { statistics, weekly_accuracy, focus_heatmap }（已合并原 get_statistics / get_weekly_accuracy / get_focus_heatmap）
```

### 日历

```
get_calendar_month(year, month) → [{ date, task_count, completed_count }]
```

日历数据独立查询——返回当月每一天的任务数和完成数，前端据此渲染指示点颜色。不重复调 `list_tasks`。

### 归档

```
archive_task(id) → ()
restore_task(id) → ()
list_archived() → [TaskSummary]
```

---

## 后台服务

### 提醒轮询

- `tauri::async_runtime::spawn` 启动独立 task，每 60 秒查询 `reminders` 表
- 条件：`remind_at <= now() AND notified = 0`
- 命中 → `tauri-plugin-notification` 发送 → 标记 `notified = 1`

### 系统托盘

- 右键菜单：显示窗口 / 快速添加 / 今日任务数 / 退出
- 快速添加弹输入框，确认后 `create_task`

### 重复任务生成

- `complete_task` 命令内部检查 `recurrence_rule`
- 有规则 → `generate_next_occurrence` 创建新实例
- 新实例继承父任务的标题、描述、分类、标签、子任务模板

---

## 前端状态管理

> 详细前端架构（组件接口、交互反馈、数据流、路由方案）见 `2026-05-11-docket-frontend.md`

Solid.js 原生信号，不引入第三方状态库：

- `activeView`：`createSignal<ViewKind>` — 当前视图
- `selectedTaskId`：`createSignal<number | null>` — 详情面板选中任务
- `searchQuery`、`activeCategoryId`、`activeTagId` — 筛选条件
- `tasks`、`categories`、`tags`：`createResource` 响应式数据获取
- `taskDetail`：`createResource(selectedTaskId, ...)` — 选中任务详情
- `calendarData`：`createResource` — 月历数据
- `toasts`：全局通知队列

切换视图/筛选 → `createResource` 调 `list_tasks` → 响应式刷新。

---

## 错误处理

| 场景 | 处理 |
|---|---|
| SQLite 锁冲突 | 单连接 serialized 模式，无竞争 |
| 数据库损坏 | 启动时 `PRAGMA integrity_check`，失败则提示恢复 |
| 非法输入 | Command 层参数校验，返回 `Result<T, String>` |
| 通知失败 | 静默降级，不弹错误 |

---

## 组件边界状态

每个数据组件需覆盖三种边界状态：**Loading**（数据加载中）、**Empty**（无数据可展示）、**Error**（加载失败）。

### 全局 Loading

- 应用启动期间：居中显示 Docket 图标 + "加载中…" 文字，文字颜色 `#737373`
- 局部数据加载（如切换视图后列表刷新）：骨架屏占位，避免布局跳动
  - 任务列表骨架：3 条占位卡片，每条高度 64px，灰色圆角条 `#E5E5E5` + shimmer 动画
  - 日历骨架：月历网格保留，日期格内无指示点
  - 统计面板：4 张指标卡片 + 折线图区域，灰色占位块

### 全局 Error

- 数据库打开失败时：居中错误面板
  - 警告图标 + "数据库无法访问" 标题
  - 描述文字："请检查磁盘空间或权限设置"
  - 操作按钮：[重试]（重新初始化连接）[打开数据目录]
- 单次命令失败时（如 create_task 返回 Err）：顶部 toast 提示 "操作失败：{错误信息}"，3 秒自动消失，toast 背景 `#FEE2E2` 文字 `#991B1B`

### TaskList 状态

| 状态 | 表现 |
|---|---|
| Loading | 3 条骨架卡片 |
| Empty（无筛选条件） | 居中插画 + "还没有任务" + [创建第一个任务] 按钮 |
| Empty（有筛选条件） | "没有匹配的任务" + [清除筛选] 链接 |
| Error | 列表区域显示 "加载失败" + [重试] 按钮 |

### Calendar 状态

| 状态 | 表现 |
|---|---|
| Loading | 月历网格正常显示，日期格内无指示点，月份标题旁 spinner |
| Empty（当月无任务） | 月历正常显示，所有日期格空白无指示点，无额外提示 |
| Error | 月份标题旁红色感叹号 + "日历数据加载失败" tooltip |

### TaskDetail 状态

| 状态 | 表现 |
|---|---|
| Loading | 右侧面板内骨架屏：标题条 + 描述区域 + 子任务列表占位 |
| 未选中任务 | 面板收起或显示 "请选择一个任务查看详情"（文字 `#A3A3A3`） |
| Error | "无法加载任务详情" + [重试] |

### StatsPanel 状态

| 状态 | 表现 |
|---|---|
| Loading | 4 张卡片 + 图表区域灰色占位 |
| Empty（无历史数据） | 卡片显示 0，"暂无统计数据，完成一些任务后这里会显示趋势" |
| Error | "统计加载失败" + [重试] |

### SearchBar / FilterBar 状态

| 状态 | 表现 |
|---|---|
| 搜索无结果 | 下拉提示 "未找到匹配结果" |
| 分类/标签为空 | 下拉显示 "暂无分类" / "暂无标签"，底部有 [新建] 入口 |

---

## 测试策略

### Rust 后端测试

- **框架：** `cargo test`（Rust 内置测试框架）
- **单元测试：** 每个 `commands/*.rs` 模块包含 `#[cfg(test)] mod tests`，覆盖正常路径 + 边界条件 + 错误路径
- **数据库测试：** 使用 `rusqlite::Connection::open_in_memory()` 创建内存数据库，每个测试独立建表
- **测试范围：**
  - 模型序列化/反序列化（serde）
  - 命令参数校验（空标题、非法日期、无效 ID）
  - 重复任务日期计算（recurrence.rs）—— 每日、每周、每月、间隔倍数、终止条件
  - 统计聚合逻辑（计数、分组、趋势计算）
  - 日历查询（跨月边界、空月）

### 前端测试

- **框架：** Vitest + solid-testing-library
- **配置：** `vitest.config.ts` 设置 `environment: 'jsdom'`
- **测试范围：**
  - 信号状态测试：taskStore 增删改、filterState 切换、activeView 路由
  - 组件渲染测试：各组件 loading/empty/error 状态
  - 用户交互测试：点击完成框、展开子任务、切换视图
  - Tauri invoke 模拟：mock `@tauri-apps/api/core.invoke()`，验证前端调用参数正确
- **覆盖率目标：** 核心业务逻辑 80%+，UI 组件 60%+

### 运行命令

```bash
# Rust 测试
cargo test

# 前端测试
npx vitest run

# 前端测试（watch 模式）
npx vitest
```

---

## 不在此版本范围

- 数据导入/导出（备份直接复制 `.db` 文件）
- 多语言 i18n（先中文，架构不排斥后续扩展）
- 云同步 / 多设备
- 插件系统

---

## 项目结构

```
Docket/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   ├── icons/
│   └── src/
│       ├── main.rs           # 入口，托盘+窗口设置
│       ├── lib.rs            # Tauri 初始化
│       ├── db.rs             # 数据库初始化、迁移
│       ├── models.rs         # 数据结构（Task, Subtask, Tag…）
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── tasks.rs      # 任务 CRUD
│       │   ├── subtasks.rs   # 子任务
│       │   ├── categories.rs # 分类
│       │   ├── tags.rs       # 标签
│       │   ├── reminders.rs  # 提醒
│       │   ├── stats.rs      # 统计
│       │   └── calendar.rs   # 日历查询
│       ├── recurrence.rs     # 重复任务逻辑
│       └── scheduler.rs      # 提醒轮询
├── src/
│   ├── main.tsx              # Solid.js 入口
│   ├── App.tsx               # 根组件（布局+路由）
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── TaskList.tsx
│   │   ├── TaskCard.tsx
│   │   ├── TaskDetail.tsx
│   │   ├── SubtaskList.tsx
│   │   ├── Calendar.tsx          # 月历网格 + 联动逻辑
│   │   ├── CalendarDay.tsx       # 单个日期格
│   │   ├── StatsPanel.tsx
│   │   ├── SearchBar.tsx
│   │   ├── FilterBar.tsx
│   │   └── CreateTaskDialog.tsx
│   ├── stores/
│   │   └── index.ts          # 信号定义
│   └── bindings/
│       └── commands.ts       # Tauri invoke 封装
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```
