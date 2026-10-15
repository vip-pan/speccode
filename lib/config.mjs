import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeJsonAtomic } from './atomic.mjs';
import { nowIso } from './timestamp.mjs';

export function configPath(speccodeDir) {
  return join(speccodeDir, 'config.json');
}

export function loadConfig(speccodeDir) {
  return readJson(configPath(speccodeDir));
}

export function saveConfig(speccodeDir, config) {
  writeJsonAtomic(configPath(speccodeDir), config);
}

export function backupConfig(speccodeDir) {
  const p = configPath(speccodeDir);
  if (!existsSync(p)) return null;
  const stamp = nowIso().replace(/:/g, '-');
  const dest = `${p}.bak.${stamp}`;
  copyFileSync(p, dest);
  return dest;
}

// Fields retired from config v3 (v1 trio + v2's worktree_prefix + host).
// Their presence is a warning, never a read error — idempotent init strips
// them via the field diff after user confirmation.
export const RETIRED_CONFIG_FIELDS = ['display', 'spec_tools', 'untracked_permanent', 'worktree_prefix', 'host'];

// Read-side shape lint for config. Warning strings only, never throws.
export function validateConfigShape(config) {
  if (!config || typeof config !== 'object') return [];
  const warnings = [];
  if (config.version !== 3) {
    warnings.push(`config version is ${config.version}, expected 3 (v1/v2 read-compat; idempotent init migrates)`);
  }
  for (const f of RETIRED_CONFIG_FIELDS) {
    if (f in config) warnings.push(`retired field present: ${f} (strip via idempotent init field diff)`);
  }
  if (config.pr_tool !== undefined && !['gh', 'glab', 'none'].includes(config.pr_tool)) {
    warnings.push(`invalid pr_tool: ${config.pr_tool} (allowed: gh, glab, none)`);
  }
  for (const f of ['trunk', 'remote', 'worktree_dir']) {
    if (config[f] !== undefined && typeof config[f] !== 'string') warnings.push(`${f} must be a string`);
  }
  if (config.code_intel_tools !== undefined && !Array.isArray(config.code_intel_tools)) {
    warnings.push('code_intel_tools must be an array');
  }
  if (config.hooks !== undefined) {
    const badHooks = typeof config.hooks !== 'object' || config.hooks === null || Array.isArray(config.hooks)
      || Object.values(config.hooks).some((v) => typeof v !== 'string');
    if (badHooks) warnings.push('hooks must be a map of event name → shell command string');
  }
  if (config.language !== undefined && typeof config.language !== 'string') {
    warnings.push('language must be a string (BCP-47 tag)');
  }
  return warnings;
}

export function diffFields(oldCfg, newCfg) {
  const keys = new Set([...Object.keys(oldCfg || {}), ...Object.keys(newCfg || {})]);
  const out = [];
  for (const key of keys) {
    const o = (oldCfg || {})[key];
    const n = (newCfg || {})[key];
    if (JSON.stringify(o) !== JSON.stringify(n)) {
      out.push({ key, old: o, new: n });
    }
  }
  return out;
}

// BCP-47 language tag: 2-3 letter primary subtag (case-insensitive, normalized
// to lowercase) plus optional hyphen-separated subtags (2-8 alphanumerics
// each). Returns the normalized tag, or null for anything malformed.
// 语言中立:合法性与归一化在此止步,lib 不含任何具体语言文本。
export function validateLanguage(value) {
  if (typeof value !== 'string') return null;
  const tag = value.toLowerCase();
  return /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/.test(tag) ? tag : null;
}
