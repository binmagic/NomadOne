#!/usr/bin/env bash
# [INPUT]: 依赖参数 v* tag、DEPLOY_PATH 或脚本上级目录、根目录 .env、docker compose
# [OUTPUT]: 检出该 tag 后 docker compose up --build，不 git clean、不 prisma migrate deploy
# [POS]: 生产发布入口，由 .github/workflows/release.yml SSH 调用，也可在远端手工执行
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

set -euo pipefail

TAG="${1:-}"
case "$TAG" in
  v*) ;;
  *)
    echo "usage: $0 vX.Y.Z" >&2
    exit 1
    ;;
esac

ROOT="${DEPLOY_PATH:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT"

command -v docker >/dev/null
docker compose version >/dev/null

if [ ! -f .env ]; then
  echo "missing .env" >&2
  exit 1
fi

exec 9>/tmp/nomadone-release.lock
flock -n 9 || {
  echo "another release is running" >&2
  exit 1
}

git fetch --tags --force origin
git rev-parse "refs/tags/$TAG" >/dev/null
git checkout -f "refs/tags/$TAG"

docker compose up --build -d --remove-orphans
docker compose ps

echo "released $TAG"
