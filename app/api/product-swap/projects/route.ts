/**
 * [INPUT]: 依赖 withAuthedUser、listProductSwapProjects
 * [OUTPUT]: 对外提供 GET 当前用户的实拍换品列表
 * [POS]: 实拍换品历史列表
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { withAuthedUser } from "@/lib/auth/session";
import { listProductSwapProjects } from "@/lib/services/product-swap-service";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function GET() {
  try {
    return await withAuthedUser(async (user) => {
      const projects = await listProductSwapProjects(user.id);
      return ok(projects);
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
