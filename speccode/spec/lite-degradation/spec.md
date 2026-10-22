# lite-degradation Specification

## Purpose

无引擎(`speccode` 不在 PATH)时 prose 核心的可用性契约:读类命令直读文件完整可用,编排命令显式拒绝并引导安装,hooks 静默跳过,SDD 家族经伴生脚本天然可用——无一处假装等价。

## Requirements

### Requirement: 引擎可用性锚点段

每个含引擎 verb 调用的 skill(正文出现 `speccode <verb>` 形态者;`/speccode:` 命令名引用不计)SHALL 在 frontmatter 之后、首个 `##` 标题之前包含**同一段逐字一致**的「引擎可用性」锚点段,内容 MUST 包含:探测命令 `command -v speccode`;读类降级表(read-config → cat 主仓根 `.speccode/config.json`、read-knowledge → cat worktree 根 `speccode/knowledge/` 下文件、read-memory / list-memory → cat / ls 记忆文件、键编码 `<type>/<slug>` → `<type>__<slug>`);写类降级(write-memory → 手动文件编辑(单分支假设)、write-config → 仅 init 手写最小 config 例外、知识写机器不可用);`plugin-root` → 宿主报告的 skill 目录上两级;`default-branch` → git 三连(symbolic-ref origin/HEAD → 本地 main → 本地 master);`run-hook` → 静默跳过;编排类(reconcile / state / PR / 清理)不可用 + 安装引导(`npm i -g speccode` 或宿主 PATH shim)。主仓根定位 = `dirname $(git rev-parse --path-format=absolute --git-common-dir)`、worktree 根 = `git rev-parse --show-toplevel`(纯 git,POSIX 一行)。零引擎调用的 skill MUST NOT 含锚点段。锚点段逐字一致性 MUST 由守卫测试钉死(全量比对)。

#### Scenario: 锚点段存在且一致
- **WHEN** 对全部 skills 运行守卫:提取含引擎调用的 skill 的锚点段
- **THEN** 每个含调用的 skill 均含锚点段,且全部锚点段逐字节相等;零调用 skill(verification-before-completion / dispatching-parallel-agents;test-driven-development 因 `$(speccode plugin-root …)` 模板引用实际携带锚点)不含

#### Scenario: 读类 lite 直达
- **WHEN** 引擎不在 PATH,执行 proposing 的知识入口(read-knowledge 等价物)
- **THEN** 按锚点段降级表 `cat` 对应文件;文件不存在视为无知识静默继续(T0 兜底 lite 等价)

#### Scenario: hooks 静默
- **WHEN** lite 下命令到达 run-hook 调用点
- **THEN** 按 anchor 段跳过,命令继续;不产生错误(warn-only 语义的 lite 等价)

### Requirement: 编排命令的 lite 拒绝

creating-worktree / creating-feature / finishing-worktree / finishing-feature 四命令在探测到引擎缺失时 SHALL 在步骤开头打印「本命令依赖编排引擎(state/对账/PR),lite 模式不可用;已中止,未做任何改动」并中止——MUST NOT 提供半套 worktree/state/PR 的手动替代步骤(那会制造 state 孤儿与未对账分支)。status 命令 SHALL 降级为只读报告:按锚点段降级表以 git 直达手工汇总,不做对账、不做状态推进。distilling-knowledge / recording-knowledge 的知识写机器同属编排待遇(lite 不可用并引导);其读侧照常。

#### Scenario: creating-worktree lite 中止
- **WHEN** 引擎缺失时执行 /speccode:creating-worktree
- **THEN** 打印中止语并退出;无 git worktree / state / 记忆 move 被执行

#### Scenario: status lite 只读
- **WHEN** 引擎缺失时执行 /speccode:status
- **THEN** 命令以 git 命令(log / worktree list / status)手工汇总只读信息,明确声明「lite 模式:未做对账与状态推进」

#### Scenario: 无半套编排
- **WHEN** 审计四个编排命令与两个知识写命令的 prose
- **THEN** 不存在「手动建 worktree 后手写 state」或「手动合并后手改 state」类替代步骤

#### Scenario: 文档流命令的 lite F 绑定
- **WHEN** lite 模式下执行 proposing / brainstorming / writing-plans / applying / syncing / executing-plans / subagent-driven-development 的分支绑定步骤(引擎路径经 reconcile 绑定 F)
- **THEN** 命令 MUST 降级为 `git rev-parse --abbrev-ref HEAD` 取当前分支为 F(须为 `<type>/<slug>` 形态,否则报错退出并提示安装引擎),不做对账与状态推进——文档流在 lite 下完整可用
