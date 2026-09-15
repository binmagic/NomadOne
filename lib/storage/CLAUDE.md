# storage/
> L2 | 父级: /CLAUDE.md

成员清单
asset-manager.ts: 商品素材写入 uploads/generated/exports 并建 ProductAsset；saveGeneratedImage 的 sectionId 可空，无 section 时落到 generated/{projectId}/；对话生图写入 studio/{userId}/{conversationId}，只回相对路径；提示词效果图写入 prompts/{templateId}，工作区共用，一模板一文件；删会话/删模板时递归清磁盘。

法则: 成员完整·一行一文件·父级链接·技术词前置
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
