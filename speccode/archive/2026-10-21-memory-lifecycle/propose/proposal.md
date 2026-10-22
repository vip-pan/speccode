---
tier: 2
---

# Proposal: memory-lifecycle

## Why

memory 目前锚在主仓(`memoryPath(speccodeDir, branch)`),同 feature 跨 worktree 共享一份——这是当初「跨会话连续性」的选择,但代价是:记忆的生命周期与开发分支脱钩(finishing 后残留在主仓,靠人记得 purge)、主仓目录随时间堆积已完成分支的孤儿记忆。用户设计(大需求点 5):**记忆归属变更 worktree,随本轮开发生灭**——`[建 worktree → move 记忆]` 一个事务,finishing 清理;探索记忆临时落主仓,承接时移走,主干不留痕。定位变更:memory 是「本轮工作笔记」,持久知识归 knowledge/ 与 archive/。

## What Changes

- **归属判定(分支键驱动,engine)**:`memory.mjs` 新增 `memoryHomeFor(readState, branch)`——保留键(`_knowledge`、`_exploring/*`)恒主仓;`<type>/<slug>` 查 state 登记的 worktree:有 → `<worktree>/.speccode/memory/`(沿用既有自忽略 `.gitignore` 机制);无(父实体、已完成、异常)→ 主仓。`read/write/purge/rename` 四个 verb 的内部解析换到此函数;**verb/tool 名与 CLI 形状零变化**(prose 调用点大多无需改)。
- **rename-memory 跨目录**:承接桥升级——source(主仓 `_exploring__<topic>.md`)→ target(新 worktree 的 `<type>__<slug>.md`)。同设备 `renameSync` 跨目录即可;`EXDEV`(worktree_dir 配置在其他盘)fallback copy+unlink。目标已存在拒绝语义不变。
- **事务化承接(prose)**:`creating-worktree` 步骤序改为「worktree add → state 写 → **move 记忆**」(先建后 move:失败无需回滚,最坏 `_exploring` 原地保留供续探);`creating-feature` 同构但主记忆留在主仓(父实体无 worktree,move 即既有同目录 rename)。骨架「无承接」路径不变。
- **清理职责**:`finishing-worktree` 在 `git worktree remove` **之前** purge 分支记忆(未跟踪文件会卡 remove 的防线,与 SDD 工作区同一教训);`finishing-feature` purge 主记忆。purge 提示语从「确认不需要可手动清理」改为必经步骤(丢弃路径除外——worktree remove --force 连记忆一起消亡,符合预期)。
- **可见性聚合**:`list-memory` 聚合主仓 + state 登记的各 active worktree 的 memory 目录(条目标注 `home: main|worktree:<branch>`);`status` 的记忆渲染同步(只读聚合,不改 state)。
- **定位声明(设计文档 + spec)**:有意放弃「同 feature 跨轮/多 worktree 共享记忆」;跨期探索 topic 前缀约定(`-p1/-p2`)语义不变(主仓临时居所);`_knowledge` trunk 级不变。
- **测试**:`memory.test.mjs` 归属判定矩阵(保留键/有 worktree/无 worktree)+ 跨目录 rename(同设备 + EXDEV 注入);`cli.test.mjs` linked-worktree e2e(worktree 内写 → 落 worktree 目录;主仓 list 聚合可见);`verbs/mcp` parity 不变。
- **文档**:CHANGELOG `[Unreleased]`(Changed,非 BREAKING——调用形状不变,行为语义变化标注);知识刷新留收尾后 chore(纪律)。

## Capabilities

- `session-memory`(MODIFIED:memory 文件位置与命名 / read-memory、write-memory verb / 已完成 memory 的可见性与清理;ADDED:记忆事务化承接)

## Impact

`lib/memory.mjs`(归属解析 + 跨目录 rename + 聚合)、`lib/verbs.mjs`(四个 memory verb 的解析接线)、`skills/{exploring,creating-worktree,creating-feature,finishing-worktree,finishing-feature,status}/SKILL.md`(事务与清理表述;其余 9 个 memory 消费 skill 的调用形状不变、预期零改动)、`tests/{memory,cli}.test.mjs`、`CHANGELOG.md`。MCP 协议层零改动;reconcile/state 零改动。
