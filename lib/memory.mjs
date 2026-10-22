import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeTextAtomic } from './atomic.mjs';
import { branchToStateName, validateBranch, validateSlug } from './slug.mjs';

// Per-feature session memory, branch-keyed: callers pass the branch's parsed
// state object (or null) and the home follows it — a registered branch with a
// worktree owns <worktree>/.speccode/memory/, everything else (reserved trunk
// keys like `_knowledge`/`_exploring/*`, unregistered branches) lives in the
// main repo's .speccode/memory/. Each home self-ignores via a plugin-owned
// .gitignore (ensureMemoryDir), untracked by convention like the rest of
// .speccode/. memory.mjs stays state-free: state arrives as data, never
// imported — the verb layer decides which branches carry state.

// Trunk-level (non-feature) memory keys: no-slash keys that bypass the
// <type>/<slug> branch validation. `_knowledge` = knowledge-command
// maintenance summaries (knowledge commands run from trunk, not bound to a
// feature). Exploring conclusions always go through `_exploring/<topic>`
// topic keys — there is no bare `_exploring` key.
export const TRUNK_MEMORY_KEYS = ['_knowledge'];

// Branch-key validation for read/write/rename-memory: reserved no-slash trunk
// keys, `_exploring/<topic>` topic keys (topic reuses the slug charset), and
// regular <type>/<slug> feature branches. Supersedes the bin-side inline
// `TRUNK_MEMORY_KEYS.includes(branch) || validateBranch(branch)` check.
export function validateMemoryBranch(branch) {
  if (typeof branch !== 'string') return false;
  if (TRUNK_MEMORY_KEYS.includes(branch)) return true;
  if (branch.startsWith('_exploring/')) {
    return validateSlug(branch.slice('_exploring/'.length));
  }
  return validateBranch(branch);
}

export function memoryDir(speccodeDir) {
  return join(speccodeDir, 'memory');
}

// Branch-keyed home resolution: `state?.worktree` set (non-empty string) →
// that worktree's .speccode/memory/; else the main repo's memory dir.
export function memoryHomeDir(speccodeDir, state) {
  const wt = state?.worktree;
  return typeof wt === 'string' && wt ? join(wt, '.speccode', 'memory') : memoryDir(speccodeDir);
}

export function memoryPathFor(speccodeDir, state, branch) {
  // branchToStateName 对无斜杠键会产生 '_knowledge__undefined' 形态——无斜杠键直通
  const name = branch.includes('/') ? branchToStateName(branch) : branch;
  return join(memoryHomeDir(speccodeDir, state), `${name}.md`);
}

// Main-repo direct semantics, kept for callers that explicitly want the main
// home regardless of any branch state.
export function memoryPath(speccodeDir, branch) {
  return memoryPathFor(speccodeDir, null, branch);
}

// mkdir + plugin-owned self-ignoring .gitignore, idempotent. Extracted from
// writeMemory so every memory home (including renameMemory adoption targets)
// is prepared the same way. Returns dir.
export function ensureMemoryDir(dir) {
  mkdirSync(dir, { recursive: true });
  // Self-ignore the memory dir (plugin-owned file, the user's .gitignore is
  // never touched — same shape as sdd-plan.mjs sddWorkspace
  // (skills/subagent-driven-development/scripts)): keeps memory
  // files out of `git status` and safe from `git clean -fd` (no -x).
  // Idempotent — skip the write when content matches.
  const gitignore = join(dir, '.gitignore');
  if (!existsSync(gitignore) || readFileSync(gitignore, 'utf8') !== '*\n') {
    writeFileSync(gitignore, '*\n');
  }
  return dir;
}

export function readMemory(speccodeDir, state, branch) {
  const p = memoryPathFor(speccodeDir, state, branch);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

export function writeMemory(speccodeDir, state, branch, content, mode) {
  ensureMemoryDir(memoryHomeDir(speccodeDir, state));
  const p = memoryPathFor(speccodeDir, state, branch);
  if (mode === 'append') {
    // Single O_APPEND write (appendFileSync opens with O_APPEND): a concurrent
    // cross-worktree append cannot clobber what we already wrote, unlike the
    // old read-modify-write path. On a missing file this creates it after the
    // mkdir above.
    // 条目边界兜底:既有内容非空且无尾换行、新内容无头换行时,补恰好一个 \n,
    // 与内容合并为同一次 O_APPEND 写。判定读与追加写之间理论上可被并发追加
    // 穿插,代价至多是一条粘连行(装饰性),绝不丢数据。
    const existing = existsSync(p) ? readFileSync(p, 'utf8') : '';
    const sep = existing && !existing.endsWith('\n') && !content.startsWith('\n') ? '\n' : '';
    appendFileSync(p, sep + content);
  } else {
    writeTextAtomic(p, content);
  }
  return p;
}

// List existing exploring topic keys (`_exploring/<topic>`), sorted.
// Feature memory files are excluded by the same prefix filter.
export function listMemory(speccodeDir) {
  const dir = memoryDir(speccodeDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith('_exploring__') && f.endsWith('.md'))
    .map((f) => `_exploring/${f.slice('_exploring__'.length, -'.md'.length)}`)
    .sort();
}

// All memory file keys in one directory, branch form (`<type>/<slug>`,
// `_exploring/<t>`, bare trunk keys like `_knowledge`), sorted. Completion
// annotation is NOT derived here — memory.mjs stays state-free; the CLI verb
// joins with state.
export function listMemoryKeysIn(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const stem = f.slice(0, -'.md'.length);
      const i = stem.indexOf('__');
      return i === -1 ? stem : `${stem.slice(0, i)}/${stem.slice(i + 2)}`;
    })
    .sort();
}

// Main-repo shell over listMemoryKeysIn.
export function listMemoryKeys(speccodeDir) {
  return listMemoryKeysIn(memoryDir(speccodeDir));
}

// Explicit single-key memory removal. Idempotent (missing file → purged:false,
// never an error); batch/all forms are deliberately absent — destructive
// actions stay one-key-at-a-time explicit, mirroring the never-silent-delete
// family discipline.
export function purgeMemory(speccodeDir, state, branch) {
  if (!validateMemoryBranch(branch)) throw new Error(`invalid branch name: ${branch}`);
  const p = memoryPathFor(speccodeDir, state, branch);
  if (!existsSync(p)) return { purged: false, path: p };
  rmSync(p);
  return { purged: true, path: p };
}

// Atomically adopt an exploring topic file into a feature memory file. The
// two ends resolve independently (from/to may live in different homes): a
// same-filesystem renameSync moves in one step, EXDEV degrades to
// atomic-write-then-unlink. Refuses to overwrite an existing target —
// adoption must never merge or clobber (same safety stance as reconcile
// attribution).
export function renameMemory(speccodeDir, fromState, toState, from, to, opts = {}) {
  if (!validateMemoryBranch(from)) throw new Error(`invalid branch name: ${from}`);
  if (!validateMemoryBranch(to)) throw new Error(`invalid branch name: ${to}`);
  const src = memoryPathFor(speccodeDir, fromState, from);
  const dst = memoryPathFor(speccodeDir, toState, to);
  if (!existsSync(src)) throw new Error(`memory file not found: ${src}`);
  if (existsSync(dst)) throw new Error(`memory file already exists: ${dst}`);
  ensureMemoryDir(memoryHomeDir(speccodeDir, toState));
  const ren = opts.rename ?? renameSync;
  try {
    ren(src, dst);
  } catch (err) {
    if (err?.code !== 'EXDEV') throw err;
    // 跨设备降级:先原子落盘目标再删源,读端永远看不到半截文件。
    writeTextAtomic(dst, readFileSync(src, 'utf8'));
    rmSync(src);
  }
  return dst;
}
