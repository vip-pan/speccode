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
