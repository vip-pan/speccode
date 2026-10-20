---
tier: 2
---

# Proposal: remove-legacy-compat

## Why

现行流程已全部是 v3,但引擎与文档仍保留大量向下兼容面:v0.1 的 pending_operation 旧命令名归一化、v2 的 `state/features/` 双格式读写与一次性迁移器、config 退役字段警告机制、knowledge 旧 `promoted-from` 标记读兼容、memory 无斜杠 `_exploring` 遗留键。这些兼容代码增加维护面、掩盖真实契约,且再无存量用户需要它们。

## What Changes

**BREAKING**:目标项目若仍持有 `state/features/` 旧数据、旧 config 退役字段(`display`/`spec_tools`/`untracked_permanent`/`worktree_prefix`/`host`)、旧 `promoted-from` 标记的 knowledge 文件或无斜杠 `_exploring.md` memory 文件,升级后这些数据不可见/不可读,且不提供迁移工具(发布说明 MUST 明示)。

1. **state v1/v2 双格式拆除**(BREAKING):删除 `lib/state.mjs` 的 `featuresDir()`、`readState` 回退、`writeState` format-follows-file 与 v2 payload 门禁绕过、`deleteState`/`listActiveFeatures`/`lintStateEntries` 双目录、`validateStateShape` v2 提示分支、`migrateStateV2toV3` 整函数;`lib/reconcile.mjs` 删 legacy 透传;`bin/speccode.mjs` 删 `migrate-state` verb、`feature-progress`/`list-memory` 的 v2 分流。`state/features/` 目录纯删除式隐形(零残留,不做存在性警告)。
2. **v0.1 遗留归一化拆除**(BREAKING):删除 `LEGACY_COMMAND_NAMES` + `normalizeState()`(`develop-complete`/`finish` 旧命令名、`waiting_display_pr` 挂起态相关引擎侧处理)。
3. **config 退役字段机制整体退役**(BREAKING):删除 `RETIRED_CONFIG_FIELDS`(v1 三字段 + v2 `worktree_prefix` + `host`)与 `version ≠ 3` 警告;init/reset 命令的退役字段 diff 剥离步骤删除。退役字段降级为普通未知键(config 读取本就容忍未知键)。
4. **knowledge 旧标记读兼容拆除**(BREAKING):删除 `lib/knowledge.mjs` 的 `LEGACY_PROMOTED_*` 双格式解析;读侧只认 `distilled-from`/`/distilled` 与能力键 source,旧格式标记按普通正文字节对待。
5. **memory `_exploring` 遗留键拆除**(BREAKING):`validateMemoryBranch` 不再接受无斜杠 `_exploring` 键;`listMemory` 相关注释清理。
6. **测试重构**:`tests/state.test.mjs`(~10 用例)、`tests/cli.test.mjs`(5 处)、`tests/reconcile.test.mjs`(1 处)、`tests/knowledge.test.mjs`(旧标记用例)按新契约重构;补充「v2 目录存在时完全隐形」「writeState 门禁对任意 payload 生效」等新契约用例。
7. **命令层清理**:`skills/init/SKILL.md`(第 8 步 state 迁移整段 + v1/v2 config 升级/退役字段剥离步骤)、`skills/status/SKILL.md`(v2 待迁移渲染)、`skills/reset/SKILL.md`(v1 遗留字段询问)。
8. **文档同步**:AGENTS.md 4 处不变量、DESIGN.md/DESIGN_CN.md(双格式表述、§11「Migrating from 0.1」整节删除与重编号、R2 措辞、git clean 段)、本仓运行时 memory 的存量 `_exploring.md` 清理。
9. **spec delta**:五个 capability(见下)。

## Capabilities

- `speccode-config-management`(主:REMOVED 双格式兼容 requirement + MODIFIED 字段集/文件隔离/对账/挂起态/形状契约/Purpose)
- `session-memory`(MODIFIED:命名与 verb 校验、list-memory 派生)
- `knowledge-set`(MODIFIED:来源标记、蒸馏命令)
- `plugin-packaging`(MODIFIED:手写路径 scenario 措辞、文档三层分离 scenario——删 0.1→0.2 迁移对照表要求)
- `pr-tool-integration`(MODIFIED:轮询 requirement 删 v1 历史括注)

## Impact

代码:`lib/state.mjs`、`lib/reconcile.mjs`、`lib/config.mjs`、`lib/knowledge.mjs`、`lib/memory.mjs`、`bin/speccode.mjs`;测试:`tests/state|cli|reconcile|knowledge|memory.test.mjs`;命令:`skills/init|status|reset/SKILL.md`;文档:AGENTS.md、docs/DESIGN.md、docs/DESIGN_CN.md;规格:`speccode/spec/` 五个 capability(经 delta→syncing)。历史记录(CHANGELOG、`speccode/archive/`、知识块出处括注)不动。
