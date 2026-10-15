# speccode-config-management Delta: runtime-data-lifecycle

## MODIFIED Requirements

### Requirement: 备份机制

`backupConfig` 在生成新备份 `config.json.bak.<timestamp>` 后 SHALL 执行轮转:同目录下同前缀 `config.json.bak.*` 仅保留最新 `BACKUP_KEEP`(=5,单源常量)份,更旧者删除;轮转按文件名内时间戳排序,与生成时序一致。config 不存在时返回 `null` 的既有行为不变;轮转删除 MUST 仅匹配 `config.json.bak.` 前缀,绝不触碰其他文件。

#### Scenario: 超过保留窗口的备份被轮转

- **WHEN** 目录中已存在 5 份 `config.json.bak.*` 且再次调用 `backupConfig`
- **THEN** 新备份写入后目录内恰有 6→5 份该前缀文件,最旧一份被删除,其余文件不受影响

#### Scenario: 不足窗口时零删除

- **WHEN** 目录中 `config.json.bak.*` 少于等于 5 份时调用 `backupConfig`
- **THEN** 仅新增一份备份,不删除任何既有文件
