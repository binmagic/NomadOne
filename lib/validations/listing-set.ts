/**
 * [INPUT]: 依赖 zod、types/domain 的套图槽位/平台/比例、content-language
 * [OUTPUT]: 对外提供 listingSetGenerateSchema、listingSetCopyAssistSchema
 * [POS]: lib/validations 的商品套图入参闸门，被 app/api/listing-set/* 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

import { contentLanguageOptions } from "@/lib/utils/content-language";
import {
  listingSetGroupKeys,
  listingSetMarkets,
  listingSetMaxSlotCount,
  listingSetMaxSourceImages,
  listingSetMinSlotCount,
  platformOptions,
  studioAspectRatios,
} from "@/types/domain";

const imagePayloadSchema = z.object({
  fileName: z.string().trim().min(1, "文件名无效").max(180),
  mimeType: z.string().trim().min(1).max(80).optional(),
  base64Data: z.string().min(1, "图片无效").max(8_000_000, "单张图片过大，请压缩到 4MB 以内"),
});

const groupCountSchema = z
  .object({
    white: z.number().int().min(0).max(4).default(1),
    scene: z.number().int().min(0).max(6).default(2),
    selling: z.number().int().min(0).max(6).default(2),
    other: z.number().int().min(0).max(6).default(2),
  })
  .optional();

export const listingSetGenerateSchema = z
  .object({
    images: z.array(imagePayloadSchema).min(1, "请至少上传 1 张商品原图").max(listingSetMaxSourceImages, `同一产品最多 ${listingSetMaxSourceImages} 张`),
    platform: z.enum(platformOptions).default("douyin_ecommerce"),
    market: z.enum(listingSetMarkets).default("cn"),
    contentLanguage: z.enum(contentLanguageOptions).default("zh-CN"),
    aspectRatio: z.enum(studioAspectRatios).default("1:1"),
    sellingPoints: z.string().trim().max(2000, "卖点说明过长").optional().default(""),
    structureMode: z.enum(["smart", "custom"]).default("smart"),
    groupCounts: groupCountSchema,
    analyzeViralStyle: z.boolean().default(false),
    generateListingCopy: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.structureMode !== "custom") return;
    const counts = value.groupCounts ?? { white: 1, scene: 2, selling: 2, other: 2 };
    const total = listingSetGroupKeys.reduce((sum, key) => sum + (counts[key] ?? 0), 0);
    if (total < listingSetMinSlotCount) {
      ctx.addIssue({
        code: "custom",
        message: `自定义套图至少 ${listingSetMinSlotCount} 张`,
        path: ["groupCounts"],
      });
    }
    if (total > listingSetMaxSlotCount) {
      ctx.addIssue({
        code: "custom",
        message: `自定义套图最多 ${listingSetMaxSlotCount} 张`,
        path: ["groupCounts"],
      });
    }
    if ((counts.white ?? 0) < 1) {
      ctx.addIssue({
        code: "custom",
        message: "自定义套图至少保留 1 张白底图",
        path: ["groupCounts", "white"],
      });
    }
  });

export const listingSetCopyAssistSchema = z.object({
  images: z.array(z.string().min(1).max(8_000_000)).max(listingSetMaxSourceImages).optional().default([]),
  notes: z.string().trim().max(2000).optional().default(""),
  platform: z.enum(platformOptions).default("douyin_ecommerce"),
  market: z.enum(listingSetMarkets).default("cn"),
  contentLanguage: z.enum(contentLanguageOptions).default("zh-CN"),
});

export const listingSetViralAssistSchema = listingSetCopyAssistSchema;

export type ListingSetGenerateInput = z.infer<typeof listingSetGenerateSchema>;
export type ListingSetCopyAssistInput = z.infer<typeof listingSetCopyAssistSchema>;
export type ListingSetViralAssistInput = z.infer<typeof listingSetViralAssistSchema>;
