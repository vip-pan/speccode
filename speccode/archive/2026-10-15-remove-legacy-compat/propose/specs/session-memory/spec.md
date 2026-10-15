# Delta: session-memory

## MODIFIED Requirements

### Requirement: memory 文件位置与命名

每个 feature 的记忆文件 SHALL 为**主仓** `.speccode/memory/<type>__<slug>.md`,文件名 MUST 复用 state 文件的 `<type>__<slug>` 双下划线规则;MUST 保持 untracked(与 `.speccode/` 其他运行时数据一致);主仓定位使同一 feature 的多个 worktree 共享一份 memory。trunk 级例外:探索记忆按 topic 分文件,键形式 `_exploring/<topic>`,文件名经 `branchToStateName` 编码为 `.speccode/memory/_exploring__<topic>.md`(`topic` MUST 匹配 `[a-z0-9-]`);`.speccode/memory/_knowledge.md`(knowledge 命令的 trunk 级维护摘要)保持无斜杠键直通。分期需求的各期探索 SHALL 使用共同 topic 前缀约定(如 `<主题>-p1`、`<主题>-p2`);跨期进度与设计结论 MUST 以 state、git history 与 spec 主规格为真源,MUST NOT 记入 memory。

#### Scenario: 命名复用双下划线规则
- **WHEN** feature 分支为 `feature/payment-api`
- **THEN** 记忆文件 MUST 为 `.speccode/memory/feature__payment-api.md`

#### Scenario: 多 worktree 共享一份 memory
- **WHEN** 同一 feature 的 worktree-a 与 worktree-b 分别执行命令写 memory
- **THEN** 二者 MUST 读写主仓的同一个记忆文件(而非各自 worktree 内的副本)

#### Scenario: memory 不被 git 跟踪
- **WHEN** 记忆文件已写入
- **THEN** 其 MUST 处于 untracked 状态,不进入任何分支的 git 历史与 PR

#### Scenario: 探索记忆按 topic 分文件
- **WHEN** exploring 对 topic `payment-rework` 的探索结论无既有 feature 可归属
- **THEN** 结论摘要 MUST 写入主仓 `.speccode/memory/_exploring__payment-rework.md`,MUST NOT 写入其他 topic 的文件

#### Scenario: 分期使用共同前缀
- **WHEN** 大需求 `mkt-req` 分三期探索,每期各自探索结论无 feature 归属
- **THEN** 三期结论 MUST 分别位于 `_exploring__mkt-req-p1.md`、`_exploring__mkt-req-p2.md`、`_exploring__mkt-req-p3.md`(命名约定),各期承接时互不携带他期内容

#### Scenario: 无斜杠 _exploring 键不可用

- **WHEN** 对 `--branch _exploring` 执行 read-memory 或 write-memory
- **THEN** verb MUST 返回 `{ok:false, error}`(非法分支键);探索结论 MUST 经 `_exploring/<topic>` topic 键读写

#### Scenario: _knowledge.md 例外
- **WHEN** knowledge 命令(distilling/recording)从 trunk 完成维护并创建 PR
- **THEN** 维护摘要 MUST 追加到主仓 `.speccode/memory/_knowledge.md`,MUST NOT 写 feature 级 memory

### Requirement: read-memory / write-memory verb

引擎 SHALL 暴露 `read-memory --branch <F>`(文件不存在时返回 `{memory: null}`)与 `write-memory --branch <F> --json-stdin`(stdin payload 为 `{mode: "replace" | "append", content: "..."}`)两个 verb。branch 校验 MUST 收口为 lib 函数 `validateMemoryBranch`:接受保留键 `_knowledge`、topic 键 `_exploring/<topic>`(topic MUST 经 `validateSlug` 校验)、以及经 `validateBranch` 校验的功能分支;非法时返回 `{ok:false, error}`。

引擎 SHALL 另暴露 `list-memory --cwd .` verb(返回既有 `_exploring` topic 键清单,无 topic 时为空数组)与 `rename-memory --branch <from> --to <to> --json-stdin` verb(将 `<from>` 的记忆文件原子 rename 为 `<to>` 的记忆文件名)。rename-memory MUST:两侧 branch 均经 `validateMemoryBranch` 校验;源文件不存在时返回 `{ok:false, error}`;目标记忆文件已存在时 MUST 拒绝并返回错误(MUST NOT 覆盖、MUST NOT 合并);rename MUST 为同目录原子操作。

#### Scenario: 文件缺失返回 null
- **WHEN** 对无记忆文件的 feature 执行 read-memory
- **THEN** 返回 MUST 为 `{ok: true, memory: null}`,不报错

#### Scenario: append 模式追加
- **WHEN** 以 `{mode: "append", content: "..."}` 执行 write-memory
- **THEN** 内容 MUST 追加到既有文件末尾,既有内容完整保留

### Requirement: 已完成 memory 的可见性与清理

`list-memory` verb 输出 SHALL 在既有 `topics` 之外新增 `files` 数组:每个元素为 `{branch, completed}`,枚举 memory 目录全部 `.md` 文件(`<type>__<slug>.md` 还原为 `<type>/<slug>` 键,`_exploring__<t>.md` 还原为 `_exploring/<t>` 键,含 `_knowledge`);`completed` SHALL 经 state 登记连接派生,三态语义:state 存在且 status 为 `completed` → `true`;state 存在但非 `completed` → `false`;无 state 对应(如 `_exploring/*`、`_knowledge`、state 已被清理的历史键)→ `null`。MUST NOT 修改既有 `topics` 字段的形状与取值。引擎 SHALL 提供 `purge-memory --branch <F>` verb:经 `validateMemoryBranch` 校验分支键后删除对应 memory 文件并返回 `{ok:true, purged:true, path}`;文件不存在时返回 `{ok:true, purged:false}` 不报错(幂等);MUST NOT 提供批量/全量删除形态。

#### Scenario: list-memory 标注已完成分支

- **WHEN** memory 目录存在 `feature__done-item.md` 与 `_exploring__topic-a.md`,且 state 中 `feature/done-item` 为 `completed`
- **THEN** `list-memory` 输出的 `files` 含 `{branch:"feature/done-item", completed:true}` 与 `{branch:"_exploring/topic-a", completed:null}`,`topics` 仍为 `["_exploring/topic-a"]`

#### Scenario: purge-memory 幂等

- **WHEN** 执行 `speccode purge-memory --cwd . --branch feature/done-item` 两次
- **THEN** 第一次返回 `purged:true` 且文件消失;第二次返回 `purged:false`,exit 0 不报错
