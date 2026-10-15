# Tasks: remove-legacy-compat

## 引擎层(lib)

- [ ] `lib/state.mjs`:删除 `LEGACY_COMMAND_NAMES`、`normalizeState()`、`featuresDir()`、`readState` 双格式回退、`writeState` 的 format-follows-file 与 v2 payload 门禁绕过、`deleteState`/`listActiveFeatures`/`lintStateEntries` 双目录扫描与 `feature_branch` 回退、`validateStateShape` v2 提示分支与 worktree null 容忍(收紧为 string)、`migrateStateV2toV3` 整函数
- [ ] `lib/reconcile.mjs`:删除 legacy 过滤与透传,输出只含 v3 条目;更新头注释
- [ ] `lib/config.mjs`:删除 `RETIRED_CONFIG_FIELDS` 导出与 `validateConfigShape` 的退役字段警告、`version ≠ 3` 警告
- [ ] `lib/knowledge.mjs`:删除 `LEGACY_PROMOTED_START`/`LEGACY_PROMOTED_END` 及 parseDistilledBlocks / replaceDistilledBlocks / replaceHandBlocks / 索引生成中的双格式分支;读侧只认现行标记
- [ ] `lib/memory.mjs`:`TRUNK_MEMORY_KEYS` 移除 `_exploring`;`listMemory` 注释清理

## CLI 层(bin/speccode.mjs)

- [ ] 删除 `migrate-state` verb 与 `migrateStateV2toV3` import
- [ ] `feature-progress`:删 v2 worktrees 计数分流
- [ ] `list-memory`:删 v2-legacy 形态 completed 派生
- [ ] 更新 `detect-code-intel-tools` 注释中 legacy host 措辞

## 测试层(tests)

- [ ] `tests/state.test.mjs`:删除 legacy normalize / v2 保存 / migrate / v2 hint / v2 payload 直通用例;新增「state/features/ 存在时完全隐形」「writeState 门禁对任意 payload 生效」契约用例
- [ ] `tests/cli.test.mjs`:删 migrate-state 端到端、worktree_prefix 忽略、host 遗留、list-memory v2 派生、lint-state v2 条目用例;按新契约重写 lint-state 用例
- [ ] `tests/reconcile.test.mjs`:v2 透传用例改为 v2 目录隐形用例
- [ ] `tests/knowledge.test.mjs`:旧标记解析用例改为「旧标记不被解析、按 hand 字节保留」
- [ ] `tests/memory.test.mjs`:`_exploring` 键非法断言
- [ ] 全量测试通过(基线 323,数量以重构后为准)

## 命令层(skills)

- [ ] `skills/init/SKILL.md`:删第 8 步 state 迁移整段、v1/v2→v3 config 升级步骤、退役字段 diff 剥离表述
- [ ] `skills/status/SKILL.md`:删「v2 待迁移」渲染与示例行
- [ ] `skills/reset/SKILL.md`:删 v1 遗留字段移除询问

## 文档层

- [ ] AGENTS.md:4 处不变量去 v2 表述(原子写、运行时数据、对账、状态枚举)
- [ ] docs/DESIGN.md + docs/DESIGN_CN.md:目录树注、config/state 段、原子写段、R2 措辞、git clean 段;删 §11「Migrating from 0.1」整节,§12-14 重编号为 §11-13,ToC/交叉引用/风险表注同步;中英两版结构一致
- [ ] 本仓运行时数据:删除 `.speccode/memory/_exploring.md` 存量文件

## 收尾

- [ ] 全仓审计 `rg -i 'v1|v2|legacy|遗留|promoted|state/features|migrate-state|worktree_prefix'`,白名单仅 CHANGELOG / speccode/archive/ / 知识块出处括注 / Node v24 / 无关语义(如 validateSlug('v2'))
- [ ] 全量测试 + CHANGELOG BREAKING 条目(随收尾 flow)
