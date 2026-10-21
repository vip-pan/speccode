---
name: status
description: "Read-only overview: progress and pending_operation of every active branch, child branch states derived live for parents, plus a config summary (状态总览) Interact in the user's language; ask when it cannot be determined."
---

显示 speccode 当前全局状态。纯只读(除对账自愈外无副作用)。

## 流程

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. 开头跑对账,汇总 `.speccode/state/branches/` 下所有 active 分支:普通分支渲染状态与 `pending_operation`;父实体(`kind:"integration"`)以树状渲染 `children`——各子分支的 status **实时读取对应子分支 state 派生**,children 有 slug 但无子 state 的渲染为 `pending`(计划未开工)。(对账 verb:`speccode reconcile --cwd . --advance-pr`,顺便自愈状态漂移、查询 PR 状态并推进已合并的 pr_open。)
3. 报告 `orphans` / `conflicts`(若有),提示如何处理。
4. 运行 `speccode lint-state --cwd .`:`config.warnings` 或任一 state 条目 `warnings` 非空 → 报告一行(坏形状条目经一次纠正性 write-state 修复),不阻断。
5. 运行 `speccode list-memory --cwd .`;`files` 条目按 `home` 标注归属(`main` = 主仓目录,`worktree` = 该分支 worktree 内,随收尾消亡);`completed:true` 且 `home:"main"` 的条目为滞留(如收尾异常遗留),报告一行提示可经 `purge-memory` 清理;`completed:true` 且 `home:"worktree"` 的条目为待清理残留(随该 worktree 最终移除消亡,亦可手动 `purge-memory`),同一行内附注。
6. 末尾打印 config 摘要:`trunk / pr_tool`。
7. 若无 active 分支:打印"当前无 active 分支",仅显示 config 摘要。

## 输出示例(供格式参考)

```
speccode — 4 active 分支
● feature/payment (from master) completed
● feature/auth (from master) in_progress
    ⏸ pending: finishing-worktree(waiting_worktree_pr, PR #51)
● feature/shop-rework (from master) in_progress(父实体)
    ✓ feature/shop-cart      completed
    ⧗ feature/shop-pay       pr_open (PR #52)
    · feature/shop-report    pending(计划未开工)
config: trunk=master pr_tool=gh
memory: 2 个滞留条目(completed 且 home:"main",如 feature/done),可经 purge-memory 清理
```
