# .github/
> L2 | 父级: /CLAUDE.md

成员清单
workflows/release.yml: 仅 push tag v*；Runner checkout 后 scp 源码，SSH 调 scripts/release-remote.sh 在远端 docker compose 构建运行；远端不访问 GitHub；凭据只走 Secrets（含 SSH 端口）

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
