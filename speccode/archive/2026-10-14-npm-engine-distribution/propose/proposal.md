---
tier: 1
---

# Proposal: npm-engine-distribution

## Why

引擎可达性目前依赖「宿主自动 PATH(Claude Code 独有)」或「自制 install-shim.sh(会随 cache 版本目录升级断链、marketplace 安装界面零提示)」。npm 的 bin 机制是 CLI 进 PATH 的标准答案:机器级一次生效、全宿主共享、升级由包管理器管理——「shim 断链」这个问题类别整个消失。这是 host-neutral-engine(已立项合流)之后的既定第二步。

## What Changes

- 根新增 `package.json`:`name: "speccode"`、`version`(与 `.claude-plugin/plugin.json`/`.zcode-plugin/plugin.json` 三方同步,守卫测试钉死)、`type: "module"`、`bin: {"speccode": "bin/speccode.mjs"}`(自带 node shebang)、`files` 白名单 = `bin/lib/skills/hooks/references`(与插件打包边界一致;tests/docs/speccode/support/scripts/.github/adapter 目录不进 npm 包)。**零第三方依赖不变**(无 dependencies 字段)。
- 新增 `.github/workflows/npm-publish.yml`:推送 `v*` tag 触发 `npm publish --access public`(需仓库配 `NPM_TOKEN` secret;与既有 tag+Release 发布纪律合流,发版分支无需额外手工步骤)。
- 文档同步(双语成对):README.md/README_CN.md 安装段补 npm 引擎通道(不硬编码版本号);docs/DESIGN.md/DESIGN_CN.md 多宿主安装段补 npm 替代;references/host-mapping/README.md 通用步骤第 2 步补 `npm i -g speccode` 替代;AGENTS.md「无 package.json」表述更新为「package.json 仅承载 npm 分发元数据,零依赖不变」。
- 安装文档层级:npm 通道是**引擎**通道,与宿主插件安装(各 adapter)互补而非替代——skill 层仍走各宿主插件机制。

## Capabilities

- `plugin-packaging`(MODIFIED:插件根目录布局 / 版本发布纪律)

## Impact

`package.json`(新)、`.github/workflows/npm-publish.yml`(新)、`tests/zcode-adapter.test.mjs`(版本三方同步守卫扩展)或新守卫、`README.md`、`README_CN.md`、`docs/DESIGN.md`、`docs/DESIGN_CN.md`、`references/host-mapping/README.md`、`AGENTS.md`
