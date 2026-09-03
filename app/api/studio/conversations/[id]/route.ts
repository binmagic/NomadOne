/**
 * [INPUT]: 依赖 withAuthedUser、getStudioConversation、deleteStudioConversation
 * [OUTPUT]: 对外提供 GET 单会话含消息、DELETE 会话及磁盘文件
 * [POS]: app/api/studio/conversations/[id] 资源入口，找不到即当别人的
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { withAuthedUser } from "@/lib/auth/session";
import { deleteStudioConversation, getStudioConversation } from "@/lib/services/studio-service";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function GET(_request: Request, context: { params: { id: string } }) {
  try {
    return await withAuthedUser(async (user) => {
      const conversation = await getStudioConversation(context.params.id, user.id);
      return ok(conversation);
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  try {
    return await withAuthedUser(async (user) => {
      const result = await deleteStudioConversation(context.params.id, user.id);
      return ok(result);
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
