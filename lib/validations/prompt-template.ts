/**
 * [INPUT]: 依赖 zod
 * [OUTPUT]: 对外提供 createPromptTemplateSchema、updatePromptTemplateSchema
 * [POS]: lib/validations 的提示词卡片入参闸门，被 app/api/prompts/* 与表单共用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

export const promptTemplateImageSchema = z
  .string()
  .min(1, "请上传效果图")
  .max(8_000_000, "单张图片过大，请压缩到 4MB 以内")
  .regex(/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i, "请上传 png/jpeg/webp/gif 效果图");

export const createPromptTemplateSchema = z.object({
  title: z.string().trim().min(1, "请填写标题").max(40, "标题过长"),
  prompt: z.string().trim().min(1, "请填写提示词").max(4000, "说明过长"),
  image: promptTemplateImageSchema,
});

export const updatePromptTemplateSchema = z
  .object({
    title: z.string().trim().min(1, "请填写标题").max(40, "标题过长").optional(),
    prompt: z.string().trim().min(1, "请填写提示词").max(4000, "说明过长").optional(),
    image: promptTemplateImageSchema.optional(),
  })
  .refine((value) => value.title !== undefined || value.prompt !== undefined || value.image !== undefined, {
    message: "没有要更新的字段",
  });
