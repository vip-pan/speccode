---
name: init
description: "Initialize or update the speccode environment: write the minimal .speccode/config.json marker (config v3 — version, initialized_at, optional pr_tool / worktree_dir / language / hooks); the config carries no host- or environment-coupled fields, so multiple agents can share one project (初始化) Interact in the user's language; ask when it cannot be determined."
---

初始化或更新 speccode 配置。config 是纯标记 + 少量可选项,不含任何宿主或环境耦合字段。

## 前置

运行 `speccode resolve-speccode-dir --cwd .` 获取 `speccodeDir`。
运行 `speccode read-config --cwd .` 判断是否已初始化:
- `config` 为 null → 全新 init(走"全新流程")
- `config` 非 null → 二次 init(走"幂等流程")

## 全新流程

1. **探测 pr_tool**:运行 `speccode detect-remote --cwd .`,得到 `prToolGuess` 与 `installed`。
   - 若 `installed=false` 且 `prToolGuess≠none`:告知用户"探测到应使用 <tool>,但未检测到该 CLI",询问是否降级为 `none`。
   - 向用户提问确认(给出选项)最终 `pr_tool`(gh / glab / none)。
2. **询问 worktree_dir**:worktree 存放的基础目录,默认 `.speccode/worktrees`,请用户确认或自定义(相对项目根的路径)。
3. **询问工作语言**(可选):向用户提问工件/文档语言(BCP-47 语言 tag)。推荐值取自当前会话的用户消息语言(依据对话判断,不读 LANG/LC_* 等环境变量;如对话为中文 → 推荐 `zh`)。选项:推荐值 / `en` / 自定义 tag(自由输入,合法形态如 `zh-CN`、`pt-BR`)。用户确认 → 该值纳入随后的 config 写入(`language` 字段);用户跳过 → 不写该字段(缺失 = 工件跟随交互语言)。
4. **询问 hooks(可选)**:告知用户可在 SDD 各节点挂 shell 命令(如 IM 通知),事件名固定 14 个:onExplored / onFeatureCreated / onWorktreeCreated / onProposed / onBrainstormed / onPlanned / onTaskCompleted / onCodeReviewRequested / onCodeReviewCompleted / onWorktreeFinished / onFeatureFinished / onPrOpened / onSynced / onArchived。
   - 用户选择配置 → 逐项询问「事件名 + shell 命令」,组装为 `hooks` 对象。
   - 用户跳过 → **不写入 `hooks` 字段**(缺失即无 hook)。
5. **组装 config v3** 并通过 `echo '<json>' | speccode write-config --cwd . --json-stdin` 写入:`version: 3`、`initialized_at`(ISO 8601 UTC)、`pr_tool`、`worktree_dir`;`hooks` 仅在用户配置时存在;`language` 仅在用户确认登记时存在(BCP-47 tag,非法值被 write-config 拒绝)。
6. **squash 探测**:init 完成 config 写入后运行 `speccode repo-merge-config --cwd .`;`squashOnly:false` → 打印警告「建议在仓库设置启用 squash-only 合并」+ 设置指引(不阻断);`config:null`(glab/none/失败)→ 静默跳过。
7. 打印 config 摘要 + 下一步指引(`/speccode:exploring` 探索需求,或直接 `/speccode:creating-worktree`)。

## 幂等流程(二次 init)

1. 备份现有 config(`backup-config` verb → `config.json.bak.<timestamp>`)。
2. 重新走全新流程的询问,得到"新值候选"。
3. 用 `diffFields` 逐字段比较旧/新:值未变 → 跳过;值变化 → 向用户提问展示(给出选项) `[旧值] → [新值]`,询问"保持 / 改用新值 / 清除"。
4. `state/` 目录 MUST 不动;字段集之外的未知键(含历史已删除字段,如 `trunk` / `remote` / `host`)不进 diff、不被消费,整体重写时自然消失。
5. 用 `write-config --json-stdin` 写回;随后同全新流程第 6 步跑 `repo-merge-config` squash 探测,打印摘要。

## 约束
- 全程不修改 `.gitignore`,不删除任何本地文件。
- 写 config 一律通过 `write-config --json-stdin` verb(内部原子写),不由 AI 手写文件。
- 探测结果(pr_tool 猜测)一律经用户确认后才落盘——不确定就先询问,不猜测。
