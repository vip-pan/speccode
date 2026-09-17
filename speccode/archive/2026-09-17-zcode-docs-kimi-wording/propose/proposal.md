---
tier: 1
---

# Proposal: zcode-docs-kimi-wording(轻档)

## Why

ZCode 已核销为官方插件形态(PR #60),但 `references/host-mapping/zcode.md` 宿主注意段仍残留一处「探索期按类 Kimi Code 形态调研」的 Kimi 对比措辞——对已验证宿主做未验证时代的类比表述,既是噪声也可能误导读者以为映射仍循 Kimi 经验。全仓扫描确认这是唯一活跃残留(archive/ 与 CHANGELOG 史实段按纪律不改;其余 Kimi 提及均为正确事实陈述,如「skillInstructions 为 Kimi 专属字段」)。

## What Changes

- `references/host-mapping/zcode.md:34`:删去「按类 Kimi Code 形态调研」对比从句,改为直陈事实并指向页首验证状态块
- `CHANGELOG.md`:Unreleased/Changed 收录本清理(无 version bump,随下次发版收口)

## Capabilities

- 无(轻档:docs-only 措辞清理,无 capability 语义变更,specs/ 为空)

## Impact

- 代码:`references/host-mapping/zcode.md`(1 行)、`CHANGELOG.md`(Unreleased 增 1 行)
- 行为:零;纯文档措辞
