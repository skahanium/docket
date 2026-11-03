# Docket — Agent 工作约束

> 给 AI 开发者 / 维护者的硬约束。短而硬：只写不变量与可检查的规则；背景与细节见 `docs/`。

## 这是什么

本地优先、离线可用的桌面任务管理（Tauri v2 + Solid.js + SQLite）。
定位：**单机小软件**——强大完善、特点鲜明。不做云、不做协作、不做移动端。

## 权威顺序（冲突时从高到低）

1. 代码实测行为 —— 但与本文矛盾时：**停下来向用户报告漂移**，不得硬套或擅改本文
2. `README.md` 与 `docs/plans/*`（现行设计）
3. 本文
4. AI 的推测与训练习惯 —— 最低，不得覆盖以上三层

`docs/superpowers/` 为历史稿，不作依据。

## 产品不变量（任何改动不得违反）

- 琐碎用**任务**，有程序用**事项**；任务 / 事项分表（`tasks` / `matters`），禁止把事项步骤写入 `tasks` 表
- 今日 = 任务谓词 ∪ 各进行中事项的**当前步**（一事一步）
- 完成史看 `completed_at`；`status` / `archived_at` 只管可见性（归档不抹历史）
- `due_date` = 本地日历日 + 可选 `HH:MM`；按日谓词用 `substr(due_date,1,10)`；**不引入第三种对象**（事件 / 约见 / 时间块）
- 周期指标按办结查询计数，不进今日；事项 `playbook_id` 创建后不可改
- 依据只存绝对路径，不拷贝、不监视、不预览
- 禁止引入：云同步、协作、移动端、JSON 导入导出、印章 / 拟物 / emoji 装饰、CDN 字体、新的顶层视图（五视图是骨架，分类 / 标签是同级目的地）

## 工作流（硬规矩，无豁免）

1. **方案先行**：动 `src/` 或 `src-tauri/` 任何代码前，先在 `docs/plans/` 写方案文档并**经用户确认**；不存在「顺手小改」
2. 施工：每步带测试；UI 改动对照 `docs/design.md` 的版式语法与禁则
3. 收尾跑验证门（见下节），全绿才算完，再自查一轮
4. 改行为必同步文档：`README.md` + 相关 `docs/plans/`；用户可见变化记入 `CHANGELOG.md`
5. 未经用户明确要求，不 commit、不 push

## 测试规约

- 修 bug 必带回归测试；新行为必带正向测试
- 时区 / 日历语义必须显式测：本地日历日、半开区间、RFC3339 → 本地日换算（本项目踩过坑）
- 集成测试守住 IPC 面（`src-tauri/tests/commands_integration.rs`）；前端测纯逻辑（stores / utils）
- 测试命名写行为（如 `archived_completed_task_still_in_daily_counts`），不写 `test1`

## 验证门（宣称完成前必须全绿）

```bash
cd src-tauri && cargo test
npm test
npx tsc -b
npm run check:bindings   # 对照 HEAD；波内 generated.ts 有改动属正常，提交后转绿
```

CI（`.github/workflows/ci.yml`）同跑这四道门；红灯不许合。

## 代码约定（浓缩）

- 业务规则、持久化、提醒调度全在 Rust；前端只渲染与交互
- `models.rs` / 命令 DTO 变更 → `npm run generate:bindings`；`src/bindings/generated.ts` 勿手改
- 迁移集中在 `db.rs`（`_migrations` 版本化）；时间计算走 `agenda.rs` / `time.rs`，禁止 RFC3339 字符串比较
- 提交信息：`fix:` / `feat:` 起头 + 一段 why（参考 `git log`）；测试随代码走

## 元规则

本文自身也会过时。规则与现实冲突时：**报告 > 变通**。
发现新的「跑偏」类事故，在禁区清单补一句话即可；改本文须经用户确认。
