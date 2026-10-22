# Design: docs-i18n

## Context

四份门面(README EN/CN 各 ~14 段、DESIGN EN/CN 各 14 节)结构一一对应(多语言实扫锚纪律:段落数同数同序,成对改)。已知过时点:DESIGN.md:181/234(与 CN:181/233)字段集与探测;README Quickstart 输出(:65-66 CN 同);install 段(:18)缺 MCP/lite;cli.test:970-985 守卫钉死 `code_intel_tools` 在 DESIGN 中**必须存在**。约束:两版均不得硬编码版本号与测试数量;守卫翻转必须与文档同一提交(否则任一方向都红)。

## Goals

- 四门面与新架构一致(标记 config、探测退役、lite、MCP、memory worktree 归属、SDD 伴生脚本)。
- EN/CN 成对,段落数不变(增补在段内,不加新段——Why 段补两条属于段内条目)。
- 守卫翻转一次到位,全量绿。

## Non-Goals

- 知识刷新(chore);VHS demo 重录(README demo 三件套的 transcript 若含旧输出——实扫后仅在明显失真时改文字稿,GIF 不重录,标注后续);版本 bump;npm 发布。

## Decisions

**D1. DESIGN 改「现行描述 + 历史脚注」而非删节。** §9 整节保留但改写为退役叙述(章节号不能变——双语锚是段落数);§5 字段集段落在原位重写。被否:删节(锚漂移)。

**D2. README Why 段补 lite/MCP 两条条目(段内,不改段数)。** Quickstart 输出仅改那一行与 init 注释;install 段重写那一段(段内)。

**D3. 守卫翻转 = 改断言不改测试名。** `code_intel_tools` 必须含 → 必须不含(且「历史已删除字段」短语必须含——证明新叙述在场);knowledge_tools/knowledge-base/知识库工具 禁令保留。

**D4. 其余过时点以实扫清单为准执行**(proposing 已列已知点;执行时 grep 交叉核对,发现新的按同一原则处理并在报告列全)。

## Risks

- 双语段落漂移 → 成对提交、以一方为纲逐段核对;守卫只钉关键词不钉段数(既有纪律),但执行者自查段数。
- 改漏(门面长文档)→ D4 的交叉 grep 清单(字段名/verb 名/旧形态全量扫)。

## Open Questions

- 无。
