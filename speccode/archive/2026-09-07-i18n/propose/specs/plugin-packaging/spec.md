## MODIFIED Requirements

### Requirement: skill frontmatter 契约

`skills/<name>/SKILL.md` 的 frontmatter SHALL 只含 `description`(英文书写,含触发时机语义,同时作为模型自动调用的匹配面;行尾可附括号中文关键词辅助中文查询匹配);每条 description SHALL 携带统一交互语言纪律:与用户以其使用的语言交互,无法判断时向用户提问,用户确认语言变更后提醒其经 init 重置 config.language。MUST NOT 含 `name`(调用名回落目录名)、`category`、`tags` 等非 commands 时代遗留或非标字段,且 MUST NOT 含「全程中文交互」或任何钉死交互语言的硬指令。skill SHALL 保持模型可自动调用(MUST NOT 设 `disable-model-invocation`),用户显式 `/speccode:<name>` 调用语义不变。

#### Scenario: frontmatter 只含 description
- **WHEN** 检查 24 个 `skills/<name>/SKILL.md` 的 frontmatter
- **THEN** 每个仅含 `description` 一个字段,无 `name`/`category`/`tags` 残留

#### Scenario: description 为英文门面并携带交互纪律
- **WHEN** 检查 24 个 `skills/<name>/SKILL.md` 的 description
- **THEN** 均为英文且含交互语言纪律语义;`skills/` 下 grep「全程中文交互」MUST 零命中

#### Scenario: 调用名不变
- **WHEN** 用户显式输入 `/speccode:<name>`(如 `/speccode:exploring`)
- **THEN** 调用目录名为 `<name>` 的 skill,与迁移前 command 的调用名一致

#### Scenario: 模型自动调用可用
- **WHEN** Claude 会话中出现匹配某 skill description 触发时机的任务(如实现功能时匹配 test-driven-development)
- **THEN** 该 skill 可被模型自动调用,且用户显式调用路径不受影响
