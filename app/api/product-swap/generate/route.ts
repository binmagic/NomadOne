/**
 * [INPUT]: 依赖 withAuthedUser、withProviderCredentials、enqueueProductSwapGenerate
 * [OUTPUT]: 对外提供 POST 入队一次实拍换品，202 立即返回
 * [POS]: 实拍换品的写路径。API Key 只从请求头拷进后台 ALS，不落库
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { NextRequest } from "next/server";

import { withAuthedUser } from "@/lib/auth/session";
import { readProviderCredentialsFromRequest, withProviderCredentials } from "@/lib/services/provider-runtime";
import { enqueueProductSwapGenerate } from "@/lib/services/product-swap-service";
import { productSwapGenerateSchema } from "@/lib/validations/product-swap";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function POST(request: NextRequest) {
  try {
    return await withAuthedUser(async (user) => {
      return withProviderCredentials(request, async () => {
        const input = productSwapGenerateSchema.parse(await request.json());
        const result = await enqueueProductSwapGenerate(input, user, readProviderCredentialsFromRequest(request));
        return ok(result, { status: 202 });
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
