---
tier: 1
---

# proposal: release 0.7.3

## Why

trunk 自 0.7.2 起仅累积一条文档清理(host-mapping zcode 注意段移除历史对比措辞,PR #62)与知识集重蒸(PR #61,dogfood 内部文档不入 CHANGELOG),CHANGELOG Unreleased 已就绪;按发布纪律出 0.7.3(patch 定档:纯清理与文档维护,无新能力、无 BREAKING)。

## What Changes

- CHANGELOG:`## [Unreleased]` 折为 `## [0.7.3] - 2026-09-17` 版本小节(带 `> EN:` 一句 highlights,Changed 子节内容原样);比较链接区新增 `[0.7.3]`,`[Unreleased]` 指针更新为 `v0.7.3...HEAD`
- 双 manifest version 同步 bump:0.7.2 → 0.7.3(`.claude-plugin/plugin.json` 与 `.zcode-plugin/plugin.json`,守卫测试钉死一致;bump 与 CHANGELOG 折节同一提交)
- 发版:trunk 合并后打 `v0.7.3` tag + `gh release create`(notes 摘自 CHANGELOG 0.7.3 小节)

无 BREAKING、无代码改动(纯 CHANGELOG/版本元数据)。

## Capabilities

(空 delta——发布类 chore,轻档)

## Impact

- `CHANGELOG.md`、`.claude-plugin/plugin.json`、`.zcode-plugin/plugin.json`
- tag `v0.7.3` + GitHub Release(合并后)
