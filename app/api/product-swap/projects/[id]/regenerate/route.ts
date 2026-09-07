/**
 * [INPUT]: 依赖 withAuthedUser、withProviderCredentials、enqueueProductSwapRegenerate
 * [OUTPUT]: 对外提供 POST 对同一项目再入队换品，202 立即返回
 * [POS]: 实拍换品重跑路径，复用已落盘的场景图与本品图
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { NextRequest } from "next/server";

import { withAuthedUser } from "@/lib/auth/session";
import { readProviderCredentialsFromRequest, withProviderCredentials } from "@/lib/services/provider-runtime";
import { enqueueProductSwapRegenerate } from "@/lib/services/product-swap-service";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  try {
    return await withAuthedUser(async (user) => {
      return withProviderCredentials(request, async () => {
        const result = await enqueueProductSwapRegenerate(
          context.params.id,
          user,
          readProviderCredentialsFromRequest(request),
        );
        return ok(result, { status: 202 });
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
