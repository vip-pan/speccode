---
tier: 1
---

# Proposal: runtime-data-lifecycle

## Why

`.speccode/` 运行时数据只增不减:已完成分支的 memory 文件永久滞留且对用户不可见(`list-memory` 仅列 `_exploring__*`,分支记忆连清单都进不了),陈旧记忆还会经「同名需求优先选既有 topic」规则参与未来决策;`config.json.bak.<timestamp>` 备份无轮转上限。两者都是有状态债务盘点中的「真该还」项。

## What Changes

- `list-memory` verb 输出新增 `files` 数组(全量 memory 文件的分支键 + completed 标注,经 state 登记连接派生);既有 `topics` 字段形状不变(消费方零影响)。
- 新增 `purge-memory --branch <F>` verb:删除单条 memory 文件,幂等(文件不存在 → `purged:false` 不报错);签名与 `delete-state` 同款 flag 形态。
- `backupConfig` 增加轮转:产生新备份后仅保留最新 5 份 `config.json.bak.*`,更旧者删除(常量 `BACKUP_KEEP=5` 单源,不加 config 字段)。
- `skills/status` 与 `skills/finishing-worktree` 各加一行:报告已完成分支的滞留 memory 数量 / 合并完成后提示可清理本分支 memory。

## Capabilities

- `session-memory`(ADDED:已完成 memory 的可见性与清理)
- `speccode-config-management`(MODIFIED:备份机制)

## Impact

`lib/memory.mjs`(purgeMemory)、`lib/config.mjs`(backupConfig 轮转)、`bin/speccode.mjs`(verb + files 标注)、`tests/memory.test.mjs`、`tests/config.test.mjs`、`tests/cli.test.mjs`、`skills/status/SKILL.md`、`skills/finishing-worktree/SKILL.md`
