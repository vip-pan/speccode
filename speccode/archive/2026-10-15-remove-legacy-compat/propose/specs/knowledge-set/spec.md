# Delta: knowledge-set

## MODIFIED Requirements

### Requirement: 来源标记

知识文件 MUST 支持段落级来源标记:以 `<!-- distilled-from: cap/<slug> -->` 开始、`<!-- /distilled -->` 结束的蒸馏块,块外内容为 hand-written。`<slug>` 为能力键,MUST 匹配 `^[a-z0-9-]+$`;同一文件内能力键 MUST 唯一,写入侧检测到重复 MUST 报错拒绝(不得静默丢块)。块的出处(archive 归档包名 / spec capability 目录名)MUST 以纯文本记录在块 body 内,不参与身份与解析。

蒸馏块身份 = 能力键,写入语义为 upsert:同能力键的新块覆盖旧块,能力的演进以覆盖表达、不累积;知识退役即删,MUST NOT 留墓碑块(历史叙事归 archive/ 与 CHANGELOG)。

布局规范:hand-written 段在前、蒸馏块在后。replace-distilled 与 replace-hand 写入 MUST 输出该规范布局——存量文件首次写入时归位(hand-written 字节级保留、仅位置重排),此后幂等。蒸馏写入路径 MUST 仅重写蒸馏块,hand-written 内容字节级保留。

读侧 MUST 仅解析现行格式(distilled-from 能力键标记);历史旧格式 `<!-- promoted-from: <source> -->` … `<!-- /promoted -->` 标记与旧来源值(`archive/<名>/`、`spec/<名>/`)MUST NOT 被识别为蒸馏块,按 hand-written 普通字节对待(字节级保留、不参与块列表,由人工在重蒸闸门中清理)。写侧 MUST 只接受能力键格式。marker 解析失败 MUST 报错退出并提示人工检查,不静默、不猜测。

#### Scenario: 蒸馏保留手写内容

- WHEN 某 topic 文件同时含蒸馏块与 hand-written 段
- THEN 蒸馏重蒸后 hand-written 段与原内容逐字节一致(位置按布局规范归位)

#### Scenario: 旧格式标记不再解析

- WHEN topic 文件含旧格式 `<!-- promoted-from: <source> -->` … `<!-- /promoted -->` 标记或 distilled-from 值为 `archive/<名>/` 的存量块
- THEN 读侧 MUST NOT 将其识别为蒸馏块(不进入块列表、不参与 upsert 定位),字节按 hand-written 保留

#### Scenario: 标记格式损坏

- WHEN 蒸馏块 marker 解析失败(格式损坏)
- THEN 报错退出并提示人工检查,不静默、不猜测

#### Scenario: 能力键校验拒写

- WHEN 写入蒸馏块的 source 不匹配 `cap/<slug>` 格式,或同一文件内出现重复能力键
- THEN 写入前报错拒绝,不产生部分写入

#### Scenario: 首跑归位布局

- WHEN 存量 topic 文件的 hand-written 段位于蒸馏块之后,经 replace-distilled 或 replace-hand 写入
- THEN hand-written 段内容字节级不变、移至文件头部,蒸馏块依序随后;再次写入布局不变(幂等)

### Requirement: 蒸馏命令

`/speccode:distilling-knowledge` MUST 从 `speccode/spec/` 全量读、从 `speccode/archive/` **增量读**(只读尚未消费的归档包,纯读成本控制)以重蒸各 topic 的蒸馏块,产出候选 diff 展示给用户,经用户确认后才写 tracked 层(人工闸门);蒸馏结果与现状无差异时幂等跳过写。

**新鲜度审查(每次运行)**:distilling MUST 对全部蒸馏目标 topic 的全部既有蒸馏块做新鲜度审查,真值锚 = `speccode/spec/` 主规格;审查结论(块内容仍真 / 过时应改写 / 被取代应删除或合并)由 distiller 提议、闸门确认。删除或合并既有块 MUST 附理由。闸门 diff MUST 只展示变化块(新增 / 改写 / 删除),无变化块不进入展示。carry-forward、stale-by-source、superseded-by-package 机制退役:块的存废 MUST NOT 由「source 归档包是否仍在盘上 / 是否被新归档包取代 / 是否已消费」决定;同能力键重蒸产出新内容即 upsert 覆盖。

蒸馏目标 MUST 为:初始骨架 6 个 development topic ∪ `development/` 下用户自建 topic;蒸馏内容 MUST 限于 SDD 开发过程知识(架构、准则、环境、对接、坑与评审共识、安全)。变更元数据不属于蒸馏对象:归档包内文档的 frontmatter 字段(如 proposal.md 的 `tier:`)MUST NOT 单独成块,MUST NOT 混入正文蒸馏块,SHALL 仅作为理解变更体量与权重的参考上下文。蒸馏目标之外既存的 topic 文件,其蒸馏块 MUST 在闸门内逐块建议移除(日落),经用户确认后删除;其 hand-written 段 MUST 字节级保留,绝不自动修改。

旧格式标记(`promoted-from`/`/promoted`、旧 source 值)不再是蒸馏块的识别对象;存量文件中的此类标记字节按 hand-written 对待,重蒸闸门 MUST 提示人工清理对应残留,不做自动格式迁移、MUST NOT 提供专用迁移脚本。

蒸馏成功落盘后 MUST 把本次读过的归档包(含读了无产出的)追记进 `consumed_archives`(去重)。`_distilled.meta.json` 缺失时 MUST 做一次性全量读 archive,并用全部现有归档包种子 `consumed_archives` 创建该 sidecar;删除 sidecar 重跑仍是强制全量重读的官方逃生口,不另设 `--full` flag。

#### Scenario: 蒸馏无变化

- WHEN 新鲜度审查与重蒸结果与现状无差异
- THEN 跳过写入并报告「无变化」

#### Scenario: 增量只读未消费包

- WHEN `consumed_archives` 含包 A,归档目录新增包 B
- THEN 本次蒸馏只读包 B,包 A 整包跳过(读成本控制);包 A 既有蒸馏块仍进入新鲜度审查,不被误删、不因跳过读取而免审

#### Scenario: 首次增量引导

- WHEN `_distilled.meta.json` 不存在
- THEN 本次蒸馏做一次性全量读 archive,落盘后用全部现有归档包种子 `consumed_archives` 创建该 sidecar

#### Scenario: 删 sidecar 强制全量重读

- WHEN 用户删除 `_distilled.meta.json` 再跑 distilling-knowledge
- THEN 全部归档包变未消费 → 全量重读 + 重种子;既有块的新鲜度审查照常进行(重蒸本就每次全量)

#### Scenario: 退役知识删除附理由

- WHEN 新鲜度审查判定某既有块内容过时或被取代
- THEN 闸门展示删除/改写建议并附理由(面向知识真值,不区分来源包存废),用户确认后处置;不留墓碑块

#### Scenario: frontmatter 元数据不蒸馏

- WHEN 蒸馏读取的归档包 proposal.md 含 frontmatter `tier:` 字段
- THEN 该字段 MUST NOT 成为独立蒸馏块,MUST NOT 混入正文蒸馏块;仅可作为 distiller 理解变更体量的参考上下文

#### Scenario: 日落移除范围外 topic 的蒸馏块

- WHEN 存量项目存在蒸馏目标外的 topic 文件(如 business/domain.md)且含蒸馏块
- THEN 蒸馏闸门 MUST 展示「建议移除(该 topic 不在蒸馏目标内;若属业务知识,建议归外部 RAG)」选项;用户确认后块删除,同文件 hand-written 段与原内容逐字节一致;用户拒绝则块保留

#### Scenario: 旧格式残留提示人工清理

- WHEN 存量 topic 文件含旧格式 `promoted-from`/`/promoted` marker 或旧 source 值的残留字节
- THEN 重蒸闸门 MUST 提示人工清理该残留(作为 hand-written 字节呈现);MUST NOT 自动重写为能力键格式
