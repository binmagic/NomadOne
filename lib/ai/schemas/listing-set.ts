/**
 * [INPUT]: 依赖 zod、types/domain 的 listingSetSlotKeys
 * [OUTPUT]: 对外提供 listingSetPlanSchema、listingSetCopyAssistOutputSchema
 * [POS]: lib/ai/schemas 的套图结构化出口，被 listing-set-service 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

import { listingSetSlotKeys } from "@/types/domain";

export const listingSetPlanSlotSchema = z.object({
  slotKey: z.enum(listingSetSlotKeys),
  title: z.string().min(1),
  goal: z.string().min(1),
  copy: z.string().min(1),
  visualPrompt: z.string().min(1),
});

export const listingSetCopySchema = z.object({
  productName: z.string().min(1),
  listingTitle: z.string().min(1),
  sellingPoints: z.array(z.string().min(1)).min(3).max(8),
  description: z.string().min(1),
  keywords: z.array(z.string().min(1)).max(12).default([]),
});

export const listingSetViralStyleSchema = z.object({
  summary: z.string().min(1),
  visualTropes: z.array(z.string().min(1)).min(2).max(6),
  colorMood: z.string().min(1),
  avoid: z.array(z.string().min(1)).max(6).default([]),
});

export const listingSetPlanSchema = z.object({
  productName: z.string().min(1),
  slots: z.array(listingSetPlanSlotSchema).min(7).max(10),
  listingCopy: listingSetCopySchema,
  viralStyle: listingSetViralStyleSchema.nullable().optional(),
});

export const listingSetCopyAssistOutputSchema = z.object({
  sellingPointsText: z.string().min(1),
});

export type ListingSetPlan = z.infer<typeof listingSetPlanSchema>;
export type ListingSetCopyAssistOutput = z.infer<typeof listingSetCopyAssistOutputSchema>;
