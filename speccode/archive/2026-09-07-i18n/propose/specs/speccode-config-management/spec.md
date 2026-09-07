## MODIFIED Requirements

### Requirement: config.json 字段集

`.speccode/config.json` MUST 包含以下字段:
- `version: 3`
- `initialized_at`: ISO 8601 UTC 时间戳
- `trunk`: 主干分支名,默认 `"main"`
- `remote`: git remote 名,默认 `"origin"`
- `pr_tool`: `"gh" | "glab" | "none"`
- `worktree_dir`: worktree 基础目录,默认 `".speccode/worktrees"`
- `code_intel_tools`: 数组,init 探测并经用户确认登记的代码智能工具(可为空数组)

可选字段:`hooks`(事件名 → shell 命令字符串;缺失视为全部事件无 hook,见 hook-event-integration);`host`(宿主身份,枚举 `claude-code | codex | zcode | opencode | pi | kimi-code | generic`,由 init 探测并经用户确认写入;缺失视为未记录,走与 `claude-code` 相同的全量探测,见 host-detection);`language`(工件语言,BCP-47 语言标签自由 tag,格式经 lib 校验,由 init 经用户确认写入;缺失视为未记录,工件语言跟随交互语言,见「language 字段校验与登记」)。

`display`、`spec_tools`、`untracked_permanent` 三个 v1 字段与 `worktree_prefix` v2 字段 MUST NOT 出现在 `version: 3` 的 config 中(v2 读兼容见「state v2 兼容读取与迁移」)。

#### Scenario: 首次 init 后字段齐备
- **WHEN** 用户执行 `/speccode:init` 并完成所有询问
- **THEN** `.speccode/config.json` MUST 存在,`version` 为 `3`,包含上述全部字段(hooks 仅在用户选择配置时存在;host 为探测并经用户确认的枚举值;language 仅在用户选择登记时存在),MUST NOT 含 `worktree_prefix`

#### Scenario: v2 升级 v3 的字段 diff
- **WHEN** v2 config(含 worktree_prefix)存在时二次执行 init
- **THEN** 命令 MUST 逐字段展示 diff:`worktree_prefix` 标记移除,经用户确认后写入 `version: 3`

#### Scenario: 拒绝升级则整体保持 v2
- **WHEN** 二次 init 时用户拒绝对 config 的任何修改
- **THEN** config MUST 保持 v2 原样(`version: 2`);一旦接受升级(`version: 3`),`worktree_prefix` MUST 被移除,不存在「version: 3 但保留该字段」的混合态

#### Scenario: worktree_dir 缺省中性
- **WHEN** config 存在但不含 `worktree_dir` 字段(或字段被手删)
- **THEN** `speccode resolve-worktree-dir --cwd .` 返回 `dir: ".speccode/worktrees"`、`source: "default"`;对账与创建命令按同一缺省解析

## ADDED Requirements

### Requirement: language 字段校验与登记

config 的 `language` 字段 MUST 经 lib 纯函数格式校验:BCP-47 语言标签(主子标签为 2-3 个小写字母,可附连字符分隔的后续子标签),非法值 MUST 被写 verb 拒绝(`{ok:false, error}` + 非零退出)且不落盘。`language` 的登记 MUST 走 init 询问:推荐值取自当前会话的用户语言(而非 LANG/LC_* 等环境变量),经用户确认后写入;二次 init 按既有字段级幂等 diff 处理该字段。`language` 缺失 = 未记录,工件语言跟随交互语言,MUST NOT 存在其他隐式缺省语言。

#### Scenario: 非法 language 被拒绝
- **WHEN** write-config 收到 `language: "not a tag!"` 或空串
- **THEN** 返回 `{ok:false, error}` 且 config.json 不被修改

#### Scenario: init 登记推荐自对话
- **WHEN** 用户以中文执行 init 并选择登记 language
- **THEN** 命令 MUST 以对话语言为推荐值(如 zh)询问,经确认后写入 config

#### Scenario: 缺失无隐式缺省
- **WHEN** config 无 `language` 字段时命令产工件
- **THEN** 工件语言 MUST 跟随交互语言,引擎与命令 MUST NOT 注入任何缺省语言值
