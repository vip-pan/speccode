# Pi 宿主映射

> 待验证:Pi 的扩展 API 与 skills 发现机制未经真机验证(探索期调研:Pi 有原生 skills,`.pi/extensions/*.ts` 为扩展入口)。

## 安装

1. Pi:`pi install git:github.com/vip-pan/speccode`(**待验证**:安装语法以官方文档为准)。扩展骨架见 [`.pi/extensions/speccode.ts`](../../.pi/extensions/speccode.ts)。
2. 安装引擎 shim:

   ```bash
   bash scripts/install-shim.sh
   ```

3. 验证:`speccode plugin-root --cwd .` 输出本插件根绝对路径。

## MCP 注册

本节与 skill 正文的 lite 降级表正交:MCP 是引擎在场的一种形态——宿主原生 agent 经 MCP tools 直接使用引擎(tools 自描述、与 CLI verb 1:1 同名),skills 的裸调链路仍走 PATH,两条链路并行不互斥。

- **拉起命令**:已 `npm i -g speccode` 时直接 `speccode-mcp`(推荐,免 npx 冷启动);未安装时 `npx -y -p speccode speccode-mcp`(首拉较慢)。

npm 包 `speccode` 当前**待首次发布**(`v*` tag CI 自动发布);发布前两种拉起形态均不可用,可先 `git clone` 本仓后以 `node <repo>/bin/speccode-mcp.mjs` 直调验证。
- **项目级配置**(可随 repo 共享;扩展内启动子进程,**待验证**;npm 形态待首次发布):

```json
{
  "mcpServers": {
    "speccode": { "command": "npx", "args": ["-y", "-p", "speccode", "speccode-mcp"] }
  }
}
```

- **`cwd` 语义**:省略时 = 宿主拉起 server 的工作目录(通常即项目根);tools 的 `cwd` 参数可逐调用覆盖。

## 工具映射

| speccode 语义 | Pi 落地 |
|---|---|
| 向用户提问(一次一问、给选项) | 文本提问(待验证:是否有结构化提问工具) |
| 派发子代理 | 待验证(Pi 无原生 Task 等价物时,走 skill 声明的降级路由) |
| 引擎调用 `speccode <verb> --cwd .` | PATH shim;缺 shim 时 `node <plugin-root>/bin/speccode.mjs <verb> --cwd .` |
| 引擎调用(MCP 形态) | tools/call <verb>(写类以 payload 参数;plugin-root tool 不存在,经 CLI 或 skill 目录兜底) |
| 插件内文件引用 | `speccode plugin-root --cwd .` 解析 |

## 宿主注意

- Pi 有原生 skills(探索期调研:无需兼容性 Skill 工具),扩展主要负责注册与宿主注意提示;若宿主自动发现 `skills/`,扩展骨架可只承载提示逻辑。
- 扩展 API 核对后更新 `.pi/extensions/speccode.ts` 并移除「待验证」标注。

### MCP 已知开放项(待真机验证)

- 宿主在 `initialize` 前发请求的行为(-32002 门禁是否需要):**待验证**
- `default-branch` 的 origin/HEAD 依赖(浅克隆/脚本环境 fallback 链):**待验证**
- 工具名暴露形态(如 `mcp__speccode__<verb>` 前缀):**待验证**
