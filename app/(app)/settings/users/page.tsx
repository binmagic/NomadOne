/**
 * [INPUT]: 依赖 getSessionUser、listUsers、UserManagementList
 * [OUTPUT]: 对外提供 /settings/users 用户管理页
 * [POS]: (app)/settings 下与 providers 并列的后台页，仅 OWNER 可进
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { redirect } from "next/navigation";

import { UserManagementList } from "@/components/users/user-management-list";
import { NoticeCard } from "@/components/shared/notice-card";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { listUsers } from "@/lib/auth/user-service";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const currentUser = await getSessionUser();
  if (!currentUser) {
    redirect("/login");
  }
  if (currentUser.role !== "OWNER") {
    redirect("/");
  }

  const users = await listUsers();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="用户管理"
        title="工作区用户"
        description="维护可登录本工作区的账号。系统初始化时创建的管理员不允许修改、禁用或删除。"
      />

      <NoticeCard
        variant="info"
        title="系统用户已锁定"
        description="首次 /setup 创建的 OWNER 是系统初始化用户，作为工作区保底账号保留。普通成员可以新增、编辑、禁用和删除。"
      />

      <Card>
        <CardHeader>
          <CardTitle>用户列表</CardTitle>
          <CardDescription>系统用户优先展示，其余按创建时间排列。</CardDescription>
        </CardHeader>
        <CardContent>
          <UserManagementList initialUsers={users} />
        </CardContent>
      </Card>
    </div>
  );
}
