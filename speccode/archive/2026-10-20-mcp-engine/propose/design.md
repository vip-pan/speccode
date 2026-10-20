# Design: mcp-engine

## Context

引擎三层分工现状:`lib/*.mjs`(14 个纯逻辑模块)→ `bin/speccode.mjs`(430 行,内含 30 个 verb 的 `VERBS` 表、`repoRoot`/`speccodeDirOf` 定位、stdin 读取)→ 命令 markdown 裸调 `speccode <verb>`。6 个写 verb(write-config / write-state / write-memory / rename-memory / write-consumed-archives / write-knowledge)在 handler 内 `JSON.parse(readStdin())`;`run-hook` 在非 TTY 时读 stdin 片段。既有 323 个测试中 `cli.test.mjs` 经 `spawnSync` 端到端覆盖全部 verb。

约束:零第三方依赖(仅 `node:` 内置);lib 语言中立(错误文本英文);确定性逻辑不进 prose;`--json-stdin` 契约(spec「写 verb stdin 契约」)与裸调契约(spec「命令通过 bin/ PATH 裸调引擎」)在本需求内保持有效——命令层改用 MCP tools 是 lite-semantics 子需求的事。

参照:superpowers v7 / agent-skills 均无统一引擎,但二者也都没有多分支编排状态;探索结论是编排脊柱保持中央引擎,接口改 MCP 为主、CLI 为辅。

## Goals

- 引擎具备 MCP stdio 前端,宿主一行配置即可拉起,tools 自描述。
- CLI 与 MCP 共享同一 verb 实现,输出形状逐 verb 一致(同输入同结果)。
- 引擎自报契约版本,为 prose↔引擎分离建立可检查的兼容边界。
- 既有测试全部保持通过;新前端有独立端到端测试。

## Non-Goals

- 改动任何 `skills/*/SKILL.md`(prose 继续裸调 CLI;切换到 MCP tools 归 lite-semantics)。
- 六宿主 adapter 的 MCP 注册指引(归 host-adapters-mcp)。
- README/DESIGN 双语门面重写(归 docs-i18n)。
- memory 位置迁移、config 字段裁剪(归 memory-lifecycle / init-slim-config)。
- HTTP/SSE 传输、鉴权、多租户——本地 stdio 单用户即全部场景。
- 版本 bump(归发布 chore)。

## Decisions

**D1. verb 表下沉 `lib/verbs.mjs`,bin/ 只留两个薄前端。** MCP 前端必须复用 handler,而 handler 现住 bin/。被否备选:(a) MCP server 每次 tool 调用 `spawnSync` CLI 子进程——进程开销、stdin 管道编排、引擎自己 shell 自己;(b) 在 MCP 模块复刻 handler——双份维护必漂移。下沉后 `plugin-root` 的 `import.meta.url` 锚点从 `bin/..` 变 `lib/..`,解析结果同为仓库根,行为不变。

**D2. 前端注入 payload,handler 不读 stdin;stdin 模式按 verb 声明。** handler 签名不变(接收 flags 对象),写 verb 从 `flags.payload`(已解析对象)取数;`run-hook` 从 `flags.fragment` / `flags.fragmentWarning` 取数。`lib/verbs.mjs` 导出声明式 `STDIN_MODE` 表(`verb → 'payload' | 'fragment'`),CLI 壳据此决定是否读 stdin:`payload` 模式仅在 `--json-stdin` 在场时读并解析(解析失败 → `{ok:false, error:"invalid JSON on stdin"}`,统一既有两种措辞);`fragment` 模式在 `!isatty(0)` 时读,非法 JSON 降级 `{}` 并附 warning——语义与现状一致。MCP 前端把 tool 参数 `payload` / `fragment` 直接放进 flags,并固定注入 `'json-stdin': true` 使既有标志检查自然通过。契约层面:`--json-stdin` 缺失时 handler 返回的错误文本与退出码一字不改;「写 verb stdin 契约」以 MODIFIED 形式扩展为「CLI 前端 stdin / MCP 前端 payload 参数」。被否备选:handler 接收 `ctx.readPayload()` 回调——多一层间接,且 CLI 需保留「不带标志绝不阻塞读 stdin」语义,在壳里按声明表预读更直接;在 CLI 壳里按 verb 名硬编码特判 run-hook——把 verb 知识泄漏回 bin/,违背单一真源。

**D3. 手写 JSON-RPC 2.0 over stdio(ndjson),不引入 MCP SDK。** 零依赖是仓库不变量;协议最小面只需 `initialize` / `notifications/initialized` / `ping` / `tools/list` / `tools/call` 五个方法,实现成本远低于一个依赖的供应链成本。`protocolVersion` 协商:支持清单 `2025-06-18` / `2025-03-26` / `2024-11-05`,客户端请求值在清单内则回显,否则回最新。消息以 `\n` 分隔,`JSON.stringify` 不产裸换行故框架安全;stdin 以缓冲区累积按 `\n` 切分,容忍半行与空行。协议错误用 JSON-RPC error(-32700 解析 / -32600 非法请求 / -32601 未知方法 / -32602 参数 / -32603 内部);**verb 执行失败不是协议错误**——`ok:false` 走 `result.isError: true`(MCP 规范:工具级错误应让模型可见以便自纠)。通知(无 `id`)绝不回应。stdout 只写协议消息,一切日志走 stderr。

**D4. tool 面 = verb 1:1 同名,排除清单 `{plugin-root}`。** 单一真源、零学习成本(prose 说「tool reconcile 即 verb reconcile」);排除 `plugin-root` 是因为 npm 分发的引擎根 ≠ 宿主插件根,经 MCP 返回会误导。tool 元数据(description + inputSchema)集中在 `lib/mcp.mjs` 的 `TOOL_META` 表;守卫测试断言 `Object.keys(VERBS) ∖ EXCLUDED == Object.keys(TOOL_META)` 双向相等,防新增 verb 漏登 tool 或 tool 指向不存在的 verb。所有 tool 接受可选 `cwd`(缺省 server 进程 cwd——宿主通常在项目根拉起 server);写类 tool 的 `payload` 为 object 参数。被否备选:精选子集(curation 属 lite-semantics 的判断,现在做会和它打架);单一泛化 tool `speccode({verb,args})`(丢掉自描述——MCP 的核心收益)。

**D5. tool 结果同时给 `content`(text = JSON 字串)与 `structuredContent`。** `structuredContent` 是 2025-06-18 的结构化返回;老客户端读 text。不声明 `outputSchema`(verb 输出形状多样且随 contractVersion 演进,钉 schema 反而制造漂移)。

**D6. 契约版本 = `lib/contract.mjs` 的 `CONTRACT_VERSION` 整数常量 + `contract-version` verb/tool。** 覆盖范围写在常量注释里:state v3 形状、config v3 形状、memory 键模型(`<type>__<slug>` / `_exploring__<topic>` / `_knowledge`)、verb 输出形状;prose 可见的不兼容变更递增。`initialize` 的 `instructions` 字段携带「speccode engine, contract version N; tools mirror CLI verbs 1:1」。被否备选:塞进 `serverInfo` 自定义字段(规范外字段,客户端可能剔除);用 `engineVersion`(npm semver)代替(包版本随修复发布频繁变动,与 prose 兼容性无关,会让 prose 侧检查无意义地频繁失败)。

**D7. 不 bump 版本,CHANGELOG 记 `[Unreleased]`。** 发版纪律把 bump 与 CHANGELOG 小节绑定在发布 chore 内;本需求作为集成分支子需求随 finishing-feature 一次上 trunk,版本由发布 chore 定。

**D8. 测试分三层。** `lib/mcp.mjs` 在进程内以注入的 `runVerb` 测协议(协商、五方法、错误码、通知不回应、isError 映射);`tests/mcp.test.mjs` 端到端 `spawn` `bin/speccode-mcp.mjs` 对真实临时仓(initialize → tools/list → tools/call write-state → 磁盘原子落盘 → reconcile 读回);parity/contract 守卫在 `tests/verbs.test.mjs`。既有 `cli.test.mjs` 作下沉重构的回归网,不改用例。

**D9. 两前端入口守卫 = realpath 比对,不是 argv 后缀。** 编写计划时实测:对 `bin/speccode.mjs` 建名为 `speccode` 的符号链接(即 npm bin 的形态)并执行,`process.argv[1]` 是未解析的链接路径,`endsWith('speccode.mjs')` 为假,`main()` 不运行、无输出、exit 0——#69 的 npm 通道在真实调用下是静默失效的。修复为 `realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)`(Node 对 ESM 主模块的 `import.meta.url` 已解析符号链接;`realpathSync` 失败即非入口),CLI 与 MCP 两个 bin 同用,各加 symlink 调用用例。被否备选:npm bin 改指 bash wrapper `bin/speccode`(wrapper 依赖 `dirname "$0"` 的同目录约定,npm 链接目录下不成立;且 MCP 前端也需同一修复,治本优于绕路)。

## Risks

- **下沉重构引入回归** → 323 个既有测试(含 `cli.test.mjs` 全 verb 端到端)作安全网;handler 体逐字搬移,只改 payload/fragment 取数处。
- **宿主 MCP 协议版本差异** → 协商清单覆盖三版;测试对每个版本各发一次 initialize。
- **stdout 被日志污染导致客户端解析失败** → server 内禁 `console.log`,日志统一 stderr;端到端测试断言 stdout 每行皆为合法 JSON。
- **宿主以非项目根 cwd 拉起 server** → 所有 tool 接受 `cwd` 覆盖;AGENTS.md 写明缺省行为。
- **写类 tool 的权限摩擦**(探索已识别,属宿主 UX)→ 本需求不解,留 lite-semantics 实测后决定写类是否也走 MCP。
- **verb 新增漏登 tool** → parity 守卫测试双向断言。

## Open Questions

- 薄 CLI 长期是否保留(探索倾向保留为调试/CI 面);本需求保留,不做删除决定。
- `cwd` 缺省取 server 进程 cwd 还是要求显式——先取缺省 + 可覆盖,待 host-adapters-mcp 在六宿主实测后回写。
