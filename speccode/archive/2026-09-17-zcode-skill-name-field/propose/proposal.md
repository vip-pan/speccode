---
tier: 1
---

# Proposal: zcode-skill-name-field

## Why

ZCode 官方规范要求 SKILL.md frontmatter 必须含 `name` 字段:frontmatter 存在但 `name` 缺失时该 skill 整个被丢弃。本仓 24 个 `skills/<name>/SKILL.md` 的 frontmatter 只有 `description`(0.6.0 迁移时收敛),导致 speccode 在 ZCode 上整包不可用。

## What Changes

- 24 个 `skills/<name>/SKILL.md` 的 frontmatter 各加一行 `name: <目录名>`(值与目录名逐字一致、不加引号——官方 ZCode 插件 browser-use / skill-creator / zcode-guide 同款范式)
- 新增守卫测试 `tests/skill-frontmatter.test.mjs`:遍历 `skills/`,断言 `name` == 目录名、`description` 存在且 ≤1024 字符、无 `category`/`tags` 残留——把跨宿主约束钉成 CI 不变量
- spec delta:MODIFIED `plugin-packaging` 的「skill frontmatter 契约」requirement——从「MUST NOT 含 name」反转为「MUST 含 name 且 name == 目录名」,description 契约与模型自动调用语义保持
- `references/host-mapping/zcode.md` 与该目录 README 总览表:ZCode「SKILL.md frontmatter 要求」从待验证升级为已验证(来源:官方 zcode-guide 文档)

## Capabilities

- `plugin-packaging`(MODIFIED:skill frontmatter 契约)

## Impact

- 代码:`skills/*/SKILL.md`(24 文件各 +1 行)、`tests/skill-frontmatter.test.mjs`(新增)、`speccode/spec/plugin-packaging/spec.md`(经 syncing 应用 delta)、`references/host-mapping/zcode.md`、`references/host-mapping/README.md`、`CHANGELOG.md`
- 行为:ZCode 上 24 个 skill 从整包不可用变为可用(`speccode:<name>` 限定名调用);Claude Code 调用名与自动调用行为零变化(调用名 = 目录名,`name` 为冗余一致值)
- 后续(不在本分支):知识集 standards 对齐走 distilling-knowledge(独立 chore 分支);`.zcode-plugin/plugin.json` 缺 `version` 字段与 `"skills"` 路径前缀写法差异另行核销
