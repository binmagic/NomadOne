/**
 * [INPUT]: 依赖 Prisma ForbiddenWord、generation.ts 的 buildForbiddenWordsInstruction
 * [OUTPUT]: 对外提供工作区共用的违禁词 CRUD，以及 applyForbiddenWordsToPrompt 给生图最后一公里注入
 * [POS]: lib/services 的违禁词内核。不按 userId 隔离，登录用户共用一张表；出图前由各生图服务调用 applyForbiddenWordsToPrompt
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { buildForbiddenWordsInstruction } from "@/lib/ai/prompts/generation";
import { prisma } from "@/lib/db/prisma";
import type { ForbiddenWordView } from "@/types/domain";

function normalizeWord(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function wordKey(value: string) {
  return normalizeWord(value).toLowerCase();
}

function toView(row: { id: string; word: string; createdAt: Date; updatedAt: Date }): ForbiddenWordView {
  return {
    id: row.id,
    word: row.word,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getWordOrThrow(id: string) {
  const row = await prisma.forbiddenWord.findUnique({ where: { id } });
  if (!row) {
    throw new Error("Forbidden word not found.");
  }
  return row;
}

export async function listForbiddenWords(): Promise<ForbiddenWordView[]> {
  const rows = await prisma.forbiddenWord.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toView);
}

export async function listForbiddenWordValues(): Promise<string[]> {
  const rows = await prisma.forbiddenWord.findMany({
    select: { word: true },
    orderBy: { word: "asc" },
  });
  return rows.map((row) => row.word);
}

export async function applyForbiddenWordsToPrompt(prompt: string): Promise<string> {
  const instruction = buildForbiddenWordsInstruction(await listForbiddenWordValues());
  return instruction ? `${prompt}\n${instruction}` : prompt;
}

export async function createForbiddenWords(input: { word?: string; words?: string[] }): Promise<{
  created: ForbiddenWordView[];
  skipped: string[];
}> {
  const incoming = [...(input.words ?? []), ...(input.word ? [input.word] : [])]
    .map(normalizeWord)
    .filter(Boolean);

  const uniqueIncoming: string[] = [];
  const seen = new Set<string>();
  for (const word of incoming) {
    const key = wordKey(word);
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueIncoming.push(word);
  }

  if (uniqueIncoming.length === 0) {
    throw new Error("请填写违禁词");
  }

  const existing = await prisma.forbiddenWord.findMany({ select: { word: true } });
  const existingKeys = new Set(existing.map((row) => wordKey(row.word)));
  const toCreate = uniqueIncoming.filter((word) => !existingKeys.has(wordKey(word)));
  const skipped = uniqueIncoming.filter((word) => existingKeys.has(wordKey(word)));

  if (toCreate.length === 0) {
    throw new Error("这些违禁词都已存在");
  }

  const created = await prisma.$transaction(
    toCreate.map((word) => prisma.forbiddenWord.create({ data: { word } })),
  );

  return { created: created.map(toView), skipped };
}

export async function updateForbiddenWord(id: string, word: string): Promise<ForbiddenWordView> {
  const current = await getWordOrThrow(id);
  const next = normalizeWord(word);
  if (!next) {
    throw new Error("请填写违禁词");
  }

  const others = await prisma.forbiddenWord.findMany({
    where: { id: { not: current.id } },
    select: { word: true },
  });
  if (others.some((row) => wordKey(row.word) === wordKey(next))) {
    throw new Error("该违禁词已存在");
  }

  const row = await prisma.forbiddenWord.update({
    where: { id: current.id },
    data: { word: next },
  });
  return toView(row);
}

export async function deleteForbiddenWord(id: string): Promise<{ id: string }> {
  await getWordOrThrow(id);
  await prisma.forbiddenWord.delete({ where: { id } });
  return { id };
}
