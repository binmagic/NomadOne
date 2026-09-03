/**
 * [INPUT]: 依赖 withAuthedUser、withProviderCredentials、assistListingSetCopy
 * [OUTPUT]: 对外提供 POST 卖点扩写
 * [POS]: 商品套图的 AI 帮写入口，不建项目
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { NextRequest } from "next/server";

import { withAuthedUser } from "@/lib/auth/session";
import { withProviderCredentials } from "@/lib/services/provider-runtime";
import { assistListingSetCopy } from "@/lib/services/listing-set-service";
import { listingSetCopyAssistSchema } from "@/lib/validations/listing-set";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function POST(request: NextRequest) {
  try {
    return await withAuthedUser(async () => {
      return withProviderCredentials(request, async () => {
        const input = listingSetCopyAssistSchema.parse(await request.json());
        const result = await assistListingSetCopy(input);
        return ok(result);
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
