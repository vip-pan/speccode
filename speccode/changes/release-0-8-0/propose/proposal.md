---
tier: 1
---

# Proposal: release-0-8-0

## Why

prose-core-mcp-split 大需求(#71)与 README 重组(#72)已上 main,[Unreleased] 攒了六组条目(两个 BREAKING),是 minor 版本;发版触发 npm 首次发布,核销全部「待首次发布」标注。

## What Changes

- bump 三处版本 0.7.3 → 0.8.0(.claude-plugin/plugin.json、.zcode-plugin/plugin.json、package.json);
- CHANGELOG [Unreleased] → [0.8.0] - <日期> 小节,顶部英文 highlights;
- 发布后(单独一步,不在本 PR):v0.8.0 tag + Release → CI npm publish → 核销文档「待首次发布」标注。

## Capabilities

(轻档:specs/ 为空,无 capability 语义变更)

## Impact

.claude-plugin/plugin.json、.zcode-plugin/plugin.json、package.json、CHANGELOG.md
