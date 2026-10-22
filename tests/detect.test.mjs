import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveWorktreeDir, isPathInside, worktreeDirIgnoreState, DEFAULT_WORKTREE_DIR, resolveDefaultBranch,
} from '../lib/detect.mjs';

test('resolveWorktreeDir three states', () => {
  assert.deepEqual(resolveWorktreeDir({ worktree_dir: '.wt' }), { dir: '.wt', source: 'config' });
  assert.deepEqual(resolveWorktreeDir({}), { dir: DEFAULT_WORKTREE_DIR, source: 'default' });
  assert.deepEqual(resolveWorktreeDir(null), { dir: DEFAULT_WORKTREE_DIR, source: 'default' });
  assert.deepEqual(resolveWorktreeDir({ worktree_dir: '  ' }), { dir: DEFAULT_WORKTREE_DIR, source: 'default' });
});

test('isPathInside: inside / outside / relative / sibling-prefix / root-self', () => {
  assert.equal(isPathInside('/repo', '/repo/a/b'), true);
  assert.equal(isPathInside('/repo', '/other'), false);
  assert.equal(isPathInside('/repo', 'a/b'), true);         // 相对 target 按 root 解析
  assert.equal(isPathInside('/repo', '/repo-evil'), false); // 兄弟前缀陷阱
  assert.equal(isPathInside('/repo', '/repo'), true);       // root 自身
});

test('worktreeDirIgnoreState: 仓库外目录返回 outside 且不碰 git', () => {
  assert.deepEqual(worktreeDirIgnoreState('/repo', '/outside/dir'), { scope: 'outside' });
});

test('worktree_dir 缺省中性且单源', () => {
  assert.equal(DEFAULT_WORKTREE_DIR, '.speccode/worktrees');
  assert.deepEqual(resolveWorktreeDir({}), { dir: DEFAULT_WORKTREE_DIR, source: 'default' });
  assert.deepEqual(resolveWorktreeDir(null), { dir: DEFAULT_WORKTREE_DIR, source: 'default' });
  assert.deepEqual(resolveWorktreeDir({ worktree_dir: '  ' }), { dir: DEFAULT_WORKTREE_DIR, source: 'default' });
});

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
