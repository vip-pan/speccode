# plugin-packaging Delta: mcp-engine

## MODIFIED Requirements

### Requirement: 插件根目录布局

speccode 插件根 SHALL 为仓库根本身,并 MUST 含 `.claude-plugin/plugin.json`(manifest)、`skills/`(skill markdown,`<name>/SKILL.md` 目录式布局)、`bin/speccode.mjs`(CLI 引擎前端,自带 `#!/usr/bin/env node` shebang)、`bin/speccode-mcp.mjs`(MCP stdio 引擎前端,自带同一 shebang)、`lib/`(引擎纯逻辑模块,含 verb 表 `lib/verbs.mjs`)、`hooks/`(插件 hooks 层)、`references/`(辅助资源)、`tests/`(单测)。`.claude-plugin/` 目录 MUST 恰含 `plugin.json` 与 `marketplace.json` 两个文件,插件根 MUST NOT 把组件放在 `.claude-plugin/` 目录内部,MUST NOT 存在遗留的 `plugins/` 嵌套层与 `commands/` 目录。

仓库根 SHALL 另含 `package.json` **仅承载 npm 分发元数据**:`name`/`version`/`type: "module"`/`bin`(`speccode` → `bin/speccode.mjs`,`speccode-mcp` → `bin/speccode-mcp.mjs`)/`files` 白名单(`bin`、`lib`、`skills`、`hooks`、`references`);MUST NOT 含 `dependencies`/`devDependencies`(零第三方依赖不变量随 npm 分发延续,MCP 前端亦不引入 SDK),MUST NOT 引入构建步骤。`files` 白名单外的本仓自用内容(tests/docs/speccode/support/scripts/.github/各宿主 adapter 目录)MUST NOT 进入 npm 包。

#### Scenario: 插件根目录树
- **WHEN** 列出仓库根内容
- **THEN** 存在 `.claude-plugin/plugin.json`、`.claude-plugin/marketplace.json`、`skills/`、`bin/speccode.mjs`、`bin/speccode-mcp.mjs`、`lib/verbs.mjs`、`tests/`、`docs/DESIGN.md`、`package.json`,且 `.claude-plugin/` 下恰有 `plugin.json` 与 `marketplace.json` 两个文件,且不存在 `plugins/` 与 `commands/` 目录

#### Scenario: npm 分发元数据形状
- **WHEN** 检查根 `package.json`
- **THEN** `bin.speccode` 为 `bin/speccode.mjs`,`bin["speccode-mcp"]` 为 `bin/speccode-mcp.mjs`,`files` 恰含 `bin/lib/skills/hooks/references` 组件目录,且不存在 `dependencies` 字段

#### Scenario: skill 目录式布局
- **WHEN** 列出 `skills/` 内容
- **THEN** 每个 skill 为一个目录,目录内含 `SKILL.md`(如 `skills/exploring/SKILL.md`),不存在扁平 `.md` 文件形态

#### Scenario: 引擎源码搬移后内部 import 不变
- **WHEN** 检查 `bin/*.mjs` 与 `lib/*.mjs` 的 import 语句
- **THEN** 全部为 `node:` 内置模块或 `./`、`../lib/` 相对路径,无对 `plugins/speccode/` 或 `.claude/speccode/` 的引用

#### Scenario: 两个引擎前端可执行
- **WHEN** 检查 `bin/speccode.mjs` 与 `bin/speccode-mcp.mjs`
- **THEN** 二者首行均为 `#!/usr/bin/env node` 且具备可执行位
