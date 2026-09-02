/**
 * [INPUT]: 无外部模块依赖，仅描述鉴权失败码与 HTTP 状态
 * [OUTPUT]: 对外提供 AuthError，供路由层映射为统一信封
 * [POS]: lib/auth 的错误类型，被 session / user-service / route.handleRouteError 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export class AuthError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
  }
}
