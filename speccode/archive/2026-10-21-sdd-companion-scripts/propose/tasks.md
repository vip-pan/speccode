# Tasks: sdd-companion-scripts

> 本清单已由 plan/2026-10-21-sdd-companion-scripts-plan.md 接管:实现进度以 plan 的 checkbox 为准,本文件不再勾选,仅作意图索引。

## A. 伴生脚本(skills/subagent-driven-development/scripts/,无依赖)

- A1 `sdd-plan.mjs`:从 `lib/sdd.mjs` 逐字搬入 `scanPlan` / `extractTaskBrief` / `tickTask` / `sddWorkspace` / `worktreeRoot` / `taskBrief` / `reviewPackage`,内联 `writeTextAtomic`(来自 lib/atomic.mjs)与 `git()`(来自 lib/git.mjs)小助手;仅 `node:` import;`tests/sdd.test.mjs` 改 import 路径先行(14 用例断言零改动)
- A2 四个可执行脚本 `sdd-workspace.mjs` / `task-brief.mjs` / `review-package.mjs` / `tick-task.mjs`:shebang、可执行位、位置参数 + `--out`、单行 JSON、`ok:false` + exit 1;共用一个极小的 argv/输出助手(同目录 `cli-util.mjs` 或内联)
- A3 `task-start.mjs`(brief + `git rev-parse HEAD` → `{ok, brief, base}`)与 `task-done.mjs`(校验 BASE → 以 cwd 运行 `--` 后命令 → 日志落 `<ws>/task-<N>-tests.log` → exit 0 时单次 appendFileSync 写完成行(ledger 缺失先写身份首行)→ 退出码透传)
- A4 `tests/sdd-scripts.test.mjs` 端到端(`spawnSync('node', [script, …])` 对 `makeRepo()` 临时仓):workspace 隔离 + `.gitignore` 自忽略 + linked worktree 根、brief 精确抽取(1≠10、fence 内标题)、review 命名与内容、tick 幂等与 fence 不误勾、task-start 输出、task-done 成功记行/失败不记行且透传退出码/两次追加无粘连;守卫:shebang + 可执行位、无 `lib/` import、SKILL.md 引用的脚本文件存在

## B. 引擎退出 SDD 机器

- B1 删除 `lib/sdd.mjs`;`lib/verbs.mjs` 删四个 verb 与 `./sdd.mjs` 导入;`lib/mcp.mjs` `TOOL_META` 删四项(parity 守卫自动对齐)
- B2 `tests/cli.test.mjs` 删四 verb 的端到端用例(sdd-workspace ×3、task-brief ×2、review-package ×1、tick-task ×3),新增「四 verb 已不存在」用例(`unknown verb`);`tests/mcp.test.mjs` 零改动(1:1 断言动态)

## C. prose 改写

- C1 `skills/subagent-driven-development/SKILL.md`:开头增「伴生脚本锚点」段(`<scripts>` 定义 + `plugin-root` 兜底);`speccode sdd-workspace/task-brief/review-package/tick-task --cwd . …` 全部改为 `node <scripts>/<name>.mjs …`(位置参数);brief + BASE 改经 `task-start.mjs`;ledger complete 行改经 `task-done.mjs`(调用点写明测试命令取自 plan 该 task 的验证命令);保留 `tick-task` 字样、`docs(speccode): tick task` 文案、「`ticked` 为空 → 跳过 commit」措辞(既有 prose 守卫)
- C2 `skills/executing-plans/SKILL.md`:锚点段(`<scripts>` = `<本 skill base>/../subagent-driven-development/scripts`,兜底同上);tick 步骤改脚本形态;task 完成点引入 `task-done.mjs`(复用 ledger),保留既有守卫措辞
- C3 `references/task-reviewer-prompt.md` 与 `references/re-review-prompt.md` 占位符说明里的 `speccode task-brief/review-package …` 改为脚本形态
- C4 `cli.test.mjs` prose 守卫复核:宿主专属 token 清单与 `speccode.mjs <verb>` 形态守卫对新 prose 仍通过;必要时为「锚点段唯一」增一条守卫

## D. 文档

- D1 `CHANGELOG.md` `[Unreleased]`:Added(task-start / task-done 伴生脚本)、Changed(SDD 四件套由引擎 verb 改为伴生脚本,**BREAKING**:`sdd-workspace` / `task-brief` / `review-package` / `tick-task` verb 与同名 MCP tool 删除,升级路径 = 改调脚本)
- D2 `AGENTS.md`:架构节 lib 模块 17 → 16(去 sdd),第 3 层命令交互层补「伴生脚本」说明(位置、锚点、不 import lib),常用命令补一行脚本手动驱动示例;关键不变量「SDD 工作区 show-toplevel」措辞由 verb 改为脚本

## E. 验证

- E1 全量 `node --test ./tests/*.test.mjs` 通过
- E2 无引擎冒烟:`PATH` 中临时去掉 `speccode` 后,对一个临时仓依次跑 `sdd-workspace.mjs` → `task-start.mjs` → `task-done.mjs … -- node -e "process.exit(0)"` → `tick-task.mjs`,ledger 与 plan 结果符合规格
- E3 grep:`skills/` 下无 `lib/` import;全仓无 `speccode (sdd-workspace|task-brief|review-package|tick-task)` 残留(archive/、CHANGELOG 历史小节除外)
