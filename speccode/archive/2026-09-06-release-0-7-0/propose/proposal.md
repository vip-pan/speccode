---
tier: 1
---
# Proposal: release-0-7-0(版本发布)

## Why

multi-host-support 大需求已合入 trunk(#52),五子需求交付完毕——按发布纪律 bump `0.7.0` 并同步 CHANGELOG,使版本与最新小节一致,随后打 tag 与 GitHub Release。

## What Changes

- `.claude-plugin/plugin.json` `version`: `0.6.0` → `0.7.0`(0.6.0 → 0.7.0 为 BREAKING 级变更:仓库结构与多宿主改造,详见 CHANGELOG 条目)
- `CHANGELOG.md` 新增 `## [0.7.0]` 小节(中文条目为主体,顶部英文 highlights 块;含 **BREAKING** 标注:新项目 `worktree_dir` 缺省 `.speccode/worktrees`;仓名已改 `speccode`)
- 无任何代码/规格/命令变化;`Unreleased` 小节保持空段惯例

## Capabilities

无(轻档:纯版本发布 chore,零 capability 语义变更)

## Impact

- 更新检测:marketplace 拉取后 `plugin.json` version 0.6.0 → 0.7.0 触发用户侧更新
- 发版动作(本变更合入 trunk 后执行):打 `v0.7.0` tag + GitHub Release(notes 摘自 CHANGELOG 该小节)
