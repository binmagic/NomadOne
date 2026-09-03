# studio/
> L2 | 父级: /CLAUDE.md

成员清单
conversations/route.ts: GET 当前用户会话列表，POST 建空会话。
conversations/[id]/route.ts: GET 含消息的单会话，DELETE 同时清 studio/{userId}/{id} 磁盘。
conversations/[id]/messages/route.ts: POST 入队一轮生图/改图，202 立即返回；出图在进程后台完成，凭证拷进 ALS。

法则: 成员完整·一行一文件·父级链接·技术词前置
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
