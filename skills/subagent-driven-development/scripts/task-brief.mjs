#!/usr/bin/env node
// skills/subagent-driven-development/scripts/task-brief.mjs
import { ok, run, parseArgs } from './cli-util.mjs';
import { taskBrief } from './sdd-plan.mjs';

run(() => {
  const { pos, named } = parseArgs(process.argv.slice(2), ['plan', 'task'],
    'usage: task-brief.mjs <PLAN_FILE> <TASK_NUMBER> [--out PATH]');
  const n = Number(pos.task);
  if (!Number.isInteger(n) || n < 1) throw new Error(`invalid task number: ${pos.task}`);
  ok({ path: taskBrief(pos.plan, n, process.cwd(), named.out === true ? undefined : named.out) });
});
