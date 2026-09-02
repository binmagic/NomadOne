# MxPage - AI 原生商品图文工作台

Next.js 14 + Prisma SQLite + Electron + OpenAI-compatible Provider

<directory>
app/ - App Router 页面与 API（子目录: (app) 工作台, (auth) 登录, api）
components/ - UI 与工作流组件（子目录: layout, auth, projects, providers, editor）
lib/ - 服务端内核（子目录: auth, services, ai, db, storage, validations）
prisma/ - SQLite schema 与迁移
desktop/ - Electron 主进程
types/ - 领域常量与公开类型
scripts/ - Prisma 安全迁移与桌面打包
</directory>

<config>
package.json - Next 14.2 / Prisma 6 / Electron 桌面打包
.env.example - DATABASE_URL、APP_SECRET、ALLOW_REGISTER
middleware.ts - HMAC 会话门禁；未登录页 302 /login，API 401
prisma/schema.prisma - User + Project.userId + ProviderConfig.userId
</config>

鉴权：本地用户名密码，scrypt 哈希，HMAC cookie `mxpage_session`，无 Session 表、无 NextAuth。
API Key 只活在浏览器 localStorage，请求头注入，不进数据库。
Cookie `secure` 只看请求是否 https，不看 NODE_ENV——桌面是 production + http。
空库走 /setup 创建 OWNER 并归户孤儿数据；`ALLOW_REGISTER=true` 才开放 MEMBER 注册。
迁移必须走 `npm run prisma:migrate`（scripts/apply-prisma-migrations.cjs），不要 prisma migrate deploy。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
