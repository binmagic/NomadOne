/**
 * [INPUT]: 依赖 Prisma ProductAsset、STORAGE_ROOT、nanoid 与 files 工具
 * [OUTPUT]: 对外提供商品素材落盘/读取，以及对话生图 studio/{userId}/{conversationId} 文件
 * [POS]: lib/storage 的唯一落盘入口。商品图走 ProductAsset；Studio 只写磁盘，路径记在 StudioMessage
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import fs from "fs/promises";
import path from "path";

import type { AssetType, ProductAsset } from "@prisma/client";
import { nanoid } from "nanoid";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/utils/env";
import { extFromMime, relativeStorageUrl, sanitizeFileName } from "@/lib/utils/files";

function rootDir() {
  return path.resolve(process.cwd(), env.STORAGE_ROOT);
}

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function ensureStorageScaffold() {
  await Promise.all([
    ensureDir(path.join(rootDir(), "uploads")),
    ensureDir(path.join(rootDir(), "generated")),
    ensureDir(path.join(rootDir(), "exports")),
    ensureDir(path.join(rootDir(), "studio")),
  ]);
}

function projectDir(projectId: string, kind: "uploads" | "generated" | "exports", sectionId?: string) {
  const base = path.join(rootDir(), kind, projectId);
  return sectionId ? path.join(base, sectionId) : base;
}

export async function saveUploadAsset(params: {
  projectId: string;
  type: AssetType;
  fileName: string;
  mimeType?: string | null;
  fileBuffer: Buffer;
  sortOrder: number;
  isMain?: boolean;
}) {
  await ensureStorageScaffold();
  const safeName = `${Date.now()}-${nanoid(6)}-${sanitizeFileName(params.fileName)}`;
  const dir = projectDir(params.projectId, "uploads");
  await ensureDir(dir);
  const relativePath = path.join("uploads", params.projectId, safeName);
  await fs.writeFile(path.join(rootDir(), relativePath), params.fileBuffer);

  return prisma.productAsset.create({
    data: {
      projectId: params.projectId,
      type: params.type,
      filePath: relativePath,
      fileName: params.fileName,
      mimeType: params.mimeType,
      sortOrder: params.sortOrder,
      isMain: params.isMain ?? false,
      metadata: {
        bytes: params.fileBuffer.byteLength,
      },
    },
  });
}

export async function saveGeneratedImage(params: {
  projectId: string;
  sectionId: string;
  prompt: string;
  source: {
    url?: string | null;
    b64Json?: string | null;
    svgText?: string | null;
    mimeType?: string | null;
  };
  metadata?: Record<string, unknown>;
}) {
  await ensureStorageScaffold();
  const dir = projectDir(params.projectId, "generated", params.sectionId);
  await ensureDir(dir);

  const mimeType =
    params.source.svgText ? "image/svg+xml" : params.source.mimeType ?? "image/png";
  const ext = extFromMime(mimeType);
  const fileName = `${Date.now()}-${nanoid(6)}.${ext}`;
  const relativePath = path.join("generated", params.projectId, params.sectionId, fileName);
  const absolutePath = path.join(rootDir(), relativePath);

  if (params.source.svgText) {
    await fs.writeFile(absolutePath, params.source.svgText, "utf8");
  } else if (params.source.b64Json) {
    await fs.writeFile(absolutePath, Buffer.from(params.source.b64Json, "base64"));
  } else if (params.source.url) {
    const response = await fetch(params.source.url);
    if (!response.ok) {
      throw new Error(`Failed to download generated image: ${response.status}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(absolutePath, bytes);
  } else {
    throw new Error("Image generation produced no usable image output.");
  }

  return prisma.productAsset.create({
    data: {
      projectId: params.projectId,
      sectionId: params.sectionId,
      type: "GENERATED",
      filePath: relativePath,
      fileName,
      mimeType,
      sortOrder: 0,
      metadata: {
        prompt: params.prompt,
        ...(params.metadata ?? {}),
      },
    },
  });
}

export async function duplicateExportFile(params: {
  projectId: string;
  fileName: string;
  sourceBuffer: Buffer;
  mimeType: string;
}) {
  await ensureStorageScaffold();
  const ext = extFromMime(params.mimeType);
  const safeName = sanitizeFileName(`${params.fileName}.${ext}`);
  const relativePath = path.join("exports", params.projectId, safeName);
  await ensureDir(projectDir(params.projectId, "exports"));
  await fs.writeFile(path.join(rootDir(), relativePath), params.sourceBuffer);

  return prisma.productAsset.create({
    data: {
      projectId: params.projectId,
      type: "EXPORTED",
      filePath: relativePath,
      fileName: safeName,
      mimeType: params.mimeType,
      sortOrder: 0,
    },
  });
}

export async function deleteAssetRecord(assetId: string) {
  const asset = await prisma.productAsset.findUnique({ where: { id: assetId } });
  if (!asset) {
    return null;
  }

  const absolutePath = path.join(rootDir(), asset.filePath);
  await fs.rm(absolutePath, { force: true });
  await prisma.productAsset.delete({ where: { id: assetId } });
  return asset;
}

export function assetPublicUrl(asset: Pick<ProductAsset, "filePath"> | null | undefined) {
  if (!asset) {
    return null;
  }

  return relativeStorageUrl(asset.filePath);
}

export async function readStorageFile(relativePath: string) {
  const root = rootDir();
  const absolutePath = path.resolve(root, relativePath);
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`)) {
    throw new Error("File not found.");
  }
  return fs.readFile(absolutePath);
}

export async function statStorageFile(relativePath: string) {
  return fs.stat(path.join(rootDir(), relativePath));
}

function studioDir(userId: string, conversationId?: string) {
  const base = path.join(rootDir(), "studio", userId);
  return conversationId ? path.join(base, conversationId) : base;
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Image payload is invalid.");
  }
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

export async function saveStudioFile(params: {
  userId: string;
  conversationId: string;
  source: {
    dataUrl?: string | null;
    url?: string | null;
    b64Json?: string | null;
    mimeType?: string | null;
  };
}) {
  await ensureStorageScaffold();
  const dir = studioDir(params.userId, params.conversationId);
  await ensureDir(dir);

  let mimeType = params.source.mimeType ?? "image/png";
  let bytes: Buffer;

  if (params.source.dataUrl) {
    const parsed = parseDataUrl(params.source.dataUrl);
    mimeType = parsed.mimeType || mimeType;
    bytes = parsed.buffer;
  } else if (params.source.b64Json) {
    bytes = Buffer.from(params.source.b64Json, "base64");
  } else if (params.source.url) {
    const response = await fetch(params.source.url);
    if (!response.ok) {
      throw new Error(`Failed to download generated image: ${response.status}`);
    }
    bytes = Buffer.from(await response.arrayBuffer());
    mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || mimeType;
  } else {
    throw new Error("Image generation produced no usable image output.");
  }

  const fileName = `${Date.now()}-${nanoid(6)}.${extFromMime(mimeType)}`;
  const relativePath = path.join("studio", params.userId, params.conversationId, fileName);
  await fs.writeFile(path.join(rootDir(), relativePath), bytes);

  return {
    relativePath,
    fileName,
    mimeType,
  };
}

export async function deleteStudioConversationFiles(userId: string, conversationId: string) {
  await fs.rm(studioDir(userId, conversationId), { recursive: true, force: true });
}

export async function deleteStudioUserFiles(userId: string) {
  await fs.rm(studioDir(userId), { recursive: true, force: true });
}

export async function storagePathToDataUrl(relativePath: string) {
  const bytes = await readStorageFile(relativePath);
  const mimeType =
    relativePath.toLowerCase().endsWith(".jpg") || relativePath.toLowerCase().endsWith(".jpeg")
      ? "image/jpeg"
      : relativePath.toLowerCase().endsWith(".webp")
        ? "image/webp"
        : relativePath.toLowerCase().endsWith(".gif")
          ? "image/gif"
          : "image/png";
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}
