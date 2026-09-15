/**
 * [INPUT]: 依赖会话用户、listPromptTemplates、PromptLibrary
 * [OUTPUT]: 对外提供 /prompts 提示词卡片页
 * [POS]: (app) 工作台的独立入口，登录用户共用一张提示词库
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { redirect } from "next/navigation";

import { PromptLibrary } from "@/components/prompts/prompt-library";
import { getSessionUser } from "@/lib/auth/session";
import { listPromptTemplates } from "@/lib/services/prompt-template-service";

export const dynamic = "force-dynamic";

export default async function PromptsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const templates = await listPromptTemplates();

  return <PromptLibrary initialTemplates={templates} />;
}
