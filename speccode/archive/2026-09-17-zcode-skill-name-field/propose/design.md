# Design: zcode-skill-name-field

## Context

- ZCode 官方文档(来源:官方 zcode-guide 插件缓存):frontmatter 存在但 `name` 缺失 → skill 被丢弃;识别键仅 `name`/`description`/`when_to_use`/`license`/`metadata` 五个;`description` 超 1024 字符同样丢弃;调用 = `name` 或 `plugin:skill` 限定名。
- 现状:24 个 skill frontmatter 仅 `description`(0.6.0 迁移时按 0.5.1 口径收敛),ZCode 上整包不可用;现有 description 最长 294 字符,距 1024 上限安全。
- 0.5.1 前科(79fdcb3):当时 `commands/*.md` 的 `name` 值是展示型标题(如 `"SpecCode: Exploring"`),VS Code 扩展拼出 `/speccode:SpecCode: Exploring` → Unknown command。**病根是 name ≠ 调用名,不是 name 字段存在本身。**
- 官方 ZCode 插件范式:全部 `name` == 目录名、不加引号、置于 `description` 之前。

## Goals

- ZCode 可加载并经 `speccode:<name>` 调用全部 24 个 skill
- Claude Code 行为零变化(调用名、模型自动调用)
- 0.5.1 类问题结构性防复发:CI 钉死 `name === 目录名` 不变量

## Non-Goals

- 不改 description 内容与交互语言纪律
- 不动 `.zcode-plugin/plugin.json` manifest 字段(`version` 缺失、`"skills"` 前缀写法、`skillInstructions` 键)——记录线索,后续核销
- 不做知识集蒸馏(独立 chore 分支)
- 不引入 `when_to_use`/`license`/`metadata` 等 ZCode 识别键

## Decisions

1. **`name` 值 = 目录名(逐字一致、不加引号、置于 description 之前)。** 理由:ZCode 按 `name` 组调用路径,Claude Code 按目录名,误读 `name` 的客户端(0.5.1 的 VS Code 扩展)拼出的路径也与正确调用一致——三类宿主全部收敛到同一调用名,这是同时满足「修复 ZCode」与「防 VS Code 复发」的唯一点。被否备选:(a) `name` 用展示标题——0.5.1 已证会致 Unknown command;(b) 仅 ZCode 分发面带 `name` 的双轨——违背单仓三合一零拷贝分发(adapter 是薄层,不复制 skill 内容)。
2. **用守卫测试而非 lint/脚本钉不变量。** 理由:仓库无 lint 基建(`node --test` 是唯一既有 CI 门);测试断言 `name`==目录名、`description` 存在且 ≤1024、无 `category`/`tags` 残留,以红→绿驱动本次改动。被否备选:靠 spec 约定与人工 review——无机器门禁,回归必复发。

## Risks

- 其他宿主(Kimi Code / Codex 共享同一 `skills/`)对 `name` 字段行为未逐一真机验证 → 缓解:`name`==目录名时,忽略它的宿主无感、使用它的宿主得到正确名;0.5.1 症状只在 `name`≠调用名时出现。
- Claude Code 未来若收紧 skills frontmatter `name` 语义 → 缓解:`name`==目录名使两套命名语义恒等,收敛点即兼容点。

## Open Questions

- `.zcode-plugin/plugin.json` 是否需补 `version` 字段、`skillInstructions` 是否被 ZCode 识别(官方样本无此键)——后续对照官方文档核销,不阻塞本变更。
