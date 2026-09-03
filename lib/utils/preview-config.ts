/**
 * [INPUT]: 依赖 content-language 的 normalizeContentLanguage
 * [OUTPUT]: 对外提供头图/详情页数量边界、clamp、选项列表与 previewConfig 读取
 * [POS]: lib/utils 的输出配置契约，规划、导出、编辑台和配置卡片共用同一组边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { normalizeContentLanguage, type ContentLanguage } from "@/lib/utils/content-language";

export const HERO_IMAGE_COUNT_MIN = 3;
export const HERO_IMAGE_COUNT_MAX = 5;
export const HERO_IMAGE_COUNT_DEFAULT = 4;

export const DETAIL_SECTION_COUNT_MIN = 0;
export const DETAIL_SECTION_COUNT_MAX = 10;
export const DETAIL_SECTION_COUNT_DEFAULT = 6;
export const DETAIL_SECTION_COUNT_AUTO_MIN = 4;

export const heroImageCountOptions = [3, 4, 5] as const;
export const detailSectionCountOptions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export type ImageAspectRatio = "3:4" | "9:16";

export type PreviewConfig = {
  heroImageCount: number;
  detailSectionCount: number;
  imageAspectRatio: ImageAspectRatio;
  contentLanguage: ContentLanguage;
};

function readCount(value: unknown, fallback: number) {
  if (value == null || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clampHeroImageCount(value: unknown, fallback = HERO_IMAGE_COUNT_DEFAULT) {
  return Math.min(HERO_IMAGE_COUNT_MAX, Math.max(HERO_IMAGE_COUNT_MIN, Math.round(readCount(value, fallback))));
}

export function clampDetailSectionCount(value: unknown, fallback = DETAIL_SECTION_COUNT_DEFAULT) {
  return Math.min(
    DETAIL_SECTION_COUNT_MAX,
    Math.max(DETAIL_SECTION_COUNT_MIN, Math.round(readCount(value, fallback))),
  );
}

export function readPreviewConfig(snapshot: unknown): PreviewConfig {
  const data = (snapshot as Record<string, unknown> | null) ?? {};
  const previewConfig = (data.previewConfig as Record<string, unknown> | null) ?? {};

  return {
    heroImageCount: clampHeroImageCount(previewConfig.heroImageCount),
    detailSectionCount: clampDetailSectionCount(previewConfig.detailSectionCount),
    imageAspectRatio: previewConfig.imageAspectRatio === "3:4" ? "3:4" : "9:16",
    contentLanguage: normalizeContentLanguage(previewConfig.contentLanguage),
  };
}
