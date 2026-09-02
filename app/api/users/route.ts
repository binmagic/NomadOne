/**
 * [INPUT]: 依赖 withOwnerUser、user-service 列表/创建、userCreateSchema
 * [OUTPUT]: 对外提供 GET 用户列表、POST 新建成员
 * [POS]: users API 集合入口，仅 OWNER 可访问
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { NextRequest } from "next/server";

import { withOwnerUser } from "@/lib/auth/session";
import { createManagedUser, listUsers } from "@/lib/auth/user-service";
import { handleRouteError, ok } from "@/lib/utils/route";
import { userCreateSchema } from "@/lib/validations/user";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return await withOwnerUser(async () => {
      const users = await listUsers();
      return ok({ users });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return await withOwnerUser(async () => {
      const input = userCreateSchema.parse(await request.json());
      const user = await createManagedUser(input);
      return ok({ user }, { status: 201 });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
