# product-swap/
> L2 | 父级: /CLAUDE.md

成员清单
generate/route.ts: POST 建 PRODUCT_SWAP 项目、落场景图与本品图、入队 PRODUCT_SWAP_GENERATE，202 返回。
projects/route.ts: GET 当前用户换品列表。
projects/[id]/route.ts: GET 单次换品详情。
projects/[id]/regenerate/route.ts: POST 复用已有 A/B 再入队，202 返回。

法则: 成员完整·一行一文件·父级链接·技术词前置
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
