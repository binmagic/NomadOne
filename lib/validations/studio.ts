/**
 * [INPUT]: 依赖 zod、types/domain 的 studioAspectRatios
 * [OUTPUT]: 对外提供 createStudioConversationSchema、studioMessageRequestSchema
 * [POS]: lib/validations 的对话生图入参闸门，被 app/api/studio/* 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

import { studioAspectRatios } from "@/types/domain";

export const createStudioConversationSchema = z.object({
  title: z.string().trim().max(40).optional(),
});

export const studioMessageRequestSchema = z.object({
  prompt: z.string().trim().min(1, "请输入生成或修改说明").max(4000, "说明过长"),
  images: z
    .array(z.string().min(1, "图片无效").max(8_000_000, "单张图片过大，请压缩到 4MB 以内"))
    .max(4, "最多附 4 张图")
    .optional()
    .default([]),
  aspectRatio: z.enum(studioAspectRatios).optional().default("1:1"),
  modelId: z.string().trim().min(1).optional().nullable(),
});
