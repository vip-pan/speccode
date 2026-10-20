// MCP (Model Context Protocol) front for the engine: pure JSON-RPC 2.0 message
// handling over the shared verb table. No transport lives here —
// bin/speccode-mcp.mjs feeds lines in and writes responses out. Hand-rolled on
// purpose: the engine stays zero-dependency, and the protocol surface we need
// is five methods.
import { VERBS, STDIN_MODE } from './verbs.mjs';
import { CONTRACT_VERSION, MCP_PROTOCOL_VERSIONS } from './contract.mjs';

// plugin-root resolves to the engine package root, which is not the host
// plugin root once the engine ships through npm — misleading over MCP.
export const EXCLUDED_VERBS = ['plugin-root'];

const CWD = {
  type: 'string',
  description: 'Directory inside the target repository (any worktree). Defaults to the server process cwd.',
};
const BRANCH = { type: 'string', description: 'Branch key in <type>/<slug> form (type: feature|bugfix|refactor|chore).' };
const PLAN = { type: 'string', description: 'Path to the plan markdown file.' };
const TASK = { type: 'integer', minimum: 1, description: 'Task number within the plan (1-based).' };
const OUT = { type: 'string', description: 'Output path override.' };

function tool(description, properties = {}, required = []) {
  return { description, inputSchema: { type: 'object', properties: { cwd: CWD, ...properties }, required } };
}
const payloadOf = (description) => ({ type: 'object', description });

export const TOOL_META = {
  'resolve-speccode-dir': tool('Resolve the .speccode directory of the main repository (works from linked worktrees).'),
  'detect-remote': tool('Read the origin remote URL, guess the PR tool (gh/glab) and whether it is installed.'),
  reconcile: tool('Reconcile `git worktree list` with .speccode state: orphans, conflicts and active branches; optionally query the PR tool to advance pr_open entries.', {
    'advance-pr': { type: 'boolean', description: 'Query PR state and advance pr_open → completed (merged) or back to in_progress (closed).' },
  }),
  'read-config': tool('Read .speccode/config.json (config is null when missing).'),
  'write-config': tool('Atomically write .speccode/config.json.', {
    payload: payloadOf('The full config object (what the CLI reads from stdin).'),
  }, ['payload']),
  'backup-config': tool('Copy config.json to a timestamped .bak file.'),
  'write-state': tool('Atomically write one branch state; v3 payloads are shape-gated before writing.', {
    branch: BRANCH, payload: payloadOf('The state object; its `branch` must equal the branch argument.'),
  }, ['branch', 'payload']),
  'delete-state': tool('Delete one branch state file.', { branch: BRANCH }, ['branch']),
  'lint-state': tool('Read-only shape lint of config and every state entry; never mutates.'),
  'migrate-state': tool('Migrate legacy v2 state/features entries to v3 state/branches.'),
  'feature-progress': tool('Completion counters for one branch state.', { branch: BRANCH }, ['branch']),
  'detect-code-intel-tools': tool('Probe which code-intelligence tools are available and integrated for the repository.'),
  'resolve-worktree-dir': tool('Resolve the worktree base directory (config or default) and its gitignore state.'),
  'sdd-workspace': tool('Resolve (creating if needed) the SDD workspace directory for a plan under the current worktree root.', { plan: PLAN }, ['plan']),
  'task-brief': tool('Extract one plan task into a brief file for an implementer subagent.', { plan: PLAN, task: TASK, out: OUT }, ['plan', 'task']),
  'review-package': tool('Bundle the plan, the task and the base..head diff into a review package file.', {
    plan: PLAN,
    base: { type: 'string', description: 'Base commit SHA.' },
    head: { type: 'string', description: 'Head commit SHA.' },
    out: OUT,
  }, ['plan', 'base', 'head']),
  'tick-task': tool('Tick the checkbox steps of one plan task (idempotent; reports what was ticked).', { plan: PLAN, task: TASK }, ['plan', 'task']),
  'query-pr': tool('Query the state of a pull/merge request through the configured PR tool.', {
    number: { type: 'string', description: 'PR / MR number as a numeric string.' },
  }, ['number']),
  'run-hook': tool('Run the lifecycle hook configured for an event (warn-only; the result is always ok:true).', {
    event: { type: 'string', description: 'Lifecycle event name, e.g. onProposed.' },
    fragment: { type: 'object', description: 'Caller payload fragment merged under the engine envelope (what the CLI reads from stdin).' },
  }, ['event']),
  'repo-merge-config': tool('Read the repository merge settings through the PR tool and report whether it is squash-only.'),
  'read-memory': tool('Read the memory markdown of a branch or exploring topic (memory is null when absent).', { branch: BRANCH }, ['branch']),
  'write-memory': tool('Write memory for a branch: replace atomically, or append in a single O_APPEND write.', {
    branch: BRANCH, payload: payloadOf('{mode: "replace" | "append", content: string}'),
  }, ['branch', 'payload']),
  'list-memory': tool('List exploring topics and every memory file with its completion status.'),
  'purge-memory': tool('Delete the memory file of a branch.', { branch: BRANCH }, ['branch']),
  'rename-memory': tool('Atomically rename a memory file (e.g. adopt an exploring topic into a branch); refuses to overwrite.', {
    branch: { type: 'string', description: 'Source key, e.g. _exploring/<topic>.' },
    to: { type: 'string', description: 'Target branch key.' },
    payload: { type: 'object', description: 'Reserved; defaults to {}.', default: {} },
  }, ['branch', 'to']),
  'read-knowledge': tool('Read the knowledge index, one topic (optionally parsed into distilled blocks), or list topics.', {
    index: { type: 'boolean', description: 'Read _index.md.' },
    topic: { type: 'string', description: 'Topic name or path, with or without .md.' },
    blocks: { type: 'boolean', description: 'With topic: return parsed distilled blocks instead of raw content.' },
  }),
  'read-consumed-archives': tool('Report archive bundles already consumed by distillation, present on disk, and still unconsumed.'),
  'write-consumed-archives': tool('Record archive bundles as consumed by distillation.', {
    payload: payloadOf('{add: string[]} archive bundle directory names.'),
  }, ['payload']),
  'write-knowledge': tool('Write a knowledge file by mode: replace, replace-hand, replace-distilled or index.', {
    rel: { type: 'string', description: 'Relative path under speccode/knowledge/ (no .., no absolute paths).' },
    payload: payloadOf('{mode, content?, blocks?, entries?, heading?} as required by the mode.'),
  }, ['rel', 'payload']),
  'contract-version': tool('Report the prose↔engine contract version, the engine version and the supported MCP protocol revisions.'),
};

export function listTools() {
  return Object.entries(TOOL_META).map(([name, { description, inputSchema }]) => ({ name, description, inputSchema }));
}

function applyDefaults(schema, args) {
  const out = { ...args };
  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    if (out[key] === undefined && prop && Object.prototype.hasOwnProperty.call(prop, 'default')) {
      out[key] = structuredClone(prop.default);
    }
  }
  return out;
}

const rpcError = (code, message) => ({ error: { code, message } });

export function createServer({ runVerb, engineVersion, defaultCwd }) {
  function initialize(params) {
    const asked = params?.protocolVersion;
    const protocolVersion = MCP_PROTOCOL_VERSIONS.includes(asked) ? asked : MCP_PROTOCOL_VERSIONS[0];
    return {
      protocolVersion,
      capabilities: { tools: {} },
      serverInfo: { name: 'speccode', version: engineVersion ?? '0.0.0' },
      instructions: `speccode engine, contract version ${CONTRACT_VERSION}. Tools mirror the CLI verbs 1:1 (same names, same result JSON); write tools take the JSON the CLI reads from stdin as a \`payload\` argument. Omit \`cwd\` to target the server's working directory.`,
    };
  }

  function callTool(params) {
    const name = params?.name;
    const meta = typeof name === 'string' ? TOOL_META[name] : undefined;
    if (!meta) return rpcError(-32602, `unknown tool: ${String(name)}`);
    const args = params.arguments === undefined ? {} : params.arguments;
    if (args === null || typeof args !== 'object' || Array.isArray(args)) {
      return rpcError(-32602, 'arguments must be an object');
    }
    const flags = applyDefaults(meta.inputSchema, args);
    // null/'' are "no preference" like undefined — spawnSync would otherwise
    // receive cwd: null and silently fall back to the process cwd anyway.
    if (flags.cwd === undefined || flags.cwd === null || flags.cwd === '') flags.cwd = defaultCwd;
    if (STDIN_MODE[name] === 'payload') flags['json-stdin'] = true;
    const result = runVerb(name, flags);
    return {
      result: {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
        isError: result?.ok === false,
      },
    };
  }

  function handleMessage(msg) {
    const isObject = msg !== null && typeof msg === 'object' && !Array.isArray(msg);
    const hasId = isObject && Object.prototype.hasOwnProperty.call(msg, 'id');
    const id = hasId ? msg.id : null;
    if (!isObject || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      return { jsonrpc: '2.0', id, error: { code: -32600, message: 'invalid request' } };
    }
    let out;
    try {
      switch (msg.method) {
        case 'initialize': out = { result: initialize(msg.params) }; break;
        case 'ping': out = { result: {} }; break;
        case 'tools/list': out = { result: { tools: listTools() } }; break;
        case 'tools/call': out = callTool(msg.params); break;
        default:
          if (msg.method.startsWith('notifications/')) return null;
          out = rpcError(-32601, `method not found: ${msg.method}`);
      }
    } catch (err) {
      out = rpcError(-32603, `internal error: ${String(err?.message || err)}`);
    }
    if (!hasId) return null;
    return { jsonrpc: '2.0', id, ...out };
  }

  function handleLine(line) {
    const trimmed = String(line).trim();
    if (!trimmed) return null;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      return { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } };
    }
    return handleMessage(msg);
  }

  return { handleMessage, handleLine, listTools };
}
