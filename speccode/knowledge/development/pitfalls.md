## 手写踩坑

1. 测试中比对 git 解析出的路径时,先用 realpathSync 归一:macOS 上 git rev-parse --show-toplevel 会把 /var 解析为 /private/var,而 os.tmpdir() 不解析符号链接,两边直接相等断言必挂。
2. 写 verb 的 --json-stdin 是布尔 flag(parseArgs 置 true),payload 必须从 stdin 读(JSON.parse(readStdin())),绝不能 JSON.parse(jsonStdin)。

<!-- distilled-from: cap/git-workflow-lifecycle -->
**归属判定教训(已随机制退役,教训保留)**:v0.1-v2 的 ancestry 归属判定在 cherry-pick/rebase 场景误判,squash-only 合并下 git branch --no-merged 永真——v3 改路径识别 ∪ state 登记,「未完成」判定 MUST 基于 state 查询而非 git merge 状态。

**集成期与 main 演进撞车**:大需求集成期长,main 并行合入同类改写(readme-optimization #51 撞 docs-multi-host 的 README 改写)→ finishing-feature 开 PR 即 CONFLICTING。解法 = 评估双方改动面,以 main 上成体系的改写版为基底、把集成侧编辑重移植其上(反向会丢对方整轮优化);合并提交内完成调和后推送,PR 自动更新无需重开;移植时须排查基底版带回的旧路径/旧措辞(基底分支早于扁平化时尤然)。finishing-feature 遇 CONFLICTING 即停下诊断,不打 tag 不切 trunk。(出自 archive/2026-09-06-docs-multi-host 终局)
<!-- /distilled -->

<!-- distilled-from: cap/plugin-packaging -->
**.speccode/ 不在 .gitignore,`git clean -fdx` 会丢配置**:R4 设计决策——运行时数据保持 untracked 且插件不写 .gitignore;缓解 = README 安全警告前置(git clean 警告段)+ dry-run 习惯;git clean -n 先行、显式排除 .speccode/。

**验证以提交树为准,工作树级验证有盲区**:git ls-tree / git grep <sha> 检查提交树,工作树检查会被未提交状态欺骗——flatten 复审 Critical 实证:tracked 文件 rm 只删工作树副本、未 stage 删除,「plugins/ 消失 ✓」的工作树结论在提交树里为假,全新 clone 即复现;规格验收与发布前检查 MUST 对提交树执行(git ls-tree -r <sha> / git grep <pattern> <sha>)。

**tracked 文件清理与防御性移动**:rm 只删工作树副本,删除 tracked 文件 MUST git add -A stage 删除;对 tracked 文件做 mv/rm 前先 git status 确认跟踪状态——把 tracked 文件 mv 走再 merge,merge 会以分支版重建文件(本次无损,但手法不可靠,不应依赖)。(出自 archive/2026-09-04-flatten-repo 复审)
<!-- /distilled -->

<!-- distilled-from: cap/documentation-facade -->
**文档硬编码漂移坑**:根 README 硬编码版本与 plugin.json 漂移;CLAUDE.md 硬编码用例数随测试增减失真;shields 静态 badge 需手工同步重新引入漂移——badges 不含版本号,动态读 plugin.json。**交叉引用漏改坑**:删除文档节后,全文检索对被删节号的交叉引用 MUST 逐一改指新位置,否则悬空引用。**双语漂移坑**:缓解 = 结构对齐(12 段骨架/§1-14 节号)为锚 + 维护纪律 + spec 扩展不漂移。**互链死链坑**:改名后既有链接失效 → 互链矩阵进 spec,实现后逐链验证。**翻译节号错位坑**:插件 README 英文版节号 MUST 与中文版一致,翻译以中文版节号清单为纲。**英文版无残留中文段落坑**(代码块与 toggle 文本除外)。**手维计数漂移根治**:手写计数(requirements 数、用例数)与实际漂移——根治 = 去掉手维计数,每次规格变动不再需手动同步数字(改成新数字是治标)。(出自 archive/2026-08-10-rebrand-visual-companion、2026-08-12-readme-docs-overhaul、2026-08-12-readme-english、2026-08-16-readme-optimization)
<!-- /distilled -->

<!-- distilled-from: cap/speccode-config-management -->
**state legacy 规范化必须在 readState 与 listActiveFeatures 双路径调用**:normalizeState() 只下沉 readState 会有洞——reconcile 走 listActiveFeatures(直接 readJson),其输出 pending_operation.command 仍是旧名,--resume 按新名匹配在主路径失效。waiting_display_pr 的「不可续跑 + 手动收尾指引」写命令 prose(命令层检测 phase 报错),不进引擎(readState 契约是返回 JSON|null,抛错会击穿 feature-progress 与 listActiveFeatures)。(出自 archive/2026-08-09-speccode-v2-sdd-flow)
<!-- /distilled -->

<!-- distilled-from: cap/sdd-document-lifecycle -->
**REMOVED-all 后空壳**:sync 移除全部 requirement 后主 spec 剩 Purpose + 空 Requirements 过不了校验(requirements.min(1));REMOVED 清空后须连 capability 目录一并删除,归档/同步走 agent 流。**BASE 契约**:requesting-code-review 原文 HEAD~1 取 BASE 的示例必须改写为「调用方记录的 BASE」——HEAD~1 在有新 commit 后指向错误 base;review-package verb 接受 --base <sha> --head <sha>,range 命名 review-<shortbase>..<shorthead>.diff。**brainstorming 检查清单提交顺序**:HARD-GATE(呈现设计并获用户批准之前禁止实现类命令)必须在提交之前;标签应为「批准后提交(落盘即 commit)」——brainstorming 有用户审阅门在提交前。**syncing 护栏首句与双路径 add 对齐**:「syncing 只动 speccode/spec/」与落盘段双路径 add(git add speccode/spec/ speccode/changes/<slug>/)自相矛盾——修正为「规格合并只动 spec/;brainstorm 残余吸收的回写落在 changes/,一并提交」;propose/ 不存在(纯 brainstorming 路径)时若 brainstorm/ 存在以其文档提炼 delta,两者都不存在报告无 delta 并停止。**capability 目录 RENAME 机制 gap**:spec delta 体系只有 requirement 级 RENAMED,无 capability 级 RENAME/删除——旧目录只能 REMOVED requirements 空壳残留;解决方案 = delta rename-from 元数据 + syncing RENAME 段(git mv 幂等)。**plan tick 全家坑**:plan checkbox 僵尸态(执行只更新会话 todo 与 ledger,plan 永远全未完成)——引入 tick-task 补 tracked 层可视化;fence 误勾(复用 extractTaskBrief 的 fence 状态机 + 单测覆盖 fence 内代码行;CommonMark 长度规则:开栏 K 个反引号只能被 ≥ K 个反引号且其后无内容的行闭合,内层短 fence 不翻转外层状态);Task 1 误配 Task 10(数字边界);任务区段蔓延(止于下一个同级或更高级标题,不蔓延到 ## 收尾等尾部章节);双源不一致(ledger 为唯一恢复权威,勾选顺序先 ledger 后 tick);幂等(只改 [ ]→[x],已勾不动);commit 噪音(折进簿记点,reviewer 可见推进轨迹非纯噪音)。**spec 残留旧表述的内在矛盾**:delta 能力面未覆盖的 capability 会留旧机制表述与现行矛盾(remove-feature-layer 曾漏 sdd-document-lifecycle 与 plugin-packaging;历史活例 = plugin-packaging 23 命令字面量,已由 2026-09-03-spec-count-23 去数字化修正)——选 delta 能力面时 MUST 全仓 grep 跨 capability 概念触点。**校验锚点必须与规定产出对账**:写「零命中」grep 校验前先对规定的产出文本跑一遍模式——禁令条款点名被禁物属合法命中,建议句含相关词也命中;「0 命中」期望要限定作用域(如命令表单元格)而非全文件,判定须用只含真实违规特征的严格审计模式。(出自 archive/2026-08-09-speccode-v2-sdd-flow、2026-08-12-finish-routing-sync-archive、2026-08-16-code-intel-rename、2026-08-16-plan-progress-tick、2026-08-16-readme-optimization、2026-09-03-remove-feature-layer、2026-09-03-knowledge-unified-entry)
<!-- /distilled -->

<!-- distilled-from: cap/session-memory -->
**条目分隔责任下放给调用方是结构性陷阱**:全部命令文档的 heredoc 示例天然产生「前条无尾换行 + 新条无头换行」组合,靠每个调用点自觉加换行已被打破过一次;引擎兜底后命令文档不写换行约定也天然安全。**spec 与实现漂移**:条款仍写旧机制而实现已改——此类漂移在勘探时一并核实归位,不做「只改实现」。**探索 topic 命名碎片化**:同一需求在不同 session 被起不同 topic 名,各持一半结论;缓解 = exploring 出口 append 前必经 list-memory 列既有 topic 选既有或新建,分期用共同前缀约定(<主题>-p1/-p2)。**type 推断信号变小**:单堆切成单 topic 后推断信号变小、小样本推断质量可能下降;既有护栏(推断 MUST 经用户确认,不静默生效)覆盖。**_exploring 残留上一话题**:护栏(预置推荐项 + 确认)覆盖;承接后清空,残留窗口限一个 feature。(出自 archive/2026-08-11-memory-append-newline、2026-08-11-type-inference-source、2026-09-02-exploring-topic-split)
<!-- /distilled -->

<!-- distilled-from: cap/code-intel-tool-integration -->
**「本机有 = 项目已集成」误判**:plugin/CLI 的「本机装了」与「本项目用了」是两回事;单维度短路探测(plugin→mcp→cli→dir 首个命中即返回)让本机级命中提前返回、项目级证据被跳过,造成误登记——登记了未集成工具后 exploring/proposing/brainstorming 会优先「咨询」它们,实则本项目根本没用。CLI 二进制是本机属性,不代表本项目已为它生成索引(command -v 不能算「集成」);项目有索引目录但工具已卸载属异常态,保守不登记更安全。**仓库外 worktree_dir 误报**:git 对外部路径 fatal + exit 128,被命令误判为「未被忽略」(见架构块三分支根治)。**兄弟前缀误判**:/repo vs /repo-evil 纯前缀比较会误判为 inside——必须补尾部分隔符。**相对 worktree_dir 解析基准含糊**:一律以 repoRoot 为基准 resolve,不用 cwd。(出自 archive/2026-08-13-knowledge-tools-detection、2026-08-12-check-ignore-outside-repo)
<!-- /distilled -->

<!-- distilled-from: cap/knowledge-set -->
**蒸馏失真坑**:LLM 从 spec/archive 提炼走样 → 闸门(候选 diff 经人确认才落盘)。重蒸覆盖手写内容坑 → 蒸馏只重写块内、块外字节级保留(测试覆盖)。marker 被手编破坏坑 → 解析单测钉死格式,解析失败显式报错不静默修复。知识集内容膨胀、_index 失修坑 → 命令出口更新 _index,写入时重建校验;入口 prose 重复 9 处漂移坑 → 接入段统一模板集中在入口小节。**改名漏触点坑**:prose、提交信息模板、索引描述等易遗漏 → tasks 列全触点清单 + 收尾全仓 grep 校验禁区;主规格 Purpose 含旧命令名坑 → syncing 不动既有 Purpose,需单独 editorial 手改。**宽骨架闲置率高**:dogfood 证据——9 topic 中 business/* 与多数 development 文件全空,仅 pitfalls 有内容;宽骨架导致记录时分类纠结。存量 business 内容误删风险:块移除必须经闸门人工确认;hand-written 段字节级保留绝不自动动。**特权机制缺陷债(0.2.5→0.4.0 教训)**:知识维护特权机制(裸 bootstrap、无 state、内置直通 PR)存活两版暴露三缺陷——squash-only 下 git branch --no-merged 对已合并分支永真(已收尾分支永远被弹「续跑」)、裸 checkout 切走主工作区、跑完不回 trunk;两命令机制段约 80% 逐字重复。教训:机制例外不是免费的,每份独立实现 = 缺陷面 + 重复税;统一入口 + state 判定一次性消灭全部。**首次引导误判**:探索期 find -maxdepth 2 -type f 被嵌套 propose/brainstorm 子目录结构误导,误判 archive/ 为空(实有 20+ 归档包)——首次 dogfood 引导实为全量读,非空操作;实扫归档时按目录而非文件计数。**布局守卫陷阱**:split(
) 后任何以换行结尾的文件 hand 数组至少含尾部空串,hand.length > 0 恒真——空手写区守卫失效,产出双前导空行(幂等固定点,不会自愈);守卫必须用 handText !== ,且 replace-distilled 与 replace-hand 两条写路径守卫必须一致(不一致即其中一条带病)。

(出自 archive/2026-08-14-knowledge-set、2026-08-15-knowledge-command-rename、2026-08-15-knowledge-set-refocus、2026-08-16-distill-incremental-archive、2026-09-03-knowledge-unified-entry、2026-09-03-knowledge-compact)
<!-- /distilled -->

<!-- distilled-from: cap/tool-input-sanitization -->
**GLM 系模型后端在 tool_use 参数发射路径随机注入 CR(U+000D)**:实证 AskUserQuestion 参数含 CR 散布于中英/ASCII 边界,个数不定;其他工具参数与模型 text 输出零污染——诊断法 = 扫描 transcript JSONL 里 AskUserQuestion tool_use 的 input。坑:updatedInput 改写输入会被 schema 校验(如 options 数组最少 2 项),构造替换输入必须合法,否则整次工具调用报错而非静默忽略。(出自 archive/2026-09-02-askuserquestion-cr-sanitizer)
<!-- /distilled -->

<!-- distilled-from: cap/development-flow-tiering -->
**变体措辞绕过字面守卫**:退役硬规则时仅 grep 精确串会漏同义变体——「全程中文交互」退役后 init/reset 正文残留「全程用中文与用户交互」「全程中文。」两个变体,字面守卫绿而语义未退役;守卫正则应收变体形态(`/全程用?中文/`),退役类改动收尾时全仓扫语义变体而非仅精确串。(出自 archive/2026-09-07-i18n)
<!-- /distilled -->
