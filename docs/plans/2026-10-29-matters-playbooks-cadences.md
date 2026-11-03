# 事项、流程模板与周期指标（现行设计）

权威来源：本文 + 仓库根目录 [README.md](../../README.md) + 代码。`docs/superpowers/` 为历史稿，不描述本模型。

## 调度台

琐碎工作是**任务**（`tasks`）。有固定程序的工作是**事项**（`matters`），由**流程模板**实例化，或空白事项现场加步。今日列表是**一事一步**：任务自己一行；每个进行中事项只露出当前未完成步。

周期**指标**在**进展**页（与统计同一页下滚），不出现在今日。计数按办结事项查询，不是累加器。模板编辑在设置浮层；新建对话框仍可选模板。

## 对象

| 对象 | 表 | 含义 |
|------|-----|------|
| 流程模板 | `playbooks` / `playbook_steps` | 可复用步骤序列 |
| 事项 | `matters` / `matter_steps` | 一件工作；`playbook_id` 可空（空白事项） |
| 依据 | `matter_step_links` | 步骤上的本地文件或文件夹路径，只关联不拷贝 |
| 周期指标 | `cadences` + 过滤表 | 月 / 季 / 年；`target_count` 可空 |

步骤状态：`pending` | `completed` | `skipped`。当前步派生：该事项中 `status='pending'` 且 `sort_order` 最小者。全部完成或跳过则事项 `completed`，写入 `completed_at`。事项可归档（默认列表隐藏、事项库「看归档」可恢复）或硬删（步与依据 CASCADE）。步骤用 `UPDATE sort_order` 重排，禁止 DELETE+INSERT。

`due_date`（任务 / 事项 / 步骤）是 TEXT：`YYYY-MM-DD` 或本地 `YYYY-MM-DDTHH:MM`。按日谓词用 `substr(due_date,1,10)`。步骤到期由 scheduler 扫 pending 步，写入 `due_notified`，不复用 `reminders.task_id`。

事项创建后不能改 `playbook_id`。不做办案行业字段。事项可有 `notes` 说明。

## 依据

- 存绝对路径 + `kind`（`file` | `folder`）
- 默认不强制；模板步可设 `evidence_required`
- 缺依据仍可办结，仅标记「缺依据」
- 路径失效标红、可改绑，不锁事项
- 用系统默认程序打开 / 在文件管理器中显示
- 复制 `docket.db` **不含**卷宗文件

## 今日 / 逾期

- 任务：沿用 `agenda::today_active_predicate` / `overdue_active_predicate`（本地日历日；今日含 `priority >= 2` 且无到期日或未到期的任务）
- 事项：每个 `active` 事项的当前步一律进入今日
- 逾期：当前步或事项的到期**日**早于本地今日（时刻不参与按日比较）
- 投影类型 `AgendaItem`（含 `category_id` / `tag_ids`），禁止把步骤插入 `tasks` 表
- **今日视图含逾期分段**：一次拉逾期与今日两条议程，列表两段「逾期 / 今日」；无独立逾期侧栏。统计卡「逾期任务」跳到今日
- 侧栏按**单分类、单标签**筛议程（事项步跟事项的分类/标签；无分类项在选了分类时排除）
- 月历 `task_count` / `completed_count` 只算任务（含已完成归档，归档不抹历史；进行中已归档仍隐藏）；`matter_step_count` 单独算进行中事项的当前 pending 步到期；格子分别显示任务完成情况与步骤数（`N 步`）；点某日仍只筛任务，并在格下嵌当天任务列表与排程（排程仍只排任务）
- 议程/任务卡可拖到日历格改期；已有时刻只换日期前缀
- 每日复盘一行：本地日 `completed_at` 的完成步数（`status=completed`，跳过不计）与办结事项数（不用 RFC3339 字面比）

## 指标过滤器

办结日（本地日历）落在本期间，且：

- 模板集合为空（不限模板，含空白事项）或 `playbook_id` 命中
- 标签集合为空或事项具备**全部**所选标签

UI 期间文案含末日（`period_start` 至末日）；IPC `period_end` 仍是半开区间不含的右端点。删被指标引用的模板/标签行 `ON DELETE RESTRICT`（归档不碰过滤器）。空过滤器仍 = 不限。

指标不限制能创建哪些事项。今日不展示指标本身。

## 主要 IPC

- 模板：`list_playbooks`, `create_playbook`, `update_playbook`, `set_playbook_steps`
- 事项：`list_matters`, `create_matter`, `create_blank_matter`, `get_matter`, `update_matter`, `archive_matter`, `restore_matter`, `delete_matter`, `update_matter_step`, `reorder_matter_steps`, `delete_matter_step`, `complete_matter_step`, `skip_matter_step`, `reopen_matter_step`, `add_matter_step`
- 依据：`add_step_link`, `remove_step_link`, `replace_step_link`, `open_step_link`, `reveal_step_link`
- 议程：`list_agenda`
- 指标：`list_cadences`, `create_cadence`, `update_cadence`, `get_cadence_progress`

## 迁移

SQLite `_migrations` **v7**。v5 建表历史保留；v6 将指标过滤表改为 `ON DELETE RESTRICT`；v7 增加 `matters.notes`、`matter_steps.due_notified`。`focus_sessions` / `schedule_entries` 不改外键。

## 非目标

文件拷贝、监视、应用内预览、换模板、审批流、今日墙上挂指标、事项步接入自动排程/专注。
