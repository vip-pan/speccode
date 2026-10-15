import { readdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeJsonAtomic } from './atomic.mjs';
import { branchToStateName, stateNameToBranch, TYPES } from './slug.mjs';

export const WORKTREE_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  PR_OPEN: 'pr_open',
  COMPLETED: 'completed',
};

export function branchesDir(speccodeDir) {
  return join(speccodeDir, 'state', 'branches');
}

function stateFilePathIn(dir, branch) {
  return join(dir, `${branchToStateName(branch)}.json`);
}

export function readState(speccodeDir, branch) {
  return readJson(stateFilePathIn(branchesDir(speccodeDir), branch));
}

const ISO_8601_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const STATUS_VALUES = Object.values(WORKTREE_STATUS);
const V3_COMMON_KEYS = ['branch', 'status', 'created_at', 'initial_branch', 'completed_at', 'pr_number', 'note', 'pending_operation'];
const V3_NORMAL_EXTRA_KEYS = ['type', 'worktree', 'merge_target'];
const V3_PARENT_EXTRA_KEYS = ['kind', 'children'];

// Read-side shape lint for a single state entry. Produces warning strings,
// never throws — any on-disk data can be described.
export function validateStateShape(state) {
  if (!state || typeof state !== 'object') return ['state entry is not an object'];
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
  } else if (state.worktree !== undefined && typeof state.worktree !== 'string') {
    warnings.push('worktree must be a string');
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
// (partial read-modify-write payloads are legal).
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
  if (state && typeof state === 'object') {
    const fatal = fatalStateErrors(branch, state);
    if (fatal.length) throw new Error(`write-state rejected: ${fatal.join('; ')}`);
  }
  writeJsonAtomic(stateFilePathIn(branchesDir(speccodeDir), branch), state);
}

export function deleteState(speccodeDir, branch) {
  const p = stateFilePathIn(branchesDir(speccodeDir), branch);
  if (existsSync(p)) rmSync(p);
}

function readDirStates(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson(join(dir, f)))
    .filter((s) => s !== null);
}

export function listActiveFeatures(speccodeDir) {
  return readDirStates(branchesDir(speccodeDir));
}

// Tolerant lint enumeration: unlike listActiveFeatures, a hand-mangled file is
// described (unparseable-JSON warning with the filename-stem branch key)
// instead of crashing the linter — lint must never become its own failure
// point. Read-only; never used by write paths.
export function lintStateEntries(speccodeDir) {
  const dir = branchesDir(speccodeDir);
  const out = [];
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const stem = f.slice(0, -'.json'.length);
    let raw;
    try {
      raw = readJson(join(dir, f));
    } catch (err) {
      out.push({ branch: stateNameToBranch(stem), warnings: [`unparseable JSON: ${String(err?.message || err)}`] });
      continue;
    }
    if (raw === null) continue;
    out.push({ branch: raw?.branch ?? stateNameToBranch(stem), warnings: validateStateShape(raw) });
  }
  return out;
}
