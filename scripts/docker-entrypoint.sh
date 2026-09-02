#!/bin/sh
# [INPUT]: 依赖 /app 上的 apply-prisma-migrations.cjs 与 standalone server.js，依赖 DATABASE_URL / STORAGE_ROOT
# [OUTPUT]: 对外提供容器启动：落盘目录、自定义 SQLite 迁移、再 exec node server.js
# [POS]: Docker runner 的唯一入口，禁止在此调用 prisma migrate deploy
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

set -e
mkdir -p /data/storage
node /app/scripts/apply-prisma-migrations.cjs
exec node /app/server.js
