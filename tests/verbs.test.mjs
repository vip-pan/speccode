import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, symlinkSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { CONTRACT_VERSION, MCP_PROTOCOL_VERSIONS } from '../lib/contract.mjs';
import { VERBS, STDIN_MODE, runVerb, readEngineVersion } from '../lib/verbs.mjs';
import { TOOL_META, EXCLUDED_VERBS } from '../lib/mcp.mjs';

const CLI_BIN = fileURLToPath(new URL('../bin/speccode.mjs', import.meta.url));
const PKG = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));

test('CONTRACT_VERSION is a positive integer', () => {
  assert.equal(Number.isInteger(CONTRACT_VERSION), true);
  assert.ok(CONTRACT_VERSION >= 1);
});

test('MCP_PROTOCOL_VERSIONS lists supported revisions, newest first', () => {
  assert.ok(MCP_PROTOCOL_VERSIONS.length >= 1);
  assert.equal(MCP_PROTOCOL_VERSIONS[0], '2025-06-18');
  assert.deepEqual([...MCP_PROTOCOL_VERSIONS].sort().reverse(), MCP_PROTOCOL_VERSIONS);
});

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
  const extra = ['--branch', 'feature/x', '--to', 'feature/y', '--rel', 'x.md'];
  for (const verb of Object.keys(STDIN_MODE).filter((v) => STDIN_MODE[v] === 'payload')) {
    const r = spawnSync('node', [CLI_BIN, verb, '--cwd', process.cwd(), ...extra, '--json-stdin'],
      { encoding: 'utf8', input: '{not json' });
    assert.equal(r.status, 1, `${verb} exits 1`);
    assert.deepEqual(JSON.parse(r.stdout.trim()), { ok: false, error: 'invalid JSON on stdin' }, verb);
  }
});

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

test('both engine fronts have the node shebang and the executable bit', () => {
  for (const rel of ['../bin/speccode.mjs', '../bin/speccode-mcp.mjs']) {
    const p = fileURLToPath(new URL(rel, import.meta.url));
    assert.equal(readFileSync(p, 'utf8').split('\n')[0], '#!/usr/bin/env node', `${rel} shebang`);
    assert.ok(statSync(p).mode & 0o111, `${rel} executable`);
  }
});
