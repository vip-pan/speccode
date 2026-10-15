# Design: state-schema-validation

## Context

读侧 schema-free 是双刃剑:容错性好(遗留文件、前向兼容),但写坏的数据无人发现。债务盘点 #9/#10 的结论:数据质量债需要「形状契约显式化 + 读侧可见 + 写侧拦明显错误」三件套,而不是全面 schema 强制(那会破坏 v2 兼容与前向兼容)。

## Goals

- 合法形状全集在一处契约化(引擎函数 + spec)。
- 坏形状可见(lint-state + status 报告),不静默。
- 明显错误的写入被拦(writeState 门禁)。

## Non-Goals

- 读路径行为变化:`readState`/`loadConfig` 返回形状与容错语义完全不变。
- 未知顶层键拒绝:历史先例(`note` 字段)证明合法扩展会发生;未知键只警告不拒绝。
- 自动修复:lint 只报告,修复永远经用户确认(与幂等 init 字段 diff 同族纪律)。
- config 写侧门禁:`write-config` 的校验现状(language 经 validateLanguage)维持,本变更不动。

## Decisions

1. **校验产出 warnings 而非 throw(读侧)**:lint 面向报告,任何在盘数据都能被描述;抛错会让 lint 自己变成新的故障点。
2. **写侧门禁只拦「不可解释」的 payload**:branch 键不一致、枚举非法、非 ISO 时间戳、父实体 children 非数组——这些没有合法解释;可选键与未知键放行——`note` 先例证明后者有合法用例。被否备选:封闭键集白名单——会拒绝历史合法扩展,且白名单本身成为新的漂移源。
3. **v2 条目在 lint 中只给单条迁移提示**:v2 形状不套 v3 契约(那是迁移的职责,迁移有独立预览/确认流程)。
4. **lint-state 是只读 verb、独立于 read-state**:不改变既有 verb 输出形状(零兼容风险);status 作为唯一例行消费者。

## Risks

- **writeState 门禁误伤合法写路径** → 缓解:门禁条件全部来自「无合法解释」集合;v2 payload 直通;全量测试覆盖既有全部写路径(门禁上线即回归)。
- **lint 误报噪音**(如手工 note 字段)→ 缓解:未知键警告措辞为提示级;status 只在有警告时报告一行。

## Open Questions

无。
