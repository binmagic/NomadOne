/**
 * [INPUT]: 依赖会话用户、listProductSwapProjects、ProductSwapWorkspace
 * [OUTPUT]: 对外提供 /product-swap 实拍换品页
 * [POS]: (app) 工作台的独立入口，不进入详情页项目流
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { redirect } from "next/navigation";

import { ProductSwapWorkspace } from "@/components/product-swap/product-swap-workspace";
import { getSessionUser } from "@/lib/auth/session";
import { listProductSwapProjects } from "@/lib/services/product-swap-service";

export const dynamic = "force-dynamic";

export default async function ProductSwapPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const projects = await listProductSwapProjects(user.id);

  return <ProductSwapWorkspace initialProjects={projects} />;
}
