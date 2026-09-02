/**
 * [INPUT]: 依赖 registerSchema、createMember、AppSettings.allowRegister
 * [OUTPUT]: POST 创建 MEMBER 并签发 cookie；默认 403
 * [POS]: app/api/auth/register
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { NextRequest } from "next/server";

import { applySessionCookie } from "@/lib/auth/session";
import { createMember } from "@/lib/auth/user-service";
import { handleRouteError, ok } from "@/lib/utils/route";
import { registerSchema } from "@/lib/validations/auth";

export async function POST(request: NextRequest) {
  try {
    const input = registerSchema.parse(await request.json());
    const user = await createMember({
      username: input.username,
      displayName: input.displayName,
      password: input.password,
    });
    const response = ok({ user }, { status: 201 });
    return applySessionCookie(response, user, request);
  } catch (error) {
    return handleRouteError(error);
  }
}
