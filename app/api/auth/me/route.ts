/**
 * [INPUT]: 依赖 requireUser
 * [OUTPUT]: GET 当前 UserProfile
 * [POS]: app/api/auth/me，需登录，不被 middleware 放行
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { requireUser } from "@/lib/auth/session";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function GET() {
  try {
    const user = await requireUser();
    return ok({ user });
  } catch (error) {
    return handleRouteError(error);
  }
}
