# Design: remove-legacy-compat

## Context

speccode 经 v0.1(四层拓扑)→ v2(三层)→ v3(双层)三次演进,每次都保留了旧格式的读兼容:v0.1 的 `pending_operation.command` 旧命令名靠 `normalizeState()` 归一化;v2 的 `state/features/` 双格式运行 + `migrateStateV2toV3` 一次性迁移;config 侧 `RETIRED_CONFIG_FIELDS` 警告 + init 字段 diff 剥离;knowledge 侧旧 `promoted-from` 标记读兼容;memory 侧无斜杠 `_exploring` 键。现行流程已全量 v3,兼容面只剩维护成本与契约噪声。用户确认:全量拆除(含相邻遗留)、`state/features/` 纯删除式隐形(不做存在性警告)。

## Goals

- 引擎读路径只认 v3 形状;v2/v0.1 数据从 reconcile/status/lint 全部视野消失。
- 兼容代码零残留:迁移器、归一化器、退役字段警告、旧标记解析全部删除,不留墓碑。
- 测试、命令 prose、四层文档(AGENTS/DESIGN×2/spec)与引擎同步收口,无「残留旧表述」矛盾。

## Non-Goals

- 不提供任何升级/迁移工具(纯删除)。
- 不动历史记录:CHANGELOG、`speccode/archive/`、knowledge 块的归档包名出处括注。
- 不动与 v1/v2 无关的「遗留」:code-intel 探测的历史目录探测路径(`lib/detect.mjs`)、`lib/detect.mjs:48` 注释。
- knowledge 蒸馏块的 v2 表述更新走后续 distilling chore 分支(统一入口约束),不在本需求内。

## Decisions

1. **纯删除,不做存在性警告**:被否备选 = status/lint-state 检测 `state/features/` 目录存在并提示。否决理由:用户明选纯删除;存在性检查虽非兼容读写,仍属为已死数据保留的感知代码,与「零残留」目标冲突。
2. **退役字段降级为普通未知键**:`RETIRED_CONFIG_FIELDS` 与 `version ≠ 3` 警告整体删除后,config 读取本就容忍未知键,旧 config 不会报错——退役字段失去特殊语义,这正是目标状态。init 的幂等 diff 仍逐字段比对新字段集,旧字段不再出现在 diff 中(整体重写时自然消失)。
3. **knowledge 读侧单格式**:旧 `promoted-from` 标记不再解析,按普通正文字节保留在 hand 区(不删除用户字节);目标项目如需迁移,重蒸时人工清理。写侧「拒旧 source」校验保留(它拒绝而非兼容,是闸门不是兼容面)。
4. **`validateStateShape` 收紧 worktree 为 string-only**:`worktree: null` 例外只为迁移产物存在,迁移器删除后例外条款一并删除。
5. **Purpose 经显式 delta 段变更**:`speccode-config-management` 主规格 Purpose 含「v2→v3 迁移」字样,与 REMOVED requirement 直接矛盾。syncing 的 Purpose 保护(「主规格已有 Purpose → 不动」)意图是防 delta 意外覆盖,非禁止有出处的修订;本 delta 显式携带 `## MODIFIED Purpose` 段,syncing 按「delta 覆盖」语义执行该修订并在摘要中明示。
6. **DESIGN §11 重组为「Installation & Updates」,维持 §1-14**:旧 §11 是杂烩——v0.1→v0.2 迁移内容(命令对照表、迁移步骤、`waiting_display_pr` 指引)删除;但其中混排的当前内容(Upgrade actions 插件更新指引、多宿主安装入口表——plugin-packaging spec 要求项)保留并重组为新 §11「Installation & Updates」。节号维持 §1-14 不变(DESIGN:9 的既有「Section 11 multi-host table」引用因此保持正确),顺手修复 CN 版 NPM_TOKEN 句子重复。中英两版结构一一对应。

## Risks

- **R1 老项目升级后旧数据无声消失** → 用户已确认为目标行为;CHANGELOG/发布说明 MUST 以 BREAKING 明示(收尾时落)。
- **R2 全仓 v2 表述清不干净造成 spec/文档内在矛盾** → 已知坑(「spec 残留旧表述」);缓解:实现收尾时以 `rg -i 'v1|v2|legacy|遗留|promoted|state/features|migrate-state|worktree_prefix'` 全仓审计,白名单只允许 CHANGELOG/archive/知识出处括注/Node v24 等vehicles。
- **R3 漏改 import 导致运行时崩溃** → 全量测试(323 基线)作为回归网;删除导出(`normalizeState`/`migrateStateV2toV3`/`RETIRED_CONFIG_FIELDS`/`featuresDir`)前先 `rg` 全部引用点。

## Open Questions

无——范围与策略均经用户确认(2026-10-15 探索会话)。
