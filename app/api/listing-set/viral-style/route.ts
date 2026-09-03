/**
 * [INPUT]: 依赖 withAuthedUser、withProviderCredentials、assistListingSetViralStyle
 * [OUTPUT]: 对外提供 POST 爆款风格分析，不建项目
 * [POS]: 商品套图附加功能的即时分析入口
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { NextRequest } from "next/server";

import { withAuthedUser } from "@/lib/auth/session";
import { withProviderCredentials } from "@/lib/services/provider-runtime";
import { assistListingSetViralStyle } from "@/lib/services/listing-set-service";
import { listingSetViralAssistSchema } from "@/lib/validations/listing-set";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function POST(request: NextRequest) {
  try {
    return await withAuthedUser(async () => {
      return withProviderCredentials(request, async () => {
        const input = listingSetViralAssistSchema.parse(await request.json());
        const result = await assistListingSetViralStyle(input);
        return ok(result);
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
