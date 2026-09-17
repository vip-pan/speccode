# Tasks: zcode-skill-name-field

## 1. 守卫测试先行(红)

- [ ] 新增 `tests/skill-frontmatter.test.mjs`:遍历 `skills/*/SKILL.md`,断言 frontmatter 含 `name` 且值 == 目录名、`description` 存在且 ≤1024 字符、无 `category`/`tags` 残留;先对现状跑一次确认失败(红)

## 2. 实现(绿)

- [ ] 24 个 `skills/<name>/SKILL.md` 的 frontmatter 各加一行 `name: <目录名>`(置于 `description` 之前,不加引号)
- [ ] `node --test ./tests/skill-frontmatter.test.mjs` 转绿;全量 `node --test ./tests/*.test.mjs` 全绿

## 3. 规格与文档

- [ ] syncing:把 `speccode/changes/zcode-skill-name-field/specs/plugin-packaging/spec.md` 的 MODIFIED delta 合并入 `speccode/spec/plugin-packaging/spec.md`
- [ ] `references/host-mapping/zcode.md`:「SKILL.md frontmatter 要求」从待验证升已验证(注明来源:官方 zcode-guide 文档;五识别键、1024 上限);`references/host-mapping/README.md` 总览表 ZCode 行同步
- [ ] `CHANGELOG.md` 按发布纪律新增小节

## 4. 收尾

- [ ] requesting-code-review(必经)
- [ ] finishing-worktree(PR → main)
