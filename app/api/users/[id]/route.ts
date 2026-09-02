/**
 * [INPUT]: 依赖 withOwnerUser、user-service 更新/删除、userUpdateSchema
 * [OUTPUT]: 对外提供 PATCH 更新成员、DELETE 删除成员
 * [POS]: 单个用户资源面，OWNER 账号由 service 层拒绝变更
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { NextRequest } from "next/server";

import { withOwnerUser } from "@/lib/auth/session";
import { deleteManagedUser, updateManagedUser } from "@/lib/auth/user-service";
import { handleRouteError, ok } from "@/lib/utils/route";
import { userUpdateSchema } from "@/lib/validations/user";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  try {
    return await withOwnerUser(async () => {
      const input = userUpdateSchema.parse(await request.json());
      const user = await updateManagedUser(context.params.id, input);
      return ok({ user });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: NextRequest, context: { params: { id: string } }) {
  try {
    return await withOwnerUser(async () => {
      const user = await deleteManagedUser(context.params.id);
      return ok({ user });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
