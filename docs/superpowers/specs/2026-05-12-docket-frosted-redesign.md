# Docket 前端重设计方案 — "霜雾精炼"

> 日期：2026-05-12 | 关联规格：`2026-05-11-docket-design.md` `2026-05-11-docket-frontend.md`

---

## 美学方向

**"霜雾精炼" (Frosted Precision)** — Notion 的空间克制 + Vercel 的几何精确 + 毛玻璃的深度幻觉。

| 维度 | 决策 |
|------|------|
| **基调** | 克制极简（refined minimalism），每像素都有存在的理由 |
| **毛玻璃** | 所有面板 `backdrop-blur(20~32px)` + 半透明背景，创造漂浮层次 |
| **色彩** | 单一强调色 `#0070F3`，其余全部中性灰度 |
| **字体** | 系统原生无衬线栈，无外部加载 |
| **动效** | 150~250ms ease / cubic-bezier，零弹性、零卡顿感 |

---

## 设计 Token

### 色彩（Light）

| Token | 值 | 用途 |
|-------|-----|------|
| `--bg-root` | `#F0F2F5` | 根背景 |
| `--glass-bg` | `rgba(255,255,255,0.72)` | 毛玻璃面板 |
| `--glass-border` | `rgba(0,0,0,0.06)` | 玻璃边框 |
| `--glass-shadow` | `0 1px 3px rgba(0,0,0,0.04)` | 默认玻璃阴影 |
| `--glass-shadow-hover` | `0 4px 16px rgba(0,0,0,0.08)` | 悬停阴影 |
| `--solid-bg` | `#FFFFFF` | 实色背景 |
| `--solid-hover` | `#F5F6F8` | 悬停背景 |
| `--solid-active` | `#EEF2FF` | 激活背景 |
| `--text-primary` | `#0F1115` | 主文字 |
| `--text-secondary` | `#6B7280` | 辅助文字 |
| `--text-tertiary` | `#9CA3AF` | 占位/禁用 |
| `--accent` | `#0070F3` | 强调色 |
| `--accent-soft` | `rgba(0,112,243,0.08)` | 强调色背景 |
| `--success` | `#10B981` | 完成 |
| `--danger` | `#EF4444` | 删除/逾期 |

### 色彩（Dark）

| Token | 值 |
|-------|-----|
| `--bg-root` | `#0A0A0D` |
| `--glass-bg` | `rgba(22,22,28,0.78)` |
| `--glass-border` | `rgba(255,255,255,0.06)` |
| `--solid-bg` | `#16161C` |
| `--solid-hover` | `#1E1E26` |
| `--solid-active` | `#1A1E30` |
| `--text-primary` | `#EEEEF0` |
| `--text-secondary` | `#8B8D98` |
| `--text-tertiary` | `#5E606A` |

---

## 字体层级

桌面应用观察距离约 50-70cm。

| 用途 | 字号 | 字重 | 行高 |
|------|------|------|------|
| 弹窗标题 | 15px | 600 | 1.3 |
| 视图标题 | 14px | 500 | 1.4 |
| 任务标题 / 正文 | 13px | 400/500 | 1.5 |
| 元数据 | 11px | 400 | 1.4 |
| 辅助标签 | 10px | 500 | 1.3 |
| 侧栏分区标签 | 10px | 600 | 1.3, tracking 0.05em, 大写 |
| 顶栏品牌名 | 13px | 500 | 1 |
| 按钮 | 13px | 500 | 1 |
| 输入框 | 13px | 400 | 1.5 |
| 统计数字 | 28px | 600 | 1.2 |
| 日历日期 | 12px | 400/500 | 1 |

---

## 视觉层级（深度递增）

| 层 | 元素 | 样式 |
|----|------|------|
| 0 | 根背景 + 点阵纹理 | `#F0F2F5 bg`, `radial-gradient` 圆点 opac 0.18 |
| 1 | 侧栏、顶栏 | `glass-heavy`, `blur(32px)`, 微阴影 |
| 2 | 任务卡片、日历日期格、统计卡片 | `glass`, `blur(20px)`, 阴影, hover 抬起 |
| 3 | 详情面板 / 弹窗 | `glass`, `blur(20px)`, 重阴影, slide/scale 入场 |
| 4 | Toast | 最高 z-index, 毛玻璃 + scale 动效 |

---

## 组件改造清单

| 组件 | 文件 | 改动要点 |
|------|------|----------|
| 基础样式 | `src/index.css` | 设计 Token、动画库、点阵纹理、玻璃工具类、滚动条 |
| 主布局 | `src/App.tsx` | 顶层 glass-heavy，中层 glass 卡片，底部点阵纹理 |
| 新建弹窗 | `CreateTaskDialog.tsx` | 玻璃弹窗，scale-in 入场, 半透明模糊遮罩 |
| 详情面板 | `TaskDetail.tsx` | 右侧玻璃滑入，slide-left 动画 |
| 日历 | `Calendar.tsx` | 日期格 glass 微面板，今日 accent 圆环 |
| 统计 | `StatsPanel.tsx` | 指标卡片 glass，折线 accent 色 |
| 搜索栏 | `SearchBar.tsx` | 半透明输入框嵌入顶栏 |
| 筛选栏 | `FilterBar.tsx` | 玻璃横条内联在任务列表上方 |
| 子任务 | `SubtaskList.tsx` | 复选框动画，紧凑间距 |

---

## 不改的部分

- Rust 后端：零改动
- `src/stores/index.ts`：零改动
- `src/bindings/commands.ts`：零改动
- 业务逻辑、数据流：完全不变

---

## 暗色模式

通过 `prefers-color-scheme: dark` 自动切换，点阵纹理 opacity 降至 0.10。
