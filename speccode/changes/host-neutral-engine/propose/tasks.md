# Tasks: host-neutral-engine

## 引擎

- [x] `lib/detect.mjs`:删除 `detectHost()`、`HOST_IDS` 与 env/dir/file 三族宿主标记探测;删除 `claudeProbes` 门控(恒全量探测);宿主相关注释同步清理
- [x] `bin/speccode.mjs`:VERBS 表移除 `detect-host`;`detect-code-intel-tools` 不再读取/传递 `config.host`、输出删除 `host` 字段
- [x] 全仓引擎代码 grep `detect-host\|config\.host\|detectHost\|HOST_IDS` 清零(lib/、bin/)

## 测试

- [x] `tests/detect.test.mjs`:删除 `detectHost` 及宿主标记用例;门控用例改为恒全量断言(任何环境下 `~/.claude` 探测均参与)
- [x] `tests/cli.test.mjs`:删除 `detect-host` verb 两组用例;`detect-code-intel-tools passes config.host` 用例改为输出形状断言(无 host 字段)
- [x] 新增用例:含 `host` 遗留字段的 config 下 `detect-code-intel-tools` / `read-config` 不报错
- [x] 全量测试绿:`node --test ./tests/*.test.mjs`

## 命令层

- [ ] `skills/init/SKILL.md`:删除「探测宿主」步骤(含确认/跳过分支)、config 字段说明中的 host 条目、「宿主切换注意」段;frontmatter description 去 host identity 字样

## 文档(双语同步)

- [ ] `docs/DESIGN.md` + `docs/DESIGN_CN.md`:config 字段集表述去 host(移入 MUST NOT 列表);探测来源表去「claude-code host / unrecorded host only」门控限定;detect-host 相关段落删除
- [ ] `AGENTS.md`:host 探测/记录相关表述同步(架构段、不变量段)
- [ ] `references/host-mapping/*.md`:各宿主文档中「detect-host」「config.host」「宿主标记」表述同步;zcode.md 页首「工具名核销后回写 host-detection 宿主标记」计划项随能力退役改写

## 验收

- [ ] 手动冒烟:`speccode detect-code-intel-tools --cwd .` 恒全量且输出无 host;`speccode detect-host` 返回未知 verb 错误;`speccode read-config` 对含 host 的旧 config 不报错
- [ ] 活文档全仓 grep `detect-host\|config\.host` 清零(CHANGELOG、speccode/archive/、.speccode/ 历史性提及豁免)
