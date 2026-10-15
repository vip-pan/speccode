# Tasks: remove-legacy-compat

> 本清单已由 plan/2026-10-15-remove-legacy-compat-plan.md 接管:实现进度以 plan 的 checkbox 为准,本文件不再勾选,仅作意图索引。

## 引擎层(lib)

- `lib/state.mjs`:删除 `LEGACY_COMMAND_NAMES`、`normalizeState()`、`featuresDir()`、双格式读写、`migrateStateV2toV3`;`validateStateShape` 收紧 worktree 为 string-only
- `lib/reconcile.mjs`:删 legacy 透传,单格式
- `lib/config.mjs`:删 `RETIRED_CONFIG_FIELDS` 与 `version ≠ 3` 警告
- `lib/knowledge.mjs`:读侧单格式,旧标记按 hand 字节
- `lib/memory.mjs`:删无斜杠 `_exploring` 键

## CLI 层(bin/speccode.mjs)

- 删 `migrate-state` verb;`feature-progress`/`list-memory` 去 v2 分流

## 测试层(tests)

- state/cli/reconcile/knowledge/memory 按新契约重构;补「v2 目录隐形」「门禁统一」用例;全量绿

## 命令层(skills)

- init(第 8 步 + config 升级段)、status(v2 待迁移渲染)、reset(v1 字段询问)

## 文档层

- AGENTS.md 四处不变量;DESIGN×2 双格式表述 + §11 重组为安装与更新(维持 §1-14);主仓存量 `_exploring.md` 清理;残留审计白名单化
