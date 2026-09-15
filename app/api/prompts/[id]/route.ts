/**
 * [INPUT]: 依赖 withAuthedUser、get/update/deletePromptTemplate、updatePromptTemplateSchema
 * [OUTPUT]: 对外提供 GET 单卡片、PATCH 更新、DELETE 卡片及磁盘效果图
 * [POS]: app/api/prompts/[id] 资源入口，找不到即当别人的
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { NextRequest } from "next/server";

import { withAuthedUser } from "@/lib/auth/session";
import { deletePromptTemplate, getPromptTemplate, updatePromptTemplate } from "@/lib/services/prompt-template-service";
import { handleRouteError, ok } from "@/lib/utils/route";
import { updatePromptTemplateSchema } from "@/lib/validations/prompt-template";

export async function GET(_request: NextRequest, context: { params: { id: string } }) {
  try {
    return await withAuthedUser(async (user) => {
      const template = await getPromptTemplate(context.params.id, user.id);
      return ok(template);
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  try {
    return await withAuthedUser(async (user) => {
      const input = updatePromptTemplateSchema.parse(await request.json());
      const template = await updatePromptTemplate(context.params.id, user.id, input);
      return ok(template);
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: NextRequest, context: { params: { id: string } }) {
  try {
    return await withAuthedUser(async (user) => {
      const result = await deletePromptTemplate(context.params.id, user.id);
      return ok(result);
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
