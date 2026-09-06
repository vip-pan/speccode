# Design:README 使用 demo(VHS)

## Context

- 根 README「See It in Action」是手写伪终端 transcript(spec 归属 plugin-packaging「文档三层分离」,「体验 demo」已是 SHALL 结构要素);README_CN.md 对应段结构一致。
- speccode 的 UI 是 AI 会话:引擎 verb 只吐单行 JSON,门面画面(status 多分支并行总览)由命令层渲染。真实会话含模型思考,量级为分钟——任何静态/录屏呈现必然是压缩重放。
- 上轮 readme-optimization 搁置「录制演示」的根因是手动录屏重录成本高;本仓 0.6→0.7 期间命令多次改名,腐烂风险真实存在。

## Goals

- README 用 ≤20s 的 GIF 传达「多需求并行 + 一条命令切分支」的体感;caption 诚实标注压缩重放(比现伪 transcript 隐含的实时性更诚实)。

## Non-Goals

- 不做教学教程(Quickstart 已承担);不重写文字 transcript(保留为全流程速览,与 GIF 职能互补);不做 YouTube/B 站视频;不动 ASCII 拓扑图;不改 DESIGN 文档。

## Decisions

- **D1 VHS 脚本化录制**。否「手工录屏」:重录成本高、必腐烂;否「视频外链」:难随版本更新、脱离本仓「一切皆文本」气质。`.tape` 是文本源,可 diff、可 review,重生成 = 一条命令。
- **D2 画面编排**:`/speccode:init` → `/speccode:creating-worktree` → `/speccode:status`(主打:多分支并行总览表)→ `/speccode:finishing-worktree`(test gate → PR opened);总时长 ≤20s。只用语义最稳的命令,降低改名腐烂率。
- **D3 tape 内容为脚本化会话重放**:VHS Type/Paste 预写输出(与现伪 transcript 同一诚实级别,且 caption 明示);真实 LLM 会话不可脚本化、录制耗时且带隐私路径。status 总览表按真实输出样式手工排版。
- **D4 资产入库 `docs/assets/`**:`.tape`(文本)+ `.gif`(1-2MB)一并进 git。外链托管不可 diff、会腐烂;1-2MB 换取版本化与可重生成,可接受。
- **D5 caption 诚实标注**:EN "Condensed replay — a real session includes Claude thinking between commands." / CN「压缩重放——真实会话中每条命令之间含模型思考」。
- **D6 双语引用同一 GIF**:终端内容英文天然语言中立,两版 section 措辞各自语言,资产单份,同步面仅两段文字。

## Risks

- demo 腐烂(命令改名)→ 只用最稳命令 + `.tape` 重生成;列入 tasks 校验。
- GIF 体积超预算 → 降帧(Output fps)、降尺寸、缩时长;>2MB 即回退重生成。
- 版本号/测试数出镜违反「不硬编码」纪律 → tape 内容避开,校验任务列入 tasks.md。
- 录制环境需安装 VHS(`brew install vhs`,带 ttyd/ffmpeg 依赖)→ 一次性本机环境动作,applying 时询问。

## Open Questions

(无)
