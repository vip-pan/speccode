---
tier: 1
---

# Proposal: state-schema-validation

## Why

`loadConfig`/`readState` 完全 schema-free:字段名打错、形状写坏、非法枚举全部静默穿透,消费方各自防御性判空(本仓 `created_at` 曾被误写覆盖,reconcile 输出至今挂着手工修补 note)。合法形状全集今天只存在于隐式约定中,没有任何一处契约描述它。

## What Changes

- `lib/state.mjs` 新增 `validateStateShape(state)`:对 v3 条目产出警告数组(必填字段缺失、status/type 枚举非法、时间戳非 ISO、branch 与登记键不一致、父实体形状、未知顶层键提示);v2 条目返回单条「v2 待迁移」提示;纯函数、不抛错。
- `lib/config.mjs` 新增 `validateConfigShape(config)`:退役字段在场(worktree_prefix/host/v1 三字段)、pr_tool 枚举、字段类型、hooks/language 形状的警告数组。
- 新增只读 verb `lint-state`:输出 `{config:{warnings}, states:[{file,branch,warnings}]}`(扫 `state/branches/` + `state/features/`)。
- `writeState` 增加门禁(抛错):v3 形状 payload 的 `branch` 与登记键不一致、`status` 非法枚举、`type` 非法(普通形状)、`created_at` 非 ISO、父实体 `children` 非数组时拒绝写入;未知顶层键与可选键(completed_at/pr_number/note/pending_operation)不拒绝(宽容);v2 形状 payload 原样放行(legacy 流程)。
- `skills/status`:入口跑 `lint-state`,有警告即报告(不阻断)。

## Capabilities

- `speccode-config-management`(ADDED:state/config 形状契约与校验)

## Impact

`lib/state.mjs`、`lib/config.mjs`、`bin/speccode.mjs`、`tests/state.test.mjs`、`tests/config.test.mjs`、`tests/cli.test.mjs`、`skills/status/SKILL.md`
