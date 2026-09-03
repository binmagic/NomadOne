/**
 * [INPUT]: 依赖会话用户、listListingSetProjects、ListingSetWorkspace
 * [OUTPUT]: 对外提供 /listing-set 商品套图页
 * [POS]: (app) 工作台的独立入口，不进入详情页项目流
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { redirect } from "next/navigation";

import { ListingSetWorkspace } from "@/components/listing-set/listing-set-workspace";
import { getSessionUser } from "@/lib/auth/session";
import { listListingSetProjects } from "@/lib/services/listing-set-service";

export const dynamic = "force-dynamic";

export default async function ListingSetPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const projects = await listListingSetProjects(user.id);

  return <ListingSetWorkspace initialProjects={projects} />;
}
