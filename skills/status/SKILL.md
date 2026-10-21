---
name: status
description: "Read-only overview: progress and pending_operation of every active branch, child branch states derived live for parents, plus a config summary (状态总览) Interact in the user's language; ask when it cannot be determined."
---

> **引擎可用性(lite 探测)**:命令开始时运行 `command -v speccode`——在场则一切照本命令正文调用引擎;不在场(lite 模式)则本命令内的 `speccode <verb>` 调用按下列降级表替换,其余步骤照常执行:
>
> - `read-config` → `cat "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/.speccode/config.json"`(主仓根定位;文件缺失 = 未初始化,按各命令的未初始化分支处理)
> - `read-knowledge --index` / `--topic <t>` → `cat "$(git rev-parse --show-toplevel)/speccode/knowledge/_index.md"` / `…/speccode/knowledge/<t>.md`(worktree 根定位;文件不存在 = 无知识,静默继续)
> - `read-memory --branch <F>` / `list-memory` → `cat` / `ls` 记忆文件(分支键 `<type>/<slug>` 编码为文件名 `<type>__<slug>.md`;分支记忆位于其 worktree 的 `.speccode/memory/`,保留键与 `_exploring__<topic>` 位于主仓 `.speccode/memory/`)
> - `write-memory` → 手动编辑对应文件(单分支假设;append 语义 = 文件末尾补一行)
> - `write-config` → 仅 init:手写最小 config(JSON 数行,可 review);其余写类 verb 不可用
> - `plugin-root` → 本 skill 目录的上两级(`<skill base>/../..`;宿主加载 skill 时报告的 base directory)
> - `default-branch` → `git symbolic-ref --short refs/remotes/origin/HEAD`(剥 `origin/` 前缀),失败则依次 `git rev-parse --verify -q refs/heads/main`、`refs/heads/master`,全败兜底 `main`
> - `run-hook` → 静默跳过(hook 本为 warn-only,lite 等价)
> - `reconcile` / state 读写 / PR / 清理 / 知识蒸馏写 → **编排与蒸馏不可用**:lite 模式不支持并行编排;依赖之的命令中止并提示安装引擎(`npm i -g speccode` 或宿主 PATH shim)后重跑

显示 speccode 当前全局状态。纯只读(除对账自愈外无副作用)。

## 流程

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。

按锚点段探测;lite 模式降级为只读报告:以 git 命令(log / worktree list / status)手工汇总并声明「lite 模式:未做对账与状态推进」。

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
