# 文档说明

## 权威来源

当前实现以仓库根目录 **[README.md](../README.md)** 与代码为准。

## `plans/` 目录（当前有效）

- [`2026-11-02-app-shell.md`](plans/2026-11-02-app-shell.md) — **壳层现行**：五视图（今日含逾期、任务看归档、事项、日历含排程、进展=统计+指标）、设置浮层
- [`2026-10-29-matters-playbooks-cadences.md`](plans/2026-10-29-matters-playbooks-cadences.md) — 事项、流程模板、步骤依据、周期指标；今日一事一步；与任务分表（指标在进展页、模板编辑在设置）
- [`2026-05-19-desktop-presence-design.md`](plans/2026-05-19-desktop-presence-design.md) — 单例、托盘常驻、悬浮任务面板、通知、低负载与安全（S2 可选联网）

## `superpowers/` 目录

`superpowers/plans/` 与 `superpowers/specs/` 为 2026-05 前后的**历史规划文档**，用于记录最初的产品设想与任务拆解，**未随后续重构同步**（例如已移除 JSON 导入导出、已合并 `get_stats_panel`、已新增设置页等）。

查阅时注意：

| 文档 | 状态 |
|------|------|
| `specs/2026-05-11-docket-design.md` | 部分 API 描述过时（如 `get_statistics`） |
| `specs/2026-05-11-docket-frontend.md` | Store/bindings 结构已与现码不同 |
| `plans/2026-05-11-docket.md` | 任务清单未勾选完成，仅作考古参考 |
| `specs/2026-05-12-*.md` | UI 改版相关，与功能架构无强绑定 |

早期「只有任务 + 子任务」的设想已被事项/模板模型取代，对象模型以 `plans/2026-10-29-matters-playbooks-cadences.md` 为准；主界面壳层以 `plans/2026-11-02-app-shell.md` 为准。`superpowers/` 仍只作考古。

无需为这些文档维护向后兼容；新功能请在 README 与 `plans/` 现行设计中补充说明。
