# Design: memory-lifecycle

## Context

`lib/memory.mjs`(125 行):`memoryPath(speccodeDir, branch)` 把一切记忆锚在主仓 `.speccode/memory/`;`writeMemory` 已带自忽略 `.gitignore`(与 SDD 工作区同形);`renameMemory` 同目录 `renameSync`;`validateMemoryBranch` 认保留键(`_knowledge`)、`_exploring/<topic>`、`<type>/<slug>`。verb 层 `read/write/list/rename/purge-memory` 以 `speccodeDirOf(cwd)`(主仓根)为唯一基座。15 个 skill 消费 memory verb,其中真正的行为触点是 exploring / creating-worktree / creating-feature / finishing-worktree / finishing-feature / status 六个;其余九个(proposing、brainstorming、writing-plans、applying、executing-plans、subagent-driven-development、syncing、archiving、distilling/recording)只按 `--branch <F>` 调 verb——解析升级对它们透明。

现行 spec「memory 文件位置与命名」明文规定主仓定位与「多 worktree 共享一份」(Scenario 钉死);「已完成 memory 的可见性与清理」描述 purge 为可选提示。本需求整体推翻前者、强化后者。

## Goals

- 记忆生命周期 = worktree 生命周期(本轮开发生灭),主干目录不再堆积分支孤儿记忆。
- 承接(探索 → 分支)成为创建事务的一部分,失败无残留损坏。
- 调用形状零变化(verb/tool 名、CLI、`--branch` 语义),九个透明消费者的 prose 零改动。
- trunk 级(`_knowledge`)与探索临时居所语义保持。

## Non-Goals

- 记忆内容格式 / 追加原子性(不变)。
- `.speccode/memory` 的目录层级重构(仍扁平 `<key>.md`)。
- README / DESIGN 门面与知识刷新(收尾后 chore / docs-i18n)。
- memory 跨 worktree 并发写仲裁(单 worktree 单分支后,并发面自然消失——原本的 O_APPEND 并发保护保留不撤)。
- 版本 bump。

## Decisions

**D1. 归属判定 = 分支键驱动,经 state 查 worktree。** `memoryHomeFor(branch)`:保留键(`_knowledge`、`_exploring/*`)→ 主仓;`<type>/<slug>` → `readState` 查该分支 state:有 `worktree` 字段 → 该 worktree 根下 `.speccode/memory/`;无(父实体 `kind:"integration"`、已完成分支、异常缺登记)→ 主仓。被否备选:(a) cwd 驱动(`--show-toplevel` 定位,SDD 工作区模式)——主仓会话里读子分支记忆会解析到主仓,错误位置;status 聚合也没法用;(b) config 显式映射——状态双源,违单写者原则。state 是 worktree 归属的唯一真源,reconcile 已保证它可信。

**D2. 主仓目录退化为「三层居所」。** trunk 级(`_knowledge`)、探索 topic(`_exploring__*`)、无 worktree 的分支(父实体主记忆;已完成分支的残留)。writeMemory 的自忽略 `.gitignore` 机制对两个位置等价生效(worktree 内的 memory 目录同样自忽略,`git status`/`git clean -fd` 安全)。

**D3. 事务 = 先建后 move,跨目录 rename。** `creating-worktree` 步骤序:worktree add → write state → **move 记忆**(`rename-memory --branch _exploring/<topic> --to <branch>`,引擎内部按 D1 解析 source 主仓、target 新 worktree)。先建后 move 意味着任何失败的最坏结果是 `_exploring` 文件原地保留(现状语义,续探无损),无需回滚步骤。`creating-feature` 的主记忆 target 无 worktree → 主仓内同目录 rename(现状路径不变,只是 prose 明确为事务)。EXDEV 兜底:worktree_dir 可配置到其他文件系统,rename 抛 EXDEV 时 copy+unlink(一次 writeTextAtomic 到目标 + unlink source,中间崩溃最坏双份,读侧取 target 优先)。被否备选:引入显式 `--dest` 参数(双源歧义,承袭 rename-memory 既有否决理由)。

**D4. 清理是 finishing 的必经步,不是提示。** `finishing-worktree` 在 `git worktree remove` 之前 purge 分支记忆:worktree 内的未跟踪文件(memory 目录)会卡 `remove`(无 --force 时),先 purge 双保险(--force 路径连记忆一起消亡亦符合「本轮笔记」语义,但显式 purge 让「保留选项」成为可能——丢弃路径外不提供保留)。`finishing-feature` purge 主记忆(主仓,同现状 purge verb)。purge 后的本仓残留(主仓 `_exploring` 孤儿)仍由 reset 兜底,不变。

**D5. list 聚合,state 驱动。** `list-memory`:主仓目录扫描(现状)+ 遍历 state 登记的 active 分支的 worktree memory 目录,条目带 `home` 标注(`main` / `worktree`);`status` prose 渲染该字段。只读聚合,不写任何 state。被否备选:不聚合只列主仓(分支记忆不可见,用户在主仓看不到在途上下文——status 的核心价值受损)。

**D6. 透明消费者零改动验证。** 九个按 `--branch <F>` 调 verb 的 skill:解析升级后,在 worktree 内运行的会话写 `<F>` 记忆自然落到本 worktree(F 的 state worktree = 当前 worktree)。plan 含一个验证任务:全量 grep 九个 skill 的 memory 调用形态,确认无一路径假设「主仓文件」(如 `cat .speccode/memory/...` 直读——有则改 verb 调用)。

**D7. 测试面。** `memory.test.mjs`:归属矩阵(保留键/有 worktree/父实体/未登记)、跨目录 rename(临时目录树模拟 worktree + EXDEV 注入 fake rename 抛错验证 fallback);`cli.test.mjs`:linked worktree e2e(makeRepo + worktree add + write-state 登记 → 在 worktree cwd 写 memory → 断言落 worktree 目录;主仓 list 聚合可见 + home 标注);existing 用例改判(主仓场景行为不变,预期大部分照过)。

## Risks

- **state 缺登记时记忆落主仓**(异常路径)→ 行为 = 现状(可用、不丢),reconcile 会暴露缺登记;lint 不涉及。可接受。
- **跨设备 rename 中间态**→ D3 的双份最坏 + 读侧 target 优先;发生面 = worktree_dir 配置在独立盘的用户,罕见。
- **15 skill 触面的回归**→ 九个透明消费者由 D6 的 grep + 全量守卫兜底;六个行为触点逐个精确替换。
- **spec 推翻「多 worktree 共享」Scenario**→ delta 显式改写该 Scenario 为新语义(单 worktree 单分支记忆);定位变更写进设计文档与 spec 正文(「本轮工作笔记」,持久知识归 knowledge/archive)。
- **知识再漂移**→ 收尾后 micro-chore(session-memory 块的位置与命名叙述),与既往纪律一致。

## Open Questions

- status 渲染是否需要显示各 worktree 记忆的条数摘要(现 only 键列表)——实现时看排版成本,非契约。
