# 文档说明

## 权威来源

当前实现以仓库根目录 **[README.md](../README.md)** 与代码为准。

## `plans/` 目录（当前有效）

已批准、待实现的功能设计，例如：

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

无需为这些文档维护向后兼容；新功能请在 README 中补充说明。
