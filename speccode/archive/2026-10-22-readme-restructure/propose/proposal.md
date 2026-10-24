---
tier: 2
---

# Proposal: readme-restructure

## Why

docs-i18n 已让 README 双语**内容准确**,但叙事结构仍是旧世界:定位句还是「CC 主宿主 + 五宿主适配」,大需求最强的两条差异化(lite 无引擎可用、MCP 前端)埋在 Why 第 4/5 条,第一屏看不到;Install 段 CC marketplace 命令在前、lite/双通道挤在段尾,与「装了插件就能跑」的新体验不匹配;对比表缺 lite/MCP 两行恰是最难被抄的;demo GIF 的 init 输出还是「trunk=main | remote=origin」旧世界(tape 源文件可一条命令重录)。

## What Changes

- **定位句(第一屏)**:从「CC 主宿主 + 适配」改为新身份——「a pure-prose plugin core with a mountable engine」:插件装上就能跑(lite 文档流零引擎依赖),编排能力按需挂载(PATH 或 MCP)。lite 一句进第一屏。
- **Install 段重排为三段递进**:① 安装插件(各宿主入口,CC marketplace 命令);② **就这么用**——文档流立即可用(lite;无需任何引擎安装);③ **需要并行编排时加引擎**——PATH 通道(npm 待首发;shim 现行)或 MCP 通道(按宿主注册)。旧「Other coding agents?」长段并入 ③。
- **对比表加两行**:「Works without its engine (lite document flow)」✅(对手全部 —)、「Engine as MCP server (1:1 tools + contract version)」✅(对手 —)。
- **demo.tape d1 fixture + README 文字稿**:init 输出行改标记语义(`✓ config ready: pr_tool=gh, worktree_dir=.speccode/worktrees`——与 README 现行文字稿一致);README 的 console 块同步;GIF 经 `vhs docs/assets/demo.tape` 重录(若本机 vhs 缺失:改 tape 源与文字稿,GIF 重录标注为后续,README caption 不变)。
- **Quickstart**:第 2 与第 3 步之间加一句 lite 体感:「(No engine install needed for the document flow — orchestration commands will guide you when they need one.)」。
- **双语成对**、段落数不变(15/15),全部改动 EN/CN 同提交。

## Capabilities

- `documentation-facade`(MODIFIED:四文件文档架构分工——README 骨架条款的定位句/Install 结构描述按新叙事更新;骨架以实扫为准的措辞不变)

## Impact

`README.md`、`README_CN.md`、`docs/assets/demo.tape`(d1 fixture)、`docs/assets/demo.gif`(重录产物,若 vhs 在场)、`tests/cli.test.mjs`(README 措辞守卫零改——code intelligence 措辞保留在新定位句中)。零引擎/skills 改动。
