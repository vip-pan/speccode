# Tasks: mcp-engine

> 本清单已由 plan/2026-10-20-mcp-engine-plan.md 接管:实现进度以 plan 的 checkbox 为准,本文件不再勾选,仅作意图索引。

## A. 契约与 verb 表下沉(lib,无依赖)

- A1 `lib/contract.mjs`:导出 `CONTRACT_VERSION = 1`(注释写明覆盖范围)与 `MCP_PROTOCOL_VERSIONS`;`tests/verbs.test.mjs` 先写用例(正整数、清单含 `2025-06-18` 且最新在首位)
- A2 `lib/verbs.mjs`:从 `bin/speccode.mjs` 逐字搬入 `VERBS`、`repoRoot`、`speccodeDirOf`;写 verb 改从 `flags.payload` 取数,`run-hook` 改从 `flags.fragment` / `flags.fragmentWarning` 取数;新增 `STDIN_MODE` 表(`payload` / `fragment`)与 `runVerb(verb, flags)`(未知 verb / 抛错 → `{ok:false,error}`);新增 `contract-version` verb
- A3 `bin/speccode.mjs` 收缩为薄壳:`parseArgs`(保留导出)→ 按 `STDIN_MODE` 读 stdin 注入(payload 解析失败 → `invalid JSON on stdin`)→ `runVerb` → 单行 JSON + exitCode;入口守卫改为 realpath 比对(兼容 npm bin 符号链接,修复 #69 遗留的静默零输出)
- A4 跑 `tests/cli.test.mjs` 确认零修改全通过(回归网)

## B. MCP 协议纯逻辑(lib)

- B1 `tests/mcp.test.mjs` 进程内用例先行:注入假 `runVerb`,覆盖 initialize 协商(三版 + 未知回退)、`notifications/initialized` 不回应、`ping`、`tools/list` 形状、`tools/call` 成功 / `ok:false`→isError / 抛错→-32603、`-32700` / `-32600` / `-32601` / `-32602`
- B2 `lib/mcp.mjs`:`TOOL_META`(每 verb description + inputSchema,`cwd` 可选、写类 `payload`、run-hook `fragment`)、`EXCLUDED_VERBS = ['plugin-root']`、`listTools()`、`createServer({runVerb, engineVersion, defaultCwd}).handleMessage(msg) → response | null`、`handleLine(line)`(含 -32700)
- B3 parity 守卫(`tests/verbs.test.mjs`):`Object.keys(VERBS) ∖ EXCLUDED` 与 `Object.keys(TOOL_META)` 集合相等;每个 schema `type==='object'` 且 description 非空

## C. MCP stdio 前端(bin)

- C1 `bin/speccode-mcp.mjs`:shebang、可执行位;stdin 缓冲按 `\n` 切分 → `handleLine` → 有回应则 stdout 写一行;`defaultCwd = process.cwd()`;日志仅 stderr;入口守卫 realpath 比对
- C2 端到端用例(`tests/mcp.test.mjs`):`spawn` 对 `makeRepo()` 临时仓,写 config 后发 initialize → initialized → tools/list → tools/call write-state → 读磁盘断言落盘 → tools/call reconcile 含该分支 → tools/call read-config 与 CLI 深度相等 → contract-version 两前端同值;断言 stdout 每行可 `JSON.parse`;symlink 调用用例

## D. 分发元数据与文档

- D1 `package.json` `bin` 增 `"speccode-mcp": "bin/speccode-mcp.mjs"`;`tests/zcode-adapter.test.mjs` npm 守卫扩展断言该键;新增两前端 shebang + 可执行位守卫
- D2 `CHANGELOG.md` `[Unreleased]` 增 Added(MCP 前端、contract-version)、Changed(verb 表下沉 lib、薄 CLI、stdin 非法 JSON 统一措辞)、Fixed(symlink 入口守卫)条目
- D3 `AGENTS.md`:架构节第 2 层改述(verb 表在 `lib/verbs.mjs`,bin/ 为 CLI 与 MCP 两薄前端,清单以 `lib/verbs.mjs` 的 `VERBS` 为准);lib 模块计数更新;常用命令补 MCP 手动驱动示例;关键不变量「写 verb 必须 --json-stdin」补 MCP payload 等效说明

## E. 验证

- E1 全量 `node --test ./tests/*.test.mjs` 通过(基线 323 → 新增用例后更多)
- E2 手动冒烟:两行 JSON-RPC(initialize、tools/list)经管道喂 `node bin/speccode-mcp.mjs`,stdout 两行合法 JSON,stderr 无协议消息
- E3 全仓 grep:`readFileSync(0` 仅出现于 `bin/speccode.mjs`;`skills/` 零改动(`git diff --stat` 不含 skills/)
