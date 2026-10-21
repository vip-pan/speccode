---
name: creating-feature
description: "Opt-in for large requirements: cut an integration branch from trunk and push it, register the parent state; use creating-worktree for normal changes (集成分支) Interact in the user's language; ask when it cannot be determined."
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

创建大需求的集成分支与父实体。**opt-in 命令**:仅当 exploring 形态确认判定为大需求(整体上线)时使用;普通需求直接 `/speccode:creating-worktree`。

## 前置

0. **lite 门**:按「引擎可用性」锚点段探测;引擎缺失 → 打印「本命令依赖编排引擎(state/对账/PR),lite 模式不可用;已中止,未做任何改动」并中止(不做任何 git/state/记忆操作)。
1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. 校验 HEAD 必须等于 `<default-branch>`(运行 `speccode default-branch --cwd .` 取 `branch` 字段);不符 → 提示切回后退出。

## 决定分支名

同普通需求命名规则:`<type>/<slug>` 校验;参数直给(合法则采用)→ `list-memory` 选 topic(slug 预填,type 推断)→ 询问;推断 MUST NOT 静默生效。

## 创建

1. `git checkout -b <branch>`(从 trunk);`git push -u origin <branch>`。
2. 写父实体 state:经 `write-state --branch <branch> --json-stdin`,内容 `{branch, type, kind: "integration", children: [], status: "in_progress", created_at, initial_branch: <default-branch>}`(**MUST NOT 含 worktree 字段**)。
3. **承接父 topic**(slug=topic 命中):`rename-memory --branch _exploring/<slug> --to <branch> --json-stdin`(stdin `{}`);ok → append 骨架头(创建时间);`not found` → 骨架 replace「无」;`already exists` → 报告跳过;父实体无 worktree,主记忆留在主仓(rename 为主仓内移动)。子需求的记忆事务与普通需求同构(见 creating-worktree)。三分支契约同既述。
4. 触发 onFeatureCreated 钩子。
5. 打印:大需求模式已建立,集成分支 `<branch>`;子需求经 `/speccode:creating-worktree` 从本分支切出;终局用 `/speccode:finishing-feature`。
