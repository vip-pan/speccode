# code-intel-tool-integration Specification

## Purpose

代码智能工具(代码索引 + 代码知识图谱 MCP 工具)的探测、登记与 advisory 咨询:init 通过插件目录 / MCP 配置 / CLI 二进制 / 项目配置目录四类启发式探测 understand-anything、CodeGraph、Graphify、CodeMap、GitNexus 等工具并登记入 config(`code_intel_tools`),供需求探索与脑暴减少代码索引的 token 消耗;以及 worktree 基础目录的配置化。

## Requirements

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

### Requirement: worktree 基础目录配置

config SHALL 支持 `worktree_dir` 字段(默认 `.claude/worktrees`);init MUST 询问并写入;creating-worktree MUST 经 `resolve-worktree-dir` verb 解析,该 verb 输出 `{dir, source}` 且 `source` MUST ∈ `{config, default}`:`config` 表示键存在,`default` 表示键缺失并返回默认目录——此时 creating-worktree MUST 重新询问用户并经 `write-config` 写回后再继续。该 verb MUST 另输出 `ignore` 字段,表示对 worktree_dir 的 gitignore 校验结果,且校验判定 MUST 三分支:
- worktree_dir 在仓库根之外 → `ignore.scope` MUST 为 `"outside"`,creating-worktree MUST 静默继续;
- worktree_dir 在仓库根之内且未被忽略 → `ignore.scope` MUST 为 `"inside"` 且 `ignore.ignored` MUST 为 `false`,creating-worktree MUST 警告并建议加入 `.gitignore` 后询问用户是否继续;
- worktree_dir 在仓库根之内且已被忽略 → `ignore.scope` MUST 为 `"inside"` 且 `ignore.ignored` MUST 为 `true`,creating-worktree MUST 静默继续。

判定「仓库外」时 MUST NOT 调用 `git check-ignore`。

#### Scenario: 默认值
- **WHEN** init 时用户未自定义 worktree 目录
- **THEN** `worktree_dir` MUST 写为 `.claude/worktrees`

#### Scenario: source=config 直接使用
- **WHEN** config.json 含 `worktree_dir`
- **THEN** `resolve-worktree-dir` MUST 返回该值且 `source` 为 `config`,creating-worktree 直接使用

#### Scenario: source=default 重问写回
- **WHEN** config.json 中 `worktree_dir` 键缺失,执行 creating-worktree
- **THEN** `resolve-worktree-dir` MUST 返回 `{dir: ".claude/worktrees", source: "default"}`,命令 MUST 重新询问 worktree 目录,经 write-config 写回 config 后继续创建流程

#### Scenario: worktree_dir 在仓库外
- **WHEN** `worktree_dir` 配置为仓库根之外的路径
- **THEN** `ignore.scope` MUST 为 `"outside"`,creating-worktree MUST 静默继续

#### Scenario: worktree_dir 在仓库内且未忽略
- **WHEN** `worktree_dir` 在仓库根之内且未被 `.gitignore`/`info/exclude` 忽略
- **THEN** `ignore` MUST 为 `{scope: "inside", ignored: false}`,creating-worktree MUST 警告并询问用户是否继续

#### Scenario: worktree_dir 在仓库内且已忽略
- **WHEN** `worktree_dir` 在仓库根之内且已被忽略
- **THEN** `ignore` MUST 为 `{scope: "inside", ignored: true}`,creating-worktree MUST 静默继续
