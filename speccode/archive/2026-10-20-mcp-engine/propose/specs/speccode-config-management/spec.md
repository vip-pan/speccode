# speccode-config-management Delta: mcp-engine

## MODIFIED Requirements

### Requirement: 写 verb stdin 契约

引擎的写 verb(`write-config` / `write-state` / `write-memory` / `rename-memory` / `write-consumed-archives` / `write-knowledge`)的 JSON payload MUST 由调用前端注入为 `flags.payload`,handler MUST NOT 直接读 stdin:**CLI 前端**(`bin/speccode.mjs`)MUST 要求显式 `--json-stdin` 标志并仅在标志在场时从 stdin 读取 JSON 解析为 payload;缺少该标志时 MUST 返回 `{ok: false}` 并提示用法,MUST NOT 静默从 stdin 阻塞读或从 argv 读取超长 JSON;stdin 内容无法解析为 JSON 时 MUST 返回 `{ok:false, error:"invalid JSON on stdin"}` 且不落盘。**MCP 前端**(`bin/speccode-mcp.mjs`)MUST 以 tool 参数 `payload`(object)承载同一 JSON,并以等效于标志在场的方式调用同一 handler。两前端对同一 payload MUST 产生相同落盘结果。

#### Scenario: 缺 --json-stdin 报错
- **WHEN** 调用 `write-config --cwd .` 但不带 `--json-stdin`
- **THEN** verb MUST 返回 `{ok: false}` 与用法提示,不写任何文件

#### Scenario: 带标志正常写入
- **WHEN** 调用 `echo '<json>' | speccode.mjs write-state --cwd . --branch feature/x --json-stdin`
- **THEN** verb MUST 从 stdin 解析 JSON 并经原子写落盘

#### Scenario: stdin 非法 JSON
- **WHEN** 调用 `echo 'not json' | speccode.mjs write-config --cwd . --json-stdin`
- **THEN** verb MUST 返回 `{ok:false, error:"invalid JSON on stdin"}`、非零退出,config.json 不被修改

#### Scenario: MCP payload 参数等效
- **WHEN** 经 `tools/call write-config`,`arguments.payload` 为合法 config 对象
- **THEN** `.speccode/config.json` 经原子写落盘,内容与经 CLI stdin 写入同一对象的结果一致
