---
name: requesting-code-review
description: "After finishing work or major features, and before merging: dispatch a code-reviewer subagent to verify the work; BASE is the caller-recorded commit Interact in the user's language; ask when it cannot be determined."
---

# 请求代码审查(Requesting Code Review)

> **引擎可用性(lite 探测)**:命令开始时运行 `command -v speccode`——在场则一切照本命令正文调用引擎;不在场(lite 模式)则本命令内的 `speccode <verb>` 调用按下列降级表替换,其余步骤照常执行:
>
> - `read-config` → `cat "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/.speccode/config.json"`(主仓根定位;文件缺失 = 未初始化,按各命令的未初始化分支处理)
> - `read-knowledge --index` / `--topic <t>` → `cat "$(git rev-parse --show-toplevel)/speccode/knowledge/_index.md"` / `…/speccode/knowledge/<t>.md`(worktree 根定位;文件不存在 = 无知识,静默继续)
> - `read-memory --branch <F>` / `list-memory` → `cat` / `ls` 记忆文件(分支键 `<type>/<slug>` 编码为文件名 `<type>__<slug>.md`;分支记忆位于其 worktree 的 `.speccode/memory/`,保留键与 `_exploring__<topic>` 位于主仓 `.speccode/memory/`)
> - `write-memory` → 手动编辑对应文件(单分支假设;append 语义 = 文件末尾补一行)
> - `write-config` → 仅 init:手写最小 config(JSON 数行,可 review);其余写类 verb 不可用
> - `plugin-root` → 本 skill 目录的上两级(`<skill base>/../..`;宿主加载 skill 时报告的 base directory)
> - `default-branch` → `git symbolic-ref --short refs/remotes/origin/HEAD`(剥 `origin/` 前缀),失败则依次 `git rev-parse --verify -q refs/heads/main`、`refs/heads/master`,全败兜底 `main`
> - `run-hook` → 静默跳过(hook 本为 warn-only,lite 等价)
> - `reconcile` / state 读写 / PR / 清理 / 知识蒸馏写 → **编排与蒸馏不可用**:lite 模式不支持并行编排;依赖之的命令中止并提示安装引擎(`npm i -g speccode` 或宿主 PATH shim)后重跑

派发一个 code reviewer 子代理,在问题级联放大之前抓住它们。审查者拿到的是精确构造的评估上下文——绝不是你会话的历史。

> **宿主能力依赖**:本 skill 依赖宿主的子代理派发能力。宿主无子代理时,由主代理按本 skill 的审查清单在当前会话自查(对照 BASE..HEAD diff 逐节过一遍),不降级到其他 skill。

**核心原则:** 早审查,常审查。

## 何时请求审查

**强制:**
- subagent 驱动开发(`/speccode:subagent-driven-development`)中的每个任务之后(任务审查与最后的整支终审都走本命令)
- 完成重大功能之后
- 合并进主干之前

**可选但有价值:**
- 卡住时(换一双新眼睛)
- 重构之前(基线检查)
- 修了复杂 bug 之后

## 知识库入口

1. 运行 `speccode read-knowledge --cwd . --index` 读 `_index.md`(恒读,便宜);`exists:false` → 静默跳过本节。
2. 判断本任务相关主题 → `speccode read-knowledge --cwd . --topic <名称>` 读对应 topic 文件;`exists:false` → 静默跳过该主题。
3. 读取失败或目录不存在 → 静默跳过,绝不阻断主流程(T0 兜底,永不报错)。

lite 模式按锚点段降级表直读文件;文件不存在 = 无知识,静默继续(T0 兜底的 lite 等价)。

## 如何请求

**1. 确定 BASE 与 HEAD:**

BASE 永远用**调用方记录的 BASE**——派发实现者/开始本段工作之前 `git rev-parse HEAD` 记下并存好的那个 commit(SDD 任务循环在派发实现者前记录它;整支终审用分支起点,如 `git merge-base <trunk> HEAD`)。MUST NOT 用相对引用反推 BASE——多 commit 的任务里,相对引用会悄悄丢掉除最后一个之外的所有 commit。

```bash
BASE_SHA=<调用方记录的 BASE>   # 开始本段工作前记录;不是相对引用
HEAD_SHA=$(git rev-parse HEAD)
```

**2. 派发 code reviewer 子代理:**

派发一个全新子代理(宿主通用实现代理),填充 `$(speccode plugin-root --cwd .)/references/code-reviewer.md` 的模板

**占位符:**
- `{DESCRIPTION}` - 你构建的东西的简短小结
- `{PLAN_OR_REQUIREMENTS}` - 它应该做什么
- `{BASE_SHA}` - 起始 commit(调用方记录的 BASE)
- `{HEAD_SHA}` - 结束 commit

派发时触发 onCodeReviewRequested 钩子:

```bash
echo '{"command":"requesting-code-review","feature_branch":"<F>","worktree_branch":"<W>"}' | speccode run-hook --cwd . --event onCodeReviewRequested
```

输出 `hook.ok=false` 或含 `warning` 时打印警告(含事件名与错误摘要),MUST NOT 阻断主流程。

**3. 按反馈行动:**
- Critical 问题立即修
- Important 问题修复后再继续
- Minor 问题记下稍后处理
- 审查者错了就反驳(带上理由)

## 示例

```
[刚完成 Task 2: 添加验证函数]

你: 继续之前,先请求代码审查。

BASE_SHA=<派发 Task 2 实现者前记录的 BASE>(SDD 任务循环里已记下)
HEAD_SHA=$(git rev-parse HEAD)

[派发 code reviewer 子代理]
  DESCRIPTION: 添加了 verifyIndex() 和 repairIndex(),覆盖 4 种问题类型
  PLAN_OR_REQUIREMENTS: speccode/changes/<slug>/plan/ 中的 Task 2
  BASE_SHA: a7981ec
  HEAD_SHA: 3df7661

[子代理返回]:
  Strengths: 架构干净,真实测试
  Issues:
    Important: 缺少进度指示
    Minor: 魔法数字(100)作为上报间隔
  Assessment: 可以继续

你: [修复进度指示]
[继续 Task 3]
```

## 常见合理化借口(Common Rationalizations)

| 借口 | 现实 |
|--------|---------|
| 「我自己看一遍 diff 就行,不用派审查者」 | 你是协调者——在会话里内联审 diff 会烧掉你推进工作所需的上下文窗口。派一个审查者子代理:diff 和评估活在它的上下文里,只有发现回到你这里。 |
| 「审查者需要我整个会话历史才能理解这个改动」 | 给它精确构造的上下文,绝不是你会话的历史。这让审查者聚焦在工作产物上,而不是你的思考过程。 |

## 红旗(Red Flags)

**绝不:**
- 因为「很简单」跳过审查
- 无视 Critical 问题
- 带着未修复的 Important 问题继续前进
- 对站得住的技术反馈抬杠

**如果审查者错了:**
- 用技术理由反驳
- 展示证明它能工作的代码/测试
- 请求澄清

模板见: `$(speccode plugin-root --cwd .)/references/code-reviewer.md`
