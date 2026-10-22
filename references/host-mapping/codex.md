# Codex 宿主映射

> 待验证项以行内标注;其余内容来自探索期对 obra/superpowers Codex 适配的实测调研(spawn_agent / fork_turns / wait_agent 事件语义 / 模型 allowlist 为实测所得)。本 adapter 的 manifest 形态同样以 superpowers 的 Codex adapter 为范本(其安装链路未在本仓真机验证)。

## 安装

1. Codex CLI / Codex App:`/plugins` 搜索 `speccode` 安装,或按官方 plugin 安装流程指向本仓库(待验证:是否已进入官方 plugin 目录)。
2. 安装引擎 shim(让 `speccode <verb>` 进入 PATH):

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

| speccode 语义 | Codex 落地 |
|---|---|
| 向用户提问(一次一问、给选项) | 文本提问(Codex 无结构化提问工具);保持一次一问与选项格式 |
| 派发子代理(implementer / reviewer / explorer) | multi_agent:`spawn_agent` / `wait_agent` / `followup_task`(待验证:`followup_task` 来自同源调研,未在本仓实测) |
| 引擎调用 `speccode <verb> --cwd .` | PATH shim(上步);缺 shim 时 `node <plugin-root>/bin/speccode.mjs <verb> --cwd .` |
| 引擎调用(MCP 形态) | tools/call <verb>(写类以 payload 参数;plugin-root tool 不存在,经 CLI 或 skill 目录兜底) |
| 插件内文件引用 | `speccode plugin-root --cwd .` 解析 |

## 宿主注意

- **子代理需开启 feature**:在 `~/.codex/config.toml` 加 `[features] multi_agent = true`(待验证:flag 名随 Codex 版本演进;以 `codex` 实际工具列表为准)。未开启时,依赖子代理的 skill 按其声明的降级路由串行执行。
- `spawn_agent` 建议 `fork_turns: "none"`(隔离上下文,而非全量复制会话)。
- `wait_agent` 是事件订阅不是轮询:有本地工作时不要空等;空闲等待用 5-10 分钟的有界时段。
- 模型名不要从文档/旧会话复制进 `spawn_agent`,先对照当前 preset 的 spawn allowlist。

### MCP 已知开放项(待真机验证)

- 宿主在 `initialize` 前发请求的行为(-32002 门禁是否需要):**待验证**
- `default-branch` 的 origin/HEAD 依赖(浅克隆/脚本环境 fallback 链):**待验证**
- 工具名暴露形态(如 `mcp__speccode__<verb>` 前缀):**待验证**
