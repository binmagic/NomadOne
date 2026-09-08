# lib/ai/
> L2 | 父级: /CLAUDE.md

成员清单
capability-detector.ts: 模型能力启发式与 isOpenAiCompatibleImageModel；declareCustomModel 把用户手填 ID 声明成生图/改图角色
model-matcher.ts: 按能力给分析/规划/生图/改图挑默认模型
provider-client.ts: ProviderAdapter 契约与请求类型
adapters/: OpenAI 兼容协议；tt-image-2 等参考图走 multipart /images/edits，纯文生图走 /images/generations；默认超时由 getProviderAdapter 注入，适配器不读数据库
prompts/: 分析/规划/生图/套图/换品提示词。主图是品类事实源，禁止把具体 SKU 写进全局规则。规划在详情页数量为 0 时只要求头图，且 visualPrompt 必须逐字引用该模块 title/copy；visual-prompt-rewrite.ts 按当前文案重写单模块双语 visualPrompt；生图提示词默认图内字以 title/copy 为准，第一张头图可锁参考图标题字体；product-swap.ts 实拍换品口径，复用物理真实片段，禁止 typography lock
schemas/: 结构化输出 zod schema；listing-set.ts 是 Listing 套图规划出口；visual-prompt-rewrite.ts 是单模块 Prompt 重写出口

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
