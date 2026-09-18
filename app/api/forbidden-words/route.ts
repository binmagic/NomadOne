/**
 * [INPUT]: 依赖 withAuthedUser、forbidden-word-service、createForbiddenWordsSchema
 * [OUTPUT]: 对外提供 GET 工作区违禁词列表、POST 新建（可一次多个）
 * [POS]: app/api/forbidden-words 集合入口，登录用户共用一张表
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { NextRequest } from "next/server";

import { withAuthedUser } from "@/lib/auth/session";
import { createForbiddenWords, listForbiddenWords } from "@/lib/services/forbidden-word-service";
import { handleRouteError, ok } from "@/lib/utils/route";
import { createForbiddenWordsSchema } from "@/lib/validations/forbidden-word";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return await withAuthedUser(async () => {
      const words = await listForbiddenWords();
      return ok(words);
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return await withAuthedUser(async () => {
      const input = createForbiddenWordsSchema.parse(await request.json());
      const result = await createForbiddenWords(input);
      return ok(result, { status: 201 });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
