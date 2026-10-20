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
import { readState, writeState, deleteState, listActiveFeatures, lintStateEntries, WORKTREE_STATUS } from './state.mjs';
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

export const VERBS = {
  'resolve-speccode-dir': ({ cwd }) => ({ ok: true, speccodeDir: speccodeDirOf(cwd) }),
  // Self-locating plugin root: anchored on this file's own location, so it is
  // independent of how the plugin is installed and of the invoking cwd. Skills
  // use it to reference in-plugin files without host-specific variables.
  'plugin-root': () => ({ ok: true, root: PACKAGE_ROOT }),

  'contract-version': () => ({
    ok: true,
    contractVersion: CONTRACT_VERSION,
    engineVersion: readEngineVersion(),
    protocolVersions: [...MCP_PROTOCOL_VERSIONS],
  }),

  'detect-remote': ({ cwd }) => {
    const remote = 'origin';
    const r = git(['remote', 'get-url', remote], { cwd, allowFail: true });
    const url = r.code === 0 ? r.stdout.trim() : '';
    const guess = detectPrToolFromUrl(url);
    return { ok: true, remote, url, prToolGuess: guess, installed: isInstalled(guess) };
  },

  reconcile: ({ cwd, 'advance-pr': advancePr }) => {
    const sc = speccodeDirOf(cwd);
    const cfg = loadConfig(sc);
    let queryPr;
    if (advancePr) {
      const tool = cfg && cfg.pr_tool;
      if (tool && tool !== 'none') {
        queryPr = (prNumber) => queryPrState(tool, String(prNumber), { cwd });
      }
    }
    // A relative config worktree_dir must resolve against the repo root (where
    // .speccode lives), never the process cwd — isPathInside would otherwise
    // anchor it wherever the CLI happened to be launched from.
    const res = reconcile(sc, {
      cwd,
      worktreeDir: cfg?.worktree_dir
        ? isAbsolute(cfg.worktree_dir) ? cfg.worktree_dir : resolve(dirname(sc), cfg.worktree_dir)
        : undefined,
      queryPr,
    });
    return { ok: true, orphans: res.orphans, conflicts: res.conflicts, advanced: res.advanced,
      features: res.features };
  },

  'read-config': ({ cwd }) => ({ ok: true, config: loadConfig(speccodeDirOf(cwd)) }),

  'write-config': ({ cwd, 'json-stdin': jsonStdin, payload }) => {
    if (!jsonStdin) return { ok: false, error: 'write-config requires --json-stdin (pipe JSON via stdin)' };
    const cfg = payload;
    if ('language' in cfg && validateLanguage(cfg.language) === null) {
      return { ok: false, error: `invalid language tag: ${JSON.stringify(cfg.language)}` };
    }
    saveConfig(speccodeDirOf(cwd), cfg);
    return { ok: true };
  },

  'backup-config': ({ cwd }) => ({ ok: true, path: backupConfig(speccodeDirOf(cwd)) }),

  'write-state': ({ cwd, branch, 'json-stdin': jsonStdin, payload }) => {
    if (!jsonStdin) return { ok: false, error: 'write-state requires --json-stdin (pipe JSON via stdin)' };
    writeState(speccodeDirOf(cwd), branch, payload);
    return { ok: true };
  },

  'delete-state': ({ cwd, branch }) => {
    deleteState(speccodeDirOf(cwd), branch);
    return { ok: true };
  },

  // Read-only shape lint over config + every state entry (both dirs). Reports
  // drift; fixing stays with the user-confirmed flows (idempotent init diff,
  // reset) — lint never mutates anything. lintStateEntries is deliberately
  // tolerant: a hand-mangled file is described, never a crash.
  'lint-state': ({ cwd }) => {
    const sd = speccodeDirOf(cwd);
    return { ok: true, config: { warnings: validateConfigShape(loadConfig(sd)) }, states: lintStateEntries(sd) };
  },

  'feature-progress': ({ cwd, branch }) => {
    const st = readState(speccodeDirOf(cwd), branch);
    if (!st) return { ok: false, error: `no state for ${branch}` };
    // v3: one branch IS one unit (branch ↔ worktree 1:1, design D3).
    return { ok: true, total: 1,
      completed: st.status === WORKTREE_STATUS.COMPLETED ? 1 : 0,
      worktree: st.worktree ?? null };
  },

  // Resolve against the main repo root (same --git-common-dir invariant as the
  // other verbs) so .mcp.json / project dirs are found from subdirs and
  // linked worktrees too. Host-neutral (host-neutral-engine): full probes on
  // every host; unknown extra config keys are ignored.
  'detect-code-intel-tools': ({ cwd }) => ({
    ok: true,
    tools: detectCodeIntelTools(repoRoot(cwd)),
  }),

  'resolve-worktree-dir': ({ cwd }) => {
    const cfg = loadConfig(speccodeDirOf(cwd));
    const { dir, source } = resolveWorktreeDir(cfg);
    return { ok: true, dir, source, ignore: worktreeDirIgnoreState(repoRoot(cwd), dir) };
  },

  'sdd-workspace': ({ cwd, plan }) => {
    if (!plan || plan === true) return { ok: false, error: 'sdd-workspace requires --plan <path>' };
    return { ok: true, dir: sddWorkspace(plan, cwd) };
  },

  'task-brief': ({ cwd, plan, task, out }) => {
    // Bare `--task` parses as `true` and Number(true) === 1 — without the
    // explicit checks it would silently produce Task 1's brief.
    if (!plan || plan === true || !task || task === true || !Number.isInteger(Number(task))) {
      return { ok: false, error: 'task-brief requires --plan <path> --task <N>' };
    }
    const path = taskBrief(plan, Number(task), cwd, out === true ? undefined : out);
    return { ok: true, path };
  },

  'review-package': ({ cwd, plan, base, head, out }) => {
    if (!plan || plan === true || !base || base === true || !head || head === true) {
      return { ok: false, error: 'review-package requires --plan <path> --base <sha> --head <sha>' };
    }
    const path = reviewPackage(plan, base, head, cwd, out === true ? undefined : out);
    return { ok: true, path };
  },

  'tick-task': ({ cwd, plan, task }) => {
    if (!plan || plan === true || !task || task === true || !Number.isInteger(Number(task))) {
      return { ok: false, error: 'tick-task requires --plan <path> --task <N>' };
    }
    const n = Number(task);
    const { ticked, already } = tickTask(plan, n);
    return { ok: true, plan, task: n, ticked, already };
  },

  'query-pr': ({ cwd, number }) => {
    if (!number) return { ok: false, error: 'query-pr requires --number <N>' };
    const cfg = loadConfig(speccodeDirOf(cwd));
    if (!cfg) return { ok: false, error: 'no .speccode/config.json; run /speccode:init first' };
    const tool = cfg.pr_tool;
    if (!tool || tool === 'none') return { ok: false, error: 'pr_tool is none; cannot query PR state' };
    return { ok: true, state: queryPrState(tool, String(number), { cwd }) };
  },

  // The only verb that always exits 0: hook failures are warn-only and must
  // never break the invoking command. All errors collapse into the hook field.
  'run-hook': ({ cwd, event, fragment, fragmentWarning }) => {
    try {
      if (!event || event === true) {
        return { ok: true, hook: { ran: false, ok: true, warning: 'run-hook called without --event' } };
      }
      const cfg = loadConfig(speccodeDirOf(cwd));
      // The caller fragment arrives pre-parsed from the front (CLI: stdin when
      // piped; MCP: the `fragment` argument). Anything that is not a plain
      // object degrades to {} — the envelope fields stay authoritative.
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

  'repo-merge-config': ({ cwd }) => {
    const cfg = loadConfig(speccodeDirOf(cwd));
    const tool = cfg?.pr_tool ?? 'none';
    const config = repoMergeConfig(tool, { cwd });
    return { ok: true, config, squashOnly: isSquashOnly(config) };
  },

  'read-memory': ({ cwd, branch }) => {
    if (!branch || branch === true) return { ok: false, error: 'read-memory requires --branch <F>' };
    if (!validateMemoryBranch(branch)) {
      return { ok: false, error: `invalid branch name: ${branch}` };
    }
    return { ok: true, memory: readMemory(speccodeDirOf(cwd), branch) };
  },

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

  'list-memory': ({ cwd }) => {
    // files + completed annotation: visibility for stale branch memories
    // (join lives here, not in memory.mjs — the lib stays state-free).
    const sd = speccodeDirOf(cwd);
    const statusByBranch = new Map();
    for (const f of listActiveFeatures(sd)) {
      if (typeof f?.branch === 'string') {
        statusByBranch.set(f.branch, f.status === WORKTREE_STATUS.COMPLETED);
      }
    }
    const files = listMemoryKeys(sd).map((branch) => ({
      branch,
      completed: statusByBranch.has(branch) ? statusByBranch.get(branch) : null,
    }));
    return { ok: true, topics: listMemory(sd), files };
  },

  'purge-memory': ({ cwd, branch }) => {
    // Flag form (no payload → no --json-stdin), mirroring delete-state.
    if (!branch || branch === true) return { ok: false, error: 'purge-memory requires --branch <F>' };
    if (!validateMemoryBranch(branch)) return { ok: false, error: `invalid branch name: ${branch}` };
    const { purged, path } = purgeMemory(speccodeDirOf(cwd), branch);
    return { ok: true, purged, path };
  },

  'rename-memory': ({ cwd, branch, to, 'json-stdin': jsonStdin }) => {
    if (!jsonStdin) return { ok: false, error: 'rename-memory requires --json-stdin (pipe JSON via stdin)' };
    if (!branch || branch === true) return { ok: false, error: 'rename-memory requires --branch <from>' };
    if (!to || to === true) return { ok: false, error: 'rename-memory requires --to <to>' };
    try {
      const path = renameMemory(speccodeDirOf(cwd), branch, to);
      return { ok: true, from: branch, to, path };
    } catch (err) {
      return { ok: false, error: String(err?.message || err) };
    }
  },

  'read-knowledge': ({ cwd, index, topic, blocks }) => {
    const root = knowledgeRoot(cwd);
    if (index) {
      const p = join(root, '_index.md');
      return existsSync(p)
        ? { ok: true, exists: true, path: '_index.md', content: readFileSync(p, 'utf8') }
        : { ok: true, exists: false, path: '_index.md', content: null };
    }
    if (topic === true) return { ok: false, error: '--topic requires a value' };
    if (topic) {
      const want = topic.endsWith('.md') ? topic : `${topic}.md`;
      const { files } = listTopics(root);
      const match = files.find((f) => f === want || f.endsWith(`/${want}`));
      if (!match) return { ok: true, exists: false, path: want, content: null };
      const content = readFileSync(join(root, match), 'utf8');
      if (blocks) return { ok: true, exists: true, path: match, blocks: parseDistilledBlocks(content) };
      return { ok: true, exists: true, path: match, content };
    }
    const { files, index: idx } = listTopics(root);
    return { ok: true, files, index: idx };
  },

  'read-consumed-archives': ({ cwd }) => {
    const kroot = knowledgeRoot(cwd);
    const aroot = archiveRoot(cwd);
    const consumed = readConsumedArchives(kroot);
    const present = listArchiveBundles(aroot);
    const unconsumed = unconsumedArchives(aroot, consumed);
    // `present` (盘上归档包全集) is the distiller's stale-detection source:
    // consumed ∖ present = bundles a carry-forward block still cites but that
    // no longer exist on disk. Not derivable from consumed/unconsumed alone.
    return { ok: true, consumed, present, unconsumed, bootstrap: !existsSync(distilledMetaPath(kroot)) };
  },

  'write-consumed-archives': ({ cwd, 'json-stdin': jsonStdin, payload }) => {
    if (jsonStdin === undefined) return { ok: false, error: 'write-consumed-archives requires --json-stdin' };
    const add = Array.isArray(payload?.add) ? payload.add : undefined;
    if (!add) return { ok: false, error: 'write-consumed-archives requires {add: [bundle,...]}' };
    const kroot = knowledgeRoot(cwd);
    const consumed = addConsumedArchives(kroot, add);
    return { ok: true, consumed };
  },

  'write-knowledge': ({ cwd, rel, 'json-stdin': jsonStdin, payload }) => {
    if (jsonStdin === undefined) return { ok: false, error: 'write-knowledge requires --json-stdin' };
    if (!rel) return { ok: false, error: 'write-knowledge requires --rel' };
    const safe = assertSafeRel(rel);
    if (!safe.ok) return { ok: false, error: safe.error };
    const root = knowledgeRoot(cwd);
    const target = join(root, safe.rel);
    const { mode, content, blocks, entries, heading } = payload;
    if (mode === 'replace') {
      writeKnowledge(root, safe.rel, String(content ?? ''));
      return { ok: true, path: safe.rel };
    }
    if (mode === 'replace-distilled') {
      if (!Array.isArray(blocks)) return { ok: false, error: 'mode replace-distilled requires blocks: [{source, body}]' };
      const existing = existsSync(target) ? readFileSync(target, 'utf8') : '';
      writeKnowledge(root, safe.rel, replaceDistilledBlocks(existing, blocks));
      return { ok: true, path: safe.rel };
    }
    if (mode === 'replace-hand') {
      if (typeof content !== 'string') return { ok: false, error: 'mode replace-hand requires content: string' };
      const existing = existsSync(target) ? readFileSync(target, 'utf8') : '';
      writeKnowledge(root, safe.rel, replaceHandBlocks(existing, content));
      return { ok: true, path: safe.rel };
    }
    if (mode === 'index') {
      if (!Array.isArray(entries)) return { ok: false, error: 'mode index requires entries: [{section, items: [{title, file, summary}]}]' };
      if (typeof heading !== 'string' || heading.trim() === '') return { ok: false, error: 'mode index requires heading' };
      writeKnowledge(root, safe.rel, buildIndex(entries, heading));
      return { ok: true, path: safe.rel };
    }
    return { ok: false, error: `unknown mode: ${mode}` };
  },
};

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
