# 生命周期修复与完善（现行方案）

权威来源：本文 + 仓库根目录 [README.md](../../README.md) + 代码。
承接 2026-11-02 审查（`fae6689..1d80fd9`），对象模型见 [2026-10-29-matters-playbooks-cadences.md](2026-10-29-matters-playbooks-cadences.md)，壳层见 [2026-11-02-app-shell.md](2026-11-02-app-shell.md)。

## 背景

上一波把任务 / 事项生命周期做齐了（归档、恢复、删除、备注、删步、重排、步骤到期提醒、可选时刻、完成撤销），但三处**新旧特性交叉**留了缺口：时刻 × 复发、归档 × 指标、恢复 × 完成态。本方案修这三笔 + 统一撤销入口，让生命周期真正闭环，再开「今日流程轨道」。

**总原则（本轮确立）：**

1. **完成史看 `completed_at`，可见性看 `status` / `archived_at`。** 归档只影响可见性，不抹历史。指标、统计、复盘的"已办结/已完成"计数一律按 `completed_at`（本地日历日）算，与 `status` 无关。
2. **复发实例继承原任务的全部到期语义**（日期 + 可选时刻），基准日是原 `due_date` 的日期部分；无 `due_date` 才以本地今天为基准。
3. **恢复是"回到离开时的状态"**，不是强制回到 `active`。任务侧与事项侧（`restore_matter_on_conn` 已 `maybe_refresh_matter_status`）对称。

## 非目标

今日流程轨道、指标期翻页、事项步进专注/排程、提醒免打扰时段（见「待拍板」）、删根任务孤儿化复发链（低概率，另开小票）、改写 `docs/superpowers/`、新配色。

---

## F1 复发实例丢时刻、基准日错位（P0，新特性回归）

**现状**：`recurrence.rs:4` `parse_date` 只认 `%Y-%m-%d`；`recurrence.rs:30` `parse_date(current_date).unwrap_or(today)` 对 `YYYY-MM-DDTHH:MM` 静默回退到**今天**做基准；`format_date`（`recurrence.rs:8）只输出日期。`tasks.rs:183` 把整段 `due_date`（可能是 `2026-11-15T15:00`）传入 → 下一次实例**日期错位 + 时刻被抹**。

**改法**（`src-tauri/src/recurrence.rs`）：

- 新增 `fn due_date_part(s: &str) -> Option<NaiveDate>`：取 `s[..10]` 按 `%Y-%m-%d` 解析（复用 `crate::agenda::due_day` 语义，非法返回 `None`）。
- 新增 `fn due_time_suffix(s: &str) -> &str`：`len()==16 && s[10]=='T'` 时返回 `&s[10..]`（即 `T15:00`），否则 `""`。只接受 `parse_due_date` 写入过的两种合法形态，不重新发明校验。
- `next_occurrence(rule, current)`：
  - 基准日 = `due_date_part(current).unwrap_or(today)`（仅**无 due / 空串**回退今天——这是文档明写的语义；有时刻的合法日期绝不能落进回退）。
  - 返回 `Some(format_date(next) + due_time_suffix(current))`，日期型保持 10 位、时刻型保持 16 位。
- `end_date` 边界比较继续用 `due_date_part(end_date_str)`。

**`tasks.rs` spawn（约 :197–203）不改**：`next_date` 现在可含时刻，直写 `due_date` 即可。`base_date = due_date.unwrap_or_else(local_today_date)`（:183）保留。

**测试**：

- `recurrence.rs`：
  - `next_occurrence_keeps_local_time` — daily/1，current `2026-11-15T15:00` → `2026-11-16T15:00`（断言与"今天"无关，测试可跨日重复跑）。
  - `next_occurrence_date_only_stays_date_only` — `2026-05-11` → `2026-05-12`（10 位，不带尾巴）。
  - `next_occurrence_end_date_compares_date_part` — end_date 为日期、候选带时刻时正常截断。
- `commands_integration.rs`：`recurrence_spawn_keeps_local_time` — 建 `2026-06-15T15:00` 的 daily 任务（`end_count: 2`）→ `complete_task` → 断言新实例 `due_date == "2026-06-16T15:00"`。

**验收**：`cd src-tauri && cargo test --offline`；手测带时刻重复任务完成一次，列表里下一次的日期、时刻都对。

---

## F2 归档办结事项 / 已完成任务从统计与指标掉数（P0，归档 × 完成史交叉）

**现状**：`archive_matter_on_conn`（`matter.rs:81`）把 `status` 覆写为 `archived`，而 `list_completed_matters_in_range`（`matter.rs:546`）只认 `status='completed'` → 归档的办结事项**从当期指标消失**（`cadence.rs:240`）。同一根病在任务侧：`stats.rs:41/64` 与 `analytics.rs` 复盘已完成列表都用 `status='completed' AND completed_at`，完成→归档后**完成趋势掉点**；复发第 n 个实例完成后再完成下一次，旧实例被新行顶掉，趋势同样丢历史（`completed_at` 还在）。

**改法**（按总原则 1）：

- `matter.rs` `list_completed_matters_in_range`：不再经 `list_matters_on_conn(Some(COMPLETED))`，改为直接查 `completed_at IS NOT NULL AND local_date_in_period(completed_at, start, end)`（含 `archived`）。摘要（tags / current_step）**复用现有构建逻辑**——从 `list_matters_on_conn` 抽 `matter_summaries_for_ids(conn, ids)` 之类的小助手，勿复制 SQL。`matter_status::ARCHIVED` 仍**不进**事项库默认列表（可见性不变，只有计数口径变）。
- `stats.rs`：`completed_week`（:41）、`daily_counts` 取数（:64）、`weekly_completion_rate` 分子 —— `status='completed' AND completed_at…` 改为 `completed_at IS NOT NULL AND completed_at…`。分母 `total_week` 的 completed 分支同口径。
- `analytics.rs` 复盘已完成列表：同改；`count_local_completed`（:279）已按 `completed_at` 算，不动。
- UI（可选，1 行）：指标卡 `matching_matters` 里已归档事项的状态标灰（`MatterSummary.status` 已有值）。

**测试**：

- `matter.rs`：`archived_completed_matter_still_counts_in_cadence` — 空白事项走完全部步（自动 `completed_at`）→ 归档 → 当月 `list_completed_matters_in_range` / `get_cadence_progress` 仍计 1；`active_matter_without_completed_at_not_counted`。
- `stats.rs` / `analytics.rs`：`archived_completed_task_still_in_daily_counts`；复发链 `recurrence_instances_each_counted_once`（完成 2 次实例，`daily_counts` 各计各的）。

**验收**：`cargo test` 全绿；手测：办结事项 → 归档 → 进展页当期指标数字不掉、复盘计数与指标一致。

---

## F3 恢复任务洗白完成态（P1，任务/事项不对称）

**现状**：`restore_task`（`tasks.rs:564–572`）无条件 `status='active'`。完成→归档→恢复后任务变 `active` 但 `completed_at` 仍有值：状态自相矛盾、回到任务库/今日、统计不再算完成。事项侧 `restore_matter_on_conn`（`matter.rs:91`）正确——恢复后 `maybe_refresh_matter_status`（`matter.rs:293`）重算。

**改法**：

- 抽 `restore_task_on_conn(conn, id)`：`archived_at=NULL` 后按 `completed_at IS NOT NULL` 决定 `status`：是 → `completed`，否 → `active`。不碰 `completed_at`（恢复不是完成动作的逆，撤销走 `reopen_task`）。
- `restore_matter_on_conn` 行为**保持不变**（重算已经对）。
- UI：TaskDetail「恢复」toast 保持「已恢复」；状态标签如实显示（`completed: '已完成'` 已有）。

**测试**：`restore_task_preserves_completed_state`（create → complete → archive → restore → `status=='completed'` 且 `completed_at` 仍在、不出现在今日）；`restore_task_active_returns_active`。

**验收**：`cargo test`；手测完成→归档→恢复，任务在「已完成」态而不是回到今日。

---

## F4 撤销入口统一（P1，一致性）

**现状**：列表勾选（`listActions.ts:9`）与今日议程（`App.tsx:208`）完成都有「撤销」toast；TaskDetail「完成」按钮（`TaskDetail.tsx:366`）没有；MatterDetail 步骤「完成 / 跳过」也没有。

**改法**：

- TaskDetail「完成」改走 `completeTaskFromList(id)`（已含 invalidate + 撤销 toast），去掉本地 `act()` 包装；完成后抽屉保持打开（现状如此）。
- MatterDetail 步骤「完成」「跳过」：成功 toast 带「撤销」→ `reopenMatterStep(step.id)`（完成与跳过的逆都是回 `pending`，与议程路径同命令）。跳过另计：toast 文案「已跳过」。
- `pushToast` 已支持 action（`toast.ts`），不动。

**测试**：前端 `listActions.test.ts` 补一条「completeTaskFromList 生成带撤销 action 的 toast」；`reopen_task_on_conn` 已有测试不动。

**验收**：`npm test`；手测三处（列表勾选、TaskDetail、议程）完成都出撤销，点撤销都能回。

---

## 销号与文档（同波）

- [x] `剩余清单.md`：「本机 Computer Use 缺屏幕录制权限」改记为**「本机 Computer Use 未启用（`mimo-computer-use` 在 MCP 状态为 disabled，设置→电脑操控无入口；启用并开新对话后可代跑）」**——上轮核实过，留准确记录。
- [x] 手测销号行拆成逐条可勾（重复带时刻 / 归档不掉指标 / 恢复保完成态 / 三处撤销），避免再挂一整行。
- [x] `UpdateMatterStepInput.title` 已做（步骤标题可改），已跑 `npm run generate:bindings`；波末 `npm run check:bindings` 见验证门。
- [x] README 两处小改：备份段补「一键带时间戳备份」；「到期日」条补「重复任务生成的实例保留时刻」。

## 可选项（本轮顺手做，量小；不做则口头记录）

1. **步骤标题可改**：`UpdateMatterStepInput` 加 `title: Option<String>`，`update_matter_step_on_conn` 扩参（只更新非空），UI 步骤标题点击改。当前打错字只能删步重建，丢依据链接——改了更符合"生命周期可编辑"。
2. **一键带时间戳备份**：设置→数据加「备份到…」（dialog 存路径，复制 `docket.db` 为 `docket-YYYYMMDD-HHMM.db`），比只展示路径像样。用 `tauri-plugin-dialog` 现有能力。
3. **日期型到期提醒免打扰**（待拍板）：纯日期到期现在 00:00 即响（`scheduler.rs` 测试明文锁定）。若嫌吵，改到工作时（如 08:30，走 `settings_keys`），时刻型不变；拍板前不动。

## 验证门（全绿才算完）

```bash
cd src-tauri && cargo test          # lib ≥ 75+（F1 +3、F2 +3、F3 +2）+ integration 15+
npm test                            # ≥ 56
npx tsc -b
npm run check:bindings
```

手测 5 分钟（逐条勾）：

1. 带 `15:00` 的重复任务完成一次 → 下一次日期、时刻都对；
2. 办结事项归档 → 进展页当期指标不掉数；
3. 任务完成→归档→恢复 → 显示「已完成」，不出现在今日；
4. 列表 / TaskDetail / 议程三处完成都有「撤销」，且点撤销能回；
5. （上波遗留）指标卡 10 月显示「至 10-31」、缺依据步在桌面面板有角标。

## 落地顺序

F1 → F2 → F3 → F4 → 销号文档 → 可选项（按余量）。每步一个提交，测试随代码走。三笔修完，生命周期闭环，下一波开「今日流程轨道」。
