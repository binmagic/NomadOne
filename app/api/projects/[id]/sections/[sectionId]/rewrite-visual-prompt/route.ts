/**
 * [INPUT]: 依赖 withAuthedUser、assertProjectOwned、withProviderCredentials、rewriteSectionVisualPrompt
 * [OUTPUT]: 对外提供 POST 单模块双语视觉 Prompt 重写
 * [POS]: 详情页模块的 Prompt 重写入口，不整页规划、不触发生图
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { NextRequest } from "next/server";

import { withAuthedUser } from "@/lib/auth/session";
import { assertProjectOwned } from "@/lib/services/project-service";
import { withProviderCredentials } from "@/lib/services/provider-runtime";
import { rewriteSectionVisualPrompt } from "@/lib/services/visual-prompt-rewrite-service";
import { handleRouteError, ok } from "@/lib/utils/route";
import { sectionRewriteVisualPromptSchema } from "@/lib/validations/section";

export async function POST(
  request: NextRequest,
  context: { params: { id: string; sectionId: string } },
) {
  try {
    return await withAuthedUser(async (user) => {
      await assertProjectOwned(context.params.id, user.id);
      return withProviderCredentials(request, async () => {
        const input = sectionRewriteVisualPromptSchema.parse(await request.json().catch(() => ({})));
        const result = await rewriteSectionVisualPrompt(context.params.id, context.params.sectionId, input);
        return ok(result);
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
