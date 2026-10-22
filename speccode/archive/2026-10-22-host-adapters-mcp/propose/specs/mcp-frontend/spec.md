# mcp-frontend Delta: host-adapters-mcp

## ADDED Requirements

### Requirement: 宿主注册指引

引擎的 MCP 前端 SHALL 以 `references/host-mapping/` 各文档的「MCP 注册」节为宿主接入真源:标准 stdio 形态(全局 `speccode-mcp` / `npx -y -p speccode speccode-mcp`),宿主配置经项目级(可随 repo 共享)或用户级声明;server 的 `cwd` 缺省为宿主拉起时的工作目录,tools 的 `cwd` 参数覆盖之。守卫测试 SHALL 钉死六份文档(五宿主 + 总览)均含 MCP 注册内容与关键词(`speccode-mcp` 形态名、`npx`)。宿主侧实测发现的差异(initialize 前请求、工具名前缀)以「待验证」标注承载,核销回写;引擎 MUST NOT 为未经实测的宿主行为预置代码(如 -32002 门禁)。

#### Scenario: 守卫钉死注册内容
- **WHEN** 运行 `node --test tests/host-mapping.test.mjs`
- **THEN** 六份文档均含「MCP 注册」内容与 `speccode-mcp`、`npx` 关键词;总览表含 MCP 列;待验证标注格式一致

#### Scenario: 引擎零预置
- **WHEN** 审计 `lib/mcp.mjs` 与 `bin/speccode-mcp.mjs`
- **THEN** 不存在 -32002 门禁或任何为特定宿主预置的行为(待实测证据,经后续变更追加)
