# Design: runtime-data-lifecycle

## Context

memory.mjs 现有 read/write/list/rename 四函数,无任何删除路径;`listMemory` 只枚举 `_exploring__*.md`(exploring 命令的 topic 选择用),34 个文件中 26 个已完成分支的记忆完全不可见。`backupConfig` 是无界 copyFile(本仓现值 0 份,系手动清理)。同名需求跨 session 优先选既有 topic 的规则让陈旧探索记忆成为「会误导的活数据」。

## Goals

- 已完成分支的 memory 可见、可清理;不引入自动删除(破坏性动作必须显式)。
- `topics` 输出形状零变化(exploring/proposing 等既有消费方不动)。
- 备份有界(最新 5 份),无需用户新配置。

## Non-Goals

- memory 内容压缩/摘要(那是知识蒸馏的职责,输入是 speccode/archive 不是 .speccode/memory)。
- 自动 GC(状态推进到 completed 时静默删 memory)——破坏性,违背「绝不静默删除」家族纪律。
- `_knowledge.md` / `_exploring` 主题的清理策略——它们无 state 生命周期,仅展示为 `completed:null`。
- sdd/(已随 worktree 清理)与 state 文件(已有 delete-state)的 lifecycle——不在本变更。

## Decisions

1. **purge-memory 用 flag 形态而非 --json-stdin**:对齐同族破坏性 verb `delete-state`(`--branch <F>` flag、无 payload);「写 verb 必须 --json-stdin」约束的是携带 JSON payload 的写 verb(rename-memory 需要校验 `{}` 通道),purge 无 payload 可携带。
2. **completed 标注在 verb 层连接,不下沉 memory.mjs**:标注 = memory 键 ↔ state 登记的 join,纯 CLI 编排;memory.mjs 保持无 state 依赖(单测面干净)。`completed:null` 表示无 state 对应(_exploring/_knowledge)。
3. **轮转常量 BACKUP_KEEP=5 不进 config**:避免为「运维细节」扩 config 字段集;5 份对幂等 init+reset 的备份节奏绰绰有余。被否备选:config 可调——又一个要写进字段集、双语文档与迁移说明的字段,收益配不上成本。
4. **幂等语义**:purge 对不存在文件返回 `{ok:true, purged:false}`(与 tick-task 的 already、rename-memory 的幂等哲学一致),不报错。

## Risks

- **误删在用 memory** → 缓解:purge 单条显式指定分支键,经 `validateMemoryBranch` 校验;status 只「提示数量」不列可执行批量;不存在 `--all` 形态(刻意)。
- **备份轮转删掉用户想留的备份** → 缓解:保留窗口 5 份且仅删同前缀 `config.json.bak.*` 更旧者;备份本身是「最近一次改写前快照」,时序越旧价值越低。

## Open Questions

无。
