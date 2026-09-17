# Tasks: zcode-plugin-manifest

## 1. 守卫测试先行(红)

- [ ] 新增 `tests/zcode-adapter.test.mjs`:断言 `.zcode-plugin/plugin.json` 键集恰为六官方键、`version` 与 `.claude-plugin/plugin.json` 一致、`skills` 值为 `skills`、无 `skillInstructions`;先对现状跑一次确认失败(红)

## 2. 实现(绿)

- [ ] 重写 `.zcode-plugin/plugin.json` 为官方六键形态(version=0.7.2,skills="skills")
- [ ] `node --test ./tests/zcode-adapter.test.mjs` 转绿;全量 `node --test ./tests/*.test.mjs` 全绿

## 3. 文档与发布

- [ ] `references/host-mapping/zcode.md`:manifest schema 核销(官方文档 + 全样本 + 本机 marketplace 安装实证;0.0.0 现象与修复)、`skillInstructions` 移除说明(映射语义由本文工具映射段承载);`references/host-mapping/README.md` 总览表 ZCode 行同步
- [ ] `CHANGELOG.md` 0.7.2 小节增补 manifest 对齐条目

## 4. 质量门禁(必经)

- [ ] requesting-code-review(增量,BASE = 归档提交 `c39d95c`),反馈经 receiving-code-review 核实处理

## 5. 收尾(review 通过后)

- [ ] syncing:`specs/host-adapters/spec.md` 的 MODIFIED delta 并入主规格
- [ ] archiving:归档为 `speccode/archive/<日期>-zcode-plugin-manifest`
- [ ] push(PRB #59 自动带上本变更)
