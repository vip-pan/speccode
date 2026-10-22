# Design: readme-restructure

## Context
README 双语 15 段结构(#64 重排后:Install→Prerequisites→Quickstart→What Lands→Why→Basic Workflow→See It in Action→Commands→Topology→Compare→Philosophy→Doc Map→git clean→Contributing→License),内容已与现行架构一致(docs-i18n);问题纯在叙事结构。demo.tape 四 fixture(d1=init)是旧输出;README console 文字稿已改但 GIF 未重录。守卫:README 措辞(code intelligence)、DESIGN 禁令、段数成对。

## Decisions
D1 三段递进 Install 取代「CC 命令 + 尾部长段」:插件(所有宿主第一步)→ lite 即用 → 编排加引擎;marketplace 命令保留在 ①;旧 Other-agents 段并入 ③(双通道内容不变)。D2 定位句一词锚「pure-prose core + mountable engine」,lite 进第一屏一句(不展开——Why 详述)。D3 对比表 +2 行(位置:SDD 行前后,能力列名不变)。D4 demo.tape d1 改标记语义 fixture;README console 块与 caption 不变;vhs 在场则重录(一条命令),缺则 tape 源就位、GIF 标后续(不阻塞)。D5 Quickstart 插一句括号 lite 提示,不加步骤号。

## Non-Goals
DESIGN/AGENTS 改动;知识刷新;版本 bump;守卫新增(既有守卫回归即可)。
