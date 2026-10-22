#!/usr/bin/env node
// One call instead of two (every tool call is a turn that re-reads context):
// write the task brief and record BASE — the commit the task's review range
// and ledger line are cut from.
import { ok, run, parseArgs } from './cli-util.mjs';
import { taskBrief, git } from './sdd-plan.mjs';

run(() => {
  const { pos } = parseArgs(process.argv.slice(2), ['plan', 'task'],
    'usage: task-start.mjs <PLAN_FILE> <TASK_NUMBER>');
  const n = Number(pos.task);
  if (!Number.isInteger(n) || n < 1) throw new Error(`invalid task number: ${pos.task}`);
  const brief = taskBrief(pos.plan, n, process.cwd());
  const base = git(['rev-parse', 'HEAD'], { cwd: process.cwd() }).stdout.trim();
  ok({ brief, base });
});
