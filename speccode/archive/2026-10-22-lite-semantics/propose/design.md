# Design: lite-semantics

## Context

22 个 skill 含 `speccode <verb>` 调用(共 100+ 处;verb 频次:read-knowledge 23、plugin-root 16、write-memory 13、reconcile 12、run-hook 11、read-config 11、read-memory 9、default-branch 7、其余零散)。3 个 skill 零调用(test-driven-development / verification-before-completion / dispatching-parallel-agents)。SDD 家族 2 个 skill 伴生脚本零依赖但仍有 memory/hooks/knowledge 引擎调用——锚点段对其同样适用。约束:prose 宿主中立守卫、裸调守卫(`speccode.mjs <verb>` 禁令)、伴生脚本锚点段(已有)不可违;锚点段与伴生脚本锚点段共存不冲突(各管各的探测)。

## Goals

- 引擎缺失时:读类命令(proposing/brainstorming/writing-plans/exploring/applying/SDD 执行等)完整可用;编排命令明确拒绝并引导;hooks 静默;无一处假装等价。
- 锚点段单源:同一段逐字出现在全部 22 个 skill,守卫钉死一致性。
- 引擎零改动;既有守卫全绿。

## Non-Goals

- 引擎侧任何变化(探测/降级逻辑全在 prose)。
- 知识写机器(distilling)的 lite 形态——明确声明不可用并引导(编排类同待遇)。
- README/DESIGN 门面(docs-i18n);知识刷新(收尾后 chore);版本 bump。
- lite 下的人工并行编排操作手册(引导安装即止,不教手动替代 state)。

## Decisions

**D1. 锚点段 = 单源统一段,插在 frontmatter 后首个 `##` 前。** 每 skill 一段逐字相同(计划给全文),内容:探测一行 + 降级表(读类 cat/ls/git 直达、写记忆手动编辑、plugin-root 用宿主报告的 skill 目录上两级、default-branch git 三连、run-hook 跳过)+ 编排不可用声明 + 安装引导。被否备选:每调用点内联降级(22×N 处改写,漂移面爆炸);集中一份共享文档引用(skill 自包含原则,且 lite 下 plugin-root 不可用、共享文档反而够不着)。逐字一致性由守卫哈希比对钉死——单源的可执行含义。

**D2. 主仓根/worktree 根的 lite 定位 = 纯 git 命令。** 主仓根 = `dirname $(git rev-parse --path-format=absolute --git-common-dir)`;worktree 根 = `git rev-parse --show-toplevel`(知识文件用后者,memory 主仓层用前者)。与引擎 `speccodeDirOf`/`knowledgeRoot` 同式——lite 降级表直接内嵌这两条 git 一行,不依赖任何引擎函数。

**D3. 编排命令 = 显式拒绝,不做半套。** creating-*/finishing-*/status 三类:creating-*/finishing-* 探测失败即打印中止语(未做任何改动)并退出——半套 worktree/state 操作是「假装等价」的反面教材;status 降级为只读报告(锚点段降级表已给 git 直达,命令正文加一句「lite 下以降级表手工汇总,不做对账」)。被否备选:lite 手动 worktree 手册(教用户绕过 state = 制造孤儿;引导安装一步到位)。

**D4. distilling/recording 知识命令 = 编排类待遇。** 知识写机器经 write-knowledge verb(原子写/marker 校验),lite 手写违反「命令层绝不手写 knowledge/」铁律——锚点段统一声明「知识蒸馏写机器不可用」;read 侧(认知命令的知识入口)lite 直读照常。

**D5. write-config 的 init 手写例外收敛进锚点段。** 降级表一行:「write-config → 仅 init:手写最小 config(JSON 数行,可 review);其余写类不可用」。与探索期矩阵一致。

**D6. 守卫(tests/lite.test.mjs)。** ①锚点段存在性:含 `\bspeccode [a-z-]+` 调用的 skill(排除 `speccode:` 命令名引用)必须含锚点段首行;②一致性:全部锚点段逐字节相等(提取 frontmatter 后至首个 `##` 之间含「引擎可用性」的段落比对);③零调用 skill 不得含锚点段(防无意义扩散);④回归:既有裸调/宿主 token 守卫不变。

**D7. 测试面。** prose-only 变更 → 无新引擎用例;lite.test.mjs 四守卫;全量回归。冒烟:临时目录 `PATH` 去掉 speccode 后,按降级表手工走通 exploring 的读类路径(cat config/knowledge/index)验证字面命令可执行。

## Risks

- **锚点段与 SDD 伴生脚本锚点段并存的认知负担**(subagent-driven-development 两段都有)→ 两段各一行互指:「伴生脚本锚点见上文/引擎降级见下文」?不——保持互不引用,各段自带探测与语义,守卫各自独立;重复探测(两次 command -v)无害。
- **22 处逐字复制的维护成本** → 正是守卫哈希存在的意义;未来改降级表 = 全局替换一次,守卫保证无一漏网。
- **降级表内的 shell 片段在非 bash 宿主** → 片段全部是 POSIX 一行(cat/ls/dirname/git),无 bashism;与伴生脚本锚点段同策。

## Open Questions

- 无——边界在探索期定稿,本设计仅落地。
