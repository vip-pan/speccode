# readme-restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** README 双语叙事重组——新身份第一屏、Install 三段递进、对比表 +lite/+MCP、demo fixture 现行输出;双语成对段数不变;守卫全绿。

**Tech Stack:** markdown + vhs(可选)+ node --test。

## Global Constraints

- 双语成对:每处改动 EN/CN 同提交,`grep -c "^## "` 保持 15/15。
- 守卫回归:README 措辞守卫(code intelligence / 代码智能工具)保持绿;DESIGN 禁令不动。
- demo.tape 的画面内容不含版本号与测试数量字面量(tape 头部既有约束)。
- 全量 `node --test ./tests/*.test.mjs`(347);每任务绿后提交。

---

### Task 1: README 双语五处 + demo fixture

**Files:**
- Modify: `README.md`、`README_CN.md`、`docs/assets/demo.tape`(d1 fixture)
- Optional: `docs/assets/demo.gif`(重录产物)

**五处改动的精确指令(EN 先行,CN 逐句对应):**

1. **定位句(§ 标题段,line 3)**:整段重写为——
   ```markdown
   **An end-to-end SDD (Spec-Driven Development) and automated development system for coding-agent CLIs — a pure-prose plugin core with a mountable engine.** The document flow runs the moment the plugin is installed (no engine on PATH needed); parallel-requirement orchestration mounts on demand via PATH or MCP. speccode turns multi-requirement parallel development, in-repo spec hosting, and a standardized PR flow into a default path — the full `/speccode:*` command set. Claude Code is the primary, dogfooded host, with adapters for Codex, Kimi Code, ZCode, OpenCode, and Pi (per-host status in [references/host-mapping/README.md](./references/host-mapping/README.md)). This repo dogfoods all of it.
   ```
   (CN 对应:「面向 coding-agent CLI 的整套 SDD 与自动化开发体系——纯 prose 插件核 + 可挂载引擎。装上插件文档流即可运行(无需引擎在 PATH);并行编排按需经 PATH 或 MCP 挂载。……」其余句保留对应译文;code intelligence 措辞守卫——注意:新定位句无需含该词,守卫由 Why 段第 4 条的 "code intelligence tools" 继续满足,改后核对。)

2. **Install 段重排(§ Install)**:改为三段递进——
   ```markdown
   ## Install

   **1. Install the plugin** (the only step every host needs):

   ```bash
   /plugin marketplace add vip-pan/speccode
   /plugin install speccode@speccode
   ```

   Requires [Node.js ≥ 24](#prerequisites) and `git`. Commands appear under the `/speccode:` prefix.

   **2. Just start — the document flow works now.** Proposing, planning, spec documents, review, and archive run with no engine installed: engine-calling skills carry a lite degrade table (reads fall back to direct `cat`/`git`); orchestration commands abort with install guidance when they need the engine.

   **3. Add the engine when you want orchestration** (parallel worktrees, state reconciliation, PR automation) — two coexisting channels: the **PATH channel** (`npm i -g speccode`, serving the bare `speccode` calls skills make — the npm package is pending its first publish; until then `bash scripts/install-shim.sh` from a checkout is the working route) and the **MCP channel** (per-host registration of `npx -y -p speccode speccode-mcp`, exposing the verbs as tools for the host's native agent; see [references/host-mapping/README.md](./references/host-mapping/README.md) for each host's install entry, tool mapping, MCP registration, and verification status). Maintainers: npm publishing is tag-triggered CI and requires the repo secret `NPM_TOKEN` (one-time setup).
   ```
   (CN 对应三段;旧「Other coding agents?」长段内容全部并入第 ③ 段,不再单独成段。)

3. **对比表(§ How We Compare)加两行**(置于 SDD 行之前):
   ```markdown
   | Works without its engine (lite document flow) | ✅ | — | — | — | — |
   | Engine as MCP server (1:1 tools + contract version) | ✅ | — | — | — | — |
   ```
   (CN:「无引擎可用的文档流(lite)」「引擎即 MCP server(1:1 tools + 契约版本)」。)

4. **Quickstart**:第 2 步句尾追加 ` (No engine install needed for the document flow — orchestration commands guide you when they need one.)`(CN 对应括号句)。

5. **demo.tape d1 fixture + README console 块**:tape 的 d1 fixture 中 `✓ probed: trunk=main | remote=origin | pr_tool=gh` 行改为 `✓ config ready: pr_tool=gh, worktree_dir=.speccode/worktrees`(与 README console 块现行输出一致;README console 块本身已正确——核对无漂移即可)。若 `command -v vhs` 在场:仓库根执行 `vhs docs/assets/demo.tape` 重录 GIF 并清理 fixture 目录(d d1-d4);缺 vhs 则 tape 源就位即可(报告标注 GIF 待重录)。

- [ ] **Step 1** 应用五处改动(EN 先行,CN 逐句)
- [ ] **Step 2** `node --test ./tests/*.test.mjs` 全绿 347;`grep -c "^## "` EN=CN=15;`grep -n "trunk=\|code_intel_tools\|Other coding agents" README*.md` 零命中
- [ ] **Step 3** commit `git add README.md README_CN.md docs/assets/ && git commit -m "docs(readme): pure-prose core + mountable engine — identity first screen, three-step install, lite/MCP compare rows"`

### Task 2: CHANGELOG + 验证

- [ ] Step 1 CHANGELOG `[Unreleased]`:`- Changed: README 双语叙事重组——定位句改「纯 prose 插件核 + 可挂载引擎」(lite 第一屏)、Install 三段递进(插件→lite 即用→编排加引擎)、对比表 +lite/+MCP 两行、demo fixture 对齐现行 init 输出。`
- [ ] Step 2 全量 347;双语段数自查;commit `git add CHANGELOG.md && git commit -m "docs: readme restructure changelog entry"`

## 计划自查
- 规格覆盖:三个新 Scenario(定位句/Install 结构/对比表行)↔ T1-1/2/3;Quickstart 与双语成对 ↔ T1-4 + 全任务内嵌。
- 占位符:五处指令均给全文/精确行文;无 TBD。
