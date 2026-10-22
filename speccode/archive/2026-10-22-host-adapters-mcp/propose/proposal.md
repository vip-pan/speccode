---
tier: 2
---

# Proposal: host-adapters-mcp

## Why

引擎已有 MCP 前端(`bin/speccode-mcp.mjs`,tools 与 verb 1:1,`npm i -g speccode` 的 bin 双入口),但六个非 CC 宿主的接入路径仍然只教「装 PATH shim + 裸调 CLI」——MCP 这个更标准的挂载面(宿主配置一行拉起、tools 自描述、项目级 `.mcp.json` 可随仓库共享)在 adapter 层完全没有覆盖。这是大需求 prose-core-mcp-split 的收官子需求之一:让每个宿主都能以 MCP 形态挂载引擎。

## What Changes

- **`references/host-mapping/` 六份文档各增「MCP 注册」节**(三段式扩为四段:安装 / **MCP 注册** / 工具映射 / 宿主注意):给出该宿主的 MCP server 配置形态(标准 ndjson-stdio:`npx -y speccode-mcp` 或全局安装后 `speccode-mcp`;项目级配置示例 + 用户级配置示例,`cwd` 缺省 = server 进程目录即项目根);标注该宿主 MCP 支持的验证状态(与既有「待验证纪律」同口径:未经真机验证的配置形态显式标注)。ZCode/Codex/Kimi/OpenCode/Pi 五份 + README 总览表加「MCP 注册」列;Claude Code 行补一行(CC 原生支持 `.mcp.json`/`claude mcp add`,已在 mcp-engine 冒烟验证)。
- **工具映射表增 MCP 行**:各宿主「工具映射」节的「引擎调用」行旁补 MCP 形态(`tools/call <verb>`,写类以 `payload` 参数;`plugin-root` tool 不存在——锚点段兜底);工具名(宿主实际暴露形态,如 ZCode 的 `mcp__speccode__<verb>` 前缀)**未经真机验证的标注待验证**。
- **`-32002` 门禁与 origin/HEAD 覆盖为实机验证清单项**(不入本变更代码):host-mapping 各文档「宿主注意」节加一条「已知开放项」——MCP 客户端在 initialize 前发请求的行为(-32002 Server not initialized)与 `default-branch` 的 origin/HEAD 依赖(浅克隆/脚本环境未设时的 fallback 链)——标注「待真机验证」,结论回写总览表。**本变更不实现 -32002 门禁**(YAGNI:无宿主实测证据前不加码;若有宿主实测报错,开后续 chore 加 5 行门禁)。
- **AGENTS.md**:六宿主 adapter 段一句话更新(adapter 职责扩为「注册 skills + 注册 MCP server」——与 mcp-engine 的 D 结论合流)。
- **README/DESIGN 门面不动**(docs-i18n 统一重写安装故事,本变更只动 references/ 与 adapter 配置层)。
- **无 adapter manifest 结构变更**(`.zcode-plugin/plugin.json` 等不动——MCP 注册是宿主侧用户配置,不是插件声明;若某宿主实测发现可经 manifest 声明 MCP,记「待验证」并回写,不在本变更臆造)。
- **测试**:host-mapping 文档为 references 层(不承载交互逻辑),新增守卫 `tests/host-mapping.test.mjs`:①六份文档均有 `## MCP 注册` 节;②各节含 `speccode-mcp` 与 `npx` 字样;③总览表含 MCP 列;④「待验证」标注格式与既有纪律一致(`**待验证**`);⑤README 通用步骤第 2 步补 MCP 替代(`npx -y speccode-mcp` 免 PATH)。

## Capabilities

- `host-adapters`(MODIFIED:六宿主 adapter 与分发面——MCP 注册段、总览表 MCP 列、通用步骤 MCP 替代)
- `mcp-frontend`(ADDED requirement:补「宿主注册指引」requirement——server 拉起形态/cwd 语义/验证状态标注,引用 host-mapping 为真源)

## Impact

`references/host-mapping/{README,codex,kimi-code,zcode,opencode,pi}.md`、`tests/host-mapping.test.mjs`(新)、`AGENTS.md`(一句)。引擎零改动;adapter manifest 零改动;skills/ 零改动。
