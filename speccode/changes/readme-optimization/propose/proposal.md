---
tier: 1
---

# proposal: readme optimization(round 2)

## Why

README 双语门面自 0.7.0 前定稿后积累四处可优化点(探索结论见分支 memory):动手链被理论节拆散、开篇 60+ 词长句难读、`.speccode/` 存在认知缺口(正文首次提及即是结尾 git clean 警告)、两处时效性偏差(对比表 ZCode 验证状态滞后于 0.7.2 实证;demo GIF 的 init 输出落后于 0.7.1 起的语言询问)。

## What Changes

- 动线轻排:`Quickstart` 与 `Prerequisites` 两节上移紧邻 `Install`,其余节序不动(EN/CN 镜像)
- 开篇瘦身:首段长句拆为一句 tagline + 三句正文,先「对你做什么」再「怎么构成」(EN/CN 镜像)
- 新增 `What lands in your repo` 小节(Quickstart 之后):`speccode/`(规格文档,git tracked,随 PR 上 trunk)vs `.speccode/`(运行时状态,untracked-by-design),为结尾 `git clean` 警告补前文(EN/CN 镜像)
- 时效性修正:对比表「多宿主安装」行 `CC verified` → `CC + ZCode verified`(0.7.2 安装通路实证核销);`demo.tape` init fixture 补语言询问行并重录 `demo.gif`;README 控制台 transcript 的 init 输出同步补行

无 BREAKING、无代码改动、无规格语义变更(门面纪律全部继续成立:双语同数同序、无版本号/测试数量字面量、demo caption 保持 condensed 诚实标注)。

## Capabilities

(空 delta——门面内容优化,轻档)

## Impact

- `README.md`、`README_CN.md`、`docs/assets/demo.tape`、`docs/assets/demo.gif`
- 双语结构锚变化:14 节 → 15 节(新增 1 节),EN/CN 保持同数同序
