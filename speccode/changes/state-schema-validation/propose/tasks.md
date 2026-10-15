# Tasks: state-schema-validation

## 引擎

- [x] `lib/state.mjs`:`validateStateShape(state)`(必填/枚举/ISO/父实体/未知键警告;v2 单条迁移提示)+ `writeState` v3 门禁(branch 键一致、status/type 枚举、created_at ISO、children 数组;v2 payload 直通)
- [x] `lib/config.mjs`:`validateConfigShape(config)`(退役字段/枚举/类型/hooks/language 警告;version 非 3 提示级)

## CLI

- [x] `bin/speccode.mjs`:只读 verb `lint-state`(扫双目录,输出 config + states 警告)

## 测试(TDD:先红后绿)

- [x] `tests/state.test.mjs`:validateStateShape 各警告维度 + v2 提示;writeState 门禁五拒 + note 放行 + v2 直通
- [x] `tests/config.test.mjs`:validateConfigShape 各维度
- [x] `tests/cli.test.mjs`:`lint-state` e2e(退役字段 + 坏枚举 + exit 0);`write-state` 键不一致 `{ok:false}` 且不落盘

## 命令层

- [x] `skills/status/SKILL.md`:流程加一步——跑 `lint-state`,有警告报告一行(不阻断)

## 验收

- [x] 全量测试绿(既有写路径全量回归过门禁);手动冒烟:本仓 lint-state 输出(v2 零、host 遗留一条)
