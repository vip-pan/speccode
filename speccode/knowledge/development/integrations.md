<!-- distilled-from: cap/pr-tool-integration -->
**pr_tool 探测与封装**:init 时经 `git remote get-url origin` 探测远端类型(github.com → gh;gitlab → glab;其他 → none)写入 config;命令运行时不再探测。安装校验(command -v)未装则降级 none 并提示。

**query-pr 单次查询 verb(现行)**:返回五态 {MERGED, OPEN, CLOSED, CONFLICTING, UNKNOWN};引擎 MUST NOT 提供阻塞式等待 verb(v1 的阻塞 waitmerge 与 Claude Code Bash 超时模型不兼容,从未被接线,已删)。30s 轮询、30min 超时(约 60 次)的等待循环留在命令 prose,以 query-pr 为基础;--resume 用同一间隔;超时写 pending_operation 供续跑。gh 查询 `gh pr view <number-or-head> --json state,mergedAt,mergeCommit,mergeable`(mergeable → CONFLICTING);glab `glab mr view --output json`(has_conflicts 映射)。**PR base 同步**:finishing-worktree 创建 PR 前必须先 `git push origin <feature>`,保证 base 在远端最新,避免多 worktree 串行时 base 过期 diff 混入他人成果;远端分叉(non-fast-forward)中止不强推。

**repo-merge-config 探测 verb**(DI 注入 runner 可测):经 `gh api repos/:owner/:repo` 读 allow_squash_merge/allow_merge_commit/allow_rebase_merge;isSquashOnly = squash true 且 merge/rebase 均 false;仅 gh 支持完整探测,glab/none/gh 失败一律返 null(warn-only);init 与 finishing-worktree 建 PR 前调用,非 squash-only 警告 + 设置指引,不阻断。(出自 archive/2026-07-13-add-speccode-plugin、2026-08-09-speccode-v2-sdd-flow、2026-09-03-remove-feature-layer)
<!-- /distilled -->

<!-- distilled-from: cap/hook-event-integration -->
**事件枚举(14 个固定事件)与载荷**:onExplored, onFeatureCreated, onWorktreeCreated, onProposed, onBrainstormed, onPlanned, onTaskCompleted, onCodeReviewRequested, onCodeReviewCompleted, onWorktreeFinished, onFeatureFinished, onPrOpened, onSynced, onArchived。hook 进程经 stdin 收单行 JSON;命令经 `sh -c <cmd>` 执行,cwd = 目标项目根,默认 30s 超时;payload 序列化为单行 JSON(特殊字符正确转义)。

**stdin 读取约束**:payload 片段允许为空(视为 {}),run-hook 的 stdin 读取 MUST 容忍空输入,不阻塞等待;stdin 读取用 isatty(0) 判定(TTY 时跳过),绝不直接触碰 process.stdin(否则 fd 0 被置非阻塞、慢生产者场景 readFileSync(0) 抛 EAGAIN 静默丢片段)。

**run-hook 是唯一永远 exit 0 的 verb**:handler 整体 try/catch 兜底、永不返回 ok:false——否则 bin main() 的 catch 会在最不该失败的时刻(hook 挂点)exit 1。所有错误(未传 --event、stdin 片段解析失败、hook 超时/非零退出)折叠进 hook 字段({ran, ok, warning?, exitCode?, error?}),恒返 {ok:true, hook:{...}}。这是 warn-only 语义的成立条件。(出自 archive/2026-08-09-speccode-v2-sdd-flow)
<!-- /distilled -->

<!-- distilled-from: cap/code-intel-tool-integration -->
**代码智能探测已退役(2026-10-21-init-slim-config)**:五源环境嗅探(插件注册表/CLI/项目与用户 MCP/配置目录)与 detect-code-intel-tools verb、config.code_intel_tools 登记整体移除——MCP 时代会话的工具列表就是发现面,登记只是过期快照;认知命令的咨询改会话可见性措辞(可用则优先、不可用静默回退 Grep/Glob/Read、永不报错,不读配置)。**幸存件**:resolve-worktree-dir verb 输出 {ok, dir, source, ignore},ignore = {scope:'outside'} | {scope:'inside', ignored: boolean};git check-ignore 退出码三态 0/1/128(对目录查询带尾斜杠)。新增 default-branch verb(主干名运行时四级探测,见 environment 块)。(出自 archive/2026-08-13-knowledge-tools-detection、2026-08-12-check-ignore-outside-repo、2026-08-16-code-intel-rename、2026-10-14-host-neutral-engine、2026-10-21-init-slim-config)
<!-- /distilled -->

<!-- distilled-from: cap/sdd-document-lifecycle -->
**SDD 伴生脚本(随 skill 分发,现行)**:sdd-workspace / task-brief / review-package / tick-task 是 SDD 的承重件(工件以文件交接纪律所系)。2026-10 起以伴生脚本形态随 subagent-driven-development skill 分发:skills/subagent-driven-development/scripts/ 下共享模块 sdd-plan.mjs(承载 fence 状态机与区段边界,逐字保真自退役的 lib/sdd.mjs,fence 误勾防御由 sdd.test 原用例继续钉死)+ 位置参数、单行 JSON 输出的可执行脚本;伴生脚本 MUST NOT import lib(脚本随插件走、lib 随引擎 npm 包走);引擎侧四 verb 与同名 MCP tool 已删(单一实现不留双份),prose 锚点 = 宿主报告的 skill base directory(plugin-root 兜底)。**ledger 脚本化**:task-start 一次调用写 brief + 记 BASE;task-done 双模式(--note 注记原文用于 SDD「审查干净」完成点 / -- <cmd> 跑验证命令、仅成功记行、退出码透传),完成行单次 O_APPEND 追加(ledger 缺失先写身份首行)——手写完成行退役。(出自 archive/2026-08-09-speccode-v2-sdd-flow、2026-10-21-sdd-companion-scripts)
<!-- /distilled -->

<!-- distilled-from: cap/session-memory -->
**memory 数据模型**:feature 级 memory 为 .speccode/memory/<type>__<slug>.md(双下划线规则,复用 state 文件命名);trunk 级例外 .speccode/memory/_knowledge.md(知识维护摘要,保留键)与探索 topic 文件 .speccode/memory/_exploring__<topic>.md(键 _exploring/<topic>;单堆 _exploring.md 已退役,读兼容保留)。memory 保持 untracked(与 .speccode/ 其他运行时数据一致);主仓定位使同一 feature 的多个 worktree 共享同一份 memory。(出自 archive/2026-08-16-knowledge-trunk-bootstrap、2026-08-16-knowledge-command-rename)
<!-- /distilled -->

<!-- distilled-from: cap/tool-input-sanitization -->
**Claude Code PreToolUse updatedInput 机制(spike 实证)**:hook 输出 {hookSpecificOutput:{hookEventName:'PreToolUse', permissionDecision:'allow', updatedInput:<完整替换的 tool_input>}} 即可在工具执行前改写输入;updatedInput 会被目标工具的 schema 完整校验(不合法则整次调用报 schema 错,而非静默忽略——构造替换输入必须合法);hook 匹配经 hooks.json 的 matcher 字段;hook 载荷经 stdin 单行 JSON 含 tool_name/tool_input/tool_use_id/session_id 等;插件级 hooks/hooks.json 随插件启用自动生效,不写目标项目 settings,卸载无残留。(出自 archive/2026-09-02-askuserquestion-cr-sanitizer)
<!-- /distilled -->
