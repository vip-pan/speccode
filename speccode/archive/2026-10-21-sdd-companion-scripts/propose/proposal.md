---
tier: 2
---

# Proposal: sdd-companion-scripts

## Why

SDD 执行机器(task brief 抽取、review package 打包、plan 勾选、工作区定位)目前是引擎 verb,命令层必须有 `speccode` 在 PATH 才能跑一轮 SDD——而这四件事本来就只被两个 SDD skill 私用、与多分支编排状态无关。superpowers v7 至今把同一批逻辑作为伴生脚本随 skill 携带(`skills/*/scripts/`,相对路径调用,零安装),这正是大需求 prose-core-mcp-split 划定的 lite 边界:**SDD 文档流在无引擎时全可用**。本需求把四件套回归伴生形态,并顺手吸收 superpowers 的 ledger 脚本(task-start / task-done)把「手写 ledger 行」变成确定性写入;agent-skills 的 validator 思路以守卫测试形式落地。

## What Changes

- **伴生脚本落地** `skills/subagent-driven-development/scripts/`(node ESM,`#!/usr/bin/env node`,可执行位;仅 `node:` 内置,**MUST NOT import `lib/`**):
  - `sdd-plan.mjs`——共享模块(非可执行):`scanPlan` / `extractTaskBrief` / `tickTask` / `sddWorkspace` / `worktreeRoot` / 原子写与 git 小助手,逐字搬自 `lib/sdd.mjs`(fence 状态机、区段边界、幂等语义一字不改)。
  - `sdd-workspace.mjs <PLAN>` → `{ok, dir}`;`task-brief.mjs <PLAN> <N> [--out P]` → `{ok, path}`;`review-package.mjs <PLAN> <BASE> <HEAD> [--out P]` → `{ok, path}`;`tick-task.mjs <PLAN> <N>` → `{ok, plan, task, ticked, already}`。单行 JSON 输出、`ok:false` + exit 1 的错误形状与 verb 文化一致,prose 解析字段不变。
  - **新增** `task-start.mjs <PLAN> <N>` → `{ok, brief, base}`(写 brief + 记 BASE 一次调用,吸收 superpowers);**新增** `task-done.mjs <PLAN> <N> <BASE> (--note <text> | -- <test cmd…>)`:test 模式跑测试命令、全量输出落 `<ws>/task-N-tests.log`、**仅成功时**记行(注记 `tests: <cmd> → <最后一行>`,失败透传退出码);note 模式不跑命令、注记原文(SDD 审查完成点的 `review clean` / `<K> parked`)。两种模式都以单次 O_APPEND 追加完成行 `Task N: complete (commits <base7>..<head7>, <注记>)`,ledger 不存在时先写身份行。
- **引擎退出 SDD 机器**:删除 `lib/sdd.mjs`;`lib/verbs.mjs` 删除 `sdd-workspace` / `task-brief` / `review-package` / `tick-task` 四个 verb 及其导入;`lib/mcp.mjs` `TOOL_META` 同步删四项(parity 守卫自动对齐)。**BREAKING**(对直接调用这四个 verb/tool 的外部调用方;插件内唯一调用方是两个 SDD skill,同 PR 内改写)。
- **prose 改写**(`skills/subagent-driven-development/SKILL.md`、`skills/executing-plans/SKILL.md`、`references/task-reviewer-prompt.md`、`references/re-review-prompt.md`):`speccode <verb> --cwd . --plan …` 形态改为 `node <scripts>/<name>.mjs …`;每个 skill 开头一段「伴生脚本锚点」:`<scripts>` = 宿主加载 skill 时报告的 base directory 下的 `scripts/`(executing-plans 为 `<本 skill base>/../subagent-driven-development/scripts`),宿主未报告 base directory 时以 `$(speccode plugin-root --cwd .)/skills/subagent-driven-development/scripts` 兜底;ledger 完成行改经 `task-done.mjs` 写入,brief + BASE 改经 `task-start.mjs` 一次取得。
- **测试迁移**:`tests/sdd.test.mjs` 改从 `skills/subagent-driven-development/scripts/sdd-plan.mjs` 导入(14 个用例语义不变);`tests/cli.test.mjs` 中四个 verb 的端到端用例迁入新 `tests/sdd-scripts.test.mjs`(`spawnSync node <script>` 对真实临时仓),并新增 task-start / task-done 用例、脚本守卫(shebang、可执行位、不 import `lib/`、SKILL.md 引用的脚本文件存在);`cli.test.mjs` 两条 prose 守卫(`tick-task` 提及、tick commit 文案、幂等跳过)保持通过。
- **文档**:CHANGELOG `[Unreleased]`(Added:task-start/task-done;Changed:四 verb → 伴生脚本;BREAKING 标注);AGENTS.md 架构节(lib 模块 17 → 16,「SDD 工件」从 lib 层移到命令交互层的伴生脚本说明,常用命令补脚本手动驱动示例)。README/DESIGN 对四 verb 零提及,不改(门面整体重写归 docs-i18n)。

## Capabilities

- `sdd-document-lifecycle`(RENAMED:SDD 工件生成 verb → SDD 伴生脚本;MODIFIED:SDD 工作区 / SDD 伴生脚本 / plan 执行进度勾选;ADDED:ledger 脚本化)
- `plugin-packaging`(MODIFIED:命令通过 bin/ PATH 裸调引擎 / 插件根目录布局)

## Impact

`skills/subagent-driven-development/scripts/{sdd-plan,sdd-workspace,task-brief,review-package,tick-task,task-start,task-done}.mjs`(新)、`lib/sdd.mjs`(删)、`lib/verbs.mjs`、`lib/mcp.mjs`、`skills/subagent-driven-development/SKILL.md`、`skills/executing-plans/SKILL.md`、`references/task-reviewer-prompt.md`、`references/re-review-prompt.md`、`tests/sdd.test.mjs`、`tests/sdd-scripts.test.mjs`(新)、`tests/cli.test.mjs`(删四 verb 用例)、`CHANGELOG.md`、`AGENTS.md`。`bin/` 零改动;MCP 协议层(`createServer`)零改动。
