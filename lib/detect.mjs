// 纯 worktree/分支定位模块:worktree 目录解析、路径归属判定、运行时 trunk 名解析。
import { resolve, sep } from 'node:path';
import { git } from './git.mjs';

// Neutral default worktree root — single source of truth. reconcile.mjs
// imports this constant; the previous default carried host flavor and was
// duplicated across two libs.
export const DEFAULT_WORKTREE_DIR = '.speccode/worktrees';

export function resolveWorktreeDir(config) {
  const dir = config && typeof config.worktree_dir === 'string' ? config.worktree_dir.trim() : '';
  if (dir) return { dir, source: 'config' };
  return { dir: DEFAULT_WORKTREE_DIR, source: 'default' };
}

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

// 判定 target 是否位于 root 之内(含 root 自身)。target 相对/绝对均可,
// 一律 resolve(root, target) 归一;前缀补分隔符防 /repo vs /repo-evil 兄弟前缀误判。
export function isPathInside(root, target) {
  const base = resolve(root);
  const resolved = resolve(root, target);
  return resolved === base || resolved.startsWith(base + sep);
}

// creating-worktree 的 gitignore 校验:仓库外目录永不被 git 跟踪 → outside,
// 且不调用 git(其对外部路径 fatal+exit 128);仅仓库内分支跑 check-ignore。
// 查询带尾斜杠:check-ignore 对不存在的路径无法判断「目录」语义,裸路径
// 即使被 dir 模式(.wt/)忽略也会返回 exit 1;`<dir>/` 明确按目录判定。
export function worktreeDirIgnoreState(repoRootDir, dir) {
  if (!isPathInside(repoRootDir, dir)) return { scope: 'outside' };
  const r = git(['check-ignore', '-q', `${dir.replace(/[\\/]+$/, '')}/`], { cwd: repoRootDir, allowFail: true });
  return { scope: 'inside', ignored: r.code === 0 };
}
