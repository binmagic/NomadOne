/**
 * [INPUT]: 依赖 withAuthedUser、withProviderCredentials、enqueueListingSetGenerate
 * [OUTPUT]: 对外提供 POST 入队一套商品套图，202 立即返回
 * [POS]: 商品套图的写路径。API Key 只从请求头拷进后台 ALS，不落库
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { NextRequest } from "next/server";

import { withAuthedUser } from "@/lib/auth/session";
import { readProviderCredentialsFromRequest, withProviderCredentials } from "@/lib/services/provider-runtime";
import { enqueueListingSetGenerate } from "@/lib/services/listing-set-service";
import { listingSetGenerateSchema } from "@/lib/validations/listing-set";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function POST(request: NextRequest) {
  try {
    return await withAuthedUser(async (user) => {
      return withProviderCredentials(request, async () => {
        const input = listingSetGenerateSchema.parse(await request.json());
        const result = await enqueueListingSetGenerate(input, user, readProviderCredentialsFromRequest(request));
        return ok(result, { status: 202 });
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
