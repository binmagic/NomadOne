/**
 * [INPUT]: 依赖会话用户、assertProjectOwned、readStorageFile
 * [OUTPUT]: 对外提供 GET /api/files/*，按路径桶校验所有权后回文件字节
 * [POS]: 本地存储的只读出口。uploads/generated/exports 按项目归属；studio 第二段必须是当前 userId；未知桶直接 404
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { NextRequest } from "next/server";

import { withAuthedUser } from "@/lib/auth/session";
import { assertProjectOwned } from "@/lib/services/project-service";
import { readStorageFile } from "@/lib/storage/asset-manager";
import { handleRouteError } from "@/lib/utils/route";

function getContentType(pathname: string) {
  const normalized = pathname.toLowerCase();
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".gif")) return "image/gif";
  if (normalized.endsWith(".svg")) return "image/svg+xml; charset=utf-8";
  if (normalized.endsWith(".json")) return "application/json; charset=utf-8";
  if (normalized.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
}

async function assertFileOwned(relativePath: string, userId: string) {
  const [bucket, ownerKey] = relativePath.split("/");
  if (bucket === "uploads" || bucket === "generated" || bucket === "exports") {
    if (!ownerKey) {
      throw new Error("File not found.");
    }
    await assertProjectOwned(ownerKey, userId);
    return;
  }
  if (bucket === "studio") {
    if (!ownerKey || ownerKey !== userId) {
      throw new Error("File not found.");
    }
    return;
  }
  throw new Error("File not found.");
}

export async function GET(_request: NextRequest, context: { params: { path: string[] } }) {
  try {
    return await withAuthedUser(async (user) => {
      const relativePath = context.params.path.join("/");
      await assertFileOwned(relativePath, user.id);
      const buffer = await readStorageFile(relativePath);
      const contentType = getContentType(relativePath);

      return new Response(buffer, {
        headers: {
          "Content-Type": String(contentType),
        },
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
