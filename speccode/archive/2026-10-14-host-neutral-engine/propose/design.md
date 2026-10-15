# Design: host-neutral-engine

## Context

host 感知链路现状:`init` 经 `detect-host`(env/dir/file 三族标记启发)探测宿主并经用户确认写入 `config.host`;`detect-code-intel-tools` 读 `config.host` 做探测门控(非 claude-code 宿主跳过 `~/.claude` 专属信号)——这是 host 在运行时的**唯一**消费点。宿主身份的其余用途(工具名映射、安装差异)都在 `references/host-mapping/` 文档与 adapter 层,不在引擎。

探索结论(2026-10-14,记忆 `refactor/host-neutral-engine`):zcode 插件机制无 bin/PATH 等价物导致引擎可达性问题;agent-skills 与 superpowers 均为纯 prose skill、运行时零宿主感知,故「安装=文件放置」在任何宿主完整。speccode 的方向:① 本变更去除运行时宿主感知;② 后续独立需求走 npm 分发解决引擎可达性。

## Goals

- 引擎运行时不再探测、记录、读取宿主身份;任何宿主行为完全一致。
- `detect-code-intel-tools` 恒全量探测,结果仍经用户确认登记,skill 层对工具不可用的硬性降级(MUST NOT 报错)继续兜底。
- 既有含 `host` 的 config 平滑退役:读不报错,幂等 init 剥离。
- spec 主档同步:host-detection 能力退役,config 字段集更新。

## Non-Goals

- npm 引擎分发(package.json bin / npm publish)——独立需求 B,本变更之后另行立项。
- zcode hooks 接线实验(`.zcode-plugin/plugin.json` 加 hooks 声明验证 `${CLAUDE_PLUGIN_ROOT}` 替换)——独立小需求,与运行时宿主无关化正交。
- 五宿主 adapter 与 references/host-mapping/ 的任何结构性改动(仅同步表述)。
- 知识集(development/*)的蒸馏刷新——按既有纪律由独立 chore/knowledge-* 分支在合并后处理。

## Decisions

1. **整 capability 退役,而非留空壳**:host-detection 的两条 requirement(宿主身份探测、code_intel 探测按宿主分流)全部 REMOVED。被否备选:把「恒全量探测」改写进 host-detection 保留 capability——探测行为的主规格本就在 code-intel-tool-integration(其 requirement 正文本就无 host 字样),留一条仅描述「无宿主」的 requirement 是空壳。宿主中立是**缺失**(absence),不需要规格来规定缺失。
2. **恒全量探测,而非反转门控或按可用性探测**:被否备选①保留 host 记录但反转门控(永远开)——保留了无消费点的状态,违背本变更目的;被否备选②探测时探测「当前会话实际可用的 MCP 工具」——超出引擎能力(verb 运行在 shell,看不见宿主会话),且 skill 层已有运行时降级。
3. **host 进 v3 MUST NOT 列表 + 幂等 init 字段 diff 剥离,而非 bump v4**:与 `worktree_prefix` 退役同构,无版本迁移成本;拒绝升级则整体保持旧版,不存在混合态。
4. **`detect-code-intel-tools` 输出删 host 字段**:该字段唯一用途是回显门控输入;门控删除后回显成为无消费点的残留。输出形状变化在 CHANGELOG 标 BREAKING。

## Risks

- **多宿主机器探测到跨宿主信号**(如 zcode 会话内探到 `~/.claude` 的 MCP 登记)→ 缓解:探测结果本就经 init 用户确认才落盘,且 skill 层对 `code_intel_tools` 中工具不可用有硬性降级(不报错、回退基础工具);行为与 host 字段缺失时的既有全量探测分支完全一致,非新增语义。
- **外部脚本消费 `detect-host` verb** → 缓解:CHANGELOG 发布时 BREAKING 标注;speccode 的 verb 契约消费者是命令层 prose,仓内同步更新。
- **文档残留**(host 表述散落双语四版)→ 缓解:tasks 逐文件枚举 + 全仓 grep `detect-host\|config\.host` 清零验收(历史性提及 CHANGELOG/archive 豁免)。

## Open Questions

无。
