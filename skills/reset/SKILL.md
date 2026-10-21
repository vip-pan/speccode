---
name: reset
description: "Reset the speccode environment: clear state and worktrees, ask per-field whether to clear config (requires no active branches) Interact in the user's language; ask when it cannot be determined."
---

重置 speccode 环境。不接受 `--force`。

## 前置

1. `resolve-speccode-dir` 得 speccodeDir。
2. 扫描 `state/`(`branches/` 与 `features/`):存在状态 ∉ {completed} 的 state 文件 → 报错"检测到 active 分支,请先 /speccode:finishing-worktree(大需求用 /speccode:finishing-feature)完成并清理",退出;全部为 completed(或无 state)→ 允许,reset 执行时将 state 文件一并清理。

## 逐字段询问清理

逐个向用户提问(给出选项)是否清理(是则清空该字段,否则保留):
- `pr_tool` / `worktree_dir` / `hooks` / `language`(若存在)。
- 提示:清空 `pr_tool` 后 PR 收尾流程将无法建 PR,需重编辑 config 或重新 init。

## 执行

1. 备份:运行 `speccode backup-config --cwd .`(config.json.bak.<timestamp>)。
2. 清理 worktree:`git worktree list --porcelain` 中,仅处理满足「路径位于 `resolve-worktree-dir` 解析目录之下 或 曾在 state 中登记」的 worktree → 逐个 `git worktree remove <path> --force` + `git branch -D <branch>`;其余(宿主环境自建)原样保留并说明。
3. 询问是否整体清理 `.speccode/memory/`、`.speccode/sdd/` 与 `.speccode/brainstorm/`(visual companion 产物)三个目录(按目录整体粒度,不提供按 feature 挑选;用户确认才 `rm -rf`);各分支 worktree 内的记忆随步骤 2 的 worktree `--force` 移除一并消亡。
4. `rm -rf .speccode/state/`。
5. 用 `write-config --json-stdin` 写回 config(仅保留用户确认保留的字段)。
6. 打印:reset 完成,保留字段列表;可 `/speccode:init` 重建或直接 `/speccode:exploring`。
