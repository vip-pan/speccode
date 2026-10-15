# Delta: speccode-config-management

## MODIFIED Purpose

`.speccode/config.json` 与 `state/branches/*.json` 的读写策略:字段集、按分支维度隔离、原子写、备份、init 字段级幂等、路径识别对账、worktree 状态枚举、pending_operation 挂起态、ISO 8601 时间戳。

(本段为显式修订:删除「与 v2→v3 迁移」字样,与 REMOVED「state v2 兼容读取与迁移」保持一致;syncing 按 delta 覆盖语义执行并在摘要明示。)

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

引擎不定义退役字段机制:字段集之外的未知键(含历史版本的已删除字段)在读取时按普通未知键容忍与忽略,不产出警告、不参与 init 字段 diff,也不被引擎消费。

#### Scenario: 首次 init 后字段齐备

- **WHEN** 用户执行 `/speccode:init` 并完成所有询问
- **THEN** `.speccode/config.json` MUST 存在,`version` 为 `3`,包含上述全部字段(hooks 仅在用户选择配置时存在;language 仅在用户选择登记时存在)

#### Scenario: 含历史已删除字段的 config 读取不报错

- **WHEN** config 中残留历史版本的已删除字段(如 `host` 或更早版本的 `worktree_prefix`)
- **THEN** 引擎各 verb 读取该 config 时 MUST 正常工作不报错,该字段被作为未知键忽略,`validateConfigShape` 对其 MUST NOT 产出警告

#### Scenario: worktree_dir 缺省中性

- **WHEN** config 存在但不含 `worktree_dir` 字段(或字段被手删)
- **THEN** `speccode resolve-worktree-dir --cwd .` 返回 `dir: ".speccode/worktrees"`、`source: "default"`;对账与创建命令按同一缺省解析

### Requirement: state/branches 文件隔离

每条 active 分支 MUST 有独立的 `.speccode/state/branches/<type>__<slug>.json` 文件,文件名格式 MUST 为 `<type>__<slug>`(type 与 slug 之间用双下划线 `__` 分隔;slug 内的连字符保留)。普通分支 state MUST 含 `branch`(全名)、`type`、`worktree`(worktree 绝对路径)、`merge_target`(恒写:普通分支 MUST 写 config.trunk,集成分支的子分支 MUST 写其集成分支名)、`status`、`created_at`、`initial_branch`;父实体 state MUST 含 `branch`、`kind: "integration"`、`children`(数组,条目仅 `{slug}` 纯身份登记——状态不存于父实体,唯一真源为各子分支 state)、`status`、`created_at`、`initial_branch`,MUST NOT 含 `worktree`。

#### Scenario: 并行多个分支
- **WHEN** 用户并行开发 feature/payment 与 feature/auth
- **THEN** `.speccode/state/branches/` 下 MUST 存在 `feature__payment.json` 与 `feature__auth.json` 两个独立文件

#### Scenario: 父实体不含 worktree 字段
- **WHEN** 集成分支 `feature/mkt-req` 的父实体 state 被读取
- **THEN** 该 state MUST 含 `kind: "integration"` 与 `children` 数组,MUST NOT 含 `worktree` 字段

#### Scenario: slug 含连字符不撞名
- **WHEN** 用户开发 feature/pay-ment
- **THEN** state 文件 MUST 为 `feature__pay-ment.json`,双下划线保证 type 与 slug 分隔无歧义

### Requirement: 写文件原子性

任何对 `.speccode/config.json` 或 `state/branches/*.json` 的写入 MUST 采用"写临时文件 + `mv` 覆盖"模式,避免半写半旧。

#### Scenario: 写入过程异常退出
- **WHEN** AI 进程在写入 config.json 时被 kill
- **THEN** `config.json` MUST 保持写入前的完整旧内容(由 `mv` 原子性保证),不留半写状态

### Requirement: init 字段级幂等
`/speccode:init` 二次执行时 MUST 按字段逐个询问 `[旧值]→[新值]` diff,而非整体覆盖。`state/` 目录在二次 init 时 MUST 不被清空。

#### Scenario: 字段未变化
- **WHEN** 二次 init 时某字段值与之前一致
- **THEN** 命令 MUST 跳过该字段,不写入

#### Scenario: 字段值变化
- **WHEN** 二次 init 时 `trunk` 字段从 `"master"` 变为 `"main"`
- **THEN** 命令 MUST 显示 diff 并询问用户确认是否更新,只有用户确认后才写入

#### Scenario: 二次 init 不影响 state
- **WHEN** 二次 init 时 `.speccode/state/branches/feature__payment.json` 存在
- **THEN** 该文件 MUST 在 init 过程中不被读取、修改或删除

### Requirement: 对账算法

每个涉及分支的命令(`/speccode:creating-worktree`、`/speccode:finishing-worktree`、`/speccode:finishing-feature`、`/speccode:status`)开头 MUST 执行「state ↔ git」对账,扫描 `git worktree list --porcelain` 与 `state/branches/*.json`,自动补齐/标记不一致项,并推进 `pr_open` 的分支。管辖识别 MUST 为路径识别:路径位于 `config.worktree_dir` 之下的 worktree 为 speccode 管辖;worktree_dir 缺失时 MUST 回退默认值 `".speccode/worktrees"`(相对路径按仓库根解析;与 `resolve-worktree-dir` 的缺省同源单常量),对账 MUST NOT 因 config 缺失而失败。分支名前缀与 ancestry 判定 MUST NOT 参与识别(v3 中 worktree↔state 为 1:1);父实体(无 worktree 的集成分支)MUST 由 state 侧识别。

#### Scenario: worktree 在 git 中但不在 state 中
- **WHEN** git worktree list 含路径位于 worktree_dir 之下的 worktree,但 state 中无记录
- **THEN** 对账 MUST 将其计入 orphans 并提示用户处理(半截创建),MUST NOT 静默补齐

#### Scenario: worktree 在 state 中但不在 git 中
- **WHEN** state 中有非 `completed` 分支但 git worktree list 不存在对应 worktree
- **THEN** 对账 MUST 标 `orphaned`,提示用户手动处理

#### Scenario: 对账推进 pr_open 分支
- **WHEN** 对账遇到状态为 `pr_open` 的分支,且查询其 `pr_number` 得到 MERGED
- **THEN** 对账 MUST 把该分支推进为 `completed`(记 `completed_at`),清理动作由命令层执行

#### Scenario: 对账回退被关闭的 pr_open
- **WHEN** 对账遇到 `pr_open` 的分支,但其 PR 状态为 CLOSED(未合并)
- **THEN** 对账 MUST 把该分支回退为 `in_progress` 并提示用户 PR 已关闭

#### Scenario: 无 config 时对账不崩溃
- **WHEN** `.speccode/config.json` 不存在
- **THEN** 对账 MUST 以默认 `worktree_dir: ".speccode/worktrees"` 正常执行,不报错退出

#### Scenario: merge_target 缺失计入 orphan
- **WHEN** 某分支 state 的 `merge_target` 指向的集成分支在 git 中不存在
- **THEN** 对账 MUST 将其计入 orphans 并报告

#### Scenario: 遗留旧格式 state 目录完全隐形
- **WHEN** `.speccode/state/features/`(旧格式遗留目录)存在且含 JSON 文件
- **THEN** 对账 MUST 完全忽略该目录(不扫描、不报告 orphan、不报错),输出等价于该目录不存在

### Requirement: pending_operation 挂起状态

当长阻塞操作(等 PR 合并)超时或被中断时,命令 MUST 把挂起状态写入对应 feature state 文件的 `pending_operation` 字段,结构为 `{ command, phase, pr_number, updated_at }`,其中 `command` MUST ∈ `{finishing-worktree, finishing-feature}`,`phase` MUST ∈ `{waiting_worktree_pr, waiting_trunk_pr}`。`--resume` MUST 从该字段恢复。

#### Scenario: finishing-feature 超时写入挂起状态
- **WHEN** `/speccode:finishing-feature` 等待 PR→trunk 合并超时
- **THEN** feature state 文件 MUST 含 `pending_operation.command = "finishing-feature"`、`phase = "waiting_trunk_pr"` 及对应 `pr_number`

#### Scenario: resume 从挂起状态续跑
- **WHEN** 用户执行 `/speccode:finishing-feature --resume` 且该 feature 存在 `pending_operation`
- **THEN** 命令 MUST 从 `phase` 指示的步骤继续,不重复已完成的阶段

#### Scenario: 成功完成清除挂起状态
- **WHEN** finishing-feature 或 finishing-worktree 全部成功完成
- **THEN** `pending_operation` 字段 MUST 被清除(或随 feature state 文件删除而消失)

### Requirement: state/config 形状契约与校验

引擎 SHALL 提供两个纯函数形状校验器,产出警告字符串数组、MUST NOT 抛错:

- `validateStateShape(state)`:v3 普通分支必填 `branch`、`type` ∈ TYPES 枚举、`worktree`(string)、`merge_target`、`status` ∈ 状态枚举、`created_at`(ISO 8601)、`initial_branch`;父实体(`kind:"integration"`)必填 `children`( `{slug}` 数组)且 MUST NOT 含 `worktree`;时间戳字段非 ISO、`worktree` 非字符串、未知顶层键各产出一条警告。
- `validateConfigShape(config)`:`pr_tool` 非枚举、`trunk`/`remote`/`worktree_dir` 非字符串、`code_intel_tools` 非数组、`hooks` 非字符串映射、`language` 非字符串各产出警告。

引擎 SHALL 提供只读 verb `lint-state --cwd .`(时间戳校验为形状级——`Z` 结尾 ISO 形态;不校验语义日期;不可解析的 JSON 文件 MUST 被描述为 `unparseable JSON` 警告而非报错):输出 `{ok, config:{warnings}, states:[{branch,warnings}]}`,仅扫描 `state/branches/` 条目。

`writeState` SHALL 在写入前对 payload 做门禁(违规抛错,不落盘),门禁对一切 payload 统一生效、不区分形状:payload `branch` 与登记键(`--branch` 参数)不一致、`status` 非法、`type` 非法、`created_at` 非 ISO、父实体 `children` 非数组;未知顶层键与可选键(`completed_at`/`pr_number`/`note`/`pending_operation`)MUST NOT 被拒绝。`readState`/`loadConfig` 的返回形状与容错语义 MUST NOT 因本变更改变。

#### Scenario: lint-state 报告坏枚举

- **WHEN** 某条目 `status` 为 `"done"`(非法枚举)
- **THEN** `lint-state` 输出的该条目 `warnings` 含 status 非法警告;exit 0 不抛错

#### Scenario: lint-state 不扫描旧格式目录

- **WHEN** `.speccode/state/features/` 存在且含条目
- **THEN** `lint-state` 输出的 `states` MUST NOT 含来自该目录的条目

#### Scenario: writeState 门禁拒绝键不一致

- **WHEN** 经 `write-state --branch feature/a` 写入 payload 的 `branch` 为 `feature/b`
- **THEN** verb 返回 `{ok:false,error}`,不落盘任何文件

#### Scenario: 未知顶层键不拦截

- **WHEN** v3 payload 含合法必填集与额外 `surprise` 字段(未知键),经 `write-state` 写入
- **THEN** 写入成功,`validateStateShape` 对 `surprise` 产出 informational 警告

## REMOVED Requirements

### Requirement: state v2 兼容读取与迁移

(整体移除:v2 双格式读兼容、`state/features/` 原样读写、`migrate-state` 一次性迁移及其预览/确认/跳过规则。旧格式目录在新版本完全隐形,无迁移工具。)

### Requirement: legacy pending_operation 规范化

(整体移除:`normalizeState()` 对 v0.1 旧命令名(`develop-complete`/`finish`)的归一化与 `waiting_display_pr` 挂起态的引擎侧保留语义。引擎读路径不再规范化任何遗留数据。)
