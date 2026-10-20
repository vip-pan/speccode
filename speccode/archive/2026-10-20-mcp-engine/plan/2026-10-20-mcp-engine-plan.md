# mcp-engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 speccode 引擎补 MCP stdio 前端(tools 与 verb 1:1 同名),建立 prose↔引擎契约版本,CLI 收缩为与 MCP 共享 `lib/verbs.mjs` 的薄壳;既有 323 个测试零修改通过。

**Architecture:** `VERBS` 表与仓库根定位从 `bin/speccode.mjs` 下沉到 `lib/verbs.mjs`,写 verb 改从前端注入的 `flags.payload` 取数,`STDIN_MODE` 声明哪些 verb 读 stdin 及读法;`lib/mcp.mjs` 手写 JSON-RPC 2.0 五方法 + `TOOL_META` 工具元数据;`bin/speccode.mjs`(CLI)与 `bin/speccode-mcp.mjs`(MCP ndjson 循环)是两个薄前端,入口守卫改为 realpath 比对以兼容 npm 符号链接。`lib/contract.mjs` 提供 `CONTRACT_VERSION` 与协议版本清单。

**Tech Stack:** Node ≥ 24,纯 ESM,仅 `node:` 内置模块;`node --test`;JSON-RPC 2.0 over stdio(ndjson);MCP 协议修订 2025-06-18 / 2025-03-26 / 2024-11-05。

## Global Constraints

- 零第三方依赖:`package.json` MUST NOT 出现 `dependencies`/`devDependencies`;所有 import 为 `node:` 或 `./`、`../lib/` 相对路径。
- lib 语言中立:lib 内错误文本与 tool description 一律英文。
- 确定性逻辑只进 lib:`bin/*.mjs` 只做 I/O 壳(参数解析、stdin/stdout、进程入口判定),不含 verb 实现与协议判定。
- `--json-stdin` 缺失时的错误文本一字不改:`<verb> requires --json-stdin (pipe JSON via stdin)`(write-config / write-state / write-memory / rename-memory)与 `<verb> requires --json-stdin`(write-consumed-archives / write-knowledge)。
- `run-hook` 永远返回 `{ok:true}`、exit 0;stdin 片段非法时 `hook.warning` 含 `stdin fragment ignored`。
- handler MUST NOT 读 fd 0:`lib/verbs.mjs` 源码不得出现 `readFileSync(0` 与 `isatty(`。
- MCP stdout 只写协议消息(每行一条 JSON),日志仅 stderr;通知(无 `id`)不回应;verb 失败 → `result.isError: true`,不是 JSON-RPC error。
- tool 名 = verb 名;`EXCLUDED_VERBS` 恒为 `['plugin-root']`;`Object.keys(TOOL_META)` 集合 == `Object.keys(VERBS) ∖ EXCLUDED_VERBS`。
- 不 bump 版本;CHANGELOG 只改 `[Unreleased]`;`skills/` 零改动;`tests/cli.test.mjs` 零改动。
- 全量测试 `node --test ./tests/*.test.mjs`;单用例 `node --test --test-name-pattern="<name>" tests/<file>`。
- 每个任务绿后立即提交,conventional commits。

---

### Task 1: 契约常量 `lib/contract.mjs`

**Files:**
- Create: `lib/contract.mjs`
- Test: `tests/verbs.test.mjs`(新建)

**Interfaces:**
- Consumes: 无
- Produces: `export const CONTRACT_VERSION: number`(=1);`export const MCP_PROTOCOL_VERSIONS: string[]`(`['2025-06-18','2025-03-26','2024-11-05']`,最新在首)

- [x] **Step 1: 写失败测试**

```js
// tests/verbs.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTRACT_VERSION, MCP_PROTOCOL_VERSIONS } from '../lib/contract.mjs';

test('CONTRACT_VERSION is a positive integer', () => {
  assert.equal(Number.isInteger(CONTRACT_VERSION), true);
  assert.ok(CONTRACT_VERSION >= 1);
});

test('MCP_PROTOCOL_VERSIONS lists supported revisions, newest first', () => {
  assert.ok(MCP_PROTOCOL_VERSIONS.length >= 1);
  assert.equal(MCP_PROTOCOL_VERSIONS[0], '2025-06-18');
  assert.deepEqual([...MCP_PROTOCOL_VERSIONS].sort().reverse(), MCP_PROTOCOL_VERSIONS);
});
```

- [x] **Step 2: 运行确认失败**

Run: `node --test tests/verbs.test.mjs`
Expected: FAIL — `Cannot find module '…/lib/contract.mjs'`

- [x] **Step 3: 写最小实现**

```js
// lib/contract.mjs
// Contract version between the engine and the prose (skills) layer. It covers
// every surface prose can observe: the state v3 shape (state.mjs), the config
// v3 shape (config.mjs), the memory key model (`<type>__<slug>`,
// `_exploring__<topic>`, `_knowledge` — memory.mjs) and the result shape of
// every verb (verbs.mjs). Bump on any incompatible change to those surfaces;
// additive changes (a new optional field, a new verb) do not bump.
export const CONTRACT_VERSION = 1;

// MCP protocol revisions this engine speaks, newest first. `initialize`
// echoes the client's requested revision when it is listed here and falls
// back to the first entry otherwise.
export const MCP_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
```

- [x] **Step 4: 运行确认通过**

Run: `node --test tests/verbs.test.mjs`
Expected: PASS(2 tests)

- [x] **Step 5: 提交**

```bash
git add lib/contract.mjs tests/verbs.test.mjs
git commit -m "feat(engine): add contract version constants"
```

---

### Task 2: verb 表下沉 `lib/verbs.mjs`,CLI 收缩为薄壳(含 symlink 安全入口守卫)

**Files:**
- Create: `lib/verbs.mjs`
- Modify: `bin/speccode.mjs`(整文件重写为薄壳;保留 `parseArgs` 导出)
- Test: `tests/verbs.test.mjs`(追加);`tests/cli.test.mjs`(零修改,回归网)

**Interfaces:**
- Consumes: `CONTRACT_VERSION`、`MCP_PROTOCOL_VERSIONS`(Task 1)
- Produces:
  - `export const VERBS: Record<string, (flags: object) => object>`——键即 verb 名,含新增 `contract-version`
  - `export const STDIN_MODE: Record<string, 'payload' | 'fragment'>`——`write-config` / `write-state` / `write-memory` / `rename-memory` / `write-consumed-archives` / `write-knowledge` → `'payload'`;`run-hook` → `'fragment'`
  - `export function runVerb(verb: string, flags?: object): object`——未知 verb → `{ok:false, error:'unknown verb: <verb>'}`;payload 模式且 `flags['json-stdin']` 为真但 `flags.payload` 非对象(含 null)→ `{ok:false, error:'<verb> requires a JSON object payload'}`;handler 抛错 → `{ok:false, error:String(err.message||err)}`
  - `export function readEngineVersion(): string | null`——读 `package.json` 的 `version`,缓存;失败返回 null
  - `export function repoRoot(cwd: string): string`、`export function speccodeDirOf(cwd: string): string`
  - 写 verb handler 从 `flags.payload` 取数;`run-hook` 从 `flags.fragment` / `flags.fragmentWarning` 取数

- [x] **Step 1: 写失败测试(追加到 `tests/verbs.test.mjs`)**

```js
import { readFileSync, mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { VERBS, STDIN_MODE, runVerb, readEngineVersion } from '../lib/verbs.mjs';

const CLI_BIN = fileURLToPath(new URL('../bin/speccode.mjs', import.meta.url));
const PKG = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));

test('runVerb rejects unknown verbs with ok:false', () => {
  assert.deepEqual(runVerb('nope', {}), { ok: false, error: 'unknown verb: nope' });
});

test('runVerb guards payload verbs against a non-object payload', () => {
  for (const payload of ['str', null, 42]) {
    assert.deepEqual(
      runVerb('write-state', { 'json-stdin': true, payload, branch: 'feature/x', cwd: '/' }),
      { ok: false, error: 'write-state requires a JSON object payload' },
    );
  }
});

test('runVerb converts handler throws into ok:false', () => {
  // git() throws for a non-existent cwd (spawnSync status null → code 1).
  const r = runVerb('resolve-speccode-dir', { cwd: '/nonexistent/dir/for/speccode/test' });
  assert.equal(r.ok, false);
  assert.match(r.error, /git rev-parse/);
});

test('STDIN_MODE declares every stdin-reading verb and nothing else', () => {
  assert.deepEqual(STDIN_MODE, {
    'write-config': 'payload',
    'write-state': 'payload',
    'write-memory': 'payload',
    'rename-memory': 'payload',
    'write-consumed-archives': 'payload',
    'write-knowledge': 'payload',
    'run-hook': 'fragment',
  });
  for (const verb of Object.keys(STDIN_MODE)) assert.ok(verb in VERBS, `${verb} is a verb`);
});

test('contract-version verb reports contract, engine version and protocol list', () => {
  assert.deepEqual(runVerb('contract-version', {}), {
    ok: true,
    contractVersion: CONTRACT_VERSION,
    engineVersion: PKG.version,
    protocolVersions: MCP_PROTOCOL_VERSIONS,
  });
  assert.equal(readEngineVersion(), PKG.version);
});

test('handlers never read fd 0 (stdin stays in the CLI shell)', () => {
  const src = readFileSync(fileURLToPath(new URL('../lib/verbs.mjs', import.meta.url)), 'utf8');
  assert.equal(/readFileSync\(\s*0\b/.test(src), false);
  assert.equal(/isatty\(/.test(src), false);
});

test('CLI front runs when invoked through an npm-style symlink (no .mjs suffix)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'speccode-bin-'));
  const link = join(dir, 'speccode');
  symlinkSync(CLI_BIN, link);
  const r = spawnSync('node', [link, 'contract-version'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout.trim()).contractVersion, CONTRACT_VERSION);
  rmSync(dir, { recursive: true, force: true });
});

test('CLI front reports invalid stdin JSON uniformly for every payload verb', () => {
  for (const verb of ['write-config', 'write-state', 'write-memory']) {
    const r = spawnSync('node', [CLI_BIN, verb, '--cwd', process.cwd(), '--branch', 'feature/x', '--json-stdin'],
      { encoding: 'utf8', input: '{not json' });
    assert.equal(r.status, 1);
    assert.deepEqual(JSON.parse(r.stdout.trim()), { ok: false, error: 'invalid JSON on stdin' });
  }
});
```

- [x] **Step 2: 运行确认失败**

Run: `node --test tests/verbs.test.mjs`
Expected: FAIL — `Cannot find module '…/lib/verbs.mjs'`

- [x] **Step 3: 创建 `lib/verbs.mjs`——搬移 + 七处取数改写 + 新增导出**

(a) 文件头 import(原 bin 的 import 去掉 `isatty`、`readFileSync` 仅保留给 `read-knowledge`/`readEngineVersion`;路径由 `../lib/x.mjs` 改 `./x.mjs`):

```js
// lib/verbs.mjs
// The engine's verb table — single source of truth shared by both fronts
// (bin/speccode.mjs CLI, bin/speccode-mcp.mjs MCP). Handlers take a flags
// object and return a JSON-serialisable result. Anything a front reads from
// stdin is injected here as `flags.payload` (write verbs) or `flags.fragment`
// (run-hook); handlers never touch fd 0 themselves.
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { git } from './git.mjs';
import { detectPrToolFromUrl, isInstalled, queryPrState, repoMergeConfig, isSquashOnly } from './prtool.mjs';
import { reconcile } from './reconcile.mjs';
import { loadConfig, saveConfig, backupConfig, validateLanguage, validateConfigShape } from './config.mjs';
import { readState, writeState, deleteState, listActiveFeatures, lintStateEntries, migrateStateV2toV3, WORKTREE_STATUS } from './state.mjs';
import { detectCodeIntelTools, resolveWorktreeDir, worktreeDirIgnoreState } from './detect.mjs';
import { sddWorkspace, taskBrief, reviewPackage, tickTask } from './sdd.mjs';
import { buildHookPayload, runHook } from './hooks.mjs';
import { listMemory, listMemoryKeys, purgeMemory, readMemory, renameMemory, writeMemory, validateMemoryBranch } from './memory.mjs';
import { assertSafeRel, buildIndex, knowledgeRoot, listTopics, parseDistilledBlocks, replaceHandBlocks, replaceDistilledBlocks, writeKnowledge, archiveRoot, distilledMetaPath, readConsumedArchives, addConsumedArchives, listArchiveBundles, unconsumedArchives } from './knowledge.mjs';
import { CONTRACT_VERSION, MCP_PROTOCOL_VERSIONS } from './contract.mjs';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let engineVersionCache;
export function readEngineVersion() {
  if (engineVersionCache === undefined) {
    try {
      engineVersionCache = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')).version ?? null;
    } catch {
      engineVersionCache = null;
    }
  }
  return engineVersionCache;
}

// Resolve the *main* repo root even when cwd is inside a linked worktree.
// `--show-toplevel` would return the worktree's own directory; `--git-common-dir`
// always points at the main repo's `.git` (shared across all linked worktrees).
export function repoRoot(cwd) {
  const commonDir = git(
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    { cwd },
  ).stdout.trim();
  return dirname(commonDir);
}

export function speccodeDirOf(cwd) {
  return join(repoRoot(cwd), '.speccode');
}

// Which verbs take data from stdin under the CLI, and how the shell must read
// it: 'payload' = JSON object required behind --json-stdin; 'fragment' =
// optional JSON merged under the hook envelope, read only when stdin is a pipe.
export const STDIN_MODE = Object.freeze({
  'write-config': 'payload',
  'write-state': 'payload',
  'write-memory': 'payload',
  'rename-memory': 'payload',
  'write-consumed-archives': 'payload',
  'write-knowledge': 'payload',
  'run-hook': 'fragment',
});
```

(b) 把原 `bin/speccode.mjs` 第 56–409 行的 `const VERBS = { … };` **逐字**粘到上面之后,改为 `export const VERBS = { … };`,`plugin-root` 的 `resolve(dirname(fileURLToPath(import.meta.url)), '..')` 改用 `PACKAGE_ROOT`;然后做以下七处取数改写(其余 handler 一字不动):

```js
  'write-config': ({ cwd, 'json-stdin': jsonStdin, payload }) => {
    if (!jsonStdin) return { ok: false, error: 'write-config requires --json-stdin (pipe JSON via stdin)' };
    const cfg = payload;
    if ('language' in cfg && validateLanguage(cfg.language) === null) {
      return { ok: false, error: `invalid language tag: ${JSON.stringify(cfg.language)}` };
    }
    saveConfig(speccodeDirOf(cwd), cfg);
    return { ok: true };
  },
```

```js
  'write-state': ({ cwd, branch, 'json-stdin': jsonStdin, payload }) => {
    if (!jsonStdin) return { ok: false, error: 'write-state requires --json-stdin (pipe JSON via stdin)' };
    writeState(speccodeDirOf(cwd), branch, payload);
    return { ok: true };
  },
```

```js
  'write-memory': ({ cwd, branch, 'json-stdin': jsonStdin, payload }) => {
    if (!jsonStdin) return { ok: false, error: 'write-memory requires --json-stdin (pipe JSON via stdin)' };
    if (!branch || branch === true) return { ok: false, error: 'write-memory requires --branch <F>' };
    if (!validateMemoryBranch(branch)) {
      return { ok: false, error: `invalid branch name: ${branch}` };
    }
    const { mode, content } = payload;
    if (mode !== 'replace' && mode !== 'append') {
      return { ok: false, error: 'write-memory mode must be "replace" or "append"' };
    }
    if (typeof content !== 'string') return { ok: false, error: 'write-memory content must be a string' };
    const path = writeMemory(speccodeDirOf(cwd), branch, content, mode);
    return { ok: true, path };
  },
```

(`rename-memory` 不读 payload,签名不变——它只检查标志;登记进 `STDIN_MODE` 使 CLI 消费掉 skill 管道里的 `{}`,MCP 经 schema `default: {}` 补齐。)

```js
  'run-hook': ({ cwd, event, fragment, fragmentWarning }) => {
    try {
      if (!event || event === true) {
        return { ok: true, hook: { ran: false, ok: true, warning: 'run-hook called without --event' } };
      }
      const cfg = loadConfig(speccodeDirOf(cwd));
      const frag = fragment && typeof fragment === 'object' && !Array.isArray(fragment) ? fragment : {};
      const root = repoRoot(cwd);
      const payload = buildHookPayload(event, frag, { repoRoot: root, cwd: resolve(cwd) });
      const hook = runHook(cfg, event, payload, { spawnCwd: root });
      if (fragmentWarning) {
        hook.warning = hook.warning ? `${hook.warning}; ${fragmentWarning}` : fragmentWarning;
      }
      return { ok: true, hook };
    } catch (err) {
      return { ok: true, hook: { ran: false, ok: false, error: String(err?.message || err) } };
    }
  },
```

```js
  'write-consumed-archives': ({ cwd, 'json-stdin': jsonStdin, payload }) => {
    if (jsonStdin === undefined) return { ok: false, error: 'write-consumed-archives requires --json-stdin' };
    const add = Array.isArray(payload?.add) ? payload.add : undefined;
    if (!add) return { ok: false, error: 'write-consumed-archives requires {add: [bundle,...]}' };
    const kroot = knowledgeRoot(cwd);
    const consumed = addConsumedArchives(kroot, add);
    return { ok: true, consumed };
  },
```

```js
  'write-knowledge': ({ cwd, rel, 'json-stdin': jsonStdin, payload }) => {
    if (jsonStdin === undefined) return { ok: false, error: 'write-knowledge requires --json-stdin' };
    if (!rel) return { ok: false, error: 'write-knowledge requires --rel' };
    const safe = assertSafeRel(rel);
    if (!safe.ok) return { ok: false, error: safe.error };
    const root = knowledgeRoot(cwd);
    const target = join(root, safe.rel);
    const { mode, content, blocks, entries, heading } = payload;
    // …以下 mode 分派原样保留…
```

(c) 在 `VERBS` 内追加新 verb,并在文件末尾追加 `runVerb`:

```js
  'contract-version': () => ({
    ok: true,
    contractVersion: CONTRACT_VERSION,
    engineVersion: readEngineVersion(),
    protocolVersions: [...MCP_PROTOCOL_VERSIONS],
  }),
```

```js
export function runVerb(verb, flags = {}) {
  const handler = VERBS[verb];
  if (!handler) return { ok: false, error: `unknown verb: ${verb}` };
  if (STDIN_MODE[verb] === 'payload' && flags['json-stdin']
      && (flags.payload === null || typeof flags.payload !== 'object')) {
    return { ok: false, error: `${verb} requires a JSON object payload` };
  }
  try {
    return handler(flags);
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}
```

- [x] **Step 4: 重写 `bin/speccode.mjs` 为薄壳**

```js
#!/usr/bin/env node
// CLI front for the speccode engine: parse argv, inject whatever the verb
// declares it needs from stdin, run the shared verb table, print one JSON line.
import { readFileSync, realpathSync } from 'node:fs';
import { isatty } from 'node:tty';
import { fileURLToPath } from 'node:url';
import { runVerb, STDIN_MODE } from '../lib/verbs.mjs';

export function parseArgs(argv) {
  const [verb, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const tok = rest[i];
    if (!tok.startsWith('--')) continue;
    const body = tok.slice(2);
    const eq = body.indexOf('=');
    if (eq !== -1) {
      flags[body.slice(0, eq)] = body.slice(eq + 1);
    } else if (i + 1 < rest.length && !rest[i + 1].startsWith('--')) {
      flags[body] = rest[i + 1];
      i += 1;
    } else {
      flags[body] = true;
    }
  }
  return { verb, flags };
}

function readStdin() {
  return readFileSync(0, 'utf8');
}

// Inject stdin-borne data per the verb's declared mode. Returns an early error
// result (payload mode, unparsable JSON) or null to proceed. 'payload' only
// reads when --json-stdin is present so a missing flag never blocks on stdin.
function injectStdin(verb, flags) {
  const mode = STDIN_MODE[verb];
  if (mode === 'payload') {
    if (!flags['json-stdin']) return null;
    try {
      flags.payload = JSON.parse(readStdin());
    } catch {
      return { ok: false, error: 'invalid JSON on stdin' };
    }
  } else if (mode === 'fragment' && !isatty(0)) {
    // isatty(0) is a side-effect-free syscall. Probing process.stdin.isTTY
    // instead would put fd 0 into non-blocking mode, and readFileSync(0)
    // could then throw EAGAIN before a slow producer fills the pipe,
    // silently dropping the fragment.
    try {
      const raw = readStdin();
      flags.fragment = raw.trim() ? JSON.parse(raw) : {};
    } catch (err) {
      flags.fragment = {};
      flags.fragmentWarning = `stdin fragment ignored: ${err?.message || err}`;
    }
  }
  return null;
}

function main() {
  const { verb, flags } = parseArgs(process.argv.slice(2));
  const early = Object.prototype.hasOwnProperty.call(STDIN_MODE, verb) ? injectStdin(verb, flags) : null;
  const result = early ?? runVerb(verb, flags);
  if (result.ok === false) process.exitCode = 1;
  process.stdout.write(JSON.stringify(result) + '\n');
}

// Run only when this file is the process entry. Compare real paths: npm's bin
// symlink is named `speccode` (no .mjs), so a suffix check on argv[1] would
// silently skip main() for every `npm i -g speccode` user.
function isEntry() {
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isEntry()) main();
```

- [x] **Step 5: 运行确认通过(新用例 + 回归网)**

Run: `node --test tests/verbs.test.mjs tests/cli.test.mjs`
Expected: PASS——verbs.test 全部用例通过;cli.test 107 个用例零修改通过

- [x] **Step 6: 提交**

```bash
git add lib/verbs.mjs bin/speccode.mjs tests/verbs.test.mjs
git commit -m "refactor(engine): move verb table to lib/verbs.mjs; thin CLI with symlink-safe entry guard"
```

---

### Task 3: MCP 协议纯逻辑 `lib/mcp.mjs`

**Files:**
- Create: `lib/mcp.mjs`
- Test: `tests/mcp.test.mjs`(新建,进程内部分);`tests/verbs.test.mjs`(追加 parity 守卫)

**Interfaces:**
- Consumes: `VERBS`、`STDIN_MODE`(Task 2);`CONTRACT_VERSION`、`MCP_PROTOCOL_VERSIONS`(Task 1)
- Produces:
  - `export const EXCLUDED_VERBS: string[]`(`['plugin-root']`)
  - `export const TOOL_META: Record<string, {description: string, inputSchema: object}>`
  - `export function listTools(): Array<{name, description, inputSchema}>`
  - `export function createServer({runVerb, engineVersion, defaultCwd}): {handleMessage(msg): object|null, handleLine(line: string): object|null, listTools}`

- [x] **Step 1: 写失败测试(新建 `tests/mcp.test.mjs` 进程内部分)**

```js
// tests/mcp.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, listTools, TOOL_META, EXCLUDED_VERBS } from '../lib/mcp.mjs';
import { VERBS, STDIN_MODE } from '../lib/verbs.mjs';
import { CONTRACT_VERSION, MCP_PROTOCOL_VERSIONS } from '../lib/contract.mjs';

const echoVerb = (verb, flags) => ({ ok: true, verb, flags });
const mk = (runVerb = echoVerb) => createServer({ runVerb, engineVersion: '0.0.0-test', defaultCwd: '/tmp/default-cwd' });
const req = (id, method, params) => ({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) });

test('initialize echoes a supported protocol version and carries the contract', () => {
  const r = mk().handleMessage(req(1, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'x', version: '0' } }));
  assert.equal(r.jsonrpc, '2.0');
  assert.equal(r.id, 1);
  assert.equal(r.result.protocolVersion, '2025-03-26');
  assert.deepEqual(r.result.capabilities, { tools: {} });
  assert.deepEqual(r.result.serverInfo, { name: 'speccode', version: '0.0.0-test' });
  assert.ok(r.result.instructions.includes(String(CONTRACT_VERSION)));
});

test('initialize falls back to the newest protocol version for unknown requests', () => {
  for (const asked of ['1999-01-01', undefined, 42]) {
    const r = mk().handleMessage(req(1, 'initialize', { protocolVersion: asked }));
    assert.equal(r.result.protocolVersion, MCP_PROTOCOL_VERSIONS[0]);
  }
});

test('notifications never get a response', () => {
  const s = mk();
  assert.equal(s.handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.equal(s.handleMessage({ jsonrpc: '2.0', method: 'tools/list' }), null);
});

test('ping returns an empty result', () => {
  assert.deepEqual(mk().handleMessage(req(7, 'ping')), { jsonrpc: '2.0', id: 7, result: {} });
});

test('tools/list mirrors the verb table minus the exclusion list', () => {
  const r = mk().handleMessage(req(2, 'tools/list'));
  const names = r.result.tools.map((t) => t.name).sort();
  const expected = Object.keys(VERBS).filter((v) => !EXCLUDED_VERBS.includes(v)).sort();
  assert.deepEqual(names, expected);
  for (const t of r.result.tools) {
    assert.equal(t.inputSchema.type, 'object');
    assert.ok(t.description.length > 0, `${t.name} has a description`);
    assert.ok('cwd' in t.inputSchema.properties, `${t.name} accepts cwd`);
  }
  assert.deepEqual(listTools(), r.result.tools);
});

test('tools/call runs the verb with defaults: cwd fallback, json-stdin for payload verbs, schema defaults', () => {
  const s = mk();
  const r = s.handleMessage(req(3, 'tools/call', { name: 'write-state', arguments: { branch: 'feature/x', payload: { a: 1 } } }));
  assert.equal(r.result.isError, false);
  const got = r.result.structuredContent;
  assert.equal(got.verb, 'write-state');
  assert.equal(got.flags.cwd, '/tmp/default-cwd');
  assert.equal(got.flags['json-stdin'], true);
  assert.deepEqual(got.flags.payload, { a: 1 });
  assert.deepEqual(JSON.parse(r.result.content[0].text), got);
  assert.equal(r.result.content[0].type, 'text');

  const ro = s.handleMessage(req(4, 'tools/call', { name: 'read-config', arguments: { cwd: '/explicit' } }));
  assert.equal(ro.result.structuredContent.flags.cwd, '/explicit');
  assert.equal('json-stdin' in ro.result.structuredContent.flags, false);

  const rn = s.handleMessage(req(5, 'tools/call', { name: 'rename-memory', arguments: { branch: '_exploring/t', to: 'feature/t' } }));
  assert.deepEqual(rn.result.structuredContent.flags.payload, {});
  assert.equal(rn.result.structuredContent.flags['json-stdin'], true);
});

test('tools/call maps verb failure to isError without a JSON-RPC error', () => {
  const s = mk(() => ({ ok: false, error: 'boom' }));
  const r = s.handleMessage(req(3, 'tools/call', { name: 'read-config', arguments: {} }));
  assert.equal('error' in r, false);
  assert.equal(r.result.isError, true);
  assert.deepEqual(r.result.structuredContent, { ok: false, error: 'boom' });
});

test('tools/call rejects unknown tools and non-object arguments with -32602', () => {
  const s = mk();
  assert.equal(s.handleMessage(req(3, 'tools/call', { name: 'plugin-root', arguments: {} })).error.code, -32602);
  assert.equal(s.handleMessage(req(3, 'tools/call', { name: 'nope', arguments: {} })).error.code, -32602);
  assert.equal(s.handleMessage(req(3, 'tools/call', { name: 'read-config', arguments: [] })).error.code, -32602);
  assert.equal(s.handleMessage(req(3, 'tools/call', { name: 'read-config', arguments: 'x' })).error.code, -32602);
});

test('unknown methods → -32601, malformed requests → -32600, runVerb throw → -32603', () => {
  const s = mk();
  assert.equal(s.handleMessage(req(9, 'nope')).error.code, -32601);
  assert.equal(s.handleMessage({ id: 1, method: 'ping' }).error.code, -32600);
  assert.equal(s.handleMessage({ jsonrpc: '2.0', id: 1 }).error.code, -32600);
  assert.equal(s.handleMessage('not an object').error.code, -32600);
  const thrower = mk(() => { throw new Error('kaboom'); });
  const r = thrower.handleMessage(req(3, 'tools/call', { name: 'read-config', arguments: {} }));
  assert.equal(r.error.code, -32603);
  assert.match(r.error.message, /kaboom/);
});

test('handleLine: parse error → -32700 with null id, blank lines → null', () => {
  const s = mk();
  assert.deepEqual(s.handleLine('{nope'), { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } });
  assert.equal(s.handleLine(''), null);
  assert.equal(s.handleLine('   \r'), null);
  assert.equal(s.handleLine(JSON.stringify(req(1, 'ping'))).id, 1);
});
```

追加到 `tests/verbs.test.mjs`(parity 守卫):

```js
import { TOOL_META, EXCLUDED_VERBS } from '../lib/mcp.mjs';

test('TOOL_META and VERBS are in 1:1 correspondence (minus EXCLUDED_VERBS)', () => {
  assert.deepEqual(EXCLUDED_VERBS, ['plugin-root']);
  const verbs = Object.keys(VERBS).filter((v) => !EXCLUDED_VERBS.includes(v)).sort();
  assert.deepEqual(Object.keys(TOOL_META).sort(), verbs);
  for (const [name, meta] of Object.entries(TOOL_META)) {
    assert.equal(meta.inputSchema.type, 'object', `${name} schema type`);
    assert.equal(typeof meta.description, 'string');
    assert.ok(meta.description.trim().length > 0, `${name} description`);
    if (STDIN_MODE[name] === 'payload') assert.ok('payload' in meta.inputSchema.properties, `${name} declares payload`);
    if (STDIN_MODE[name] === 'fragment') assert.ok('fragment' in meta.inputSchema.properties, `${name} declares fragment`);
  }
});
```

- [x] **Step 2: 运行确认失败**

Run: `node --test tests/mcp.test.mjs tests/verbs.test.mjs`
Expected: FAIL — `Cannot find module '…/lib/mcp.mjs'`

- [x] **Step 3: 写最小实现 `lib/mcp.mjs`**

```js
// lib/mcp.mjs
// MCP (Model Context Protocol) front for the engine: pure JSON-RPC 2.0 message
// handling over the shared verb table. No transport lives here —
// bin/speccode-mcp.mjs feeds lines in and writes responses out. Hand-rolled on
// purpose: the engine stays zero-dependency, and the protocol surface we need
// is five methods.
import { VERBS, STDIN_MODE } from './verbs.mjs';
import { CONTRACT_VERSION, MCP_PROTOCOL_VERSIONS } from './contract.mjs';

// plugin-root resolves to the engine package root, which is not the host
// plugin root once the engine ships through npm — misleading over MCP.
export const EXCLUDED_VERBS = ['plugin-root'];

const CWD = {
  type: 'string',
  description: 'Directory inside the target repository (any worktree). Defaults to the server process cwd.',
};
const BRANCH = { type: 'string', description: 'Branch key in <type>/<slug> form (type: feature|bugfix|refactor|chore).' };
const PLAN = { type: 'string', description: 'Path to the plan markdown file.' };
const TASK = { type: 'integer', minimum: 1, description: 'Task number within the plan (1-based).' };
const OUT = { type: 'string', description: 'Output path override.' };

function tool(description, properties = {}, required = []) {
  return { description, inputSchema: { type: 'object', properties: { cwd: CWD, ...properties }, required } };
}
const payloadOf = (description) => ({ type: 'object', description });

export const TOOL_META = {
  'resolve-speccode-dir': tool('Resolve the .speccode directory of the main repository (works from linked worktrees).'),
  'detect-remote': tool('Read the origin remote URL, guess the PR tool (gh/glab) and whether it is installed.'),
  reconcile: tool('Reconcile `git worktree list` with .speccode state: orphans, conflicts and active branches; optionally query the PR tool to advance pr_open entries.', {
    'advance-pr': { type: 'boolean', description: 'Query PR state and advance pr_open → completed (merged) or back to in_progress (closed).' },
  }),
  'read-config': tool('Read .speccode/config.json (config is null when missing).'),
  'write-config': tool('Atomically write .speccode/config.json.', {
    payload: payloadOf('The full config object (what the CLI reads from stdin).'),
  }, ['payload']),
  'backup-config': tool('Copy config.json to a timestamped .bak file.'),
  'write-state': tool('Atomically write one branch state; v3 payloads are shape-gated before writing.', {
    branch: BRANCH, payload: payloadOf('The state object; its `branch` must equal the branch argument.'),
  }, ['branch', 'payload']),
  'delete-state': tool('Delete one branch state file.', { branch: BRANCH }, ['branch']),
  'lint-state': tool('Read-only shape lint of config and every state entry; never mutates.'),
  'migrate-state': tool('Migrate legacy v2 state/features entries to v3 state/branches.'),
  'feature-progress': tool('Completion counters for one branch state.', { branch: BRANCH }, ['branch']),
  'detect-code-intel-tools': tool('Probe which code-intelligence tools are available and integrated for the repository.'),
  'resolve-worktree-dir': tool('Resolve the worktree base directory (config or default) and its gitignore state.'),
  'sdd-workspace': tool('Resolve (creating if needed) the SDD workspace directory for a plan under the current worktree root.', { plan: PLAN }, ['plan']),
  'task-brief': tool('Extract one plan task into a brief file for an implementer subagent.', { plan: PLAN, task: TASK, out: OUT }, ['plan', 'task']),
  'review-package': tool('Bundle the plan, the task and the base..head diff into a review package file.', {
    plan: PLAN,
    base: { type: 'string', description: 'Base commit SHA.' },
    head: { type: 'string', description: 'Head commit SHA.' },
    out: OUT,
  }, ['plan', 'base', 'head']),
  'tick-task': tool('Tick the checkbox steps of one plan task (idempotent; reports what was ticked).', { plan: PLAN, task: TASK }, ['plan', 'task']),
  'query-pr': tool('Query the state of a pull/merge request through the configured PR tool.', {
    number: { type: 'string', description: 'PR / MR number as a numeric string.' },
  }, ['number']),
  'run-hook': tool('Run the lifecycle hook configured for an event (warn-only; the result is always ok:true).', {
    event: { type: 'string', description: 'Lifecycle event name, e.g. onProposed.' },
    fragment: { type: 'object', description: 'Caller payload fragment merged under the engine envelope (what the CLI reads from stdin).' },
  }, ['event']),
  'repo-merge-config': tool('Read the repository merge settings through the PR tool and report whether it is squash-only.'),
  'read-memory': tool('Read the memory markdown of a branch or exploring topic (memory is null when absent).', { branch: BRANCH }, ['branch']),
  'write-memory': tool('Write memory for a branch: replace atomically, or append in a single O_APPEND write.', {
    branch: BRANCH, payload: payloadOf('{mode: "replace" | "append", content: string}'),
  }, ['branch', 'payload']),
  'list-memory': tool('List exploring topics and every memory file with its completion status.'),
  'purge-memory': tool('Delete the memory file of a branch.', { branch: BRANCH }, ['branch']),
  'rename-memory': tool('Atomically rename a memory file (e.g. adopt an exploring topic into a branch); refuses to overwrite.', {
    branch: { type: 'string', description: 'Source key, e.g. _exploring/<topic>.' },
    to: { type: 'string', description: 'Target branch key.' },
    payload: { type: 'object', description: 'Reserved; defaults to {}.', default: {} },
  }, ['branch', 'to']),
  'read-knowledge': tool('Read the knowledge index, one topic (optionally parsed into distilled blocks), or list topics.', {
    index: { type: 'boolean', description: 'Read _index.md.' },
    topic: { type: 'string', description: 'Topic name or path, with or without .md.' },
    blocks: { type: 'boolean', description: 'With topic: return parsed distilled blocks instead of raw content.' },
  }),
  'read-consumed-archives': tool('Report archive bundles already consumed by distillation, present on disk, and still unconsumed.'),
  'write-consumed-archives': tool('Record archive bundles as consumed by distillation.', {
    payload: payloadOf('{add: string[]} archive bundle directory names.'),
  }, ['payload']),
  'write-knowledge': tool('Write a knowledge file by mode: replace, replace-hand, replace-distilled or index.', {
    rel: { type: 'string', description: 'Relative path under speccode/knowledge/ (no .., no absolute paths).' },
    payload: payloadOf('{mode, content?, blocks?, entries?, heading?} as required by the mode.'),
  }, ['rel', 'payload']),
  'contract-version': tool('Report the prose↔engine contract version, the engine version and the supported MCP protocol revisions.'),
};

export function listTools() {
  return Object.entries(TOOL_META).map(([name, { description, inputSchema }]) => ({ name, description, inputSchema }));
}

function applyDefaults(schema, args) {
  const out = { ...args };
  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    if (out[key] === undefined && prop && Object.prototype.hasOwnProperty.call(prop, 'default')) {
      out[key] = structuredClone(prop.default);
    }
  }
  return out;
}

const rpcError = (code, message) => ({ error: { code, message } });

export function createServer({ runVerb, engineVersion, defaultCwd }) {
  function initialize(params) {
    const asked = params?.protocolVersion;
    const protocolVersion = MCP_PROTOCOL_VERSIONS.includes(asked) ? asked : MCP_PROTOCOL_VERSIONS[0];
    return {
      protocolVersion,
      capabilities: { tools: {} },
      serverInfo: { name: 'speccode', version: engineVersion ?? '0.0.0' },
      instructions: `speccode engine, contract version ${CONTRACT_VERSION}. Tools mirror the CLI verbs 1:1 (same names, same result JSON); write tools take the JSON the CLI reads from stdin as a \`payload\` argument. Omit \`cwd\` to target the server's working directory.`,
    };
  }

  function callTool(params) {
    const name = params?.name;
    const meta = typeof name === 'string' ? TOOL_META[name] : undefined;
    if (!meta) return rpcError(-32602, `unknown tool: ${String(name)}`);
    const args = params.arguments === undefined ? {} : params.arguments;
    if (args === null || typeof args !== 'object' || Array.isArray(args)) {
      return rpcError(-32602, 'arguments must be an object');
    }
    const flags = applyDefaults(meta.inputSchema, args);
    if (flags.cwd === undefined) flags.cwd = defaultCwd;
    if (STDIN_MODE[name] === 'payload') flags['json-stdin'] = true;
    const result = runVerb(name, flags);
    return {
      result: {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
        isError: result?.ok === false,
      },
    };
  }

  function handleMessage(msg) {
    const isObject = msg !== null && typeof msg === 'object' && !Array.isArray(msg);
    const hasId = isObject && Object.prototype.hasOwnProperty.call(msg, 'id');
    const id = hasId ? msg.id : null;
    if (!isObject || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      return { jsonrpc: '2.0', id, error: { code: -32600, message: 'invalid request' } };
    }
    let out;
    try {
      switch (msg.method) {
        case 'initialize': out = { result: initialize(msg.params) }; break;
        case 'ping': out = { result: {} }; break;
        case 'tools/list': out = { result: { tools: listTools() } }; break;
        case 'tools/call': out = callTool(msg.params); break;
        default:
          if (msg.method.startsWith('notifications/')) return null;
          out = rpcError(-32601, `method not found: ${msg.method}`);
      }
    } catch (err) {
      out = rpcError(-32603, `internal error: ${String(err?.message || err)}`);
    }
    if (!hasId) return null;
    return { jsonrpc: '2.0', id, ...out };
  }

  function handleLine(line) {
    const trimmed = String(line).trim();
    if (!trimmed) return null;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      return { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } };
    }
    return handleMessage(msg);
  }

  return { handleMessage, handleLine, listTools };
}
```

- [x] **Step 4: 运行确认通过**

Run: `node --test tests/mcp.test.mjs tests/verbs.test.mjs`
Expected: PASS(mcp.test 10 个进程内用例 + verbs.test 全部含 parity)

- [x] **Step 5: 提交**

```bash
git add lib/mcp.mjs tests/mcp.test.mjs tests/verbs.test.mjs
git commit -m "feat(engine): MCP protocol core with 1:1 verb tool table"
```

---

### Task 4: MCP stdio 前端 `bin/speccode-mcp.mjs` + 端到端 + npm bin

**Files:**
- Create: `bin/speccode-mcp.mjs`(可执行)
- Modify: `package.json`(`bin` 增 `speccode-mcp`)
- Modify: `tests/zcode-adapter.test.mjs:45-51`(npm 守卫断言第二个 bin 键)
- Test: `tests/mcp.test.mjs`(追加端到端部分);`tests/verbs.test.mjs`(追加两前端 shebang/可执行位守卫)

**Interfaces:**
- Consumes: `createServer`(Task 3);`runVerb`、`readEngineVersion`(Task 2);`makeRepo` from `tests/helpers/tmprepo.mjs`
- Produces: 可执行 `bin/speccode-mcp.mjs`;`package.json.bin["speccode-mcp"] === "bin/speccode-mcp.mjs"`

- [x] **Step 1: 写失败测试(追加到 `tests/mcp.test.mjs`)**

```js
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRepo } from './helpers/tmprepo.mjs';

const MCP_BIN = fileURLToPath(new URL('../bin/speccode-mcp.mjs', import.meta.url));
const CLI_BIN = fileURLToPath(new URL('../bin/speccode.mjs', import.meta.url));

// Drive the server over stdio exactly like a host would: ndjson in, ndjson out.
function rpcSession(cwd, messages, bin = MCP_BIN) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [bin], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      const lines = out.split('\n').filter((l) => l.trim() !== '');
      resolve({ code, lines, parsed: lines.map((l) => JSON.parse(l)), stderr: err });
    });
    child.stdin.end(messages.map((m) => JSON.stringify(m)).join('\n') + '\n');
  });
}

const cli = (repo, ...args) => {
  const r = spawnSync('node', [CLI_BIN, ...args, '--cwd', repo], { encoding: 'utf8', input: args.input });
  return JSON.parse(r.stdout.trim());
};

test('e2e: initialize → list → write-state → reconcile → read-config parity → contract-version', async () => {
  const repo = makeRepo();
  spawnSync('node', [CLI_BIN, 'write-config', '--cwd', repo, '--json-stdin'], {
    encoding: 'utf8',
    input: JSON.stringify({ version: 3, initialized_at: '2026-01-01T00:00:00.000Z', trunk: 'master', remote: 'origin', pr_tool: 'none', worktree_dir: '.speccode/worktrees' }),
  });
  const state = { branch: 'feature/x', type: 'feature', worktree: null, merge_target: 'master', status: 'in_progress', created_at: '2026-01-01T00:00:00.000Z', initial_branch: 'master' };
  const { code, lines, parsed, stderr } = await rpcSession(repo, [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'write-state', arguments: { branch: 'feature/x', payload: state } } },
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'reconcile', arguments: {} } },
    { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'read-config', arguments: {} } },
    { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'contract-version', arguments: {} } },
  ]);
  assert.equal(code, 0);
  assert.equal(stderr, '');
  assert.equal(lines.length, 6, 'the notification produces no line');
  for (const l of lines) JSON.parse(l);
  const byId = Object.fromEntries(parsed.map((p) => [p.id, p]));
  assert.equal(byId[1].result.protocolVersion, '2025-06-18');
  assert.ok(byId[2].result.tools.some((t) => t.name === 'reconcile'));
  assert.equal(byId[3].result.isError, false);
  const onDisk = JSON.parse(readFileSync(join(repo, '.speccode', 'state', 'branches', 'feature__x.json'), 'utf8'));
  assert.deepEqual(onDisk, state);
  assert.ok(byId[4].result.structuredContent.features.some((f) => f.branch === 'feature/x'));
  assert.deepEqual(byId[5].result.structuredContent, cli(repo, 'read-config'));
  const cv = cli(repo, 'contract-version');
  assert.deepEqual(byId[6].result.structuredContent, cv);
  assert.equal(cv.contractVersion, CONTRACT_VERSION);
  rmSync(repo, { recursive: true, force: true });
});

test('e2e: verb failure is isError, bad line is -32700, server keeps serving afterwards', async () => {
  const repo = makeRepo();
  const child = spawn('node', [MCP_BIN], { cwd: repo });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  const done = new Promise((r) => child.on('close', r));
  child.stdin.write('this is not json\n');
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'read-memory', arguments: { branch: 'not a branch' } } }) + '\n');
  child.stdin.end(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping' }) + '\n');
  await done;
  const parsed = out.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.equal(parsed[0].error.code, -32700);
  assert.equal(parsed[0].id, null);
  assert.equal(parsed[1].result.isError, true);
  assert.equal(parsed[1].result.structuredContent.ok, false);
  assert.deepEqual(parsed[2], { jsonrpc: '2.0', id: 2, result: {} });
  rmSync(repo, { recursive: true, force: true });
});

test('e2e: MCP front runs through an npm-style symlink (no .mjs suffix)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'speccode-mcp-bin-'));
  const link = join(dir, 'speccode-mcp');
  symlinkSync(MCP_BIN, link);
  const { parsed } = await rpcSession(dir, [{ jsonrpc: '2.0', id: 1, method: 'ping' }], link);
  assert.deepEqual(parsed, [{ jsonrpc: '2.0', id: 1, result: {} }]);
  rmSync(dir, { recursive: true, force: true });
});
```

追加到 `tests/verbs.test.mjs`(两前端守卫):

```js
import { statSync } from 'node:fs';

test('both engine fronts have the node shebang and the executable bit', () => {
  for (const rel of ['../bin/speccode.mjs', '../bin/speccode-mcp.mjs']) {
    const p = fileURLToPath(new URL(rel, import.meta.url));
    assert.equal(readFileSync(p, 'utf8').split('\n')[0], '#!/usr/bin/env node', `${rel} shebang`);
    assert.ok(statSync(p).mode & 0o111, `${rel} executable`);
  }
});
```

修改 `tests/zcode-adapter.test.mjs` 的 npm 守卫(用例名与断言):

```js
test('npm metadata shape: bin exposes both engine fronts, files whitelist, zero deps', () => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.bin?.speccode, 'bin/speccode.mjs');
  assert.equal(pkg.bin?.['speccode-mcp'], 'bin/speccode-mcp.mjs');
  assert.deepEqual([...pkg.files].sort(), ['bin', 'hooks', 'lib', 'references', 'skills']);
  assert.equal(pkg.dependencies, undefined, '零第三方依赖不变量');
  assert.equal(pkg.type, 'module');
});
```

- [x] **Step 2: 运行确认失败**

Run: `node --test tests/mcp.test.mjs tests/verbs.test.mjs tests/zcode-adapter.test.mjs`
Expected: FAIL — e2e 用例 `spawn` 找不到 `bin/speccode-mcp.mjs`(`code !== 0` / 无输出);shebang 守卫 ENOENT;npm 守卫 `bin["speccode-mcp"]` 为 undefined

- [x] **Step 3: 写最小实现**

```js
#!/usr/bin/env node
// MCP stdio front for the speccode engine: one JSON-RPC message per line in,
// one per line out. Nothing but protocol messages goes to stdout.
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from '../lib/mcp.mjs';
import { runVerb, readEngineVersion } from '../lib/verbs.mjs';

function main() {
  const server = createServer({ runVerb, engineVersion: readEngineVersion(), defaultCwd: process.cwd() });
  const dispatch = (line) => {
    const res = server.handleLine(line);
    if (res) process.stdout.write(JSON.stringify(res) + '\n');
  };
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      dispatch(line);
    }
  });
  // A final unterminated line is still a message. No process.exit afterwards:
  // pipe writes are asynchronous on some platforms and an early exit could
  // truncate the last response; the loop ends on its own once stdout drains.
  process.stdin.on('end', () => { if (buf.trim()) dispatch(buf); });
  process.stdin.on('error', (err) => { process.stderr.write(`speccode-mcp: stdin error: ${err.message}\n`); });
}

function isEntry() {
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isEntry()) main();
```

```bash
chmod +x bin/speccode-mcp.mjs
```

`package.json` 的 `bin` 改为:

```json
  "bin": { "speccode": "bin/speccode.mjs", "speccode-mcp": "bin/speccode-mcp.mjs" },
```

- [x] **Step 4: 运行确认通过**

Run: `node --test tests/mcp.test.mjs tests/verbs.test.mjs tests/zcode-adapter.test.mjs`
Expected: PASS(含 3 个 e2e 用例、shebang 守卫、npm 守卫)

- [x] **Step 5: 提交**

```bash
git add bin/speccode-mcp.mjs package.json tests/mcp.test.mjs tests/verbs.test.mjs tests/zcode-adapter.test.mjs
git commit -m "feat(engine): MCP stdio front bin/speccode-mcp.mjs with npm bin entry"
```

---

### Task 5: CHANGELOG、AGENTS.md 与全量验证

**Files:**
- Modify: `CHANGELOG.md`(`[Unreleased]` 段)
- Modify: `AGENTS.md`(常用命令段、架构第 2 层、lib 模块计数、关键不变量「写 verb 必须 --json-stdin」)

**Interfaces:**
- Consumes: Task 1–4 的全部产物
- Produces: 文档与全量绿灯;无代码接口

- [x] **Step 1: CHANGELOG `[Unreleased]` 追加条目(置于既有 npm 条目之后)**

```markdown
- Added: MCP 前端——`bin/speccode-mcp.mjs`(stdio JSON-RPC 2.0,零依赖手写协议最小面:initialize / initialized / ping / tools/list / tools/call;tools 与 verb 1:1 同名,写类 tool 以 `payload` 参数替代 stdin,verb 失败映射 `isError`);npm `bin` 增 `speccode-mcp`。
- Added: 契约版本——`lib/contract.mjs` 的 `CONTRACT_VERSION` 与 `contract-version` verb/tool(自报 contractVersion / engineVersion / protocolVersions),MCP `initialize.instructions` 携带契约版本。
- Changed: verb 表下沉 `lib/verbs.mjs`(导出 `VERBS` / `runVerb` / `STDIN_MODE`),`bin/speccode.mjs` 收缩为薄壳;写 verb 的 stdin 非法 JSON 统一返回 `invalid JSON on stdin`。
- Fixed: 两个引擎前端的入口守卫改为 realpath 比对——此前 `process.argv[1].endsWith('speccode.mjs')` 在 npm bin 符号链接(名为 `speccode`)下为假,`npm i -g speccode` 后裸调静默零输出。
```

- [x] **Step 2: AGENTS.md 四处改写**

常用命令段在 `node bin/speccode.mjs <verb> --cwd . [--flags]` 之后追加:

```bash
# 手动驱动 MCP 前端(ndjson JSON-RPC,每行一条消息;stdout 每行一条回应)
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | node bin/speccode-mcp.mjs
```

架构节第 1 条「14 个经单测的纯逻辑模块(atomic / … / timestamp)」改为「17 个经单测的纯逻辑模块(atomic / config / contract / detect / git / hooks / knowledge / mcp / memory / prtool / reconcile / sanitize / sdd / slug / state / timestamp / verbs)」。

架构节第 2 条整条替换为:

```markdown
2. **引擎前端**(`bin/speccode.mjs` CLI 与 `bin/speccode-mcp.mjs` MCP stdio server)—— 两个薄壳,共享 `lib/verbs.mjs` 的 `VERBS` 表(verb 清单以该表为准;`runVerb` 把未知 verb 与 handler 抛错统一为 `{ok:false,error}`)。CLI:读 verb 直接返回;**写 verb 必须走 `--json-stdin`**(`echo '<json>' | speccode write-state --json-stdin`),stdin 由壳按 `STDIN_MODE` 声明读取并注入为 `flags.payload`(`run-hook` 的片段为 `flags.fragment`),handler 自身不读 stdin;非法 JSON 统一 `invalid JSON on stdin` + exit 1。MCP:tools 与 verb 1:1 同名(排除 `plugin-root`),写类 tool 以 `payload` 参数承载同一 JSON,verb 失败映射 `isError` 而非协议错误;协议逻辑在 `lib/mcp.mjs`,`lib/contract.mjs` 的 `CONTRACT_VERSION` 经 `contract-version` verb/tool 与 `initialize.instructions` 自报。两前端入口守卫均为 realpath 比对(兼容 npm bin 符号链接)。
```

关键不变量「写 verb 必须 `--json-stdin`」条末追加一句:「MCP 前端的等效形式是 tool 参数 `payload`;两前端对同一 payload 落盘结果一致。」

- [x] **Step 3: 全量测试**

Run: `node --test ./tests/*.test.mjs`
Expected: PASS,`fail 0`,用例数 ≥ 323 + 新增

- [x] **Step 4: 手动冒烟与守卫 grep**

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}' '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | node bin/speccode-mcp.mjs 2>/tmp/mcp-err.txt | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const ls=s.trim().split("\n");console.log(ls.length, ls.map(l=>JSON.parse(l).id))})'
test ! -s /tmp/mcp-err.txt && echo "stderr clean"
grep -rn "readFileSync(0" lib/ bin/        # 预期仅 bin/speccode.mjs 一处
git diff --stat feature/prose-core-mcp-split -- skills/ | tail -1   # 预期空输出
```
Expected: `2 [ 1, 2 ]`、`stderr clean`、grep 仅 `bin/speccode.mjs` 一处、skills/ diff 为空

- [x] **Step 5: 提交**

```bash
git add CHANGELOG.md AGENTS.md
git commit -m "docs: MCP front, contract version and verb-table relocation"
```

---

## 计划自查

- **规格覆盖**:mcp-frontend 四条 requirement ↔ Task 3(协议最小面、isError、协商)/ Task 3+4(tools 1:1、payload 落盘、双前端一致)/ Task 1+2(契约版本 verb、instructions 在 Task 3)/ Task 2(双前端共享 verb 表、handler 不读 stdin、CLI 回归);speccode-config-management「写 verb stdin 契约」MODIFIED ↔ Task 2(invalid JSON 统一)+ Task 4(MCP payload 等效 e2e);plugin-packaging「插件根目录布局」MODIFIED ↔ Task 4(bin 第二条目、shebang/可执行位守卫)。
- **占位符扫描**:无 TBD/TODO;每步含可执行代码或命令。
- **类型一致性**:`runVerb(verb, flags)`、`createServer({runVerb, engineVersion, defaultCwd})`、`handleMessage` / `handleLine` 返回 `object | null`、`STDIN_MODE` 七键、`EXCLUDED_VERBS = ['plugin-root']` 在各任务间一致;`readEngineVersion` 在 Task 2 定义、Task 4 消费。
