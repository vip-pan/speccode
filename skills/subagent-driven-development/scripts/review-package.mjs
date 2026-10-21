#!/usr/bin/env node
// skills/subagent-driven-development/scripts/review-package.mjs
import { ok, run, parseArgs } from './cli-util.mjs';
import { reviewPackage } from './sdd-plan.mjs';

run(() => {
  const { pos, named } = parseArgs(process.argv.slice(2), ['plan', 'base', 'head'],
    'usage: review-package.mjs <PLAN_FILE> <BASE_SHA> <HEAD_SHA> [--out PATH]');
  ok({ path: reviewPackage(pos.plan, pos.base, pos.head, process.cwd(), named.out === true ? undefined : named.out) });
});
