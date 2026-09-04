# shared/
> L2 | 父级: /CLAUDE.md

成员清单
image-dropzone.tsx: 图片拾取器。点击与拖放收敛为 File[]，不编码不上传；挂载期间拦截窗口级文件 drop，避免浏览器打开本地文件。
back-to-top-button.tsx: 长页回顶按钮。
brand-console.tsx: 浏览器控制台品牌彩蛋，只打印一次。
chunk-reload-guard.tsx: ChunkLoadError 时会话内自动刷新一次。
confirm-dialog.tsx: 确认弹窗，portal 到 body。
notice-card.tsx: info/success/warning/error 提示卡。
page-header.tsx: 页头标题与描述。
project-output-config-card.tsx: 项目输出配置入口，详情页数量允许 0 张。
status-badge.tsx: 项目/任务状态徽章。

法则: 成员完整·一行一文件·父级链接·技术词前置
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
