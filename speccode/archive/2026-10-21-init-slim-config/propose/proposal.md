---
tier: 2
---

# Proposal: init-slim-config

## Why

config.json 还背着三类「问而不用」的负担:`trunk` 与 `remote` 在引擎侧是**死字段**(#70 删 migrate-state 后零消费,`detect-remote` 硬编码 `origin`;全部 12 处引用都在命令 prose 里当缺省值用);`code_intel_tools` 是无 MCP 时代的发现机制变通——MCP 时代 agent 直接看得到自己的工具列表,环境嗅探式探测永远滞后;init 的询问面(host 已随 #66 退役、代码智能探测、trunk/remote 确认)对新用户是纯摩擦。这是大需求 prose-core-mcp-split 的既定子需求(用户决策:init 只做标记、删 remote/trunk、多 agent 共用同一项目)。

## What Changes

- **config 字段集瘦身**:删除 `trunk`、`remote`、`code_intel_tools`。必填字段只剩 `version: 3` + `initialized_at`;可选 `hooks` / `language` / `worktree_dir` / `pr_tool` 不变。`validateConfigShape` 不再校验三键的类型;三键转为「历史已删除字段」,按既有未知键规则读取时容忍与忽略、不进 init 字段 diff,整体重写时自然消失(沿用现行语义,零特例)。
- **新增 verb `default-branch`**:`default-branch --cwd .` → `{ok, branch, source}`。探测链:`git symbolic-ref --short refs/remotes/origin/HEAD`(剥 `origin/` 前缀)→ 本地 `main` 存在 → 本地 `master` 存在 → 兜底 `"main"`;`source` ∈ `remote-head | fallback-main | fallback-master | last-resort`。确定性逻辑下沉 lib 纯函数(注入 git runner 可单测);同名 MCP tool 随 parity 自动登记。
- **prose 重接线(7 个 skill、12 处)**:`config.trunk` 的全部引用(creating-worktree 基点判定、creating-feature 前置校验与 initial_branch、finishing-worktree/finishing-feature 的路由与回退、exploring 的前置 pull 判定、distilling/recording-knowledge 的 trunk 防护)改为 `speccode default-branch --cwd .` 的 `branch` 字段;`config.remote` 引用同步清理。
- **code_intel_tools 退役**:删 `lib/detect.mjs` 的 `detectCodeIntelTools` 与探测器表常量(**保留** `resolveWorktreeDir` / `worktreeDirIgnoreState` / `isPathInside`——worktree 编排刚需);删 `detect-code-intel-tools` verb 与同名 MCP tool;init 删探测与登记节;exploring / proposing / brainstorming / distilling-knowledge 的「代码智能工具咨询」段改为**会话可见性措辞**(会话中可用的代码智能工具(MCP/CLI)优先用于代码参考,不可用静默回退 Grep/Glob/Read,永不报错——不再读 config);reset 去掉该字段提及。
- **init 重写为标记语义**:全新流程 = 建 `.speccode/` 与最小 config(`version` + `initialized_at`)+ 可选项询问(language、pr_tool 经 remote URL 自动探测 + 确认、worktree_dir)。config 不再含任何宿主/环境耦合字段——同一项目多 agent 共用天然成立。
- **测试**:`tests/config.test.mjs` 字段集校验改写;`tests/detect.test.mjs` 拆分(探测器表用例删,worktree-dir/路径判定用例留);`tests/cli.test.mjs` init 与 detect-code-intel-tools 的 e2e 调整 + `default-branch` 新 e2e;`tests/verbs.test.mjs` parity 自动;新增 prose 守卫:skills/ 下无 `config.trunk` / `config.code_intel_tools` 残留。
- **文档**:CHANGELOG `[Unreleased]`(**BREAKING**:删 `trunk`/`remote`/`code_intel_tools` 字段与 `detect-code-intel-tools` verb/tool;升级路径 = prose 改用 `default-branch`,残留键被容忍与忽略);AGENTS.md 检查后按需。知识 `environment.md` 的 config 字段集句需再刷新——按知识分支纪律记为**收尾后的下一个 knowledge 微 chore**,不在本分支改。

## Capabilities

- `speccode-config-management`(MODIFIED:config.json 字段集;ADDED:default-branch 运行时探测)
- `code-intel-tool-integration`(REMOVED:代码智能工具探测启发式 / detect-code-intel-tools verb / code_intel_tools 配置字段;MODIFIED:命令咨询行为;**保留**:worktree 基础目录配置)

## Impact

`lib/config.mjs`、`lib/detect.mjs`、`lib/verbs.mjs`、`lib/mcp.mjs`、`skills/{init,reset,exploring,proposing,brainstorming,distilling-knowledge,recording-knowledge,creating-worktree,creating-feature,finishing-worktree,finishing-feature}/SKILL.md`(11 个 skill 的 prose)、`tests/{config,detect,cli}.test.mjs`、`tests/verbs.test.mjs`(新增守卫)、`CHANGELOG.md`。MCP 协议层零改动;SDD 伴生脚本零改动。
