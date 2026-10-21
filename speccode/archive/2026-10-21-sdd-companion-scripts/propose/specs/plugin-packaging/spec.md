# plugin-packaging Delta: sdd-companion-scripts

## MODIFIED Requirements

### Requirement: 命令通过 bin/ PATH 裸调引擎

命令正文 SHALL 通过裸调 `speccode <verb> --cwd .` 引擎——`bin/speccode` wrapper(可执行,转调同目录 `bin/speccode.mjs`)依赖插件 `bin/` 在启用期间被加入 PATH,或由宿主安装步骤提供的 PATH shim 解析;prose MUST NOT 写死 `node <绝对或相对路径>/speccode.mjs`、`speccode.mjs` 或 `node ${CLAUDE_PLUGIN_ROOT}` 形态。`bin/speccode.mjs` 与 `bin/speccode` MUST 均具备可执行位;`speccode.mjs` 直调保留为手动终端调试形态(AGENTS.md 指引)。stdin 管道写法(`echo '<json>' | speccode <verb> --json-stdin`)MUST 保持兼容。

**伴生脚本例外**:skill 自带的伴生脚本(`skills/<name>/scripts/*.mjs`)不是引擎,prose SHALL 以 `node <scripts>/<name>.mjs …` 形态调用,其中 `<scripts>` 的锚点 MUST 是宿主加载 skill 时报告的 skill base directory(相邻 skill 以 `<本 skill base>/../<skill>/scripts` 引用),宿主未报告时以 `$(speccode plugin-root --cwd .)/skills/<skill>/scripts` 兜底;锚点说明 MUST 集中在该 skill 正文开头一段,prose MUST NOT 写死绝对路径或宿主专属变量。

#### Scenario: 命令正文裸调形态
- **WHEN** 检查 `skills/*/SKILL.md` 与 `references/*.md`
- **THEN** 引擎调用写作 `speccode <verb> --cwd .`,不存在 `speccode.mjs <verb>`、`node plugins/speccode/...`、`node .claude/speccode/...` 或 `node ${CLAUDE_PLUGIN_ROOT}` 形态的引用

#### Scenario: stdin 管道写法兼容
- **WHEN** 命令需写入 config/state
- **THEN** 写作 `echo '<json>' | speccode <verb> --cwd . --json-stdin`,wrapper 与直调两种入口下管道数据均正常进入 stdin

#### Scenario: 引擎 wrapper 可执行性
- **WHEN** 检查 `bin/speccode` 文件权限并分别执行 `speccode <verb> --cwd .` 与 `node bin/speccode.mjs <verb> --cwd .`
- **THEN** wrapper 具备可执行位,两种入口对同一 verb 的输出一致

#### Scenario: speccode.mjs 手动调试形态保留
- **WHEN** 检查 `bin/speccode.mjs` 文件权限与 AGENTS.md 的调试指引
- **THEN** 首行为 `#!/usr/bin/env node`、文件具备可执行位,AGENTS.md 手动调试指引仍为 `node bin/speccode.mjs <verb> --cwd .`

#### Scenario: 伴生脚本调用形态
- **WHEN** 检查 `skills/subagent-driven-development/SKILL.md` 与 `skills/executing-plans/SKILL.md`
- **THEN** 伴生脚本以 `node <scripts>/<name>.mjs` 形态调用,正文开头存在唯一一段锚点说明(含宿主 base directory 与 `plugin-root` 兜底),不含 `${CLAUDE_PLUGIN_ROOT}`

### Requirement: 插件根目录布局

speccode 插件根 SHALL 为仓库根本身,并 MUST 含 `.claude-plugin/plugin.json`(manifest)、`skills/`(skill markdown,`<name>/SKILL.md` 目录式布局;skill 目录内允许 `scripts/` 子目录承载伴生脚本——node ESM、首行 `#!/usr/bin/env node`、可执行位、仅 `node:` 内置与同目录相对 import、MUST NOT import `lib/`)、`bin/speccode.mjs`(CLI 引擎前端,自带 `#!/usr/bin/env node` shebang)、`bin/speccode-mcp.mjs`(MCP stdio 引擎前端,自带同一 shebang)、`lib/`(引擎纯逻辑模块,含 verb 表 `lib/verbs.mjs`)、`hooks/`(插件 hooks 层)、`references/`(辅助资源)、`tests/`(单测)。`.claude-plugin/` 目录 MUST 恰含 `plugin.json` 与 `marketplace.json` 两个文件,插件根 MUST NOT 把组件放在 `.claude-plugin/` 目录内部,MUST NOT 存在遗留的 `plugins/` 嵌套层与 `commands/` 目录。

仓库根 SHALL 另含 `package.json` **仅承载 npm 分发元数据**:`name`/`version`/`type: "module"`/`bin`(`speccode` → `bin/speccode.mjs`,`speccode-mcp` → `bin/speccode-mcp.mjs`)/`files` 白名单(`bin`、`lib`、`skills`、`hooks`、`references`);MUST NOT 含 `dependencies`/`devDependencies`(零第三方依赖不变量随 npm 分发延续,MCP 前端与伴生脚本亦不引入任何依赖),MUST NOT 引入构建步骤。`files` 白名单外的本仓自用内容(tests/docs/speccode/support/scripts/.github/各宿主 adapter 目录)MUST NOT 进入 npm 包。

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

#### Scenario: 伴生脚本自包含
- **WHEN** 检查 `skills/*/scripts/*.mjs`
- **THEN** 可执行脚本首行为 `#!/usr/bin/env node` 且具备可执行位,全部 import 为 `node:` 内置或同目录相对路径,不存在指向 `lib/` 的 import
