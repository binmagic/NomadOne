import { redirect } from "next/navigation";

import { RecentProjectList } from "@/components/projects/recent-project-list";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { listProjects } from "@/lib/services/project-service";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const projects = await listProjects(user.id);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="历史记录"
        title="最近项目"
        description="按作品墙方式查看已有项目，快速回到分析、规划、编辑或删除不再需要的内容。"
      />

      <Card>
        <CardHeader>
          <CardTitle>项目历史</CardTitle>
          <CardDescription>这里集中展示当前工作区内的全部历史项目。</CardDescription>
        </CardHeader>
        <CardContent>
          <RecentProjectList initialProjects={projects} />
        </CardContent>
      </Card>
    </div>
  );
}
