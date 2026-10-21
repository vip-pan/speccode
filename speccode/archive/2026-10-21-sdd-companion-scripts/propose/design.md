# Design: sdd-companion-scripts

## Context

`lib/sdd.mjs`(140 行)是 SDD 执行机器的唯一实现:`scanPlan`(CommonMark fence 状态机 + `Task N` 区段边界)被 `extractTaskBrief` 与 `tickTask` 共用,`sddWorkspace` 以 `--show-toplevel` 把工作区锚在**当前 worktree 根**(与主仓定位的有意差异),`reviewPackage` 打包 commit/stat/diff。它们经 `lib/verbs.mjs` 暴露为四个 verb、经 `TOOL_META` 暴露为四个 MCP tool,唯一调用方是 `skills/subagent-driven-development/SKILL.md` 与 `skills/executing-plans/SKILL.md`(另有 `references/task-reviewer-prompt.md`、`references/re-review-prompt.md` 两个模板在占位符说明里提及)。`tests/sdd.test.mjs` 14 个单测 + `cli.test.mjs` 约 10 个端到端用例覆盖。

ledger(`progress.md`)目前**由 agent 手写**(身份行、`Task <N>: complete` 行、fix round 行);BASE 由控制器自行 `git rev-parse HEAD` 记录。superpowers v7 的对应物:`skills/*/scripts/` 下五个 bash 伴生脚本,其中 `task-start`(brief + BASE 一次调用)与 `task-done`(跑测试命令、仅成功时追加 ledger 行)把这两处「手写」变成脚本化写入。

约束:零第三方依赖;`lib/` 在目标形态里随引擎 npm 包走、不随插件走(伴生脚本 MUST NOT import lib);prose 宿主中立(禁 `CLAUDE_PLUGIN_ROOT` 等宿主专属 token,grep 守卫钉死);fence 状态机的既有防御(误勾事故)MUST NOT 回退。

## Goals

- SDD 执行机器随 skill 走:无引擎(无 PATH 上的 `speccode`)时,`executing-plans` / `subagent-driven-development` 的工件链(工作区、brief、review package、勾选、ledger)完整可用。
- 单一实现:伴生脚本化后引擎侧四 verb/tool 删除,不保留两份。
- ledger 完成行与 BASE 记录脚本化(吸收 superpowers task-start/task-done),手写 ledger 行退役。
- 既有测试语义保留(fence/区段/幂等/隔离),新增脚本守卫。

## Non-Goals

- 其他 22 个 skill 的 lite 降级分支(lite-semantics 子需求)。
- evals 基础设施(agent-skills 的 run-evals 体系;价值明确但体量独立,记为后续独立需求)。
- 改 `createServer` / 协议层(MCP tool 面随 verb 删除自然收缩,1:1 契约不变)。
- README / DESIGN 门面(docs-i18n;两者对四 verb 零提及,无漂移)。
- ledger `started` 行 / fix round 行脚本化(保持协议最小;fix round 行是控制器循环语义,与 complete 行不同层)。
- 版本 bump(发布 chore)。

## Decisions

**D1. 伴生脚本用 node ESM,不用 bash。** superpowers 选 bash 是因为它的世界不假设 node;speccode 的插件本来就要求 Node ≥ 24(engine、hooks 全是 node),而 `scanPlan` 的 fence 状态机(嵌套 fence、`Task 1`≠`Task 10`、区段边界)是 JS 实现逐字保真的最廉价路径——翻写成 bash 必然弱化防御。被否备选:bash 逐句移植(为「像 superpowers」付出正确性风险);脚本 import `../../../lib/sdd.mjs`(把引擎耦合带回 lite 边界内,目标形态下 lib 不随插件分发,脚本会直接断)。

**D2. 单一脚本目录:`skills/subagent-driven-development/scripts/`,executing-plans 跨 skill 相对引用。** 共享模块 `sdd-plan.mjs` + 六个可执行脚本同目录,`tick-task.mjs` / `task-start.mjs` / `task-done.mjs` 也放这里(executing-plans 的 prose 以 `<本 skill base>/../subagent-driven-development/scripts` 引用,与 superpowers 的跨 skill 相对引用同构)。被否备选:每个 skill 只放自己用的脚本(tick-task 要出现两份或仍跨引用,共享模块无家可归);顶层 `scripts/`(伴生脚本的要点就是「跟 skill 走」,顶层目录违背初衷)。

**D3. 位置参数 + 单行 JSON 输出。** 必需参数位置化(`sdd-workspace.mjs <PLAN>`,superpowers 肌肉记忆,prose 更短),可选 `--out`;输出保持 verb 文化的单行 JSON(`{ok,…}`),错误 `{ok:false,error}` + exit 1——prose 今天解析的 `dir` / `path` / `ticked` / `already` 字段全部沿用,SDD skill 的改动只剩命令形态本身。`task-done` 例外:退出码 = 测试命令退出码(失败即非零,不吞)。被否备选:全 flag 形态(与 superpowers 不一致且更长);文本输出(丢失机器可解析性)。

**D4. 引擎侧四 verb/tool 删除,单一实现不留双份。** SDD 机器只有 SDD skill 一个调用方,伴生化后引擎保留 verb 只会制造第二份真相与 parity 负担;`lib/sdd.mjs` 整体迁走(含 `worktreeRoot` 的 `--show-toplevel` 有意差异,随脚本走)。MCP 面:TOOL_META 删四项,「tools 与 verb 1:1」契约不动。被否备选:verb 留壳转调脚本(纯间接层,双入口无受益);verb 与脚本并存并 deprecate(BREAKING 延后但复杂度常驻)。

**D5. 吸收 task-start / task-done,ledger 完成行退役手写;task-done 双模式适配两个 skill 的完成点。** `task-start.mjs <PLAN> <N>` 一次调用产出 brief 路径 + BASE 全 sha(替代 task-brief + 手跑 rev-parse 两次调用——superpowers 的原话:每次调用都是一轮重读上下文的 turn)。`task-done.mjs <PLAN> <N> <BASE> (--note <text> | -- <cmd…>)`:两个 skill 的完成点语义不同——executing-plans(内联)在 task 收尾跑该 task 的验证命令,用 **test 模式**(跑命令、全量输出落 `<ws>/task-N-tests.log`、**仅 exit 0 时**记行,注记 `tests: <cmd> → <log 末行>`,失败透传退出码);subagent-driven-development 的完成点是「审查干净」,测试早已由实现者与审查者验证,用 **note 模式**(不跑命令,注记原文 `review clean` / `<K> parked`,与现行 ledger 行格式逐字一致)。两种模式都是单次 `appendFileSync`(O_APPEND)写完成行,ledger 缺失先写身份行 `# SDD ledger — plan: <PLAN>`,既有内容无尾换行时补一个换行并入同次写入(memory append 的边界教训)。这把「ledger 声称完成但测试其实没过」「手写行格式漂移」两类失败在结构上消灭。executing-plans 此前只在措辞上承认 ledger 是恢复权威却没有 ledger 协议——本需求借 task-start/task-done 给内联执行补上真实的崩溃恢复(入口解析工作区 + 读 complete 行跳过已完成任务),与 superpowers v7 对齐。不吸收 `started` 行;fix round 行仍由控制器手写(循环语义,不同层)。

**D6. 脚本锚点 = 宿主报告的 skill base directory,`plugin-root` 兜底。** 每个 SDD skill 开头一段锚点说明:`<scripts>` 取宿主加载 skill 时报告的 base directory 下 `scripts/`;宿主未报告时以 `$(speccode plugin-root --cwd .)/skills/subagent-driven-development/scripts` 兜底(有引擎时总可用)。禁写 `${CLAUDE_PLUGIN_ROOT}`(宿主中立守卫)与 `speccode.mjs <verb>` 形态不变;「裸调引擎」条款增补伴生脚本例外(见 plugin-packaging delta)。被否备选:prose 写死绝对/相对路径(宿主布局不同必断);只靠 `plugin-root`(无引擎时失效,违背本需求初衷)。

**D7. 测试迁移而非重写。** `tests/sdd.test.mjs` 只改 import 路径(14 用例断言零改动,fence 防御由原用例继续钉死);`tests/sdd-scripts.test.mjs` 新增端到端(spawn 脚本对 `makeRepo()` 临时仓:workspace 隔离/自忽略、brief、review 命名、tick 幂等、task-start、task-done 成功记行 + 失败不记 + 退出码透传)+ 脚本守卫(shebang、可执行位、无 `lib/` import、SKILL.md 引用的脚本都存在)。`cli.test.mjs` 删四 verb 的端到端用例(约 10 个,契约演进——这些 verb 不复存在),保留 prose 守卫两条(`tick-task` 字样、tick commit 文案、幂等跳过,新形态仍满足)。

**D8. agent-skills 的 validator 吸收为守卫测试。** 它的 `validate-skills` 是 dev-time 结构校验;speccode 的守卫测试体系(cli.test / skill-frontmatter.test)就是本地等价物,本需求补齐「伴生脚本」维度的守卫(见 D7),不引入独立 validator 命令。evals 显式 Non-Goal。

## Risks

- **宿主不报告 skill base directory** → `plugin-root` 兜底(有引擎时可用);六宿主实测与措辞打磨归 host-adapters-mcp。锚点段落集中在每个 skill 开头一处,漂移面最小。
- **外部调用方依赖四 verb/tool** → CHANGELOG BREAKING 标注 + 升级路径(脚本 CLI 等价);插件内调用方同 PR 改完。
- **跨 skill 相对引用在「只安装部分 skill」的宿主断链** → 插件打包始终全量 skills(files 白名单),宿主按目录整体加载;风险仅在用户手工摘抄单个 skill,锚点段落已写明依赖关系。
- **fence 状态机迁移引入回归** → sdd.test 14 用例逐字保留,改动仅 import 路径;review 以 diff 验证逐字搬移。
- **task-done 语义误用(把测试命令写错)** → 退出码透传 + 失败信息含全量日志路径;SDD prose 在调用点写明「测试命令取 plan 该 task 的验证命令」。

## Open Questions

- `task-done` 的 ledger 行是否需要记 `-- <cmd>` 全文(现行格式含 cmd 摘要)——按 superpowers 格式含 cmd,超长命令截断与否留实现时定(守卫测试不钉死该细节)。
