# plugin-packaging Delta: lite-semantics

## MODIFIED Requirements

### Requirement: 命令通过 bin/ PATH 裸调引擎

命令正文 SHALL 通过裸调 `speccode <verb> --cwd .` 引擎——`bin/speccode` wrapper(可执行,转调同目录 `bin/speccode.mjs`)依赖插件 `bin/` 在启用期间被加入 PATH,或由宿主安装步骤提供的 PATH shim 解析;prose MUST NOT 写死 `node <绝对或相对路径>/speccode.mjs`、`speccode.mjs` 或 `node ${CLAUDE_PLUGIN_ROOT}` 形态。`bin/speccode.mjs` 与 `bin/speccode` MUST 均具备可执行位;`speccode.mjs` 直调保留为手动终端调试形态(AGENTS.md 指引)。stdin 管道写法(`echo '<json>' | speccode <verb> --json-stdin`)MUST 保持兼容。

**伴生脚本例外**:skill 自带的伴生脚本(`skills/<name>/scripts/*.mjs`)不是引擎,prose SHALL 以 `node <scripts>/<name>.mjs …` 形态调用,其中 `<scripts>` 的锚点 MUST 是宿主加载 skill 时报告的 skill base directory(相邻 skill 以 `<本 skill base>/../<skill>/scripts` 引用),宿主未报告时以 `$(speccode plugin-root --cwd .)/skills/<skill>/scripts` 兜底;锚点说明 MUST 集中在该 skill 正文开头一段,prose MUST NOT 写死绝对路径或宿主专属变量。

**lite 降级例外**:每个含引擎调用的 skill 正文开头的「引擎可用性」锚点段(见 lite-degradation 规格)允许且要求包含 lite 直达形态(`cat` / `ls` / `dirname` / `git` 一行命令)与安装引导——这些不是引擎调用,不受本条裸调形态约束;裸调守卫的禁令清单(`speccode.mjs <verb>`、`node plugins/...`、`${CLAUDE_PLUGIN_ROOT}`)对锚点段同样适用。

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

#### Scenario: lite 锚点段不触发裸调守卫
- **WHEN** 守卫扫描含「引擎可用性」锚点段的 skill
- **THEN** 锚点段内的 `cat` / `git` 直达一行不被判为引擎调用违规;锚点段不含禁令清单形态
