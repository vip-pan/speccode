---
tier: 1
---

# Proposal: zcode-plugin-manifest

> 承接说明:本变更与 zcode-skill-name-field 同属 ZCode 兼容单元,搭其分支 `bugfix/zcode-skill-name-field` 与 PR #59 顺风车(同一 0.7.2 发版,避免 CHANGELOG 跨 PR 冲突);slug 与分支名不一致是有意为之,归档独立成包。

## Why

`.zcode-plugin/plugin.json` 按「Kimi 同款」假设编写,未经核对的字段集带来越界偏差:官方 ZCode 插件 manifest 全样本(11 个,android-emulator/browser-use/computer-use/document-skills/ios-simulator/restore-legacy-sessions/skill-creator/zcode-guide 等)恒含 `version`,键集无 `skillInstructions`(Kimi 专属,ZCode 不识别,载入即忽略);官方文档(zcode-guide)明确最小要求仅 `name`、组件字段为 `commands`/`skills`/`hooks`/`mcpServers`/`agents`。本机实证:speccode 经 marketplace 装入 ZCode 后版本显示 **0.0.0**(正是缺 `version` 的直接后果)。

## What Changes

- `.zcode-plugin/plugin.json` 对齐官方形态:键集收敛为 `name`/`version`/`description`/`author`/`license`/`skills`,值 `"skills"`(官方无 `./` 前缀写法);移除 `homepage`/`repository`/`keywords`(官方样本零出现)/`_note`/`skillInstructions`(非识别字段)
- `version` 与 `.claude-plugin/plugin.json` 同源同步(本次 0.7.2,后续随发布纪律同时 bump)
- 新增守卫测试 `tests/zcode-adapter.test.mjs`:键集断言、version 双 manifest 一致、`skills` 官方形态、无 `skillInstructions`
- `references/host-mapping/zcode.md` 与总览 README:manifest schema 与安装通路核销(marketplace 安装本机实测成功;`skillInstructions` 的工具映射指引继续由 zcode.md 工具映射段承载)
- spec delta:MODIFIED `host-adapters`「六宿主 adapter 清单与形态」——ZCode 子句从「按 Kimi 同款形态」改为官方形态描述

## Capabilities

- `host-adapters`(MODIFIED:六宿主 adapter 清单与形态)

## Impact

- 代码:`.zcode-plugin/plugin.json`(重写)、`tests/zcode-adapter.test.mjs`(新增)、`speccode/spec/host-adapters/spec.md`(经 syncing 应用 delta)、`references/host-mapping/zcode.md`、`references/host-mapping/README.md`、`CHANGELOG.md`(0.7.2 小节增补)
- 行为:ZCode 插件列表版本号从 0.0.0 恢复真实版本(本机实证);更新检测按 version 比对推断受益,机制未实证;未被识别的死字段清除,工具映射语义无损(zcode.md 承载)
- 后续(不在本变更):Kimi 侧 `.kimi-plugin` 的 `skillInstructions` 属其宿主字段,不动
