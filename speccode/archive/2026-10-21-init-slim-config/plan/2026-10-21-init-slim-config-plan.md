# init-slim-config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** config 瘦身为「标记 + 可选项」——删 `trunk` / `remote` / `code_intel_tools`(引擎零消费/探测退役),新增 `default-branch` verb 作为主干名的运行时唯一来源,init 重写为标记语义,11 个 skill 的 prose 重接线。

**Architecture:** `lib/detect.mjs` 删代码智能探测器、增 `resolveDefaultBranch(runGit)` 纯函数(四级探测链);`lib/verbs.mjs` 增 `default-branch`、删 `detect-code-intel-tools`;`lib/config.mjs` 的 `validateConfigShape` 去三键校验;`lib/mcp.mjs` TOOL_META 同步(一删一增,parity 动态);prose 机械替换 + init 整体重写 + 四个咨询段统一模板。

**Tech Stack:** Node ≥ 24,纯 ESM,仅 `node:` 内置;`node --test`;`makeRepo()` 真实临时仓。

## Global Constraints

- 零第三方依赖;lib 语言中立(错误文本英文)。
- 确定性逻辑下沉 lib;`resolveDefaultBranch` MUST 仅用本地 git 命令(禁止 `git remote show` 等网络操作),以注入 runner 单测。
- `trunk` / `remote` / `code_intel_tools` 转为历史已删除字段:读取按未知键容忍与忽略、`validateConfigShape` 零警告、不进 init diff、整体重写时自然消失——**不设特殊清理机制**。
- prose 守卫不可违:宿主专属 token 清单、`speccode.mjs <verb>` 形态;新增守卫:skills/ 下无 `config.trunk`、`config.remote`、`config.code_intel_tools`、`detect-code-intel-tools` 字样。
- MCP tools 与 verb 1:1 parity 动态成立(勿改 1:1 断言);`resolveWorktreeDir` / `worktreeDirIgnoreState` / `isPathInside` / `DEFAULT_WORKTREE_DIR` 行为不变。
- CHANGELOG 只改 `[Unreleased]`、BREAKING 显式标注含升级路径;知识文件不在本分支改(收尾后 knowledge 微 chore)。
- 全量测试 `node --test ./tests/*.test.mjs`;单用例 `node --test --test-name-pattern="<name>" tests/<file>`;每任务绿后立即提交。

---

### Task 1: `default-branch` 探测链(lib + verb + tool + 单测)

**Files:**
- Modify: `lib/detect.mjs`(文件头注释职责收窄 + 新增 `resolveDefaultBranch`)
- Modify: `lib/verbs.mjs`(新增 verb)
- Modify: `lib/mcp.mjs`(TOOL_META 新增条目)
- Test: `tests/detect.test.mjs`(追加单测)

**Interfaces:**
- Consumes: `git(args, opts)` from `./git.mjs`
- Produces: `export function resolveDefaultBranch(runGit) → {branch: string, source: 'remote-head'|'fallback-main'|'fallback-master'|'last-resort'}`(`runGit(args, opts)` 形态与 `git()` 一致);verb `default-branch --cwd .` → `{ok:true, branch, source}`;TOOL_META 同名条目

- [x] **Step 1: 写失败测试(追加到 `tests/detect.test.mjs`)**

```js
import { resolveDefaultBranch } from '../lib/detect.mjs';

const fake = (behaviors) => (args) => {
  const key = args.join(' ');
  const b = behaviors[key];
  if (b === undefined) return { code: 1, stdout: '', stderr: '' };
  return typeof b === 'string' ? { code: 0, stdout: b, stderr: '' } : b;
};

test('resolveDefaultBranch: remote-head path strips the origin/ prefix', () => {
  const r = resolveDefaultBranch(fake({
    'symbolic-ref --short refs/remotes/origin/HEAD': 'origin/main\n',
  }));
  assert.deepEqual(r, { branch: 'main', source: 'remote-head' });
});

test('resolveDefaultBranch: fallback-main when origin/HEAD is unset but main exists', () => {
  const r = resolveDefaultBranch(fake({
    'rev-parse --verify --quiet refs/heads/main': { code: 0, stdout: '', stderr: '' },
  }));
  assert.deepEqual(r, { branch: 'main', source: 'fallback-main' });
});

test('resolveDefaultBranch: fallback-master when only master exists', () => {
  const r = resolveDefaultBranch(fake({
    'rev-parse --verify --quiet refs/heads/master': { code: 0, stdout: '', stderr: '' },
  }));
  assert.deepEqual(r, { branch: 'master', source: 'fallback-master' });
});

test('resolveDefaultBranch: last-resort when everything misses (incl. empty symbolic-ref output)', () => {
  assert.deepEqual(resolveDefaultBranch(fake({})), { branch: 'main', source: 'last-resort' });
  assert.deepEqual(
    resolveDefaultBranch(fake({ 'symbolic-ref --short refs/remotes/origin/HEAD': '   \n' })),
    { branch: 'main', source: 'last-resort' },
  );
});
```

- [x] **Step 2: 运行确认失败**

Run: `node --test --test-name-pattern="resolveDefaultBranch" tests/detect.test.mjs`
Expected: FAIL — `resolveDefaultBranch` 未导出

- [x] **Step 3: 写最小实现**

`lib/detect.mjs` 头部注释改为纯 worktree/分支定位职责,并在 `DEFAULT_WORKTREE_DIR` 附近追加:

```js
// Runtime trunk-name resolution — the single source for the default branch
// (config no longer carries it). Local git only: `git remote show` would hit
// the network. Chain: origin/HEAD → local main → local master → "main".
export function resolveDefaultBranch(runGit) {
  const head = runGit(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], { allowFail: true });
  if (head.code === 0) {
    const name = head.stdout.trim().replace(/^origin\//, '');
    if (name) return { branch: name, source: 'remote-head' };
  }
  for (const name of ['main', 'master']) {
    if (runGit(['rev-parse', '--verify', '--quiet', `refs/heads/${name}`], { allowFail: true }).code === 0) {
      return { branch: name, source: name === 'main' ? 'fallback-main' : 'fallback-master' };
    }
  }
  return { branch: 'main', source: 'last-resort' };
}
```

`lib/verbs.mjs` 在 `resolve-worktree-dir` 附近追加:

```js
  'default-branch': ({ cwd }) => ({
    ok: true, ...resolveDefaultBranch((args, opts) => git(args, { cwd, ...opts })),
  }),
```

(import 行 `./detect.mjs` 增补 `resolveDefaultBranch`。)

`lib/mcp.mjs` TOOL_META 在 `resolve-worktree-dir` 条目后追加:

```js
  'default-branch': tool("Resolve the repository's default (trunk) branch at runtime: origin/HEAD, then local main, then local master, then a \"main\" last resort; returns {branch, source}."),
```

- [x] **Step 4: 运行确认通过**

Run: `node --test tests/detect.test.mjs tests/verbs.test.mjs`
Expected: PASS(parity 动态覆盖新 tool)

- [x] **Step 5: 提交**

```bash
git add lib/detect.mjs lib/verbs.mjs lib/mcp.mjs tests/detect.test.mjs
git commit -m "feat(engine): default-branch verb — runtime trunk resolution (origin/HEAD → main → master → last resort)"
```

---

### Task 2: config 瘦身 + code-intel 探测退役(lib + tests)

**Files:**
- Modify: `lib/config.mjs`(validateConfigShape)、`lib/detect.mjs`(删探测器)、`lib/verbs.mjs`(删 verb)、`lib/mcp.mjs`(删 TOOL_META 条目)
- Test: `tests/config.test.mjs`、`tests/detect.test.mjs`、`tests/cli.test.mjs`

**Interfaces:**
- Consumes: 无
- Produces: `validateConfigShape` 不再校验 `trunk`/`remote`/`code_intel_tools`(未知键零警告语义不变);`lib/detect.mjs` 不再导出 `CODE_INTEL_TOOL_DETECTORS` / `detectCodeIntelTools`;verb 与 tool `detect-code-intel-tools` 不存在(`unknown verb`)

- [x] **Step 1: 写失败测试**

`tests/config.test.mjs` 的 `validateConfigShape: clean pass + warning surface` 用例改写(保留其合法非法样本、去掉三键的期望):追加一条独立用例:

```js
test('validateConfigShape tolerates retired keys (trunk/remote/code_intel_tools) silently', () => {
  const w = validateConfigShape({
    version: 3, initialized_at: '2026-01-01T00:00:00Z',
    trunk: 'main', remote: 'origin', code_intel_tools: [],
  });
  assert.deepEqual(w, []);
});
```

`tests/cli.test.mjs` 追加:

```js
test('detect-code-intel-tools verb no longer exists; retired config keys read clean', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'detect-code-intel-tools', '--cwd', repo);
  assert.equal(code, 1);
  assert.match(json.error, /unknown verb/);
  const rc = runCli(repo, 'write-config', '--cwd', repo, '--json-stdin', JSON.stringify({
    version: 3, initialized_at: '2026-01-01T00:00:00Z', trunk: 'main', remote: 'origin', code_intel_tools: [],
  }));
  assert.equal(rc.code, 0);
  const lint = runCli(repo, 'lint-state', '--cwd', repo);
  assert.equal(lint.code, 0);
  assert.deepEqual(lint.json.config.warnings, []);
  rmSync(repo, { recursive: true, force: true });
});
```

(以 `runCli`/`makeRepo` 既有 helper 的实际签名为准;`write-config` 走 input 传 stdin 的既有模式。)

Run: `node --test --test-name-pattern="retired keys|no longer exists" tests/config.test.mjs tests/cli.test.mjs`
Expected: FAIL — verb 仍存在、`validateConfigShape` 仍产三键警告

- [x] **Step 2: 实现**

`lib/config.mjs`:`for (const f of ['trunk', 'remote', 'worktree_dir'])` → `for (const f of ['worktree_dir'])`;删除 `code_intel_tools` 数组校验块。
`lib/detect.mjs`:删除 `CODE_INTEL_TOOL_DETECTORS`、`defaultReadJson`、`detectCodeIntelTools`(连同其仅被它们使用的 import 与 fs/path 依赖;保留 `DEFAULT_WORKTREE_DIR`、`resolveWorktreeDir`、`isPathInside`、`worktreeDirIgnoreState`、Task 1 的 `resolveDefaultBranch`)。
`lib/verbs.mjs`:删 `'detect-code-intel-tools'` verb 块与 import 中的 `detectCodeIntelTools`。
`lib/mcp.mjs`:删 TOOL_META 的 `'detect-code-intel-tools'` 条目。
`tests/detect.test.mjs`:删 17 个 code_intel 用例(探测器表、五工具行为、host 忽略三例;保留 resolveWorktreeDir / isPathInside / worktreeDirIgnoreState / 缺省中性与 Task 1 的 resolveDefaultBranch 用例)与其专用 helper/import。
`tests/config.test.mjs`:既有 `validateConfigShape` 用例中三键样本改为仅保留仍受校验的字段。
`tests/cli.test.mjs`:删 `detect-code-intel-tools returns a tools array`、`detect-code-intel-tools from a subdirectory resolves against the main repo root`、`detect-code-intel-tools: 输出无 host 字段,恒全量探测` 三例(974/981 两条 init prose 守卫留给 Task 3 改写)。

- [x] **Step 3: 运行确认通过**

Run: `node --test tests/config.test.mjs tests/detect.test.mjs tests/cli.test.mjs tests/verbs.test.mjs tests/mcp.test.mjs`
Expected: PASS(parity 动态)

- [x] **Step 4: 提交**

```bash
git add -A lib/ tests/
git commit -m "refactor(engine)!: retire code_intel_tools detection and drop trunk/remote validation — config becomes a marker"
```

---

### Task 3: prose 重接线(init 重写 + 7 skill trunk 改 verb + 4 咨询段 + reset + 守卫)

**Files:**
- Modify: `skills/init/SKILL.md`(整体重写)
- Modify: `skills/{creating-worktree,creating-feature,finishing-worktree,finishing-feature,exploring,distilling-knowledge,recording-knowledge}/SKILL.md`(12 处 `config.trunk` + `config.remote` 清理)
- Modify: `skills/{exploring,proposing,brainstorming,distilling-knowledge}/SKILL.md`(咨询段)
- Modify: `skills/reset/SKILL.md`(字段清单行)
- Test: `tests/cli.test.mjs`(两条 init 守卫改写 + 新守卫)

**Interfaces:**
- Consumes: `default-branch` verb(Task 1)
- Produces: skills/ 下 `config.trunk` / `config.remote` / `config.code_intel_tools` / `detect-code-intel-tools` 字样为零(守卫钉死)

- [x] **Step 1: 写失败守卫(`tests/cli.test.mjs`)**

两条 init 守卫(974/981)改写为:

```js
test('init.md writes the minimal config shape (no code-intel, no trunk/remote)', () => {
  const md = readFileSync(join(__dirname, '..', 'skills', 'init', 'SKILL.md'), 'utf8');
  for (const token of ['code_intel_tools', 'detect-code-intel-tools', 'config.trunk', 'config.remote']) {
    assert.ok(!md.includes(token), `init.md must not reference ${token}`);
  }
  for (const token of ['pr_tool', 'worktree_dir', 'initialized_at']) {
    assert.ok(md.includes(token), `init.md must reference ${token}`);
  }
});

test('no skill references retired config fields or the retired detection verb', () => {
  const skillsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');
  for (const name of readdirSync(skillsDir).sort()) {
    const md = readFileSync(join(skillsDir, name, 'SKILL.md'), 'utf8');
    for (const token of ['config.trunk', 'config.remote', 'config.code_intel_tools', 'detect-code-intel-tools']) {
      assert.ok(!md.includes(token), `skills/${name}/SKILL.md must not reference ${token}`);
    }
  }
});
```

Run: `node --test --test-name-pattern="minimal config shape|retired config fields" tests/cli.test.mjs`
Expected: FAIL — prose 仍含各字样

- [x] **Step 2: init 重写(整文件替换)**

新 `skills/init/SKILL.md`(frontmatter description 同步瘦身):

```markdown
---
name: init
description: "Initialize or update the speccode environment: write the minimal .speccode/config.json marker (config v3 — version, initialized_at, optional pr_tool / worktree_dir / language / hooks); the config carries no host- or environment-coupled fields, so multiple agents can share one project (初始化) Interact in the user's language; ask when it cannot be determined."
---

初始化或更新 speccode 配置。config 是纯标记 + 少量可选项,不含任何宿主或环境耦合字段。

## 前置

运行 `speccode resolve-speccode-dir --cwd .` 获取 `speccodeDir`。
运行 `speccode read-config --cwd .` 判断是否已初始化:
- `config` 为 null → 全新 init(走"全新流程")
- `config` 非 null → 二次 init(走"幂等流程")

## 全新流程

1. **探测 pr_tool**:运行 `speccode detect-remote --cwd .`,得到 `prToolGuess` 与 `installed`。
   - 若 `installed=false` 且 `prToolGuess≠none`:告知用户"探测到应使用 <tool>,但未检测到该 CLI",询问是否降级为 `none`。
   - 向用户提问确认(给出选项)最终 `pr_tool`(gh / glab / none)。
2. **询问 worktree_dir**:worktree 存放的基础目录,默认 `.speccode/worktrees`,请用户确认或自定义(相对项目根的路径)。
3. **询问工作语言**(可选):向用户提问工件/文档语言(BCP-47 语言 tag)。推荐值取自当前会话的用户消息语言(依据对话判断,不读 LANG/LC_* 等环境变量;如对话为中文 → 推荐 `zh`)。选项:推荐值 / `en` / 自定义 tag(自由输入,合法形态如 `zh-CN`、`pt-BR`)。用户确认 → 该值纳入随后的 config 写入(`language` 字段);用户跳过 → 不写该字段(缺失 = 工件跟随交互语言)。
4. **询问 hooks(可选)**:告知用户可在 SDD 各节点挂 shell 命令(如 IM 通知),事件名固定 14 个:onExplored / onFeatureCreated / onWorktreeCreated / onProposed / onBrainstormed / onPlanned / onTaskCompleted / onCodeReviewRequested / onCodeReviewCompleted / onWorktreeFinished / onFeatureFinished / onPrOpened / onSynced / onArchived。
   - 用户选择配置 → 逐项询问「事件名 + shell 命令」,组装为 `hooks` 对象。
   - 用户跳过 → **不写入 `hooks` 字段**(缺失即无 hook)。
5. **组装 config v3** 并通过 `echo '<json>' | speccode write-config --cwd . --json-stdin` 写入:`version: 3`、`initialized_at`(ISO 8601 UTC)、`pr_tool`、`worktree_dir`;`hooks` 仅在用户配置时存在;`language` 仅在用户确认登记时存在(BCP-47 tag,非法值被 write-config 拒绝)。
6. **squash 探测**:init 完成 config 写入后运行 `speccode repo-merge-config --cwd .`;`squashOnly:false` → 打印警告「建议在仓库设置启用 squash-only 合并」+ 设置指引(不阻断);`config:null`(glab/none/失败)→ 静默跳过。
7. 打印 config 摘要 + 下一步指引(`/speccode:exploring` 探索需求,或直接 `/speccode:creating-worktree`)。

## 幂等流程(二次 init)

1. 备份现有 config(`backup-config` verb → `config.json.bak.<timestamp>`)。
2. 重新走全新流程的询问,得到"新值候选"。
3. 用 `diffFields` 逐字段比较旧/新:值未变 → 跳过;值变化 → 向用户提问展示(给出选项) `[旧值] → [新值]`,询问"保持 / 改用新值 / 清除"。
4. `state/` 目录 MUST 不动;字段集之外的未知键(含历史已删除字段,如 `trunk` / `remote` / `code_intel_tools` / `host`)不进 diff、不被消费,整体重写时自然消失。
5. 用 `write-config --json-stdin` 写回;随后同全新流程第 6 步跑 `repo-merge-config` squash 探测,打印摘要。

## 约束
- 全程不修改 `.gitignore`,不删除任何本地文件。
- 写 config 一律通过 `write-config --json-stdin` verb(内部原子写),不由 AI 手写文件。
- 探测结果(pr_tool 猜测)一律经用户确认后才落盘——不确定就先询问,不猜测。
```

- [x] **Step 3: trunk/remote 重接线(7 文件、12 处)**

规则:凡 `config.trunk` 的引用改为运行 `speccode default-branch --cwd .` 取 `branch` 字段(下文 `<default-branch>` 即该值);`config.remote` 引用删除(remote 名引擎内恒为 `origin`)。逐文件(以 `grep -n "config.trunk\|config.remote" skills/*/SKILL.md` 的当前输出为准,机械替换):

- `creating-worktree`(2 处):基点判定「0 个父实体 → 基点 = `<default-branch>`(普通需求)」;若 grep 另有一处 merge_target 缺省同理。
- `creating-feature`(2 处):前置「校验 HEAD 必须等于 `<default-branch>`」;`initial_branch: <default-branch>`。
- `finishing-worktree` / `finishing-feature`(各 1 处):trunk 缺省语义处改为「缺省语义 = `<default-branch>`」;「切回 trunk」→「切回 default branch」。
- `exploring`(2 处):前置 pull 判定「以 `<default-branch>` 为当前分支时」;HEAD 检查「若不在 `<default-branch>` 上」。
- `distilling-knowledge` / `recording-knowledge`(各 2 处):trunk 防护判定「非 default branch 的 `<type>/<slug>` 分支」形态判断,trunk 名经 `default-branch` verb。

- [x] **Step 4: 咨询段模板(4 文件)+ reset**

四个认知命令的「## 代码智能工具咨询」整节替换为:

```markdown
## 代码智能工具咨询

若当前会话中可用的代码智能工具(如代码图谱/索引类 MCP 或 CLI),参考代码时 MUST 优先使用;不可用或不存在则静默回退 Grep/Glob/Read;任何情况下工具缺失 MUST NOT 导致报错。本段不读取任何配置登记,探测与登记机制已随 config v3 瘦身退役。
```

(各文件中原引用「`speccode read-config --cwd .` … `code_intel_tools` …」的段落一并删除;`config 为空或缺失不报错` 等前置第 1 条若引用本节,保留指引句。)
`skills/reset/SKILL.md` 字段清单行:`trunk / remote / pr_tool / worktree_dir / code_intel_tools / hooks(若存在)` → `pr_tool / worktree_dir / hooks / language(若存在)`(以该行现文为准等价替换)。

- [x] **Step 5: 运行确认通过(全部 prose 守卫)**

Run: `node --test tests/cli.test.mjs tests/verbs.test.mjs`
Expected: PASS——含两条新守卫、既有宿主 token 守卫、`speccode.mjs <verb>` 守卫

- [x] **Step 6: 提交**

```bash
git add skills/ tests/cli.test.mjs
git commit -m "docs(skills): config marker semantics — init rewrite, default-branch rewire, session-visible code-intel consult"
```

---

### Task 4: CHANGELOG 与验证

**Files:**
- Modify: `CHANGELOG.md`(`[Unreleased]`)

**Interfaces:** 无;产出文档与全量绿灯

- [x] **Step 1: CHANGELOG 条目**

```markdown
- Added: `default-branch` verb(及 MCP tool)——主干分支名运行时探测(origin/HEAD → 本地 main → 本地 master → 兜底 main,仅本地 git 命令),取代 config 的 `trunk` 字段。
- Changed: **BREAKING** config 瘦身为标记语义——删除 `trunk` / `remote` / `code_intel_tools` 字段(必填仅 `version` + `initialized_at`)与 `detect-code-intel-tools` verb/tool;残留旧键按未知键容忍与忽略、二次 init 整体重写时自然消失;升级路径:命令改用 `default-branch`,代码智能咨询改会话可见性(会话中可用的代码智能工具优先,否则回退 Grep/Glob/Read);init 询问面收缩为 pr_tool / worktree_dir / language / hooks。
```

- [x] **Step 2: AGENTS.md 检查**

Run: `grep -n "trunk\|code_intel\|config\.remote" AGENTS.md`——三字段若仅出现在分支拓扑叙述(如「trunk 直接切」)则不改;出现「config 的 trunk 字段」类表述则同步修正(预期:无需改)。

- [x] **Step 3: 全量测试**

Run: `node --test ./tests/*.test.mjs`
Expected: PASS,`fail 0`

- [x] **Step 4: 手动冒烟**

```bash
T=$(mktemp -d) && git -C "$T" init -q -b master && cd "$T" && git config user.email t@t && git config user.name t && echo x > README.md && git add . && git commit -qm init
node $OLDPWD/bin/speccode.mjs default-branch --cwd .          # → {"branch":"master","source":"fallback-master"}
git symbolic-ref refs/remotes/origin/HEAD refs/heads/master
node $OLDPWD/bin/speccode.mjs default-branch --cwd .          # → {"branch":"master","source":"remote-head"}
echo '{"version":3,"initialized_at":"2026-01-01T00:00:00Z","trunk":"main","remote":"origin","code_intel_tools":[]}' | node $OLDPWD/bin/speccode.mjs write-config --cwd . --json-stdin
node $OLDPWD/bin/speccode.mjs lint-state --cwd .               # config.warnings == []
cd - && rm -rf "$T"
grep -rn "config\.trunk\|config\.remote\|config\.code_intel_tools\|detect-code-intel-tools" skills/ | wc -l   # 0
grep -rn "code_intel_tools\|detectCodeIntelTools" lib/ | wc -l  # 0
```

- [x] **Step 5: 提交**

```bash
git add CHANGELOG.md
git commit -m "docs: config marker semantics — BREAKING field retirements with default-branch upgrade path"
```

---

## 计划自查

- **规格覆盖**:「config.json 字段集」MODIFIED ↔ Task 2(校验瘦身)+ Task 3(init 最小形状/未知键语义);「default-branch 运行时探测」ADDED ↔ Task 1(四级链 + verb)+ Task 3 Step 3(prose 消费);code-intel REMOVED×3 ↔ Task 2;「命令咨询行为」MODIFIED ↔ Task 3 Step 4;tasks D4 知识微 chore 提示 ↔ 执行收尾时记入 ledger/记忆。
- **占位符扫描**:无 TBD;lib 代码完整;prose 替换给出规则 + 逐文件清单 + 守卫兜底。
- **类型一致性**:`resolveDefaultBranch(runGit)` 签名在 Task 1 定义、verb 壳消费;TOOL_META 增删与 verbs 增删一一对应;守卫 token 清单四处一致。
