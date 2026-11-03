# 基础建设批：AGENTS.md、design.md 与 CI（现行方案）

权威来源：本文 + [AGENTS.md](../../AGENTS.md) + [design.md](../design.md) + 代码。
目标：给长期 AI 协作装上三层约束——宪法（AGENTS.md）+ 细则（design.md）+ 机械门（CI）。

## 本批产出

- [x] `AGENTS.md`（仓库根）— AI 进场宪法：权威顺序、产品不变量、方案先行硬规矩、测试规约、验证门
- [x] `docs/design.md` — UI 宪法：强调色规则、版式语法、禁则清单（含 toast 色条待修实例）
- [x] `CHANGELOG.md` — Keep a Changelog 式存根，回填 0.1.0 各波
- [x] `.github/workflows/ci.yml` — 四道门机械固化
- [x] 文档同步：`docs/README.md` 索引收录 design.md；README 补 CI 徽章
- [ ] 首跑观察：推送后 CI 绿；红则修到绿

## CI 设计

**触发**：push 到 `master`、所有 PR。
**Runner**：`ubuntu-latest`（rusqlite bundled + jsdom 测试无 GUI 依赖；快且稳）。mac/Win 矩阵留 P2。
**工具链**：Rust stable（`dtolnay/rust-toolchain@stable`）、Node 22 LTS + npm cache、`Swatinem/rust-cache`。

**Jobs**（单 job 串四步，预期 2–3 分钟）：

| 步 | 命令 | 拦什么 |
|----|------|--------|
| 1 | `cd src-tauri && cargo test` | Rust 单测 + 命令集成测 |
| 2 | `npm ci && npm test` | 前端纯逻辑测 |
| 3 | `npx tsc -b` | 契约与类型 |
| 4 | `npm run check:bindings` | 生成物与提交一致（CI 工作区干净，语义恰好） |

- 红灯策略：任一步失败即失败；不自动重试掩盖；不 `--no-verify`
- `check:bindings` 在 PR 上跑的是「提交后」语义，与本地波内变红不同——正常
- P2（另行方案）：Playwright 手测自动化 job、`tauri build` 发布 job、fmt / clippy 门

## 落地顺序

1. 评审 AGENTS.md + design.md 草案 → 修订定稿
2. 定稿后落地 `ci.yml` + 文档索引，整批提交
3. 推送观察首跑；红了修到绿
4. 下一波（另行出方案）：toast 色条禁则修正（小）；`剩余清单.md` 手测项逐步迁 Playwright

## 已知债登记（本批发现，不在本批修）

| 债 | 出处 | 归属 |
|----|------|------|
| toast 彩色左条与旧选中蓝条同语言 | 用户发现，`App.tsx` `border-left` | 下一波，design.md 禁则实例 |

## 非目标

本批不改任何 `src/` 行为；不做发布自动化、不做依赖升级策略、不做 Issue 模板（P2）。
