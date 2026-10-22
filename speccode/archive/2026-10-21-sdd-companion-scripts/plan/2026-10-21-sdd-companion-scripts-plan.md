# sdd-companion-scripts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SDD 执行机器回归伴生脚本(`skills/subagent-driven-development/scripts/`,node ESM、自包含、不 import lib),引擎删四 verb/tool;吸收 superpowers 的 task-start / task-done 把 ledger 完成行脚本化;既有 fence 防御测试语义零改动。

**Architecture:** 共享模块 `sdd-plan.mjs`(逐字搬自 `lib/sdd.mjs`,内联 git/原子写小助手)+ `cli-util.mjs`(argv/JSON/exit 约定)+ 六个可执行脚本;`lib/verbs.mjs` 与 `TOOL_META` 删四项、`lib/sdd.mjs` 删除;两个 SDD skill 与两份 reference 模板把 `speccode <verb> --cwd . …` 改为 `node <scripts>/<name>.mjs …`(锚点 = 宿主报告的 skill base directory,`plugin-root` 兜底)。

**Tech Stack:** Node ≥ 24,纯 ESM,仅 `node:` 内置;`node --test`;`makeRepo()` 真实临时仓。

## Global Constraints

- 伴生脚本(`skills/*/scripts/*.mjs`)MUST 仅 import `node:` 内置或同目录 `./` 相对路径,**MUST NOT import `lib/`**(脚本随插件走,lib 随引擎 npm 包走)。
- 可执行脚本首行 `#!/usr/bin/env node` 且具备可执行位;共享模块 `sdd-plan.mjs` / `cli-util.mjs` 不需要 shebang/可执行位。
- 成功输出单行 JSON `{ok:true, …}` + exit 0;失败 `{ok:false, error}` + exit 1;`task-done.mjs` test 模式失败时以测试命令的退出码退出(`fail(error, rc, {log, exitCode: rc})`)。
- fence 状态机与区段边界逻辑从 `lib/sdd.mjs` **逐字**搬移(含注释);`tests/sdd.test.mjs` 只改 import 路径,14 个用例断言零改动。
- `skills/` prose 禁宿主专属 token(`CLAUDE_PLUGIN_ROOT` 等,既有守卫)且禁 `speccode.mjs <verb>` 形态;SDD 机械调用改写后 MUST NOT 残留 `speccode (sdd-workspace|task-brief|review-package|tick-task)`(守卫钉死)。
- 引擎侧删除后:`speccode <四 verb>` MUST 返回 `unknown verb`;MCP `tools/list` 不含四 tool(动态 parity 守卫自动覆盖,勿改 1:1 断言)。
- `cli.test.mjs` 保留两条 prose 守卫(`tick-task` 字样、`docs(speccode): tick task` 文案、「`ticked` 为空 → 跳过 commit」)——新 prose 措辞必须仍满足。
- 全量测试 `node --test ./tests/*.test.mjs`;单用例 `node --test --test-name-pattern="<name>" tests/<file>`。
- 每个任务绿后立即提交,conventional commits。

---

### Task 1: 共享模块 `sdd-plan.mjs`(逐字搬移)+ sdd.test 改 import

**Files:**
- Create: `skills/subagent-driven-development/scripts/sdd-plan.mjs`
- Modify: `tests/sdd.test.mjs:7-9`(仅 import 路径)

**Interfaces:**
- Consumes: 无
- Produces: `export function worktreeRoot(cwd)` / `sddWorkspace(planFile, cwd)` / `scanPlan(lines)` / `extractTaskBrief(planText, n)` / `taskBrief(planFile, n, cwd, outFile)` / `reviewPackage(planFile, base, head, cwd, outFile)` / `tickTask(planFile, n)`(签名与语义与原 `lib/sdd.mjs` 一字不差)+ 新增导出 `git(args, opts)`(供 task-start/task-done 复用)

- [x] **Step 1: 改 import 并运行确认失败**

`tests/sdd.test.mjs` 第 7–9 行改为:

```js
import {
  worktreeRoot, sddWorkspace, extractTaskBrief, taskBrief, reviewPackage, tickTask,
} from '../skills/subagent-driven-development/scripts/sdd-plan.mjs';
```

Run: `node --test tests/sdd.test.mjs`
Expected: FAIL — `Cannot find module '…/scripts/sdd-plan.mjs'`

- [x] **Step 2: 创建 `sdd-plan.mjs`**

头部 + 内联助手(新写),五个函数体从 `lib/sdd.mjs` **逐字**复制(含全部注释,只把 `import` 与助手去掉):

```js
// Shared plan/workspace logic for the SDD companion scripts, moved verbatim
// from the retired lib/sdd.mjs — the fence state machine and section
// boundaries are incident-tested; do not "simplify" them. Self-contained on
// purpose: these scripts travel with the skill (plugin), the engine's lib/
// travels with the npm package. Never import across that boundary.
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

export function git(args, opts = {}) {
  const { cwd, allowFail = false } = opts;
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  const result = { code: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  if (!allowFail && result.code !== 0) {
    throw new Error(`git ${args.join(' ')} failed (${result.code}): ${result.stderr}`);
  }
  return result;
}

function writeTextAtomic(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}
```

随后逐字放入 `worktreeRoot`、`sddWorkspace`、`scanPlan`、`extractTaskBrief`、`taskBrief`、`reviewPackage`、`tickTask`(源:`lib/sdd.mjs:10-140`,加 `export` 到 `worktreeRoot`)。

- [x] **Step 3: 运行确认通过**

Run: `node --test tests/sdd.test.mjs`
Expected: PASS(14 tests,断言零改动)

- [x] **Step 4: 提交**

```bash
git add skills/subagent-driven-development/scripts/sdd-plan.mjs tests/sdd.test.mjs
git commit -m "refactor(sdd): move plan/workspace logic to the companion module sdd-plan.mjs"
```

---

### Task 2: `cli-util.mjs` + 四个既有功能脚本 + 端到端测试

**Files:**
- Create: `skills/subagent-driven-development/scripts/cli-util.mjs`
- Create: `skills/subagent-driven-development/scripts/sdd-workspace.mjs`、`task-brief.mjs`、`review-package.mjs`、`tick-task.mjs`(均可执行)
- Test: `tests/sdd-scripts.test.mjs`(新建;守卫中「SKILL 引用的脚本存在」一条留到 Task 5)

**Interfaces:**
- Consumes: `sdd-plan.mjs` 全部导出(Task 1)
- Produces: `cli-util.mjs` 导出 `parseArgs(argv, positionalNames, usage) → {pos, named, rest}`(named:布尔/字符串 flag;`--` 后全部进 `rest`;位置参数个数不符抛 usage)、`ok(fields)`、`fail(error, exitCode=1, fields)`、`run(main)`(抛错折叠为 `{ok:false,error}`);四个脚本 CLI(`sdd-workspace.mjs <PLAN>` → `{ok, dir}`;`task-brief.mjs <PLAN> <N> [--out P]` → `{ok, path}`;`review-package.mjs <PLAN> <BASE> <HEAD> [--out P]` → `{ok, path}`;`tick-task.mjs <PLAN> <N>` → `{ok, plan, task, ticked, already}`)

- [x] **Step 1: 写失败测试(新建 `tests/sdd-scripts.test.mjs`)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { makeRepo, commitFile } from './helpers/tmprepo.mjs';

const SCRIPTS = fileURLToPath(new URL('../skills/subagent-driven-development/scripts/', import.meta.url));
const sh = (name, args, opts = {}) => {
  const r = spawnSync('node', [join(SCRIPTS, name), ...args], { encoding: 'utf8', ...opts });
  return { code: r.status, json: r.stdout.trim() ? JSON.parse(r.stdout.trim()) : null };
};
const PLAN_MD = [
  '# p Implementation Plan', '', '## Global Constraints', '', '- zero deps', '',
  '### Task 1: first', '', 'step a', '', '- [ ] s1', '',
  '```js', '### Task 99: inside fence', '- [ ] fenced', '```', '',
  '### Task 10: tenth', '', '- [ ] s10', '',
  '## 收尾', '', '- [ ] tail', '',
].join('\n');
const writePlan = (repo, name = 'p.md') => {
  const p = join(repo, name);
  writeFileSync(p, PLAN_MD);
  return p;
};

test('sdd-workspace.mjs creates isolated, self-ignored workspaces', () => {
  const repo = makeRepo();
  const p1 = writePlan(repo, 'one.md');
  const p2 = writePlan(repo, 'two.md');
  const r1 = sh('sdd-workspace.mjs', [p1], { cwd: repo });
  const r2 = sh('sdd-workspace.mjs', [p2], { cwd: repo });
  assert.equal(r1.code, 0);
  assert.notEqual(r1.json.dir, r2.json.dir);
  assert.ok(r1.json.dir.startsWith(join(repo, '.speccode', 'sdd')));
  assert.equal(readFileSync(join(repo, '.speccode', 'sdd', '.gitignore'), 'utf8'), '*\n');
  assert.equal(sh('sdd-workspace.mjs', [join(repo, 'nope.md')], { cwd: repo }).code, 1);
  rmSync(repo, { recursive: true, force: true });
});

test('sdd-workspace.mjs inside a linked worktree resolves to the worktree root', () => {
  const repo = makeRepo();
  spawnSync('git', ['worktree', 'add', join(repo, 'wt2'), '-b', 'wt2'], { cwd: repo });
  const p = writePlan(join(repo, 'wt2'));
  const r = sh('sdd-workspace.mjs', [p], { cwd: join(repo, 'wt2') });
  assert.equal(r.code, 0);
  assert.ok(r.json.dir.startsWith(join(repo, 'wt2', '.speccode', 'sdd')));
  rmSync(repo, { recursive: true, force: true });
});

test('task-brief.mjs extracts task N exactly (1 ≠ 10, fenced heading ignored)', () => {
  const repo = makeRepo();
  const p = writePlan(repo);
  const r = sh('task-brief.mjs', [p, '1'], { cwd: repo });
  assert.equal(r.code, 0);
  const brief = readFileSync(r.json.path, 'utf8');
  assert.ok(brief.includes('step a'));
  assert.ok(!brief.includes('s10') && !brief.includes('Task 99'));
  assert.ok(r.json.path.startsWith(join(repo, '.speccode', 'sdd', 'p')));
  const out = sh('task-brief.mjs', [p, '10', '--out', join(repo, 'b10.md')], { cwd: repo });
  assert.equal(readFileSync(join(repo, 'b10.md'), 'utf8').trim(), '### Task 10: tenth');
  assert.equal(out.json.path, join(repo, 'b10.md'));
  assert.equal(sh('task-brief.mjs', [p, '99'], { cwd: repo }).code, 1);
  rmSync(repo, { recursive: true, force: true });
});

test('tick-task.mjs is fence-aware and idempotent', () => {
  const repo = makeRepo();
  const p = writePlan(repo);
  const before = readFileSync(p, 'utf8');
  const r1 = sh('tick-task.mjs', [p, '1'], { cwd: repo });
  assert.equal(r1.code, 0);
  assert.deepEqual(r1.json.ticked, ['- [ ] s1']);
  const after1 = readFileSync(p, 'utf8');
  assert.ok(after1.includes('- [x] s1'));
  assert.ok(!after1.includes('[x] fenced') && !after1.includes('[x] tail') && !after1.includes('[x] s10'));
  const r2 = sh('tick-task.mjs', [p, '1'], { cwd: repo });
  assert.deepEqual(r2.json.ticked, []);
  assert.deepEqual(r2.json.already, ['- [x] s1']);
  assert.equal(readFileSync(p, 'utf8'), after1); // byte-identical
  const r99 = sh('tick-task.mjs', [p, '99'], { cwd: repo });
  assert.equal(r99.code, 1);
  assert.equal(readFileSync(p, 'utf8'), after1);
  assert.equal(before.includes('[x]'), false);
  rmSync(repo, { recursive: true, force: true });
});

test('review-package.mjs names the file by range and packs commits/stat/diff', () => {
  const repo = makeRepo();
  commitFile(repo, 'a.txt', 'a', 'a');
  const base = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
  commitFile(repo, 'b.txt', 'b', 'b');
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
  const p = writePlan(repo);
  const r = sh('review-package.mjs', [p, base, head], { cwd: repo });
  assert.equal(r.code, 0);
  const name = `review-${base.slice(0, 7)}..${head.slice(0, 7)}.diff`;
  assert.ok(r.json.path.endsWith(name));
  const body = readFileSync(r.json.path, 'utf8');
  assert.ok(body.includes('## Commits') && body.includes('## Files changed') && body.includes('## Diff'));
  assert.equal(sh('review-package.mjs', [p, 'deadbeef', head], { cwd: repo }).code, 1);
  rmSync(repo, { recursive: true, force: true });
});

test('companion scripts: shebang, exec bit, no lib imports', () => {
  for (const f of readdirSync(SCRIPTS).filter((f) => f.endsWith('.mjs'))) {
    const p = join(SCRIPTS, f);
    const src = readFileSync(p, 'utf8');
    if (f === 'sdd-plan.mjs' || f === 'cli-util.mjs') {
      // shared modules: no shebang/exec requirement, same import rule
    } else {
      assert.equal(src.split('\n')[0], '#!/usr/bin/env node', `${f} shebang`);
      assert.ok(statSync(p).mode & 0o111, `${f} executable`);
    }
    for (const m of src.matchAll(/from\s+'([^']+)'/g)) {
      assert.ok(m[1].startsWith('node:') || m[1].startsWith('./'),
        `${f} imports ${m[1]} — only node: and ./ are allowed`);
    }
  }
});
```

- [x] **Step 2: 运行确认失败**

Run: `node --test tests/sdd-scripts.test.mjs`
Expected: FAIL — 脚本文件不存在(`ENOENT`)

- [x] **Step 3: 写 `cli-util.mjs` 与四个脚本**

```js
// skills/subagent-driven-development/scripts/cli-util.mjs
// Minimal argv + output conventions shared by the executable companion
// scripts: positional args, --name/--name value flags, everything after `--`,
// and the one-line-JSON + exit-code contract (ok:true → 0, ok:false → 1).
export function parseArgs(argv, positionalNames, usage) {
  const dd = argv.indexOf('--');
  const head = dd === -1 ? argv : argv.slice(0, dd);
  const rest = dd === -1 ? [] : argv.slice(dd + 1);
  const pos = [];
  const named = {};
  for (let i = 0; i < head.length; i += 1) {
    const tok = head[i];
    if (tok.startsWith('--')) {
      const body = tok.slice(2);
      const eq = body.indexOf('=');
      if (eq !== -1) named[body.slice(0, eq)] = body.slice(eq + 1);
      else if (i + 1 < head.length && !head[i + 1].startsWith('--')) { named[body] = head[i + 1]; i += 1; }
      else named[body] = true;
    } else {
      pos.push(tok);
    }
  }
  if (pos.length !== positionalNames.length) throw new Error(usage);
  const out = {};
  positionalNames.forEach((name, idx) => { out[name] = pos[idx]; });
  return { pos: out, named, rest };
}

export function ok(fields = {}) {
  process.stdout.write(JSON.stringify({ ok: true, ...fields }) + '\n');
}

export function fail(error, exitCode = 1, fields = {}) {
  process.stdout.write(JSON.stringify({ ok: false, error, ...fields }) + '\n');
  process.exitCode = exitCode;
}

// Wrap a script main: any throw becomes {ok:false,error} + exit 1.
export function run(main) {
  try {
    main();
  } catch (err) {
    fail(String(err?.message || err));
  }
}
```

```js
#!/usr/bin/env node
// skills/subagent-driven-development/scripts/sdd-workspace.mjs
import { ok, run, parseArgs } from './cli-util.mjs';
import { sddWorkspace } from './sdd-plan.mjs';

run(() => {
  const { pos } = parseArgs(process.argv.slice(2), ['plan'], 'usage: sdd-workspace.mjs <PLAN_FILE>');
  ok({ dir: sddWorkspace(pos.plan, process.cwd()) });
});
```

```js
#!/usr/bin/env node
// skills/subagent-driven-development/scripts/task-brief.mjs
import { ok, run, parseArgs } from './cli-util.mjs';
import { taskBrief } from './sdd-plan.mjs';

run(() => {
  const { pos, named } = parseArgs(process.argv.slice(2), ['plan', 'task'],
    'usage: task-brief.mjs <PLAN_FILE> <TASK_NUMBER> [--out PATH]');
  const n = Number(pos.task);
  if (!Number.isInteger(n) || n < 1) throw new Error(`invalid task number: ${pos.task}`);
  ok({ path: taskBrief(pos.plan, n, process.cwd(), named.out === true ? undefined : named.out) });
});
```

```js
#!/usr/bin/env node
// skills/subagent-driven-development/scripts/review-package.mjs
import { ok, run, parseArgs } from './cli-util.mjs';
import { reviewPackage } from './sdd-plan.mjs';

run(() => {
  const { pos, named } = parseArgs(process.argv.slice(2), ['plan', 'base', 'head'],
    'usage: review-package.mjs <PLAN_FILE> <BASE_SHA> <HEAD_SHA> [--out PATH]');
  ok({ path: reviewPackage(pos.plan, pos.base, pos.head, process.cwd(), named.out === true ? undefined : named.out) });
});
```

```js
#!/usr/bin/env node
// skills/subagent-driven-development/scripts/tick-task.mjs
import { ok, run, parseArgs } from './cli-util.mjs';
import { tickTask } from './sdd-plan.mjs';

run(() => {
  const { pos } = parseArgs(process.argv.slice(2), ['plan', 'task'],
    'usage: tick-task.mjs <PLAN_FILE> <TASK_NUMBER>');
  const n = Number(pos.task);
  if (!Number.isInteger(n) || n < 1) throw new Error(`invalid task number: ${pos.task}`);
  const { ticked, already } = tickTask(pos.plan, n);
  ok({ plan: pos.plan, task: n, ticked, already });
});
```

```bash
chmod +x skills/subagent-driven-development/scripts/{sdd-workspace,task-brief,review-package,tick-task}.mjs
```

- [x] **Step 4: 运行确认通过**

Run: `node --test tests/sdd-scripts.test.mjs tests/sdd.test.mjs`
Expected: PASS

- [x] **Step 5: 提交**

```bash
git add skills/subagent-driven-development/scripts/ tests/sdd-scripts.test.mjs
git commit -m "feat(sdd): executable companion scripts for workspace/brief/review/tick"
```

---

### Task 3: `task-start.mjs` + `task-done.mjs`(ledger 脚本化)

**Files:**
- Create: `skills/subagent-driven-development/scripts/task-start.mjs`、`task-done.mjs`(可执行)
- Test: `tests/sdd-scripts.test.mjs`(追加)

**Interfaces:**
- Consumes: `taskBrief` / `sddWorkspace` / `git`(Task 1);`cli-util.mjs`(Task 2)
- Produces: `task-start.mjs <PLAN> <N>` → `{ok, brief, base}`;`task-done.mjs <PLAN> <N> <BASE> (--note <text> | -- <cmd…>)` → 成功 `{ok, ledger, line, log?}` / test 模式失败 `{ok:false, error, log, exitCode}` 且退出码 = 测试命令退出码

- [x] **Step 1: 写失败测试(追加到 `tests/sdd-scripts.test.mjs`)**

```js
test('task-start.mjs returns the brief path and HEAD base in one call', () => {
  const repo = makeRepo();
  const p = writePlan(repo);
  const r = sh('task-start.mjs', [p, '1'], { cwd: repo });
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
  assert.equal(r.code, 0);
  assert.ok(existsSync(r.json.brief));
  assert.ok(r.json.brief.endsWith('task-1-brief.md'));
  assert.equal(r.json.base, head);
  rmSync(repo, { recursive: true, force: true });
});

test('task-done.mjs test mode records the line only on success', () => {
  const repo = makeRepo();
  const p = writePlan(repo);
  const start = sh('task-start.mjs', [p, '1'], { cwd: repo });
  commitFile(repo, 'c.txt', 'c', 'c');
  const bad = sh('task-done.mjs', [p, '1', start.json.base, '--', 'node', '-e', 'process.exit(3)'], { cwd: repo });
  assert.equal(bad.code, 3);
  assert.equal(bad.json.ok, false);
  assert.equal(bad.json.exitCode, 3);
  const ws = join(repo, '.speccode', 'sdd', 'p');
  assert.equal(existsSync(join(ws, 'progress.md')), false, 'failure must not create the ledger');
  assert.ok(existsSync(join(ws, 'task-1-tests.log')));
  const good = sh('task-done.mjs', [p, '1', start.json.base, '--', 'node', '-e', 'console.log("1/1 pass")'], { cwd: repo });
  assert.equal(good.code, 0);
  const ledger = readFileSync(good.json.ledger, 'utf8');
  assert.ok(ledger.startsWith('# SDD ledger — plan: '));
  assert.ok(ledger.endsWith('Task 1: complete (commits ' + `${start.json.base.slice(0, 7)}..` && ledger.includes('tests: node -e console.log("1/1 pass") → 1/1 pass')));
  rmSync(repo, { recursive: true, force: true });
});

test('task-done.mjs note mode writes the note verbatim without running anything', () => {
  const repo = makeRepo();
  const p = writePlan(repo);
  const start = sh('task-start.mjs', [p, '1'], { cwd: repo });
  const r = sh('task-done.mjs', [p, '1', start.json.base, '--note', 'review clean'], { cwd: repo });
  assert.equal(r.code, 0);
  assert.match(r.json.line, /, review clean\)$/);
  assert.equal(r.json.log, undefined);
  assert.equal(existsSync(join(repo, '.speccode', 'sdd', 'p', 'task-1-tests.log')), false);
  rmSync(repo, { recursive: true, force: true });
});

test('task-done.mjs two tasks append without glue; rejects bad base and bad modes', () => {
  const repo = makeRepo();
  const p = writePlan(repo);
  const b1 = sh('task-start.mjs', [p, '1'], { cwd: repo });
  sh('task-done.mjs', [p, '1', b1.json.base, '--note', 'review clean'], { cwd: repo });
  const b2 = sh('task-start.mjs', [p, '10'], { cwd: repo });
  sh('task-done.mjs', [p, '10', b2.json.base, '--note', '2 parked'], { cwd: repo });
  const lines = readFileSync(join(repo, '.speccode', 'sdd', 'p', 'progress.md'), 'utf8').split('\n').filter(Boolean);
  assert.equal(lines.length, 3); // identity + 2 completions, no blank-line glue
  assert.equal(lines[2], 'Task 10: complete (commits ' + `${b2.json.base.slice(0, 7)}..` + 'whatever, 2 parked)'.replace(/^whatever/, ''), lines[2]);
  assert.equal(sh('task-done.mjs', [p, '1', 'deadbeef', '--note', 'x'], { cwd: repo }).code, 1);
  assert.equal(sh('task-done.mjs', [p, '1', b1.json.base], { cwd: repo }).code, 1); // no mode
  assert.equal(sh('task-done.mjs', [p, '1', b1.json.base, '--note', 'x', '--', 'node', '-v'], { cwd: repo }).code, 1); // both modes
  rmSync(repo, { recursive: true, force: true });
});
```

(`lines[2]` 断言按实现精确化:前缀 `Task 10: complete (commits <base7>..<head7>, 2 parked)`。)

- [x] **Step 2: 运行确认失败**

Run: `node --test --test-name-pattern="task-done|task-start" tests/sdd-scripts.test.mjs`
Expected: FAIL — 脚本不存在

- [x] **Step 3: 写两个脚本**

```js
#!/usr/bin/env node
// One call instead of two (every tool call is a turn that re-reads context):
// write the task brief and record BASE — the commit the task's review range
// and ledger line are cut from.
import { ok, run, parseArgs } from './cli-util.mjs';
import { taskBrief, git } from './sdd-plan.mjs';

run(() => {
  const { pos } = parseArgs(process.argv.slice(2), ['plan', 'task'],
    'usage: task-start.mjs <PLAN_FILE> <TASK_NUMBER>');
  const n = Number(pos.task);
  if (!Number.isInteger(n) || n < 1) throw new Error(`invalid task number: ${pos.task}`);
  const brief = taskBrief(pos.plan, n, process.cwd());
  const base = git(['rev-parse', 'HEAD'], { cwd: process.cwd() }).stdout.trim();
  ok({ brief, base });
});
```

```js
#!/usr/bin/env node
// Close one task in a single call: run its verification command (test mode)
// or take a note (note mode), and — only on success — append the ledger
// completion line in ONE O_APPEND write. A failing command records nothing;
// its exit code passes through.
//
// usage: task-done.mjs <PLAN_FILE> <TASK_NUMBER> <BASE> (--note <text> | -- <test command…>)
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ok, fail, run, parseArgs } from './cli-util.mjs';
import { sddWorkspace, git } from './sdd-plan.mjs';

run(() => {
  const USAGE = 'usage: task-done.mjs <PLAN_FILE> <TASK_NUMBER> <BASE> (--note <text> | -- <test command…>)';
  const { pos, named, rest } = parseArgs(process.argv.slice(2), ['plan', 'task', 'base'], USAGE);
  const n = Number(pos.task);
  if (!Number.isInteger(n) || n < 1) throw new Error(`invalid task number: ${pos.task}`);
  const note = typeof named.note === 'string' ? named.note : undefined;
  if ((note !== undefined) === (rest.length > 0)) throw new Error(`choose exactly one mode (--note or -- <cmd>)\n${USAGE}`);
  git(['rev-parse', '--verify', '--quiet', pos.base], { cwd: process.cwd() }); // invalid base throws

  const cwd = process.cwd();
  const ws = sddWorkspace(pos.plan, cwd);
  const ledger = join(ws, 'progress.md');
  const short = (r) => git(['rev-parse', '--short=7', r], { cwd }).stdout.trim();

  let annotation;
  let log;
  if (note !== undefined) {
    annotation = note;
  } else {
    const [cmd, ...args] = rest;
    log = join(ws, `task-${n}-tests.log`);
    const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
    const rc = r.status ?? 1;
    const output = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    writeFileSync(log, output);
    if (rc !== 0) {
      fail(`test command exited ${rc}; Task ${n} NOT recorded`, rc, { log, exitCode: rc });
      return;
    }
    const lines = output.split('\n').filter((l) => l.trim() !== '');
    const last = lines.length ? lines[lines.length - 1] : '(no output)';
    annotation = `tests: ${rest.join(' ')} → ${last}`;
  }
  const line = `Task ${n}: complete (commits ${short(pos.base)}..${short('HEAD')}, ${annotation})`;
  // One append write: create with the identity header when absent; repair a
  // missing trailing newline (hand-appended lines) inside the same write.
  let prefix = '';
  if (existsSync(ledger)) {
    const existing = readFileSync(ledger, 'utf8');
    if (existing.length > 0 && !existing.endsWith('\n')) prefix = '\n';
  } else {
    prefix = `# SDD ledger — plan: ${pos.plan}\n`;
  }
  appendFileSync(ledger, `${prefix}${line}\n`);
  ok({ ledger, line, ...(log ? { log } : {}) });
});
```

```bash
chmod +x skills/subagent-driven-development/scripts/task-start.mjs skills/subagent-driven-development/scripts/task-done.mjs
```

- [x] **Step 4: 运行确认通过**

Run: `node --test tests/sdd-scripts.test.mjs`
Expected: PASS

- [x] **Step 5: 提交**

```bash
git add skills/subagent-driven-development/scripts/ tests/sdd-scripts.test.mjs
git commit -m "feat(sdd): task-start and task-done companion scripts — scripted ledger completion"
```

---

### Task 4: 引擎退出 SDD 机器(删 lib/sdd.mjs、四 verb、四 tool)

**Files:**
- Delete: `lib/sdd.mjs`
- Modify: `lib/verbs.mjs`(删 import 行与四个 verb 块)、`lib/mcp.mjs`(删四个 TOOL_META 条目)、`tests/cli.test.mjs`(删九个四 verb 用例,增一个「已不存在」用例)

**Interfaces:**
- Consumes: Task 1–3(脚本已可用)
- Produces: `VERBS` 与 `TOOL_META` 不再含 `sdd-workspace` / `task-brief` / `review-package` / `tick-task`;`lib/sdd.mjs` 不存在

- [x] **Step 1: 写失败测试(先加「已不存在」用例)**

在 `tests/cli.test.mjs` 追加(放在原 SDD 用例附近):

```js
test('SDD verbs no longer exist (moved to companion scripts)', () => {
  const repo = makeRepo();
  for (const verb of ['sdd-workspace', 'task-brief', 'review-package', 'tick-task']) {
    const { code, json } = runCli(repo, verb, '--cwd', repo);
    assert.equal(code, 1);
    assert.equal(json.ok, false);
    assert.match(json.error, /unknown verb/);
  }
  rmSync(repo, { recursive: true, force: true });
});
```

Run: `node --test --test-name-pattern="no longer exist" tests/cli.test.mjs`
Expected: FAIL — 四 verb 仍存在(`code 0`)

- [x] **Step 2: 删除引擎侧实现**

`lib/verbs.mjs`:删 import 行 `import { sddWorkspace, taskBrief, reviewPackage, tickTask } from './sdd.mjs';`,删四个 verb 块(以 `'sdd-workspace':` 起至 `'tick-task'` 块止的四个相邻条目,块间空行一并)。
`lib/mcp.mjs`:删 TOOL_META 中四行 `'sdd-workspace': tool(...)`、`'task-brief': tool(...)`、`'review-package': tool(...)`、`'tick-task': tool(...)`(含各自实参)。
`git rm lib/sdd.mjs`。
`tests/cli.test.mjs`:删九个用例块(按名定位):`sdd-workspace requires --plan`、`sdd-workspace rejects a bare --plan flag`、`task-brief rejects a bare --task flag (never silently task 1)`、`task-brief extracts a task into the workspace`、`review-package writes a range-named diff file`、`sdd-workspace inside a linked worktree resolves to the worktree root`、`tick-task verb ticks plan checkboxes and returns ticked/already`、`tick-task verb errors when task N absent`、`tick-task verb is idempotent and leaves the plan byte-identical on re-run`。

- [x] **Step 3: 运行确认通过(含 parity)**

Run: `node --test tests/cli.test.mjs tests/verbs.test.mjs tests/mcp.test.mjs tests/sdd-scripts.test.mjs`
Expected: PASS——parity 守卫(VERBS ∖ EXCLUDED == TOOL_META)动态成立;e2e 的 tools/list 不再含四 tool

- [x] **Step 4: 提交**

```bash
git add -A lib/ tests/cli.test.mjs
git commit -m "refactor(engine)!: drop SDD verbs/tools and lib/sdd.mjs — machinery moved to companion scripts"
```

---

### Task 5: prose 改写(两个 SKILL + 两份 reference)+ 残留守卫

**Files:**
- Modify: `skills/subagent-driven-development/SKILL.md`(锚点段 + 12 处改写)
- Modify: `skills/executing-plans/SKILL.md`(锚点段 + ledger 协议引入 + tick 改写)
- Modify: `references/task-reviewer-prompt.md`、`references/re-review-prompt.md`(占位符说明)
- Test: `tests/sdd-scripts.test.mjs`(追加两条守卫)

**Interfaces:**
- Consumes: Task 1–3 脚本全部 CLI 形态
- Produces: prose 中 SDD 机械调用一律 `node <scripts>/<name>.mjs …`;`<scripts>` 锚点段每 skill 恰一段

- [x] **Step 1: 写失败守卫(追加到 `tests/sdd-scripts.test.mjs`)**

```js
const SKILL_DIR = fileURLToPath(new URL('../skills/', import.meta.url));

test('skills and references invoke SDD machinery via companion scripts, not verbs', () => {
  const files = [
    'subagent-driven-development/SKILL.md', 'executing-plans/SKILL.md',
    '../references/task-reviewer-prompt.md', '../references/re-review-prompt.md',
  ];
  for (const rel of files) {
    const md = readFileSync(join(SKILL_DIR, rel), 'utf8');
    assert.ok(!/speccode (sdd-workspace|task-brief|review-package|tick-task)/.test(md), `${rel} still calls SDD verbs`);
  }
});

test('every <scripts>/x.mjs referenced by the SDD skills exists', () => {
  for (const rel of ['subagent-driven-development/SKILL.md', 'executing-plans/SKILL.md']) {
    const md = readFileSync(join(SKILL_DIR, rel), 'utf8');
    assert.ok(md.includes('<scripts>'), `${rel} must define the anchor once`);
    for (const m of md.matchAll(/<scripts>\/([a-z-]+\.mjs)/g)) {
      assert.ok(existsSync(join(SCRIPTS, m[1])), `${m[1]} referenced in ${rel} does not exist`);
    }
  }
});
```

Run: `node --test --test-name-pattern="companion scripts, not verbs|referenced by the SDD skills" tests/sdd-scripts.test.mjs`
Expected: 第一条 FAIL(prose 仍是 verb 形态)

- [x] **Step 2: `skills/subagent-driven-development/SKILL.md` 改写(12 处)**

(a) 在「宿主能力依赖」blockquote 之后新增锚点段:

```markdown
> **伴生脚本锚点**:本 skill 的执行机器是随 skill 分发的伴生脚本,位于本 skill 目录下的 `scripts/`(宿主加载 skill 时报告的 base directory;下文统一写作 `<scripts>`)。宿主未报告 base directory 时,以 `$(speccode plugin-root --cwd .)/skills/subagent-driven-development/scripts` 兜底。调用形态 `node <scripts>/<name>.mjs …`,输出单行 JSON(`ok:false` 即失败、exit 非零)。
```

(b)–(l) 以下精确替换(old → new):

1. `` `speccode sdd-workspace --cwd . --plan <PLAN_FILE>`——它输出 JSON,取 `dir` 字段 `` → `` `node <scripts>/sdd-workspace.mjs <PLAN_FILE>`——它输出 JSON,取 `dir` 字段 ``
2. `  \`# SDD ledger — plan: <plan file path>\`。` → 同行尾追加 `(\`task-done.mjs\` 在 ledger 尚不存在时也会先写同一身份行)`
3. `派发前记录 BASE(\`git rev-parse HEAD\`)——review package 与修复轮次的 diff 都需要它。\n\n- **任务 brief:** 派发实现者之前,运行\n  \`speccode task-brief --cwd . --plan <PLAN_FILE> --task <N>\`——它把该任务的完整文本提取到一个唯一命名的文件,输出 JSON,取 \`path\` 字段。` → `派发前运行 \`node <scripts>/task-start.mjs <PLAN_FILE> <N>\`——一次调用写出该任务 brief 并记录 BASE:输出 JSON 的 \`brief\` 字段是 brief 文件路径,\`base\` 字段是 HEAD 全 sha(review package 与修复轮次的 diff 都以它为起点)。\n\n- **任务 brief:** \`task-start.mjs\` 已把该任务的完整文本提取到唯一命名的 brief 文件。`
4. `` `speccode review-package --cwd . --plan <PLAN_FILE> --base <BASE> --head <HEAD>`——它输出 JSON `` → `` `node <scripts>/review-package.mjs <PLAN_FILE> <BASE> <HEAD>`——它输出 JSON ``(DONE 段,出现两处同文,逐一替换)
5. `  \`speccode review-package --cwd . --plan <PLAN_FILE> --base <BASE> --head <HEAD>\`,把 JSON 里` → `  \`node <scripts>/review-package.mjs <PLAN_FILE> <BASE> <HEAD>\`,把 JSON 里`(任务审查段)
6. `` `speccode review-package --cwd . --plan <PLAN_FILE> --base <FIX_BASE> --head <HEAD>`,其中 FIX_BASE `` → `` `node <scripts>/review-package.mjs <PLAN_FILE> <FIX_BASE> <HEAD>`,其中 FIX_BASE ``(re-review 段)
7. 完成行手写段:
   old:
   ```
   当审查干净返回——或每条未决发现都在熔断处带 ruling park 了——把完成行追加到 ledger,与其他簿记写在同一条消息里:

   - `Task <N>: complete (commits <base7>..<head7>, review clean)`
   - `Task <N>: complete (commits <base7>..<head7>, <K> parked)`(熔断触发后)
   ```
   new:
   ```
   当审查干净返回——或每条未决发现都在熔断处带 ruling park 了——经伴生脚本把完成行追加到 ledger(MUST NOT 手写该行),与其他簿记写在同一条消息里:

   - `node <scripts>/task-done.mjs <PLAN_FILE> <N> <BASE> --note "review clean"`
   - `node <scripts>/task-done.mjs <PLAN_FILE> <N> <BASE> --note "<K> parked"`(熔断触发后)

   脚本以单次追加写入 `Task <N>: complete (commits <base7>..<head7>, <note>)`(ledger 不存在时先写身份首行),输出 JSON 的 `line` 字段即写入的行。
   ```
8. `   speccode tick-task --cwd . --plan <PLAN_FILE> --task <N>` → `   node <scripts>/tick-task.mjs <PLAN_FILE> <N>`;紧随的 `verb 输出 \`ticked\`` → `脚本输出 \`ticked\``
9. `` `speccode review-package --cwd . --plan <PLAN_FILE> --base <MERGE_BASE> --head <HEAD>`(MERGE_BASE `` → `` `node <scripts>/review-package.mjs <PLAN_FILE> <MERGE_BASE> <HEAD>`(MERGE_BASE ``(终审段)
10. `` `speccode review-package --cwd . --plan <PLAN_FILE> --base <FIX_BASE> --head <HEAD>`, `` → `` `node <scripts>/review-package.mjs <PLAN_FILE> <FIX_BASE> <HEAD>`, ``(终审 re-review 段)
11. 示例段:`[解析工作区: speccode sdd-workspace --cwd . --plan docs/plans/feature-plan.md — 里面没有 ledger,全新开始]` → `[解析工作区: node <scripts>/sdd-workspace.mjs docs/plans/feature-plan.md — 里面没有 ledger,全新开始]`
12. 示例段:`[对 Task 1 跑 task-brief;带 brief + 报告路径 + 上下文派发实现者]` → `[对 Task 1 跑 task-start.mjs(brief + BASE);带 brief + 报告路径 + 上下文派发实现者]`

- [x] **Step 3: `skills/executing-plans/SKILL.md` 改写**

(a)「开始时宣布」行后新增锚点段:

```markdown
> **伴生脚本锚点**:本 skill 使用的 tick/ledger 伴生脚本随 `subagent-driven-development` skill 分发:`<scripts>` = `<本 skill base>/../subagent-driven-development/scripts`(宿主报告的 base directory 的相邻目录);宿主未报告时以 `$(speccode plugin-root --cwd .)/skills/subagent-driven-development/scripts` 兜底。调用形态 `node <scripts>/<name>.mjs …`,输出单行 JSON。
```

(b) 入口绑定第 4 步(记录 BASE)之后新增第 5 步:

```markdown
5. **解析工作区与 ledger**:运行 `node <scripts>/sdd-workspace.mjs <PLAN_FILE>` 取 `dir`;若 `<dir>/progress.md` 存在且首行为 `# SDD ledger — plan: <PLAN_FILE>`,凡有 `Task <N>: complete` 行的任务都是 DONE——跳过不重做,从第一个没有完成行的任务继续。
```

(c) 第 2 步任务循环改为:

```markdown
1. 标记为 in_progress;运行 `node <scripts>/task-start.mjs <PLAN_FILE> <N>` 记下 `base`(本任务 ledger 行与 diff 的起点)
2. 严格按各步执行(plan 的步是一口大小的)
3. 按规定运行验证,并以 task-done 收口:`node <scripts>/task-done.mjs <PLAN_FILE> <N> <base> -- <该任务的验证命令>`——脚本运行验证命令、全量输出落工作区日志,**仅通过时**追加 ledger 完成行(`Task <N>: complete (commits …, tests: … → …)`),失败透传退出码、不记行、不进入下一步
4. 标记为 completed
5. 触发 onTaskCompleted 钩子(每个 task 完成时,payload 带 `"task": <N>`):(钩子命令原文保留)
6. **同步勾选 plan 进度**:运行
   ```bash
   node <scripts>/tick-task.mjs <PLAN_FILE> <N>
   ```
```

紧随文字 `verb 输出 \`ticked\`` → `脚本输出 \`ticked\``;「`ticked` 为空 → 跳过 commit」与「时序硬约束」两段措辞保留。

- [x] **Step 4: 两份 reference 模板改写**

`references/re-review-prompt.md`:
old: `` - `[DIFF_FILE]` — the path `speccode review-package --cwd . --plan\n  PLAN_FILE --base FIX_BASE --head HEAD` printed as the JSON `path` field ``
new: `` - `[DIFF_FILE]` — the path `node <scripts>/review-package.mjs PLAN_FILE\n  FIX_BASE HEAD` printed as the JSON `path` field (see the SDD skill for the `<scripts>` anchor) ``

`references/task-reviewer-prompt.md`:
old: `` - `[BRIEF_FILE]` — REQUIRED: the task brief file (`speccode task-brief\n  --cwd . --plan PLAN --task N` prints it as the JSON `path` field; same file ``
new: `` - `[BRIEF_FILE]` — REQUIRED: the task brief file (`node\n  <scripts>/task-brief.mjs PLAN N` prints it as the JSON `path` field; same file ``(分词按原文行宽,保持单行语义)
old: `` package to (`speccode review-package --cwd . --plan PLAN_FILE --base\n  BASE --head HEAD` prints the unique path it wrote as the JSON `path` ``
new: `` package to (`node <scripts>/review-package.mjs PLAN_FILE BASE HEAD`\n  prints the unique path it wrote as the JSON `path` ``

- [x] **Step 5: 运行确认通过(含全部 prose 守卫)**

Run: `node --test tests/sdd-scripts.test.mjs tests/cli.test.mjs`
Expected: PASS——含两条新守卫、既有宿主 token 守卫、`speccode.mjs <verb>` 守卫、两条 tick-task prose 守卫

- [x] **Step 6: 提交**

```bash
git add skills/ references/ tests/sdd-scripts.test.mjs
git commit -m "docs(skills): SDD skills call companion scripts; scripted ledger; anchored script paths"
```

---

### Task 6: CHANGELOG、AGENTS.md 与全量验证

**Files:**
- Modify: `CHANGELOG.md`(`[Unreleased]`)、`AGENTS.md`(架构节、常用命令、关键不变量)

**Interfaces:** 无代码接口;产出文档与全量绿灯

- [x] **Step 1: CHANGELOG `[Unreleased]` 追加**

```markdown
- Added: SDD 伴生脚本 `task-start.mjs` / `task-done.mjs`(ledger 脚本化:BASE+brief 一次取得;完成行仅在验证命令通过(note 模式则按注记)时单次追加写入)。
- Changed: **BREAKING** SDD 执行机器由引擎 verb 改为伴生脚本(`skills/subagent-driven-development/scripts/`,node ESM、自包含、不 import lib、随插件分发零安装)——`sdd-workspace` / `task-brief` / `review-package` / `tick-task` 四个 verb 与同名 MCP tool 删除,升级路径:改调对应脚本 CLI(位置参数、单行 JSON 输出不变);`lib/sdd.mjs` 移除。
```

- [x] **Step 2: AGENTS.md 三处**

1. 架构第 1 条「17 个经单测的纯逻辑模块(… timestamp / verbs)」→「16 个经单测的纯逻辑模块(… timestamp / verbs)」(去掉 sdd)。
2. 架构第 3 条「命令交互层」段末追加一句:`SDD 执行机器以伴生脚本形态随 skill 分发(skills/subagent-driven-development/scripts/,node ESM、不 import lib、锚点见各 skill 的「伴生脚本锚点」段),不再经引擎 verb。`
3. 常用命令段在 MCP 示例后追加:

```bash
# 手动驱动 SDD 伴生脚本(单行 JSON 输出)
node skills/subagent-driven-development/scripts/sdd-workspace.mjs speccode/changes/<slug>/plan/<plan>.md
```

4. 关键不变量「SDD 工作区 show-toplevel(有意差异)」条中「(见 `sdd.mjs`)」改为「(见 `skills/subagent-driven-development/scripts/sdd-plan.mjs`)」。

- [x] **Step 3: 全量测试**

Run: `node --test ./tests/*.test.mjs`
Expected: PASS,`fail 0`

- [x] **Step 4: 无引擎冒烟 + 残留 grep**

```bash
T=$(mktemp -d) && git -C "$T" init -q -b master && cd "$T" && git config user.email t@t && git config user.name t && echo x > README.md && git add . && git commit -qm init
printf '# p\n\n### Task 1: a\n\n- [ ] s\n' > p.md
PATH=$(dirname $(command -v git)):/usr/bin:/bin node $OLDPWD/skills/subagent-driven-development/scripts/sdd-workspace.mjs p.md
node $OLDPWD/skills/subagent-driven-development/scripts/task-start.mjs p.md 1
node $OLDPWD/skills/subagent-driven-development/scripts/task-done.mjs p.md 1 $(git rev-parse HEAD) --note "review clean"
node $OLDPWD/skills/subagent-driven-development/scripts/tick-task.mjs p.md 1
cat .speccode/sdd/p/progress.md && cat p.md
cd - && rm -rf "$T"
grep -rn "from '.*lib/" skills/ | wc -l          # 预期 0
grep -rn "speccode \(sdd-workspace\|task-brief\|review-package\|tick-task\)" skills/ references/ | grep -v archive | wc -l   # 预期 0
```
Expected: ledger 一行身份行 + 一行完成行;`p.md` 的 step 已勾选;grep 两项均 0

- [x] **Step 5: 提交**

```bash
git add CHANGELOG.md AGENTS.md
git commit -m "docs: SDD companion scripts replace engine verbs (BREAKING)"
```

---

## 计划自查

- **规格覆盖**:sdd-document-lifecycle「SDD 伴生脚本」(位置/自包含/CLI 契约/fence 规则/幂等)↔ Task 1–2;「SDD 工作区」↔ Task 1(sddWorkspace 逐字)+ Task 2(worktree 根用例);「ledger 脚本化」↔ Task 3;「plan 执行进度勾选」↔ Task 5(两 skill 改脚本调用);「引擎不再暴露四 verb」↔ Task 4;plugin-packaging「裸调例外/布局 scripts/ 约束」↔ Task 2(守卫)+ Task 5(锚点段)。
- **占位符扫描**:无 TBD;prose 改写全部给出 old→new 精确文本;测试含真实代码。
- **类型一致性**:`parseArgs → {pos, named, rest}`、`ok/fail/run`、`sdd-plan.mjs` 导出名与 Task 3 引用一致;`<scripts>` 锚点在两 skill 与守卫测试中同一写法。
