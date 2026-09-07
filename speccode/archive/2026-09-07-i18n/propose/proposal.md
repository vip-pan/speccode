---
tier: 2
---

# proposal: 多国语言支持(语言模型 v4)

## Why

speccode 的命令交互被 14 处「全程中文交互」硬规则钉死为中文,门面(plugin.json / marketplace.json / 24 个 description)也是中文——非中文开发者无法正常使用;工件语言同时无显式契约,团队文档语言不受控。多国开发者需要:交互用自己的语言、工件用团队统一语言、门面与国际文档用英语。

## What Changes

- config v3 新增可选字段 `language`(BCP-47 自由 tag,格式校验):工件语言的唯一显式真源;缺失 = 跟随交互语言(现状行为,零迁移)
- init 新增工作语言询问:推荐值取自当前对话语言(非环境变量),经用户确认写入;二次 init 走既有字段级幂等 diff
- 交互语言纪律:24 个 SKILL.md description 改英文门面并统一携带交互纪律行(镜像用户语言;无法判断时提问;用户确认语言变更 → 提醒 init 重置),移除 14 处「全程中文交互」硬规则
- 工件语言守护:产工件命令在落工件前检测交互语言与 config.language 不一致 → 每会话提问一次;agent 永不临场改 config
- 门面转英:`.claude-plugin/plugin.json` 与 `marketplace.json` 的 description 改英文
- lib 语言中立:`buildIndex` 索引标题参数化(write-knowledge mode index 必填 `heading`,lib 不内嵌任何语言字符串);`detect-host` 用法报错串转英文
- 守卫:新增 grep 测试禁「全程中文交互」回潮

无 BREAKING:新字段可选,缺失行为与现状一致;既有用户(含本仓 dogfood)升级零静默变更。

## Capabilities

- speccode-config-management(language 字段:字段集 MODIFIED + 校验与登记 ADDED)
- plugin-packaging(skill frontmatter 契约 MODIFIED:门面语言与交互语言纪律)
- sdd-document-lifecycle(工件语言与语言守护 ADDED)
- knowledge-set(知识集目录结构 MODIFIED:索引标题参数化,lib 语言中立)

## Impact

- 引擎:`lib/config.mjs`(validateLanguage)、`lib/knowledge.mjs`(buildIndex 签名)、`bin/speccode.mjs`(mode index heading 透传、detect-host 报错串)
- 命令层:24 个 `skills/*/SKILL.md` description;产工件命令守护段;`skills/init/SKILL.md` 语言询问
- 门面:`.claude-plugin/plugin.json`、`.claude-plugin/marketplace.json`
- 测试:`tests/`(validateLanguage、buildIndex heading、index verb、语言守卫)
- 文档:CHANGELOG Unreleased;README×4 经 grep 确认无交互语言表述,不需同步
