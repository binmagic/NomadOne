/**
 * [INPUT]: 依赖 withAuthedUser、withProviderCredentials、enqueueStudioMessage、studioMessageRequestSchema
 * [OUTPUT]: 对外提供 POST 入队一轮对话生图，202 立即返回，出图在进程后台完成
 * [POS]: 对话生图的写路径。API Key 只从请求头拷进后台 ALS，不落库
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { NextRequest } from "next/server";

import { withAuthedUser } from "@/lib/auth/session";
import { readProviderCredentialsFromRequest, withProviderCredentials } from "@/lib/services/provider-runtime";
import { enqueueStudioMessage } from "@/lib/services/studio-service";
import { studioMessageRequestSchema } from "@/lib/validations/studio";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  try {
    return await withAuthedUser(async (user) => {
      return withProviderCredentials(request, async () => {
        const input = studioMessageRequestSchema.parse(await request.json());
        const conversation = await enqueueStudioMessage(
          context.params.id,
          user,
          input,
          readProviderCredentialsFromRequest(request),
        );
        return ok(conversation, { status: 202 });
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
