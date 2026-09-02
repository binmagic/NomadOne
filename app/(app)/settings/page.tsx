/**
 * [INPUT]: 依赖 getSessionUser、getAppSettings、RegisterToggle、ModelTimeoutField
 * [OUTPUT]: 对外提供 /settings 工作区设置页
 * [POS]: (app)/settings 索引页，仅 OWNER 可进；与 users/providers 并列
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { redirect } from "next/navigation";

import { ModelTimeoutField } from "@/components/settings/model-timeout-field";
import { RegisterToggle } from "@/components/settings/register-toggle";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { getAppSettings } from "@/lib/services/app-settings";

export const dynamic = "force-dynamic";

export default async function WorkspaceSettingsPage() {
  const currentUser = await getSessionUser();
  if (!currentUser) {
    redirect("/login");
  }
  if (currentUser.role !== "OWNER") {
    redirect("/");
  }

  const settings = await getAppSettings();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="工作区设置"
        title="设置"
        description="控制本工作区的访问策略和模型调用超时。管理员在用户管理中直接创建成员，不经过注册开关。"
      />

      <Card>
        <CardHeader>
          <CardTitle>注册</CardTitle>
          <CardDescription>是否允许访客自行注册 MEMBER 账号。</CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterToggle initialAllowRegister={settings.allowRegister} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>模型超时</CardTitle>
          <CardDescription>单次文本或图像生成最长等待时间。超时后会中止这次调用并记入 API 监控。</CardDescription>
        </CardHeader>
        <CardContent>
          <ModelTimeoutField initialModelTimeoutMs={settings.modelTimeoutMs} />
        </CardContent>
      </Card>
    </div>
  );
}
