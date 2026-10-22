---
name: reset
description: "Reset the speccode environment: clear state and worktrees, ask per-field whether to clear config (requires no active branches) Interact in the user's language; ask when it cannot be determined."
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
