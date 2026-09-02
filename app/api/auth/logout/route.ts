/**
 * [INPUT]: 依赖会话 cookie 清除选项
 * [OUTPUT]: POST 过期 cookie
 * [POS]: app/api/auth/logout，middleware 放行以便过期会话也能退出
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { NextRequest } from "next/server";

import { clearSessionCookie } from "@/lib/auth/session";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function POST(request: NextRequest) {
  try {
    const response = ok({ ok: true });
    return clearSessionCookie(response, request);
  } catch (error) {
    return handleRouteError(error);
  }
}
