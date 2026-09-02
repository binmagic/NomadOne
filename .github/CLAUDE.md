# .github/
> L2 | 父级: /CLAUDE.md

成员清单
workflows/release.yml: 仅 push tag v*；SSH 后目录无 git 则 `git@github.com` clone，再调 scripts/release-remote.sh 在远端 docker compose 构建运行；凭据只走 Secrets（含 SSH 端口）；远端需能 SSH 访问 GitHub

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
