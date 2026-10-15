# speccode-config-management Delta: host-neutral-engine

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

可选字段:`hooks`(事件名 → shell 命令字符串;缺失视为全部事件无 hook,见 hook-event-integration);`language`(工件语言,BCP-47 语言标签自由 tag,格式经 lib 校验,由 init 经用户确认写入;缺失视为未记录,工件语言跟随交互语言,见「language 字段校验与登记」)。

`display`、`spec_tools`、`untracked_permanent` 三个 v1 字段、`worktree_prefix` v2 字段与 `host` 字段 MUST NOT 出现在 `version: 3` 的 config 中(v2 读兼容见「state v2 兼容读取与迁移」;`host` 随 host-neutral-engine 退役,幂等 init 经字段 diff 剥离)。

#### Scenario: 首次 init 后字段齐备

- **WHEN** 用户执行 `/speccode:init` 并完成所有询问
- **THEN** `.speccode/config.json` MUST 存在,`version` 为 `3`,包含上述全部字段(hooks 仅在用户选择配置时存在;language 仅在用户选择登记时存在),MUST NOT 含 `worktree_prefix` 或 `host`

#### Scenario: v2 升级 v3 的字段 diff

- **WHEN** v2 config(含 worktree_prefix)存在时二次执行 init
- **THEN** 命令 MUST 逐字段展示 diff:`worktree_prefix` 标记移除,经用户确认后写入 `version: 3`

#### Scenario: 拒绝升级则整体保持 v2

- **WHEN** 二次 init 时用户拒绝对 config 的任何修改
- **THEN** config MUST 保持 v2 原样(`version: 2`);一旦接受升级(`version: 3`),`worktree_prefix` MUST 被移除,不存在「version: 3 但保留该字段」的混合态

#### Scenario: 遗留 host 字段的幂等剥离

- **WHEN** v3 config 含历史遗留的 `host` 字段时二次执行 init
- **THEN** 字段 diff MUST 将 `host` 标记移除,经用户确认后写入不含 `host` 的 v3 config;引擎各 verb 对含 `host` 的既有 config 读取时 MUST NOT 报错(字段被忽略)

#### Scenario: worktree_dir 缺省中性

- **WHEN** config 存在但不含 `worktree_dir` 字段(或字段被手删)
- **THEN** `speccode resolve-worktree-dir --cwd .` 返回 `dir: ".speccode/worktrees"`、`source: "default"`;对账与创建命令按同一缺省解析
