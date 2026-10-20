import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, rmSync, mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, listTools, TOOL_META, EXCLUDED_VERBS } from '../lib/mcp.mjs';
import { VERBS, STDIN_MODE } from '../lib/verbs.mjs';
import { CONTRACT_VERSION, MCP_PROTOCOL_VERSIONS } from '../lib/contract.mjs';
import { makeRepo } from './helpers/tmprepo.mjs';

const MCP_BIN = fileURLToPath(new URL('../bin/speccode-mcp.mjs', import.meta.url));
const CLI_BIN = fileURLToPath(new URL('../bin/speccode.mjs', import.meta.url));

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

  // An explicit null/empty cwd means "no preference" too — never reaches spawnSync as null.
  for (const cwd of [null, '']) {
    const rc = s.handleMessage(req(6, 'tools/call', { name: 'read-config', arguments: { cwd } }));
    assert.equal(rc.result.structuredContent.flags.cwd, '/tmp/default-cwd');
  }

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

test('TOOL_META declares payload/fragment arguments wherever STDIN_MODE needs them', () => {
  for (const [name, mode] of Object.entries(STDIN_MODE)) {
    const props = TOOL_META[name].inputSchema.properties;
    assert.ok(mode in props, `${name} declares ${mode}`);
  }
});

// ---------------------------------------------------------------------------
// End-to-end: drive bin/speccode-mcp.mjs over stdio exactly like a host would
// (ndjson in, ndjson out) against a real temporary repository.
// ---------------------------------------------------------------------------

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

function cli(repo, verb, extra = [], input) {
  const r = spawnSync('node', [CLI_BIN, verb, '--cwd', repo, ...extra], { encoding: 'utf8', input });
  return JSON.parse(r.stdout.trim());
}

test('e2e: initialize → write-config → list → write-state → reconcile → read-config parity → contract-version', async () => {
  const repo = makeRepo();
  const cfg = {
    version: 3, initialized_at: '2026-01-01T00:00:00.000Z', trunk: 'master', remote: 'origin',
    pr_tool: 'none', worktree_dir: '.speccode/worktrees',
  };
  const state = {
    branch: 'feature/x', type: 'feature', worktree: null, merge_target: 'master',
    status: 'in_progress', created_at: '2026-01-01T00:00:00.000Z', initial_branch: 'master',
  };
  const { code, lines, parsed, stderr } = await rpcSession(repo, [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'write-config', arguments: { payload: cfg } } },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'write-state', arguments: { branch: 'feature/x', payload: state } } },
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'reconcile', arguments: {} } },
    { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'read-config', arguments: {} } },
    { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'contract-version', arguments: {} } },
  ]);
  assert.equal(code, 0);
  assert.equal(stderr, '');
  assert.equal(lines.length, 7, 'the notification produces no line');
  const byId = Object.fromEntries(parsed.map((p) => [p.id, p]));
  assert.equal(byId[1].result.protocolVersion, '2025-06-18');
  // write-config over MCP lands the same bytes the CLI stdin path would.
  assert.equal(byId[7].result.isError, false);
  assert.deepEqual(JSON.parse(readFileSync(join(repo, '.speccode', 'config.json'), 'utf8')), cfg);
  assert.deepEqual(cli(repo, 'read-config').config, cfg);
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
