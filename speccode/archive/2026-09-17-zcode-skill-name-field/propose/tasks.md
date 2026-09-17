# Tasks: zcode-skill-name-field

> 回写注记(2026-09-17,applying Task 1 时发现):原稿把 syncing 排在 review 之前,与 applying 的「review 未通过前 MUST NOT 进入 syncing」门禁矛盾;本稿已把 syncing/archiving/finishing 移到 review 通过之后,并补 CHANGELOG 与 version bump 同 commit 的发布纪律项。

## 1. 守卫测试先行(红)

- [x] 新增 `tests/skill-frontmatter.test.mjs`:遍历 `skills/*/SKILL.md`,断言 frontmatter 含 `name` 且值 == 目录名、`description` 存在且 ≤1024 字符、无 `category`/`tags` 残留;先对现状跑一次确认失败(红)

## 2. 实现(绿)

- [x] 24 个 `skills/<name>/SKILL.md` 的 frontmatter 各加一行 `name: <目录名>`(置于 `description` 之前,不加引号)
- [x] `node --test ./tests/skill-frontmatter.test.mjs` 转绿;全量 `node --test ./tests/*.test.mjs` 全绿

## 3. 文档与发布

- [x] `references/host-mapping/zcode.md`:「SKILL.md frontmatter 要求」从待验证升已验证(注明来源:官方 zcode-guide 文档;五识别键、1024 上限);`references/host-mapping/README.md` 总览表 ZCode 行同步
- [x] `CHANGELOG.md` 新增 0.7.2 小节 + `.claude-plugin/plugin.json` version bump 0.7.2(同 commit,发布纪律)

## 4. 质量门禁(必经)

- [x] requesting-code-review(BASE = propose commit `53ea7ef`),审查反馈经 receiving-code-review 核实处理

## 5. 收尾(review 通过后)

- [x] `/speccode:syncing`:把 `specs/plugin-packaging/spec.md` 的 MODIFIED delta 合并入 `speccode/spec/plugin-packaging/spec.md`
- [x] `/speccode:archiving`:归档 changes 目录
- [ ] `/speccode:finishing-worktree`:PR → main
