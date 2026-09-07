# tasks: 多国语言支持

> 本清单已由 plan/2026-09-07-i18n-plan.md 接管:实现进度以 plan 的 checkbox 为准,本文件不再勾选,仅作意图索引。

## 1. 引擎与校验(TDD)

- lib/config.mjs 新增 validateLanguage 纯函数(BCP-47 主子标签+子标签格式):先写失败用例(合法 zh/en/zh-CN/ja;非法空串/含空格/含非 ASCII/not_a_tag),再最小实现
- write-config verb 对 language 字段接 validateLanguage:非法 → {ok:false, error} 且不落盘;配套 CLI 测试
- lib/knowledge.mjs buildIndex(entries, heading) 参数化,移除「# 知识索引」硬编码;heading 非法抛错;更新既有单测
- bin write-knowledge mode index 必填 heading(stdin payload),缺失 → {ok:false, error:'mode index requires heading'};配套 CLI 测试
- bin detect-host 用法报错串转英文(--host requires a host id value),更新相关测试断言

## 2. 守卫测试(先失败后绿)

- 新增测试:skills/*/SKILL.md 全目录断言无「全程中文交互」(实现 3.2 前必失败,之后转绿,防回潮)

## 3. 命令层

- skills/init/SKILL.md 增加工作语言询问段:推荐值取自当前对话语言(非环境变量),选项 zh/en/自定义 tag,经确认后 write-config;二次 init 由字段级幂等 diff 自然覆盖
- 24 个 SKILL.md description 改英文门面+统一交互纪律尾(镜像用户语言;无法判断时提问;确认变更 → 提醒 init):替换 14 处「全程中文交互」,补齐其余 10 处;高风险命令行尾附括号中文关键词
- 产工件命令增加语言守护段(proposing / brainstorming / writing-plans / syncing / archiving / distilling-knowledge / recording-knowledge / applying / finishing-worktree):落工件前检测交互语言 ≠ config.language(已登记时)→ 每会话提问一次;确认更换 → 提醒 init;agent 永不临场改 config

## 4. 门面

- .claude-plugin/plugin.json description 转英文
- .claude-plugin/marketplace.json description 转英文

## 5. 收尾核对

- 全仓 grep:「全程中文交互」在 skills/ 与 .claude-plugin/ 零命中(CHANGELOG 历史小节与本需求 delta 文档除外)
- README×2 / DESIGN×2 复核无交互语言表述需同步(探索期已验,收尾复核)
- CHANGELOG.md Unreleased 增补本需求条目(Added / Changed)
- 全量测试 node --test ./tests/*.test.mjs 全绿
