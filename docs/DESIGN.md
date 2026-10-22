# speccode

[English](DESIGN.md) | [简体中文](DESIGN_CN.md)

> User-facing docs (installation / Quickstart / comparison & positioning) live in the root [README.md](../README.md); this document is the plugin design document.

## 1. What is speccode

speccode is a workflow orchestration plugin for coding-agent CLIs — Claude Code as the primary, dogfooded host, with adapters for Codex, Kimi Code, ZCode, OpenCode, and Pi (per-host install status in Section 11's multi-host table) — that turns the practices previously held together by manual convention — parallel development of multiple requirements, spec document hosting, and a standardized PR/MR flow — into executable primitives exposed as `/speccode:*` slash commands.

**Who it's for**: small teams or solo developers running **multiple requirements in parallel inside the same repo** — when you need to run several requirements at once, split a large requirement into multiple child branches for parallel work, and don't want to keep second-guessing "where do the docs go", "which branch do I branch from", "who opens the PR" — speccode offers an end-to-end default path.

**Since 0.2**, speccode ships with the complete SDD methodology (explore → document → plan → subagent execution → review → finish) plus hooks / memory capabilities; the branch topology is **two-layered** — normal requirements go straight from trunk to a `<type>/<slug>` development branch (git worktree, one step), while large requirements opt in to an integration branch + parent entity (see Section 3). The methodology is ported from superpowers (v6.2.0) and self-contained inside the plugin, so target projects have **zero external dependencies**.

## Dependencies & Prerequisites (applies to the whole document)

- `git` (the core: worktree / merge / rebase and every other operation is built on git)
- `gh` CLI (GitHub remote) or `glab` CLI (GitLab remote) — used to create/query PRs/MRs; when not installed, `pr_tool` automatically degrades to `none`, and commands print the equivalent command for you to run manually instead of failing
- Node.js **≥ 24** (the engine runs on Node; pure ESM, zero third-party dependencies)

## Table of Contents

1. [What is speccode](#1-what-is-speccode)
2. [Command Quick Reference](#2-command-quick-reference)
3. [Two-Layer Branch Topology](#3-two-layer-branch-topology)
4. [Development Workflow](#4-development-workflow)
5. [Documentation Layout](#5-documentation-layout)
6. [The `.speccode/` Directory Structure](#6-the-speccode-directory-structure)
7. [Hooks](#7-hooks)
8. [Memory](#8-memory)
9. [Code Intelligence Tools](#9-code-intelligence-tools)
10. [Risks & Mitigations (R1–R13)](#10-risks--mitigations-r1r13)
11. [Installation & Updates](#11-installation--updates)
12. [Philosophy](#12-philosophy)
13. [Open Issues](#13-open-issues)
14. [⚠ Important Warning](#14-⚠-important-warning)

## 2. Command Quick Reference

Lifecycle:

| Command | Purpose | Prerequisite (branch to run on) |
|---|---|---|
| `/speccode:init` | Initialize/update: probe and confirm the PR tool from the remote URL; ask for the worktree directory, optional working language, and hooks; write the minimal `.speccode/config.json` marker (config v3) | Any branch (first run usually on trunk) |
| `/speccode:exploring` | Explore a requirement (produces no documents; conclusions live in the session context; code intelligence tools preferred; ends with the three-way requirement-shape confirmation) | trunk |
| `/speccode:creating-feature` | **Opt-in (large requirement)**: cut an integration branch from trunk and push it; register the parent-entity state; create the memory skeleton | trunk |
| `/speccode:creating-worktree` | Cut a development branch from trunk or from an integration branch (the only entry for normal requirements; worktree_dir configurable, check-ignore validation, project setup, baseline tests) | trunk (normal) or integration branch (parent scenario); HEAD unconstrained |
| `/speccode:finishing-worktree` | Finish a development branch and route the merge by `merge_target`: local squash + retest into the integration branch / PR to trunk (test gate; discarding requires the literal word `discard`) | a `<type>/<slug>` development branch |
| `/speccode:finishing-feature` | **Opt-in (large requirement)** finale: all children completed gate → integration branch → trunk single PR (blocks until merged) → delete the parent-entity state → switch back to trunk | integration branch |
| `/speccode:status` | Read-only overview: progress of every active branch, pending_operation, config summary (parent entities render child statuses derived in real time) | Any branch |
| `/speccode:reset` | Reset the environment: clear state and worktrees, ask field-by-field whether to clear config, ask whether to clear memory//sdd//brainstorm/ (refuses to run when any active branch exists) | Any branch, and must have no active branches |

Documentation flow (every step commits on save):

| Command | Purpose | Prerequisite (branch to run on) |
|---|---|---|
| `/speccode:proposing` | Land the four document types (proposal/design/specs/tasks) into `speccode/changes/<slug>/propose/`; the exit assigns a tier (Tier 1/2/3) into the proposal.md frontmatter `tier:` field; light mode (empty specs delta) may omit design.md/specs/ | a `<type>/<slug>` development branch |
| `/speccode:brainstorming` | Socratic design refinement; designs land in `brainstorm/` and are written back into propose/ to keep them consistent | a `<type>/<slug>` development branch |
| `/speccode:writing-plans` | Detailed implementation plan (brainstorm/ first, propose/ as fallback), lands in `plan/` | a `<type>/<slug>` development branch |
| `/speccode:applying` | Manual executor for Tier-1 changes: implement tasks.md item-by-item (no plan), tick + bookkeeping commit, mandatory code review | a `<type>/<slug>` development branch |
| `/speccode:syncing` | Merge incremental changes into the `speccode/spec/` main spec (absorbs leftover brainstorm material; idempotent) | a `<type>/<slug>` development branch |
| `/speccode:archiving` | Archive: move changes/<slug>/ into `speccode/archive/<YYYY-MM-DD>-<slug>/` | a `<type>/<slug>` development branch |

Knowledge:

| Command | Purpose | Prerequisite (branch to run on) |
|---|---|---|
| `/speccode:distilling-knowledge` | Distill the `speccode/knowledge/` topic files from `spec/` (full read — the freshness anchor) + `archive/` (**incremental**, tracked via `knowledge/_distilled.meta.json`); distilled blocks are keyed by capability and upserted each run, every block freshness-audited against the current specs; human gate before write; commits on save | chore/knowledge-* worktree branch (unified creating-worktree entry, finishing-worktree finish) |
| `/speccode:recording-knowledge` | Record knowledge directly into hand-written sections (fit check: process knowledge stays, business knowledge is pointed to external RAG; draft → human gate → atomic `replace-hand` write, distilled blocks preserved byte-for-byte); also tidies the topic's existing hand-written section each run; commits on save | chore/knowledge-* worktree branch (unified entry/finish) |

Methodology:

| Command | Purpose | Prerequisite (branch to run on) |
|---|---|---|
| `/speccode:subagent-driven-development` | Dispatch a fresh subagent per task + double review + final review of the whole team; ledger recovery | a `<type>/<slug>` development branch |
| `/speccode:executing-plans` | Execute the plan in batches within this session, with human checkpoints | a `<type>/<slug>` development branch |
| `/speccode:dispatching-parallel-agents` | Concurrent subagent workflow (independent failure domains) | a `<type>/<slug>` development branch |
| `/speccode:test-driven-development` | RED-GREEN-REFACTOR loop (with iron rules and an anti-pattern table) | a `<type>/<slug>` development branch |
| `/speccode:systematic-debugging` | 4-stage root-cause process + defense in depth + conditional-wait techniques | a `<type>/<slug>` development branch |
| `/speccode:requesting-code-review` | Dispatch a review subagent (spec compliance + code quality) | a `<type>/<slug>` development branch |
| `/speccode:receiving-code-review` | Handle review feedback technically (no performative agreement) | a `<type>/<slug>` development branch |
| `/speccode:verification-before-completion` | Evidence before assertion: verification must run before declaring anything done | a `<type>/<slug>` development branch |

## 3. Two-Layer Branch Topology

```
origin/<trunk> (trunk; spec documents tracked)
   │
   │  /speccode:creating-worktree (normal requirement, one step; base = trunk, several can run in parallel)
   ├──────────────┬──────────────┐
   ▼              ▼              ▼
feature/a       feature/b      feature/c   ← development branches <type>/<slug> (no worktree- prefix)
   │  The documentation flow (proposing→brainstorming→writing-plans→applying→…→syncing→archiving) happens on this layer
   └── /speccode:finishing-worktree (merge_target=trunk: test gate + PR) merges back into trunk ──┘
   │
   ▼
origin/<trunk>  (normal requirement lands; the development branch stays as history)

- - - - - Large-requirement opt-in path (only when exploring's exit shape confirmation says "large") - - - - -
   │
   │  /speccode:creating-feature (cut an integration branch from trunk, register the parent-entity state)
   ▼
feature/big-rework  (integration branch; parent entity kind:integration, children register slugs only)
   │
   │  /speccode:creating-worktree (base = integration head; parallel or serial child branches)
   ├──────────────┬──────────────┐
   ▼              ▼              ▼
feature/s1      feature/s2     feature/s3   (child branches; merge_target = the integration branch)
   │  The documentation flow as above, on each child branch
   └── /speccode:finishing-worktree (merge_target=integration: local squash + retest)──────────┘
   │
   ▼
feature/big-rework  (integration head advances; children statuses are derived from the child-branch states)
   │
   │  /speccode:finishing-feature (all-children-completed gate; single PR → trunk)
   ▼
origin/<trunk>  (the large requirement lands in one shot)
```

Key points:

- **trunk**: the trunk branch (name resolved at runtime via the `default-branch` verb, never stored in config), spec documents tracked.
- **`<type>/<slug>` development branches**: cut from trunk for normal requirements (via `git worktree add`; several can run in parallel), with no `worktree-` prefix; in the large-requirement scenario they are cut from the integration branch with `merge_target` pointing at it.
- **Integration branch (opt-in large requirement)**: created from trunk by `/speccode:creating-feature`, registered as a parent-entity state (`kind:"integration"`); `children` registers child slugs only (identity only), with statuses derived in real time from the child-branch states; the finale is a single PR to trunk via `/speccode:finishing-feature`.
- **The topology has only two layers**: normal requirements go trunk ↔ development branch directly; the integration branch is the opt-in aggregation layer for large requirements, never a mandatory default layer. `speccode/` documents are tracked on every branch and ride the PR chain up to trunk.

## 4. Development Workflow

The default path from requirement to delivery (normal requirements go directly; large requirements opt in to the integration branch):

1. `/speccode:exploring` — explore the requirement on trunk; conclusions stay in the session context (writes per-topic `_exploring/<topic>` memories); the exit runs the **requirement-shape confirmation** with three outcomes: a single normal requirement / several independent normal requirements / a large requirement (integration).
2. (Large-requirement opt-in only) `/speccode:creating-feature` — cut the integration branch from trunk and register the parent-entity state; normal requirements skip this step.
3. `/speccode:creating-worktree` — cut a development branch from trunk (normal) or from the integration branch (large requirement); run baseline tests.
4. `/speccode:proposing` — land the four document types: proposal/design/specs/tasks; the exit assigns the change a tier (Tier 1 tiny / Tier 2 small-to-medium / Tier 3 complex, written to the proposal.md frontmatter `tier:` field) that routes the follow-up chain; light mode (empty specs delta) may omit design.md/specs/.
5. (Tier 3) `/speccode:brainstorming` — refine the design and write it back into propose/.
6. (Tier 2/3) `/speccode:writing-plans` — produce the detailed implementation plan.
7. `/speccode:applying` (Tier 1: implement tasks.md item-by-item by hand) or `/speccode:subagent-driven-development` / `/speccode:executing-plans` — execute (methodology commands such as `/speccode:dispatching-parallel-agents`, `/speccode:systematic-debugging`, `/speccode:verification-before-completion`, `/speccode:test-driven-development` are invoked as needed along the way).
8. `/speccode:requesting-code-review` — dispatch a review subagent; process feedback with `/speccode:receiving-code-review`.
9. `/speccode:syncing` — merge the delta into the main spec.
10. `/speccode:archiving` — archive changes/<slug>/.
11. `/speccode:finishing-worktree` — route by `merge_target`: normal requirements open a PR → trunk; large-requirement child branches local-squash into the integration branch.
12. (Large-requirement opt-in only) `/speccode:finishing-feature` — once all children are completed, a single PR from the integration branch → trunk (blocks until merged), delete the parent-entity state, switch back to trunk; normal requirements have no such step.

## 5. Documentation Layout

speccode's spec documents live in the repo's `speccode/` directory, **tracked on every branch**, and ride the PR chain up to trunk:

```
speccode/
├── changes/<slug>/          # in-progress requirement documents
│   ├── propose/             # proposal.md / design.md / specs/ / tasks.md (produced by proposing; in light mode design.md/specs/ may be omitted)
│   ├── brainstorm/          # design refinement documents (produced by brainstorming)
│   └── plan/                # implementation plan (produced by writing-plans)
├── spec/<capability>/       # main spec (where syncing merges deltas)
├── archive/<YYYY-MM-DD>-<slug>/   # archive (archiving moves the whole directory, never deletes)
└── knowledge/               # curated knowledge set (produced by distilling-knowledge / recording-knowledge)
    ├── _index.md            # retrieval index: topic title + file + one-line summary, regenerated on demand
    ├── _distilled.meta.json # distill-consumption sidecar: consumed archive bundles (incremental read tracking)
    └── development/         # architecture.md / standards.md / environment.md / integrations.md / pitfalls.md / security.md
```

Conventions:

- **Commit on save**: proposing / brainstorming / writing-plans / applying (per-item bookkeeping commits) / syncing / archiving / distilling-knowledge / recording-knowledge each commit immediately after producing their documents, so document history and code history stay on the same branch, moving together.
- **Multi-round rebuilds of the same feature don't collide**: once changes/<slug>/ is archived the directory is freed, and the same slug can start a new round via proposing again; when rebuilding without archiving first, proposing asks "continue / archive first / cancel".
- **Knowledge set: a current-state snapshot, keyed by capability**: each topic file under `knowledge/` mixes two kinds of content. `distilling-knowledge` distills `spec/` (full read — the freshness anchor) and `archive/` (**incrementally**, tracked in `knowledge/_distilled.meta.json` purely as read-cost control) into **distilled blocks** wrapped in `<!-- distilled-from: cap/<slug> --> ... <!-- /distilled -->` markers: the key is a capability slug, unique per file, upserted on every run — later knowledge overrides earlier, retired knowledge is deleted through the gate with a reason (no tombstones; history lives in `archive/` and the CHANGELOG), and every existing block is freshness-audited against the current specs on each run. `recording-knowledge` writes and tidies the free-form **hand-written** prose outside those markers (replace-hand mode: the whole hand region is rebuilt on each write while distilled blocks survive byte-for-byte; tidy actions — merge/delete — carry reasons and answer to the present user, not to the specs). Both writes emit the canonical layout: hand-written first, distilled blocks after. The set curates SDD process knowledge only (`development/*`; pitfalls also covers recurring review findings and team review consensus). Business knowledge is left to external RAG systems: `recording-knowledge` runs a fit check before writing (a recommendation, not a hard block), and `distilling-knowledge` sunsets distilled blocks of out-of-scope topics through the same human gate while preserving hand-written content byte-for-byte. Legacy `promoted-from`-era markers are not parsed as block boundaries — their bytes are ordinary hand-written text, kept verbatim and surfaced for manual cleanup through the distill gate.

> Plugin-side helper resources: `references/` contains visual-companion (the visual companion for brainstorming, see `references/visual-companion.md`), review prompts, and debugging methodology; all tracked with the plugin source.

## 6. The `.speccode/` Directory Structure

```
.speccode/
├── config.json                          # the config marker (config v3), written wholesale by init / reset; creating-worktree can write back worktree_dir
├── config.json.bak.<timestamp>          # explicit backup before init-idempotent / reset flows rewrite config (backup-config verb)
├── state/branches/<type>__<slug>.json   # dynamic state, isolated per branch
├── memory/                              # memory home: reserved trunk-level keys (_exploring__<topic>.md / _knowledge.md) + worktree-less branches; a registered branch's memory lives in <worktree>/.speccode/memory/ (self-ignored via .gitignore)
└── sdd/                                 # SDD execution artifacts: task briefs / review packages / ledger (self-ignored via .gitignore)
```

- **`config.json`**: the global static config — **config v3 is a marker, not an environment registry**: required fields are `version` (=3) and `initialized_at`; `init` additionally writes `pr_tool` (probed from the remote URL, confirmed with the user) and `worktree_dir` (default `.speccode/worktrees`); `hooks` and `language` exist only when the user configures them. `trunk` / `remote` / the code-intel tool registry are **retired** (historical deleted) fields: a leftover key from an older config generation is a plain unknown key — tolerated on read, never consumed — and vanishes the next time init rewrites the config wholesale. The trunk name is resolved at runtime via the `default-branch` verb (`origin/HEAD` → local `main` → local `master` → `"main"` as the last resort), never stored in config. Wholesale writes happen only in `/speccode:init` (fresh or idempotent) and `/speccode:reset`; additionally, `/speccode:creating-worktree` asks for a directory when config lacks `worktree_dir`, then writes the field back into config via `write-config` (read current config → add field → write back wholesale). **Backups are not an automatic behavior of `write-config`**: `config.json.bak.<timestamp>` is produced by the init-idempotent flow and the reset flow explicitly calling `backup-config` before rewriting; creating-worktree's single-field write-back creates no backup. Backups rotate: each new backup keeps only the newest 5 `config.json.bak.*` siblings (`BACKUP_KEEP` constant; prefix-scoped, nothing else is ever touched).
- **`state/branches/`**: one file per active branch (`<type>__<slug>.json`, double underscore separating type and slug), recording that branch's status (`pending | in_progress | pr_open | completed`) and any suspended `pending_operation` (for `--resume`); parent entities (`kind:"integration"`) additionally hold the children list (child slugs only, identity only) — child-branch statuses are derived in real time and never stored on the parent. Branches each write their own files in parallel, no locks needed.
- **`memory/`**: session memory (see Section 8) — the main-repo home holds the reserved trunk-level keys and branches without a worktree, while a registered branch's memory lives inside its own worktree; each home self-ignores via the plugin's `.gitignore` (content `*`), invisible to `git status` and spared by `git clean -fd`.
- **`sdd/`**: SDD execution artifacts, belonging to the **current worktree root** (not the main repo root), cleaned up together with `git worktree remove`; self-ignored as well.
- Every write to `config.json` and `state/branches/*.json` uses the atomic "write a temp file + rename over" strategy to avoid half-written states when a process is interrupted; memory text writes use the same strategy.

## 7. Hooks

The config's `hooks` field maps fixed lifecycle events to shell commands, triggered by commands via the `run-hook` verb at the corresponding node.

**14 fixed events** (closed enumeration; unknown event names are rejected):

`onExplored` / `onFeatureCreated` / `onWorktreeCreated` / `onProposed` / `onBrainstormed` / `onPlanned` / `onTaskCompleted` / `onCodeReviewRequested` / `onCodeReviewCompleted` / `onWorktreeFinished` / `onFeatureFinished` / `onPrOpened` / `onSynced` / `onArchived`

**payload**: the hook command reads a single line of JSON from **stdin**, with fields `event`, `timestamp` (ISO 8601 UTC), `repo_root`, `cwd`, `command`, plus `feature_branch` / `worktree_branch` / `pr_number` / `task` when available.

**Failure semantics: warn-only**. Each hook has a 30-second timeout; whether the hook is missing, times out, exits non-zero, or throws, `run-hook` always exits 0, with the error folded into the `hook` field of the returned JSON — **a hook can never interrupt the main command**.

**Usage example** (IM notification stub):

```json
"hooks": {
  "onPrOpened": "read -r p; curl -s -X POST https://im.example.com/notify -H 'Content-Type: application/json' -d \"$p\"",
  "onFeatureFinished": "read -r p; echo \"feature done: $p\" >> /tmp/speccode-hooks.log"
}
```

**Threat model**: hooks execute via `sh -c` with the full permissions of the current user; the security rationale is in R11.

**Bundled tool-input sanitizer**: the plugin ships a PreToolUse hook (`hooks/hooks.json`)
that strips stray carriage returns (U+000D) from `AskUserQuestion` tool input before the
dialog renders — some model backends inject CRs into `tool_use` arguments, garbling
question text. Sanitization logic lives in `lib/sanitize.mjs` (pure function, unit-tested);
the hook shell is fail-open: any error passes the original input through untouched.

## 8. Memory

speccode maintains one cross-session memory per feature: `.speccode/memory/<type>__<slug>.md`, branch-keyed, with the home directory following the branch's worktree ownership.

- **Worktree ownership, state-driven**: a registered branch's state carries its worktree, and the branch's memory lives inside it (`<worktree>/.speccode/memory/`). Reserved trunk-level keys — `_knowledge` (knowledge-command maintenance summaries) and the per-topic `_exploring/<topic>` files (one file per topic; phased requirements share a prefix like `<topic>-p1`) — plus any branch without a worktree have no worktree home and live in the **main repo root**'s `.speccode/memory/` (the same home as config/state; parent-entity memory included). Every home self-ignores via the plugin's own `.gitignore` (content `*`), never polluting `git status`.
- **Memory dies with the worktree; final summaries bypass it**: `git worktree remove` takes the branch memory along; finishing-worktree purges it explicitly first (`purge-memory`, ahead of the remove — auditable and idempotent rather than a silent vanishing) and delivers the completion summary straight in the command's final report instead of writing it into the dying memory; only the "keep worktree" and "PR without waiting" paths leave the memory alive for a later `--resume`.
- **Adoption is a create-then-move transaction**: exploring conclusions are born in the main repo's trunk-level home; creating-worktree (normal / child requirements) and creating-feature (the large requirement's parent topic) adopt a topic into the feature memory on a slug match via an atomic rename — one whole-file move that refuses to overwrite an existing target (never merges, never clobbers; a cross-device move degrades to atomic-write-then-unlink, so readers never see a half file). The knowledge commands run on `chore/knowledge-*` worktree branches via the standard creating-worktree entry and finishing-worktree finish; their maintenance summaries stay in the main repo's `memory/_knowledge.md`.
- **Commands read on entry, write on exit**: SDD commands read this feature's memory at the start to restore context, and write conclusions / decisions / remaining tasks back on exit.
- **Proactive writing during long sessions — three triggers**: ① a stage completes (e.g. propose lands, the plan passes review); ② context has grown significantly (more key decisions accumulating); ③ after a compact / session restore — hit any one of these and write memory proactively, rather than waiting for a command exit.

## 9. Code Intelligence Tools

Code intelligence tools (code-graph / index-style MCP servers and CLIs) remain the **preferred consult-first helpers** for `/speccode:exploring`, `/speccode:proposing`, and `/speccode:brainstorming` — but the plugin no longer manages them. The former init-time detection & registration flow — probing installed plugins, MCP configs, CLIs, and project directories, then registering the confirmed list into the config — was **retired in 2026-10** together with the config slimming. Consults are **session-visibility based**: commands use whatever code intelligence tools the current session actually exposes, and when a tool is missing or a call fails they fall back to plain code reading and never error out — code intelligence is an enhancement, not a dependency, and nothing about it is written to or read from the config.

The surviving piece of the retired detection machinery is environment-neutral worktree placement: `lib/detect.mjs` still resolves the worktree directory (config `worktree_dir`, falling back to the default `.speccode/worktrees`) and runs the gitignore check that creating-worktree relies on — a three-branch verdict: a directory outside the repo is never git-tracked (`outside`, no git call at all); an inside directory is queried with `git check-ignore` (trailing slash, so directory semantics apply) and resolves to ignored or not-ignored.

## 10. Risks & Mitigations (R1–R13)

> The numbering follows the historical risk table: R1 / R7 / R10 were retired together with the v0.1 four-layer topology (milestone branch layer + temporary wrap-up branches), see [CHANGELOG.md](../CHANGELOG.md); the rest are kept and updated to the new command names.

- **R2 — ancestry checks can misjudge when cherry-picks cross features** → reconciliation uses **path identification** (inside worktree_dir + state registration) and performs no ancestry checks, so this misjudgment surface is gone.
- **R3 — during init's field-by-field idempotent flow, the user may accidentally change fields like `pr_tool`** → Mitigation: every changed field MUST show the `[old value] → [new value]` diff when confirming, and is only written after the user chooses "use the new value".
- **R4 — `.speccode/` is not in `.gitignore`, so `git clean -fdx` can wipe the config** → Mitigation: explicitly warned about in the init prompt and in this README; no forced protection at the command level (consistent with the principle that "the plugin doesn't modify `.gitignore` or override the user's git mechanisms"). See Section 14's Important Warning.
- **R5 — the blocking wait for a PR merge times out after 30 minutes by default, which may not be enough for long PR reviews** → Mitigation: the timeout is a soft limit; the suspended state goes into `pending_operation` and `--resume` lets you continue later, so the command never deadlocks permanently.
- **R6 — the worktree directory is configurable, defaulting to `.speccode/worktrees`** → Mitigation: `.speccode/` is the untracked runtime-data domain, so git won't sweep it up as content to commit; init can override the default via the config `worktree_dir`, and `creating-worktree` runs a check-ignore validation before creating the directory.
- **R8 — cross-platform (Windows / macOS / Linux) path and command differences** → Mitigation: the implementation targets macOS / Linux first, and Windows support is out of scope; command implementations rely as much as possible on the cross-platform behavior of `git` / `gh` / `glab` itself rather than doing platform checks at the shell layer.
- **R9 — `pr_open` branches depend on reconciliation to advance** → Mitigation: `creating-worktree` / `finishing-worktree` / `finishing-feature` / `status` all run reconciliation on entry, so any one of them advances a merged `pr_open` branch to `completed`; if the user merges a PR and never runs another speccode command, the state won't update by itself — acceptable, since `status` is the explicit query entry point and can be triggered manually at any time.
- **R11 — hooks execute via `sh -c` with the current user's full permissions** → Mitigation and threat model: ① failure semantics are warn-only (30s timeout, `run-hook` always exits 0), so a hook cannot break the main flow; ② `config.hooks` is safe because `.speccode/` is **untracked by convention** — a hook command can never enter someone else's repo via clone / PR / merge, and the only way to write config is the local user's own `init`; ③ hook payload values are structurally constrained by `slug.mjs` (type is a closed enum, slug matches `/^[a-z0-9-]+$/`), and path-like fields are generated by the engine, containing no arbitrary user input.
- **R12 — concurrent memory writes are last-writer-wins** → a branch's memory lives inside its worktree, and two sessions working the same worktree can still "write on exit" at the same moment, the later write overwriting the earlier one. Mitigation: read before write (read-before-write: increment on top of the existing content rather than replacing the whole file); confirm with the user before large overwriting rewrites.
- **R13 — trunk document churn** → spec documents are tracked on every branch, so multiple features landing in parallel keep changing `speccode/` on trunk and widen the merge-conflict surface. Mitigation: `syncing` only does **incremental, idempotent merges** (rerunning leaves no dirty changes); `archiving` **moves** whole directories rather than deleting, keeping review diffs clean and history traceable; documents ride the same PR as the code to trunk and are visible during review.

## 11. Installation & Updates

The complete change log for every version lives in [CHANGELOG.md](../CHANGELOG.md) at the repo root.

### Upgrade actions

For users, a plugin upgrade is a set of Claude Code commands, not a fresh clone:

```text
/plugin marketplace update speccode   # refreshes the marketplace cache (git pull)
→ a plugin.json version change triggers the update check
→ /plugin install speccode@speccode   # update the installation when prompted
```

Note: GitHub Releases / tags are just release markers for humans and **trigger no automatic update**; the update check is driven entirely by the `plugin.json` version comparison after the marketplace git pull.

### Multi-host install entries

Claude Code is the primary host; five more hosts install from this same repository (thin per-host adapters pointing at the shared `skills/`). Entries marked unverified have not been verified on real machines — see `references/host-mapping/README.md` for the overview table and per-host mapping docs.

| Host | Entry | Mapping | Status |
|---|---|---|---|
| Claude Code | marketplace | native | primary, dogfooded |
| Codex | `.codex-plugin/plugin.json` | `references/host-mapping/codex.md` | install unverified |
| Kimi Code | `.kimi-plugin/plugin.json` | manifest `skillInstructions` + mapping doc | install unverified |
| ZCode | `.zcode-plugin/plugin.json` (official six-key shape) | `references/host-mapping/zcode.md` | manifest schema / install route / skill frontmatter verified (2026-09-17); tool names unverified |
| OpenCode | `.opencode/INSTALL.md` | `references/host-mapping/opencode.md` | unverified |
| Pi | `.pi/extensions/speccode.ts` | `references/host-mapping/pi.md` | unverified (extension API assumed) |

**Engine mount channels** — on a non-Claude-Code host the engine reaches the skills through either of two channels (they can coexist):

- **PATH channel** (skills invoke the bare `speccode` verb): `npm i -g speccode` — pending the first npm publish; until then, `bash scripts/install-shim.sh` from a checkout, or `node <repo>/bin/speccode.mjs` directly. One PATH channel per machine.
- **MCP channel** (the host's native agent consumes engine verbs as MCP tools): `npx -y -p speccode speccode-mcp` — likewise available after the first publish; per-host registration samples live in `references/host-mapping/`.

Publishing is tag-triggered CI (`v*` tags; needs the one-time repo secret `NPM_TOKEN`). And without the engine on either channel, the SDD document flow stays fully usable — every engine-calling skill carries a lite degrade table that substitutes plain file operations for engine verbs — while orchestration (state / reconciliation / PR) does need the engine: the affected commands abort with an install hint instead of degrading silently.

## 12. Philosophy

speccode's methodology commands inherit five working philosophies:

1. **Test-driven**
2. **Systematic over ad hoc**
3. **Reduce complexity**
4. **Evidence over assertion**
5. **Don't be overconfident (ask when unsure)**

## 13. Open Issues

- **Windows not supported**: the current implementation only covers macOS / Linux and does not handle Windows path separators, shell differences, etc. (see R8). Whether to repeat the "macOS / Linux only" note in every command file, or state it once in this README — the current leaning is to state it centrally only in the README (this section + the dependencies block at the top of the document) rather than repeating it in every command markdown file.

## 14. ⚠ Important Warning

The `.speccode/` directory is **not tracked by git and will not be added to `.gitignore`** in user projects — this is an explicit design decision of the plugin (speccode decouples from git's native mechanisms; all tracking management goes through explicit commands, and the plugin never edits `.gitignore` on the user's behalf).

**What this means**: if you run `git clean -fdx` in this repo, `.speccode/config.json`, `state/` (`branches/`), `memory/`, and `sdd/` are all treated as "untracked/ignored files" and deleted along with them — you lose the current speccode config, the progress state of every active branch, and all session memory (corresponding to risk R4).

`git clean -fd` (without `-x`) is gentler: `memory/` and `sdd/` are judged ignored because of the plugin's self-written `.gitignore` (content `*`), so `-fd` spares both; but `config.json`, `state/`, and `config.json.bak.*` are still ordinary untracked files, and **`-fd` deletes them too**.

**Recommendations**:

- Before running any `git clean` variant, first confirm what `-x` and `-f` cover; if in doubt, dry-run with `git clean -n` first, or explicitly exclude the `.speccode/` path.
- If `config.json` really is lost, rerun `/speccode:init` to rebuild it; when the files under `state/` are lost, the progress information of the corresponding branches cannot be recovered and must be re-registered via reconciliation against the actual current git state; a lost `memory/` means session memory is unrecoverable — only the committed documents under `speccode/` can rebuild context.
