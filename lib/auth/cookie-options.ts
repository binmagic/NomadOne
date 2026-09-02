/**
 * [INPUT]: 依赖 NextRequest 的协议头，依赖 session-cookie 的 TTL
 * [OUTPUT]: 对外提供会话 cookie 写入/清除选项。secure 只看 https，不看 NODE_ENV
 * [POS]: lib/auth 的 cookie 属性工厂，专供 Node 路由处理器
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { NextRequest } from "next/server";

import { SESSION_TTL_SECONDS } from "@/lib/auth/session-cookie";

export function isHttpsRequest(request: NextRequest) {
  if (request.nextUrl.protocol === "https:") {
    return true;
  }
  const forwarded = request.headers.get("x-forwarded-proto");
  return forwarded?.split(",")[0]?.trim().toLowerCase() === "https";
}

export function buildSessionCookieOptions(request: NextRequest) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: isHttpsRequest(request),
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function buildClearSessionCookieOptions(request: NextRequest) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: isHttpsRequest(request),
    maxAge: 0,
  };
}
