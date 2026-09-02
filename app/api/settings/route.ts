/**
 * [INPUT]: 依赖 withOwnerUser、app-settings、appSettingsUpdateSchema
 * [OUTPUT]: 对外提供 GET 当前设置、PATCH 更新开放注册或模型超时
 * [POS]: 工作区设置 API，仅 OWNER 可写读
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { NextRequest } from "next/server";

import { withOwnerUser } from "@/lib/auth/session";
import { getAppSettings, updateAppSettings } from "@/lib/services/app-settings";
import { handleRouteError, ok } from "@/lib/utils/route";
import { appSettingsUpdateSchema } from "@/lib/validations/settings";

export const dynamic = "force-dynamic";

function toSettingsPayload(settings: { allowRegister: boolean; modelTimeoutMs: number }) {
  return {
    allowRegister: settings.allowRegister,
    modelTimeoutMs: settings.modelTimeoutMs,
  };
}

export async function GET() {
  try {
    return await withOwnerUser(async () => {
      return ok(toSettingsPayload(await getAppSettings()));
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    return await withOwnerUser(async () => {
      const input = appSettingsUpdateSchema.parse(await request.json());
      return ok(toSettingsPayload(await updateAppSettings(input)));
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
