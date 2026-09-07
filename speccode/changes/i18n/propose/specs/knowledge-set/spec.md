## MODIFIED Requirements

### Requirement: 知识集目录结构

speccode MUST 支持 tracked 知识集目录 `speccode/knowledge/`,包含 `_index.md` 检索索引与按主题组织的 topic 文件(初始骨架:development/architecture.md、development/standards.md、development/environment.md、development/integrations.md、development/pitfalls.md、development/security.md),topic 清单可演进(用户可经 recording-knowledge 在 `development/` 下新建 topic)。知识集 MUST 只策展 SDD 开发过程知识;业务知识 MUST NOT 进入初始骨架,由外部 RAG 系统维护。

`_index.md` MUST 由实扫现有 topic 文件(跳过内容为空的 topic 文件)按顶层目录名分组生成,不得硬编码固定 section 清单。`_index.md` 的标题行文本 MUST 由调用方经 `write-knowledge` mode index 的 `heading` 字段供给(lib `buildIndex` 不内嵌任何语言文本,保持语言中立);`heading` 缺失时该调用 MUST 失败(`{ok:false, error}`)且不落盘。

#### Scenario: 新项目无知识集

- WHEN 项目尚无 `speccode/knowledge/` 目录
- THEN 消费入口静默跳过;distilling-knowledge 或 recording-knowledge 首次运行时创建骨架(目录 + `_index.md` + 6 个初始 development topic 空文件),MUST NOT 创建 business/ 目录

#### Scenario: 索引缺失但 topic 文件存在

- WHEN `_index.md` 缺失但 topic 文件存在
- THEN distilling-knowledge 或 recording-knowledge 运行时用 buildIndex 重建 `_index.md`,sections 按实扫结果的顶层目录名分组

#### Scenario: 索引标题语言中立

- WHEN 命令以 config.language 所指语言的标题文本调用 `write-knowledge` mode index
- THEN `_index.md` 的 H1 为调用方供给的标题;payload 缺 `heading` 时调用 MUST 返回 `{ok:false, error}` 且不落盘

#### Scenario: 存量 business topic 自然消失

- WHEN 存量项目的 business/*(或任何蒸馏目标外 topic)的蒸馏块经日落闸门移除,且文件无 hand-written 内容残留(文件为空)
- THEN 下次重建 `_index.md` 时该空 topic 文件 MUST 不被收录(实扫跳过空文件),条目自然消失;文件本身留在盘上,由用户自行处置
