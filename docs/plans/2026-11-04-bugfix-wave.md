# Docket 缺陷修复方案：复发顺延、日历口径、排程确认与自动备份（现行）

依据：mimo 对上一轮审查的逐条核验。本方案只处理已确认的缺陷和两项数据安全风险；不改 AGENTS 产品不变量，不加顶层视图，不做导入导出/商业化，不引入新依赖，不做数据库迁移。

## 1. 目标与成功标准

**目标**

1. 修复五个用户可见缺陷：周重复跨周不跳周、迟到完成生成逾期实例、日历任务/步骤口径混算、自动排程/清空无确认、README 今日口径漂移。
2. 增加一个数据安全兜底：每天首次启动自动备份数据库，保留最近 14 份。
3. 加固一个 IPC 边界：非法年份不再让月历命令 panic。

**成功标准**

- 周重复：`interval=2, days=[一,三,五]` 从周五完成后，下一次是两周后的周一，而不是下周一；同周内的周三/周五仍正常。
- 迟到完成：11/1 的每日任务在 11/5 完成，下一次是 11/6，不再生成 11/2 的逾期实例；时刻 `T15:00` 保留。
- 日历：任务数与步骤数分开；只有步骤的日子不再被误判为“全完成”；点日列表仍只列任务。
- 排程：当天已有排程时，自动排程/清空必须先确认；取消后命令不执行。
- 备份：同一天多次启动只生成一份；快照可打开、可查询；保留 14 份；失败只记日志，不影响启动。
- 五道验证门全绿；`generated.ts` 与 Rust 一致。

## 2. 范围

| 类型 | 条目 | 处理 |
|---|---|---|
| 缺陷 | 周间隔 + 指定星期跨周错误 | 修 |
| 缺陷 | 迟到完成从 due 推下一次 | 修 |
| 缺陷 | 日历 `task_count` 混入步骤、`completed_count` 只算任务 | 修 |
| 缺陷 | 自动排程/清空无确认 | 修 |
| 文档缺陷 | README 今日口径与代码不一致 | 修文档 + 测试锁定行为 |
| 风险 | 仅手动备份 | 加每日启动自动备份 |
| 加固 | 非法年份导致月历 panic | 返回错误，不 panic |

**明确不做**：今日组成规则重设计、defer/waiting/canceled、事项并行步/依赖、任务↔事项关联、全局搜索/批量、导入导出、第六视图、固定时间承诺、月末 31 号重复、cadence 性能优化、回收站/软删除、商业化。

## 3. 已定语义

| 主题 | 决定 | 理由 |
|---|---|---|
| 周重复活跃周 | 当前发生日所在周视为活跃周；本周还有更晚的选中星期就取最近一个，否则跳到 `+interval` 周的第一个选中星期 | 生成的实例总落在活跃周；不引入额外 anchor 字段 |
| 周重复手工改期到非活跃周 | 按“当前周活跃”处理，属已知边界 | 无 anchor 时无法判断；文档写明 |
| 迟到完成 | 下一次严格晚于本地今天；跳过已错过日期，不补生成 | 避免生成已逾期实例，也避免当天重复 |
| `end_count` | 仍按已生成实例计数，不按日历发生次数补算 | 保持现有语义，避免隐式生成未创建的任务 |
| `end_date` | 含端点；下一次超过 end_date 就不生成 | 现有语义不变 |
| 日历 | `task_count`/`completed_count` 只算任务；新增 `matter_step_count` 单独算当前 pending 步 | 修掉假“全完成”，不动“点日只筛任务”的产品决定 |
| 排程确认 | 当天已有排程才弹确认；无排程直接执行 | 避免无意义打断 |
| 自动备份 | 每天首次启动备份一次，保留 14 份，无开关 | 最小可用兜底；跨天常驻的定时备份另开小项 |
| 今日高优先级规则 | 行为不变，只补文档和测试 | 属产品取舍，不在本波改行为 |

## 4. 改动清单

### 4.1 重复引擎（Rust）

**文件**：`src-tauri/src/recurrence.rs`、`src-tauri/src/commands/tasks.rs`、`src-tauri/tests/commands_integration.rs`

**周重复算法**

- `next_occurrence_from` 的 `weekly` 分支改为：
  1. 取 `from` 所在周的周一（ISO，周一=1）。
  2. 将 `days` 去重、排序、夹到 1..=7。
  3. 在本周内找严格晚于 `from` 的第一个选中星期；找到就返回。
  4. 找不到则跳到 `周一 + interval*7`，返回该周第一个选中星期。
  5. `days` 为空时保持 `from + interval*7`。
- `interval` 夹到 1..=999，避免 `interval * 7` 溢出和 chrono 日期越界。
- 保留现有 `next_occurrence` 的纯“下一次”语义；新增 `next_occurrence_after(rule, current_date, not_before: NaiveDate)`：
  - 从 `next_occurrence` 开始，循环推进到日期严格大于 `not_before`。
  - 每次推进保留 `T HH:MM` 后缀；每次仍检查 `end_date`。
  - 循环上限 100,000 次（约 273 年每日步），超限返回 `None`（防御性，不 panic）。

**迟到完成**

- `complete_task_on_conn` 把 `next_occurrence(&rule, &base_date)` 改为 `next_occurrence_after(&rule, &base_date, crate::time::local_today_naive())`。
- `end_count` 检查保持不变。
- 注释写明“迟到完成跳过已错过日期，不生成逾期实例”。

**必须更新的现有测试**

- `src-tauri/tests/commands_integration.rs` 里四个复发测试使用 2026-05/06 的固定过去日期；迟到顺延后 `recurrence_spawn_keeps_local_time` 的精确日期断言会失败。把它们的到期日改为 `local_today_date() + 1 天`（时刻测试用 `+1 天 T15:00`），让它们继续测 `end_count`、继承、时刻，而不是意外测到迟到顺延。
- 迟到顺延由新增测试覆盖。

**新增测试**

- `weekly_interval_two_skips_off_week_at_week_boundary`：`2026-05-15`（周五）+ interval 2 + `[1,3,5]` → `2026-05-25`（周一）。
- `weekly_interval_two_keeps_later_day_in_active_week`：`2026-05-11`（周一）→ `2026-05-13`（周三）。
- `weekly_single_day_interval_two_adds_two_weeks`。
- `weekly_empty_days_keeps_weekday`。
- `late_daily_completion_lands_after_today`：11/1 → 11/5 完成 → 11/6。
- `late_daily_completion_keeps_time_suffix`：`11/1T15:00` → `11/6T15:00`。
- `late_weekly_completion_lands_on_next_active_day`。
- `late_completion_respects_end_date`。
- `early_completion_keeps_natural_next_date`。
- `very_late_daily_completion_still_rolls_forward`：1990-01-01 → 2026-01-01 仍能顺延到 2026-01-02。
- `huge_interval_does_not_overflow`。
- `commands/tasks.rs`：`late_recurring_completion_skips_missed_days`、`late_recurring_completion_keeps_time`、`late_recurring_completion_respects_end_date`、`late_recurring_completion_respects_end_count`、`early_recurring_completion_uses_natural_next`。

### 4.2 日历口径（Rust + TS）

**文件**：`src-tauri/src/models.rs`、`src-tauri/src/commands/calendar.rs`、`src/components/CalendarDay/CalendarDay.tsx`、`CalendarDay.module.css`、`src/bindings/generated.ts`、README 与 plan 文档

**Rust**

- `CalendarDay` 增加 `pub matter_step_count: i32`。
- `get_calendar_month_on_conn`：
  - `task_counts` 放非归档任务 + 已完成归档任务（归档不抹历史）；进行中已归档任务仍隐藏。
  - `completed_counts` 放 completed 与已完成归档任务。
  - 新增 `step_counts`，只放 `m.status='active' AND s.status='pending'` 且 `substr(s.due_date,1,10)` 在月内的当前步；不再并入 `task_counts`。
  - 返回 `task_count`、`completed_count`、`matter_step_count`。
- 顺手加固：`last_day` 的 `unwrap()` 改成 `checked_add` + `ok_or_else(AppError::InvalidDate)`，非法年份返回错误而不是 panic。

**前端**

- `CalendarDay`：
  - `allDone`、`hasPending`、dots、overflow、进度条只基于 `task_count`/`completed_count`。
  - 新增 `matter_step_count` 展示：`>0` 时显示中性小字 `N 步`，放在 dots 行末尾；颜色用 `--text-label`，字号 12，不使用强调色。
  - `aria-label` 追加“N 个事项步骤”；旧 fixture 缺字段时用 `?? 0`。
- CSS 新增 `.stepCount`：12px、`--text-label`、`tabular-nums`、`margin-top: 2px`。
- `StatsPanel` 的 mini calendar 不消费新字段，无需改。

**测试**

- `calendar_month_separates_task_and_step_counts`：同一天 1 个任务 + 1 个当前步 → `task_count=1, completed_count=0, matter_step_count=1`。
- `calendar_month_step_count_clears_when_step_completed`：完成步骤后 `matter_step_count=0`。
- `calendar_month_keeps_archived_completed_task_in_history`：已完成归档任务仍计入；进行中已归档任务不显示。
- `calendar_month_rejects_out_of_range_year`：`i32::MAX` + 12 月返回 Err，不 panic。

**文档**

- README 第 16 行改为“月历格分别显示任务完成情况与当前步数量（N 步）；点日下方为当天任务列表与自动排程”。
- `docs/plans/2026-10-29-matters-playbooks-cadences.md` 的“今日 / 逾期”和月历段落同步。
- `docs/plans/2026-11-02-app-shell.md` 日历行补“格上另显示步骤数”。

### 4.3 排程确认（TS）

**文件**：`src/components/Schedule/Schedule.tsx`、`e2e/docket.spec.ts`

- 引入 `ConfirmDialog`，增加 `confirmAction` signal（title/message/confirmLabel/danger/fn）。
- `handleAutoSchedule`：
  - 仅当 `data()?.date === scheduleDate()` 且 `entries.length > 0` 时弹确认，文案“当天已有 N 条排程，自动排程会先清空再重排，手动安排会丢失。”
  - 无排程或数据未加载时直接执行（自动排程按钮本来就在 loading 时禁用）。
- `handleClear`：
  - 有排程时弹确认，文案“将删除当天 N 条排程，此操作不可撤销。”，`danger=true`，确认按钮“清空”。
  - 无排程直接执行；加载中、加载失败或数据日期与当前选中日不一致时，禁用自动排程与清空，避免用旧数据判断。
- 确认后调用原 `doAutoSchedule`/`doClear`；成功后 toast（清空补“已清空当天排程”）。
- 顺手修 `ConfirmDialog` 的非响应式 early return：改为 `<Show when={props.open}>`，否则首次打开不渲染（任务/事项的归档删除确认也受影响）。
- E2E 新增一个用例：
  - 用 `get_calendar_month` + `get_schedule` fixture 进入日历并选中一天。
  - 断言“2 步”角标。
  - 点“自动排程”→ 出现 alertdialog → 取消 → `__E2E_STATE__.commands` 不含 `auto_schedule`。
  - 再点“自动排程”→ 确认 → commands 含 `auto_schedule`。
  - 点“清空”→ 对话框内取消 → commands 不含 `clear_schedule`。
  - 另加一条：`get_schedule` 返回 null 时显示“加载失败”，自动排程/清空均禁用。

### 4.4 自动备份（Rust + 设置文案）

**文件**：`src-tauri/src/backup.rs`（新）、`src-tauri/src/lib.rs`、`src/components/SettingsPanel/SettingsPanel.tsx`、README、CHANGELOG

**实现**

- 新模块 `backup`：
  - `auto_backup_on_start(db_path, app_data_dir)`：用 `Local::now().date_naive()` 调 `auto_backup_on_date`。
  - `auto_backup_on_date(db_path, app_data_dir, today)`：
    1. `backups/` 不存在则创建。
    2. 目标名 `docket-auto-YYYYMMDD.db`；已存在则只执行 prune 并返回 `None`。
    3. 临时名 `.docket-auto-YYYYMMDD.tmp`；先删残留。
    4. 新开 `Connection`，`busy_timeout(5s)`，`VACUUM INTO` 到临时文件。
    5. `rename` 为正式文件；失败则删临时文件并返回错误。
    6. prune 失败只记日志，不影响备份成功。
    7. 启动时清理超过 1 小时的残留 `.tmp`，避免崩溃累积。
  - `prune_auto_backups(dir, keep=14)`：只匹配 `docket-auto-*.db`，按文件名倒序保留 14 份；忽略 `docket-manual*` 等非匹配文件。
- `lib.rs` 的 `setup`：在 `app.manage(DbState(...))` 后，clone `db_path`/`app_data_dir`，`std::thread::spawn` 调 `auto_backup_on_start`；失败 `log::warn!`，不影响启动。
- 设置页“数据”卡片文案补：“每天首次启动自动备份一份，保留最近 14 份，位于数据目录 `backups/`；自动备份不含依据指向的卷宗文件；恢复时退出应用后用备份替换 `docket.db`。”
- 不做开关，不加新命令；手动“备份到…”保持原样。

**测试**

- `auto_backup_creates_one_snapshot_per_day`：同一天两次调用只生成一份，第二次返回 `None`。
- `auto_backup_snapshot_is_readable`：写入 setting 后备份，打开快照能查到同一值。
- `prune_keeps_newest_fourteen_and_ignores_manual`：16 个 auto 文件 + 1 个 manual 文件，prune 后剩 14 个 auto + manual。
- 测试使用唯一临时目录，避免并行冲突；`auto_backup_on_date` 接受显式日期，避免午夜 flake。

### 4.5 文档与 CHANGELOG

- README：
  - 今日口径改为“今天到期的任务 + 高优先级（≥2）但未到期的任务 + 各进行中事项的当前步”，并注明按本机日历日。
  - 日历行改为任务/步骤分开计数。
  - 备份表补自动备份说明。
- `docs/plans/2026-10-29-matters-playbooks-cadences.md`：今日谓词、月历计数、备份说明同步。
- `CHANGELOG.md`：
  - Fixed：周重复跨周、迟到顺延、日历口径、排程确认、README 今日口径。
  - Added：每日启动自动备份。
  - 不改 AGENTS.md（不变量未变）。

## 5. API / 数据 / 兼容性

- **IPC**：`get_calendar_month` 返回的 `CalendarDay` 多一个 `matter_step_count`；无新命令、无参数变化。
- **绑定**：改 `models.rs` 后跑 `npm run generate:bindings`，`src/bindings/generated.ts` 随生成更新；`check:bindings` 对照。
- **数据库**：无 schema 变更、无迁移；老库直接可用。
- **前端兼容**：`CalendarDay` 对缺字段的旧 fixture 用 `?? 0`；StatsPanel 忽略新字段。
- **内部函数**：新增 `recurrence::next_occurrence_after`、`backup::auto_backup_on_start`/`auto_backup_on_date`/`prune_auto_backups`；`complete_task_on_conn` 签名不变。
- **不变量**：不改 `tasks`/`matters` 分表、今日并集、五视图、无第三对象、无导入导出。

## 6. 测试矩阵

| 层 | 覆盖 | 关键用例 |
|---|---|---|
| Rust 单测 | 复发算法 | 周 interval/星期边界、空 days、迟到/早完成、end_date、时间后缀、超大 interval |
| Rust 单测 | 完成命令 | 迟到每日/每周、end_count、end_date、时刻保留、早完成 |
| Rust 集成 | 现有复发链路 | 四个固定日期测试改相对未来日期后仍测 end_count/继承/时刻 |
| Rust 单测 | 日历 | 任务/步骤分离、完成步骤后计数归零、归档完成史、非法年份不 panic |
| Rust 单测 | 自动备份 | 同日只一份、快照可读、prune 保留 14 且不删手动文件 |
| Vitest | 现有纯逻辑 | 全量回归 |
| Playwright | UI | 日历“N 步”角标、排程确认/取消、命令未执行/已执行、排程加载失败时按钮禁用 |
| 手动 | 启动备份 | 同日启动两次只有一份；`backups/` 可打开 |

## 7. 验收标准

- `cd src-tauri && cargo test` 全绿，新增用例全部通过。
- `npm test`、`npx tsc -b`、`npm run check:bindings`、`npx playwright test` 全绿。
- 手工复核：
  - 周重复示例得到两周后的周一。
  - 迟到每日任务完成后下一次是明天，不是昨天。
  - 日历有步骤的日子显示“N 步”，不再出现假“全完成”。
  - 自动排程/清空前弹确认，取消后原排程还在。
  - 同一天第二次启动不新增备份文件。
- `git diff` 可见 `generated.ts` 的 `matter_step_count`；无迁移文件、无新依赖。

## 8. 风险与回滚

| 风险 | 缓解 |
|---|---|
| 迟到顺延改变用户预期（不再补历史实例） | CHANGELOG 写明；测试锁定；如要补历史另开设计项 |
| 周重复手工改到非活跃周语义不明确 | 文档写明“当前周按活跃周处理”；不引入 anchor |
| 日历 `task_count` 变小，视觉密度变化 | 新增“N 步”角标保留信息；e2e/截图手测 |
| 自动备份 `VACUUM INTO` 被锁/磁盘满 | 5s busy_timeout；失败只 log；下次启动重试；手动备份仍在 |
| 后台备份与退出竞争 | 临时文件+rename；残留临时文件下次启动清理 |
| 现有复发测试固定日期失效 | 本方案明确改为 `today+1` 相对日期 |
| E2E fixture 缺新字段 | 组件 `?? 0`；fixture 显式补 `matter_step_count` |

回滚：所有改动无迁移；按子系统回退代码并重新生成绑定即可。自动备份文件可保留，不影响旧版本。

## 9. 实施顺序

1. 先把本方案落到 `docs/plans/2026-11-04-bugfix-wave.md`（按 AGENTS 方案先行）。
2. 复发引擎 + 现有集成测试改相对日期 + 新增测试；跑 `cargo test`。
3. 日历 DTO/命令/组件 + 绑定生成 + 测试；跑 `cargo test`、`npx tsc -b`、`npm run check:bindings`。
4. 排程确认 + e2e；跑 `npx playwright test`。
5. 自动备份模块/启动接线/设置文案 + 测试；跑 `cargo test`。
6. README/plan/CHANGELOG + 五道门全量回归。未经用户要求不 commit/push。

## 10. 假设

- 项目保持免费开源，不引入商业化、定价、竞品功能；本方案只修可信度与数据安全。
- 月末 31 号重复的 `min(28)` 是已知取舍，不在本波修。
- “点日列表只筛任务”是现行产品决定，本波只把步骤数在格子上单独显示。
- 今日高优先级规则是产品取舍，本波只补文档和测试，不改行为。
- 自动备份只做“启动时每日一次”；应用跨天常驻的定时备份另开小项。
- `end_count` 按已生成实例计数；迟到跳过日期不补算次数。
