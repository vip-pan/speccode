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
  // ZCode 文档口径为「1024 characters」——此处按字符(UTF-16 码元)计数忠实原意。
  // 若宿主实际按 UTF-8 字节解读,中文关键词尾部约 3x:当前最长 ~294 字符(≈330 字节),余量充足。
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

test('frontmatter key set is exactly {name, description}', () => {
  assert.ok(skills.length > 0);
  for (const name of skills) {
    const fm = frontmatterOf(name);
    assert.ok(fm, `${name}: SKILL.md must open with --- frontmatter`);
    assert.deepEqual(
      Object.keys(fm).sort(),
      ['description', 'name'],
      `${name}: only name and description are allowed — category/tags/when_to_use 等其余键一律拒绝`,
    );
  }
});

test('name line is unquoted, slug-charset, and placed before description', () => {
  assert.ok(skills.length > 0);
  for (const name of skills) {
    const lines = readFileSync(join(skillsDir, name, 'SKILL.md'), 'utf8').split('\n');
    assert.equal(lines[0], '---', `${name}: frontmatter must open with ---`);
    assert.match(lines[1], /^name: [a-z0-9-]+$/, `${name}: line 2 must be unquoted name:<slug>`);
    assert.ok(lines[2].startsWith('description:'), `${name}: description must directly follow name`);
  }
});
