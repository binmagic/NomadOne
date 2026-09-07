/**
 * [INPUT]: 依赖 zod、types/domain 的 studioAspectRatios
 * [OUTPUT]: 对外提供 productSwapGenerateSchema；sceneImage 与 productImage 各一张
 * [POS]: lib/validations 的实拍换品入参闸门，被 app/api/product-swap/* 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

import { studioAspectRatios } from "@/types/domain";

const imagePayloadSchema = z.object({
  fileName: z.string().trim().min(1, "文件名无效").max(180),
  mimeType: z.string().trim().min(1).max(80).optional(),
  base64Data: z.string().min(1, "图片无效").max(8_000_000, "单张图片过大，请压缩到 4MB 以内"),
});

export const productSwapGenerateSchema = z.object({
  sceneImage: imagePayloadSchema,
  productImage: imagePayloadSchema,
  aspectRatio: z.enum(studioAspectRatios).default("3:4"),
  notes: z.string().trim().max(500, "备注过长").optional().default(""),
});

export type ProductSwapGenerateInput = z.infer<typeof productSwapGenerateSchema>;
