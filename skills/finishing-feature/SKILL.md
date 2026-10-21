---
name: finishing-feature
description: "Large-requirement finale: single PR from the integration branch to trunk (gate: all children completed; blocks waiting for the merge), removes the parent state, returns to trunk Interact in the user's language; ask when it cannot be determined."
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

大需求终局:集成分支 → trunk 单 PR。**opt-in 命令**,仅父实体(kind:integration)使用。支持 `--resume`。

## 语言守护

本命令即将产出工件(文档/PR/commit)。先做语言核对:

1. 经 `speccode read-config --cwd .` 读取 config;未登记 `language` 字段 → 工件跟随当前交互语言,跳过本守护。
2. 已登记且与当前会话交互语言不一致 → 向用户提问一次(本会话内不重复提问):按 config.language 产工件,或确认更换工作语言。
3. 用户确认更换 → 提醒用户运行 `/speccode:init` 重置 config.language,本命令 MUST NOT 直接改写 config;用户选择保持 → 按 config.language 产工件。

## 前置

0. **lite 门**:按「引擎可用性」锚点段探测;引擎缺失 → 打印「本命令依赖编排引擎(state/对账/PR),lite 模式不可用;已中止,未做任何改动」并中止(不做任何 git/state/记忆操作)。
1. `read-config`;为 null → 提示 init。
2. HEAD 必须在功能分支(`<type>/<slug>`);否则退出。
3. `reconcile --cwd . --advance-pr`;orphans 中有本父实体残留 → 提示先清理。
4. 读父实体 state:必须 `kind:"integration"`;否则报错「本命令仅适用于大需求集成分支,普通分支用 finishing-worktree」并退出。

## 门禁(children 全 completed,派生读取)

1. 对 `children` 中每个 slug 读其子分支 state;任一状态 ∈ `{pending, in_progress, pr_open}` → 阻止,列出未完成项(pr_open 附 PR 号)。
2. children 有 slug 但无对应子 state → 视为 `pending`(计划未开工),同样阻止。
3. 全部 completed → 放行。

## 单 PR 流程(integration → trunk)

1. `git push origin <branch>`;non-fast-forward → 中止。
2. 建 PR 前探测 `repo-merge-config`(squashOnly:false → 警告 + 指路,不阻断)。
3. pr_tool 建 PR(base=trunk, head=集成分支);`pr_tool=none` → 打印等效命令并中止。
4. onPrOpened 钩子。
5. 阻塞等待(每 30s query-pr,超时 30min):MERGED → 收尾;CLOSED/CONFLICTING → 报错退出;UNKNOWN 连续 3 次中止;TIMEOUT → 写 `pending_operation{command:"finishing-feature", phase:"waiting_trunk_pr", pr_number}` 提示 `--resume`。

## 收尾

1. `delete-state --branch <集成分支>`(父实体 state;子分支 state 已随各自 finishing-worktree 完成/清理)。
2. onFeatureFinished 钩子。
3. `git checkout <default-branch>`(default branch 经 `speccode default-branch --cwd .` 取 `branch` 字段)+ `fetch & pull`(集成分支与子分支保留作历史,speccode 不删)。
4. 打印:大需求已交付,`<branch>` 已合并进 trunk。
5. **终局摘要不入父主记忆**:父主记忆即将被下一步清理——完成摘要(含 PR url)直接呈现在最终报告;若需留痕,写 trunk 级 `_knowledge` 键(知识维护摘要语义)。
6. **purge 父主记忆**:`speccode purge-memory --cwd . --branch <父分支>`(父记忆在主仓,终局清理)。
