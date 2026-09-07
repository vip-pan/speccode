---
tier: 1
---

# proposal: release 0.7.1

## Why

trunk 自 0.7.0 起已积累一个完整需求(i18n 语言模型 v4,PR #56)与知识集重蒸(PR #57),CHANGELOG Unreleased 已就绪;按发布纪律出 0.7.1(用户拍板的 patch 定档)。

## What Changes

- CHANGELOG:`## [Unreleased]` 折为 `## [0.7.1] - 2026-09-07` 版本小节(带 `> EN:` 一句 highlights,Added/Changed 子节内容原样);比较链接区新增 `[0.7.1]`,`[Unreleased]` 指针更新为 `v0.7.1...HEAD`
- `plugin.json` version:0.7.0 → 0.7.1(bump 与 CHANGELOG 折节同一提交)
- 发版:trunk 合并后打 `v0.7.1` tag + `gh release create`(notes 摘自 CHANGELOG 0.7.1 小节)

无 BREAKING、无代码改动(纯 CHANGELOG/版本元数据)。

## Capabilities

(空 delta——发布类 chore,轻档)

## Impact

- `CHANGELOG.md`、`.claude-plugin/plugin.json`
- tag `v0.7.1` + GitHub Release(合并后)
