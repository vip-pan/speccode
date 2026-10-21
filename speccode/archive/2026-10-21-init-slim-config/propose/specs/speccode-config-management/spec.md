# speccode-config-management Delta: init-slim-config

## MODIFIED Requirements

### Requirement: config.json 字段集

`.speccode/config.json` MUST 包含以下字段:
- `version: 3`
- `initialized_at`: ISO 8601 UTC 时间戳

init 默认写入(形状上可选、缺省语义由消费方定义):`pr_tool`(`"gh" | "glab" | "none"`,init 经 remote URL 猜测并经用户确认写入;`query-pr` 在缺失或 `none` 时拒绝实际查询)、`worktree_dir`(worktree 基础目录,缺省 `".speccode/worktrees"` 由 `resolve-worktree-dir` 单源解析)。

可选字段:`hooks`(事件名 → shell 命令字符串;缺失视为全部事件无 hook,见 hook-event-integration);`language`(工件语言,BCP-47 语言标签自由 tag,格式经 lib 校验,由 init 经用户确认写入;缺失视为未记录,工件语言跟随交互语言,见「language 字段校验与登记」)。

`trunk`、`remote`、`code_intel_tools` 为历史已删除字段:引擎不定义退役字段机制,字段集之外的未知键(含上述三键与更早版本的 `host`、`worktree_prefix`)在读取时按普通未知键容忍与忽略,不产出警告、不被引擎消费、不进 init 字段 diff;init 整体重写 config 时它们自然消失(沿用既有未知键语义,不设特殊清理机制)。

主干分支名 SHALL 经 `default-branch` verb 运行时解析(见「default-branch 运行时探测」),MUST NOT 作为 config 字段存在;git remote 名恒为 `origin`(引擎内单源常量),MUST NOT 作为 config 字段存在。同一项目的 `.speccode/` 因此不含任何宿主或环境耦合字段,多 agent 共用天然成立。

#### Scenario: 首次 init 后最小形状

- **WHEN** 用户执行 `/speccode:init` 并接受全部默认
- **THEN** `.speccode/config.json` MUST 存在,`version` 为 `3`,含 `initialized_at`、`pr_tool`、`worktree_dir`,且不含 `trunk`、`remote`、`code_intel_tools`

#### Scenario: 含历史已删除字段的 config 读取不报错

- **WHEN** config 中残留历史版本的已删除字段(如 `trunk`、`remote`、`code_intel_tools`、`host` 或更早版本的 `worktree_prefix`)
- **THEN** 引擎各 verb 读取该 config 时 MUST 正常工作不报错,该字段被作为未知键忽略,`validateConfigShape` 对其 MUST NOT 产出警告

#### Scenario: worktree_dir 缺省中性

- **WHEN** config 存在但不含 `worktree_dir` 字段(或字段被手删)
- **THEN** `speccode resolve-worktree-dir --cwd .` 返回 `dir: ".speccode/worktrees"`、`source: "default"`;对账与创建命令按同一缺省解析

## ADDED Requirements

### Requirement: default-branch 运行时探测

引擎 SHALL 提供 `default-branch --cwd .` verb(及同名 MCP tool),返回 `{ok, branch, source}`,作为主干分支名的唯一运行时来源。探测链按序:① `git symbolic-ref --short refs/remotes/origin/HEAD` 成功 → 剥 `origin/` 前缀,`source: "remote-head"`;② 本地分支 `main` 存在 → `"main"`,`source: "fallback-main"`;③ 本地分支 `master` 存在 → `"master"`,`source: "fallback-master"`;④ 兜底 `"main"`,`source: "last-resort"`。探测 MUST 仅用本地 git 命令(禁止 `git remote show` 等网络操作),每次调用即时执行、不落盘;命令层对 `last-resort` SHOULD 打印一行提示。确定性逻辑 SHALL 下沉 lib 纯函数并以注入的 git runner 单测。

#### Scenario: remote-head 路径

- **WHEN** 仓库设置了 `refs/remotes/origin/HEAD`(如标准 clone)
- **THEN** `default-branch` 返回其指向的分支名(如 `main` 或 `master`),`source: "remote-head"`

#### Scenario: 未设 origin/HEAD 时本地回退

- **WHEN** 仓库无 `refs/remotes/origin/HEAD` 且本地存在 `master` 分支、不存在 `main`
- **THEN** 返回 `branch: "master"`、`source: "fallback-master"`

#### Scenario: 恒有输出

- **WHEN** ①②③ 全部落空(空仓或异常命名)
- **THEN** 返回 `branch: "main"`、`source: "last-resort"`,exit 0

#### Scenario: prose 消费形态

- **WHEN** 检查 `skills/*/SKILL.md` 中原引用 `config.trunk` 的位置(基点判定、前置校验、路由缺省、trunk 防护)
- **THEN** 一律改为调用 `speccode default-branch --cwd .` 取 `branch` 字段;`skills/` 下 MUST NOT 残留 `config.trunk` 或 `config.remote` 字样
