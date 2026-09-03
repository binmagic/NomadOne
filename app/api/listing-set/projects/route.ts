/**
 * [INPUT]: 依赖 withAuthedUser、listListingSetProjects
 * [OUTPUT]: 对外提供 GET 当前用户的套图项目列表
 * [POS]: 商品套图历史列表
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { withAuthedUser } from "@/lib/auth/session";
import { listListingSetProjects } from "@/lib/services/listing-set-service";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function GET() {
  try {
    return await withAuthedUser(async (user) => {
      const projects = await listListingSetProjects(user.id);
      return ok(projects);
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
