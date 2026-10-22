# Design: host-adapters-mcp

## Context

引擎 MCP 前端已就绪(`bin/speccode-mcp.mjs`,ndjson stdio,`contract-version` 自报,`package.json` bin 双入口)。host-mapping 六份文档为三段式(安装/工具映射/宿主注意)+ README 总览表(宿主/adapter 入口/映射载体/验证状态),「待验证纪律」成熟(未经真机验证显式标注,核销后回写)。六 adapter 目录为分发配置(仅 CC 有 `.claude-plugin` 双 manifest;其余为 plugin.json/INSTALL.md/扩展骨架)。约束:skill 正文不引用 host-mapping(宿主中立契约);references 自包含;adapter 目录惰性不进打包声明。

## Goals

- 每个宿主的用户文档给出可照抄的 MCP server 注册配置(项目级 + 用户级),验证状态诚实标注。
- lite 锚点段与 MCP 注册的关系清晰:MCP 是引擎的**第二挂载形态**,lite 降级表不受影响(有 MCP = 有引擎,锚点段探测应改?——见 D1)。
- 零臆造:所有未经真机验证的宿主特定形态(工具名前缀、manifest 级声明)一律标「待验证」。

## Non-Goals

- -32002 门禁实现(YAGDA,待宿主实测证据);README/DESIGN 门面(docs-i18n);adapter manifest 结构变更;知识刷新(收尾后 chore);版本 bump;真机验证本身(本变更只产出指引与验证清单,验证是后续人工/实机步骤)。

## Decisions

**D1. MCP 注册是「装引擎」的替代路径,不是 lite 的替代。** 总览表通用步骤第 2 步(装 PATH)扩为二选一:`npm i -g speccode`(PATH 通道,skills 裸调用)或 **MCP 注册通道**(宿主配置 `npx -y speccode-mcp`——无需 PATH,skills 的锚点段探测在 MCP 宿主下……问题:MCP 宿主里 `command -v speccode` 可能为负(PATH 没装)但引擎经 MCP 可达)。**修正锚点段语义的边界情况**:锚点段探测行补一句?不——锚点段是 22 skill 逐字节钉死的,本轮不动它。MCP 通道下 skills 仍裸调 CLI 会失败。**方案**:MCP 注册节的指引明确「MCP 通道需要 PATH 可达(`npm i -g speccode`)或宿主把 MCP 与 PATH 同装;npx 形态适用于宿主内 agent 主动经 tools/call 使用引擎的场景」。即:MCP 注册首先服务**宿主原生 agent 对 tools 的直接使用**(它们自描述可见),skills 的裸调链路仍走 PATH——两条链路并行不互斥,指引各说各话不混淆。被否备选:改锚点段加 MCP 探测(22 处逐字节锚点重新定稿,收益不明确——MCP 宿主里 agent 看到 tools 自然会用,锚点段是 CLI 缺席时的兜底)。

**D2. 文档形态 = 四段式,注册节给「可照抄的最小配置」。** 每宿主一节 `## MCP 注册`:标准 stdio 形态的配置块(json/宿主配置语言各按其形),项目级示例优先(可随 repo 共享),用户级一行带过;`cwd` 缺省语义一句话(server 进程目录 = 宿主拉起时的工作目录,通常即项目根;tools 可传 `cwd` 覆盖);验证状态标注与总览表同口径。不写宿主专属臆造字段——不确定的形态用「待验证」+ 最接近的标准 stdio 形态。

**D3. CC 行为第五宿主样例。** CC 不在六文档之列(主宿主无映射文档),总览表 Claude Code 行补 MCP 注册说明(`claude mcp add speccode -- npx -y speccode-mcp` 或 `.mcp.json`),作为其他宿主配置形态的参考样例。

**D4. 实机验证清单节。** 各文档「宿主注意」追加「MCP 已知开放项」:①initialize 前请求的宿主行为(-32002 门禁是否需要);②origin/HEAD 未设环境对 `default-branch` 的影响(fallback 链已知,宿主容器环境待验);③工具名暴露形态(前缀)。全部标「待真机验证」,核销回写总览表(与既有纪律同构,零新机制)。

**D5. 守卫测试 host-mapping.test.mjs。** 五断言(存在性/内容关键词/总览列/待验证格式/通用步骤 MCP 替代)——文档层守卫与 skill-frontmatter 同族,防回潮。

## Risks

- **宿主配置形态臆造风险** → D2 纪律:标准 stdio 形态 + 待验证标注;总览表 MCP 列本身承载验证状态。
- **MCP 与 lite 锚点的概念混淆** → D1 明确两条链路并行;注册节开头一句「本节与 skill 正文的 lite 降级表正交:MCP 是引擎在场的一种形态」。
- **npx 冷启动**(首拉包慢)→ 注册节提示 `npm i -g speccode` 后用 `speccode-mcp` 直接命令(免 npx 解析)。

## Open Questions

- 无阻塞性问题;真机验证结果决定后续 chore(-32002 等)。
