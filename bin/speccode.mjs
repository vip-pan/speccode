#!/usr/bin/env node
// CLI front for the speccode engine: parse argv, inject whatever the verb
// declares it needs from stdin, run the shared verb table, print one JSON line.
import { readFileSync, realpathSync } from 'node:fs';
import { isatty } from 'node:tty';
import { fileURLToPath } from 'node:url';
import { runVerb, STDIN_MODE } from '../lib/verbs.mjs';

export function parseArgs(argv) {
  const [verb, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const tok = rest[i];
    if (!tok.startsWith('--')) continue;
    const body = tok.slice(2);
    const eq = body.indexOf('=');
    if (eq !== -1) {
      flags[body.slice(0, eq)] = body.slice(eq + 1);
    } else if (i + 1 < rest.length && !rest[i + 1].startsWith('--')) {
      flags[body] = rest[i + 1];
      i += 1;
    } else {
      flags[body] = true;
    }
  }
  return { verb, flags };
}

function readStdin() {
  return readFileSync(0, 'utf8');
}

// Inject stdin-borne data per the verb's declared mode. Returns an early error
// result (payload mode, unparsable JSON) or null to proceed. 'payload' only
// reads when --json-stdin is present so a missing flag never blocks on stdin.
function injectStdin(verb, flags) {
  const mode = STDIN_MODE[verb];
  if (mode === 'payload') {
    if (!flags['json-stdin']) return null;
    try {
      flags.payload = JSON.parse(readStdin());
    } catch {
      return { ok: false, error: 'invalid JSON on stdin' };
    }
  } else if (mode === 'fragment' && !isatty(0)) {
    // isatty(0) is a side-effect-free syscall. Probing process.stdin.isTTY
    // instead would put fd 0 into non-blocking mode, and readFileSync(0)
    // could then throw EAGAIN before a slow producer fills the pipe,
    // silently dropping the fragment.
    try {
      const raw = readStdin();
      flags.fragment = raw.trim() ? JSON.parse(raw) : {};
    } catch (err) {
      flags.fragment = {};
      flags.fragmentWarning = `stdin fragment ignored: ${err?.message || err}`;
    }
  }
  return null;
}

function main() {
  const { verb, flags } = parseArgs(process.argv.slice(2));
  const early = Object.prototype.hasOwnProperty.call(STDIN_MODE, verb) ? injectStdin(verb, flags) : null;
  const result = early ?? runVerb(verb, flags);
  if (result.ok === false) process.exitCode = 1;
  process.stdout.write(JSON.stringify(result) + '\n');
}

// Run only when this file is the process entry. Compare real paths: npm's bin
// symlink is named `speccode` (no .mjs), so a suffix check on argv[1] would
// silently skip main() for every `npm i -g speccode` user.
function isEntry() {
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isEntry()) main();
