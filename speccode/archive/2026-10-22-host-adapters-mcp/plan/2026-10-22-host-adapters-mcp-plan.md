# host-adapters-mcp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** host-mapping 六文档承载 MCP 注册指引(四段式 + 总览 MCP 列 + 通用步骤双通道),守卫钉死,引擎零改动。

**Architecture:** 五份宿主文档各插统一模板的「MCP 注册」节(宿主配置形态各异、结构一致);README 总览表加列、CC 行补样例、通用步骤第 2 步扩双通道;`tests/host-mapping.test.mjs` 五守卫;AGENTS.md 一句 + CHANGELOG。

**Tech Stack:** markdown + node --test;零代码。

## Global Constraints

- 未经真机验证的宿主配置形态/工具名 MUST 标注「待验证」(`**待验证**` 形态,与既有纪律一致);ZCode/Codex/Kimi/OpenCode/Pi 的具体配置块形态未实测——给最接近的标准 stdio 形态 + 待验证标注。
- skill 正文零改动(skills/ 不引用 host-mapping 的契约不变);引擎/adapter manifest 零改动。
- MCP 注册节开头必有正交声明句(与 lite 降级表正交,两链路并行);`npx -y speccode-mcp` 与 `speccode-mcp` 两形态都出现;cwd 语义一句。
- 全量 `node --test ./tests/*.test.mjs`;每任务绿后提交。

---

### Task 1: host-mapping 六文档 + 守卫

**Files:**
- Modify: `references/host-mapping/{codex,kimi-code,zcode,opencode,pi}.md`(插 MCP 注册节 + 宿主注意追加开放项 + 工具映射表 MCP 行)
- Modify: `references/host-mapping/README.md`(总览表 MCP 列 + CC 行样例 + 通用步骤双通道)
- Test: `tests/host-mapping.test.mjs`(新)

**MCP 注册节模板**(五份统一结构,配置块按宿主形态填充,未实测标待验证):

```markdown
## MCP 注册

本节与 skill 正文的 lite 降级表正交:MCP 是引擎在场的一种形态——宿主原生 agent 经 MCP tools 直接使用引擎(tools 自描述、与 CLI verb 1:1 同名),skills 的裸调链路仍走 PATH,两条链路并行不互斥。

- **拉起命令**:`npx -y speccode-mcp`(首拉较慢;已 `npm i -g speccode` 时可直接 `speccode-mcp`)。
- **项目级配置**(可随 repo 共享;<宿主配置形态,**待验证**>):

```json
{
  "mcpServers": {
    "speccode": { "command": "npx", "args": ["-y", "speccode-mcp"] }
  }
}
```

- **`cwd` 语义**:省略时 = 宿主拉起 server 的工作目录(通常即项目根);tools 的 `cwd` 参数可逐调用覆盖。
```

五份的 <宿主配置形态> 各按其形:codex/zcode/kimi-code 标「宿主 MCP 配置入口,**待验证**(以上为标准 stdio 形态参考)」;opencode(opencode.json 的 mcp 段,标待验证);pi(扩展内启动子进程,标待验证)。

「宿主注意」尾追加(五份统一):

```markdown
### MCP 已知开放项(待真机验证)

- 宿主在 `initialize` 前发请求的行为(-32002 门禁是否需要):**待验证**
- `default-branch` 的 origin/HEAD 依赖(浅克隆/脚本环境 fallback 链):**待验证**
- 工具名暴露形态(如 `mcp__speccode__<verb>` 前缀):**待验证**
```

工具映射表增一行(五份统一):`| 引擎调用(MCP 形态) | tools/call <verb>(写类以 payload 参数;plugin-root tool 不存在,经 CLI 或 skill 目录兜底) |`

README 三处:①总览表加「MCP 注册」列(六行:CC = ✅ 已冒烟(claude mcp add / .mcp.json);五宿主 = ⚠️ 待验证);②CC 行映射载体列尾补一句 MCP 样例(`claude mcp add speccode -- npx -y speccode-mcp`);③通用步骤第 2 步改为:「把 speccode 引擎接入宿主(二选一,可并存):PATH 通道 `npm i -g speccode`(skills 裸调用需要)/ MCP 通道——按各文档「MCP 注册」节配置 `npx -y speccode-mcp`(宿主原生 agent 的 tools 使用;skills 裸调链路仍需 PATH)」。

- [x] **Step 1: 守卫先行(RED)** — `tests/host-mapping.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'references', 'host-mapping');
const HOSTS = ['codex', 'kimi-code', 'zcode', 'opencode', 'pi'];

test('each host doc has an MCP registration section with the standard shape', () => {
  for (const h of HOSTS) {
    const md = readFileSync(join(dir, `${h}.md`), 'utf8');
    assert.ok(md.includes('## MCP 注册'), `${h}.md lacks the MCP section`);
    for (const tok of ['npx -y speccode-mcp', 'speccode-mcp', 'cwd', '正交', 'mcpServers']) {
      assert.ok(md.includes(tok), `${h}.md MCP section missing: ${tok}`);
    }
    assert.ok(md.includes('## 安装') && md.includes('## 工具映射') && md.includes('## 宿主注意'), `${h}.md four-section shape`);
  }
});

test('unverified forms are marked and open items listed', () => {
  for (const h of HOSTS) {
    const md = readFileSync(join(dir, `${h}.md`), 'utf8');
    assert.ok(/\*\*待验证\*\*/.test(md), `${h}.md lacks 待验证 marking`);
    assert.ok(md.includes('MCP 已知开放项'), `${h}.md lacks open-items list`);
    for (const item of ['-32002', 'origin/HEAD', '工具名']) assert.ok(md.includes(item), `${h}.md open item missing: ${item}`);
  }
});

test('README carries the MCP column, CC sample, and dual-channel step', () => {
  const md = readFileSync(join(dir, 'README.md'), 'utf8');
  assert.ok(md.includes('MCP 注册'), 'overview table lacks MCP column');
  assert.ok(md.includes('claude mcp add speccode'), 'CC sample missing');
  assert.ok(/PATH 通道.*MCP 通道|MCP 通道.*PATH 通道/s.test(md), 'dual-channel step missing');
});

test('tool-mapping tables gain the MCP row', () => {
  for (const h of HOSTS) {
    const md = readFileSync(join(dir, `${h}.md`), 'utf8');
    assert.ok(md.includes('tools/call <verb>'), `${h}.md tool mapping lacks MCP row`);
  }
});

test('skills still never reference host-mapping', () => {
  const skillsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');
  for (const name of readdirSync(skillsDir)) {
    const md = readFileSync(join(skillsDir, name, 'SKILL.md'), 'utf8');
    assert.ok(!md.includes('host-mapping'), `skills/${name} references host-mapping`);
  }
});
```

Run: `node --test tests/host-mapping.test.mjs` — Expected: FAIL(前四条)

- [x] **Step 2: 应用六文档编辑(模板 + README 三处)** — GREEN
- [x] **Step 3: `node --test ./tests/*.test.mjs` 全绿(342 + 5 = 347)**
- [x] **Step 4: 提交** — `git add references/host-mapping/ tests/host-mapping.test.mjs && git commit -m "docs(host-mapping): MCP registration sections, overview column, dual-channel install"`

---

### Task 2: AGENTS.md + CHANGELOG + 验证

**Files:**
- Modify: `AGENTS.md`、`CHANGELOG.md`

- [x] **Step 1: AGENTS.md** 六宿主 adapter 叙述句(host-adapters 相关句,如「adapter 目录 = 分发配置」处)补:adapter 职责 = 注册 skills + 注册 MCP server(宿主 MCP 接线指引在 references/host-mapping/ 各文档「MCP 注册」节)。
- [x] **Step 2: CHANGELOG `[Unreleased]`** — `- Added: 宿主 MCP 接线指引——references/host-mapping 六文档新增「MCP 注册」节(标准 stdio:npx -y speccode-mcp;项目级配置可随 repo 共享)、总览表 MCP 列与双通道通用步骤、工具映射 MCP 行;-32002 / origin-HEAD / 工具名前缀为待真机验证开放项(引擎零预置);tests/host-mapping.test.mjs 守卫钉死。`
- [x] **Step 3: 验证** — 全量 347;grep:`grep -rn "host-mapping" skills/ | wc -l` = 0;`grep -c "MCP 注册" references/host-mapping/*.md` 六文件各 ≥1。
- [x] **Step 4: 提交** — `git add AGENTS.md CHANGELOG.md && git commit -m "docs: host MCP wiring guides — adapters register skills and the MCP server"`

---

## 计划自查

- 规格覆盖:「宿主映射文档」MODIFIED(四段式/注册节内容/README 三处)↔ T1;「宿主注册指引」ADDED(守卫/零预置)↔ T1 守卫 + T2 CHANGELOG 零预置句。
- 占位符:模板与守卫全文给定;五宿主配置形态的待验证标注规则明确。
- 一致性:`npx -y speccode-mcp` / `speccode-mcp` / `mcpServers` / `tools/call <verb>` 在模板、守卫、CHANGELOG 同形。
