# design: 多国语言支持(语言模型 v4)

## Context

探索(2026-09-06,已承接至 feature/i18n 记忆)确认四层语言模型 v4:交互层镜像用户语言;工件层由 config 显式字段固定;门面层英文;文档层 EN+CN 维持。环境探测(LANG/LC_*)被否决——本机 `en_US.UTF-8` 而用户中文即反例;模型从对话读语言是更强信号。工件语言曾考虑「统一英文」,经用户修正否决:spec 是团队持续维护的活文档,工件语言受众 = 维护者 = 交互者,语言错位即维护税。

现状:14 处 SKILL.md description 硬编码「全程中文交互」;description 兼作自动调用匹配面且为中文;plugin.json / marketplace.json description 为中文;`lib/knowledge.mjs` 的 buildIndex 硬编码「# 知识索引」标题;`bin/speccode.mjs` detect-host 用法报错为中文。

## Goals

- 多国开发者可用:交互任意语言(镜像),工件团队统一语言(config 显式)
- 门面国际化:命令列表与 marketplace 卡片英文
- 零迁移:既有项目(含本仓 dogfood)升级后行为零变化
- lib 语言中立:引擎零语言字符串,语言文本由 prose 层供给

## Non-Goals

- 不做环境探测(语言、locale 均不探测)
- 不做 SKILL.md 正文多语言化(正文是给模型的指令,单语中文保留)
- 不做 README/DESIGN 第三语言扩展(EN+CN 双语维持)
- 不提供 UI 级语言切换(宿主无 per-locale skill 加载机制)
- 本批不引入知识索引标题之外的任何 lib 本地化能力

## Decisions

1. **config.language 自由 tag(BCP-47 主子标签 + 格式校验)** — 否决枚举 `{en, zh}`:language 不驱动 lib 机制分支(host 才需要枚举),枚举只付约束成本、无约束收益;多国愿景要求新增语言零边际。格式校验纯函数 validateLanguage 下沉 lib/config.mjs(确定性逻辑下沉铁律);护栏 = init 询问确认(推断永不静默生效)。
2. **缺失 = 跟随交互语言** — 否决「缺失 = 英文」:会静默翻转既有项目工件语言(本仓 dogfood 中文 spec 首当其冲),撞「迁移不静默」纪律;跟随交互 = 现状行为,升级零变化。
3. **init 推荐值取自对话** — init 流程即交互,模型据用户消息语言给推荐(「看起来你在用中文 → zh?」),经确认写入;否决 LANG/LC_* 来源(信号弱,目标人群系统性失效)。
4. **交互镜像,无静默兜底** — 读不出语言时提问用户(契合 D16 不确定先询问);否决「兜底英文」(那是静默推断)。任何「用户确认语言变更」的时刻 → 提醒 init 重置 config.language;agent 永不临场写 config。
5. **守护在产工件时刻,每会话至多一次** — 提问点 = 命令即将落工件时(与 config.language 产生后果的时刻重合);否决「每轮交互检测」:多国团队「日语成员 + en 工件」是合法常态,每轮问 = 骚扰。答「保持」后会话内不再问。
6. **门面 = 英文** — 24 个 description 主体英文(触发时机语义保留,兼作匹配面),每条携带统一交互纪律尾;plugin.json / marketplace.json description 英文。缓解中文查询匹配弱化:高风险命令 description 行尾附括号中文关键词(如「(创建开发分支)」)。
7. **buildIndex 标题参数化,必填** — `buildIndex(entries, heading)`,write-knowledge mode index 的 stdin payload 必填 `heading`,缺失 → `{ok:false, error}`(与既有 mode 校验同形);否决「lib 提供默认标题」:默认值即语言字符串,破坏 lib 语言中立。
8. **memory 语言跟随交互语言(design 级约定)** — memory 是模型面向的 untracked 草稿,非项目工件;不立 spec、不加机制,由 prose 自然承载。
9. **detect-host 用法报错转英文** — CLI 报错面向模型,工程通用语;非工件、不参与 config.language。

## Risks

- 中文查询的自动调用匹配弱化(description 转英)→ 语义匹配由模型多语能力承担;高风险命令行尾附中文关键词(决策 6)
- 守护打扰 → 每会话至多一次;答「保持」不再问
- 自由 tag 拼写错误 → init 推荐 + 确认兜底;格式校验拦结构性错误;写错影响仅工件语言,重跑 init 即修
- lib 翻译表 creep → 守卫测试禁「全程中文交互」回潮;决策 7 立语言中立先例
- description 英文与正文中文混搭 → 模型侧无碍(正文是指令);门面统一收益大于观感成本

## Open Questions

- 守护段的命令清单在 writing-plans 定稿(候选:proposing / brainstorming / writing-plans / syncing / archiving / distilling-knowledge / recording-knowledge / applying / finishing-worktree)
- description 逐条中文关键词的取舍在 plan 层定
