# Tasks: release-0-7-0

轻档发布;两处编辑同提交落盘(版本纪律:version bump MUST 与 CHANGELOG 同提交)。

## 1. bump 与 CHANGELOG

- [ ] `.claude-plugin/plugin.json` `version`: `0.6.0` → `0.7.0`
- [ ] `CHANGELOG.md`:新增 `## [0.7.0] - 2026-09-06` 小节——顶部英文 highlights 块;中文条目按 Keep a Changelog 分组(`Added`/`Changed`/`Removed`),**BREAKING** 标注(新项目 worktree 缺省 `.speccode/worktrees`)与仓名改名说明;`Unreleased` 空段保留;compare 链接补 `[0.7.0]` 与 `[unreleased]` 指向

## 2. 验证

- [ ] 一致性:`plugin.json` version 与 CHANGELOG 最新小节版本号一致;CHANGELOG 无硬编码漂移(条目为历史记录,允许含版本号字面量)
- [ ] 全量测试 `node --test ./tests/*.test.mjs` 全绿(299 基线;发布不改代码)
