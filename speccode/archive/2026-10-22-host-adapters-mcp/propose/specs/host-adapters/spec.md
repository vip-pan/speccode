# host-adapters Delta: host-adapters-mcp

## MODIFIED Requirements

### Requirement: 宿主映射文档

`references/host-mapping/` SHALL 为五个非 Claude Code 宿主各提供一份文档(`<host>.md`:codex、kimi-code、zcode、opencode、pi),每份 SHALL 含四段:安装方式、**MCP 注册**、工具映射(提问/子代理/任务清单等语义到宿主工具的绑定)、宿主特有注意(如 Codex 的 multi_agent 子代理机制);skill 正文 MUST NOT 引用这些文档(host-neutral-prose 契约——由 adapter 与宿主上的 agent 按需读取)。

「MCP 注册」节 SHALL 提供:该宿主的 MCP server 配置形态(标准 stdio;已 `npm i -g speccode` 时 `speccode-mcp` 直接命令,未安装时 `npx -y -p speccode speccode-mcp`——提示 npx 冷启动较慢);项目级配置示例;`cwd` 缺省语义(server 进程工作目录,通常即项目根;tools 的 `cwd` 参数可覆盖);节首一句「本节与 skill 正文的 lite 降级表正交——MCP 是引擎在场的一种形态」。拉起形态以全局安装为先、`npx -y -p speccode speccode-mcp` 为免安装替代,npm 包 `speccode` 待首次发布(发布前可 `git clone` 本仓后以 `node <repo>/bin/speccode-mcp.mjs` 直调验证)。凡未经真机验证的宿主配置形态或工具名暴露形态,MUST 显式标注「待验证」(与既有纪律同口径);各文档「宿主注意」段 SHALL 追加「MCP 已知开放项」清单(initialize 前请求行为/-32002、origin/HEAD 未设环境对 default-branch 的影响、工具名前缀形态),核销后回写总览表。

`README.md` 总览 SHALL 增「MCP 注册」列(验证状态);Claude Code 行补 MCP 注册说明(`claude mcp add speccode -- npx -y -p speccode speccode-mcp`(发布后可用)或项目 `.mcp.json`;冒烟验证过的是 stdio 直调形态)作为标准 stdio 形态参考样例;通用步骤第 2 步 SHALL 扩为二选一(PATH 通道 `npm i -g speccode` 或本仓检出 `bash scripts/install-shim.sh` / MCP 通道 `npx -y -p speccode speccode-mcp`)并说明两条链路并行不互斥(MCP 服务宿主原生 agent 的 tools 直接使用;skills 裸调链路仍走 PATH)。

#### Scenario: 五份映射文档结构齐备
- **WHEN** 检查 `references/host-mapping/`
- **THEN** 存在 codex.md、kimi-code.md、zcode.md、opencode.md、pi.md,各含安装/MCP 注册/工具映射/宿主注意四段

#### Scenario: MCP 注册节可照抄
- **WHEN** 任取一份宿主文档的「MCP 注册」节
- **THEN** 含 `npx -y -p speccode speccode-mcp`(或全局 `speccode-mcp`)的项目级配置示例与 cwd 语义说明;未经真机验证的形态带「待验证」标注

#### Scenario: 总览表与通用步骤
- **WHEN** 检查 `references/host-mapping/README.md`
- **THEN** 总览表含 MCP 注册列;通用步骤第 2 步给出 PATH 与 MCP 两条通道及并行说明

#### Scenario: skills 不内联宿主细节
- **WHEN** 检索 `skills/*/SKILL.md`
- **THEN** 无对 `references/host-mapping/` 的引用(宿主绑定经 manifest skillInstructions 或宿主 agent 按需读取映射文档)
