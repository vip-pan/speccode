# plugin-packaging Delta: npm-engine-distribution

## MODIFIED Requirements

### Requirement: 插件根目录布局

speccode 插件根 SHALL 为仓库根本身,并 MUST 含 `.claude-plugin/plugin.json`(manifest)、`skills/`(skill markdown,`<name>/SKILL.md` 目录式布局)、`bin/speccode.mjs`(CLI 引擎入口,自带 `#!/usr/bin/env node` shebang)、`lib/`(引擎纯逻辑模块)、`hooks/`(插件 hooks 层)、`references/`(辅助资源)、`tests/`(单测)。`.claude-plugin/` 目录 MUST 恰含 `plugin.json` 与 `marketplace.json` 两个文件,插件根 MUST NOT 把组件放在 `.claude-plugin/` 目录内部,MUST NOT 存在遗留的 `plugins/` 嵌套层与 `commands/` 目录。

仓库根 SHALL 另含 `package.json` **仅承载 npm 分发元数据**:`name`/`version`/`type: "module"`/`bin`(`speccode` → `bin/speccode.mjs`)/`files` 白名单(`bin`、`lib`、`skills`、`hooks`、`references`);MUST NOT 含 `dependencies`/`devDependencies`(零第三方依赖不变量随 npm 分发延续),MUST NOT 引入构建步骤。`files` 白名单外的本仓自用内容(tests/docs/speccode/support/scripts/.github/各宿主 adapter 目录)MUST NOT 进入 npm 包。

#### Scenario: 插件根目录树
- **WHEN** 列出仓库根内容
- **THEN** 存在 `.claude-plugin/plugin.json`、`.claude-plugin/marketplace.json`、`skills/`、`bin/speccode.mjs`、`lib/`、`tests/`、`docs/DESIGN.md`、`package.json`,且 `.claude-plugin/` 下恰有 `plugin.json` 与 `marketplace.json` 两个文件,且不存在 `plugins/` 与 `commands/` 目录

#### Scenario: npm 分发元数据形状
- **WHEN** 检查根 `package.json`
- **THEN** `bin.speccode` 为 `bin/speccode.mjs`,`files` 恰含 `bin/lib/skills/hooks/references` 组件目录,且不存在 `dependencies` 字段

#### Scenario: skill 目录式布局
- **WHEN** 列出 `skills/` 内容
- **THEN** 每个 skill 为一个目录,目录内含 `SKILL.md`(如 `skills/exploring/SKILL.md`),不存在扁平 `.md` 文件形态

#### Scenario: 引擎源码搬移后内部 import 不变
- **WHEN** 检查 `bin/speccode.mjs` 与 `lib/*.mjs` 的 import 语句
- **THEN** 全部为 `node:` 内置模块或 `./`、`../lib/` 相对路径,无对 `plugins/speccode/` 或 `.claude/speccode/` 的引用

### Requirement: 版本发布纪律

仓库 SHALL 维护根目录 `CHANGELOG.md`(中文条目为主体,Keep a Changelog 骨架:`Added`/`Changed`/`Fixed`/`Removed` 分组、语义化版本小节、版本间比较链接);每个版本小节顶部 SHOULD 含**英文 highlights 块**(一句话摘要该版本核心变更,面向英文 README 读者),中文条目仍为主体。任何 bump 版本的提交 MUST 同步 bump 三处版本(`.claude-plugin/plugin.json`、`.zcode-plugin/plugin.json`、`package.json`),并在同一提交(或同一 PR)中同步更新 `CHANGELOG.md` 对应版本小节;三处版本不一致或未完成 CHANGELOG 更新的 version bump MUST NOT 合入 trunk(守卫测试钉死)。每次发版 MUST 在主干打 `v<version>` 形式的 git tag 并创建对应 GitHub Release,release notes SHOULD 摘自 `CHANGELOG.md` 该版本小节;推送 `v*` tag SHALL 触发 npm 发布 workflow(`npm publish --access public`,凭据为仓库 `NPM_TOKEN` secret;token 未配置时发布步失败,不影响 tag/Release 既有产物)。GitHub Release 是给人看的发布标记,插件更新检测实际由 marketplace git 拉取 + `plugin.json` version 比对触发,Release 本身 MUST NOT 被当作更新机制的一部分。

#### Scenario: version bump 三方同步
- **WHEN** 一个提交将 `plugin.json` 的 `version` 从 `x.y.z` 提升到新版本
- **THEN** 同一提交(或同一 PR)中 `.zcode-plugin/plugin.json` 与 `package.json` 同版本,且根 `CHANGELOG.md` 存在以 `## [<新版本>] - <YYYY-MM-DD>` 开头的小节,条目为中文、按 Keep a Changelog 分组,顶部含英文 highlights 块

#### Scenario: 发版形态
- **WHEN** 维护者发布版本 `x.y.z`
- **THEN** 主干上存在 `vx.y.z` 标签,GitHub 上存在同名 Release(notes 与 `CHANGELOG.md` 该版本小节一致或为其摘录),且 `v*` tag 推送触发的 npm 发布 workflow 将该版本发布至 npm registry

#### Scenario: Release 不替代更新检测
- **WHEN** 审计插件更新机制的文档与 spec
- **THEN** 更新触发条件仅表述为「marketplace 仓库 git 拉取后 `plugin.json` version 变化」,任何文档 MUST NOT 声称 GitHub Release/tag 会触发用户侧自动更新
