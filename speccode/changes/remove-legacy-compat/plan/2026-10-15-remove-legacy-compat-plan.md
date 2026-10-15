# remove-legacy-compat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 拆除引擎与文档中全部向下兼容面(v0.1 pending_operation 归一化、v2 state 双格式与迁移器、config 退役字段机制、knowledge 旧标记读兼容、memory `_exploring` 遗留键),读路径只认 v3/现行格式。

**Architecture:** 自底向上:先 lib(契约源头)再 bin(verb 透传)再 skills/docs(prose 同步),每任务带测试红-绿-提交循环。删除的导出先 `rg` 引用点确认只被本任务波及。

**Tech Stack:** Node ≥ 24 纯 ESM、node:test、零第三方依赖。

## Global Constraints

- 全量测试命令:`node --test ./tests/*.test.mjs`(禁止裸 `node --test tests/`)。
- 所有 state/config 写入走 `atomic.writeJsonAtomic`;命令层逻辑一律经 verb,不手写 JSON。
- 单仓三合一:插件根即仓库根;`support/`、`speccode/`、`docs/` 不进打包声明。
- BREAKING 语义:旧数据(`state/features/`、退役 config 字段、旧 knowledge 标记、无斜杠 `_exploring.md`)升级后不可见/不可读,**不提供迁移工具、不做存在性警告**。
- 历史记录不动:CHANGELOG.md、`speccode/archive/`、knowledge 块的归档包名出处括注。
- 中英设计文档(DESIGN.md/DESIGN_CN.md)结构一一对应,任何内容改动同步两版。
- commit message 用英文常规前缀(feat/fix/docs/refactor/chore)。

---

### Task 1: lib/state.mjs 收口为 v3-only

**Files:**
- Modify: `lib/state.mjs`(整文件重构,227 行 → ~150 行)
- Test: `tests/state.test.mjs`

**Interfaces:**
- Consumes: `readJson`/`writeJsonAtomic`(atomic.mjs)、`branchToStateName`/`stateNameToBranch`/`TYPES`(slug.mjs)
- Produces: `WORKTREE_STATUS`、`branchesDir`、`readState`、`writeState`、`deleteState`、`listActiveFeatures`、`lintStateEntries`、`validateStateShape`(导出面收窄:删除 `normalizeState`、`featuresDir`、`migrateStateV2toV3`)

- [x] **Step 1: 重写测试为新契约(先红)**

`tests/state.test.mjs` 整文件替换为:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeJsonAtomic } from '../lib/atomic.mjs';
import {
  WORKTREE_STATUS, branchesDir, readState, writeState, deleteState, listActiveFeatures,
  validateStateShape, lintStateEntries,
} from '../lib/state.mjs';

function tmp() { return mkdtempSync(join(tmpdir(), 'speccode-state-')); }

test('WORKTREE_STATUS enum values', () => {
  assert.deepEqual(WORKTREE_STATUS, {
    PENDING: 'pending', IN_PROGRESS: 'in_progress',
    PR_OPEN: 'pr_open', COMPLETED: 'completed',
  });
});

test('branchesDir points at state/branches', () => {
  assert.equal(branchesDir('/x/.speccode'), '/x/.speccode/state/branches');
});

test('readState returns null when absent', () => {
  const dir = tmp();
  assert.equal(readState(dir, 'feature/none'), null);
  rmSync(dir, { recursive: true, force: true });
});

test('writeState then readState round-trips', () => {
  const dir = tmp();
  const state = { branch: 'feature/payment', type: 'feature', worktree: '/wt/payment',
    merge_target: 'main', status: 'in_progress', created_at: '2026-07-10T00:00:00.000Z', initial_branch: 'main' };
  writeState(dir, 'feature/payment', state);
  assert.deepEqual(readState(dir, 'feature/payment'), state);
  rmSync(dir, { recursive: true, force: true });
});

test('listActiveFeatures empty dir returns []', () => {
  const dir = tmp();
  assert.deepEqual(listActiveFeatures(dir), []);
  rmSync(dir, { recursive: true, force: true });
});

test('listActiveFeatures returns all branch states', () => {
  const dir = tmp();
  const a = { branch: 'feature/payment', type: 'feature', worktree: null, merge_target: 'main',
    status: 'pending', created_at: '2026-01-01T00:00:00.000Z', initial_branch: 'main' };
  const b = { branch: 'bugfix/login', type: 'bugfix', worktree: null, merge_target: 'main',
    status: 'pending', created_at: '2026-01-02T00:00:00.000Z', initial_branch: 'main' };
  writeState(dir, 'feature/payment', a);
  writeState(dir, 'bugfix/login', b);
  assert.deepEqual(listActiveFeatures(dir).map((s) => s.branch).sort(), ['bugfix/login', 'feature/payment']);
  rmSync(dir, { recursive: true, force: true });
});

test('deleteState removes the file', () => {
  const dir = tmp();
  writeState(dir, 'feature/payment', { branch: 'feature/payment' });
  deleteState(dir, 'feature/payment');
  assert.equal(existsSync(join(branchesDir(dir), 'feature__payment.json')), false);
  rmSync(dir, { recursive: true, force: true });
});

// ---- v2 遗留目录完全隐形(新契约核心) ----

test('a pre-existing state/features dir is invisible to every read path', () => {
  const root = tmp();
  const sc = join(root, '.speccode');
  mkdirSync(join(sc, 'state', 'features'), { recursive: true });
  writeJsonAtomic(join(sc, 'state', 'features', 'feature__old.json'), {
    feature_branch: 'feature/old', status: 'in_progress', worktrees: {},
  });
  assert.equal(readState(sc, 'feature/old'), null, 'readState 不回退 features 目录');
  assert.deepEqual(listActiveFeatures(sc), [], 'listActiveFeatures 不扫 features 目录');
  assert.deepEqual(lintStateEntries(sc), [], 'lintStateEntries 不扫 features 目录');
  rmSync(root, { recursive: true, force: true });
});

test('writeState always lands in state/branches, never follows a legacy file', () => {
  const root = tmp();
  const sc = join(root, '.speccode');
  mkdirSync(join(sc, 'state', 'features'), { recursive: true });
  writeJsonAtomic(join(sc, 'state', 'features', 'feature__legacy.json'), {
    feature_branch: 'feature/legacy', status: 'in_progress', worktrees: {},
  });
  writeState(sc, 'feature/legacy', { feature_branch: 'feature/legacy', status: 'in_progress', worktrees: {} });
  assert.equal(existsSync(join(sc, 'state', 'branches', 'feature__legacy.json')), true, '写入永远落 branches');
  rmSync(root, { recursive: true, force: true });
});

test('validateStateShape: warning surface, clean pass, no v2 special case', () => {
  const ok = { branch: 'feature/a', type: 'feature', worktree: '/wt/a', merge_target: 'main',
    status: 'in_progress', created_at: '2026-01-01T00:00:00.000Z', initial_branch: 'main' };
  assert.deepEqual(validateStateShape(ok), []);
  assert.ok(validateStateShape({ ...ok, worktree: null }).some((w) => w.includes('worktree')),
    'worktree null 收紧为警告(string-only)');
  const bad = { branch: 'feature/a', type: 'epic', worktree: 3, merge_target: 'main',
    status: 'done', created_at: 'yesterday', initial_branch: 'main', surprise: 1 };
  const w = validateStateShape(bad).join('\n');
  for (const needle of ['type', 'status', 'created_at', 'worktree', 'surprise']) {
    assert.ok(w.includes(needle), `warning should mention ${needle}`);
  }
  const parent = { branch: 'feature/p', kind: 'integration', children: 'x', status: 'in_progress',
    created_at: '2026-01-01T00:00:00.000Z', initial_branch: 'main', worktree: '/w' };
  const pw = validateStateShape(parent).join('\n');
  assert.ok(pw.includes('children'));
  assert.ok(pw.includes('worktree'));
  const v2shape = validateStateShape({ feature_branch: 'feature/old', worktrees: {} });
  assert.ok(v2shape.some((x) => x.includes('branch')), 'v2 形状按普通 v3 契约报缺失字段,无专门迁移提示');
});

test('writeState gate applies to every payload shape', () => {
  const root = tmp();
  const sc = join(root, '.speccode');
  const good = { branch: 'feature/a', type: 'feature', worktree: null, merge_target: 'main',
    status: 'in_progress', created_at: '2026-01-01T00:00:00.000Z', initial_branch: 'main', note: 'x' };
  writeState(sc, 'feature/a', good);
  assert.equal(readState(sc, 'feature/a').note, 'x', '未知键 note 放行');
  assert.throws(() => writeState(sc, 'feature/a', { ...good, branch: 'feature/b' }), /branch/i);
  assert.throws(() => writeState(sc, 'feature/a', { ...good, status: 'done' }), /status/i);
  assert.throws(() => writeState(sc, 'feature/a', { ...good, type: 'epic' }), /type/i);
  assert.throws(() => writeState(sc, 'feature/a', { ...good, created_at: 'nope' }), /created_at/i);
  assert.throws(() => writeState(sc, 'feature/p', { ...good, kind: 'integration', children: 'x' }), /children/i);
  rmSync(root, { recursive: true, force: true });
});

test('lintStateEntries: unparseable JSON is described, never a crash', () => {
  const root = tmp();
  const sc = join(root, '.speccode');
  mkdirSync(join(sc, 'state', 'branches'), { recursive: true });
  writeFileSync(join(sc, 'state', 'branches', 'feature__mangled.json'), '{not json');
  const entries = lintStateEntries(sc);
  const mangled = entries.find((e) => e.branch === 'feature/mangled');
  assert.ok(mangled && mangled.warnings.some((w) => w.includes('unparseable')), '坏 JSON 被描述为警告');
  rmSync(root, { recursive: true, force: true });
});
```

- [x] **Step 2: 运行确认失败**

Run: `node --test tests/state.test.mjs`
Expected: FAIL —— import 报 `normalizeState`/`migrateStateV2toV3` 不存在(尚未删除时为旧用例失败/新契约用例失败)。

- [x] **Step 3: 重写 lib/state.mjs**

删除:`LEGACY_COMMAND_NAMES`、`normalizeState`、`featuresDir`、`readStateAt` 的归一化与回退、`writeState` 的 v2Path 分流与 `feature_branch` 门禁绕过、`deleteState`/`listActiveFeatures`/`lintStateEntries` 的双目录、`validateStateShape` 的 v2 提前返回与 worktree null 容忍、`migrateStateV2toV3`。新文件全文:

```js
import { readdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeJsonAtomic } from './atomic.mjs';
import { branchToStateName, stateNameToBranch, TYPES } from './slug.mjs';

export const WORKTREE_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  PR_OPEN: 'pr_open',
  COMPLETED: 'completed',
};

export function branchesDir(speccodeDir) {
  return join(speccodeDir, 'state', 'branches');
}

function stateFilePathIn(dir, branch) {
  return join(dir, `${branchToStateName(branch)}.json`);
}

export function readState(speccodeDir, branch) {
  return readJson(stateFilePathIn(branchesDir(speccodeDir), branch));
}

const ISO_8601_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const STATUS_VALUES = Object.values(WORKTREE_STATUS);
const V3_COMMON_KEYS = ['branch', 'status', 'created_at', 'initial_branch', 'completed_at', 'pr_number', 'note', 'pending_operation'];
const V3_NORMAL_EXTRA_KEYS = ['type', 'worktree', 'merge_target'];
const V3_PARENT_EXTRA_KEYS = ['kind', 'children'];

// Read-side shape lint for a single state entry. Produces warning strings,
// never throws — any on-disk data can be described.
export function validateStateShape(state) {
  if (!state || typeof state !== 'object') return ['state entry is not an object'];
  const parent = state.kind === 'integration';
  const required = parent
    ? ['branch', 'status', 'created_at', 'initial_branch']
    : ['branch', 'type', 'merge_target', 'status', 'created_at', 'initial_branch'];
  const warnings = [];
  for (const k of required) if (state[k] === undefined) warnings.push(`missing required field: ${k}`);
  if (state.branch !== undefined && typeof state.branch !== 'string') warnings.push('branch must be a string');
  if (state.type !== undefined && !TYPES.includes(state.type)) {
    warnings.push(`invalid type: ${state.type} (allowed: ${TYPES.join(', ')})`);
  }
  if (state.status !== undefined && !STATUS_VALUES.includes(state.status)) {
    warnings.push(`invalid status: ${state.status} (allowed: ${STATUS_VALUES.join(', ')})`);
  }
  for (const k of ['created_at', 'completed_at']) {
    if (state[k] !== undefined && !ISO_8601_RE.test(String(state[k]))) {
      warnings.push(`${k} is not ISO 8601: ${state[k]}`);
    }
  }
  if (parent) {
    if (state.children !== undefined && !Array.isArray(state.children)) {
      warnings.push('children must be an array of {slug}');
    }
    if ('worktree' in state) warnings.push('parent entity must not carry a worktree field');
  } else if (state.worktree !== undefined && typeof state.worktree !== 'string') {
    warnings.push('worktree must be a string');
  }
  const known = new Set([...V3_COMMON_KEYS, ...(parent ? V3_PARENT_EXTRA_KEYS : V3_NORMAL_EXTRA_KEYS)]);
  for (const k of Object.keys(state)) {
    if (!known.has(k)) warnings.push(`unknown top-level key (informational, tolerated): ${k}`);
  }
  return warnings;
}

// Gate for writeState — only fields with no legitimate explanation are fatal:
// present-but-wrong values (registered-key mismatch, bad enums, non-ISO
// timestamps, non-array children on a parent). Missing fields stay warnings
// (partial read-modify-write payloads are legal).
function fatalStateErrors(branch, state) {
  const fatal = [];
  if (typeof state.branch === 'string' && state.branch !== branch) {
    fatal.push(`branch key mismatch: payload says ${state.branch}, registered as ${branch}`);
  }
  if (state.type !== undefined && !TYPES.includes(state.type)) fatal.push(`invalid type: ${state.type}`);
  if (state.status !== undefined && !STATUS_VALUES.includes(state.status)) fatal.push(`invalid status: ${state.status}`);
  if (state.created_at !== undefined && !ISO_8601_RE.test(String(state.created_at))) {
    fatal.push(`created_at is not ISO 8601: ${state.created_at}`);
  }
  if (state.kind === 'integration' && state.children !== undefined && !Array.isArray(state.children)) {
    fatal.push('children must be an array of {slug}');
  }
  return fatal;
}

export function writeState(speccodeDir, branch, state) {
  if (state && typeof state === 'object') {
    const fatal = fatalStateErrors(branch, state);
    if (fatal.length) throw new Error(`write-state rejected: ${fatal.join('; ')}`);
  }
  writeJsonAtomic(stateFilePathIn(branchesDir(speccodeDir), branch), state);
}

export function deleteState(speccodeDir, branch) {
  const p = stateFilePathIn(branchesDir(speccodeDir), branch);
  if (existsSync(p)) rmSync(p);
}

function readDirStates(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson(join(dir, f)))
    .filter((s) => s !== null);
}

export function listActiveFeatures(speccodeDir) {
  return readDirStates(branchesDir(speccodeDir));
}

// Tolerant lint enumeration: unlike listActiveFeatures, a hand-mangled file is
// described (unparseable-JSON warning with the filename-stem branch key)
// instead of crashing the linter — lint must never become its own failure
// point. Read-only; never used by write paths.
export function lintStateEntries(speccodeDir) {
  const dir = branchesDir(speccodeDir);
  const out = [];
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const stem = f.slice(0, -'.json'.length);
    let raw;
    try {
      raw = readJson(join(dir, f));
    } catch (err) {
      out.push({ branch: stateNameToBranch(stem), warnings: [`unparseable JSON: ${String(err?.message || err)}`] });
      continue;
    }
    if (raw === null) continue;
    out.push({ branch: raw?.branch ?? stateNameToBranch(stem), warnings: validateStateShape(raw) });
  }
  return out;
}
```

- [x] **Step 4: 运行确认通过**

Run: `node --test tests/state.test.mjs`
Expected: PASS(全部用例)。注:此时 `tests/cli.test.mjs`/`tests/reconcile.test.mjs` 仍引用旧面,本任务只看 state 文件绿。

- [x] **Step 5: 提交**

```bash
git add lib/state.mjs tests/state.test.mjs
git commit -m "refactor: state module is v3-only — drop v2 dual-format, migration, v0.1 normalization"
```

### Task 2: lib/reconcile.mjs 删 legacy 透传

**Files:**
- Modify: `lib/reconcile.mjs:7-16,26,46,65-69`
- Test: `tests/reconcile.test.mjs:102-130`

**Interfaces:**
- Consumes: `listActiveFeatures`/`writeState`/`WORKTREE_STATUS`(Task 1 后的单格式版)
- Produces: `reconcile(speccodeDir, opts)` → `{features, orphans, conflicts, advanced}`,features 只含 `state/branches/` 条目

- [x] **Step 1: 改测试(先红)** —— 把 `tests/reconcile.test.mjs` 中 `test('v3 reconcile: v2 entries pass through untouched', ...)` 整个用例替换为:

```js
test('v3 reconcile: a state/features dir is completely invisible', () => {
  // 建一个带 v2 遗留文件的最小 repo(复用文件顶部既有 makeRepo/写文件模式)
  const repo = makeRepo();
  mkdirSync(join(repo, '.speccode', 'state', 'features'), { recursive: true });
  writeJsonAtomic(join(repo, '.speccode', 'state', 'features', 'feature__old.json'), {
    feature_branch: 'feature/old', status: 'in_progress', worktrees: {},
  });
  const out = reconcile(repo, { cwd: repo });
  assert.equal(out.features.length, 0, 'v2 目录不进 features');
  assert.deepEqual(out.orphans, [], 'v2 目录不产生 orphan');
  rmSync(repo, { recursive: true, force: true });
});
```

(导入段按需补 `mkdirSync`;删除文件里对 `featuresDir` 的 import(如有)。)

- [x] **Step 2: 运行确认失败**

Run: `node --test --test-name-pattern="invisible" tests/reconcile.test.mjs`
Expected: FAIL —— 当前实现把 v2 条目并入 features。

- [x] **Step 3: 实现** —— `lib/reconcile.mjs`:头注释第 9 行改为单格式描述;删除 `const legacy = all.filter(...)` 行;`const v3 = all.filter((b) => typeof b?.branch === 'string');` 改为直接 `const features = listActiveFeatures(speccodeDir);` 并全文把 `v3` 引用改为 `features`(byBranch 构造、循环 1/3、写回循环);返回 `{ features, orphans, conflicts: [], advanced }`。

- [x] **Step 4: 运行确认通过**

Run: `node --test tests/reconcile.test.mjs`
Expected: PASS。

- [x] **Step 5: 提交**

```bash
git add lib/reconcile.mjs tests/reconcile.test.mjs
git commit -m "refactor: reconcile reads state/branches only — legacy passthrough removed"
```

### Task 3: lib/config.mjs 退役字段机制删除

**Files:**
- Modify: `lib/config.mjs:38-54`
- Test: `tests/cli.test.mjs`(lint-state 用例,~1421 行区)

**Interfaces:**
- Produces: `validateConfigShape(config)` 警告面收窄(无退役字段、无 version≠3 警告);`RETIRED_CONFIG_FIELDS` 导出删除

- [x] **Step 1: 改测试(先红)** —— `tests/cli.test.mjs` 两处:
  1. 用例 `lint-state verb: reports config + state warnings, exit 0`:config fixture 里删掉 `host: 'zcode'` 与对应断言 `json.config.warnings.some((x) => x.includes('host'))`,改断言坏 state 警告不变。
  2. 用例 `lint-state: v2 entry and corrupt JSON described without crashing` 整体替换为:

```js
test('lint-state: features dir ignored, corrupt JSON described without crashing', () => {
  const repo = makeRepo();
  mkdirSync(join(repo, '.speccode', 'state', 'branches'), { recursive: true });
  mkdirSync(join(repo, '.speccode', 'state', 'features'), { recursive: true });
  writeJsonAtomic(join(repo, '.speccode', 'state', 'features', 'feature__old.json'),
    { feature_branch: 'feature/old', status: 'in_progress', worktrees: {} });
  writeFileSync(join(repo, '.speccode', 'state', 'branches', 'feature__mangled.json'), '{oops');
  const { code, json } = runCli(repo, 'lint-state', '--cwd', repo);
  assert.equal(code, 0, 'lint 永不因坏数据 exit 1');
  assert.ok(!json.states.some((x) => x.branch === 'feature/old'), 'features 目录条目不出现');
  const mangled = json.states.find((x) => x.branch === 'feature/mangled');
  assert.ok(mangled && mangled.warnings.some((w) => w.includes('unparseable')));
  rmSync(repo, { recursive: true, force: true });
});
```

- [x] **Step 2: 运行确认失败**

Run: `node --test --test-name-pattern="lint-state" tests/cli.test.mjs`
Expected: FAIL(旧 lint 仍扫 features / 报 host 警告)。

- [x] **Step 3: 实现** —— `lib/config.mjs`:删除 `RETIRED_CONFIG_FIELDS` 导出及其循环、`config.version !== 3` 警告块;顶注释改为「config 读取容忍字段集外的未知键,不定义退役字段机制」。

- [x] **Step 4: 运行确认通过**

Run: `node --test --test-name-pattern="lint-state|read-config" tests/cli.test.mjs`
Expected: PASS。

- [x] **Step 5: 提交**

```bash
git add lib/config.mjs tests/cli.test.mjs
git commit -m "refactor: drop retired config field warnings and version gate"
```

### Task 4: bin/speccode.mjs verb 清理

**Files:**
- Modify: `bin/speccode.mjs:10,130-134,138-152,284-296,157`

**Interfaces:**
- Produces: verb 表删除 `migrate-state`;`feature-progress` 返回恒 `{ok,total:1,completed,worktree}`;`list-memory` 的 completed 派生只看 v3 state

- [x] **Step 1: 改测试(先红)** —— `tests/cli.test.mjs`:
  1. 删除用例 `migrate-state converts a v2 file end to end`,替换为:

```js
test('migrate-state verb no longer exists', () => {
  const repo = makeRepo();
  const r = spawnSync('node', [BIN, 'migrate-state', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: '{}', encoding: 'utf8' });
  assert.equal(r.status, 1, '未知 verb → exit 1');
  assert.equal(JSON.parse(r.stdout.trim()).ok, false);
  rmSync(repo, { recursive: true, force: true });
});
```

  2. 用例 `reconcile ignores legacy config worktree_prefix`:state fixture 改为 v3 形状(`{branch:'feature/p',type:'feature',worktree:null,merge_target:'main',status:'in_progress',created_at:'2026-01-01T00:00:00.000Z',initial_branch:'main'}`),config 保留 `{version:1, worktree_prefix:''}` 不变——断言语义改为「config 含未知/旧字段时 reconcile 正常、分支登记不丢」。
  3. 用例 `list-memory ...`(v2 派生段,~1370 行区):删除 `feature/legacy` 的 memory 文件与 `state/features/` fixture 及期望里的 `'feature/legacy': true`。
  4. 用例 `遗留 host 字段的 config 不报错且被忽略` 保留(语义变为「未知键容忍」,测试名与断言不变仍成立)。

- [x] **Step 2: 运行确认失败**

Run: `node --test --test-name-pattern="migrate-state|worktree_prefix|list-memory" tests/cli.test.mjs`
Expected: FAIL(migrate-state 仍存在/分流仍在)。

- [x] **Step 3: 实现** —— `bin/speccode.mjs`:
  - import 行去掉 `migrateStateV2toV3`;
  - 删除 `'migrate-state': ({ cwd }) => {...}` 整个 verb 项;
  - `feature-progress` 删除 v2 分支,收口为:

```js
  'feature-progress': ({ cwd, branch }) => {
    const st = readState(speccodeDirOf(cwd), branch);
    if (!st) return { ok: false, error: `no state for ${branch}` };
    // v3: one branch IS one unit (branch ↔ worktree 1:1, design D3).
    return { ok: true, total: 1,
      completed: st.status === WORKTREE_STATUS.COMPLETED ? 1 : 0,
      worktree: st.worktree ?? null };
  },
```

  - `list-memory` 的 statusByBranch 构造删 `else if (typeof f?.feature_branch === 'string')` 整段;
  - `detect-code-intel-tools` 注释 `a legacy \`host\` key in config, if present, is ignored` 改为 `unknown extra config keys are ignored`。

- [x] **Step 4: 运行确认通过**

Run: `node --test tests/cli.test.mjs`
Expected: PASS。

- [x] **Step 5: 提交**

```bash
git add bin/speccode.mjs tests/cli.test.mjs
git commit -m "refactor: remove migrate-state verb and v2 branches in feature-progress/list-memory"
```

### Task 5: lib/knowledge.mjs 读侧单格式

**Files:**
- Modify: `lib/knowledge.mjs:52-94,124-157,182-207`
- Test: `tests/knowledge.test.mjs:213-283`

**Interfaces:**
- Produces: `parseDistilledBlocks` 只识别 `distilled-from`/`/distilled`;`replaceDistilledBlocks`/`replaceHandBlocks` 对旧 `promoted` 标记按 hand 字节对待

- [x] **Step 1: 改测试(先红)** —— `tests/knowledge.test.mjs` 替换旧标记用例:

```js
test('parseDistilledBlocks ignores legacy promoted markers (hand bytes)', () => {
  const text = 'hand\n<!-- promoted-from: archive/a/ -->\nbody\n<!-- /promoted -->\n';
  assert.deepEqual(parseDistilledBlocks(text), []);
});

test('replaceHandBlocks preserves legacy-format bytes as hand-region text', () => {
  const out = replaceHandBlocks('<!-- promoted-from: old/ -->\nbody\n<!-- /promoted -->\n', 'hand\n');
  assert.equal(out, 'hand\n\n<!-- promoted-from: old/ -->\nbody\n<!-- /promoted -->\n');
});

test('replaceDistilledBlocks keeps legacy marker bytes in the hand region', () => {
  const text = 'keep\n<!-- promoted-from: gone/ -->\nold\n<!-- /promoted -->\ntail';
  const out = replaceDistilledBlocks(text, []);
  assert.ok(out.includes('<!-- promoted-from: gone/ -->'), '旧标记字节保留');
  assert.ok(!out.includes('distilled-from'), '不产新块');
});
```

删除用例:`parses legacy promoted markers`、`parses mixed current and legacy markers in order`、`rewrites legacy markers to the current format`、`drops legacy blocks whose source is gone`;`throws on mismatched opening/closing marker formats` 收窄为只测现行标记互错(`distilled-from` 开 + `/distilled` 之外无闭)与「`/distilled` 无开」两种。保留 `preserves legacy-format blocks unmigrated`(即上面第 2 条的既有断言,语义升格为契约)。

- [x] **Step 2: 运行确认失败**

Run: `node --test tests/knowledge.test.mjs`
Expected: FAIL(当前实现把旧标记解析为块)。

- [x] **Step 3: 实现** —— `lib/knowledge.mjs` 三个函数统一机械改法:
  - 删 `LEGACY_PROMOTED_START`/`LEGACY_PROMOTED_END` 常量与 54-61 行注释,新注释:「读侧只认现行 distilled-from 标记;旧 promoted 时代的标记不再是块边界,其字节按 hand-written 对待」;
  - `const isNew = DISTILLED_START.exec(line); const m = isNew || LEGACY_PROMOTED_START.exec(line);` → `const m = DISTILLED_START.exec(line);`;
  - `open = { source: m[1].trim(), start: i, end: isNew ? DISTILLED_END : LEGACY_PROMOTED_END };` → `open = { source: m[1].trim(), start: i };`(parse 里闭行判定 `line.trim() === DISTILLED_END`);
  - replace 两处的 `const end = isNew ? DISTILLED_END : LEGACY_PROMOTED_END;` → `const end = DISTILLED_END;`;嵌套探测里的 `|| LEGACY_PROMOTED_START.exec(...)` 删;闭行判定 `line.trim() === DISTILLED_END || line.trim() === LEGACY_PROMOTED_END` → `line.trim() === DISTILLED_END`;
  - 函数头注释同步(删「current or legacy format」措辞)。

- [x] **Step 4: 运行确认通过**

Run: `node --test tests/knowledge.test.mjs tests/cli.test.mjs`
Expected: PASS(含 cli 侧 read-knowledge --blocks / write-knowledge 用例,若其 fixture 含旧标记则同款改为现行标记)。

- [x] **Step 5: 提交**

```bash
git add lib/knowledge.mjs tests/knowledge.test.mjs tests/cli.test.mjs
git commit -m "refactor: knowledge parser reads current markers only — legacy bytes are hand-written"
```

### Task 6: lib/memory.mjs 遗留键删除

**Files:**
- Modify: `lib/memory.mjs:9-14,70-78`
- Test: `tests/cli.test.mjs:607-627`

**Interfaces:**
- Produces: `TRUNK_MEMORY_KEYS = ['_knowledge']`;`validateMemoryBranch('_exploring') === false`

- [x] **Step 1: 改测试(先红)** —— `tests/cli.test.mjs` 用例 `write-memory accepts the _exploring sentinel branch` 替换为:

```js
test('write-memory rejects the legacy bare _exploring key', () => {
  const repo = makeRepo();
  const w = spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', '_exploring', '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ mode: 'replace', content: 'x' }), encoding: 'utf8' });
  assert.equal(w.status, 1, '无斜杠 _exploring 键已退役');
  assert.equal(JSON.parse(w.stdout.trim()).ok, false);
  rmSync(repo, { recursive: true, force: true });
});
```

- [x] **Step 2: 运行确认失败**

Run: `node --test --test-name-pattern="_exploring" tests/cli.test.mjs`
Expected: FAIL(当前仍接受)。

- [x] **Step 3: 实现** —— `lib/memory.mjs`:`TRUNK_MEMORY_KEYS = ['_knowledge']`;注释里 `` `_exploring` = exploring conclusions before a feature exists`` 与「legacy bare `_exploring.md`」措辞删除/改写(探索记忆一律走 `_exploring/<topic>`)。

- [x] **Step 4: 运行确认通过**

Run: `node --test tests/memory.test.mjs tests/cli.test.mjs`
Expected: PASS。

- [x] **Step 5: 提交**

```bash
git add lib/memory.mjs tests/cli.test.mjs
git commit -m "refactor: retire bare _exploring memory key — topics only"
```

### Task 7: 命令层 prose 清理(init/status/reset)

**Files:**
- Modify: `skills/init/SKILL.md`、`skills/status/SKILL.md`、`skills/reset/SKILL.md`

**Interfaces:**
- Consumes: Task 4 后的 verb 表(无 migrate-state)

- [x] **Step 1: skills/init/SKILL.md** —— 删除「全新流程」第 8 步(state 迁移)整段;删除幂等流程中「旧 config 含 v2 遗留的 `worktree_prefix` → diff 标记移除」「旧 config 含历史遗留的 `host` 字段 → diff 标记移除」「v1/v2 → v3 迁移」「`state/` 目录唯一例外:检测到 v2 遗留 `state/features/`」四段;第 35 行「不得包含任何 v1 遗留字段、v2 的 worktree_prefix,以及已退役的 host 字段」改为「不得包含字段集之外的引擎消费字段」;其余步骤重新编号保持连贯。
- [x] **Step 2: skills/status/SKILL.md** —— 删除「v2 遗留(`state/features/`)条目按原样列出并标注『v2 待迁移』」句与示例行 `○ feature/legacy (from master) in_progress(v2 待迁移)`。
- [x] **Step 3: skills/reset/SKILL.md** —— 删除「若 config 仍含 v1 遗留字段(`display`/`spec_tools`/`untracked_permanent`)→ 一并询问是否移除」整条。
- [x] **Step 4: 验证 + 提交**

Run: `node --test ./tests/*.test.mjs`
Expected: PASS(skill-frontmatter 等守卫不回归)。

```bash
git add skills/init/SKILL.md skills/status/SKILL.md skills/reset/SKILL.md
git commit -m "docs(skills): drop v1/v2 upgrade and migration steps from init/status/reset"
```

### Task 8: 开发与设计文档同步(AGENTS/DESIGN×2)

**Files:**
- Modify: `AGENTS.md:51,55,59,61`、`docs/DESIGN.md`、`docs/DESIGN_CN.md`

**Interfaces:**
- Consumes: Task 1-6 后的引擎事实

- [ ] **Step 1: AGENTS.md** —— 四处不变量去 v2 表述:51 行「(v3;v2 遗留 `state/features/*.json` 同策)」→「`;55 行「(config + `state/branches/`(v2 遗留为 `state/features/`)+ …)」→ 删括注;59 行「(v3 `state/branches/` + v2 遗留 `state/features/` 双格式原样)」→「`state/branches/`」并删「(仅 v3 条目,v2 遗留原样跳过)」;61 行删「;v3 一分支一 state,v2 遗留 `state/features/` 的 worktree 条目沿用同一枚举」中的 v2 分句。
- [ ] **Step 2: DESIGN.md / DESIGN_CN.md(两版同步)** ——
  - 176 行目录树注 `(v2 legacy lives in state/features/, dual-format compatible)` 删;
  - 181 行 config 段删 `(v2's worktree_prefix retired…, and host retired…— idempotent init removes both via the field diff)`;
  - 182 行 state 段删末句 `v2-legacy state/features/ files are read and written with v2 semantics as-is…`;
  - 185 行原子写段删 `(v2-legacy state/features/*.json same policy)`;
  - 240 行风险表注 `see the Section 11 migration` 删引用;
  - 242 行 R2 `that field is now retired (read-compatible, ignored)` → `that field is retired (not read)`;
  - 253-300 行:§11「Migrating from 0.1」重组——迁移内容(命令对照表、迁移步骤、waiting_display_pr 指引)删除,保留混排的当前内容(Upgrade actions + 多宿主安装入口表)重组为 §11「Installation & Updates」;节号维持 §1-14;322 行 git clean 段 `(branches/ and legacy features/)` → `(branches/)`;
  - CN 版逐段对应(285/299 行等)。
- [ ] **Step 3: 交叉引用核对** —— `rg -n '§1-14|Section 11|#11-migrating|迁移对照' AGENTS.md docs/ README.md README_CN.md speccode/spec/`,残余引用一并修正(AGENTS「设计文档 §1-14」→「§1-13」;plugin-packaging 主规格的迁移对照表要求由 syncing 的 delta 处理,此处不动 spec)。
- [ ] **Step 4: 验证 + 提交**

Run: `node --test ./tests/*.test.mjs && rg -n -i 'v2|migrating from 0.1' docs/DESIGN.md docs/DESIGN_CN.md`
Expected: 测试 PASS;rg 仅剩允许的历史叙事(R 表编号注等,逐条人工确认)。

```bash
git add AGENTS.md docs/DESIGN.md docs/DESIGN_CN.md
git commit -m "docs: remove legacy compat narrative and 0.1 migration section from dev/design docs"
```

### Task 9: 运行时清理 + 全量回归 + 残留审计

**Files:**
- Delete: 主仓 `.speccode/memory/_exploring.md`(运行时 untracked 文件,不进 git)

- [ ] **Step 1: 删主仓存量遗留 memory** —— `rm /Users/game-netease/workspaces/plugin/speccode-development/.speccode/memory/_exploring.md`(存在才删;该键已不可读)。
- [ ] **Step 2: 全量测试**

Run: `node --test ./tests/*.test.mjs`
Expected: 全 PASS,数量以输出为准(基线 323,删除兼容用例后应净减少)。

- [ ] **Step 3: 残留审计**

Run: `rg -n -i 'v1|v2|legacy|遗留|promoted|state/features|migrate-state|worktree_prefix|waiting_display_pr|develop-complete' lib/ bin/ tests/ skills/ hooks/ references/ AGENTS.md CLAUDE.md docs/DESIGN.md docs/DESIGN_CN.md README.md README_CN.md support/ .codex-plugin/ .kimi-plugin/ .zcode-plugin/ .opencode/ .pi/`
Expected: 仅白名单命中——Node `v24`、`validateSlug('v2')` 类无关字面量、CHANGELOG.md(不在扫描列表)、receiving-code-review 的「向后兼容需要这段遗留代码」示例教学文本(评审方法论的通用示例,非本项目兼容面;逐条确认)。

- [ ] **Step 4: 提交(如有零星修正)**

```bash
git add -A && git commit -m "chore: sweep residual legacy references"
```
