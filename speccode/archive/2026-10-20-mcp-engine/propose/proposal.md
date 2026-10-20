---
tier: 2
---

# Proposal: mcp-engine

## Why

引擎目前只有一个前端——CLI verb,命令层靠 `speccode <verb>` 裸调,依赖宿主 PATH 注入或 npm/shim 安装步骤;非 Claude Code 宿主因此多出一步「装引擎」。MCP 是各 coding-agent 宿主共有的标准挂载面:宿主配置一行 `npx` 即可拉起、tools 自描述让 agent 启动即发现引擎在场、项目级 `.mcp.json` 可随仓库共享。本需求是大需求 prose-core-mcp-split 的依赖根:为引擎补第二前端(MCP server),并建立 prose↔引擎的显式契约版本;后续 memory-lifecycle / lite-semantics / host-adapters-mcp 三个子需求都建立在这个工具面之上。

## What Changes

- **verb 表下沉 lib**:`bin/speccode.mjs` 中的 `VERBS` 表与 `repoRoot`/`speccodeDirOf` 定位逻辑迁入新模块 `lib/verbs.mjs`(单一真源),导出 `VERBS`/`runVerb`/`STDIN_MODE`;写 verb 的 payload 由调用前端注入(`flags.payload`),handler 内不再直接读 stdin;`run-hook` 的可选 stdin 片段同理改为 `flags.fragment` 注入。CLI 契约不变:`--json-stdin` 仍为必需标志,缺失时错误信息与退出码不变。
- **薄 CLI**:`bin/speccode.mjs` 收缩为参数解析 + 按 `STDIN_MODE` 读 stdin 注入 + `runVerb` + 单行 JSON 输出的壳;`parseArgs` 导出保留。**入口守卫改为 realpath 比对**(`realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)`):既有的 `process.argv[1].endsWith('speccode.mjs')` 在 npm bin 符号链接(名为 `speccode`,无 `.mjs`)下为假,`npm i -g speccode` 后裸调 `main()` 不执行、静默零输出 exit 0——这是 #69 npm 通道的遗留 bug(编写计划时实测确认),两个前端一并修复并加 symlink 调用用例。
- **新增 MCP 前端**:`lib/mcp.mjs`(协议处理纯逻辑:JSON-RPC 2.0 消息分派、protocolVersion 协商、`tools/list` 与 `tools/call`、错误码)+ `bin/speccode-mcp.mjs`(stdio ndjson 循环壳,日志仅 stderr)。零第三方依赖(仅 `node:` 内置),不引入 MCP SDK。
- **工具面 = verb 1:1**:每个 verb(排除清单 `plugin-root` 除外)对应同名 MCP tool,带 description 与 JSON Schema `inputSchema`;写类 tool 以 `payload` 参数替代 stdin;tool 结果以 `content`(text JSON)+ `structuredContent` 返回,verb 级失败(`ok:false`)映射为 `isError: true` 而非 JSON-RPC 错误。守卫测试钉死 verb↔tool 双向一一对应。
- **契约版本**:新增 `lib/contract.mjs` 导出 `CONTRACT_VERSION`(整数,覆盖 state v3 / config v3 形状、memory 键模型、verb 输出形状;prose 可见形状不兼容变更时递增)与 `MCP_PROTOCOL_VERSIONS`;新增 `contract-version` verb/tool 自报 `{contractVersion, engineVersion, protocolVersions}`;MCP `initialize` 结果的 `instructions` 字段携带契约版本。
- **分发元数据**:`package.json` `bin` 增 `speccode-mcp` → `bin/speccode-mcp.mjs`,`keywords` 增 `mcp`(npm 可发现性;`files` 白名单不变;不 bump 版本,条目记入 CHANGELOG `[Unreleased]`)。
- **文档**:AGENTS.md 架构节第 2 层改述为「verb 表在 `lib/verbs.mjs`,`bin/` 为 CLI 与 MCP 两个薄前端」,常用命令补 MCP 手动驱动示例。README/DESIGN 门面与 host-mapping 的 MCP 接线段**不在本需求**(分别归 docs-i18n、host-adapters-mcp 子需求)。

## Capabilities

- `mcp-frontend`(ADDED:新能力)
- `speccode-config-management`(MODIFIED:写 verb stdin 契约)
- `plugin-packaging`(MODIFIED:插件根目录布局)

## Impact

`lib/verbs.mjs`(新)、`lib/mcp.mjs`(新)、`lib/contract.mjs`(新)、`bin/speccode.mjs`(收缩为薄壳)、`bin/speccode-mcp.mjs`(新)、`package.json`、`tests/mcp.test.mjs`(新)、`tests/verbs.test.mjs`(新:parity 与 contract 守卫)、`tests/zcode-adapter.test.mjs`(npm 守卫扩展)、`tests/cli.test.mjs`(既有端到端用例零修改作回归网)、`CHANGELOG.md`、`AGENTS.md`。命令 markdown(`skills/`)零改动。
