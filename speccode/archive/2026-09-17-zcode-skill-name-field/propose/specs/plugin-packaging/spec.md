# plugin-packaging Delta

## MODIFIED Requirements

### Requirement: skill frontmatter 契约

`skills/<name>/SKILL.md` 的 frontmatter SHALL 必含 `name` 与 `description` 两个键。`name` 的值 MUST 与所在目录名逐字一致(slug 字符集,不加引号,置于 `description` 之前),MUST NOT 使用展示型标题(0.5.1 的 VS Code Unknown command 病根:name ≠ 调用名时,误读该字段的客户端拼出的路径必错)。`description` 保持英文门面书写(含触发时机语义,同时作为模型自动调用的匹配面;行尾可附括号中文关键词辅助中文查询匹配),长度 MUST NOT 超过 1024 字符(ZCode 硬限,超限即丢弃 skill),并 SHALL 携带统一交互语言纪律:与用户以其使用的语言交互,无法判断时向用户提问,用户确认语言变更后提醒其经 init 重置 config.language。MUST NOT 含 `category`、`tags` 等 commands 时代遗留或非标字段,且 MUST NOT 含「全程中文交互」或任何钉死交互语言的硬指令。skill SHALL 保持模型可自动调用(MUST NOT 设 `disable-model-invocation`),用户显式 `/speccode:<name>` 调用语义不变。

#### Scenario: name 等于目录名
- **WHEN** 检查全部 `skills/<name>/SKILL.md` 的 frontmatter
- **THEN** 每个含 `name` 键且值与所在目录名逐字一致,无 `category`/`tags` 残留

#### Scenario: ZCode 加载与调用
- **WHEN** ZCode 加载 frontmatter 含 `name` 与 `description` 的 skill
- **THEN** 该 skill 不因 frontmatter 被丢弃,可经 `speccode:<name>` 限定名调用

#### Scenario: 展示型标题防复发
- **WHEN** 任何客户端以 `name` 字段值拼调用路径(如 0.5.1 的 VS Code 扩展行为)
- **THEN** 因 name 恒等于目录名,拼出的路径与目录名调用一致,不出现 Unknown command

#### Scenario: description 为英文门面并携带交互纪律
- **WHEN** 检查全部 `skills/<name>/SKILL.md` 的 description
- **THEN** 均为英文且含交互语言纪律语义;`skills/` 下 grep「全程中文交互」MUST 零命中

#### Scenario: description 长度上限
- **WHEN** 检查全部 skill 的 `description`
- **THEN** 均不超过 1024 字符

#### Scenario: 调用名不变
- **WHEN** 用户显式输入 `/speccode:<name>`(如 `/speccode:exploring`)
- **THEN** 调用目录名为 `<name>` 的 skill,调用名与 0.6.0 迁移后完全一致

#### Scenario: 模型自动调用可用
- **WHEN** 会话中出现匹配某 skill description 触发时机的任务(如实现功能时匹配 test-driven-development)
- **THEN** 该 skill 可被模型自动调用,且用户显式调用路径不受影响
