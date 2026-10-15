# Delta: pr-tool-integration

## MODIFIED Requirements

### Requirement: wait_for_pr_merge 轮询

PR 等待轮询 MUST 在命令层以引擎 `query-pr` verb 单次查询为基础实现:每 30 秒轮询一次 PR/MR 状态,默认 30 分钟超时(约 60 次查询);`--resume` 续跑时 MUST 使用相同轮询间隔。引擎 MUST NOT 提供阻塞式等待形态,等待循环只存在于命令层。

#### Scenario: 轮询间隔
- **WHEN** 命令处于 PR 等待中
- **THEN** 相邻两次 `query-pr` 查询的间隔 MUST 约为 30 秒,以避免触发平台 API rate limit

#### Scenario: 超时中止
- **WHEN** 达到 30 分钟仍未 MERGED
- **THEN** MUST 中止并把挂起状态写入 feature state 的 `pending_operation` 字段
