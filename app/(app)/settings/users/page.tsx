/**
 * [INPUT]: 依赖 getSessionUser、listUsers、UserManagementList
 * [OUTPUT]: 对外提供 /settings/users 用户管理页
 * [POS]: (app)/settings 下与 providers 并列的后台页，仅 OWNER 可进
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { redirect } from "next/navigation";

import { UserManagementList } from "@/components/users/user-management-list";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
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

      <Card>
        <UserManagementList initialUsers={users} />
      </Card>
    </div>
  );
}
