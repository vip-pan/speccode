# development-flow-tiering Delta: sdd-companion-scripts

## MODIFIED Requirements

### Requirement: applying 手动执行命令

speccode SHALL 暴露 `/speccode:applying` 命令作为 Tier 1 变更的手动执行入口;其唯一准入 = proposal.md `tier` 字段为 1 且 `speccode/changes/<slug>/plan/` 不存在。tier ≥ 2 且无 plan → MUST 报错并引导 `/speccode:writing-plans`;tier 为 3 且 `brainstorm/` 不存在 → MUST 引导 `/speccode:brainstorming`;plan/ 存在 → MUST 拒绝并引导 subagent-driven-development 或 executing-plans;`changes/<slug>/propose/proposal.md` 不存在 → MUST 报错并引导先 `/speccode:proposing`(封堵零文档直实现)。applying SHALL 逐条实现 tasks.md 勾选清单条目:每完成一条并验证通过 MUST 勾选对应 `- [ ]` 为 `- [x]` 并随簿记 commit(`docs(speccode): tick tasks <N>` 形式)落盘;实现 MUST 遵循 TDD(test-driven-development),发现前序文档矛盾 MUST 回写(见「回写义务泛化」);全部条目完成并验证后 MUST 路由 `requesting-code-review`(BASE 取开始实现前记录的 commit),审查通过后才引导 syncing → archiving。applying 在开发分支(`<type>/<slug>`、非 trunk)上运行。tasks.md 的勾选为文档编辑语义,MUST NOT 复用面向 plan 结构的 tick-task 伴生脚本;对已勾选条目的重跑 MUST 幂等跳过。

#### Scenario: tier 2 未写 plan 时拒绝
- **WHEN** 用户对 `tier` 字段为 2 且 plan/ 不存在的变更执行 applying
- **THEN** 命令 MUST 报错并引导 /speccode:writing-plans,MUST NOT 开始实现

#### Scenario: 存在 plan 时拒绝
- **WHEN** speccode/changes/<slug>/plan/ 存在任何计划文件
- **THEN** applying MUST 拒绝执行并引导 subagent-driven-development 或 executing-plans

#### Scenario: 无 propose 文档时拒绝
- **WHEN** speccode/changes/<slug>/propose/proposal.md 不存在
- **THEN** applying MUST 报错并引导先 /speccode:proposing,MUST NOT 直接开始写代码

#### Scenario: 逐条勾选与簿记 commit
- **WHEN** applying 完成清单中的一条并验证通过
- **THEN** MUST 将该条 `- [ ]` 勾选为 `- [x]` 并 commit 簿记提交;重跑对已勾选条目 MUST 幂等跳过

#### Scenario: 完成后 review
- **WHEN** applying 全部条目完成且验证通过
- **THEN** MUST 按 requesting-code-review 派发审查(BASE 为开始实现前记录的 commit),审查通过后才引导 syncing → archiving
