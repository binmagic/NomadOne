# .github/
> L2 | 父级: /CLAUDE.md

成员清单
workflows/release.yml: 仅 push tag v*；SSH 后目录无 git 则 HTTPS clone，再调 scripts/release-remote.sh 在远端本机 docker compose 构建运行；凭据只走 Secrets（含 SSH 端口）

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
