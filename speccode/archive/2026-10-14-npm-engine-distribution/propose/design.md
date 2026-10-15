# Design: npm-engine-distribution

## Context

探索结论(记忆 `_exploring/host-neutral-engine` → 本分支):npm bin 机制让 `speccode` 进 PATH 成为包管理器的职责;agent-skills 的 `npx skills add` 安装器与 Claude Code 自身(`npm i -g @anthropic-ai/claude-code`)都是该模式的实证。host-neutral-engine 已把引擎从宿主感知中解放,本变更补分发通道。

## Goals

- `npm i -g speccode` 后,任何宿主的 skill 裸调 `speccode <verb>` 直接命中。
- 版本单一真源纪律延续:npm 包版本 = 双 manifest 版本,守卫测试钉死。
- npm 包内容 = 插件组件边界(bin/lib/skills/hooks/references),不泄漏本仓自用内容。
- 发布合流:发版分支打 tag 既有动作不变,npm publish 由 tag 触发的 CI 完成。

## Non-Goals

- 改动 `scripts/install-shim.sh`(git 直装用户仍用它;两通道并存)。
- 把 skill 层安装也搬到 npm(npm 只装引擎;宿主插件承载 skill,各宿主机制不同)。
- 实际执行 `npm publish`(需 npm 凭据,发版时由 CI + NPM_TOKEN 完成;本变更交付发布通路)。
- engine verb 行为变化(零改动;纯分发层)。

## Decisions

1. **bin 指 `bin/speccode.mjs` 而非 sh wrapper**:.mjs 自带 `#!/usr/bin/env node`,npm 对 bin 自动 chmod;Windows 由 npm 生成 .cmd/.ps1 垫片(sh-only wrapper 无此待遇)。repo 内 wrapper `bin/speccode` 保留(install-shim 与 git 直装的用户)。
2. **`files` 白名单而非 .npmignore**:白名单与 plugin.json 打包边界同构——「进包 = 插件组件」一条规则;黑名单会随仓库新增目录漂移。
3. **`version` 不做构建期注入**:三处(package.json + 双 manifest)同步靠守卫测试 + 发版纪律(CHANGELOG 单一数据源不变),不引入生成步骤(保持无 build 的仓库不变量)。
4. **CI 触发 = `v*` tag push**:与发版纪律(打 v tag + GitHub Release)同锚点;无 tag 不发布,杜绝 main 直发。被否备选:GitHub Release 事件触发——多一步人工动作,且 tag 即版本真源。

## Risks

- **NPM_TOKEN 未配置 → 发布步失败** → 缓解:workflow 明确报错;README/AGENTS 注明一次性 secret 配置;失败不影响 tag/Release 既有产物。
- **版本漂移(三处不同步)** → 缓解:守卫测试在 CI 先行拦截;发版分支流程本就 bump 双 manifest,加 package.json 一处。
- **npm 包与 marketplace cache 两份引擎并存** → 缓解:PATH 命中顺序由安装顺序决定,行为等价(引擎按目标项目 repoRoot 工作,与安装位置无关——知识集既有结论);文档建议同一台机器二选一。

## Open Questions

无。
