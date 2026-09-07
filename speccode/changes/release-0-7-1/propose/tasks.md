# tasks: release 0.7.1

> 本清单为 Tier 1(applying)执行清单;纯元数据变更,无 plan。

- [x] CHANGELOG 折节:Unreleased → `## [0.7.1] - 2026-09-07` + `> EN:` highlights;比较链接区加 `[0.7.1]`、`[Unreleased]` 改指 `v0.7.1...HEAD`
- [x] plugin.json version bump:0.7.0 → 0.7.1(与折节同一提交)
- code review(Tier 1 必经)
- finishing-worktree:PR → 等待合并
- trunk 上打 `v0.7.1` tag + `gh release create v0.7.1`(notes 摘自 CHANGELOG 0.7.1 小节)
