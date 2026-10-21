# Tasks: memory-lifecycle

> 本清单已由 plan/2026-10-21-memory-lifecycle-plan.md 接管:实现进度以 plan 的 checkbox 为准,本文件不再勾选,仅作意图索引。

## A. 引擎(lib)

- A1 `lib/memory.mjs`:`memoryHomeFor(state, branch)`(保留键→主仓;分支键→state.worktree 存在则该 worktree 根,否则主仓)+ `memoryPathFor(state, branch)`;read/write/purge 改经其解析;`renameMemory` 跨目录(同设备 renameSync;EXDEV → writeTextAtomic 目标 + unlink 源);单测:归属矩阵 + 跨目录 + EXDEV 注入
- A2 `lib/verbs.mjs`:read/write/rename/purge-memory 的解析接线(verb 内读 state 后传入);`list-memory` 聚合(主仓 + state 登记各 active worktree,条目加 `home`);单测/e2e:linked worktree 内写 → 落 worktree;主仓 list 聚合 + home 标注;parity 不变
- A3 `tests/cli.test.mjs`:linked worktree e2e 三例(写落 worktree / 聚合标注 / purge 定位 worktree);既有主仓用例回归

## B. prose(six 行为触点)

- B1 `skills/exploring/SKILL.md`:完成后的衔接段改「事务化承接」表述(move 发生在 creating-worktree/creating-feature 内,拒建则原地保留——现行「先写记忆再引导」的时序对齐)
- B2 `skills/creating-worktree/SKILL.md`:步骤序改为 worktree add → state → **move 记忆**(rename-memory 事务,失败不回滚;三分支先在状态语义不变)
- B3 `skills/creating-feature/SKILL.md`:父实体主记忆 move 步骤(主仓内 rename)+ 子需求事务引用
- B4 `skills/finishing-worktree/SKILL.md`:purge 分支记忆为 `git worktree remove` 前的必经步;丢弃路径连记忆消亡的表述
- B5 `skills/finishing-feature/SKILL.md`:purge 父主记忆步骤
- B6 `skills/status/SKILL.md`:聚合渲染(home 标注)说明
- B7 守卫:九个透明消费者 grep 验证零主仓路径假设;prose 无「主仓共享一份」残留表述(含 exploring 的「跨 worktree 共享」句)

## C. 文档

- C1 `CHANGELOG.md` `[Unreleased]`:Changed(memory 归属 worktree,生命周期与开发同步;事务化承接;purge 必经;list 聚合)——非 BREAKING(调用形状不变),行为语义变化标注
- C2 设计文档定位声明已含(D5/定位声明);AGENTS.md 检查(`memory 走 writeTextAtomic` 不变量条补归属一句)

## D. 验证

- D1 全量 `node --test ./tests/*.test.mjs` 通过
- D2 手动冒烟:临时仓 makeRepo + worktree add + write-state → exploring 写 topic → creating-worktree 事务(手动按 prose 步序)→ 断言 worktree 内有记忆、主仓无 topic 文件 → finishing 步序 purge → remove
- D3 grep:`memoryPath(speccodeDir` 直用点仅剩 memory.mjs 内部;prose 无主仓共享表述
- D4 ledger 记:知识 session-memory 块(位置与命名/承接)收尾后 micro-chore 刷新
