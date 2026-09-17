# Design: zcode-plugin-manifest

## Context

- 官方文档(zcode-guide:zcode-configuration-guide):manifest 最小要求仅 `name`;组件字段 `commands`/`skills`/`hooks`/`mcpServers`/`agents`(可为目录名/数组/内联);兼容识别 `.claude-plugin/`、`.codex-plugin/` 目录名;未识别字段「recorded but not executed」( tolerated,不生效)。
- 官方全样本(11 manifest):键集恒含 `name`+`version`+`description`+`author{name}`+`license`+`skills:"skills"`;`skillInstructions` 零出现。
- 本机实证:`~/.zcode/cli/config.json` 的 `enabledPlugins` 含 `speccode@speccode: true`(marketplace 安装通路实测可用);缓存副本版本 0.0.0(缺 `version` 所致)。
- 现 manifest:多出 `homepage`/`repository`/`keywords`/`_note`/`skillInstructions`,缺 `version`,`skills` 值带 `./` 前缀。

## Goals

- ZCode 插件列表显示真实版本,更新检测恢复语义
- manifest 与官方形态一致,消除「Kimi 假设」残留
- 版本双 manifest 同步由 CI 钉死,不靠人工记性

## Non-Goals

- 不动 `.kimi-plugin/plugin.json`(`skillInstructions` 是 Kimi 的合法字段)
- 不为 ZCode 增加 `mcpServers`/`commands`/`userConfig` 等组件(speccode 无此需要)
- 不处理 OpenCode/Pi 的待验证项(各有独立核销路径)

## Decisions

1. **键集收敛到官方形态(六键),而非仅补 `version`。** 理由:核销的目的就是消除假设——官方样本零出现的键留着即持续误导「这些是 ZCode 认的」;未识别字段 tolerated 但不生效,留着是死重。`skillInstructions` 里的工具映射语义已由 `references/host-mapping/zcode.md` 工具映射段承载(宿主上的 agent 经 plugin-root 读取),移除零损失。被否备选:仅补 `version` 最小修——版本显示修了,但「待验证」假设残留,核销不彻底。
2. **`skills` 值改官方写法 `"skills"`。** 理由:官方全样本一致;官方文档明言组件字段「可为目录名」。`"./skills/"` 虽与 CC 同形,但 ZCode 侧无实证其解析,选实证形态。被否备选:保留 `"./skills/"`——省一行但延续未核销形态。
3. **version 同步用守卫测试钉死(双 manifest 相等断言)。** 理由:发布纪律新增一条同步义务,人工记性必丢;测试红→绿驱动本次对齐。CHANGELOG 三方一致不进测试(最新小节解析引入脆性),以 spec 纪律约束。

## Risks

- ZCode 对未识别字段虽 documented 为 tolerated,但移除字段理论上零风险(少即安全);风险在「version 语义是否参与更新检测」——官方样本全带 version,按官方形态走即可,若更新检测另有机制,形态对齐也不会更差。
- `skills: "skills"` 相对 `"./skills/"` 是路径语义变化:若 ZCode 实际两者都接受则无感;若只接受其一,官方写法是全样本实证的安全侧。

## Open Questions

- 无(本变更范围内)。
