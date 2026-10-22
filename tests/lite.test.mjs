import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');
const ANCHOR_HEAD = '> **引擎可用性(lite 探测)**';
// 含引擎调用的判定:正文出现 `speccode <verb>` 反引号调用形态(/speccode: 命令名引用不计)。
// `` `$(speccode <verb> …) `` 命令替换形态同样是引擎调用(如 test-driven-development
// 的 `$(speccode plugin-root --cwd .)/references/...` 兜底),与 plan 的复核 grep 口径一致。
const ENGINE_CALL = /`(?:\$\()?speccode [a-z][a-z-]+/;

function anchorBlock(md) {
  const i = md.indexOf(ANCHOR_HEAD);
  if (i === -1) return null;
  const lines = md.slice(i).split('\n');
  const block = [];
  for (const line of lines) {
    if (line.startsWith('>') || line.trim() === '') { block.push(line); if (line.trim() === '' ) break; }
    else break;
  }
  return block.join('\n').replace(/\n$/, '');
}

test('every engine-calling skill carries the lite anchor; zero-call skills do not', () => {
  const callers = [];
  const anchors = new Set();
  for (const name of readdirSync(skillsDir).sort()) {
    const md = readFileSync(join(skillsDir, name, 'SKILL.md'), 'utf8');
    const body = md.replace(/^---[\s\S]*?---\n/, '');
    const calls = ENGINE_CALL.test(body.replace(/\/speccode:[a-z-]+/g, ''));
    const anchor = anchorBlock(md);
    if (calls) {
      callers.push(name);
      assert.ok(anchor, `${name} calls the engine but lacks the lite anchor`);
      anchors.add(anchor);
      assert.equal(md.split(ANCHOR_HEAD).length, 2, `${name}: anchor head must appear exactly once`);
    }
    else assert.equal(anchor, null, `${name} has no engine calls but carries the anchor`);
  }
  assert.ok(callers.length >= 20, `expected ≥20 engine-calling skills, found ${callers.length}`);
  assert.equal(anchors.size, 1, `anchor blocks must be byte-identical across skills, found ${anchors.size} variants`);
});

test('anchor contains probe, degrade rows, and install guidance', () => {
  const anchor = anchorBlock(readFileSync(join(skillsDir, 'proposing', 'SKILL.md'), 'utf8'));
  for (const tok of ['command -v speccode', 'read-config', 'read-knowledge', 'read-memory', 'write-memory', 'write-config', 'plugin-root', 'default-branch', 'run-hook', 'reconcile', 'npm i -g speccode']) {
    assert.ok(anchor.includes(tok), `anchor missing: ${tok}`);
  }
  for (const banned of ['speccode.mjs <', 'CLAUDE_PLUGIN_ROOT', 'node plugins/']) {
    assert.ok(!anchor.includes(banned), `anchor contains banned form: ${banned}`);
  }
});
