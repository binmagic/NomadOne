# [INPUT]: 依赖 package-lock 的 npm ci、prisma generate、next standalone build
# [OUTPUT]: 对外提供 /app/server.js 生产镜像，入口先跑自定义 SQLite 迁移
# [POS]: 仓库根的 Linux 运行时相，被 docker-compose.yml 与远端 release-remote.sh 消费；不打 .env、不带 Electron
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

ARG NODE_IMAGE=swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/library/node:24-bookworm

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci

FROM ${NODE_IMAGE} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV APP_RUNTIME=web
ENV DATABASE_URL="file:./dev.db"
ENV APP_SECRET="build-time-placeholder-secret"
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run prisma:migrate && npm run build \
  && rm -f prisma/dev.db prisma/dev.db-wal prisma/dev.db-shm

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV APP_RUNTIME=web
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts/apply-prisma-migrations.cjs ./scripts/apply-prisma-migrations.cjs
COPY --from=builder /app/scripts/runtime-paths.cjs ./scripts/runtime-paths.cjs
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
