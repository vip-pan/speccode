# memory-lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 记忆归属分支键驱动——`<type>/<slug>` 的记忆落其 state 登记的 worktree(主仓退化为保留键/父实体/回退三层居所),承接升级跨目录事务,finishing 清理必经,`list-memory` 聚合双目录;verb/tool 调用形状零变化。

**Architecture:** `lib/memory.mjs` 增 `memoryHomeDir(speccodeDir, state)` / `memoryPathFor(...)` / `ensureMemoryDir(dir)`,read/write/purge/rename 四函数加 state 参数按其解析;`renameMemory` 跨目录(同设备 renameSync,EXDEV → 原子写目标 + unlink 源,可注入 rename 实现);`lib/verbs.mjs` 的 memory verb 接线(保留键 `_` 前缀跳过 state 查询)+ `list-memory` 聚合(主仓 + state 登记各 active worktree,条目带 `home`);六个行为触点 skill 的精确 prose 替换。

**Tech Stack:** Node ≥ 24,纯 ESM,仅 `node:` 内置;`node --test`;`makeRepo()` 真实临时仓 + `git worktree add`。

## Global Constraints

- 归属判定唯一真源 = state(`worktree` 字段);MUST NOT 引入 cwd 驱动或 config 映射。
- verb/tool 名与 CLI 形状零变化;MCP parity 动态;`_knowledge` / `_exploring/*` 恒主仓。
- 两处 memory 目录均自忽略(`.gitignore` 内容 `*`,幂等,不碰用户 .gitignore)——沿用 writeMemory 既有机制,提取为 `ensureMemoryDir`。
- rename 语义:目标已存在 MUST 拒绝;EXDEV 兜底 = writeTextAtomic 目标 + unlink 源(中间崩溃最坏双份,读侧以目标为优先);rename 实现可注入(`opts.rename`,缺省 renameSync)供 EXDEV 单测。
- append 模式 O_APPEND 单次写与条目边界规则不变;`topics` 字段形状不变;`files` 条目新增 `home: "main" | "worktree"`,`completed` 三态语义不变。
- 九个透明消费者(proposing/brainstorming/writing-plans/applying/executing-plans/subagent-driven-development/syncing/archiving/distilling/recording)prose 零改动,plan 含 grep 验证(无 `.speccode/memory` 直读路径假设、无「主仓共享一份」表述残留)。
- CHANGELOG 只改 `[Unreleased]`,非 BREAKING(行为语义变化显式标注);知识文件不在本分支改。
- 全量测试 `node --test ./tests/*.test.mjs`;单用例 `node --test --test-name-pattern="<name>" tests/<file>`;每任务绿后立即提交。

---

### Task 1: `lib/memory.mjs` 归属解析 + 跨目录 rename(纯 lib + 单测)

**Files:**
- Modify: `lib/memory.mjs`
- Test: `tests/memory.test.mjs`

**Interfaces:**
- Consumes: `writeTextAtomic`(atomic.mjs)、`branchToStateName`/`validateBranch`/`validateSlug`(slug.mjs)
- Produces:
  - `export function memoryHomeDir(speccodeDir, state)`——`state?.worktree` 为非空字符串 → `join(state.worktree, '.speccode', 'memory')`;否则 `memoryDir(speccodeDir)`
  - `export function memoryPathFor(speccodeDir, state, branch)`
  - `export function ensureMemoryDir(dir)`(mkdir + 自忽略 .gitignore,幂等;writeMemory 内联块提取为此)
  - `readMemory(speccodeDir, state, branch)` / `writeMemory(speccodeDir, state, branch, content, mode)` / `purgeMemory(speccodeDir, state, branch)`——签名加 state,内部走 `memoryPathFor`
  - `renameMemory(speccodeDir, fromState, toState, from, to, opts = {})`——双端各自解析;`opts.rename`(缺省 `renameSync`)抛 `code:'EXDEV'` 时回退 `writeTextAtomic(dst, readFileSync(src)) + rmSync(src)`
  - `export function listMemoryKeysIn(dir)`(现 `listMemoryKeys` 的目录参数化版;`listMemoryKeys(speccodeDir)` 保留为薄壳)
  - 旧 `memoryPath(speccodeDir, branch)` 保留导出(主仓直连语义,内部使用)

- [x] **Step 1: 写失败测试(追加到 `tests/memory.test.mjs`;既有用例的旧签名调用改为补 `null` state——主仓语义不变)**

```js
test('memoryHomeDir: reserved/unregistered → main; registered worktree → worktree dir', () => {
  const sd = join(repo, '.speccode');
  assert.equal(memoryHomeDir(sd, null), join(sd, 'memory'));
  assert.equal(memoryHomeDir(sd, { worktree: null }), join(sd, 'memory'));
  assert.equal(memoryHomeDir(sd, { branch: 'feature/x', worktree: '/wt/x' }), join('/wt/x', '.speccode', 'memory'));
});

test('memoryPathFor encodes the same double-underscore name in either home', () => {
  assert.equal(memoryPathFor('.sc', { worktree: '/w' }, 'feature/pay'),
    join('/w', '.speccode', 'memory', 'feature__pay.md'));
  assert.equal(memoryPathFor('.sc', null, '_knowledge'), join('.sc', 'memory', '_knowledge.md'));
});

test('writeMemory with state lands inside the worktree home and self-ignores it', () => {
  const wt = mkdtempSync(join(tmpdir(), 'mem-wt-'));
  const p = writeMemory('.sc', { worktree: wt }, 'feature/x', 'hello', 'replace');
  assert.equal(p, join(wt, '.speccode', 'memory', 'feature__x.md'));
  assert.equal(readFileSync(p, 'utf8'), 'hello');
  assert.equal(readFileSync(join(wt, '.speccode', 'memory', '.gitignore'), 'utf8'), '*\n');
  rmSync(wt, { recursive: true, force: true });
});

test('renameMemory moves across directories on one filesystem', () => {
  const a = mkdtempSync(join(tmpdir(), 'mem-a-')); const b = mkdtempSync(join(tmpdir(), 'mem-b-'));
  writeFileSync(join(a, '_exploring__t.md'), 'notes');
  const dst = renameMemory('.sc', null, { worktree: b }, '_exploring/t', 'feature/t');
  assert.equal(dst, join(b, '.speccode', 'memory', 'feature__t.md'));
  assert.ok(!existsSync(join(a, '_exploring__t.md')));
  assert.equal(readFileSync(dst, 'utf8'), 'notes');
  rmSync(a, { recursive: true, force: true }); rmSync(b, { recursive: true, force: true });
});

test('renameMemory EXDEV falls back to atomic-write + unlink', () => {
  const a = mkdtempSync(join(tmpdir(), 'mem-a-')); const b = mkdtempSync(join(tmpdir(), 'mem-b-'));
  writeFileSync(join(a, '_exploring__t.md'), 'notes');
  const exdev = Object.assign(new Error('cross-device link'), { code: 'EXDEV' });
  const dst = renameMemory('.sc', null, { worktree: b }, '_exploring/t', 'feature/t',
    { rename: () => { throw exdev; } });
  assert.equal(readFileSync(dst, 'utf8'), 'notes');
  assert.ok(!existsSync(join(a, '_exploring__t.md')));
  rmSync(a, { recursive: true, force: true }); rmSync(b, { recursive: true, force: true });
});

test('renameMemory target-exists refusal works across directories', () => {
  const a = mkdtempSync(join(tmpdir(), 'mem-a-')); const b = mkdtempSync(join(tmpdir(), 'mem-b-'));
  writeFileSync(join(a, '_exploring__t.md'), 'x');
  mkdirSync(join(b, '.speccode', 'memory'), { recursive: true });
  writeFileSync(join(b, '.speccode', 'memory', 'feature__t.md'), 'existing');
  assert.throws(() => renameMemory('.sc', null, { worktree: b }, '_exploring/t', 'feature/t'), /already exists/);
  rmSync(a, { recursive: true, force: true }); rmSync(b, { recursive: true, force: true });
});
```

(按 `tests/memory.test.mjs` 既有 import/helper 风格适配;`'.sc'` 等占位 speccodeDir 只作字符串拼接,不触盘。)

- [x] **Step 2: 运行确认失败**

Run: `node --test tests/memory.test.mjs`
Expected: FAIL — 新导出缺失 / 新签名不匹配

- [x] **Step 3: 写实现**(按 Interfaces 逐条;`ensureMemoryDir` 替换 writeMemory 内联块;`renameMemory` 尾部按 Interfaces 的 opts/EXDEV 形态;文件头注释更新为分支键驱动归属叙述)

- [x] **Step 4: 运行确认通过**

Run: `node --test tests/memory.test.mjs`
Expected: PASS(既有用例 + 新 6 例)

- [x] **Step 5: 提交**

```bash
git add lib/memory.mjs tests/memory.test.mjs
git commit -m "feat(memory): branch-keyed home resolution and cross-directory adoption rename"
```

---

### Task 2: verb 接线 + list 聚合 + e2e

**Files:**
- Modify: `lib/verbs.mjs`(read/write/purge/rename-memory 五处调用点 + list-memory 聚合)
- Test: `tests/cli.test.mjs`(新增 3 e2e;既有 memory e2e 回归)

**Interfaces:**
- Consumes: Task 1 全部新签名;`readState` / `listActiveFeatures`(state.mjs)
- Produces: `files` 条目 `{branch, completed, home}`;行为——分支键(非 `_` 前缀)的 memory verb 经 `readState(sd, branch)` 取 state 后解析;`_` 前缀键传 `null`

- [x] **Step 1: 写失败测试(追加到 `tests/cli.test.mjs`)**

```js
test('memory verbs are worktree-scoped for state-registered branches', () => {
  const repo = makeRepo();
  const wt = join(repo, 'wt1');
  runCli(repo, 'write-state', '--cwd', repo, '--branch', 'feature/alpha', '--json-stdin', JSON.stringify({
    branch: 'feature/alpha', type: 'feature', worktree: wt, merge_target: 'master',
    status: 'in_progress', created_at: '2026-01-01T00:00:00.000Z', initial_branch: 'master',
  }));
  const w = runCli(wt, 'write-memory', '--cwd', wt, '--branch', 'feature/alpha', '--json-stdin',
    JSON.stringify({ mode: 'replace', content: 'in-worktree' }));
  assert.equal(w.code, 0);
  assert.ok(w.json.path.startsWith(join(wt, '.speccode', 'memory')));
  const r = runCli(repo, 'read-memory', '--cwd', repo, '--branch', 'feature/alpha');
  assert.equal(r.json.memory, 'in-worktree');   // 主仓 cwd 也能读到 worktree 记忆(解析按 state)
  rmSync(repo, { recursive: true, force: true });
});

test('rename-memory adopts a topic from main into the registered worktree', () => {
  const repo = makeRepo();
  const wt = join(repo, 'wt1');
  runCli(repo, 'write-state', '--cwd', repo, '--branch', 'feature/beta', '--json-stdin', JSON.stringify({
    branch: 'feature/beta', type: 'feature', worktree: wt, merge_target: 'master',
    status: 'in_progress', created_at: '2026-01-01T00:00:00.000Z', initial_branch: 'master',
  }));
  runCli(repo, 'write-memory', '--cwd', repo, '--branch', '_exploring/topic-b', '--json-stdin',
    JSON.stringify({ mode: 'replace', content: 'exploration notes' }));
  const mv = runCli(repo, 'rename-memory', '--cwd', repo, '--branch', '_exploring/topic-b', '--to', 'feature/beta', '--json-stdin', '{}');
  assert.equal(mv.code, 0);
  assert.ok(mv.json.path.startsWith(join(wt, '.speccode', 'memory')));
  assert.ok(!existsSync(join(repo, '.speccode', 'memory', '_exploring__topic-b.md')));
  rmSync(repo, { recursive: true, force: true });
});

test('list-memory aggregates main and worktree homes with home annotation', () => {
  const repo = makeRepo();
  const wt = join(repo, 'wt1');
  runCli(repo, 'write-state', '--cwd', repo, '--branch', 'feature/gamma', '--json-stdin', JSON.stringify({
    branch: 'feature/gamma', type: 'feature', worktree: wt, merge_target: 'master',
    status: 'in_progress', created_at: '2026-01-01T00:00:00.000Z', initial_branch: 'master',
  }));
  runCli(repo, 'write-memory', '--cwd', repo, '--branch', '_exploring/t-a', '--json-stdin',
    JSON.stringify({ mode: 'replace', content: 'x' }));
  runCli(repo, 'write-memory', '--cwd', repo, '--branch', 'feature/gamma', '--json-stdin',
    JSON.stringify({ mode: 'replace', content: 'y' }));
  const l = runCli(repo, 'list-memory', '--cwd', repo);
  const byBranch = Object.fromEntries(l.json.files.map((f) => [f.branch, f]));
  assert.equal(byBranch['_exploring/t-a'].home, 'main');
  assert.equal(byBranch['feature/gamma'].home, 'worktree');
  assert.equal(byBranch['feature/gamma'].completed, false);
  assert.deepEqual(l.json.topics, ['_exploring/t-a']);
  rmSync(repo, { recursive: true, force: true });
});
```

(`write-state` 走既有 stdin helper 模式——若该文件用 `runCliStdin` 形态,按其约定适配;`worktree` 路径无需真实 `git worktree add`,state 登记即驱动解析。)

- [x] **Step 2: 运行确认失败**(三个新 e2e:写仍落主仓)

- [x] **Step 3: 实现**——`lib/verbs.mjs`:
  - 模块内 helper:`const memoryStateFor = (sd, branch) => branch.startsWith('_') ? null : readState(sd, branch);`
  - read/write/purge/rename 四处调用点改传 `memoryStateFor(sd, branch/ from | to)`;rename 用 `renameMemory(sd, memoryStateFor(sd, from), memoryStateFor(sd, to), from, to)`
  - `list-memory`:主仓扫描(现有 join 逻辑,条目加 `home: 'main'`)+ 追加遍历 `listActiveFeatures(sd)` 中 `typeof f?.worktree === 'string' && f.worktree` 的分支,对 `join(f.worktree, '.speccode', 'memory')` 调 `listMemoryKeysIn`,产出 `{branch, completed: f.status === WORKTREE_STATUS.COMPLETED, home: 'worktree'}`;目录不存在跳过;按 branch 去重(主仓优先)
- [x] **Step 4: 运行确认通过**(`node --test tests/cli.test.mjs tests/memory.test.mjs tests/verbs.test.mjs tests/mcp.test.mjs`;parity 不变)

- [x] **Step 5: 提交**

```bash
git add lib/verbs.mjs tests/cli.test.mjs
git commit -m "feat(engine): worktree-scoped memory verbs and aggregated list-memory with home"
```

---

### Task 3: 六个行为触点 prose + 守卫

**Files:**
- Modify: `skills/creating-worktree/SKILL.md`(承接步)、`skills/creating-feature/SKILL.md`(承接步)、`skills/finishing-worktree/SKILL.md`(清理节 + 提示行)、`skills/finishing-feature/SKILL.md`(收尾步)、`skills/status/SKILL.md`(记忆渲染行)、`skills/exploring/SKILL.md`(衔接段两句)
- Test: `tests/cli.test.mjs`(新增守卫)

**Interfaces:**
- Consumes: Task 1–2 的行为(跨目录承接、purge 定位、聚合)
- Produces: prose 与新语义一致;守卫钉死无旧表述

- [x] **Step 1: 写失败守卫(`tests/cli.test.mjs`)**

```js
test('memory lifecycle wording: no main-shared memory narrative; purge is mandated', () => {
  const skillsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');
  const banned = [/多个 worktree 共享(一份|同一份) memory/, /主仓定位使同 feature 多 worktree 共享/];
  const finWt = readFileSync(join(skillsDir, 'finishing-worktree', 'SKILL.md'), 'utf8');
  assert.ok(/purge-memory/.test(finWt) && /worktree remove/.test(finWt), 'finishing-worktree must purge before worktree remove');
  for (const name of readdirSync(skillsDir).sort()) {
    const md = readFileSync(join(skillsDir, name, 'SKILL.md'), 'utf8');
    for (const re of banned) assert.ok(!re.test(md), `skills/${name} still claims shared main memory`);
  }
});
```

- [x] **Step 2: prose 精确替换**(old→new;以 grep 定位现文)**

1. `creating-worktree` 承接步(第 5 条):句尾追加——「;target 经 state 解析落**本 worktree** 的 `.speccode/memory/`(引擎跨目录移动,主仓 topic 文件随之消失)。move 失败不回滚 worktree——最坏是 topic 原地保留供续探。」
2. `creating-feature` 承接步(第 3 条):句尾追加——「;父实体无 worktree,主记忆留在主仓(rename 为主仓内移动)。子需求的记忆事务与普通需求同构(见 creating-worktree)。」
3. `finishing-worktree` 清理节:在「worktree remove --force」前插入一步——「**purge 分支记忆**:`speccode purge-memory --cwd . --branch <branch>`(MUST 先于 `git worktree remove`——worktree 内未跟踪的记忆目录会卡 remove;丢弃路径经 --force 连记忆一起消亡,亦符合本轮笔记定位)」;第 68 行可选提示改为——「任一完成路径在报告后附注:分支记忆已随清理消亡(本地 squash 汇入或 PR MERGED);经 `PR+不等待` 保留 worktree 的路径,记忆仍留该 worktree,续跑 `--resume` 时可见。」
4. `finishing-feature` 收尾节(第 5 条写记忆之后、状态报告之前)插一步——「**purge 父主记忆**:`speccode purge-memory --cwd . --branch <父分支>`(父记忆在主仓,终局清理)。」
5. `status` 记忆渲染行(第 14 条):改为——「运行 `speccode list-memory --cwd .`;`files` 条目按 `home` 标注归属(`main` = 主仓目录,`worktree` = 该分支 worktree 内,随收尾消亡);`completed:true` 且 `home:"main"` 的条目为滞留(如收尾异常遗留),报告一行提示可经 `purge-memory` 清理。」
6. `exploring` 衔接段「写记忆(按归属)」块:句尾追加一句——「topic 记忆临时落**主仓**(untracked,拒建分支则原地保留);移入分支发生在 creating-worktree / creating-feature 的承接事务内(先建后移)。」

- [x] **Step 3: 运行确认通过**(`node --test tests/cli.test.mjs`——新守卫 + 既有全部 prose 守卫)

- [x] **Step 4: 透明消费者验证**:`grep -rn "\.speccode/memory\|主仓共享\|共享一份" skills/ | grep -v "skills/\(exploring\|creating-worktree\|creating-feature\|finishing-worktree\|finishing-feature\|status\)/"` → 仅允许命中不含路径假设的叙述(逐条目检;有直读路径假设则改 verb 调用并记录)

- [x] **Step 5: 提交**

```bash
git add skills/ tests/cli.test.mjs
git commit -m "docs(skills): memory belongs to its worktree — adoption transaction, mandated purge, aggregated status"
```

---

### Task 4: CHANGELOG + AGENTS.md + 验证

**Files:**
- Modify: `CHANGELOG.md`、`AGENTS.md`(一条不变量补句)

- [x] **Step 1: CHANGELOG `[Unreleased]`**

```markdown
- Changed: memory 归属分支键驱动——`<type>/<slug>` 记忆落其 state 登记的 worktree(`.speccode/memory/`,自忽略),主仓退化为保留键/父实体/回退三层居所;承接升级跨目录事务(先建后移,EXDEV 兜底);finishing-worktree 在 worktree remove 前必经 purge、finishing-feature 清父主记忆;`list-memory` 聚合双目录并标注 `home`。调用形状(verb/tool/CLI)零变化;行为语义:同 feature 多 worktree 不再共享记忆(定位 = 本轮工作笔记,持久知识归 knowledge/ 与 archive/)。
```

- [x] **Step 2: AGENTS.md「memory 走 writeTextAtomic」不变量条**补一句:「记忆归属分支键驱动:分支记忆在其 state 登记的 worktree 内,保留键与父主记忆在主仓(`memoryHomeFor`)。」

- [x] **Step 3: 全量 + 事务冒烟**

```bash
node --test ./tests/*.test.mjs                                    # 全绿
T=$(mktemp -d) && git -C "$T" init -q -b master && cd "$T" && git config user.email t@t && git config user.name t && echo x > README.md && git add . && git commit -qm i
git worktree add "$T/wt" -b feature/smoke && node $OLDPWD/bin/speccode.mjs write-state --cwd . --branch feature/smoke --json-stdin <<< '{"branch":"feature/smoke","type":"feature","worktree":"'"$T"'/wt","merge_target":"master","status":"in_progress","created_at":"2026-01-01T00:00:00Z","initial_branch":"master"}'
node $OLDPWD/bin/speccode.mjs write-memory --cwd . --branch _exploring/smoke --json-stdin <<< '{"mode":"replace","content":"notes"}'
node $OLDPWD/bin/speccode.mjs rename-memory --cwd . --branch _exploring/smoke --to feature/smoke --json-stdin <<< '{}'
ls "$T/.speccode/memory/" "$T/wt/.speccode/memory/"               # 主仓仅 .gitkeeper 无 topic;wt 有 feature__smoke.md
node $OLDPWD/bin/speccode.mjs purge-memory --cwd . --branch feature/smoke
cd - && rm -rf "$T"
grep -rn "memoryPath(speccodeDir" lib/ | grep -v memory.mjs | wc -l   # 0(verbs 全走 memoryPathFor/新签名)
```

- [x] **Step 4: 提交**

```bash
git add CHANGELOG.md AGENTS.md
git commit -m "docs: memory lifecycle — worktree-owned branch memory with mandated cleanup"
```

---

## 计划自查

- **规格覆盖**:「memory 文件位置与命名」MODIFIED ↔ T1(归属)+ T3-1/6;「read/write verb」MODIFIED(解析 + 跨目录 rename)↔ T1/T2;「可见性与清理」MODIFIED(聚合 + purge 必经)↔ T2/T3-3/4/5;「事务化承接」ADDED ↔ T3-1/2 + T4 冒烟;tasks B7/D3 ↔ T3-4;D4 知识 micro-chore ↔ 收尾 ledger。
- **占位符扫描**:无 TBD;lib 代码与测试完整;prose 六处 old→new。
- **类型一致性**:`memoryHomeDir/memoryPathFor/ensureMemoryDir/listMemoryKeysIn` 与 `opts.rename` 在 T1 定义、T2 消费;`home` 字段三处(spec/prose/test)同值域。
