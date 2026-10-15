# session-memory Delta: runtime-data-lifecycle

## ADDED Requirements

### Requirement: 已完成 memory 的可见性与清理

`list-memory` verb 输出 SHALL 在既有 `topics` 之外新增 `files` 数组:每个元素为 `{branch, completed}`,枚举 memory 目录全部 `.md` 文件(`<type>__<slug>.md` 还原为 `<type>/<slug>` 键,`_exploring__<t>.md` 还原为 `_exploring/<t>` 键,含 `_knowledge`);`completed` SHALL 经 state 登记连接派生(分支 state 存在且 status 为 `completed` → `true`,分支 state 不存在或非 completed → `false`,无 state 对应的键如 `_exploring/*` 与 `_knowledge` → `null`),MUST NOT 修改既有 `topics` 字段的形状与取值。引擎 SHALL 提供 `purge-memory --branch <F>` verb:经 `validateMemoryBranch` 校验分支键后删除对应 memory 文件并返回 `{ok:true, purged:true, path}`;文件不存在时返回 `{ok:true, purged:false}` 不报错(幂等);MUST NOT 提供批量/全量删除形态。

#### Scenario: list-memory 标注已完成分支

- **WHEN** memory 目录存在 `feature__done-item.md` 与 `_exploring__topic-a.md`,且 state 中 `feature/done-item` 为 `completed`
- **THEN** `list-memory` 输出的 `files` 含 `{branch:"feature/done-item", completed:true}` 与 `{branch:"_exploring/topic-a", completed:null}`,`topics` 仍为 `["_exploring/topic-a"]`

#### Scenario: purge-memory 幂等

- **WHEN** 执行 `speccode purge-memory --cwd . --branch feature/done-item` 两次
- **THEN** 第一次返回 `purged:true` 且文件消失;第二次返回 `purged:false`,exit 0 不报错
