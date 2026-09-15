# studio/
> L2 | 父级: /CLAUDE.md

成员清单
studio-workspace.tsx: 对话生图工作台。发送后轮询 PENDING；出图在服务器完成，关页面再打开仍能看到结果。可从提示词卡片填入 composer，不自动发送。
studio-prompt-picker.tsx: 只读选用面板。打开时 GET /api/prompts，点卡片只回传文案；页脚链到 /prompts 管理。
studio-template-handoff.tsx: 消化 /studio?template=id，填入后 replace 清掉查询。

法则: 成员完整·一行一文件·父级链接·技术词前置
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
