import { notFound, redirect } from "next/navigation";

import { PlannerWorkspace } from "@/components/planner/planner-workspace";
import { PageHeader } from "@/components/shared/page-header";
import { getSessionUser } from "@/lib/auth/session";
import { getProjectDetail } from "@/lib/services/project-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProjectPlannerPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const project = await getProjectDetail(params.id, user.id);
  if (!project) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="页面规划"
        title={`${project.name} 的详情页规划`}
        description="将商品分析结果拆成头图规划、详情页规划和页面壳层说明，按最终产出结构完成编辑、排序和批量生成。"
      />
      <PlannerWorkspace key={project.id} project={project} />
    </div>
  );
}
