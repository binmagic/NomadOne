/**
 * [INPUT]: 依赖 withAuthedUser、prompt-template-service、createPromptTemplateSchema
 * [OUTPUT]: 对外提供 GET 当前用户提示词列表、POST 新建卡片（必须带效果图）
 * [POS]: app/api/prompts 集合入口，按 userId 隔离
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { NextRequest } from "next/server";

import { withAuthedUser } from "@/lib/auth/session";
import { createPromptTemplate, listPromptTemplates } from "@/lib/services/prompt-template-service";
import { handleRouteError, ok } from "@/lib/utils/route";
import { createPromptTemplateSchema } from "@/lib/validations/prompt-template";

export async function GET() {
  try {
    return await withAuthedUser(async (user) => {
      const templates = await listPromptTemplates(user.id);
      return ok(templates);
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return await withAuthedUser(async (user) => {
      const input = createPromptTemplateSchema.parse(await request.json());
      const template = await createPromptTemplate(user.id, input);
      return ok(template, { status: 201 });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
