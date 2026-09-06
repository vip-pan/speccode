# Tasks:readme-vhs-demo

## 环境与资产

- [x] 安装 VHS(`brew install vhs`;本机已有则跳过)
- [x] 编写 `docs/assets/demo.tape`:按 design D2 画面编排(init → creating-worktree → status 主打并行总览 → finishing-worktree),Output 控制尺寸/帧率,内容避开版本号与测试数量
- [x] `vhs docs/assets/demo.tape` 生成 `docs/assets/demo.gif`,核对体积 ≤2MB(超出则降帧/缩时长重生成)

## README 三件套

- [ ] 改 `README.md`「See It in Action」:段首 GIF 引用 + 英文 caption(design D5),文字 transcript 保留原样
- [ ] 改 `README_CN.md`「看它干活」:同步三件套结构与中文 caption,与 EN 版结构一一对应

## 校验

- [ ] 两版结构与措辞对应;demo 段、caption 与 tape 源 grep 无硬编码版本号/测试数量
- [ ] `node --test ./tests/*.test.mjs` 全绿(回归)
