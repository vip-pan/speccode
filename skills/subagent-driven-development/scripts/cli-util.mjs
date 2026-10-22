// Minimal argv + output conventions shared by the executable companion
// scripts: positional args, --name/--name value flags, everything after `--`,
// and the one-line-JSON + exit-code contract (ok:true → 0, ok:false → 1).
export function parseArgs(argv, positionalNames, usage) {
  const dd = argv.indexOf('--');
  const head = dd === -1 ? argv : argv.slice(0, dd);
  const rest = dd === -1 ? [] : argv.slice(dd + 1);
  const pos = [];
  const named = {};
  for (let i = 0; i < head.length; i += 1) {
    const tok = head[i];
    if (tok.startsWith('--')) {
      const body = tok.slice(2);
      const eq = body.indexOf('=');
      if (eq !== -1) named[body.slice(0, eq)] = body.slice(eq + 1);
      else if (i + 1 < head.length && !head[i + 1].startsWith('--')) { named[body] = head[i + 1]; i += 1; }
      else named[body] = true;
    } else {
      pos.push(tok);
    }
  }
  if (pos.length !== positionalNames.length) throw new Error(usage);
  const out = {};
  positionalNames.forEach((name, idx) => { out[name] = pos[idx]; });
  return { pos: out, named, rest };
}

export function ok(fields = {}) {
  process.stdout.write(JSON.stringify({ ok: true, ...fields }) + '\n');
}

export function fail(error, exitCode = 1, fields = {}) {
  process.stdout.write(JSON.stringify({ ok: false, error, ...fields }) + '\n');
  process.exitCode = exitCode;
}

// Wrap a script main: any throw becomes {ok:false,error} + exit 1.
export function run(main) {
  try {
    main();
  } catch (err) {
    fail(String(err?.message || err));
  }
}
