# demo.tape — speccode README「See It in Action」GIF 源文件
# 重生成:vhs docs/assets/demo.tape(仓库根执行;需 vhs + ttyd + ffmpeg)
# 诚实级别:脚本化会话重放(design D3),README caption 明示 condensed
# 约束:画面内容不含版本号与测试数量字面量(design Risks)
# 清理:渲染会在 CWD 留下 fixture(d/ 与 d1-d4),渲染后 rm -rf d d1 d2 d3 d4
# 实现注记:vhs 0.11.0 的 Hide 失效(键入仍可见),故用「Ctrl+U 擦除 +
#   短真实命令(command cat dN)输出 ANSI 重写(\033[A\033[2K)」呈现假会话;
#   箭头字形 → 字体缺字形,一律用 ->。
Output docs/assets/demo.gif

Set FontSize 19
Set Width 1150
Set Height 600
Set Padding 42
Set Margin 0
Set LineHeight 1.3
Set Framerate 24
Set Theme "TokyoNight"
Set TypingSpeed 35ms
Set CursorBlink false
Set Shell "bash"

# Setup:最小提示符 + 4 个输出 fixture(1ms 快速键入,行尾 clear 自wipe)
Type@1ms "export PS1='\$ '; mkdir -p d && printf '\033[A\033[2K$ /speccode:init\n\033[32m✓\033[0m probed: trunk=main | remote=origin | pr_tool=gh\n\033[32m✓\033[0m .speccode/config.json written\n' > d1 && printf '\033[A\033[2K$ /speccode:creating-worktree\n\033[32m✓\033[0m feature/checkout-api in its own worktree\n\033[32m✓\033[0m baseline tests green\n' > d2 && printf '\033[A\033[2K$ /speccode:status\n  BRANCH                 STATUS           PROGRESS\n  feature/checkout-api   in_progress      6/12 tasks\n  bugfix/login-504       in_progress      3/9 tasks\n  refactor/search-index  pr_open         awaiting review\n\n  3 requirements in parallel · 1 awaiting review\n' > d3 && printf '\033[A\033[2K$ /speccode:finishing-worktree\n\033[32m✓\033[0m test gate passed\n\033[32m✓\033[0m PR opened: feature/checkout-api -> main\n' > d4 && clear" Enter
Sleep 400ms

# 1. init
Type@35ms "/speccode:init"
Sleep 250ms
Ctrl+U
Type@1ms "command cat d1" Enter
Sleep 1400ms

# 2. creating-worktree
Type@35ms "/speccode:creating-worktree"
Sleep 250ms
Ctrl+U
Type@1ms "command cat d2" Enter
Sleep 1400ms

# 3. status(主打:多需求并行总览)
Type@35ms "/speccode:status"
Sleep 250ms
Ctrl+U
Type@1ms "command cat d3" Enter
Sleep 2200ms

# 4. finishing-worktree
Type@35ms "/speccode:finishing-worktree"
Sleep 250ms
Ctrl+U
Type@1ms "command cat d4" Enter
Sleep 1800ms
