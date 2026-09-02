/**
 * [INPUT]: 依赖 loginSchema、authenticate、会话 cookie
 * [OUTPUT]: POST 校验口令并签发 cookie
 * [POS]: app/api/auth/login
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { NextRequest } from "next/server";

import { applySessionCookie } from "@/lib/auth/session";
import { authenticate } from "@/lib/auth/user-service";
import { handleRouteError, ok } from "@/lib/utils/route";
import { loginSchema } from "@/lib/validations/auth";

export async function POST(request: NextRequest) {
  try {
    const input = loginSchema.parse(await request.json());
    const user = await authenticate(input.username, input.password);
    const response = ok({ user });
    return applySessionCookie(response, user, request);
  } catch (error) {
    return handleRouteError(error);
  }
}
