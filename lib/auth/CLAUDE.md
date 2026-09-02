# lib/auth/
> L2 | 父级: /CLAUDE.md

本地优先身份层。Edge 只验 HMAC；Node 再查 User 表。密码走 scrypt，禁止复用 AES encryptSecret。

成员清单
errors.ts: AuthError 错误码与 HTTP 状态，被 handleRouteError 识别
secret.ts: 分段读取 APP_SECRET，避开 Next 构建期内联（桌面 secret 运行时才有）
session-cookie.ts: Web Crypto HMAC 签发/校验，Edge + Node 共用
cookie-options.ts: httpOnly / SameSite=Lax / Path=/；secure 看请求协议
password.ts: Node scrypt 哈希与 timingSafeEqual 校验
request-user.ts: ALS 写入当前 UserProfile，供 getProviderAdapter 取 userId
session.ts: getSessionUser / requireUser / requireOwner / withAuthedUser / withOwnerUser / 写清 cookie；禁用账号视为未登录
user-service.ts: 首个 OWNER 锁定不可改；管理员可创建成员（不依赖开放注册开关）；登录拒绝禁用账号；孤儿 Project/Provider 归户；自助注册读 AppSettings.allowRegister

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
