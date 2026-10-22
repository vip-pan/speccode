import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { makeRepo, commitFile } from './helpers/tmprepo.mjs';

const SCRIPTS = fileURLToPath(new URL('../skills/subagent-driven-development/scripts/', import.meta.url));
const sh = (name, args, opts = {}) => {
  const r = spawnSync('node', [join(SCRIPTS, name), ...args], { encoding: 'utf8', ...opts });
  return { code: r.status, json: r.stdout.trim() ? JSON.parse(r.stdout.trim()) : null };
};
const PLAN_MD = [
  '# p Implementation Plan', '', '## Global Constraints', '', '- zero deps', '',
  '### Task 1: first', '', 'step a', '', '- [ ] s1', '',
  '```js', '### Task 99: inside fence', '- [ ] fenced', '```', '',
  '### Task 10: tenth', '', '- [ ] s10', '',
  '## 收尾', '', '- [ ] tail', '',
].join('\n');
const writePlan = (repo, name = 'p.md') => {
  const p = join(repo, name);
  writeFileSync(p, PLAN_MD);
  return p;
};

test('sdd-workspace.mjs creates isolated, self-ignored workspaces', () => {
  const repo = realpathSync(makeRepo());
  const p1 = writePlan(repo, 'one.md');
  const p2 = writePlan(repo, 'two.md');
  const r1 = sh('sdd-workspace.mjs', [p1], { cwd: repo });
  const r2 = sh('sdd-workspace.mjs', [p2], { cwd: repo });
  assert.equal(r1.code, 0);
  assert.notEqual(r1.json.dir, r2.json.dir);
  assert.ok(r1.json.dir.startsWith(join(repo, '.speccode', 'sdd')));
  assert.equal(readFileSync(join(repo, '.speccode', 'sdd', '.gitignore'), 'utf8'), '*\n');
  assert.equal(sh('sdd-workspace.mjs', [join(repo, 'nope.md')], { cwd: repo }).code, 1);
  rmSync(repo, { recursive: true, force: true });
});

test('sdd-workspace.mjs inside a linked worktree resolves to the worktree root', () => {
  const repo = realpathSync(makeRepo());
  spawnSync('git', ['worktree', 'add', join(repo, 'wt2'), '-b', 'wt2'], { cwd: repo });
  const p = writePlan(join(repo, 'wt2'));
  const r = sh('sdd-workspace.mjs', [p], { cwd: join(repo, 'wt2') });
  assert.equal(r.code, 0);
  assert.ok(r.json.dir.startsWith(join(repo, 'wt2', '.speccode', 'sdd')));
  rmSync(repo, { recursive: true, force: true });
});

test('task-brief.mjs extracts task N exactly (1 ≠ 10, fenced heading ignored)', () => {
  const repo = realpathSync(makeRepo());
  const p = writePlan(repo);
  const r = sh('task-brief.mjs', [p, '1'], { cwd: repo });
  assert.equal(r.code, 0);
  const brief = readFileSync(r.json.path, 'utf8');
  assert.ok(brief.includes('step a'));
  // 'Task 10', not 'Task 99': a brief deliberately quotes the fenced lines of
  // its own section (locked by tests/sdd.test.mjs "fence 内行保留在任务体"), so
  // the literal 'Task 99' inside Task 1's fence IS in the brief. The "fenced
  // heading ignored" intent is covered by the `p 99` → exit 1 assertion below.
  assert.ok(!brief.includes('s10') && !brief.includes('Task 10'));
  assert.ok(r.json.path.startsWith(join(repo, '.speccode', 'sdd', 'p')));
  const out = sh('task-brief.mjs', [p, '10', '--out', join(repo, 'b10.md')], { cwd: repo });
  // Task 10's section is heading + its own checkbox (`- [ ] s10` is task 10's
  // step per the tick-test below; a section ends at the next heading).
  assert.equal(readFileSync(join(repo, 'b10.md'), 'utf8').trim(), '### Task 10: tenth\n\n- [ ] s10');
  assert.equal(out.json.path, join(repo, 'b10.md'));
  assert.equal(sh('task-brief.mjs', [p, '99'], { cwd: repo }).code, 1);
  rmSync(repo, { recursive: true, force: true });
});

test('tick-task.mjs is fence-aware and idempotent', () => {
  const repo = realpathSync(makeRepo());
  const p = writePlan(repo);
  const before = readFileSync(p, 'utf8');
  const r1 = sh('tick-task.mjs', [p, '1'], { cwd: repo });
  assert.equal(r1.code, 0);
  assert.deepEqual(r1.json.ticked, ['- [ ] s1']);
  const after1 = readFileSync(p, 'utf8');
  assert.ok(after1.includes('- [x] s1'));
  assert.ok(!after1.includes('[x] fenced') && !after1.includes('[x] tail') && !after1.includes('[x] s10'));
  const r2 = sh('tick-task.mjs', [p, '1'], { cwd: repo });
  assert.deepEqual(r2.json.ticked, []);
  assert.deepEqual(r2.json.already, ['- [x] s1']);
  assert.equal(readFileSync(p, 'utf8'), after1); // byte-identical
  const r99 = sh('tick-task.mjs', [p, '99'], { cwd: repo });
  assert.equal(r99.code, 1);
  assert.equal(readFileSync(p, 'utf8'), after1);
  assert.equal(before.includes('[x]'), false);
  rmSync(repo, { recursive: true, force: true });
});

test('review-package.mjs names the file by range and packs commits/stat/diff', () => {
  const repo = realpathSync(makeRepo());
  commitFile(repo, 'a.txt', 'a', 'a');
  const base = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
  commitFile(repo, 'b.txt', 'b', 'b');
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
  const p = writePlan(repo);
  const r = sh('review-package.mjs', [p, base, head], { cwd: repo });
  assert.equal(r.code, 0);
  const name = `review-${base.slice(0, 7)}..${head.slice(0, 7)}.diff`;
  assert.ok(r.json.path.endsWith(name));
  const body = readFileSync(r.json.path, 'utf8');
  assert.ok(body.includes('## Commits') && body.includes('## Files changed') && body.includes('## Diff'));
  assert.equal(sh('review-package.mjs', [p, 'deadbeef', head], { cwd: repo }).code, 1);
  rmSync(repo, { recursive: true, force: true });
});

test('companion scripts: shebang, exec bit, no lib imports', () => {
  for (const f of readdirSync(SCRIPTS).filter((f) => f.endsWith('.mjs'))) {
    const p = join(SCRIPTS, f);
    const src = readFileSync(p, 'utf8');
    if (f === 'sdd-plan.mjs' || f === 'cli-util.mjs') {
      // shared modules: no shebang/exec requirement, same import rule
    } else {
      assert.equal(src.split('\n')[0], '#!/usr/bin/env node', `${f} shebang`);
      assert.ok(statSync(p).mode & 0o111, `${f} executable`);
    }
    for (const m of src.matchAll(/from\s+'([^']+)'/g)) {
      assert.ok(m[1].startsWith('node:') || m[1].startsWith('./'),
        `${f} imports ${m[1]} — only node: and ./ are allowed`);
    }
  }
});

test('task-start.mjs returns the brief path and HEAD base in one call', () => {
  const repo = makeRepo();
  const p = writePlan(repo);
  const r = sh('task-start.mjs', [p, '1'], { cwd: repo });
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
  assert.equal(r.code, 0);
  assert.ok(existsSync(r.json.brief));
  assert.ok(r.json.brief.endsWith('task-1-brief.md'));
  assert.equal(r.json.base, head);
  rmSync(repo, { recursive: true, force: true });
});

test('task-done.mjs test mode records the line only on success', () => {
  const repo = makeRepo();
  const p = writePlan(repo);
  const start = sh('task-start.mjs', [p, '1'], { cwd: repo });
  commitFile(repo, 'c.txt', 'c', 'c');
  const bad = sh('task-done.mjs', [p, '1', start.json.base, '--', 'node', '-e', 'process.exit(3)'], { cwd: repo });
  assert.equal(bad.code, 3);
  assert.equal(bad.json.ok, false);
  assert.equal(bad.json.exitCode, 3);
  const ws = join(repo, '.speccode', 'sdd', 'p');
  assert.equal(existsSync(join(ws, 'progress.md')), false, 'failure must not create the ledger');
  assert.ok(existsSync(join(ws, 'task-1-tests.log')));
  const good = sh('task-done.mjs', [p, '1', start.json.base, '--', 'node', '-e', 'console.log("1/1 pass")'], { cwd: repo });
  assert.equal(good.code, 0);
  const ledger = readFileSync(good.json.ledger, 'utf8');
  assert.ok(ledger.startsWith('# SDD ledger — plan: '));
  assert.ok(ledger.includes(`Task 1: complete (commits ${start.json.base.slice(0, 7)}..`));
  assert.ok(ledger.includes('tests: node -e console.log("1/1 pass") → 1/1 pass'));
  rmSync(repo, { recursive: true, force: true });
});

test('task-done.mjs note mode writes the note verbatim without running anything', () => {
  const repo = makeRepo();
  const p = writePlan(repo);
  const start = sh('task-start.mjs', [p, '1'], { cwd: repo });
  const r = sh('task-done.mjs', [p, '1', start.json.base, '--note', 'review clean'], { cwd: repo });
  assert.equal(r.code, 0);
  assert.match(r.json.line, /, review clean\)$/);
  assert.equal(r.json.log, undefined);
  assert.equal(existsSync(join(repo, '.speccode', 'sdd', 'p', 'task-1-tests.log')), false);
  rmSync(repo, { recursive: true, force: true });
});

test('task-done.mjs two tasks append without glue; rejects bad base and bad modes', () => {
  const repo = makeRepo();
  const p = writePlan(repo);
  const b1 = sh('task-start.mjs', [p, '1'], { cwd: repo });
  sh('task-done.mjs', [p, '1', b1.json.base, '--note', 'review clean'], { cwd: repo });
  const b2 = sh('task-start.mjs', [p, '10'], { cwd: repo });
  sh('task-done.mjs', [p, '10', b2.json.base, '--note', '2 parked'], { cwd: repo });
  const lines = readFileSync(join(repo, '.speccode', 'sdd', 'p', 'progress.md'), 'utf8').split('\n').filter(Boolean);
  assert.equal(lines.length, 3); // identity + 2 completions, no blank-line glue
  assert.ok(lines[2].startsWith(`Task 10: complete (commits ${b2.json.base.slice(0, 7)}..`) && lines[2].endsWith(', 2 parked)'), lines[2]);
  assert.equal(sh('task-done.mjs', [p, '1', 'deadbeef', '--note', 'x'], { cwd: repo }).code, 1);
  assert.equal(sh('task-done.mjs', [p, '1', b1.json.base], { cwd: repo }).code, 1); // no mode
  assert.equal(sh('task-done.mjs', [p, '1', b1.json.base, '--note', 'x', '--', 'node', '-v'], { cwd: repo }).code, 1); // both modes
  rmSync(repo, { recursive: true, force: true });
});

const SKILL_DIR = fileURLToPath(new URL('../skills/', import.meta.url));

test('skills and references invoke SDD machinery via companion scripts, not verbs', () => {
  const files = [
    'subagent-driven-development/SKILL.md', 'executing-plans/SKILL.md',
    '../references/task-reviewer-prompt.md', '../references/re-review-prompt.md',
  ];
  for (const rel of files) {
    const md = readFileSync(join(SKILL_DIR, rel), 'utf8');
    assert.ok(!/speccode (sdd-workspace|task-brief|review-package|tick-task)/.test(md), `${rel} still calls SDD verbs`);
  }
});

test('every <scripts>/x.mjs referenced by the SDD skills exists', () => {
  for (const rel of ['subagent-driven-development/SKILL.md', 'executing-plans/SKILL.md']) {
    const md = readFileSync(join(SKILL_DIR, rel), 'utf8');
    assert.ok(md.includes('<scripts>'), `${rel} must define the anchor once`);
    for (const m of md.matchAll(/<scripts>\/([a-z-]+\.mjs)/g)) {
      assert.ok(existsSync(join(SCRIPTS, m[1])), `${m[1]} referenced in ${rel} does not exist`);
    }
  }
});
