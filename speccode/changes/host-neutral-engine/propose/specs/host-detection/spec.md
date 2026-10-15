# host-detection Delta: host-neutral-engine

## REMOVED Requirements

### Requirement: 宿主身份探测

引擎 MUST NOT 提供宿主身份探测能力:`detect-host` verb 从 CLI 移除(未知 verb 按既有契约返回 `{ok:false,error}` + exit 1),env/dir/file 三族宿主标记探测逻辑从 `lib/detect.mjs` 删除;`config.host` 字段退役(见 speccode-config-management「config.json 字段集」的 MUST NOT 列表),宿主身份 MUST NOT 落盘。宿主差异知识仅存在于安装层(adapter 目录与 references/host-mapping/ 文档),运行时对任何宿主行为完全一致。

#### Scenario: detect-host verb 不复存在

- **WHEN** 执行 `speccode detect-host --cwd . --host zcode`
- **THEN** 返回 `{ok:false,error}`(未知 verb)且 exit 1,MUST NOT 有任何探测输出

#### Scenario: init 不再询问宿主

- **WHEN** 用户执行 `/speccode:init`(全新或幂等)
- **THEN** 流程 MUST NOT 包含宿主探测/确认步骤,产出的 config MUST NOT 含 `host` 字段

### Requirement: code_intel 探测按宿主分流

`detect-code-intel-tools` MUST NOT 读取或依赖任何宿主身份输入:探测恒为全量(项目 `.mcp.json`、`~/.claude/plugins/installed_plugins.json`、`~/.claude.json`、`command -v` bin、项目配置目录全部开启),verb 输出 MUST NOT 含 `host` 字段。该行为与门控删除前「host 缺失时的全量探测分支」完全一致。

#### Scenario: 任意环境恒全量探测

- **WHEN** 在任何宿主/环境下执行 `speccode detect-code-intel-tools --cwd .`,且注入的 homeDir 下存在 `~/.claude` 探测命中物
- **THEN** 探测结果 MAY 含来自 `~/.claude/plugins` 或 `~/.claude.json` 的 evidence,输出 MUST NOT 含 `host` 字段

#### Scenario: 既有含 host 的 config 不阻断

- **WHEN** `config.json` 含历史遗留的 `host` 字段时执行 `detect-code-intel-tools --cwd .`
- **THEN** 探测正常执行(恒全量,该字段被忽略),MUST NOT 报错
