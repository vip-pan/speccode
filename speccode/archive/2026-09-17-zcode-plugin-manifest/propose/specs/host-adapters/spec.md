# host-adapters Delta

## MODIFIED Requirements

### Requirement: 六宿主 adapter 清单与形态

仓库 SHALL 为六宿主各提供一份安装入口:Claude Code 走既有 `.claude-plugin/`(marketplace);Codex 为 `.codex-plugin/plugin.json`;Kimi Code 为 `.kimi-plugin/plugin.json`(含 `skillInstructions` 工具映射);ZCode 为 `.zcode-plugin/plugin.json`(**按官方 ZCode 插件形态**:键集 `name`/`version`/`description`/`author`/`license`/`skills`,值用官方目录名写法;`skillInstructions` 为 Kimi 专属字段,ZCode 不识别,MUST NOT 出现在 ZCode manifest——其工具映射语义由 `references/host-mapping/zcode.md` 承载);OpenCode 为 `.opencode/INSTALL.md`;Pi 为 `.pi/` 下扩展骨架与安装说明。`.zcode-plugin/plugin.json` 的 `version` MUST 与 `.claude-plugin/plugin.json` 一致(随版本发布纪律同 commit bump)。每个 adapter SHALL 仅声明指向共享 `skills/` 的引用与宿主差异映射,SHALL NOT 拷贝任何 skill 正文内容(单源纪律);adapter 目录 SHALL NOT 被声明进 plugin.json 打包组件。凡未经真机验证的 manifest schema、安装命令或宿主 API,相关文档 MUST 显式标注「待验证」。

#### Scenario: 六宿主入口齐备
- **WHEN** 检查仓库根
- **THEN** 存在 `.codex-plugin/plugin.json`、`.kimi-plugin/plugin.json`、`.zcode-plugin/plugin.json`、`.opencode/INSTALL.md`、`.pi/` 安装入口,且 `.claude-plugin/plugin.json` 既有形态不变

#### Scenario: manifest 合法且单源
- **WHEN** 解析三个 plugin.json 与 `.pi` 扩展骨架
- **THEN** 均为合法 JSON/TS,`skills` 字段指向共享 `skills/` 目录(如 `./skills/`,ZCode 用官方目录名写法 `skills`),正文无任何 skill 内容拷贝

#### Scenario: ZCode manifest 对齐官方形态
- **WHEN** 解析 `.zcode-plugin/plugin.json`
- **THEN** 键集恰为 `name`/`version`/`description`/`author`/`license`/`skills`,`version` 与 `.claude-plugin/plugin.json` 一致,`skills` 值为 `skills`,无 `skillInstructions` 及其余非官方键
