# session-memory Specification

## Purpose

feature 级跨会话记忆:主仓 `.speccode/memory/` 下按 feature 维度隔离的记忆文件,原子写保障,read-memory / write-memory verb 契约,各命令的读写时机,以及超大会话的主动发现与书写指引,支撑跨会话/多会话共享同一需求的上下文。

## Requirements

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

### Requirement: memory 原子写

memory 写入按模式分两种原子策略:replace 模式 MUST 采用「写临时文件 + rename 覆盖」,任何异常退出 MUST NOT 产生半写状态;append 模式 MUST 为单次 O_APPEND 追加写(跨 worktree 并发追加互不覆盖),MUST NOT 使用读-改-写。append 模式 MUST 保证条目边界:既有内容非空且不以换行符结尾、且追加内容不以换行符开头时,MUST 在两者之间插入恰好一个换行符(作为同一次追加写的一部分);其余情况 MUST 原样追加,不多做规范化。

#### Scenario: replace 写入过程异常退出
- **WHEN** 进程在以 replace 模式写入 memory 文件时被 kill
- **THEN** memory 文件 MUST 保持写入前的完整旧内容,不留半写状态

#### Scenario: append 缺失边界补一个换行
- **WHEN** 文件既有内容为 `first`(无尾换行),以 append 模式追加 `- second`(无头换行)
- **THEN** 结果 MUST 为 `first\n- second`(边界插入恰好一个换行符)

#### Scenario: append 边界已存在不重复补
- **WHEN** 既有内容以换行符结尾,或追加内容以换行符开头
- **THEN** 引擎 MUST 原样追加,不插入额外换行

#### Scenario: append 空文件不补前置换行
- **WHEN** memory 文件不存在或为空,以 append 模式写入内容
- **THEN** 引擎 MUST 直接写入该内容,MUST NOT 在开头添加换行

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

### Requirement: 命令读写时机

以下命令 MUST 在入口读取本分支 memory 恢复上下文、在出口写入经用户确认的决策/进度摘要:proposing、brainstorming、writing-plans、applying、executing-plans、subagent-driven-development、finishing-worktree、finishing-feature、archiving。探索结论的承接 MUST 经 `rename-memory` 原子迁移,宿主 MUST 为 `creating-worktree`(普通需求与集成分支的子需求:slug=topic 命中即迁)与 `creating-feature`(大需求父 topic);分支名直给时按 slug=topic 约定查找 `_exploring/<slug>`,未直给时 MUST 经 `list-memory` 列出既有 topic 供用户选择(或新建/跳过),type 从所选 topic 文件内容推断且推断 MUST NOT 静默生效;`_exploring.md` 的 merge+clear 承接方式 MUST 废除。syncing MUST 入口读。status SHOULD 只读不写;reset 不写 memory 内容,但 MUST 在无 active 分支前提下询问用户是否整体清理 `.speccode/memory/` 目录(按目录粒度,不按分支粒度)。exploring 出口:MUST 先经 `list-memory` 列出既有 topic 供用户选既有或新建(防同名碎片化);结论归属既有分支时 append 到该分支的 memory;无归属时 append 到所选/新建的 `_exploring/<topic>`。

#### Scenario: 入口读恢复上下文
- **WHEN** 用户在新会话中对既有分支执行 proposing
- **THEN** 命令 MUST 先 read-memory 并将 memory 内容作为既有上下文参考

#### Scenario: applying 入口读出口写
- **WHEN** applying 开始或结束
- **THEN** MUST 入口 read-memory 恢复上下文、出口 append 决策/进度摘要(实现进度、勾选完成情况、回写记录)

#### Scenario: creating-worktree 经 rename 承接
- **WHEN** creating-worktree 以直给分支名 `feature/payment-rework` 执行,且 `_exploring/payment-rework` 存在记忆文件
- **THEN** 命令 MUST 经 rename-memory 将其承接为该分支的记忆文件,MUST NOT 将其他 topic 的内容迁入骨架

#### Scenario: creating-feature 承接父 topic
- **WHEN** 大需求经 creating-feature 创建集成分支 `feature/mkt-req`,且 `_exploring/mkt-req` 存在记忆文件(拆分决策所在)
- **THEN** 命令 MUST 经 rename-memory 承接为父实体的记忆文件;子需求各自的探索 topic MUST 留待对应 creating-worktree 承接

#### Scenario: 无命中时骨架填无
- **WHEN** creating-worktree 执行时不存在与 slug 同名的 topic 键
- **THEN** memory 骨架的 exploring 结论段 MUST 填「无」,MUST NOT 扫描或迁移任何其他 topic 文件

#### Scenario: exploring 出口先列 topic
- **WHEN** exploring 结束且结论无既有分支归属
- **THEN** 命令 MUST 先 list-memory 展示既有 topic 清单,经用户选择既有 topic 或确认新建 topic 后,才 append 到对应 `_exploring/<topic>` 文件

#### Scenario: reset 按目录粒度清理
- **WHEN** 用户执行 reset 且无 active 分支
- **THEN** 命令 MUST 询问是否整体清理 `.speccode/memory/`(以及 `.speccode/sdd/`),按目录整体处理,不提供按分支挑选

### Requirement: 超大会话主动发现与书写

各命令的 prose 指引 MUST 指示 agent 在长会话中主动执行 write-memory,而非仅依赖命令出入口的被动读写:当阶段完成、会话上下文显著增长、或 compact 恢复后继续工作时,agent MUST 主动把关键决策/进度/待办写入 memory,写入内容 MUST 经用户确认或遵循命令内置的既定判据。

#### Scenario: 阶段完成主动书写
- **WHEN** 长会话中某开发阶段(如一个 task 完成)结束且距上次 memory 写入已隔多个阶段
- **THEN** agent MUST 主动将阶段摘要写入 memory,不等待命令出口

#### Scenario: compact 恢复后补写
- **WHEN** 会话发生 compact 且 agent 从 memory 恢复上下文继续工作
- **THEN** agent MUST 在恢复后的首个阶段完成时更新 memory,保证下一次恢复所需信息完整

### Requirement: 已完成 memory 的可见性与清理

`list-memory` verb 输出 SHALL 聚合**主仓 memory 目录与 state 登记的各 active 分支 worktree memory 目录**:既有 `topics` 字段(主仓探索 topic)形状不变;`files` 数组每个元素为 `{branch, completed, home}`,`home` ∈ `"main"` | `"worktree"`(标注该条目所在目录);`completed` 经 state 登记连接派生,三态语义不变(state completed → `true`;state 非 completed → `false`;无 state → `null`)。`purge-memory --branch <F>` verb 语义不变(按分支键驱动定位删除,幂等,MUST NOT 提供批量形态)。

**清理职责**:`finishing-worktree` MUST 在 `git worktree remove` 之前对分支记忆执行 purge(worktree 内未跟踪文件会卡 remove;丢弃路径的 `--force` 连记忆一起消亡亦符合本轮笔记定位);`finishing-feature` MUST purge 父实体主记忆。主仓 `_exploring` 孤儿 topic 仍由 reset 兜底。

#### Scenario: 聚合与归属标注

- **WHEN** 主仓存在 `_exploring__topic-a.md` 与 `_knowledge.md`,worktree-a(state 登记 `feature/alpha`,非 completed)存在 `feature__alpha.md`
- **THEN** `list-memory` 的 `files` 含 `{branch:"_exploring/topic-a", completed:null, home:"main"}`、`{branch:"_knowledge", completed:null, home:"main"}` 与 `{branch:"feature/alpha", completed:false, home:"worktree"}`,`topics` 仍为 `["_exploring/topic-a"]`

#### Scenario: purge-memory 幂等

- **WHEN** 对分支记忆(其 worktree 内)执行 `speccode purge-memory --cwd . --branch feature/done-item` 两次
- **THEN** 第一次返回 `purged:true` 且 worktree 内文件消失;第二次返回 `purged:false`,exit 0 不报错

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
