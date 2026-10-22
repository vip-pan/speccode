#!/usr/bin/env node
// MCP stdio front for the speccode engine: one JSON-RPC message per line in,
// one per line out. Nothing but protocol messages goes to stdout.
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from '../lib/mcp.mjs';
import { runVerb, readEngineVersion } from '../lib/verbs.mjs';

function main() {
  const server = createServer({ runVerb, engineVersion: readEngineVersion(), defaultCwd: process.cwd() });
  const dispatch = (line) => {
    const res = server.handleLine(line);
    if (res) process.stdout.write(JSON.stringify(res) + '\n');
  };
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      dispatch(line);
    }
  });
  // A final unterminated line is still a message. No process.exit afterwards:
  // pipe writes are asynchronous on some platforms and an early exit could
  // truncate the last response; the loop ends on its own once stdout drains.
  process.stdin.on('end', () => { if (buf.trim()) dispatch(buf); });
  process.stdin.on('error', (err) => { process.stderr.write(`speccode-mcp: stdin error: ${err.message}\n`); });
}

// Run only when this file is the process entry (real-path comparison keeps
// npm's `speccode-mcp` bin symlink working — see bin/speccode.mjs).
function isEntry() {
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isEntry()) main();
