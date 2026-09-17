# tasks: release 0.7.3

> 本清单为 Tier 1(applying)执行清单;纯元数据变更,无 plan。

- [ ] CHANGELOG 折节:Unreleased → `## [0.7.3] - 2026-09-17` + `> EN:` highlights;比较链接区加 `[0.7.3]`、`[Unreleased]` 改指 `v0.7.3...HEAD`
- [ ] 双 manifest version bump:0.7.2 → 0.7.3(`.claude-plugin/plugin.json` 与 `.zcode-plugin/plugin.json`,守卫测试钉死一致;与折节同一提交)
- [ ] 全量测试(`node --test ./tests/*.test.mjs`)
- code review(Tier 1 必经)
- finishing-worktree:PR → 等待合并
- trunk 上打 `v0.7.3` tag + `gh release create v0.7.3`(notes 摘自 CHANGELOG 0.7.3 小节)
