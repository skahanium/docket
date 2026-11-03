# 波次方案：手测清账 e2e 化 + CI 浏览器缓存（现行）

权威来源：本文 + [AGENTS.md](../../AGENTS.md) + 代码。目标：清掉 `剩余清单.md` 剩余手测账，CI 提速。
**状态：已按案施工；销号规则变更（三态）已经用户确认。**

## ① 手测 7 条的处置口径

原则：**UI 可见的行为**才 e2e 化（真渲染断言）；**纯语义且已有 Rust 硬测试**的直接销账、不再人工点；
e2e 摸不到的（原生对话框等）保持手测并写明原因。

| 手测项 | 处置 | 依据 |
|--------|------|------|
| 指标卡 10 月显示「至 10-31」 | **e2e 化** | 进展页指标卡文案，fixture `get_cadence_progress` 即可断言 |
| 今日缺依据步在桌面面板有角标 | **e2e 化** | `panel.html` 可直接开页，fixture `get_desktop_panel_snapshot` 断言角标 |
| 新建模板 → 建事项 → 今日完成当前步露出下一步 | **e2e 化**（招牌主线） | fixture 路由补可变 handler（create_matter / complete_matter_step），断言今日列表推进 |
| 缺依据仍可完成并标缺 | **e2e 化**（半条） | 断言缺依据标记 + 完成不被拦；「改绑失效路径」涉原生取径对话框，**保持手测** |
| 归档模板后该指标仍只计该模板 | **销账**（Rust） | `deleting_playbook_referenced_by_cadence_is_restricted` 等硬测试 |
| 空白事项只进「不限模板」指标 | **销账**（Rust） | `cadence_blank_matter_only_in_open_filter` |
| 东八区办结落在正确月/季/年 | **销账**（Rust） | `cadence_progress_buckets_by_local_calendar_day` + 复盘本地日测试 |

处置后 `剩余清单.md` 手测行改为三态标注（e2e 覆盖 / Rust 覆盖已销 / 仍手测仅剩「改绑」一条），
销号门相应改写：三类全部有据可查即关单——**这是销号规则的变更，需要你点头**。

## ② 新增 e2e 用例（3.5 条）

1. **指标期间文案**：进进展页 → 展开指标卡 → fixture 期界 `2026-11-01` → 断言文案为「至 10-31」而非「11-01」
2. **桌面面板缺依据角标**：直接开 `/panel.html` → snapshot 含 `missing_evidence` 行 → 断言「缺依据」徽标
3. **事项主线推进**（招牌流）：从模板建事项 → 今日露当前步 → 完成 → 下一步顶上；
   fixture 路由新增可变状态 handler（`create_matter` / `complete_matter_step` / `list_agenda` 按世界状态返回）
3.5. **缺依据不拦完成**：当前步 `missing_evidence` 时仍可完成，完成后仍标「缺依据」徽标

fixtures 变更：`e2e/fixtures.ts` 的 invoke 路由支持「可变世界」（matters/steps 存于内存态，
`list_agenda` / `list_matters` / `get_matter` 据此生成），单测文件内聚，不外溢。

## ③ CI 浏览器缓存

`ci.yml` 在 Install Playwright 步前加 `actions/cache`：
- path：`~/.cache/ms-playwright`
- key：`playwright-${{ hashFiles('package-lock.json') }}`（随版本变）
- 命中则 `npx playwright install chromium` 秒过，省 1–2 分钟/跑

## 验证门

五道全绿（不变）+ 本波新增 3.5 条 e2e 过。手测行改写后 `剩余清单.md` 与三态标注一致。

## 非目标

tauri-driver 真机 E2E、原生对话框（pick_evidence_path）自动化、视觉回归、改业务行为。

## 落地顺序

③（10 行，先落）→ ② fixtures 可变世界 → ② 用例逐条绿 → ① 清单改写 + CHANGELOG → 全门 → 提交推送。
