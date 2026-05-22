# Docket v2 — 深度集成增强设计

> 日期：2026-05-12 | 基线：v3 CSS Modules 扁平风格

---

## 一、整体集成架构

所有功能通过 `stores/index.ts` 的 `taskFilters` memo 统一驱动：

```
日历日期格  ──点击──→  selectedDate ──→  taskFilters.due_date ──→  list_tasks
日历日期格  ──双击──→  CreateTaskDialog(defaultDueDate)
任务卡片    ──拖拽──→  日历日期格 ──→  update_task(due_date)
任务完成    ──→      recurrence_rule? ──→  生成下一个实例
提醒轮询    ──→      tauri-plugin-notification ──→  OS 通知
归档        ──→      status='archived' ──→  [恢复]按钮可见
```

---

## 二、主题三态切换

### 2a. 新增 Stores Signals

```typescript
themeMode: 'light' | 'dark' | 'system'  // 默认 'system'
resolvedTheme: 'light' | 'dark'          // 计算值
```

- `themeMode` 持久化到 `localStorage`，启动时读取
- `resolvedTheme` = `themeMode === 'system'` 时查询 `matchMedia('(prefers-color-scheme: dark)')`，否则等于 `themeMode`

### 2b. CSS 改造

`global.css` 改为：

```css
[data-theme="light"] { /* light variables */ }
[data-theme="dark"]  { /* dark variables */ }
/* 再用 @media (prefers-color-scheme: dark) 作为 system 模式 fallback */
```

所有组件 CSS 零改动（只依赖 `--*` 变量名）。

### 2c. UI 控件

TopBar 最右侧加单色线条 SVG 按钮（太阳/月亮/显示器图标），点击轮换三态。图标用 `currentColor` 继承，16px。

---

## 三、日历全面联动

### 3a. 点击日期 → 筛选任务列表

- `taskFilters` memo 加入 `due_date: selectedDate() ?? undefined`
- TaskList 标题改为 `{viewTitle} · {selectedDate}`（有日期筛选时）
- 再次点击同日期 → `setSelectedDate(null)` 取消筛选

### 3b. 双击日期 → 快速创建

- `CalendarDay` 加 `onDblClick` → 回调传递日期到 App 层
- App 层打开 `CreateTaskDialog(defaultDueDate={双击日期})`
- 对话框日期输入框预填，可修改

### 3c. 拖拽任务到日期格

- `TaskCard` 加 `draggable="true"` + `onDragStart` 设置 `dataTransfer.setData('taskId', id)`
- `CalendarDay` 加 `onDragOver`（preventDefault + 高亮边框 accent 虚线）+ `onDrop`（调 `update_task(due_date)`）
- 拖拽时 TaskCard 半透明、日期格 border accent 虚线

### 3d. 指示点优化

- task_count ≤ 3：逐个显示圆点（蓝=未完成，绿=完成）
- task_count > 3：显示 3 个圆点 + 文字 `+N`

### 3e. 统计面板日历

- `StatsPanel` 左侧加迷你月历（复用 Calendar + CalendarDay 的小号版本），点击日期 → `selectedDate` → 统计展示该日数据

---

## 四、重复任务

### 4a. 创建对话框新增配置区

`CreateTaskDialog` 底部可展开"重复"区：
- 开关：不重复 / 重复
- 展开后：频率下拉（每日/每周/每月）、间隔数字输入（默认1）
- 仅频率=每周：一排 7 个星期按钮，可多选，accent 高亮
- 终止条件：永不停止 / 到日期 / N次后停止
- 到日期 → 日期选择器；N次 → 数字输入

### 4b. 详情面板显示 + 编辑

`TaskDetail` meta 区显示可读摘要（如"每周一三五 · 永不停止"），点击可内联编辑

### 4c. 后端修复 end_count

`complete_task` 中插入新实例前，追溯 `recurrence_parent_id` 链计数已生成实例数，与 `end_count` 比较。超过则不生成。

### 4d. 后端修复 list_archived 排序

`allowed_fields` 数组加入 `"archived_at"`

---

## 五、提醒系统

### 5a. 后端新命令

`src-tauri/src/commands/reminders.rs`：
- `add_reminder(task_id, remind_at: String)` → `Reminder`
- `remove_reminder(id)` → `()`

### 5b. 调度器 OS 通知

`scheduler.rs` 改为通过 `AppHandle` 调用 `tauri-plugin-notification` 发送真实系统通知。

### 5c. 前端提醒 UI

`TaskDetail` 详情面板子任务区域下方新增：
- 已有提醒列表（日期时间 + 删除按钮）
- 添加区域：日期时间 input + [添加]按钮
- 已通知状态小圆点标记

### 5d. 数据

`reminders.remind_at` 存完整 ISO datetime（含时分），`notified` 标记已发送。

---

## 六、修复项

| # | 修复 | 位置 |
|---|------|------|
| 1 | 归档任务恢复按钮 | `TaskDetail.tsx` footer 区，status='archived'时显示 |
| 2 | 创建对话框加描述 textarea | `CreateTaskDialog` |
| 3 | 创建对话框加分类下拉 + 标签多选 | `CreateTaskDialog` |
| 4 | 补优先级筛选 | `TaskList` FilterBar + `taskFilters` 并入 `activePriority` |
| 5 | 补排序控件 | `TaskList` 标题右侧排序下拉 → `taskFilters` sort |
| 6 | 过期任务红色左侧线 | `TaskCard` 判断 `due_date < today` 时加 `.cardOverdue` |
| 7 | 归档列表隐藏复选框 + 显示恢复按钮 | `TaskCard` 接受 `showCheckbox` prop |

---

## 七、改动清单

### Backend (Rust)

| 文件 | 改动 |
|------|------|
| `commands/reminders.rs` | 新建 — `add_reminder` / `remove_reminder` |
| `commands/mod.rs` | 注册新模块 |
| `lib.rs` | 注册 2 个新命令 |
| `scheduler.rs` | 改为通过 AppHandle 发送真实 OS 通知 |
| `recurrence.rs` | 修复 `end_count` 检查 |
| `commands/tasks.rs` | `complete_task` 加 end_count 计数 + `list_archived` 排序字段 |

### Frontend (Solid.js)

| 文件 | 改动 |
|------|------|
| `styles/global.css` | 新增 `[data-theme]` 选择器 |
| `stores/index.ts` | 新增 `themeMode`、`resolvedTheme`、`taskFilters` 加 `due_date`/`priority`、sort 字段动态化 |
| `App.tsx` | theme toggle 集成、日历双击回调、拖拽回调 |
| `TopBar/TopBar.tsx + .module.css` | 新增主题切换按钮 |
| `TaskCard/TaskCard.tsx + .module.css` | `showCheckbox` prop、`draggable`、过期红线 |
| `TaskList/TaskList.tsx + .module.css` | 优先级筛选、排序控件、标题显示日期 |
| `TaskDetail/TaskDetail.tsx + .module.css` | 恢复按钮、重复规则显示/编辑、提醒区域 |
| `CreateTaskDialog/CreateTaskDialog.tsx + .module.css` | 描述 textarea、分类下拉、标签多选、重复配置区 |
| `Calendar/Calendar.tsx + .module.css` | 双击回调、拖拽回调 |
| `CalendarDay/CalendarDay.tsx + .module.css` | onDblClick、onDragOver、onDrop、指示点多点+溢出 |
| `StatsPanel/StatsPanel.tsx + .module.css` | 左侧迷你月历 + 按日统计 |

### 后端零改动
- `db.rs`、`models.rs`（除 end_count 逻辑）
- 所有现有命令逻辑（仅增量修改）
