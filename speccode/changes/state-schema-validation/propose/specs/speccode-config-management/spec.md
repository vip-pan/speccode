# speccode-config-management Delta: state-schema-validation

## ADDED Requirements

### Requirement: state/config 形状契约与校验

引擎 SHALL 提供两个纯函数形状校验器,产出警告字符串数组、MUST NOT 抛错:

- `validateStateShape(state)`:v3 普通分支必填 `branch`(与登记键一致)、`type` ∈ TYPES 枚举、`worktree`(string|null)、`merge_target`、`status` ∈ 状态枚举、`created_at`(ISO 8601)、`initial_branch`;父实体(`kind:"integration"`)必填 `children`( `{slug}` 数组)且 MUST NOT 含 `worktree`;时间戳字段非 ISO、未知顶层键各产出一条警告;v2 形状(`feature_branch` 键)返回单条迁移提示,不套 v3 契约。
- `validateConfigShape(config)`:退役字段(`worktree_prefix`/`host`/`display`/`spec_tools`/`untracked_permanent`)在场、`pr_tool` 非枚举、`trunk`/`remote`/`worktree_dir` 非字符串、`code_intel_tools` 非数组、`hooks` 非字符串映射、`language` 非字符串各产出警告;`version` 非 3 产出提示级警告(v1/v2 读兼容)。

引擎 SHALL 提供只读 verb `lint-state --cwd .`:输出 `{ok, config:{warnings}, states:[{branch,warnings}]}`,扫描 `state/branches/` 与 `state/features/` 全部条目。

`writeState` SHALL 在写入前对 v3 形状 payload 做门禁(违规抛错,不落盘):`branch` 与登记键不一致、`status` 非法、`type` 非法、`created_at` 非 ISO、父实体 `children` 非数组;未知顶层键与可选键(`completed_at`/`pr_number`/`note`/`pending_operation`)MUST NOT 被拒绝;v2 形状 payload 原样放行。`readState`/`loadConfig` 的返回形状与容错语义 MUST NOT 因本变更改变。

#### Scenario: lint-state 报告退役字段与坏枚举

- **WHEN** config 含 `host` 遗留字段,某 state 条目 `status` 为 `"done"`(非法枚举)
- **THEN** `lint-state` 输出的 `config.warnings` 含 host 退役提示,该条目 `warnings` 含 status 非法警告;exit 0 不抛错

#### Scenario: writeState 门禁拒绝键不一致

- **WHEN** 经 `write-state --branch feature/a` 写入 payload 的 `branch` 为 `feature/b`
- **THEN** verb 返回 `{ok:false,error}`,不落盘任何文件

#### Scenario: 未知顶层键不拦截

- **WHEN** v3 payload 含合法必填集与额外 `note` 字段,经 `write-state` 写入
- **THEN** 写入成功;`validateStateShape` 对该条目产出一条未知键提示级警告

#### Scenario: 读路径零变化

- **WHEN** 对含坏形状条目的仓库执行既有 `read-state` / `reconcile`
- **THEN** 行为与本变更前完全一致(校验不进读路径)
