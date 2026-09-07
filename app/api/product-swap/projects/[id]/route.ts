/**
 * [INPUT]: 依赖 withAuthedUser、getProductSwapView
 * [OUTPUT]: 对外提供 GET 单次换品详情
 * [POS]: 实拍换品读路径，按 userId 与 kind 隔离
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { withAuthedUser } from "@/lib/auth/session";
import { getProductSwapView } from "@/lib/services/product-swap-service";
import { fail, handleRouteError, ok } from "@/lib/utils/route";

export async function GET(_request: Request, context: { params: { id: string } }) {
  try {
    return await withAuthedUser(async (user) => {
      const view = await getProductSwapView(context.params.id, user.id);
      if (!view) {
        return fail("NOT_FOUND", "Product swap not found.", null, 404);
      }
      return ok(view);
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
