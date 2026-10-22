# Tasks: host-adapters-mcp

> 本清单已由 plan/2026-10-22-host-adapters-mcp-plan.md 接管:实现进度以 plan 的 checkbox 为准,本文件不再勾选,仅作意图索引。

## A. host-mapping 六文档

- A1 五份宿主文档各插「## MCP 注册」节(安装后、工具映射前):标准 stdio 配置块(npx -y speccode-mcp / 全局 speccode-mcp)、项目级示例优先、cwd 语义、与 lite 降级表正交一句;「宿主注意」尾追加「MCP 已知开放项」三条(-32002 / origin-HEAD / 工具名前缀,全部待验证)
- A2 README.md:总览表加 MCP 注册列(六行验证状态);CC 行补 MCP 说明(claude mcp add / .mcp.json,已冒烟);通用步骤第 2 步扩双通道 + 并行不互斥说明
- A3 工具映射表增 MCP 行(tools/call <verb>、payload 参数、plugin-root tool 不存在)

## B. 守卫与文档

- B1 `tests/host-mapping.test.mjs` 五守卫先行(RED → GREEN)
- B2 AGENTS.md adapter 段一句更新(职责 = 注册 skills + 注册 MCP server)
- B3 CHANGELOG `[Unreleased]` Added 条目;全量测试;grep 校验(skills/ 零 host-mapping 引用不变)
