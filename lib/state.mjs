import { readdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeJsonAtomic } from './atomic.mjs';
import { branchToStateName, TYPES } from './slug.mjs';

export const WORKTREE_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  PR_OPEN: 'pr_open',
  COMPLETED: 'completed',
};

const LEGACY_COMMAND_NAMES = {
  'develop-complete': 'finishing-worktree',
  finish: 'finishing-feature',
};

// Normalize legacy (v0.1) state shapes on read. waiting_display_pr is kept
// as-is: the command layer reports it as non-resumable (see finishing-feature.md).
export function normalizeState(state) {
  if (!state || typeof state !== 'object') return state;
  const po = state.pending_operation;
  if (po && typeof po === 'object' && Object.hasOwn(LEGACY_COMMAND_NAMES, po.command)) {
    return { ...state, pending_operation: { ...po, command: LEGACY_COMMAND_NAMES[po.command] } };
  }
  return state;
}

export function branchesDir(speccodeDir) {
  return join(speccodeDir, 'state', 'branches');
}

// v2 legacy location — kept for dual-format read/write compat only.
export function featuresDir(speccodeDir) {
  return join(speccodeDir, 'state', 'features');
}

function stateFilePathIn(dir, branch) {
  return join(dir, `${branchToStateName(branch)}.json`);
}

function readStateAt(dir, branch) {
  const raw = readJson(stateFilePathIn(dir, branch));
  return raw === null ? null : normalizeState(raw);
}

// Format follows the existing file: a v2-era file keeps v2 semantics in place
// (old flows keep working, no in-memory translation); new writes land in
// state/branches/ (v3).
export function readState(speccodeDir, branch) {
  return readStateAt(branchesDir(speccodeDir), branch)
    ?? readStateAt(featuresDir(speccodeDir), branch);
}

const ISO_8601_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const STATUS_VALUES = Object.values(WORKTREE_STATUS);
const V3_COMMON_KEYS = ['branch', 'status', 'created_at', 'initial_branch', 'completed_at', 'pr_number', 'note', 'pending_operation'];
const V3_NORMAL_EXTRA_KEYS = ['type', 'worktree', 'merge_target'];
const V3_PARENT_EXTRA_KEYS = ['kind', 'children'];

// Read-side shape lint for a single state entry. Produces warning strings,
// never throws — any on-disk data can be described. v2-legacy entries get a
// single migration hint instead of the v3 contract (migration owns that flow).
export function validateStateShape(state) {
  if (!state || typeof state !== 'object') return ['state entry is not an object'];
  if (typeof state.feature_branch === 'string') {
    return ['v2-legacy entry (state/features/ semantics): pending migration; v3 shape contract not applied'];
  }
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
  } else if (state.worktree !== undefined && state.worktree !== null && typeof state.worktree !== 'string') {
    warnings.push('worktree must be a string or null');
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
// (partial read-modify-write payloads are legal) and v2 payloads pass through
// untouched; migrateStateV2toV3 writes below this gate by design.
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
  if (state && typeof state === 'object' && typeof state.feature_branch !== 'string') {
    const fatal = fatalStateErrors(branch, state);
    if (fatal.length) throw new Error(`write-state rejected: ${fatal.join('; ')}`);
  }
  const v2Path = stateFilePathIn(featuresDir(speccodeDir), branch);
  const target = existsSync(v2Path) ? v2Path : stateFilePathIn(branchesDir(speccodeDir), branch);
  writeJsonAtomic(target, state);
}

export function deleteState(speccodeDir, branch) {
  for (const dir of [branchesDir(speccodeDir), featuresDir(speccodeDir)]) {
    const p = stateFilePathIn(dir, branch);
    if (existsSync(p)) rmSync(p);
  }
}

function readDirStates(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => normalizeState(readJson(join(dir, f))))
    .filter((s) => s !== null);
}

// v3 entries first, then untouched v2 entries (dual-format, no translation).
export function listActiveFeatures(speccodeDir) {
  return [
    ...readDirStates(branchesDir(speccodeDir)),
    ...readDirStates(featuresDir(speccodeDir)),
  ];
}

// One-time v2→v3 conversion for init. v2 features that still map >1 branch or
// are in flight cannot convert 1:1 onto per-branch v3 state — multi-worktree
// files and single-worktree files whose sole worktree is not completed are
// skipped (reported) and left in place for manual finishing under the v2 flow
// before upgrading. A v3 target file that already exists is likewise skipped so
// migration never clobbers newer v3 state. Converted branches have
// worktree: null (the v2 file never stored the path).
export function migrateStateV2toV3(speccodeDir) {
  const dir = featuresDir(speccodeDir);
  if (!existsSync(dir)) return { migrated: [], skipped: [] };
  const migrated = [];
  const skipped = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const raw = readJson(join(dir, f));
    const branch = raw && typeof raw === 'object' ? raw.feature_branch : undefined;
    const worktrees = raw && typeof raw === 'object' ? Object.entries(raw.worktrees || {}) : [];
    const inFlight =
      worktrees.length > 1 ||
      (worktrees.length === 1 && worktrees[0][1]?.status !== 'completed');
    const targetExists =
      typeof branch === 'string' &&
      existsSync(stateFilePathIn(branchesDir(speccodeDir), branch));
    if (typeof branch !== 'string' || !branch.includes('/') || inFlight || targetExists) {
      skipped.push(f);
      continue;
    }
    const v3 = {
      branch,
      type: branch.split('/')[0],
      worktree: null,
      status: raw.status ?? 'pending',
      created_at: raw.created_at,
      initial_branch: raw.initial_branch,
    };
    if (raw.pending_operation !== undefined) v3.pending_operation = raw.pending_operation;
    writeJsonAtomic(stateFilePathIn(branchesDir(speccodeDir), branch), v3);
    rmSync(join(dir, f));
    migrated.push(f);
  }
  return { migrated, skipped };
}
