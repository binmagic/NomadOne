/**
 * [INPUT]: 依赖 domain 的 sectionTypes
 * [OUTPUT]: 对外提供 section 创建/补丁/重排/重写 visualPrompt 的 zod schema
 * [POS]: lib/validations 的模块字段闸门，被 sections CRUD 与 rewrite-visual-prompt 路由消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { z } from "zod";

import { sectionTypes } from "@/types/domain";

export const sectionInputSchema = z.object({
  id: z.string().optional(),
  type: z.enum(sectionTypes),
  title: z.string().min(1, "标题不能为空"),
  goal: z.string().min(1, "目标不能为空"),
  copy: z.string().default(""),
  visualPrompt: z.string().default(""),
  editableFields: z.record(z.string(), z.any()).default({}),
});

export const sectionPatchSchema = z.object({
  type: z.enum(sectionTypes).optional(),
  title: z.string().optional(),
  goal: z.string().optional(),
  copy: z.string().optional(),
  visualPrompt: z.string().optional(),
  status: z.enum(["IDLE", "QUEUED", "GENERATING", "SUCCESS", "FAILED"]).optional(),
  editableData: z.record(z.string(), z.any()).optional(),
});

export const sectionReorderSchema = z.object({
  orderedSectionIds: z.array(z.string()).min(1),
});

export const sectionRewriteVisualPromptSchema = z.object({
  title: z.string().optional(),
  goal: z.string().optional(),
  copy: z.string().optional(),
  modelId: z.string().optional().nullable(),
});
