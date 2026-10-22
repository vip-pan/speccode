# ZCode 宿主映射

> **验证状态**:manifest schema 与安装通路已核销(2026-09-17);仅**工具名**仍待验证(见工具映射表)。
>
> **已核销 ①:SKILL.md frontmatter 要求(来源:官方 zcode-guide 插件文档)**——`name` 必填(frontmatter 存在而 `name` 缺失时该 skill 被整个丢弃;完全无 frontmatter 时 `name` 回落目录名但 description 为空,难以触发);识别键仅 `name`/`description`/`when_to_use`/`license`/`metadata` 五枚;`description` 超 1024 字符同样丢弃;调用 = `name` 或 `plugin:skill` 限定名。speccode 全部 skill 已按 `name` == 目录名 落字段(守卫测试 `tests/skill-frontmatter.test.mjs` 钉死)。
>
> **已核销 ②:manifest schema(来源:官方文档 + 11 个官方插件全样本)**——最小要求仅 `name`;组件字段 `commands`/`skills`/`hooks`/`mcpServers`/`agents`(可为目录名/数组/内联);官方键集恒为 `name`/`version`/`description`/`author`/`license`(+组件);`skillInstructions` 为 Kimi 专属,ZCode 不识别。`.zcode-plugin/plugin.json` 已对齐官方六键形态(`skills: "skills"`,`version` 与 `.claude-plugin/plugin.json` 同步 bump,守卫测试 `tests/zcode-adapter.test.mjs` 钉死);工具映射语义由本文「工具映射」段承载。兼容提示:ZCode 也识别 `.claude-plugin/`、`.codex-plugin/` 目录名。
>
> **已核销 ③:安装通路(本机实证)**——marketplace 安装可用:添加 marketplace `vip-pan/speccode` 后安装 plugin `speccode`,缓存落 `~/.zcode/cli/plugins/cache/speccode/speccode/<version>/`,`enabledPlugins` 登记 `speccode@speccode`。此前实测版本显示 0.0.0,即 manifest 缺 `version` 的直接后果,对齐后恢复。

## 安装

1. ZCode:添加 marketplace `vip-pan/speccode`,安装 plugin `speccode`(marketplace 通路本机实证可用;在插件管理界面操作)。
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

| speccode 语义 | ZCode 落地(待验证) |
|---|---|
| 向用户提问(一次一问、给选项) | 结构化提问工具(若有);否则文本提问,保持一次一问与选项格式 |
| 派发子代理 | ZCode 的 agent/子代理机制(**待验证** 工具名);无子代理机制时走 skill 声明的降级路由 |
| 引擎调用 `speccode <verb> --cwd .` | PATH shim;缺 shim 时 `node <plugin-root>/bin/speccode.mjs <verb> --cwd .` |
| 引擎调用(MCP 形态) | tools/call <verb>(写类以 payload 参数;plugin-root tool 不存在,经 CLI 或 skill 目录兜底) |
| 插件内文件引用 | `speccode plugin-root --cwd .` 解析 |

## 宿主注意

- `.zcode-plugin/plugin.json` 已对齐官方形态,不含工具映射;工具映射的唯一载体是本文件「工具映射」段,工具名核对后只改这里。
- ZCode 为 GLM 自研;manifest schema、安装通路、skill frontmatter 的核销结论见页首「验证状态」块。
- 工具名核销后:移除工具映射表的「待验证」标注(引擎已宿主中立,无宿主标记可回写)。

### MCP 已知开放项(待真机验证)

- 宿主在 `initialize` 前发请求的行为(-32002 门禁是否需要):**待验证**
- `default-branch` 的 origin/HEAD 依赖(浅克隆/脚本环境 fallback 链):**待验证**
- 工具名暴露形态(如 `mcp__speccode__<verb>` 前缀):**待验证**
