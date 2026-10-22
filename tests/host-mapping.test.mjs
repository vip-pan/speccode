import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'references', 'host-mapping');
const HOSTS = ['codex', 'kimi-code', 'zcode', 'opencode', 'pi'];

test('each host doc has an MCP registration section with the standard shape', () => {
  for (const h of HOSTS) {
    const md = readFileSync(join(dir, `${h}.md`), 'utf8');
    assert.ok(md.includes('## MCP 注册'), `${h}.md lacks the MCP section`);
    for (const tok of ['npx -y -p speccode speccode-mcp', 'speccode-mcp', 'cwd', '正交', 'mcpServers']) {
      assert.ok(md.includes(tok), `${h}.md MCP section missing: ${tok}`);
    }
    assert.ok(md.includes('## 安装') && md.includes('## 工具映射') && md.includes('## 宿主注意'), `${h}.md four-section shape`);
  }
});

test('unverified forms are marked and open items listed', () => {
  for (const h of HOSTS) {
    const md = readFileSync(join(dir, `${h}.md`), 'utf8');
    assert.ok(/\*\*待验证\*\*/.test(md), `${h}.md lacks 待验证 marking`);
    assert.ok(md.includes('MCP 已知开放项'), `${h}.md lacks open-items list`);
    for (const item of ['-32002', 'origin/HEAD', '工具名']) assert.ok(md.includes(item), `${h}.md open item missing: ${item}`);
  }
});

test('README carries the MCP column, CC sample, and dual-channel step', () => {
  const md = readFileSync(join(dir, 'README.md'), 'utf8');
  assert.ok(md.includes('| MCP 注册 |'), 'overview table lacks MCP column');
  assert.ok(md.includes('claude mcp add speccode'), 'CC sample missing');
  assert.ok(/PATH 通道.*MCP 通道|MCP 通道.*PATH 通道/s.test(md), 'dual-channel step missing');
});

test('tool-mapping tables gain the MCP row', () => {
  for (const h of HOSTS) {
    const md = readFileSync(join(dir, `${h}.md`), 'utf8');
    assert.ok(md.includes('tools/call <verb>'), `${h}.md tool mapping lacks MCP row`);
  }
});

test('skills still never reference host-mapping', () => {
  const skillsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');
  for (const name of readdirSync(skillsDir)) {
    const md = readFileSync(join(skillsDir, name, 'SKILL.md'), 'utf8');
    assert.ok(!md.includes('host-mapping'), `skills/${name} references host-mapping`);
  }
});
