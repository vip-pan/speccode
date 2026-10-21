# code-intel-tool-integration Delta: init-slim-config

## REMOVED Requirements

- `### Requirement: 代码智能工具探测启发式`
- `### Requirement: detect-code-intel-tools verb`
- `### Requirement: code_intel_tools 配置字段`

## MODIFIED Requirements

### Requirement: 命令咨询行为

认知型命令的代码智能咨询 SHALL 基于会话可见性,不依赖任何持久登记:命令正文以统一模板表述「若当前会话中可用的代码智能工具(如代码图谱/索引类 MCP 或 CLI),参考代码时 MUST 优先使用;不可用或不存在则静默回退 Grep/Glob/Read;任何情况下工具缺失 MUST NOT 导致报错」。命令 MUST NOT 读取 config 字段或调用探测 verb 来决定咨询行为(探测 verb 已删除);`resolve-worktree-dir` 及其 gitignore 三分支不受本变更影响(见「worktree 基础目录配置」)。

#### Scenario: 会话内有代码智能工具
- **WHEN** 会话中可用代码图谱/索引类 MCP 或 CLI,命令需参考代码
- **THEN** 命令 MUST 优先使用该工具进行代码参考

#### Scenario: 会话内不可用
- **WHEN** 会话中无任何代码智能工具
- **THEN** 命令 MUST 静默回退 Grep/Glob/Read,不报错、不警告

#### Scenario: prose 零登记依赖
- **WHEN** 检查 `skills/*/SKILL.md`
- **THEN** 不存在 `config.code_intel_tools` 或 `detect-code-intel-tools` 的引用;咨询段与会话状态之外的一切登记解耦
