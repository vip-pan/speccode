# session-memory Delta: memory-lifecycle

## MODIFIED Requirements

### Requirement: memory 文件位置与命名

记忆归属 SHALL 由**分支键驱动**:保留键(`_knowledge`、`_exploring/<topic>`)的记忆文件恒为**主仓** `.speccode/memory/<key>.md`;`<type>/<slug>` 分支的记忆文件 SHALL 落在**该分支 state 登记的 worktree 根**下 `.speccode/memory/<type>__<slug>.md`(state 无 worktree 登记时——父实体 `kind:"integration"`、已完成分支、异常缺登记——落主仓同规则路径)。两个位置的 memory 目录均 MUST 保持 untracked 且由引擎写入内容为 `*` 的自忽略 `.gitignore`(幂等,不碰用户 `.gitignore`);文件名 MUST 复用 `<type>__<slug>` 双下划线规则与 `branchToStateName` 编码。分期需求的各期探索 SHALL 使用共同 topic 前缀约定(如 `<主题>-p1`、`<主题>-p2`);跨期进度与设计结论 MUST 以 state、git history 与 spec 主规格为真源,MUST NOT 记入 memory。

**定位声明**:memory 是「本轮工作笔记」——生命周期与开发 worktree 同步,随创建事务承接、随收尾清理;**同一 feature 的多个 worktree 不再共享记忆**(跨轮/跨 worktree 的持久知识归 `speccode/knowledge/` 与 `speccode/archive/`)。

#### Scenario: 分支记忆落其 worktree
- **WHEN** state 登记 `feature/payment-api` 的 worktree 为 `<wt>`,在任意 cwd 对 `feature/payment-api` 执行 write-memory
- **THEN** 记忆文件 MUST 落在 `<wt>/.speccode/memory/feature__payment-api.md`(非主仓),目录自带自忽略 `.gitignore`

#### Scenario: 保留键恒主仓
- **WHEN** 对 `_knowledge` 或 `_exploring/<topic>` 执行 read/write-memory
- **THEN** 路径 MUST 为主仓 `.speccode/memory/` 下对应文件,与任何 worktree 登记无关

#### Scenario: 无 worktree 登记回退主仓
- **WHEN** 对父实体(集成分支)或 state 缺登记的分支执行 write-memory
- **THEN** 记忆文件 MUST 落主仓 `.speccode/memory/`,行为可用不报错

#### Scenario: memory 不被 git 跟踪
- **WHEN** 在有分支记忆的 worktree 内执行 `git status`
- **THEN** memory 目录不出现在输出中(自忽略生效)

### Requirement: read-memory / write-memory verb

引擎 SHALL 暴露 `read-memory --branch <F>`(文件不存在时返回 `{memory: null}`)与 `write-memory --branch <F> --json-stdin`(stdin payload 为 `{mode: "replace" | "append", content: "..."}`)两个 verb;二者及 `purge-memory` 的文件位置 SHALL 按「memory 文件位置与命名」的分支键驱动规则解析(保留键主仓;分支键经 state 查 worktree,有则 worktree、无则主仓)。branch 校验 MUST 收口为 lib 函数 `validateMemoryBranch`:接受保留键 `_knowledge`、topic 键 `_exploring/<topic>`(topic MUST 经 `validateSlug` 校验)、以及经 `validateBranch` 校验的功能分支;非法时返回 `{ok:false, error}`。

引擎 SHALL 另暴露 `list-memory --cwd .` verb 与 `rename-memory --branch <from> --to <to> --json-stdin` verb。rename-memory MUST:两侧 branch 均经 `validateMemoryBranch` 校验;源文件不存在时返回 `{ok:false, error}`;目标记忆文件已存在时 MUST 拒绝并返回错误(MUST NOT 覆盖、MUST NOT 合并);rename 的 source 与 target 各按分支键驱动规则解析——**允许跨目录移动**(探索 topic 在主仓、目标分支记忆在其 worktree),同文件系统 MUST 用原子 `renameSync`,跨设备(`EXDEV`)MUST 回退为「原子写目标 + unlink 源」(读侧以目标为优先,中间崩溃最坏双份不损坏)。

#### Scenario: 文件缺失返回 null
- **WHEN** 对无记忆文件的 feature 执行 read-memory
- **THEN** 返回 MUST 为 `{ok: true, memory: null}`,不报错

#### Scenario: append 模式追加
- **WHEN** 以 `{mode: "append", content: "..."}` 执行 write-memory
- **THEN** 内容 MUST 追加到既有文件末尾,既有内容完整保留

#### Scenario: 跨目录承接
- **WHEN** 主仓存在 `_exploring__<topic>.md`,state 登记 `<branch>` 的 worktree 为 `<wt>`,执行 `rename-memory --branch _exploring/<topic> --to <branch>`
- **THEN** 文件 MUST 出现在 `<wt>/.speccode/memory/<type>__<slug>.md` 且主仓源文件消失;`<wt>` 未登记时退化为既有主仓内 rename

### Requirement: 已完成 memory 的可见性与清理

`list-memory` verb 输出 SHALL 聚合**主仓 memory 目录与 state 登记的各 active 分支 worktree memory 目录**:既有 `topics` 字段(主仓探索 topic)形状不变;`files` 数组每个元素为 `{branch, completed, home}`,`home` ∈ `"main"` | `"worktree"`(标注该条目所在目录);`completed` 经 state 登记连接派生,三态语义不变(state completed → `true`;state 非 completed → `false`;无 state → `null`)。`purge-memory --branch <F>` verb 语义不变(按分支键驱动定位删除,幂等,MUST NOT 提供批量形态)。

**清理职责**:`finishing-worktree` MUST 在 `git worktree remove` 之前对分支记忆执行 purge(worktree 内未跟踪文件会卡 remove;丢弃路径的 `--force` 连记忆一起消亡亦符合本轮笔记定位);`finishing-feature` MUST purge 父实体主记忆。主仓 `_exploring` 孤儿 topic 仍由 reset 兜底。

#### Scenario: 聚合与归属标注

- **WHEN** 主仓存在 `_exploring__topic-a.md` 与 `_knowledge.md`,worktree-a(state 登记 `feature/alpha`,非 completed)存在 `feature__alpha.md`
- **THEN** `list-memory` 的 `files` 含 `{branch:"_exploring/topic-a", completed:null, home:"main"}`、`{branch:"_knowledge", completed:null, home:"main"}` 与 `{branch:"feature/alpha", completed:false, home:"worktree"}`,`topics` 仍为 `["_exploring/topic-a"]`

#### Scenario: purge-memory 幂等

- **WHEN** 对分支记忆(其 worktree 内)执行 `speccode purge-memory --cwd . --branch feature/done-item` 两次
- **THEN** 第一次返回 `purged:true` 且 worktree 内文件消失;第二次返回 `purged:false`,exit 0 不报错

## ADDED Requirements

### Requirement: 记忆事务化承接

记忆进入分支 SHALL 是创建事务的一部分,**先建后移**:命令层 MUST NOT 在 worktree/feature 尚未创建时预先移动记忆。

- `creating-worktree`:worktree add → write state → **move 记忆**(`rename-memory --branch _exploring/<topic> --to <branch>`)。move 失败的最坏结果是 topic 记忆原地保留于主仓(续探无损),MUST NOT 回滚已创建的 worktree;move 的三种先在状态(源不存在 / 目标已存在 / 用户拒绝承接)MUST 分别走「骨架 replace『无』」「报告跳过、骨架增量维护」「原地保留」既有语义,事务化不改变它们的分支契约。
- `creating-feature`:`git checkout -b` + push → write 父实体 state → **move 主记忆**(target 为父分支,无 worktree,即主仓内 rename)。大需求主记忆留主仓;每个子需求的探索 → 子 worktree 记忆事务与普通需求同构。
- 用户在形态确认时拒绝建 worktree/feature:topic 记忆 MUST 原地保留于主仓(续探与分期 topic 语义不变),主干 git 零痕迹。

#### Scenario: worktree 承接事务序
- **WHEN** exploring 结论在 `_exploring/<topic>`,用户确认建 worktree
- **THEN** 命令先完成 worktree add 与 state 登记,再执行 rename-memory;成功后主仓无该 topic 文件、新 worktree 的 memory 目录有 `<type>__<slug>.md`

#### Scenario: 拒建原地保留
- **WHEN** 用户在形态确认选择不建分支
- **THEN** `_exploring__<topic>.md` MUST 仍在主仓,后续会话可续探或再承接

#### Scenario: feature 主记忆事务
- **WHEN** exploring 结论确认建 feature(大需求)
- **THEN** 主记忆经 rename 落主仓 `feature__<父slug>.md`;子需求各自的 worktree 记忆独立生灭,父主记忆由 finishing-feature purge
