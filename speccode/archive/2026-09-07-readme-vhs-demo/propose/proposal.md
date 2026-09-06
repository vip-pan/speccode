---
tier: 1
---

# README 使用 demo(VHS 录制 GIF)

## Why

README 零视觉讲解内容:唯一的「视觉槽位」See It in Action 是手写伪终端 transcript。竞品 superpowers 以 demo GIF 开场;上轮 readme-optimization(2026-08-16)已把「录制演示」列为搁置项(手动录制成本高、易腐烂)。VHS 脚本化录制把重录成本降到「改文本 + 跑一条命令」。

## What Changes

- 新增 `docs/assets/demo.tape`(VHS 脚本源,文本、可 diff、可重生成)与 `docs/assets/demo.gif`(≤20s,体积目标 1-2MB)
- 根 `README.md` / `README_CN.md` 的「See It in Action / 看它干活」重造为「GIF + 文字 transcript + caption」三件套;caption 诚实标注会话为压缩重放
- 两版引用同一 GIF(终端内容英文,天然语言中立)
- 无 BREAKING

## Capabilities

- `plugin-packaging`(MODIFIED:文档三层分离——根 README 体验 demo 要素)

## Impact

- 根 README.md / README_CN.md(仅体验 demo 段;文字 transcript 保留原样,职能为全流程速览)
- 新目录 `docs/assets/`(tape + gif 两个文件)
- 仓库体积 +1-2MB(git 历史永久;marketplace clone 随之,已在设计评估可接受)
- 不改动:`.gitignore`、ASCII 拓扑图、`docs/DESIGN*`、`AGENTS.md`
