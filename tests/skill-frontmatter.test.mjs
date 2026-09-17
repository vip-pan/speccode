import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillsDir = join(repoRoot, 'skills');

// 与 ZCode 客户端同款简化解析:--- 包围的扁平 key: value 行,缩进行忽略
function parseFrontmatter(text) {
  const lines = text.split('\n');
  if (lines[0] !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end === -1) return null;
  const fm = Object.create(null);
  for (const line of lines.slice(1, end)) {
    if (!line.trim() || /^[ \t]/.test(line)) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^"(.*)"$/, '$1');
    fm[key] = value;
  }
  return fm;
}

const skills = readdirSync(skillsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

function frontmatterOf(name) {
  return parseFrontmatter(readFileSync(join(skillsDir, name, 'SKILL.md'), 'utf8'));
}

test('skills directory is non-empty', () => {
  assert.ok(skills.length > 0, 'no skill directories found under skills/');
});

test('every SKILL.md frontmatter carries name equal to its directory name', () => {
  assert.ok(skills.length > 0);
  for (const name of skills) {
    const fm = frontmatterOf(name);
    assert.ok(fm, `${name}: SKILL.md must open with --- frontmatter`);
    assert.equal(fm.name, name, `${name}: frontmatter name must equal the directory name`);
  }
});

test('every SKILL.md frontmatter carries a description within the 1024-char host limit', () => {
  assert.ok(skills.length > 0);
  for (const name of skills) {
    const fm = frontmatterOf(name);
    assert.ok(fm, `${name}: SKILL.md must open with --- frontmatter`);
    assert.ok(fm.description && fm.description.length > 0, `${name}: description required`);
    assert.ok(
      fm.description.length <= 1024,
      `${name}: description is ${fm.description.length} chars, exceeds the 1024 limit`,
    );
  }
});

test('no skill frontmatter carries commands-era nonstandard keys', () => {
  assert.ok(skills.length > 0);
  for (const name of skills) {
    const fm = frontmatterOf(name);
    assert.ok(fm, `${name}: SKILL.md must open with --- frontmatter`);
    assert.equal(fm.category, undefined, `${name}: category must not appear`);
    assert.equal(fm.tags, undefined, `${name}: tags must not appear`);
  }
});
