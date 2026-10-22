---
tier: 2
---

# Proposal: docs-i18n

## Why

大需求 prose-core-mcp-split 的九个子需求已全部落地,但四份门面文档(README EN/CN、DESIGN EN/CN)仍描述旧世界:DESIGN §5/§9 写着已删除的 config 字段(`trunk`/`remote`/`code_intel_tools`)与已退役的代码智能探测流程(且 cli.test 有守卫**断言** DESIGN 必须含 `code_intel_tools`——文档改了守卫必须同一提交翻转);README 的 Quickstart 示例输出还是 `trunk=main, remote=origin, ...`;整个 lite 降级与 MCP 双通道——本大需求的两大核心交付——在门面上零提及。门面是 marketplace 用户的第一触点,必须与新架构一致。

## What Changes

- **DESIGN.md / DESIGN_CN.md**(结构一一对应,成对改):
  - §5(运行时数据/config):字段集段落改写为标记语义(必填 `version` + `initialized_at`;init 默认写 `pr_tool`/`worktree_dir`;可选 `hooks`/`language`;`trunk`/`remote`/`code_intel_tools` 为历史已删除字段——容忍与忽略,重写时消失;trunk 名经 `default-branch` verb 运行时探测;memory 段(§8)改 worktree 归属叙述)。
  - §9(Code Intelligence Tools):探测/登记流程段改写为「已退役」叙述(会话可见性咨询 + 探测退役;保留 gitignore 三分支的幸存件描述)。
  - §11(Installation & Updates):补 MCP 通道(`npx -y -p speccode speccode-mcp` 待首次发布;shim 与 git 直调为当前可用通路)+ lite 语义一句(无引擎时 SDD 文档流可用,编排引导安装)。
  - §2/架构图与命令表若提及 verb 表位置(bin→lib/verbs.mjs)与 SDD 伴生脚本,按现行架构修订(以实扫为准,不逐条预写)。
- **README.md / README_CN.md**:
  - Install 段:双通道表述(PATH 通道 npm/shim + MCP 通道指引链接 host-mapping;npm 待首次发布标注)。
  - Quickstart 示例输出行 `✓ config ready: trunk=main, remote=origin, pr_tool=gh` → `✓ config ready: pr_tool=gh, worktree_dir=.speccode/worktrees`;`/speccode:init` 注释 `# probe remote/trunk/code intelligence` → `# write the minimal config marker`。
  - Why 段补两条:**lite**(`speccode` 不在 PATH 时 SDD 文档流完整可用——22 个 skill 携带降级表)与 **MCP front**(tools 与 verb 1:1、契约版本自报)。
- **tests/cli.test.mjs 守卫同提交翻转**:「DESIGN 必须含 `code_intel_tools`」→「DESIGN 不得含 `code_intel_tools` 与 `trunk`/`remote` 字段集描述(仅允许出现在『历史已删除字段』列举中——守卫改为断言『历史已删除』短语存在且无 knowledge_tools」;README 措辞守卫(code intelligence 措辞)保持。
- **AGENTS.md 零改动**(已是现行);知识刷新留收尾后 chore。

## Capabilities

- `documentation-facade`(MODIFIED:四文件文档架构分工——门面描述与现行架构一致性约束;README 骨架条目补 lite/MCP 卖点;Quickstart 输出与守卫联动)

## Impact

`README.md`、`README_CN.md`、`docs/DESIGN.md`、`docs/DESIGN_CN.md`、`tests/cli.test.mjs`(守卫翻转)。其余零改动。
