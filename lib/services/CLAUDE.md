# lib/services/
> L2 | 父级: /CLAUDE.md

业务服务全部按 userId 隔离。列表/创建显式传 userId；按 id 读取走 assertProjectOwned 或 findFirst({ id, userId })。别人的资源返回 not found。

成员清单
app-settings.ts: 工作区单行设置；allowRegister 默认 false；modelTimeoutMs 默认 120000，被适配器当作文本/图像调用超时
project-service.ts: 项目 CRUD 与所有权断言，listProjects 排除系统任务平台；updateProject 服务端 merge 快照，仅在头图/详情页张数变化时裁切多余模块
provider-service.ts: Provider 按用户隔离；isActive 的 updateMany 必须 where userId；getProviderAdapter 读 ALS 并把 AppSettings.modelTimeoutMs 注入适配器；保存时把分配 ID 合成为模型档案，capabilities.__source=custom 的手填模型在重新发现后仍保留
workflow-task-service.ts: 每用户一个 __nomadone_system_task__ 占位项目；后台任务 withUser + provider credentials 双 ALS
task-service.ts: getOwnedTask 经 project.userId 过滤；内部 getTask 仍按 id
generation-service.ts / planner-service.ts / analysis-service.ts / xiaohongshu-service.ts / listing-set-service.ts: 通过 getProviderAdapter 间接收到当前用户；分析写快照必须 merge previewConfig；规划张数读 preview-config 契约
listing-set-service.ts: 商品套图按 userId 隔离；enqueueListingSetGenerate 建 LISTING_SET 项目后入队，后台 plan + generateSectionImage；主图槽位 noTextInImage
studio-service.ts: 对话生图按 userId 隔离；enqueueStudioMessage 立刻写 PENDING，后台 withUser+凭证 ALS 跑 generateImage/editImage
export-service.ts: 导出前由路由层 assertProjectOwned
provider-runtime.ts: 请求级 API Key ALS，与用户 ALS 正交，不存密钥

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
