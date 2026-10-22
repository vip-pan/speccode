# 宿主映射文档总览

speccode 的多宿主支持:每个非 Claude Code 宿主一份四段式映射文档(安装 / MCP 注册 / 工具映射 / 宿主注意)。skill 正文宿主中立(host-neutral-prose 契约),不引用本目录;宿主绑定经本目录详细文档承载(Kimi Code 另经 manifest `skillInstructions` 内嵌摘要)。

| 宿主 | adapter 入口 | 映射载体 | MCP 注册 | 验证状态 |
|---|---|---|---|---|
| Claude Code | `.claude-plugin/`(marketplace) | prose 原生(无需映射);MCP 样例:`claude mcp add speccode -- npx -y -p speccode speccode-mcp`(发布后可用;冒烟验证过的是 stdio 直调形态) | ✅ stdio 冒烟(node bin/speccode-mcp.mjs 直调);npx/npm 形态**待首次发布** | ✅ 主宿主,持续 dogfood |
| Codex | `.codex-plugin/plugin.json` | 本目录 codex.md | ⚠️ 待验证 | ⚠️ 安装命令待验证;multi_agent 机制来自实测调研 |
| Kimi Code | `.kimi-plugin/plugin.json` + `skillInstructions` | manifest 内嵌 + 本目录 kimi-code.md | ⚠️ 待验证 | ⚠️ 范本经 superpowers 实测;本仓装法待验证 |
| ZCode | `.zcode-plugin/plugin.json`(官方六键形态) | 本目录 zcode.md | ⚠️ 待验证 | ⚠️ manifest schema/安装通路/frontmatter 已核销(2026-09-17);仅工具名待验证 |
| OpenCode | `.opencode/INSTALL.md` | 本目录 opencode.md | ⚠️ 待验证 | ⚠️ 注入方式待验证 |
| Pi | `.pi/extensions/speccode.ts` | 本目录 pi.md | ⚠️ 待验证 | ❌ 待验证(扩展 API 假设) |

通用步骤(所有非 CC 宿主):

1. 按各宿主文档安装(插件根 = 本仓库根)。
2. 把 speccode 引擎接入宿主(二选一,可并存):PATH 通道 `npm i -g speccode`(skills 裸调用需要;或本仓检出后 `bash scripts/install-shim.sh`——npm 包待首次发布,shim 为当前唯一可用 PATH 通路)/ MCP 通道——按各文档「MCP 注册」节配置 `npx -y -p speccode speccode-mcp`(宿主原生 agent 的 tools 使用;skills 裸调链路仍需 PATH;npm 形态待首次发布)。
3. `speccode plugin-root --cwd .` 验证。
4. 在目标项目 `/speccode:init`。

待验证项核对完成后:MUST 移除对应「待验证」标注并把结论回写本表。
