# Tasks: runtime-data-lifecycle

## 引擎

- [x] `lib/config.mjs`:`backupConfig` 增加轮转(`BACKUP_KEEP=5` 导出常量;仅匹配 `config.json.bak.` 前缀按时间戳保留最新 5 份)
- [x] `lib/memory.mjs`:新增 `purgeMemory(speccodeDir, branch)`(校验分支键;删除文件返回 `{purged:true,path}`;缺失返回 `{purged:false}`)

## CLI

- [x] `bin/speccode.mjs`:新增 `purge-memory` verb(flag 形态对齐 `delete-state`);`list-memory` 输出增 `files` 数组(verb 层经 state 连接派生 `completed`,`topics` 形状不变)

## 测试(TDD:先红后绿)

- [x] `tests/config.test.mjs`:轮转两场景(超窗口删最旧 / 不足窗口零删除 + 前缀隔离)
- [x] `tests/memory.test.mjs`:`purgeMemory` 删除/幂等/非法分支键
- [x] `tests/cli.test.mjs`:`purge-memory` verb 端到端;`list-memory` files 标注(completed true/false/null 三态)+ topics 形状回归

## 命令层

- [x] `skills/status/SKILL.md`:报告段加一行——滞留的已完成分支 memory 数量与 `purge-memory` 提示
- [x] `skills/finishing-worktree/SKILL.md`:MERGED 清理后提示「本分支 memory 可经 purge-memory 清理(可选)」

## 验收

- [x] 全量测试绿;手动冒烟:list-memory 三态标注、purge 幂等、备份轮转
