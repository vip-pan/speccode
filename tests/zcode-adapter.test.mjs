import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readJson(rel) {
  return JSON.parse(readFileSync(join(repoRoot, rel), 'utf8'));
}

test('.zcode-plugin manifest key set matches the official ZCode plugin shape', () => {
  const manifest = readJson('.zcode-plugin/plugin.json');
  assert.deepEqual(
    Object.keys(manifest).sort(),
    ['author', 'description', 'license', 'name', 'skills', 'version'],
    '.zcode-plugin/plugin.json must carry exactly the official key set '
    + '(name/version/description/author/license/skills) — skillInstructions is a '
    + 'Kimi-only field ZCode does not recognize',
  );
});

test('.zcode-plugin manifest version stays in sync with the Claude Code manifest', () => {
  const zcode = readJson('.zcode-plugin/plugin.json');
  const claude = readJson('.claude-plugin/plugin.json');
  assert.ok(/^\d+\.\d+\.\d+$/.test(zcode.version ?? ''), 'zcode manifest version must be semver');
  assert.equal(zcode.version, claude.version, 'both manifests must bump together at release');
});

test('.zcode-plugin skills field uses the official directory-name form', () => {
  const manifest = readJson('.zcode-plugin/plugin.json');
  assert.equal(manifest.skills, 'skills', 'official plugins use the bare directory name');
});

test('version triple-sync: package.json == .claude-plugin == .zcode-plugin', () => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  const cc = JSON.parse(readFileSync(join(repoRoot, '.claude-plugin', 'plugin.json'), 'utf8'));
  const zc = JSON.parse(readFileSync(join(repoRoot, '.zcode-plugin', 'plugin.json'), 'utf8'));
  assert.ok(/^\d+\.\d+\.\d+$/.test(pkg.version), 'package.json version 必须为 x.y.z 形态');
  assert.equal(pkg.version, cc.version, 'package.json 与 .claude-plugin 版本必须一致');
  assert.equal(pkg.version, zc.version, 'package.json 与 .zcode-plugin 版本必须一致');
});

test('npm metadata shape: bin exposes both engine fronts, files whitelist, zero deps', () => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.bin?.speccode, 'bin/speccode.mjs');
  assert.equal(pkg.bin?.['speccode-mcp'], 'bin/speccode-mcp.mjs');
  assert.deepEqual([...pkg.files].sort(), ['bin', 'hooks', 'lib', 'references', 'skills']);
  assert.equal(pkg.dependencies, undefined, '零第三方依赖不变量');
  assert.equal(pkg.type, 'module');
});
