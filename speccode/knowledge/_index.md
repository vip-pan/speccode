# 知识索引

## development
- 架构 → development/architecture.md:双层分支拓扑与 children 派生、对账路径识别(v3-only)、四文件文档架构分工(README 骨架 #64 后实扫)、hooks 两家族、知识集能力键制、Tier 分层、引擎双前端(CLI+MCP)与 SDD 伴生脚本、session-memory 模型
- 准则 → development/standards.md:shim 调用约定(speccode <verb> + 伴生脚本例外)、版本发布纪律与轻档(双 manifest 版本同步)、命令规范(name 键契约+英文门面+工件 config.language+lib 语言中立)、多语言实扫锚、落盘即 commit、memory 两模式原子写(append 走 O_APPEND)、TDD、marker 纪律、frontmatter 元数据不蒸馏、幂等补救、清洗准则、prose 宿主中立
- 环境 → development/environment.md:单仓三合一、config 标记语义(必填仅 version+initialized_at;trunk/remote/code_intel_tools 已删,default-branch 运行时探测)、worktree 缺省中性单源、文档目录布局、hooks 层、visual companion、README VHS demo、六宿主 adapter(ZCode 官方形态已核销)与双通道(PATH/MCP)+ lite 降级锚点
- 对接 → development/integrations.md:pr_tool 探测与五态轮询、hooks 事件载荷、代码智能探测退役与会话可见性咨询、SDD 伴生脚本与 ledger 脚本化、memory 数据模型、PreToolUse updatedInput
- 坑 → development/pitfalls.md:归属判定退役教训、集成期撞 main、git clean 丢配置、验证以提交树为准、tracked 文件清理、计数漂移、fence 误勾、children 竞态、GLM CR 注入、蒸馏失真、条目分隔、本机有不等于已集成、变体措辞绕过字面守卫、宽骨架闲置教训
- 安全 → development/security.md:worktree 清理来源限定、pr_tool=none 降级、hooks warn-only 威胁模型、memory untracked 防泄漏、references 自包含与 scheme 门禁、路径遍历防护、清洗 fail-open、缺省 worktree_dir 安全网(.speccode/worktrees)
