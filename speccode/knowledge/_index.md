# 知识索引

## 开发方向
- 架构 → development/architecture.md:双层分支拓扑与 children 派生、对账路径识别、四文件文档架构分工、hooks 两家族、知识集能力键制、Tier 分层、引擎三层、session-memory 模型
- 准则 → development/standards.md:shim 调用约定(speccode <verb>)、版本发布纪律与轻档、命令规范实扫一致、多语言实扫锚、落盘即 commit、memory 原子写、TDD、marker 纪律、幂等补救、清洗准则、prose 宿主中立
- 环境 → development/environment.md:单仓三合一(root=插件根=marketplace)、config v3+host 字段、worktree 缺省中性单源、文档目录布局、代码智能探测器表、hooks 层、visual companion、六宿主 adapter 与 PATH shim
- 对接 → development/integrations.md:pr_tool 探测与五态轮询、hooks 事件载荷、探测来源映射与宿主分流、detect-host verb、SDD 工件 verb、memory 数据模型、PreToolUse updatedInput
- 坑 → development/pitfalls.md:归属判定退役教训、集成期撞 main、git clean 丢配置、验证以提交树为准、tracked 文件清理、计数漂移、fence 误勾、children 竞态、GLM CR 注入、蒸馏失真、条目分隔、本机有不等于已集成
- 安全 → development/security.md:worktree 清理来源限定、pr_tool=none 降级、hooks warn-only 威胁模型、memory untracked 防泄漏、references 自包含与 scheme 门禁、路径遍历防护、清洗 fail-open
