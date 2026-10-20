# mcp-frontend Delta: mcp-engine

## Purpose

把 speccode 引擎以 MCP(Model Context Protocol)stdio server 的形态暴露给宿主:宿主一行配置拉起、tools 自描述、与 CLI 前端共享同一 verb 实现,并自报 prose↔引擎的契约版本。

## ADDED Requirements

### Requirement: MCP stdio server 协议最小面

引擎 SHALL 提供 `bin/speccode-mcp.mjs`(自带 `#!/usr/bin/env node` shebang、可执行位)作为 MCP stdio server:以换行分隔的 JSON-RPC 2.0 消息经 stdin 接收、stdout 发送(每条消息一行,MUST NOT 含裸换行;stdout MUST 只写协议消息,日志仅 stderr)。server MUST 处理 `initialize`(返回协商后的 `protocolVersion`、`capabilities.tools`、`serverInfo{name:"speccode", version}` 与 `instructions`)、`notifications/initialized`(通知,不回应)、`ping`(返回空对象)、`tools/list`、`tools/call`;未知方法 MUST 返回 JSON-RPC 错误 `-32601`,无法解析的行 MUST 返回 `-32700`,缺少 `method` 或 `jsonrpc` 不为 `"2.0"` MUST 返回 `-32600`,`tools/call` 的未知 tool 或非对象 `arguments` MUST 返回 `-32602`。任何无 `id` 的通知 MUST NOT 产生回应。`protocolVersion` 协商:客户端请求值在支持清单内则回显,否则返回清单中的最新版本。协议处理的确定性逻辑 MUST 实现于 `lib/mcp.mjs` 并可在进程内以注入的 verb 执行器单测,`bin/speccode-mcp.mjs` 只做 stdio 循环。

#### Scenario: initialize 协商
- **WHEN** 客户端发送 `initialize`,`params.protocolVersion` 为 `2025-03-26`
- **THEN** server 返回 `result.protocolVersion` 为 `2025-03-26`,`result.capabilities.tools` 存在,`result.serverInfo.name` 为 `speccode`

#### Scenario: 未知协议版本回退最新
- **WHEN** 客户端 `initialize` 请求的 `protocolVersion` 不在支持清单内
- **THEN** server 返回支持清单中的最新版本

#### Scenario: 通知不回应
- **WHEN** 客户端发送 `notifications/initialized`(无 `id`)
- **THEN** stdout 不产生任何对应回应行

#### Scenario: 协议错误码
- **WHEN** 分别发送一行非 JSON 文本、一条 `method` 为 `nope` 的请求、一条 `tools/call` 指向不存在 tool 的请求
- **THEN** 依次收到 `error.code` 为 `-32700`、`-32601`、`-32602` 的 JSON-RPC 错误回应

### Requirement: tools 与 verb 一一对应

MCP tool 面 SHALL 与引擎 verb 表一一对应:每个 verb(排除清单 `plugin-root` 除外)对应一个同名 tool,带非空 `description` 与 JSON Schema `inputSchema`(`type: "object"`;所有 tool 接受可选 `cwd` 字串,缺省为 server 进程 cwd;写类 tool 以 `payload` object 参数承载 CLI 下经 stdin 传递的 JSON;`run-hook` 以可选 `fragment` object 参数承载 CLI 下的 stdin 片段)。tool 元数据表与 verb 表 MUST 双向一致:存在无元数据的 verb(非排除项)或指向不存在 verb 的元数据 MUST 被守卫测试拒绝。`tools/call` MUST 以 CLI 同一 handler 执行,返回 `result.content[0]` 为 `{type:"text", text:<verb 结果 JSON 字串>}` 且 `result.structuredContent` 为同一结果对象;verb 结果 `ok:false` 或 handler 抛错 MUST 映射为 `result.isError: true`(而非 JSON-RPC 错误),抛错时结果形状为 `{ok:false, error}`。

#### Scenario: 列表与 verb 对齐
- **WHEN** 调用 `tools/list`
- **THEN** 返回的 tool 名集合等于 verb 表键集合减去 `plugin-root`,每个 tool 的 `inputSchema.type` 为 `object` 且 `description` 非空

#### Scenario: 写类 tool 经 payload 落盘
- **WHEN** 对已 init 的仓库调用 `tools/call` `write-state`,`arguments` 为 `{cwd, branch:"feature/x", payload:{...合法 v3 state}}`
- **THEN** `.speccode/state/branches/feature__x.json` 经原子写落盘,内容与 payload 一致,随后 `tools/call reconcile` 的 `features` 含该分支

#### Scenario: verb 失败映射 isError
- **WHEN** 调用 `tools/call` `read-memory` 且 `arguments.branch` 为非法分支名
- **THEN** 回应为 JSON-RPC 成功结果,`result.isError` 为 `true`,`result.structuredContent.ok` 为 `false` 且含 `error`

#### Scenario: 同 verb 双前端输出一致
- **WHEN** 对同一仓库分别以 `node bin/speccode.mjs read-config --cwd <repo>` 与 `tools/call read-config {cwd:<repo>}` 读取
- **THEN** CLI 输出的 JSON 与 tool 结果的 `structuredContent` 深度相等

### Requirement: 契约版本自报

引擎 SHALL 在 `lib/contract.mjs` 导出整数常量 `CONTRACT_VERSION`,其覆盖范围(state v3 形状、config v3 形状、memory 键模型、verb 输出形状)MUST 以注释写明;任何 prose 可见的不兼容形状变更 MUST 递增该值。引擎 SHALL 提供 `contract-version` verb 与同名 tool,返回 `{ok:true, contractVersion, engineVersion, protocolVersions}`(`engineVersion` 读自 `package.json`,`protocolVersions` 为 MCP 支持清单);MCP `initialize` 结果的 `instructions` MUST 含契约版本数字。

#### Scenario: verb 与 tool 同值
- **WHEN** 分别经 CLI `contract-version` 与 `tools/call contract-version` 查询
- **THEN** 二者 `contractVersion` 相等且为正整数,`engineVersion` 等于 `package.json` 的 `version`

#### Scenario: initialize 携带契约
- **WHEN** 客户端完成 `initialize`
- **THEN** `result.instructions` 字串包含 `CONTRACT_VERSION` 的十进制表示

### Requirement: 双前端共享 verb 表

verb 表与仓库根定位(`repoRoot`/`speccodeDirOf`)SHALL 实现于 `lib/verbs.mjs`(导出 `VERBS`、`STDIN_MODE` 与 `runVerb(verb, flags)`),`bin/speccode.mjs` 与 `bin/speccode-mcp.mjs` MUST 均从该模块取 handler,MUST NOT 各自维护 verb 实现。`runVerb` 对未知 verb MUST 返回 `{ok:false, error}`,对 handler 抛错 MUST 捕获为 `{ok:false, error}`。写 verb 的 payload MUST 由前端注入为 `flags.payload`(CLI:`--json-stdin` 在场时读 stdin 解析;MCP:tool 参数 `payload`),handler MUST NOT 直接读 stdin;哪些 verb 读 stdin 及读法(`payload` / `fragment`)MUST 由 `STDIN_MODE` 声明,CLI 壳 MUST NOT 按 verb 名硬编码。CLI 前端的既有契约(`--json-stdin` 必需、缺失时的错误文本与非零退出、未知 verb 处理、`parseArgs` 导出、仅作为进程入口时才运行 `main` 的守卫)MUST 保持不变;两前端的入口守卫 MUST 以 realpath 比对实现(`realpathSync(process.argv[1])` 等于自身模块路径),使经 npm bin 符号链接(文件名无 `.mjs` 后缀)调用时同样执行。

#### Scenario: CLI 回归不变
- **WHEN** 对下沉后的引擎运行既有 `tests/cli.test.mjs` 全部用例
- **THEN** 全部通过,用例文本零修改

#### Scenario: handler 不读 stdin
- **WHEN** 检查 `lib/verbs.mjs` 源码
- **THEN** 不存在对 fd 0 的读取(`readFileSync(0` 或等效),stdin 读取仅出现于 `bin/speccode.mjs`

#### Scenario: 符号链接调用执行入口
- **WHEN** 对 `bin/speccode.mjs` 建名为 `speccode` 的符号链接并执行 `node <link> contract-version`;对 `bin/speccode-mcp.mjs` 建名为 `speccode-mcp` 的符号链接并经 stdio 发送 `ping`
- **THEN** 前者输出 `contractVersion` JSON 且 exit 0,后者回应 `{jsonrpc:"2.0", id, result:{}}`
