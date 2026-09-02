/**
 * [INPUT]: 读取进程环境变量 APP_SECRET
 * [OUTPUT]: 对外提供 getAppSecret
 * [POS]: lib/auth 的密钥读取器。用分段键名避开 Next 构建期内联，桌面端 secret 在运行时才写入
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const FALLBACK_SECRET = "MxPage-local-secret";

export function getAppSecret() {
  const value = process.env[["APP", "SECRET"].join("_")];
  if (typeof value === "string" && value.length >= 12) {
    return value;
  }
  return FALLBACK_SECRET;
}
