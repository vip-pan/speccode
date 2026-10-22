import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listMemory, memoryDir, memoryHomeDir, memoryPath, memoryPathFor, purgeMemory, readMemory, renameMemory, writeMemory, validateMemoryBranch } from '../lib/memory.mjs';

function tmp() { return mkdtempSync(join(tmpdir(), 'speccode-mem-')); }

test('memoryPath reuses the double-underscore state naming', () => {
  assert.equal(memoryPath('/x/.speccode', 'feature/payment-api'),
    '/x/.speccode/memory/feature__payment-api.md');
  assert.equal(memoryPath('/x/.speccode', '_exploring'), '/x/.speccode/memory/_exploring.md');
});

test('readMemory returns null when absent', () => {
  const dir = tmp();
  assert.equal(readMemory(dir, null, 'feature/none'), null);
  rmSync(dir, { recursive: true, force: true });
});

test('writeMemory replace then read round-trips, dir auto-created', () => {
  const dir = tmp();
  const p = writeMemory(dir, null, 'feature/x', '# memory\n', 'replace');
  assert.equal(p, memoryPath(dir, 'feature/x'));
  assert.equal(readMemory(dir, null, 'feature/x'), '# memory\n');
  rmSync(dir, { recursive: true, force: true });
});

test('writeMemory append preserves existing content', () => {
  const dir = tmp();
  writeMemory(dir, null, 'feature/x', 'first\n', 'replace');
  writeMemory(dir, null, 'feature/x', 'second\n', 'append');
  assert.equal(readMemory(dir, null, 'feature/x'), 'first\nsecond\n');
  rmSync(dir, { recursive: true, force: true });
});

test('writeMemory append on missing file behaves as replace', () => {
  const dir = tmp();
  writeMemory(dir, null, 'feature/y', 'only\n', 'append');
  assert.equal(readMemory(dir, null, 'feature/y'), 'only\n');
  rmSync(dir, { recursive: true, force: true });
});

test('writeMemory append inserts one boundary newline when missing', () => {
  const dir = tmp();
  writeMemory(dir, null, 'feature/x', 'first', 'replace');
  writeMemory(dir, null, 'feature/x', '- second', 'append');
  assert.equal(readMemory(dir, null, 'feature/x'), 'first\n- second');
  rmSync(dir, { recursive: true, force: true });
});

test('writeMemory append leaves boundary alone when newline already present', () => {
  const dir = tmp();
  writeMemory(dir, null, 'feature/x', 'first\n', 'replace');
  writeMemory(dir, null, 'feature/x', '\n- second', 'append');
  assert.equal(readMemory(dir, null, 'feature/x'), 'first\n\n- second');
  rmSync(dir, { recursive: true, force: true });
});

test('append is a single O_APPEND write: two appends with no read between keep both', () => {
  // Lock the O_APPEND semantics: each append is one appendFileSync write, so
  // concurrent cross-worktree appends never lose data via read-modify-write.
  const dir = tmp();
  writeMemory(dir, null, 'feature/x', 'a\n', 'append');
  writeMemory(dir, null, 'feature/x', 'b\n', 'append');
  assert.equal(readMemory(dir, null, 'feature/x'), 'a\nb\n');
  rmSync(dir, { recursive: true, force: true });
});

test('writeMemory is atomic (no tmp residue, no partial state)', () => {
  const dir = tmp();
  writeMemory(dir, null, 'feature/x', 'v1', 'replace');
  writeMemory(dir, null, 'feature/x', 'v2', 'replace');
  const files = readdirSync(memoryDir(dir));
  assert.deepEqual(files, ['.gitignore', 'feature__x.md']);
  assert.equal(readMemory(dir, null, 'feature/x'), 'v2');
  rmSync(dir, { recursive: true, force: true });
});

test('writeMemory self-ignores the memory dir with a plugin-owned .gitignore', () => {
  const dir = tmp();
  writeMemory(dir, null, 'feature/x', '# memory\n', 'replace');
  const gitignore = join(memoryDir(dir), '.gitignore');
  assert.ok(existsSync(gitignore));
  assert.equal(readFileSync(gitignore, 'utf8'), '*\n');
  // second write stays idempotent: same content, no error
  writeMemory(dir, null, 'feature/x', 'more\n', 'append');
  assert.equal(readFileSync(gitignore, 'utf8'), '*\n');
  assert.equal(readMemory(dir, null, 'feature/x'), '# memory\nmore\n');
  rmSync(dir, { recursive: true, force: true });
});

test('memoryPath encodes an _exploring topic via branchToStateName', () => {
  assert.equal(memoryPath('/x/.speccode', '_exploring/payment-rework'),
    '/x/.speccode/memory/_exploring__payment-rework.md');
});

test('validateMemoryBranch accepts reserved keys, topics, and feature branches', () => {
  assert.equal(validateMemoryBranch('_exploring'), false, '无斜杠 _exploring 已退役');
  assert.equal(validateMemoryBranch('_knowledge'), true);
  assert.equal(validateMemoryBranch('_exploring/payment-rework'), true);
  assert.equal(validateMemoryBranch('feature/payment-api'), true);
  assert.equal(validateMemoryBranch('bugfix/fix-cr'), true);
});

test('validateMemoryBranch rejects bad topics and branches', () => {
  assert.equal(validateMemoryBranch('_exploring/Bad_Topic'), false);
  assert.equal(validateMemoryBranch('_exploring/'), false);
  assert.equal(validateMemoryBranch('_exploring/a/b'), false);
  assert.equal(validateMemoryBranch('_unknown'), false);
  assert.equal(validateMemoryBranch('worktree-typo'), false);
  assert.equal(validateMemoryBranch(42), false);
});

test('listMemory returns only _exploring topic keys, sorted', () => {
  const dir = tmp();
  writeMemory(dir, null, '_exploring/b-p1', 'x\n', 'replace');
  writeMemory(dir, null, '_exploring/a', 'x\n', 'replace');
  writeMemory(dir, null, 'feature/c', 'x\n', 'replace');
  assert.deepEqual(listMemory(dir), ['_exploring/a', '_exploring/b-p1']);
  rmSync(dir, { recursive: true, force: true });
});

test('listMemory returns empty when no topics exist', () => {
  const dir = tmp();
  assert.deepEqual(listMemory(dir), []);
  rmSync(dir, { recursive: true, force: true });
});

test('renameMemory moves the topic file and keeps content', () => {
  const dir = tmp();
  writeMemory(dir, null, '_exploring/a', 'conclusions\n', 'replace');
  const dst = renameMemory(dir, null, null, '_exploring/a', 'feature/b');
  assert.equal(dst, memoryPath(dir, 'feature/b'));
  assert.equal(readMemory(dir, null, 'feature/b'), 'conclusions\n');
  assert.equal(readMemory(dir, null, '_exploring/a'), null);
  assert.equal(existsSync(memoryPath(dir, '_exploring/a')), false);
  rmSync(dir, { recursive: true, force: true });
});

test('renameMemory refuses a missing source', () => {
  const dir = tmp();
  assert.throws(() => renameMemory(dir, null, null, '_exploring/none', 'feature/b'), /not found/);
  rmSync(dir, { recursive: true, force: true });
});

test('renameMemory refuses an existing target and keeps both files', () => {
  const dir = tmp();
  writeMemory(dir, null, '_exploring/a', 'exploring\n', 'replace');
  writeMemory(dir, null, 'feature/b', 'existing\n', 'replace');
  assert.throws(() => renameMemory(dir, null, null, '_exploring/a', 'feature/b'), /already exists/);
  assert.equal(readMemory(dir, null, '_exploring/a'), 'exploring\n');
  assert.equal(readMemory(dir, null, 'feature/b'), 'existing\n');
  rmSync(dir, { recursive: true, force: true });
});

test('renameMemory validates both branch keys', () => {
  const dir = tmp();
  writeMemory(dir, null, '_exploring/a', 'x\n', 'replace');
  assert.throws(() => renameMemory(dir, null, null, '_exploring/a', 'feature/Bad_Slug'), /invalid branch/);
  rmSync(dir, { recursive: true, force: true });
});

test('purgeMemory: deletes once, idempotent on missing, invalid branch throws', () => {
  const dir = tmp();
  writeMemory(dir, null, 'feature/x', 'hello', 'replace');
  const r1 = purgeMemory(dir, null, 'feature/x');
  assert.equal(r1.purged, true);
  assert.equal(r1.path, memoryPath(dir, 'feature/x'));
  assert.ok(!existsSync(memoryPath(dir, 'feature/x')), '文件已删除');
  const r2 = purgeMemory(dir, null, 'feature/x');
  assert.equal(r2.purged, false, '幂等:缺失不报错');
  assert.throws(() => purgeMemory(dir, null, 'Bad/Key'), /invalid/i);
  rmSync(dir, { recursive: true, force: true });
});

// --- branch-keyed home resolution (state parameter) ---

test('memoryHomeDir: reserved/unregistered → main; registered worktree → worktree dir', () => {
  const sd = '/x/.speccode';
  assert.equal(memoryHomeDir(sd, null), join(sd, 'memory'));
  assert.equal(memoryHomeDir(sd, { worktree: null }), join(sd, 'memory'));
  assert.equal(memoryHomeDir(sd, { branch: 'feature/x', worktree: '/wt/x' }), join('/wt/x', '.speccode', 'memory'));
});

test('memoryPathFor encodes the same double-underscore name in either home', () => {
  assert.equal(memoryPathFor('.sc', { worktree: '/w' }, 'feature/pay'),
    join('/w', '.speccode', 'memory', 'feature__pay.md'));
  assert.equal(memoryPathFor('.sc', null, '_knowledge'), join('.sc', 'memory', '_knowledge.md'));
});

test('writeMemory with state lands inside the worktree home and self-ignores it', () => {
  const wt = mkdtempSync(join(tmpdir(), 'mem-wt-'));
  const p = writeMemory('.sc', { worktree: wt }, 'feature/x', 'hello', 'replace');
  assert.equal(p, join(wt, '.speccode', 'memory', 'feature__x.md'));
  assert.equal(readFileSync(p, 'utf8'), 'hello');
  assert.equal(readFileSync(join(wt, '.speccode', 'memory', '.gitignore'), 'utf8'), '*\n');
  rmSync(wt, { recursive: true, force: true });
});

test('renameMemory moves across directories on one filesystem', () => {
  const a = mkdtempSync(join(tmpdir(), 'mem-a-')); const b = mkdtempSync(join(tmpdir(), 'mem-b-'));
  mkdirSync(join(a, '.speccode', 'memory'), { recursive: true });
  writeFileSync(join(a, '.speccode', 'memory', '_exploring__t.md'), 'notes');
  const dst = renameMemory('.sc', { worktree: a }, { worktree: b }, '_exploring/t', 'feature/t');
  assert.equal(dst, join(b, '.speccode', 'memory', 'feature__t.md'));
  assert.ok(!existsSync(join(a, '.speccode', 'memory', '_exploring__t.md')));
  assert.equal(readFileSync(dst, 'utf8'), 'notes');
  rmSync(a, { recursive: true, force: true }); rmSync(b, { recursive: true, force: true });
});

test('renameMemory EXDEV falls back to atomic-write + unlink', () => {
  const a = mkdtempSync(join(tmpdir(), 'mem-a-')); const b = mkdtempSync(join(tmpdir(), 'mem-b-'));
  mkdirSync(join(a, '.speccode', 'memory'), { recursive: true });
  writeFileSync(join(a, '.speccode', 'memory', '_exploring__t.md'), 'notes');
  const exdev = Object.assign(new Error('cross-device link'), { code: 'EXDEV' });
  const dst = renameMemory('.sc', { worktree: a }, { worktree: b }, '_exploring/t', 'feature/t',
    { rename: () => { throw exdev; } });
  assert.equal(readFileSync(dst, 'utf8'), 'notes');
  assert.ok(!existsSync(join(a, '.speccode', 'memory', '_exploring__t.md')));
  rmSync(a, { recursive: true, force: true }); rmSync(b, { recursive: true, force: true });
});

test('renameMemory target-exists refusal works across directories', () => {
  const a = mkdtempSync(join(tmpdir(), 'mem-a-')); const b = mkdtempSync(join(tmpdir(), 'mem-b-'));
  mkdirSync(join(a, '.speccode', 'memory'), { recursive: true });
  writeFileSync(join(a, '.speccode', 'memory', '_exploring__t.md'), 'x');
  mkdirSync(join(b, '.speccode', 'memory'), { recursive: true });
  writeFileSync(join(b, '.speccode', 'memory', 'feature__t.md'), 'existing');
  assert.throws(() => renameMemory('.sc', { worktree: a }, { worktree: b }, '_exploring/t', 'feature/t'), /already exists/);
  rmSync(a, { recursive: true, force: true }); rmSync(b, { recursive: true, force: true });
});
