# OpenCode 宿主映射

> 待验证:OpenCode 的 plugin 机制为 JS 插件体系,skills 注册方式随版本演进;以下以探索期实测信息为准。

## 安装

1. 在项目或全局 `opencode.json` 的 `plugin` 数组加入本仓库(见 [`.opencode/INSTALL.md`](../../.opencode/INSTALL.md);待验证:git 插件引用格式)。
2. 安装引擎 shim:

   ```bash
   bash scripts/install-shim.sh
   ```

3. 验证:`speccode plugin-root --cwd .` 输出本插件根绝对路径。

## MCP 注册

本节与 skill 正文的 lite 降级表正交:MCP 是引擎在场的一种形态——宿主原生 agent 经 MCP tools 直接使用引擎(tools 自描述、与 CLI verb 1:1 同名),skills 的裸调链路仍走 PATH,两条链路并行不互斥。

- **拉起命令**:已 `npm i -g speccode` 时直接 `speccode-mcp`(推荐,免 npx 冷启动);未安装时 `npx -y -p speccode speccode-mcp`(首拉较慢)。

npm 包 `speccode` 当前**待首次发布**(`v*` tag CI 自动发布);发布前两种拉起形态均不可用,可先 `git clone` 本仓后以 `node <repo>/bin/speccode-mcp.mjs` 直调验证。
- **项目级配置**(可随 repo 共享;`opencode.json` 的 `mcp` 段,**待验证**;npm 形态待首次发布):

```json
{
  "mcpServers": {
    "speccode": { "command": "npx", "args": ["-y", "-p", "speccode", "speccode-mcp"] }
  }
}
```

- **`cwd` 语义**:省略时 = 宿主拉起 server 的工作目录(通常即项目根);tools 的 `cwd` 参数可逐调用覆盖。

## 工具映射

| speccode 语义 | OpenCode 落地 |
|---|---|
| 向用户提问(一次一问、给选项) | 结构化提问工具(待验证:是否有 AskUserQuestion 等价物);否则文本提问 |
| 派发子代理 | OpenCode 的 agent 体系(待验证:subagent 模式与调用名);无子代理时走 skill 声明的降级路由 |
| 引擎调用 `speccode <verb> --cwd .` | PATH shim;缺 shim 时 `node <plugin-root>/bin/speccode.mjs <verb> --cwd .` |
| 引擎调用(MCP 形态) | tools/call <verb>(写类以 payload 参数;plugin-root tool 不存在,经 CLI 或 skill 目录兜底) |
| 插件内文件引用 | `speccode plugin-root --cwd .` 解析 |

## 宿主注意

- OpenCode 插件是 JS 模块(非纯 manifest),speccode 的 skills 注册依赖宿主的 skills 发现机制(**待验证**);若需 JS glue,参考 `.pi/extensions/speccode.ts` 的骨架思路另写 opencode 侧(保持待验证标注)。
- 仓库根的 `opencode.json`(codemap MCP 配置)是 speccode 仓库**开发者本地**的配置(已被 .gitignore,不在安装产物里),与用户侧安装无关,勿混淆。

### MCP 已知开放项(待真机验证)

- 宿主在 `initialize` 前发请求的行为(-32002 门禁是否需要):**待验证**
- `default-branch` 的 origin/HEAD 依赖(浅克隆/脚本环境 fallback 链):**待验证**
- 工具名暴露形态(如 `mcp__speccode__<verb>` 前缀):**待验证**
