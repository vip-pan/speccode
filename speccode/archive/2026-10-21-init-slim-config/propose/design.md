# Design: init-slim-config

## Context

config v3 现字段集(必填 version/initialized_at/trunk/remote/pr_tool/worktree_dir/code_intel_tools + 可选 hooks/language)中:`trunk` 与 `remote` 在引擎侧零消费(#70 删 migrate-state 后仅存的 `bin:132` 消费点已随之消失;`detect-remote` 硬编码 `'origin'`),全部 12 处使用都在 7 个 skill 的 prose(基点判定、前置校验、路由缺省、trunk 防护);`code_intel_tools` 的探测是五源环境嗅探(插件注册表/CLI/项目与用户 MCP/配置目录),`detect-code-intel-tools` verb + 6 个 skill 的咨询段消费它。`lib/detect.mjs` 同时承载 worktree-dir 解析与 gitignore 三分支(编排刚需,与代码智能无关)。init skill 53 行,含探测/确认/登记整节。

约束:零依赖;lib 语言中立;确定性逻辑下沉 lib;知识写入属 `chore/knowledge-*` 分支纪律;`plugin-packaging` 的裸调与 prose 守卫不可违;MCP tools 与 verb 1:1 parity 动态成立。

## Goals

- init 的产物与询问面收缩到「标记 + 少量可选项」,同一项目多 agent 共用零冲突。
- trunk 缺省从死配置字段改为运行时探测(单一真源 = git 自身)。
- code_intel_tools 整条探测/登记链退役,咨询改会话可见性措辞。
- 既有行为兼容:残留旧键的 config 读取零报错;pr_tool/language/worktree_dir 语义不变。

## Non-Goals

- 知识 `environment.md` config 字段集句的回写(纪律:收尾后开 knowledge 微 chore)。
- README / DESIGN 门面(docs-i18n)。
- lite 降级分支(其余 skill 的引擎缺失路径,lite-semantics)。
- memory 生命周期、host adapter、版本 bump。

## Decisions

**D1. 删字段,不留可选覆盖。** trunk 的非常规命名场景(如 `develop` 主干)极罕见,且真源本来就在 git(`origin/HEAD`);需要覆盖者可用 git 自身手段(设 origin/HEAD)。保留「可选覆盖」会让字段删而不死、init 询问面不缩,违背本需求目的。remote 同理:`detect-remote` 早已硬编码 origin,字段从未参与。被否备选:保留 `trunk` 为可选字段(死字段半衰期无限长);prose 内联 `git symbolic-ref`(确定性逻辑进 prose,违宪)。

**D2. `default-branch` = engine verb,探测链四级。** `symbolic-ref --short refs/remotes/origin/HEAD` → 本地 `main` → 本地 `master` → `"main"`(last-resort,保证恒有输出);`source` 字段让命令层可对 `last-resort` 打印一句提示。不用 `git remote show origin`(走网络、慢);探测在每次 verb 调用时执行(两条本地 git 命令,微秒级,无缓存必要)。lib 纯函数 `resolveDefaultBranch(runGit)` 注入 runner 单测;verb 壳透传。prose 的 12 处 `config.trunk` 全部改调 verb(命令在需要 trunk 名的步骤各调一次,不引入会话缓存变量——少一个状态源)。

**D3. code_intel_tools 整链退役,worktree-dir 探测保留。** 退役理由:(1) MCP 时代 agent 的工具列表就是发现面,config 登记是它的过期快照;(2) 五源嗅探每加一个工具就要改探测器表,维护面永远滞后;(3) 字段的唯一消费者是命令层的「优先用已登记工具」措辞,而同一判断会话内即可做出。保留 `resolveWorktreeDir`/`worktreeDirIgnoreState`/`isPathInside`:worktree 编排与 gitignore 三分支是刚需,与代码智能无关,只是恰合同文件——借拆分把文件改名为纯 worktree 定位职责(保留 `detect.mjs` 文件名与导出名,避免无谓改名触点;职责由删减自然收窄)。被否备选:保留字段但不再探测(死数据);把咨询措辞保留 config 读取(字段已删,无从读)。

**D4. init = 标记 + 三个可选询问(死键沿用未知键语义自然消失,无特例)。** 全新流程:`.speccode/` + `{version:3, initialized_at}` 落盘(原子写),然后可选询问 language(推荐取自对话)、pr_tool(经 `detect-remote` 的 URL 猜测 + 确认,`none` 显式可选)、worktree_dir。幂等流程:字段级 diff 不变;`trunk`/`remote`/`code_intel_tools` 按既有未知键语义处理——不进 diff、不被消费,init 整体重写时自然消失(不为三键增设特殊清理机制;「容忍未知键 + 重写时消失」正是 #70 之后的现行哲学)。host 节已随 #66 不存在,无需处理。

**D5. 咨询段措辞统一为会话可见性。** 四个认知型命令的「代码智能工具咨询」段替换为同一段模板:「若当前会话中可用的代码智能工具(如代码图谱/索引类 MCP 或 CLI),参考代码时 MUST 优先使用;不可用或不存在则静默回退 Grep/Glob/Read;任何情况下工具缺失 MUST NOT 导致报错。」——不读 config、不调 verb、零状态。init 与 reset 的相关节删除。

**D6. 知识回写走后续 chore。** 本分支改 config 字段集后,`knowledge/development/environment.md` 的对应句与 `architecture.md`(若提及)会再度过时;按 knowledge-set 分支纪律不在本分支写知识,收尾后开一个微 chore 刷新(与本次改动可能引出的其他知识漂移合并处理)。已在 proposal 声明,ledger 会记。

**D7. 测试面。** config.test:字段集必填/可选校验改写 + 三残留键容忍(既有「历史已删除字段」用例扩 param);detect.test:探测器表用例删、worktree-dir/isPathInside 用例保留;cli.test:init e2e 改最小形状、detect-code-intel-tools e2e 删、default-branch e2e 加(makeRepo 主分支为 master → fallback 路径;symbolic-ref 路径用 `git symbolic-ref refs/remotes/origin/master HEAD`?——本地无 origin,走 fallback;remote-head 路径用注入 runner 的单测覆盖);verbs.test 新守卫:skills/ 无 `config.trunk`/`config.code_intel_tools` 字样。

## Risks

- **`origin/HEAD` 未设的克隆**(浅脚本环境)→ fallback 链 main/master 兜住;`last-resort` 时 verb 的 `source` 让命令层可提示。六宿主实测归 host-adapters-mcp。
- **外部调用方依赖删掉的 verb/字段** → CHANGELOG BREAKING + 升级路径(verb:会话可见性措辞替代;字段:残留键被容忍)。
- **prose 改动面 11 个 skill** → 守卫测试钉死零残留;改动全部是「config.trunk → verb 调用」的机械替换 + 两个段落级替换。
- **knowledge 再度过时** → D6 已排程序。

## Open Questions

- `default-branch` 在 MCP tool 面的名字(parity 自动,无决策空间)——无。
- init 是否保留 `pr_tool` 探测询问(vs 全靠运行时 repo-merge-config/query-pr 的降级)——保留:`query-pr` 无 pr_tool 会拒绝,显式登记一次优于每命令报错。
