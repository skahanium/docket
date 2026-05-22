# Docket 前端架构设计

> 日期：2026-05-11 | 关联规格：`2026-05-11-docket-design.md`

---

## 设计哲学

全程贯彻 **Vercel Geist 设计语言**——克制、几何、快速响应。

**核心原则：**
- 每个操作必须有即时的视觉反馈，不可有"卡住"的感觉
- 动画短促（150-200ms），只用 ease / ease-out，禁用弹性或减速曲线
- 骨架屏优先于 spinner，减少布局跳动
- 所有可交互元素必须有 hover、focus、active 三态
- 深色/浅色主题平滑切换（transition on `color`, `background-color`, `border-color`）

---

## 组件树

```
App
├── TopBar
│   ├── SearchBar
│   └── CreateButton
├── Sidebar
│   ├── ViewSection      （全部/今日/日历）
│   ├── CategorySection  （动态分类列表）
│   ├── TagSection       （动态标签列表）
│   └── ActionSection    （统计/归档）
└── MainContent
    ├── TaskList          （全部/今日 视图）
    │   ├── FilterBar
    │   ├── TaskCard[]
    │   │   └── SubtaskList
    │   └── EmptyState / LoadingSkeleton / ErrorState
    ├── CalendarContainer  （日历 视图）
    │   ├── CalendarHeader
    │   ├── CalendarGrid
    │   │   └── CalendarDay[]
    │   └── DateTaskList    （联动：选中日期的任务列表）
    ├── StatsPanel         （统计 视图）
    └── ArchiveList        （归档 视图）
├── TaskDetailPanel        （右侧滑出面板）
├── CreateTaskDialog       （模态弹窗）
└── ToastContainer         （全局 toast 通知）
```

---

## 组件接口定义

### App

```typescript
// 无 props，根组件持有全部全局信号
```

### TopBar

```typescript
interface TopBarProps {
  onSearch: (query: string) => void
  onClearSearch: () => void
  onCreateClick: () => void
}
```

### SearchBar

```typescript
interface SearchBarProps {
  value: string
  placeholder?: string           // 默认 "搜索任务…"
  onInput: (value: string) => void
  onClear: () => void
}
```

### Sidebar

```typescript
type ViewKind = 'all' | 'today' | 'calendar' | 'stats' | 'archive'

interface SidebarProps {
  activeView: Accessor<ViewKind>
  activeCategoryId: Accessor<number | null>
  activeTagId: Accessor<number | null>
  categories: Accessor<Category[]>
  tags: Accessor<Tag[]>
  todayCount: Accessor<number>
  onViewChange: (view: ViewKind) => void
  onCategorySelect: (id: number | null) => void
  onTagSelect: (id: number | null) => void
  onCreateCategory: (name: string) => void
  onCreateTag: (name: string) => void
}
```

### TaskList

```typescript
interface TaskListProps {
  tasks: Accessor<TaskSummary[]>
  loading: Accessor<boolean>
  error: Accessor<string | null>
  onTaskClick: (id: number) => void
  onTaskComplete: (id: number) => void
  onRetry: () => void
  onClearFilter: () => void
  hasActiveFilter: Accessor<boolean>
}
```

### TaskCard

```typescript
interface TaskCardProps {
  task: TaskSummary
  onToggle: (id: number) => void
  onClick: (id: number) => void
  draggable?: boolean
  onDragStart?: (id: number, e: DragEvent) => void
}
```

### TaskDetail

```typescript
interface TaskDetailProps {
  task: Accessor<Task | null>          // null 表示未选中
  loading: Accessor<boolean>
  error: Accessor<string | null>
  onClose: () => void
  onSave: (id: number, data: Partial<Task>) => void
  onComplete: (id: number) => void
  onArchive: (id: number) => void
  onAddSubtask: (taskId: number, title: string) => void
  onRetry: () => void
}
```

### SubtaskList

```typescript
interface SubtaskListProps {
  subtasks: Subtask[]
  onToggle: (subtaskId: number) => void
  onAdd: (title: string) => void
  onDelete: (subtaskId: number) => void
  onReorder: (orderedIds: number[]) => void
}
```

### Calendar

```typescript
interface CalendarDayData {
  date: string           // "2026-05-11"
  taskCount: number
  completedCount: number
}

interface CalendarContainerProps {
  year: Accessor<number>
  month: Accessor<number>
  monthData: Accessor<CalendarDayData[]>
  loading: Accessor<boolean>
  error: Accessor<string | null>
  selectedDate: Accessor<string | null>
  tasksForDate: Accessor<TaskSummary[]>
  onDateSelect: (date: string) => void
  onDateDoubleClick: (date: string) => void
  onMonthChange: (year: number, month: number) => void
  onDrop: (taskId: number, date: string) => void
}
```

### CalendarDay

```typescript
interface CalendarDayProps {
  data: CalendarDayData
  isToday: boolean
  isSelected: boolean
  isCurrentMonth: boolean
  onSelect: () => void
  onDoubleClick: () => void
  onDragOver: (e: DragEvent) => void
  onDrop: (e: DragEvent) => void
}
```

### StatsPanel

```typescript
interface Statistics {
  todayCount: number
  overdueCount: number
  weeklyCompletionRate: number    // 0-1
  dailyCounts: { date: string; completed: number }[]
}

interface StatsPanelProps {
  stats: Accessor<Statistics | null>
  loading: Accessor<boolean>
  error: Accessor<string | null>
  onRetry: () => void
}
```

### CreateTaskDialog

```typescript
interface CreateTaskDialogProps {
  open: boolean
  defaultDueDate?: string          // 从日历双击创建时传入
  onClose: () => void
  onSubmit: (data: CreateTaskInput) => void
}

interface CreateTaskInput {
  title: string
  description?: string
  priority: number                  // 0|1|2
  dueDate?: string
  categoryId?: number
}
```

### FilterBar

```typescript
interface FilterBarProps {
  categories: Accessor<Category[]>
  tags: Accessor<Tag[]>
  activeCategoryId: Accessor<number | null>
  activeTagId: Accessor<number | null>
  priority: Accessor<number | null>
  onCategoryChange: (id: number | null) => void
  onTagChange: (id: number | null) => void
  onPriorityChange: (level: number | null) => void
  onClearAll: () => void
}
```

### ToastContainer

```typescript
interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}

// ToastContainer 由全局 toastStore 管理，无外部 props
```

---

## 状态管理与数据流

### 信号定义（`src/stores/index.ts`）

```typescript
import { createSignal, createResource, createMemo } from 'solid-js'
import { invoke } from '@tauri-apps/api/core'

// ─── 视图与筛选 ───
export const [activeView, setActiveView] = createSignal<ViewKind>('all')
export const [selectedTaskId, setSelectedTaskId] = createSignal<number | null>(null)
export const [searchQuery, setSearchQuery] = createSignal('')
export const [activeCategoryId, setActiveCategoryId] = createSignal<number | null>(null)
export const [activeTagId, setActiveTagId] = createSignal<number | null>(null)
export const [activePriority, setActivePriority] = createSignal<number | null>(null)

// ─── 数据资源（响应式 fetch） ───
const filters = createMemo(() => ({
  status: activeView() === 'archive' ? 'archived' as const : 'active' as const,
  category_id: activeCategoryId(),
  tag_id: activeTagId(),
  search_query: searchQuery() || undefined,
  today_view: activeView() === 'today',
}))

export const [tasks, { refetch: refetchTasks }] = createResource(filters, (f) =>
  invoke<TaskSummary[]>('list_tasks', { filters: f, sort: { field: 'due_date', direction: 'asc' } })
)

export const [categories, { refetch: refetchCategories }] = createResource(
  () => true,
  () => invoke<Category[]>('list_categories')
)

export const [tags, { refetch: refetchTags }] = createResource(
  () => true,
  () => invoke<Tag[]>('list_tags')
)

// selectedTask 在 id 变化时 fetch
export const [taskDetail, { refetch: refetchDetail }] = createResource(selectedTaskId, (id) =>
  id ? invoke<Task | null>('get_task', { id }) : null
)

// calendar 数据
export const [calendarYear, setCalendarYear] = createSignal(new Date().getFullYear())
export const [calendarMonth, setCalendarMonth] = createSignal(new Date().getMonth() + 1)
export const [selectedDate, setSelectedDate] = createSignal<string | null>(null)

export const [calendarData] = createResource(
  () => ({ year: calendarYear(), month: calendarMonth() }),
  ({ year, month }) => invoke<CalendarDayData[]>('get_calendar_month', { year, month })
)

// ─── 通知 ───
export const [toasts, setToasts] = createSignal<Toast[]>([])

export function pushToast(type: Toast['type'], message: string) {
  const id = crypto.randomUUID()
  setToasts(prev => [...prev, { id, type, message }])
  setTimeout(() => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, 3000)
}
```

### 数据流向

```
┌─────────────────────────────────────────────────────────────┐
│  用户交互（点击/输入/拖拽）                                    │
│      ↓                                                      │
│  组件事件处理函数                                             │
│      ↓                                                      │
│  invoke('command_name', { ...args })                        │
│      ↓                                                      │
│  Tauri Command (Rust) → SQLite → Result<T, String>          │
│      ↓                                  ↓                   │
│  Ok(data)                          Err(msg)                 │
│      ↓                                  ↓                   │
│  更新信号 / refetch()              pushToast('error', msg)   │
│      ↓                                                      │
│  响应式重新渲染                                              │
└─────────────────────────────────────────────────────────────┘
```

**规则：**
- 组件之间不直接传递业务数据，统一通过 signals + `createResource` 获取
- 子组件只接收按需裁剪的最小 Props（如 `TaskCard` 接收单个 `task`，不接收整个列表）
- 所有 `invoke` 调用集中在 `src/bindings/commands.ts` 封装，组件不直接 import `@tauri-apps/api/core`

---

## 视图路由方案

不使用第三方路由库。基于 `activeView` 信号的条件渲染，切换即更新。

```tsx
// App.tsx 主内容区
const MainContent: Component = () => {
  return (
    <Switch>
      <Match when={activeView() === 'all'}>
        <TaskList /* ... */ />
      </Match>
      <Match when={activeView() === 'today'}>
        <TaskList /* ... */ todayView />
      </Match>
      <Match when={activeView() === 'calendar'}>
        <CalendarContainer /* ... */ />
      </Match>
      <Match when={activeView() === 'stats'}>
        <StatsPanel /* ... */ />
      </Match>
      <Match when={activeView() === 'archive'}>
        <ArchiveList /* ... */ />
      </Match>
    </Switch>
  )
}
```

**视图切换行为：**
- 切换视图时：先显示新视图的骨架屏（`loading` 信号重置为 `true`），待 `createResource` 返回后渲染数据
- 保留每个视图的筛选/滚动状态，不销毁 DOM（使用 `<Show>` 或 `display:none` 而非移除）

---

## 交互反馈规范

### 全局过渡

| 操作 | 动画 | 时长 | 缓动 |
|---|---|---|---|
| 视图切换 | 内容区 cross-fade（opacity 0 → 1） | 150ms | ease |
| 主题切换 | `color`, `background-color`, `border-color` transition | 200ms | ease |
| 侧栏分类/标签折叠 | 子列表 height 展开/收起 | 200ms | ease-out |
| 详情面板打开 | transform translateX(100% → 0)，backdrop fade | 200ms | ease-out |
| 详情面板关闭 | transform translateX(0 → 100%)，backdrop fade | 150ms | ease-in |
| 模态弹窗打开 | scale(0.95→1) + opacity(0→1) + backdrop blur | 200ms | ease-out |
| 模态弹窗关闭 | scale(1→0.95) + opacity(1→0) | 150ms | ease-in |
| Toast 进入 | 从顶部 slide-in (translateY: -8px → 0) + opacity(0→1) | 200ms | ease-out |
| Toast 退出 | opacity(1→0) | 200ms | ease |

### 按钮交互

| 状态 | 表现 |
|---|---|
| 默认 | 背景 `#0070F3`，文字白色，`border-radius: 6px` |
| hover | 背景 `#005FC5`（10% 加深），transition 150ms ease |
| active | `transform: scale(0.98)`，100ms |
| focus-visible | 外圈 2px `#0070F3` 50% 透明度，`outline-offset: 2px` |
| disabled | 背景 `#E5E5E5`，文字 `#A3A3A3`，cursor not-allowed |
| loading | 文字隐藏，显示 16px spinner，按钮宽度不变 |

### 输入框交互

| 状态 | 表现 |
|---|---|
| 默认 | border `#E5E5E5`，bg `transparent`，`border-radius: 6px` |
| hover | border `#D4D4D4`，transition 150ms |
| focus | border `#0070F3`，外圈 `0 0 0 3px rgba(0,112,243,0.15)` |
| error | border `#EF4444`，下方红色 12px 提示文字 |
| disabled | bg `#F5F5F5`，cursor not-allowed |

### 任务卡片

| 操作 | 反馈 |
|---|---|
| hover | `transform: translateY(-1px)`, shadow `0 4px 12px rgba(0,0,0,0.10)`，150ms ease |
| 点击 | 选中态：左侧 2px `#0070F3` 竖线，bg 微蓝 `#F0F7FF` |
| 完成勾选 | 复选框：scale(1→1.2→1) 150ms，勾号 stroke-dash 动画 300ms；卡片标题：line-through + `#A3A3A3` 300ms |
| 拖拽开始 | `transform: scale(1.02)`, shadow `0 8px 24px rgba(0,0,0,0.15)`, opacity 0.9 |
| 拖拽悬停目标 | 目标位置插入 3px `#0070F3` 横线指示 |
| 逾期任务 | 左侧 2px `#EF4444` 细线（持续显示），红色圆点指示器 |
| 进展条 | 宽度变化时 `transition: width 300ms ease` |

### 卡片关键 CSS

```css
.task-card {
  transition: transform 150ms ease, box-shadow 150ms ease, background-color 150ms ease;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  cursor: pointer;
}
.task-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.10);
}
.task-card.selected {
  background-color: #F0F7FF;
  box-shadow: inset 2px 0 0 0 #0070F3;
}
.task-card.dragging {
  transform: scale(1.02);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  opacity: 0.9;
}

/* 复选框动画 */
.checkbox-icon {
  transition: transform 150ms ease;
}
.checkbox-icon:active {
  transform: scale(0.9);
}
.checkbox-icon.checked {
  transform: scale(1.2);
}
.checkbox-checkmark {
  stroke-dasharray: 16;
  stroke-dashoffset: 16;
  transition: stroke-dashoffset 300ms ease;
}
.checkbox-icon.checked .checkbox-checkmark {
  stroke-dashoffset: 0;
}
```

### 日历日期格

| 操作 | 反馈 |
|---|---|
| hover | bg `#F5F5F5`，100ms ease |
| 选中（点击） | bg `#F0F7FF`，文字 `#0070F3`，左侧同步更新 DateTaskList |
| 双击 | 弹出 CreateTaskDialog，自动带入双击日期 |
| 今日 | 日期数字加 `#0070F3` 圆环（18px），`border: 2px solid #0070F3` |
| 拖拽悬停（任务拖到日期格） | 日期格 border `2px dashed #0070F3`，bg `#F0F7FF` |
| 指示点 | 出现时 `transform: scale(0→1)`，200ms ease-out，依次 stagger 50ms |
| 非当月日期 | 文字 `#D4D4D4`，无交互（hover/click disabled） |

### 骨架屏

```css
.skeleton {
  background: linear-gradient(90deg, #E5E5E5 25%, #F5F5F5 50%, #E5E5E5 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

**各组件骨架布局：**
- TaskList：3 行，每行 64px 高，含圆形 + 两条文字条
- Calendar：月历网格完整渲染，日期格内无指示点，月份标题旁 16px spinner
- StatsPanel：4 张指标卡片（120×80px） + 1 条图表区域（h-48），均为灰色占位
- TaskDetail：右侧面板内标题条 + 描述区 + 3 条子任务行

### 进度条

```css
.progress-bar {
  height: 4px;
  border-radius: 2px;
  background: #E5E5E5;
  transition: width 300ms ease;
}
.progress-bar-fill {
  height: 100%;
  border-radius: 2px;
  background: #0070F3;
  transition: width 300ms ease;
}
```

### 空状态插画

- 居中：1 个 SVG 线条插画（简约几何风格，颜色 `#D4D4D4`）+ 下方提示文字（`#A3A3A3`）
- 如果有关联操作，插画下方放一个按钮（如"创建第一个任务"）
- 插画建议：空白清单图标（方框 + 笔触），2px 描边，`round` 线帽

### Toast 通知

```css
.toast {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 9999;
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 13px;
  animation: toast-in 200ms ease-out;
  max-width: 320px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}
.toast-success { background: #F0FDF4; color: #166534; border: 1px solid #BBF7D0; }
.toast-error   { background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; }
.toast-info    { background: #EFF6FF; color: #1E40AF; border: 1px solid #BFDBFE; }

@keyframes toast-in {
  from { transform: translateY(-8px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
```

---

## 深色模式适配

所有颜色通过 CSS 变量切换，不在组件内硬编码颜色。

```css
:root {
  --bg-primary: #FAFAFA;
  --bg-secondary: #FFFFFF;
  --bg-hover: #F5F5F5;
  --text-primary: #171717;
  --text-secondary: #737373;
  --border: #E5E5E5;
  --accent: #0070F3;
  --accent-light: #F0F7FF;
  --danger: #EF4444;
  --success: #10B981;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #0A0A0A;
    --bg-secondary: #171717;
    --bg-hover: #1A1A1A;
    --text-primary: #EDEDED;
    --text-secondary: #A3A3A3;
    --border: #262626;
    --accent: #0070F3;
    --accent-light: #0D1F3C;
  }
}

/* 全局过渡，确保主题切换流畅 */
body, body * {
  transition: background-color 200ms ease, color 200ms ease, border-color 200ms ease;
}
```

---

## 命名规范

| 类别 | 规范 | 示例 |
|---|---|---|
| 组件文件 | PascalCase | `TaskCard.tsx`, `CalendarDay.tsx` |
| 组件函数 | PascalCase | `function TaskCard() {}` |
| Signals | camelCase | `activeView`, `selectedTaskId` |
| Store 导出 | camelCase（信号前缀无特殊标记） | `tasks`, `categories`, `toasts` |
| 事件处理 | `on` + 动作 | `onToggle`, `onDragStart` |
| Props 接口 | 组件名 + `Props` | `TaskCardProps`, `CalendarProps` |
| Tauri invoke 封装 | 与 Rust 命令同名，camelCase | `createTask()`, `listTasks()` |
| CSS class | kebab-case | `.task-card`, `.progress-bar` |

---

## 性能注意事项

- 任务列表使用 `<For>` 而非 `Array.map`，利用 Solid.js 的 keyed 渲染避免重复创建 DOM
- 日历 42 格固定渲染，不动态增删
- 搜索使用防抖 200ms，避免每次击键触发 `invoke`
- 骨架屏纯 CSS（`@keyframes shimmer`），无 JS 开销
- Toast 最多同时显示 3 条，超出的丢弃旧 toast
- `createResource` 设置 `staleTime: 0`，切换筛选立即 refetch
- 所有 `invoke` 调用无 `await` 阻塞渲染——`createResource` 在 Promise resolve 后自动更新
