#!/usr/bin/env node
// skills/subagent-driven-development/scripts/tick-task.mjs
import { ok, run, parseArgs } from './cli-util.mjs';
import { tickTask } from './sdd-plan.mjs';

run(() => {
  const { pos } = parseArgs(process.argv.slice(2), ['plan', 'task'],
    'usage: tick-task.mjs <PLAN_FILE> <TASK_NUMBER>');
  const n = Number(pos.task);
  if (!Number.isInteger(n) || n < 1) throw new Error(`invalid task number: ${pos.task}`);
  const { ticked, already } = tickTask(pos.plan, n);
  ok({ plan: pos.plan, task: n, ticked, already });
});
