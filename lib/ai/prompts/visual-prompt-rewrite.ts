/**
 * [INPUT]: 依赖 content-language 的语种名、visual-style-guide 的文本化
 * [OUTPUT]: 对外提供 buildVisualPromptRewritePrompt、buildFallbackBilingualVisualPrompt
 * [POS]: lib/ai/prompts 的单模块双语 visualPrompt 重写口径。只改画面说明书，不整页规划，不替代生图 Agent
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  contentLanguageNamesForPrompt,
  normalizeContentLanguage,
  type ContentLanguage,
} from "@/lib/utils/content-language";
import { visualStyleGuideToPrompt, type VisualStyleGuide } from "@/lib/utils/visual-style-guide";

export function buildFallbackBilingualVisualPrompt(input: {
  title: string;
  copy: string;
  previousVisualPrompt?: string;
}) {
  const title = input.title.trim() || "当前模块";
  const copy = input.copy.trim() || title;
  const compositionHint = input.previousVisualPrompt?.trim()
    ? "Keep the previous camera angle, crop, lighting direction, background system and product placement unless they conflict with the new copy."
    : "Use a conversion-focused mobile e-commerce composition with the product as hero.";

  return [
    `Primary Prompt: ${title}。图内标题、卖点、说明和 CTA 必须使用以下文案，不得沿用旧字：${copy}。商品主体清晰，商业排版，文字直接做进画面。`,
    `English Prompt: E-commerce section visual for ${title}. In-image headline, selling points, supporting copy and CTA must match: ${copy}. ${compositionHint} Design typography inside the image. Preserve real product geometry and physics.`,
  ].join("\n");
}

export function buildVisualPromptRewritePrompt(input: {
  title: string;
  goal: string;
  copy: string;
  previousVisualPrompt: string;
  sectionType: string;
  contentLanguage: ContentLanguage;
  visualStyleGuide: VisualStyleGuide;
  productContext?: unknown;
  editableData?: unknown;
  aspectRatio: string;
}) {
  const targetLanguage = contentLanguageNamesForPrompt[normalizeContentLanguage(input.contentLanguage)];

  return [
    "You rewrite one bilingual visualPrompt for an existing e-commerce detail-page section.",
    "Return strict JSON only. No markdown.",
    "Rewrite visualPrompt only. Do not invent a new title, goal, or copy.",
    "The previous visualPrompt is a composition and style reference. Its in-image headline, selling points, supporting copy and CTA are stale and must be replaced.",
    `All in-image text instructions must be written in ${targetLanguage}.`,
    "visualPrompt must use this exact two-part format:",
    `Primary Prompt: <visual direction in ${targetLanguage}>`,
    "English Prompt: <English image prompt>",
    "Do not return a long English-only production prompt. That expansion happens later at image generation.",
    "The image model must generate the marketing title, selling points, supporting copy, and CTA directly inside the image.",
    "In-image words must match the current title / goal / copy. Do not keep old slogans from the previous visualPrompt.",
    "Preserve camera angle, crop, lighting, background system, product placement, and shared style anchors when they do not conflict with the new copy.",
    "Obey the project visual style guide. Keep product identity and physical reality: no reversed airflow, floating unsupported products, cables merging into furniture, or impossible mechanics.",
    "",
    "Task context:",
    JSON.stringify(
      {
        sectionType: input.sectionType,
        aspectRatio: input.aspectRatio,
        title: input.title,
        goal: input.goal,
        copy: input.copy,
        previousVisualPrompt: input.previousVisualPrompt,
        editableData: input.editableData ?? null,
        productContext: input.productContext ?? null,
        visualStyleGuide: visualStyleGuideToPrompt(input.visualStyleGuide),
      },
      null,
      2,
    ),
    "",
    "Return this JSON shape:",
    `{
  "visualPrompt": "Primary Prompt: ...\\nEnglish Prompt: ..."
}`,
  ].join("\n");
}
