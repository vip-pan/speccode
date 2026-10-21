#!/usr/bin/env node
// Close one task in a single call: run its verification command (test mode)
// or take a note (note mode), and — only on success — append the ledger
// completion line in ONE O_APPEND write. A failing command records nothing;
// its exit code passes through.
//
// usage: task-done.mjs <PLAN_FILE> <TASK_NUMBER> <BASE> (--note <text> | -- <test command…>)
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ok, fail, run, parseArgs } from './cli-util.mjs';
import { sddWorkspace, git } from './sdd-plan.mjs';

run(() => {
  const USAGE = 'usage: task-done.mjs <PLAN_FILE> <TASK_NUMBER> <BASE> (--note <text> | -- <test command…>)';
  const { pos, named, rest } = parseArgs(process.argv.slice(2), ['plan', 'task', 'base'], USAGE);
  const n = Number(pos.task);
  if (!Number.isInteger(n) || n < 1) throw new Error(`invalid task number: ${pos.task}`);
  const note = typeof named.note === 'string' ? named.note : undefined;
  if ((note !== undefined) === (rest.length > 0)) throw new Error(`choose exactly one mode (--note or -- <cmd>)\n${USAGE}`);
  git(['rev-parse', '--verify', '--quiet', pos.base], { cwd: process.cwd() }); // invalid base throws

  const cwd = process.cwd();
  const ws = sddWorkspace(pos.plan, cwd);
  const ledger = join(ws, 'progress.md');
  const short = (r) => git(['rev-parse', '--short=7', r], { cwd }).stdout.trim();

  let annotation;
  let log;
  if (note !== undefined) {
    annotation = note;
  } else {
    const [cmd, ...args] = rest;
    log = join(ws, `task-${n}-tests.log`);
    const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
    const rc = r.status ?? 1;
    const output = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    writeFileSync(log, output);
    if (rc !== 0) {
      fail(`test command exited ${rc}; Task ${n} NOT recorded`, rc, { log, exitCode: rc });
      return;
    }
    const lines = output.split('\n').filter((l) => l.trim() !== '');
    const last = lines.length ? lines[lines.length - 1] : '(no output)';
    annotation = `tests: ${rest.join(' ')} → ${last}`;
  }
  const line = `Task ${n}: complete (commits ${short(pos.base)}..${short('HEAD')}, ${annotation})`;
  // One append write: create with the identity header when absent; repair a
  // missing trailing newline (hand-appended lines) inside the same write.
  let prefix = '';
  if (existsSync(ledger)) {
    const existing = readFileSync(ledger, 'utf8');
    if (existing.length > 0 && !existing.endsWith('\n')) prefix = '\n';
  } else {
    prefix = `# SDD ledger — plan: ${pos.plan}\n`;
  }
  appendFileSync(ledger, `${prefix}${line}\n`);
  ok({ ledger, line, ...(log ? { log } : {}) });
});
