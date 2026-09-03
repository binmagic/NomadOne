/**
 * [INPUT]: 依赖 withAuthedUser、getListingSetView
 * [OUTPUT]: 对外提供 GET 单套图详情（含槽位图与上架文案）
 * [POS]: 商品套图读路径，按 userId 隔离
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { withAuthedUser } from "@/lib/auth/session";
import { getListingSetView } from "@/lib/services/listing-set-service";
import { fail, handleRouteError, ok } from "@/lib/utils/route";

export async function GET(_request: Request, context: { params: { id: string } }) {
  try {
    return await withAuthedUser(async (user) => {
      const view = await getListingSetView(context.params.id, user.id);
      if (!view) {
        return fail("NOT_FOUND", "Listing set not found.", null, 404);
      }
      return ok(view);
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
