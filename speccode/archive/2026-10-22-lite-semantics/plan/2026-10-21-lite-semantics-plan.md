# lite-semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 22 个含引擎调用的 skill 获得逐字一致的「引擎可用性」锚点段(读类直读 / 写类受限 / 编排拒绝 / hooks 静默 / 安装引导),编排命令显式中止,守卫钉死一致性——lite 承诺兑现,引擎零改动。

**Architecture:** 单源锚点段字面量(本计划 Task 1 给全文)插入每个含调用 skill 的 `# 标题` 行之后、其余正文之前;四个编排命令 + status 与两个知识写命令加命令级行;`tests/lite.test.mjs` 四守卫;CHANGELOG + AGENTS.md。

**Tech Stack:** prose + node --test 守卫;无引擎改动。

## Global Constraints

- 锚点段在全部 22 个 skill **逐字节一致**(守卫全量比对);零调用 skill(test-driven-development / verification-before-completion / dispatching-parallel-agents)MUST NOT 含锚点段。
- 锚点段内只有 POSIX 一行命令(cat / ls / dirname / git / command -v);禁令清单(`speccode.mjs <verb>`、`node plugins/...`、`${CLAUDE_PLUGIN_ROOT}` 及宿主 token)对锚点段同样适用。
- 既有守卫全绿(裸调、宿主 token、tick-task、init 形状、retired tokens、memory-lifecycle wording);SDD 伴生脚本锚点段不动、不与之合并。
- 编排命令 lite 行 = 中止语原句(计划给定);status = 只读降级句;无任何「半套编排」步骤。
- 引擎、伴生脚本、MCP、references/ 零改动;CHANGELOG 仅 `[Unreleased]`。
- 全量 `node --test ./tests/*.test.mjs`;每任务绿后立即提交。

---

### Task 1: 锚点段定稿 + 守卫 + 22 skill 插入

**Files:**
- Create: `tests/lite.test.mjs`
- Modify: 22 个含引擎调用的 `skills/*/SKILL.md`(锚点段插入;清单见下)
- Test: `tests/lite.test.mjs`

**Interfaces:**
- Produces: 锚点段(单源字面量,下文);`tests/lite.test.mjs` 四守卫

**锚点段全文(逐字,插入位置 = `# 标题` 行之后、空行相隔,其余正文不动):**

```markdown
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
```

**22 个目标 skill 清单**(以 `grep -lE '\bspeccode [a-z-]+ --cwd|`speccode (read|write|list|rename|purge|run-hook|reconcile|default-branch|plugin-root|repo-merge-config|detect-remote|resolve|backup|delete|lint)' skills/*/SKILL.md` 复核,排除 `/speccode:` 命令名引用):applying, archiving, brainstorming, creating-feature, creating-worktree, distilling-knowledge, executing-plans, exploring, finishing-feature, finishing-worktree, init, proposing, receiving-code-review, recording-knowledge, requesting-code-review, reset, status, subagent-driven-development, syncing, systematic-debugging, writing-plans, test-driven-development(核查:其 1 处 `speccode` 匹配若为 `/speccode:` 引用或 prose 叙述则剔除并同步守卫清单)。

- [x] **Step 1: 写守卫(RED)** — `tests/lite.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');
const ANCHOR_HEAD = '> **引擎可用性(lite 探测)**';
// 含引擎调用的判定:正文出现 `speccode <verb>` 反引号调用形态(/speccode: 命令名引用不计)
const ENGINE_CALL = /`speccode [a-z][a-z-]+/;

function anchorBlock(md) {
  const i = md.indexOf(ANCHOR_HEAD);
  if (i === -1) return null;
  const lines = md.slice(i).split('\n');
  const block = [];
  for (const line of lines) {
    if (line.startsWith('>') || line.trim() === '') { block.push(line); if (line.trim() === '' ) break; }
    else break;
  }
  return block.join('\n').replace(/\n$/, '');
}

test('every engine-calling skill carries the lite anchor; zero-call skills do not', () => {
  const callers = [];
  const anchors = new Set();
  for (const name of readdirSync(skillsDir).sort()) {
    const md = readFileSync(join(skillsDir, name, 'SKILL.md'), 'utf8');
    const body = md.replace(/^---[\s\S]*?---\n/, '');
    const calls = ENGINE_CALL.test(body.replace(/\/speccode:[a-z-]+/g, ''));
    const anchor = anchorBlock(md);
    if (calls) { callers.push(name); assert.ok(anchor, `${name} calls the engine but lacks the lite anchor`); anchors.add(anchor); }
    else assert.equal(anchor, null, `${name} has no engine calls but carries the anchor`);
  }
  assert.ok(callers.length >= 20, `expected ≥20 engine-calling skills, found ${callers.length}`);
  assert.equal(anchors.size, 1, `anchor blocks must be byte-identical across skills, found ${anchors.size} variants`);
});

test('anchor contains probe, degrade rows, and install guidance', () => {
  const anchor = anchorBlock(readFileSync(join(skillsDir, 'proposing', 'SKILL.md'), 'utf8'));
  for (const tok of ['command -v speccode', 'read-config', 'read-knowledge', 'read-memory', 'write-memory', 'write-config', 'plugin-root', 'default-branch', 'run-hook', 'reconcile', 'npm i -g speccode']) {
    assert.ok(anchor.includes(tok), `anchor missing: ${tok}`);
  }
  for (const banned of ['speccode.mjs <', 'CLAUDE_PLUGIN_ROOT', 'node plugins/']) {
    assert.ok(!anchor.includes(banned), `anchor contains banned form: ${banned}`);
  }
});
```

(守卫③④:零调用断言已含于第一条;第四条回归由全量既有守卫承担。)

Run: `node --test tests/lite.test.mjs` — Expected: FAIL(锚点缺失)

- [x] **Step 2: 插入锚点段** — 用一次性脚本(不提交)把锚点段全文插入 22 个 skill 的 `# 标题` 行后(空行相隔);test-driven-development 若经核为零调用则跳过。

- [x] **Step 3: 运行确认通过** — `node --test tests/lite.test.mjs tests/cli.test.mjs`(既有守卫回归)

- [x] **Step 4: 提交** — `git add tests/lite.test.mjs skills/ && git commit -m "feat(skills): uniform lite-availability anchor across engine-calling skills"`

---

### Task 2: 命令级行(编排中止 / status 只读 / 知识写待遇 / 认知入口兜底)

**Files:**
- Modify: creating-worktree / creating-feature / finishing-worktree / finishing-feature(中止语)、status(只读句)、distilling-knowledge / recording-knowledge(待遇句)、9 个认知命令(exploring/proposing/brainstorming/writing-plans/executing-plans/subagent-driven-development/systematic-debugging/requesting-code-review/receiving-code-review 的知识入口段兜底句)

**Interfaces:** Consumes: Task 1 锚点段(已在场)

- [x] **Step 1: 四编排命令中止语** — 在「前置」节第一步之前插入(逐字):`0. **lite 门**:按「引擎可用性」锚点段探测;引擎缺失 → 打印「本命令依赖编排引擎(state/对账/PR),lite 模式不可用;已中止,未做任何改动」并中止(不做任何 git/state/记忆操作)。`
- [x] **Step 2: status 只读句** — 在开头对账步骤前插入:`按锚点段探测;lite 模式降级为只读报告:以 git 命令(log / worktree list / status)手工汇总并声明「lite 模式:未做对账与状态推进」。`
- [x] **Step 3: 知识写命令待遇句** — distilling-knowledge / recording-knowledge 的入口(trunk 防护附近)插入:`lite 模式下知识写机器不可用(锚点段降级表);中止并引导安装引擎。`
- [x] **Step 4: 认知入口兜底句** — 9 个认知命令的知识库入口段尾补(逐字):`lite 模式按锚点段降级表直读文件;文件不存在 = 无知识,静默继续(T0 兜底的 lite 等价)。`
- [x] **Step 5: 全量 + 提交** — `node --test ./tests/*.test.mjs` 全绿;`git add skills/ && git commit -m "docs(skills): lite gates — orchestration aborts, read-only status, knowledge-entry fallbacks"`

---

### Task 3: CHANGELOG + AGENTS.md + 验证

**Files:**
- Modify: `CHANGELOG.md`、`AGENTS.md`

- [x] **Step 1: CHANGELOG `[Unreleased]`** — `- Changed: lite 降级语义——22 个含引擎调用的 skill 携带逐字一致的「引擎可用性」锚点段(读类 cat/git 直读、write-memory 手动编辑、plugin-root 经宿主 skill 目录、default-branch git 三连、run-hook 静默跳过、write-config 仅 init 手写例外);编排命令(creating-*/finishing-*)lite 显式中止、status 降级只读、知识蒸馏写不可用——无引擎(`speccode` 不在 PATH)时 SDD 文档流完整可用,并行编排引导安装。`
- [x] **Step 2: AGENTS.md 常用命令段** — MCP 示例后补一行:`# lite 探测(命令开头的「引擎可用性」锚点段据此降级)`,`command -v speccode || echo lite`
- [x] **Step 3: 验证** — 全量测试;无 PATH 冒烟:`T=$(mktemp -d)` 建仓写 config/knowledge 文件后,`PATH=/usr/bin:/bin` 下逐条执行锚点段降级行的字面命令(cat config / cat _index.md / symbolic-ref 链),断言全部可执行并产出预期;`grep -c "引擎可用性" skills/*/SKILL.md | grep -v ":0" | wc -l` = 22。
- [x] **Step 4: 提交** — `git add CHANGELOG.md AGENTS.md && git commit -m "docs: lite degradation semantics — anchored availability, orchestrated aborts"`

---

## 计划自查

- 规格覆盖:「引擎可用性锚点段」↔ T1;「编排命令 lite 拒绝」↔ T2 Step 1/2/3;知识入口兜底 ↔ T2 Step 4;裸调 lite 例外 ↔ T1 锚点段 + 既有守卫回归。
- 占位符:锚点段与中止语全文给定;22 清单附复核 grep。
- 类型一致:锚点段字面量在 T1 定义、T2/T3 引用同词根;守卫锚点头字符串与插入文本一致。
