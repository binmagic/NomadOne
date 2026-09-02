/**
 * [INPUT]: 依赖 withAuthedUser、monitor/api-usage 的汇总与删除
 * [OUTPUT]: 对外提供 GET/DELETE /api/monitor/usage
 * [POS]: API 监控出口。认证后按当前 userId 读删，不能看也不能清别人的记录
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { NextRequest } from "next/server";

import { withAuthedUser } from "@/lib/auth/session";
import { clearApiUsageEntries, deleteApiUsageEntry, getApiUsageSummary } from "@/lib/monitor/api-usage";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function GET(request: NextRequest) {
  try {
    return await withAuthedUser(async (user) => {
      const hours = Number(request.nextUrl.searchParams.get("hours") ?? "24");
      const limit = Number(request.nextUrl.searchParams.get("limit") ?? "20");
      const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
      const projectId = request.nextUrl.searchParams.get("projectId");
      const category = request.nextUrl.searchParams.get("category");
      const quotaState = request.nextUrl.searchParams.get("quotaState");
      const success = request.nextUrl.searchParams.get("success");
      const data = await getApiUsageSummary({
        userId: user.id,
        hours: Number.isFinite(hours) ? Math.max(1, Math.min(24 * 30, hours)) : 24,
        limit: Number.isFinite(limit) ? Math.max(1, Math.min(200, limit)) : 20,
        page: Number.isFinite(page) ? Math.max(1, page) : 1,
        projectId: projectId || null,
        category: (category as never) || "all",
        quotaState: (quotaState as never) || "all",
        success: (success as never) || "all",
      });
      return ok(data);
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    return await withAuthedUser(async (user) => {
      const entryId = request.nextUrl.searchParams.get("id");
      const result = entryId ? await deleteApiUsageEntry(entryId, user.id) : await clearApiUsageEntries(user.id);
      return ok(result);
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
