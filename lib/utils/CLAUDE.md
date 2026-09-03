# lib/utils/
> L2 | 父级: /CLAUDE.md

成员清单
api.ts: API 信封类型，success/error 形状
base64-upload.ts: data URL 去前缀与上传载荷
content-language.ts: 内容语言选项、标签与 normalizeContentLanguage
crypto.ts: AES-256-GCM 加解密，密钥来自 env
env.ts: 进程环境入口；开放注册不在这里
files.ts: 文件名清洗与 mime 扩展名
preview-config.ts: 头图 3-5 / 详情页 0-10 的边界、clamp 与 previewConfig 读取；0 张详情表示只出头图
route.ts: API 出口闸门，ok / fail / handleRouteError
section.ts: Prisma SectionType 到 domain key 的映射
visual-style-guide.ts: 项目级视觉规范的读取、归一与默认值

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
