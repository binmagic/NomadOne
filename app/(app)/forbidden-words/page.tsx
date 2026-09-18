/**
 * [INPUT]: 依赖会话用户、listForbiddenWords、ForbiddenWordLibrary
 * [OUTPUT]: 对外提供 /forbidden-words 违禁词管理页
 * [POS]: (app) 工作台的独立入口，登录用户共用一张违禁词表，生图时由服务层注入
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { redirect } from "next/navigation";

import { ForbiddenWordLibrary } from "@/components/forbidden-words/forbidden-word-library";
import { getSessionUser } from "@/lib/auth/session";
import { listForbiddenWords } from "@/lib/services/forbidden-word-service";

export const dynamic = "force-dynamic";

export default async function ForbiddenWordsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const words = await listForbiddenWords();

  return <ForbiddenWordLibrary initialWords={words} />;
}
