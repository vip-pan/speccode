---
tier: 2
---

# Proposal: lite-semantics

## Why

大需求 prose-core-mcp-split 的名字来源:prose 核心应该在**无引擎**(`speccode` 不在 PATH——非 CC 宿主未走 npm/shim)时仍可用。当前 22 个 skill 共 100+ 处 `speccode <verb>` 调用,引擎缺失即全部断链。探索期已定 lite 边界:SDD 家族天然 lite(伴生脚本零依赖,已兑现);读类可直读文件;编排类不可降级(给引导不假装等价);hooks 静默跳过。本需求把该边界写进全部 skill 的 prose 并用守卫钉死。

## What Changes

- **统一「引擎可用性」降级表段**:每个有引擎调用的 skill(22 个)在正文开头(frontmatter 后、首个 `##` 前)插入**同一段**锚点段:探测(`command -v speccode`)+ 降级表(read-config→cat 主仓根 config、read-knowledge→cat worktree 根知识文件、read-memory/list-memory→cat/ls 记忆文件(键编码 `/`→`__`)、write-memory→手动文件编辑(单分支假设)、plugin-root→`<skill base>/../..`(宿主报告的 skill 目录的上两级)、default-branch→git 三连(symbolic-ref→main→master)、run-hook→静默跳过(warn-only 语义天然兼容)、write-config→init 手写例外、reconcile/state/PR/知识写机器→**并行编排与蒸馏不可用**,提示安装引擎(`npm i -g speccode` 或宿主 shim)后重跑)。段文本单源(计划给定全文字面量),逐字复制。
- **编排命令的引导句**(4 个:creating-worktree / creating-feature / finishing-worktree / finishing-feature + status):锚点段之外,在其步骤开头加一行 lite 行为声明——探测失败时打印「本命令依赖编排引擎(state/对账/PR),lite 模式不可用;已中止,未做任何改动」并退出(creating-* 与 finishing-*),或降级为只读报告(status 用 git 直达 + 手工核对引导)。
- **知识入口段的 lite 行**(9 个认知命令):`speccode read-knowledge --index/--topic` 调用点紧随的兜底句补「引擎缺失时按降级表直读文件;文件不存在视为无知识,静默继续」(T0 兜底在 lite 下等价成立)。
- **守卫测试**(tests/lite.test.mjs 新文件):①每个含 `speccode <verb>` 调用的 skill 必含锚点段的探测行与降级表首行(锚点段单源逐字);②锚点段在 22 个 skill 中逐字节一致(抽样哈希比对全部);③`command -v speccode` 字样不在 SDD 家族 skill(天然 lite,无需锚点——避免误导);④裸调守卫回归(host token / speccode.mjs 形态不受影响)。
- **文档**:CHANGELOG `[Unreleased]`(Changed:lite 降级语义,非 BREAKING);AGENTS.md 常用命令段补一行 lite 探测说明。知识刷新留收尾后 chore。

## Capabilities

- `lite-degradation`(ADDED:新能力——锚点段、读类直读、编排引导、hooks 静默、天然 lite 边界)
- `plugin-packaging`(MODIFIED:命令通过 bin/ PATH 裸调引擎——补 lite 降级表例外与指向)

## Impact

`skills/*/SKILL.md`(22 个:锚点段;另 4 编排命令 + init 引导句;9 认知命令知识入口兜底句)、`tests/lite.test.mjs`(新)、`CHANGELOG.md`、`AGENTS.md`。引擎零改动;伴生脚本零改动;MCP 零改动。SDD 家族 2 个 skill(subagent-driven-development 含 verb 调用?——核查:其调用为 run-hook/read-memory 等,含锚点段;真正零引擎调用的是 test-driven-development / verification-before-completion / dispatching-parallel-agents,不加锚点)。
