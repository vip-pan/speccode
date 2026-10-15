# Tasks: npm-engine-distribution

## 分发元数据

- [ ] 根 `package.json`:name/version(0.7.3,与双 manifest 同步)/type: module/bin(speccode → bin/speccode.mjs)/files 白名单(bin/lib/skills/hooks/references);无 dependencies
- [ ] `.github/workflows/npm-publish.yml`:push tag `v*` → npm publish --access public(node 24,`NPM_TOKEN` 凭据)

## 守卫测试(TDD:先红后绿)

- [ ] 版本三方同步守卫(package.json == .claude-plugin == .zcode-plugin;三处 0.7.3 基线)
- [ ] npm 元数据形状守卫:bin 指 speccode.mjs、files 恰为五目录、无 dependencies 字段

## 文档(双语成对)

- [ ] README.md + README_CN.md:安装段补 npm 引擎通道一句(`npm i -g speccode` 替代/并存 shim;不硬编码版本)
- [ ] docs/DESIGN.md + docs/DESIGN_CN.md:多宿主安装段补 npm 替代一句
- [ ] references/host-mapping/README.md:通用步骤第 2 步补 npm 替代
- [ ] AGENTS.md:「无 package.json」表述更新(仅 npm 分发元数据,零依赖不变、无构建步骤)

## 验收

- [ ] 全量测试绿;`npm pack --dry-run` 产物清单人工核对(files 白名单生效,无 tests/docs/speccode/support/adapter 泄漏)
