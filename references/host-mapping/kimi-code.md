# Kimi Code 宿主映射

> 安装与工具映射来自探索期对 obra/superpowers Kimi 适配的实测调研(plugin.json `skillInstructions` 已内嵌同款映射)。

## 安装

1. Kimi Code:`/plugins install https://github.com/vip-pan/speccode`(待验证:仓库直装命令以 Kimi Code 官方文档为准)。
2. 安装引擎 shim:

   ```bash
   bash scripts/install-shim.sh
   ```

3. 验证:`speccode plugin-root --cwd .` 输出本插件根绝对路径。

## MCP 注册

本节与 skill 正文的 lite 降级表正交:MCP 是引擎在场的一种形态——宿主原生 agent 经 MCP tools 直接使用引擎(tools 自描述、与 CLI verb 1:1 同名),skills 的裸调链路仍走 PATH,两条链路并行不互斥。

- **拉起命令**:已 `npm i -g speccode` 时直接 `speccode-mcp`(推荐,免 npx 冷启动);未安装时 `npx -y -p speccode speccode-mcp`(首拉较慢)。

npm 包 `speccode` 当前**待首次发布**(`v*` tag CI 自动发布);发布前两种拉起形态均不可用,可先 `git clone` 本仓后以 `node <repo>/bin/speccode-mcp.mjs` 直调验证。
- **项目级配置**(可随 repo 共享;宿主 MCP 配置入口,**待验证**(以下为标准 stdio 形态参考);npm 形态待首次发布):

```json
{
  "mcpServers": {
    "speccode": { "command": "npx", "args": ["-y", "-p", "speccode", "speccode-mcp"] }
  }
}
```

- **`cwd` 语义**:省略时 = 宿主拉起 server 的工作目录(通常即项目根);tools 的 `cwd` 参数可逐调用覆盖。

## 工具映射

| speccode 语义 | Kimi Code 落地 |
|---|---|
| 向用户提问(一次一问、给选项) | `AskUserQuestion` 工具(不可用或 auto 模式时回落文本) |
| 派发子代理(implementer / reviewer / explorer) | `Agent` 工具(按宿主子代理类型;依赖子代理的 skill 自带降级路由) |
| 引擎调用 `speccode <verb> --cwd .` | PATH shim;缺 shim 时 `node <plugin-root>/bin/speccode.mjs <verb> --cwd .` |
| 引擎调用(MCP 形态) | tools/call <verb>(写类以 payload 参数;plugin-root tool 不存在,经 CLI 或 skill 目录兜底) |
| 插件内文件引用 | `speccode plugin-root --cwd .` 解析 |

## 宿主注意

- `skillInstructions`(见 `.kimi-plugin/plugin.json`)是运行时注入的映射摘要,与本文件保持一致;改动映射 MUST 两处同步。
- Kimi Code 原生支持 SKILL.md(Agent Skills 标准),skills 直接懒加载,无需兼容层。
- 文件/搜索/网络工具用宿主实际暴露名调用。

### MCP 已知开放项(待真机验证)

- 宿主在 `initialize` 前发请求的行为(-32002 门禁是否需要):**待验证**
- `default-branch` 的 origin/HEAD 依赖(浅克隆/脚本环境 fallback 链):**待验证**
- 工具名暴露形态(如 `mcp__speccode__<verb>` 前缀):**待验证**
