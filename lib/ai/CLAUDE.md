# lib/ai/
> L2 | 父级: /CLAUDE.md

成员清单
capability-detector.ts: 模型能力启发式与 isOpenAiCompatibleImageModel；declareCustomModel 把用户手填 ID 声明成生图/改图角色
model-matcher.ts: 按能力给分析/规划/生图/改图挑默认模型
provider-client.ts: ProviderAdapter 契约与请求类型
adapters/: OpenAI 兼容协议；tt-image-2 等参考图走 multipart /images/edits，纯文生图走 /images/generations
prompts/: 分析/规划/生图提示词
schemas/: 结构化输出 zod schema

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
