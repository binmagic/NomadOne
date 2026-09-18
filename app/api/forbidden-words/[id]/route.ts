/**
 * [INPUT]: 依赖 withAuthedUser、update/deleteForbiddenWord、updateForbiddenWordSchema
 * [OUTPUT]: 对外提供 PATCH 改词、DELETE 删词
 * [POS]: app/api/forbidden-words/[id] 资源入口，登录用户可读写整库
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { NextRequest } from "next/server";

import { withAuthedUser } from "@/lib/auth/session";
import { deleteForbiddenWord, updateForbiddenWord } from "@/lib/services/forbidden-word-service";
import { handleRouteError, ok } from "@/lib/utils/route";
import { updateForbiddenWordSchema } from "@/lib/validations/forbidden-word";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  try {
    return await withAuthedUser(async () => {
      const input = updateForbiddenWordSchema.parse(await request.json());
      const word = await updateForbiddenWord(context.params.id, input.word);
      return ok(word);
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: NextRequest, context: { params: { id: string } }) {
  try {
    return await withAuthedUser(async () => {
      const result = await deleteForbiddenWord(context.params.id);
      return ok(result);
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
