# Tasks: lite-semantics

> 本清单已由 plan/2026-10-21-lite-semantics-plan.md 接管:实现进度以 plan 的 checkbox 为准,本文件不再勾选,仅作意图索引。

## A. 锚点段 + 守卫

- A1 `tests/lite.test.mjs` 四守卫先行(锚点段存在性 / 全量逐字一致 / 零调用 skill 不得含 / 既有守卫回归);锚点段全文定稿入计划(单源字面量)
- A2 锚点段插入 22 个含调用 skill(frontmatter 后首个 `##` 前,逐字)

## B. 命令级行

- B1 四编排命令 lite 中止语(creating-worktree / creating-feature / finishing-worktree / finishing-feature,步骤开头) + status 只读降级句
- B2 distilling-knowledge / recording-knowledge 编排待遇句;9 个认知命令知识入口兜底句(引擎缺失直读/不存在静默)

## C. 文档与验证

- C1 CHANGELOG `[Unreleased]` Changed 条目;AGENTS.md 常用命令补 lite 探测一行
- C2 全量测试;无 PATH 冒烟(降级表字面命令逐条可执行);守卫全绿
