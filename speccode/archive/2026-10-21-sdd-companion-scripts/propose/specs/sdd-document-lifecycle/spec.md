# sdd-document-lifecycle Delta: sdd-companion-scripts

## RENAMED Requirements

- FROM: `### Requirement: SDD 工件生成 verb`
- TO: `### Requirement: SDD 伴生脚本`

## MODIFIED Requirements

### Requirement: SDD 工作区

subagent-driven-development 与 executing-plans 的执行期工件(task brief、report、review package、ledger、测试日志)SHALL 由伴生脚本写入**当前 worktree 根**(`git rev-parse --show-toplevel`,以脚本进程 cwd 解析)下的 `.speccode/sdd/<plan-basename>/`;MUST NOT 使用 `.git/` 内路径;不同 plan 的工作区目录 MUST 互相隔离;脚本 MUST 在 `.speccode/sdd/` 下维护内容为 `*` 的 `.gitignore` 自忽略(幂等,不碰用户 `.gitignore`)。

#### Scenario: 工作区定位于当前 worktree 根
- **WHEN** 在 linked worktree 内执行 `sdd-workspace.mjs <PLAN>`
- **THEN** 输出 `dir` MUST 位于该 worktree 根目录下(而非主仓),随 `git worktree remove` 自动清理

#### Scenario: 不同 plan 互相隔离
- **WHEN** 两个 plan 文件 basename 不同
- **THEN** 二者的工作区 MUST 为 `.speccode/sdd/` 下两个独立目录,ledger 互不污染

### Requirement: SDD 伴生脚本

SDD 执行机器 SHALL 以伴生脚本形态随 skill 分发,位于 `skills/subagent-driven-development/scripts/`:共享模块 `sdd-plan.mjs`(非可执行,导出 `scanPlan` / `extractTaskBrief` / `tickTask` / `sddWorkspace` / `worktreeRoot`)与可执行脚本 `sdd-workspace.mjs` / `task-brief.mjs` / `review-package.mjs` / `tick-task.mjs` / `task-start.mjs` / `task-done.mjs`。可执行脚本 MUST 首行 `#!/usr/bin/env node` 且具备可执行位;全部文件 MUST 仅 import `node:` 内置模块或同目录相对路径,**MUST NOT import `lib/`**(脚本随插件走,引擎随 npm 走,二者分发面不同)。引擎 MUST NOT 再提供 `sdd-workspace` / `task-brief` / `review-package` / `tick-task` verb 与同名 MCP tool;`lib/sdd.mjs` MUST 不存在。

脚本 CLI 契约:必需参数位置化,可选参数 `--out <path>`;成功输出单行 JSON `{ok:true, …}` 并 exit 0,失败输出 `{ok:false, error}` 并 exit 1(`task-done.mjs` 例外,见「ledger 脚本化」)。`sdd-workspace.mjs <PLAN>` → `{ok, dir}`;`task-brief.mjs <PLAN> <N> [--out P]` → `{ok, path}`;`review-package.mjs <PLAN> <BASE> <HEAD> [--out P]` → `{ok, path}`;`tick-task.mjs <PLAN> <N>` → `{ok, plan, task, ticked, already}`。

`task-brief.mjs` MUST 按 `Task N` 标题做 fence 感知的精确抽取(`Task 1` MUST NOT 误配 `Task 10`,代码块内的标题文本 MUST 被忽略);`review-package.mjs` MUST 以调用方记录的 BASE(禁止 HEAD~1 等相对引用)生成 commit 列表 + `diff --stat` + `-U10` diff,写入按 range 命名的文件;`tick-task.mjs` MUST 把 plan 中 Task N 区段内 fence 外的 `- [ ]` 勾选为 `- [x]`,经原子写落盘,输出 `ticked`(本次真正勾选的 step 行)与 `already`(此前已是 `[x]` 的行),本次无勾选时 MUST NOT 改写 plan 文件,Task N 不存在时 MUST 返回 `{ok:false,error}`、exit 1 且不修改 plan 文件。

`task-brief.mjs` 与 `tick-task.mjs` MUST 共用 `sdd-plan.mjs` 的同一套 plan 区段扫描,保证抽取与勾选看到相同的区段:fence 按 CommonMark 长度规则闭合(开栏的 K 个反引号只能被 `>=` K 个反引号且其后无内容的行闭合),嵌套或加长 fence(如 ````markdown 块内含 ```bash)MUST NOT 在块内翻转 fence 状态;`Task N` 区段 MUST 止于下一个同级或更高级标题(下一个 `### Task M`,或 `## 禁止占位符自检` / `## 收尾` 等尾部章节),MUST NOT 蔓延到尾部非 Task 章节。

#### Scenario: task-brief 精确匹配
- **WHEN** plan 文件含 Task 1 与 Task 10,执行 `task-brief.mjs <PLAN> 1`
- **THEN** 输出文件 MUST 仅含 Task 1 的内容,不含 Task 10 的任何行

#### Scenario: fence 内标题忽略
- **WHEN** plan 文件中某代码块内出现 `### Task 99` 文本
- **THEN** `task-brief.mjs` MUST NOT 将其识别为任务标题,`tick-task.mjs <PLAN> 99` MUST 报 task 不存在(`ok:false`、exit 1)且不修改 plan 文件

#### Scenario: 嵌套 fence 不翻转状态
- **WHEN** plan 文件中一个 ````markdown 块内含未缩进的 ```bash 内层 fence 与 `- [ ]` 文本
- **THEN** 内层 fence MUST NOT 闭合外层块——块内 `- [ ]` MUST NOT 被 `tick-task.mjs` 勾选,块后的 `### Task M` 标题 MUST 仍被识别为任务标题

#### Scenario: 任务区段止于同级或更高级标题
- **WHEN** plan 的最后一个 `### Task N` 之后跟着 `## 收尾` / `## Self-Review` 等尾部章节,章节内含 `- [ ]`
- **THEN** `tick-task.mjs` MUST NOT 勾选这些尾部章节的 checkbox,`task-brief.mjs` MUST NOT 把它们纳入该任务的 brief

#### Scenario: review-package 按 range 命名
- **WHEN** 执行 `review-package.mjs <PLAN> <B> <H>`
- **THEN** 输出文件 MUST 命名为 `review-<B前7位>..<H前7位>.diff`,内容含 commit 列表、`--stat` 与 `-U10` diff

#### Scenario: tick-task 勾选 Task N 且 fence 内不误勾
- **WHEN** 对含 fence 代码块的 plan 执行 `tick-task.mjs <PLAN> <N>`
- **THEN** 仅 Task N 区段内 fence 外的 `- [ ]` MUST 被改为 `- [x]`,fence 内的 `- [ ]` 与其他 Task 的 checkbox MUST 保持不变

#### Scenario: tick-task 幂等
- **WHEN** 对同一 Task N 重复执行 `tick-task.mjs`
- **THEN** 已 `[x]` 的 checkbox MUST 保持不变,输出 `ticked` 为空、`already` 列出全部已勾选项,plan 文件 MUST NOT 被改写(内容逐字节不变)

#### Scenario: 脚本不依赖引擎
- **WHEN** 检查 `skills/subagent-driven-development/scripts/*.mjs` 的 import 语句,并在 PATH 无 `speccode` 的环境执行 `sdd-workspace.mjs`
- **THEN** 不存在指向 `lib/` 的 import,脚本正常输出 `{ok:true, dir}`

#### Scenario: 引擎不再暴露四 verb
- **WHEN** 执行 `speccode tick-task`,并经 MCP `tools/list` 列出工具
- **THEN** CLI 返回 `{ok:false, error:"unknown verb: tick-task"}`,工具列表不含 `sdd-workspace` / `task-brief` / `review-package` / `tick-task`

### Requirement: plan 执行进度勾选

`executing-plans` 与 `subagent-driven-development` SHALL 在每个 task 完成点(审查通过、ledger 写 complete 行之后)调用伴生脚本 `tick-task.mjs <PLAN> <N>` 把 plan 文档(`speccode/changes/<slug>/plan/*.md`)中该 Task N 下所有 `- [ ]` step checkbox 勾选为 `- [x]`;勾选 MUST 经伴生脚本下沉,命令层 MUST NOT 用 sed/awk 在 prose 内直接改 plan。脚本输出 `ticked` 非空时命令 MUST 随同簿记点 commit(`docs(speccode): tick task <N>`);`ticked` 为空(幂等重跑,plan 未被改写)时 MUST 跳过 commit,MUST NOT 硬跑 `git commit` 让 "nothing to commit" 以非零退出误报失败。勾选 commit MUST 落在审查通过之后,不进入 `review-package.mjs` 的 base..head diff;ledger(`progress.md`)MUST 保持为崩溃恢复的唯一权威,plan checkbox 仅作完成态的派生视图,MUST NOT 参与恢复判断。

#### Scenario: task 完成点勾选并 commit
- **WHEN** subagent-driven-development 某任务审查干净、ledger 经 `task-done.mjs` 写入 `Task <N>: complete` 行
- **THEN** 命令 MUST 调用 `tick-task.mjs <PLAN> <N>` 勾选 plan 中 Task N 的 step checkbox,并在 `ticked` 非空时 commit `docs(speccode): tick task <N>`

#### Scenario: 幂等重跑跳过 commit
- **WHEN** 恢复后对已勾选完的 Task N 重跑 `tick-task.mjs`,输出 `ticked` 为空、`already` 列出全部
- **THEN** 命令 MUST 跳过 `git commit`(无变化可提),MUST NOT 因 "nothing to commit" 的非零退出判定任务失败

#### Scenario: 勾选 commit 不污染审查 diff
- **WHEN** tick-task 的 commit 产生于审查通过之后
- **THEN** `review-package.mjs` 的 base..head diff MUST NOT 包含该勾选 commit(它在 head 之后)

#### Scenario: ledger 仍为恢复权威
- **WHEN** 控制器从崩溃恢复,读取进度
- **THEN** 恢复判断 MUST 仅依据 ledger(`progress.md`)的 complete 行,plan 的 `[x]` MUST NOT 作为恢复信号

## ADDED Requirements

### Requirement: ledger 脚本化

ledger 的 BASE 记录与完成行写入 SHALL 经伴生脚本完成,命令层 MUST NOT 手写 `Task <N>: complete` 行:

- `task-start.mjs <PLAN> <N>` MUST 一次调用写出该任务 brief(等价 `task-brief.mjs`)并返回 `{ok:true, brief:<path>, base:<HEAD 全 sha>}`;`base` 即该任务审查 range 的起点,控制器 MUST 以它作为后续 `review-package.mjs` 与 `task-done.mjs` 的 BASE。
- `task-done.mjs <PLAN> <N> <BASE> (--note <text> | -- <test command…>)` MUST 二选一:**note 模式**不运行任何命令,注记取 `--note` 原文(SDD 的审查完成点用 `review clean` / `<K> parked`);**test 模式**以脚本 cwd 运行 `--` 后的命令、把全量 stdout+stderr 写入 `<ws>/task-<N>-tests.log`,注记为 `tests: <命令> → <日志最后一个非空行>`,命令非零退出时 MUST NOT 写 ledger,输出 `{ok:false, error, log, exitCode}` 并以**同一退出码**退出。两种模式成功时 MUST 以**单次** O_APPEND 追加写把完成行 `Task <N>: complete (commits <BASE 前 7 位>..<HEAD 前 7 位>, <注记>)` 追加到 `<ws>/progress.md`(ledger 不存在时先写身份首行 `# SDD ledger — plan: <PLAN>`;既有内容末尾无换行时先补一个换行,与完成行同次写入),输出 `{ok:true, ledger, line, log?}` 并 exit 0;`BASE` 不是有效 commit、或两种模式都未给 / 都给时 MUST `{ok:false,error}` + exit 1 且不运行命令、不写 ledger。

#### Scenario: task-start 一次给出 brief 与 BASE
- **WHEN** 执行 `task-start.mjs <PLAN> 2`
- **THEN** 工作区出现 `task-2-brief.md`(内容为 Task 2 区段),输出 `base` 等于 `git rev-parse HEAD`

#### Scenario: task-done test 模式仅在测试通过时记行
- **WHEN** 以会成功的命令(如 `node -e "process.exit(0)"`)执行 `task-done.mjs <PLAN> 2 <BASE> -- …`
- **THEN** `progress.md` 首行为身份行,末行为 `Task 2: complete (commits …, tests: … → …)`,`task-2-tests.log` 存在,exit 0

#### Scenario: task-done 测试失败不记行且透传退出码
- **WHEN** 以会失败的命令(如 `node -e "process.exit(3)"`)执行 `task-done.mjs <PLAN> 2 <BASE> -- …`
- **THEN** `progress.md` 不新增任何行(不存在时亦不创建),输出 `ok:false` 且 `exitCode` 为 3,脚本退出码为 3

#### Scenario: task-done note 模式
- **WHEN** 执行 `task-done.mjs <PLAN> 3 <BASE> --note "review clean"`
- **THEN** 不运行任何命令、不产生测试日志,ledger 追加 `Task 3: complete (commits <base7>..<head7>, review clean)`,exit 0

#### Scenario: 完成行单次追加
- **WHEN** 两个 task 的 `task-done.mjs` 先后成功
- **THEN** ledger 恰含身份行 + 两条完成行,无空行粘连、无半行
