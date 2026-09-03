/**
 * [INPUT]: 依赖 withAuthedUser、studio-service、createStudioConversationSchema
 * [OUTPUT]: 对外提供 GET 当前用户会话列表、POST 新建空会话
 * [POS]: app/api/studio/conversations 集合入口，按 userId 隔离
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { NextRequest } from "next/server";

import { withAuthedUser } from "@/lib/auth/session";
import { createStudioConversation, listStudioConversations } from "@/lib/services/studio-service";
import { createStudioConversationSchema } from "@/lib/validations/studio";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function GET() {
  try {
    return await withAuthedUser(async (user) => {
      const conversations = await listStudioConversations(user.id);
      return ok(conversations);
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return await withAuthedUser(async (user) => {
      const input = createStudioConversationSchema.parse(await request.json().catch(() => ({})));
      const conversation = await createStudioConversation(user.id, input.title);
      return ok(conversation, { status: 201 });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
