/**
 * [INPUT]: 依赖 Prisma PromptTemplate、savePromptPreview / deletePromptTemplateFiles / deletePromptPreviewFile、relativeStorageUrl
 * [OUTPUT]: 对外提供工作区共用的提示词卡片 CRUD；创建必须带效果图
 * [POS]: lib/services 的提示词卡片内核。不按 userId 隔离，登录用户共用一张库；不碰 Project/Studio 会话
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { prisma } from "@/lib/db/prisma";
import {
  deletePromptPreviewFile,
  deletePromptTemplateFiles,
  savePromptPreview,
} from "@/lib/storage/asset-manager";
import { relativeStorageUrl } from "@/lib/utils/files";
import type { PromptTemplateView } from "@/types/domain";

function toView(row: {
  id: string;
  title: string;
  prompt: string;
  previewPath: string;
  createdAt: Date;
  updatedAt: Date;
}): PromptTemplateView {
  return {
    id: row.id,
    title: row.title,
    prompt: row.prompt,
    previewUrl: relativeStorageUrl(row.previewPath),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getTemplateOrThrow(id: string) {
  const row = await prisma.promptTemplate.findUnique({ where: { id } });
  if (!row) {
    throw new Error("Prompt template not found.");
  }
  return row;
}

export async function listPromptTemplates(): Promise<PromptTemplateView[]> {
  const rows = await prisma.promptTemplate.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toView);
}

export async function getPromptTemplate(id: string): Promise<PromptTemplateView> {
  return toView(await getTemplateOrThrow(id));
}

export async function createPromptTemplate(input: {
  title: string;
  prompt: string;
  image: string;
}): Promise<PromptTemplateView> {
  const pending = await prisma.promptTemplate.create({
    data: {
      title: input.title,
      prompt: input.prompt,
      previewPath: "_",
    },
  });

  try {
    const saved = await savePromptPreview({
      templateId: pending.id,
      source: { dataUrl: input.image },
    });
    const row = await prisma.promptTemplate.update({
      where: { id: pending.id },
      data: { previewPath: saved.relativePath },
    });
    return toView(row);
  } catch (error) {
    await deletePromptTemplateFiles(pending.id);
    await prisma.promptTemplate.delete({ where: { id: pending.id } }).catch(() => undefined);
    throw error;
  }
}

export async function updatePromptTemplate(
  id: string,
  input: { title?: string; prompt?: string; image?: string },
): Promise<PromptTemplateView> {
  const current = await getTemplateOrThrow(id);
  const data: { title?: string; prompt?: string; previewPath?: string } = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.prompt !== undefined) data.prompt = input.prompt;

  let nextPreviewPath: string | null = null;
  if (input.image) {
    const saved = await savePromptPreview({
      templateId: id,
      source: { dataUrl: input.image },
    });
    nextPreviewPath = saved.relativePath;
    data.previewPath = saved.relativePath;
  }

  const row = await prisma.promptTemplate.update({
    where: { id: current.id },
    data,
  });

  if (nextPreviewPath && current.previewPath && current.previewPath !== nextPreviewPath && current.previewPath !== "_") {
    await deletePromptPreviewFile(current.previewPath).catch(() => undefined);
  }

  return toView(row);
}

export async function deletePromptTemplate(id: string): Promise<{ id: string }> {
  const current = await getTemplateOrThrow(id);
  await deletePromptTemplateFiles(id, current.previewPath);
  await prisma.promptTemplate.delete({ where: { id } });
  return { id };
}
