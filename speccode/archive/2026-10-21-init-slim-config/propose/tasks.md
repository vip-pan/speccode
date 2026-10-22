# Tasks: init-slim-config

> 本清单已由 plan/2026-10-21-init-slim-config-plan.md 接管:实现进度以 plan 的 checkbox 为准,本文件不再勾选,仅作意图索引。

## A. 引擎(lib)

- A1 `lib/git.mjs` 或 `lib/detect.mjs` 新增纯函数 `resolveDefaultBranch(runGit)`(四级探测链:remote-head → fallback-main → fallback-master → last-resort,返回 `{branch, source}`);`lib/verbs.mjs` 新增 verb `default-branch`(`{ok, branch, source}`);单测(注入 fake runner 覆盖四级 + origin/ 前缀剥离)
- A2 `lib/config.mjs`:`validateConfigShape` 去掉 `trunk`/`remote`/`code_intel_tools` 的类型校验(未知键容忍语义不变);`tests/config.test.mjs` 字段集用例改写(最小形状 + 三残留键容忍)
- A3 `lib/detect.mjs` 删 `detectCodeIntelTools` 与探测器表常量(保留 `resolveWorktreeDir`/`worktreeDirIgnoreState`/`isPathInside`/`DEFAULT_WORKTREE_DIR`);`lib/verbs.mjs` 删 `detect-code-intel-tools` verb;`lib/mcp.mjs` `TOOL_META` 删对应条目并增 `default-branch`;`tests/detect.test.mjs` 拆分(探测器表用例删、worktree-dir/路径判定用例留);`tests/cli.test.mjs` detect e2e 删、default-branch e2e 增(fallback 路径;remote-head 由单测覆盖)

## B. prose(skills)

- B1 `skills/init/SKILL.md` 重写为标记语义:全新流程 = `.speccode/` + 最小 config(version + initialized_at)→ 可选询问 language / pr_tool(URL 猜测 + 确认)/ worktree_dir;死键按未知键语义(不进 diff、重写时消失);删除代码智能探测节
- B2 七个 skill 的 12 处 `config.trunk` 改 `speccode default-branch --cwd .`(取 `branch` 字段):creating-worktree(基点判定)、creating-feature(前置校验 + initial_branch)、finishing-worktree / finishing-feature(路由与回退)、exploring(前置 pull 判定)、distilling-knowledge / recording-knowledge(trunk 防护);`config.remote` 引用同步清理
- B3 四个认知命令(exploring / proposing / brainstorming / distilling-knowledge)的「代码智能工具咨询」段替换为会话可见性模板;`skills/reset/SKILL.md` 去 code_intel_tools 提及
- B4 prose 守卫(`tests/verbs.test.mjs`):skills/ 下无 `config.trunk`、`config.remote`、`config.code_intel_tools`、`detect-code-intel-tools` 字样

## C. 文档

- C1 `CHANGELOG.md` `[Unreleased]`:Changed + **BREAKING**(删三字段与 detect verb/tool;升级路径:prose 改 `default-branch`,咨询改会话可见性;残留键容忍并可经二次 init 清理)+ Added(default-branch verb)
- C2 `AGENTS.md` 检查:若提及三字段则同步(grep 后多为无)

## D. 验证

- D1 全量 `node --test ./tests/*.test.mjs` 通过
- D2 手动冒烟:临时仓 makeRepo(master)跑 `default-branch` → fallback-master;设 `refs/remotes/origin/HEAD` 后 → remote-head;`echo '{"version":3,"initialized_at":"…","trunk":"main"}' | speccode write-config` 后 `lint-state`/`read-config` 零警告
- D3 grep:skills/ 无 `config.trunk|config.remote|config.code_intel_tools`;`lib/` 无 `code_intel_tools`/`detectCodeIntelTools` 残留
- D4 ledger 记一条:知识 environment/architecture 的 config 字段集与探测表述需收尾后开 knowledge 微 chore 刷新(D6)
