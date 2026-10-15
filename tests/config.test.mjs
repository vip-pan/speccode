import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configPath, loadConfig, saveConfig, backupConfig, diffFields, validateLanguage, validateConfigShape } from '../lib/config.mjs';

function tmp() { return mkdtempSync(join(tmpdir(), 'sc-cfg-')); }

test('save then load round-trips', () => {
  const dir = tmp();
  const cfg = { version: 1, trunk: 'master', remote: 'origin' };
  saveConfig(dir, cfg);
  assert.deepEqual(loadConfig(dir), cfg);
  rmSync(dir, { recursive: true, force: true });
});

test('loadConfig null when absent', () => {
  const dir = tmp();
  assert.equal(loadConfig(dir), null);
  rmSync(dir, { recursive: true, force: true });
});

test('backupConfig creates a .bak file and returns null when no config', () => {
  const dir = tmp();
  assert.equal(backupConfig(dir), null);
  saveConfig(dir, { version: 1 });
  const p = backupConfig(dir);
  assert.ok(p && existsSync(p));
  assert.ok(readdirSync(dir).some((f) => f.startsWith('config.json.bak.')));
  rmSync(dir, { recursive: true, force: true });
});

test('diffFields reports changed/added/removed top-level keys', () => {
  const d = diffFields(
    { trunk: 'master', pr_tool: 'gh', remote: 'origin' },
    { trunk: 'main', pr_tool: 'gh', display: { enabled: true } },
  );
  const byKey = Object.fromEntries(d.map((x) => [x.key, x]));
  assert.deepEqual(byKey.trunk, { key: 'trunk', old: 'master', new: 'main' });
  assert.ok('remote' in byKey && byKey.remote.new === undefined);
  assert.ok('display' in byKey && byKey.display.old === undefined);
  assert.ok(!('pr_tool' in byKey)); // unchanged omitted
});

test('validateLanguage accepts BCP-47 tags and normalizes case', () => {
  assert.equal(validateLanguage('zh'), 'zh');
  assert.equal(validateLanguage('en'), 'en');
  assert.equal(validateLanguage('zh-CN'), 'zh-cn');
  assert.equal(validateLanguage('ja'), 'ja');
  assert.equal(validateLanguage('en-US'), 'en-us');
});

test('validateLanguage rejects malformed values', () => {
  assert.equal(validateLanguage(''), null);
  assert.equal(validateLanguage('not a tag!'), null);
  assert.equal(validateLanguage('not_a_tag'), null);
  assert.equal(validateLanguage('中文'), null);
  assert.equal(validateLanguage('z'), null);       // 主子标签不足 2 段
  assert.equal(validateLanguage('fren'), null);    // 主子标签超 3 段
  assert.equal(validateLanguage('zh-'), null);     // 尾连字符
  assert.equal(validateLanguage('zh--cn'), null);  // 双连字符
  assert.equal(validateLanguage('zh_CN'), null);   // 下划线
  assert.equal(validateLanguage(42), null);
  assert.equal(validateLanguage(null), null);
  assert.equal(validateLanguage(undefined), null);
});

test('backupConfig rotates: keeps only the newest 5 config.json.bak.* files', () => {
  const dir = tmp();
  saveConfig(dir, { version: 3, trunk: 'main' });
  for (let i = 1; i <= 5; i += 1) {
    writeFileSync(`${configPath(dir)}.bak.2026-01-0${i}T00-00-00.000Z`, 'old');
  }
  const created = backupConfig(dir);
  assert.ok(created, 'new backup created');
  const baks = readdirSync(dir).filter((f) => f.startsWith('config.json.bak.')).sort();
  assert.equal(baks.length, 5, '6 份 → 仅保留最新 5 份');
  assert.ok(!baks.includes('config.json.bak.2026-01-01T00-00-00.000Z'), '最旧一份被轮转删除');
  assert.ok(baks.includes('config.json.bak.2026-01-02T00-00-00.000Z'), '次新全部保留');
  rmSync(dir, { recursive: true, force: true });
});

test('backupConfig rotation leaves other files and under-window backups alone', () => {
  const dir = tmp();
  saveConfig(dir, { version: 3, trunk: 'main' });
  writeFileSync(`${configPath(dir)}.bak.2026-01-01T00-00-00.000Z`, 'old');
  writeFileSync(`${configPath(dir)}.bak.2026-01-02T00-00-00.000Z`, 'old');
  writeFileSync(join(dir, 'unrelated.bak.2026-01-01T00-00-00.000Z'), 'keep');
  backupConfig(dir);
  const names = readdirSync(dir);
  assert.ok(names.includes('unrelated.bak.2026-01-01T00-00-00.000Z'), '非 config.json.bak. 前缀绝不触碰');
  assert.equal(names.filter((f) => f.startsWith('config.json.bak.')).length, 3, '窗口内只增不删');
  rmSync(dir, { recursive: true, force: true });
});

test('validateConfigShape: clean pass + warning surface', () => {
  assert.deepEqual(
    validateConfigShape({ version: 3, trunk: 'main', remote: 'origin', pr_tool: 'gh', worktree_dir: '.wt', code_intel_tools: [] }),
    []);
  assert.deepEqual(validateConfigShape(null), []);
  const w = validateConfigShape({
    version: 2, trunk: 1, remote: 'origin', pr_tool: 'baz', worktree_dir: '.wt',
    code_intel_tools: 'no', host: 'zcode', worktree_prefix: 'wt-', display: {},
    hooks: { onPrOpened: 5 }, language: 7,
  }).join('\n');
  for (const needle of ['version', 'trunk', 'pr_tool', 'code_intel_tools', 'host', 'worktree_prefix', 'display', 'hooks', 'language']) {
    assert.ok(w.includes(needle), `warning should mention ${needle}`);
  }
});
