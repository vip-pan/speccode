## ADDED Requirements

### Requirement: 工件语言与语言守护

speccode 产出的工件(proposal/design/specs/tasks/plan/knowledge 文档、PR 标题与正文、簿记 commit subject)MUST 使用 `config.language` 所指语言书写;`config.language` 缺失时 MUST 跟随交互语言。产工件命令(proposing、brainstorming、writing-plans、syncing、archiving、distilling-knowledge、recording-knowledge、applying、finishing-worktree)在落工件前 SHALL 检测会话交互语言与 `config.language`(已登记时)是否一致:不一致 MUST 向用户提问(每会话至多一次);用户确认更换语言后 MUST 提醒其经 init 重置 config.language;命令自身 MUST NOT 直接改写 config.language。

#### Scenario: 工件跟随 config.language
- **WHEN** config.language 为 ja 且用户以日语交互执行 proposing
- **THEN** 生成的 proposal/design/specs/tasks MUST 为日语

#### Scenario: 缺失跟随交互
- **WHEN** config 无 language 字段且用户以中文交互执行 proposing
- **THEN** 生成工件为中文,行为与升级前一致

#### Scenario: 语言不一致守护
- **WHEN** config.language 为 en 而会话交互语言为日语,命令即将落工件
- **THEN** 命令 MUST 提问一次(该会话内不重复);用户确认更换 → 提醒其经 init 重置;用户选择保持 → 按 config.language 继续产工件
