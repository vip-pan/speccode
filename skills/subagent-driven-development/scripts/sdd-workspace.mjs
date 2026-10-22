#!/usr/bin/env node
// skills/subagent-driven-development/scripts/sdd-workspace.mjs
import { ok, run, parseArgs } from './cli-util.mjs';
import { sddWorkspace } from './sdd-plan.mjs';

run(() => {
  const { pos } = parseArgs(process.argv.slice(2), ['plan'], 'usage: sdd-workspace.mjs <PLAN_FILE>');
  ok({ dir: sddWorkspace(pos.plan, process.cwd()) });
});
