---
tier: 1
---

# Proposal: host-neutral-engine

## Why

引擎运行时对宿主身份的记录与感知(`config.host` 字段、`detect-host` verb、code_intel 探测按宿主分流)在定位上已过时:host 的唯一运行时消费点是探测门控一处,却让「装了插件即可用」的多宿主体验背上「宿主身份要先探测、确认、落盘」的间接层。目标定位变更为:任何 coding-agent 安装 speccode 插件即正常使用,运行时宿主无关;本变更同时是后续 npm 引擎分发(独立需求)的先决简化。

## What Changes

- **[BREAKING]** 移除 `detect-host` verb(`bin/speccode.mjs` VERBS 表):未知 verb 按既有契约返回 `{ok:false,error}` + exit 1。
- **[BREAKING]** `detect-code-intel-tools` verb 输出移除 `host` 字段,撤销探测门控:恒全量探测(含 `~/.claude` 信号),不再读取 `config.host`。
- `lib/detect.mjs` 删除 `detectHost()`、`HOST_IDS` 与 env/dir/file 三族宿主标记探测;`claudeProbes` 门控删除。
- config v3 的 `host` 可选字段退役:进入 v3 MUST NOT 字段列表;幂等 init 经字段 diff 剥离既有值(`worktree_prefix` 退役先例,无版本迁移)。
- `skills/init/SKILL.md` 删除「探测宿主」步骤、config 字段说明中的 host 条目、宿主切换注意段。
- 文档同步:`docs/DESIGN.md` / `docs/DESIGN_CN.md`(config 字段集、探测来源门控两行)、`AGENTS.md`、`references/host-mapping/` 各宿主文档中 detect-host / host 标记相关表述。
- **保留不动**:五宿主 adapter 目录与 `references/host-mapping/`(它们是「任何 agent 装了即用」的安装载体,属安装层而非运行时感知层)。

## Capabilities

- `host-detection`(整体退役:两条 requirement 全部 REMOVED)
- `speccode-config-management`(config.json 字段集 MODIFIED)

## Impact

- 引擎:`lib/detect.mjs`、`bin/speccode.mjs`
- 命令层:`skills/init/SKILL.md`
- 测试:`tests/detect.test.mjs`、`tests/cli.test.mjs`
- 文档:`docs/DESIGN.md`、`docs/DESIGN_CN.md`、`AGENTS.md`、`references/host-mapping/*.md`
- 兼容性:既有含 `host` 的 config 照常读取,幂等 init 时剥离;CHANGELOG 于发布时标 BREAKING(CLI verb 移除 + verb 输出形状变化)
