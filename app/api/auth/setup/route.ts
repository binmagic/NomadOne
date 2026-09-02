/**
 * [INPUT]: 依赖 setupSchema、createOwner、会话 cookie
 * [OUTPUT]: POST 创建首个 OWNER，归户孤儿数据并签发 cookie
 * [POS]: app/api/auth/setup，空库引导入口
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { NextRequest } from "next/server";

import { applySessionCookie } from "@/lib/auth/session";
import { createOwner } from "@/lib/auth/user-service";
import { handleRouteError, ok } from "@/lib/utils/route";
import { setupSchema } from "@/lib/validations/auth";

export async function POST(request: NextRequest) {
  try {
    const input = setupSchema.parse(await request.json());
    const user = await createOwner({
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
