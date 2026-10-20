// Contract version between the engine and the prose (skills) layer. It covers
// every surface prose can observe: the state v3 shape (state.mjs), the config
// v3 shape (config.mjs), the memory key model (`<type>__<slug>`,
// `_exploring__<topic>`, `_knowledge` — memory.mjs) and the result shape of
// every verb (verbs.mjs). Bump on any incompatible change to those surfaces;
// additive changes (a new optional field, a new verb) do not bump.
export const CONTRACT_VERSION = 1;

// MCP protocol revisions this engine speaks, newest first. `initialize`
// echoes the client's requested revision when it is listed here and falls
// back to the first entry otherwise.
export const MCP_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
