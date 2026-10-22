# documentation-facade Delta: readme-restructure

## MODIFIED Requirements

### Requirement: 四文件文档架构分工

根 README(EN/CN)= marketplace 用户门面 / docs/DESIGN.md(EN/CN)= 插件设计文档 / AGENTS.md = 开发文档真源 / CLAUDE.md = Claude Code 薄壳。「门面速览 + 深链」模式——根 README 只放速览与链接,完整命令表与风险表留设计文档,两处互链,避免双份维护漂移。**门面与现行架构一致性**:README 与 DESIGN 的描述 MUST 与引擎/skills 实际行为一致——config 字段集为标记语义(必填 `version` + `initialized_at`,init 默认写 `pr_tool`/`worktree_dir`,可选 `hooks`/`language`;`trunk`/`remote`/`code_intel_tools` 仅允许以「历史已删除字段」身份出现于退役叙述);代码智能探测已退役(会话可见性咨询);README 的定位句 SHALL 以「纯 prose 插件核 + 可挂载引擎」为新身份(lite 可用性在第一屏可见);Install 段 SHALL 按三段递进组织(安装插件 → lite 即用 → 编排时加引擎,双通道);Why 段 MUST 含 lite 降级与 MCP 前端两条卖点;对比表 SHOULD 含 lite 与 MCP 能力行;Quickstart 示例输出 MUST 与现行 init 输出一致(不含已删除字段)。双语结构一一对应(段落数同数同序,成对修改),MUST NOT 硬编码版本号与测试数量。

#### Scenario: 守卫与文档联动
- **WHEN** DESIGN 双语改写为标记语义后运行 cli.test 的 DESIGN 守卫
- **THEN** 守卫断言 DESIGN **不含** `code_intel_tools` 字段集描述、**含**「历史已删除字段」短语;knowledge_tools/knowledge-base/知识库工具 禁令保留

#### Scenario: README 叙事结构
- **WHEN** 检查 README 双语的定位句与 Install 段
- **THEN** 定位句含「pure-prose / 纯 prose」与「mountable engine / 可挂载引擎」表述且 lite 在第一屏可见;Install 段呈三段递进(插件安装 → lite 即用 → 编排加引擎);Quickstart 输出无 trunk/remote/code_intel_tools

#### Scenario: 对比表能力行
- **WHEN** 检查 README 双语对比表
- **THEN** 含 lite(无引擎文档流)与 MCP(server 镜像 verb)两行

#### Scenario: 双语成对
- **WHEN** 任一语言版本发生本变更范围内的改动
- **THEN** 另一语言版本在同一提交内成对修改,段落数不变
