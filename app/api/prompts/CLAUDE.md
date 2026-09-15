# prompts/
> L2 | 父级: /CLAUDE.md

成员清单
route.ts: GET 工作区提示词列表，POST 新建卡片（必须带效果图 data URL）。登录用户共用一张库。
[id]/route.ts: GET 单卡片，PATCH 更新标题/文案/效果图，DELETE 同时清 prompts/{id} 磁盘。

法则: 成员完整·一行一文件·父级链接·技术词前置
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
