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
