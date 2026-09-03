/**
 * [INPUT]: 依赖会话用户、listStudioConversations、StudioWorkspace
 * [OUTPUT]: 对外提供 /studio 对话生图页
 * [POS]: (app) 工作台的独立入口，不进入商品项目流
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { redirect } from "next/navigation";

import { StudioWorkspace } from "@/components/studio/studio-workspace";
import { getSessionUser } from "@/lib/auth/session";
import { listStudioConversations } from "@/lib/services/studio-service";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const conversations = await listStudioConversations(user.id);

  return <StudioWorkspace initialConversations={conversations} />;
}
