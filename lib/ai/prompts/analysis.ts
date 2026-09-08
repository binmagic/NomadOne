/**
 * [INPUT]: 依赖 Prisma ProductAsset 的 type/fileName/isMain/sortOrder
 * [OUTPUT]: 对外提供 buildProductAnalysisPrompt、buildProductAnalysisRepairPrompt
 * [POS]: lib/ai/prompts 的商品分析口径。主图是品类事实源；禁止把任何具体 SKU 写进全局规则
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { ProductAsset } from "@prisma/client";

const requiredJsonShape = `{
  "productName": "string",
  "category": "string",
  "subcategory": "string",
  "material": "string",
  "color": "string",
  "styleTags": ["string"],
  "targetAudience": ["string"],
  "usageScenarios": ["string"],
  "coreSellingPoints": ["string"],
  "differentiationPoints": ["string"],
  "userConcerns": ["string"],
  "recommendedFocusPoints": ["string"],
  "additionalInformation": "string",
  "suggestedSectionPlan": [
    {
      "type": "hero | selling_points | scenario | detail_closeup | specs | material | comparison | gift_scene | brand_trust | summary",
      "title": "string",
      "goal": "string"
    }
  ]
}`;

const supportedSectionTypes = [
  "hero",
  "selling_points",
  "scenario",
  "detail_closeup",
  "specs",
  "material",
  "comparison",
  "gift_scene",
  "brand_trust",
  "summary",
].join(", ");

export function buildProductAnalysisPrompt(assets: ProductAsset[]) {
  const assetSummary = assets
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(
      (asset, index) =>
        `${index + 1}. type=${asset.type}; file=${asset.fileName}; isMain=${asset.isMain ? "yes" : "no"}`,
    )
    .join("\n");

  return [
    "You are a senior e-commerce product strategist and detail-page planner.",
    "Analyze the provided product images and asset hints, then return one strict JSON object only. The main image is the factual source of truth for what the product actually is.",
    "Do not output markdown, code fences, explanations, comments, or extra keys.",
    "All copy values should be written in Simplified Chinese.",
    "If some attributes are uncertain, infer the most likely answer from the images and keep the field non-empty. Do not misclassify the product by overfitting to props, rulers, labels, packaging, or background objects.",
    "",
    "Available assets:",
    assetSummary || "No uploaded assets.",
    "",
    "Required rules:",
    "1. Every required key must exist.",
    "2. Every array field must be an array of short Chinese strings.",
    "3. suggestedSectionPlan must contain at least 6 sections.",
    `4. suggestedSectionPlan.type must be one of: ${supportedSectionTypes}.`,
    "5. Focus on e-commerce conversion, visual hierarchy, and section planning, but every section must fit the real product category and mechanics shown in the main image.",
    "6. First identify the exact product object, its category, visual structure, count of repeated parts, operation/mechanism, and what it must never be mistaken for. Put this into additionalInformation. Name only what the main image shows. Do not assume any example category, SKU, or toy type from these instructions.",
    "7. additionalInformation must summarize important extra facts for generation, especially product dimensions if visible or inferable. Include placeholders for unknown but required facts: size, weight/capacity/power, compatible specifications, package contents, usage constraints, and safety notes.",
    "",
    "Return exactly this JSON shape:",
    requiredJsonShape,
  ].join("\n");
}

export function buildProductAnalysisRepairPrompt(raw: string) {
  return [
    "You repair malformed product-analysis output into one strict JSON object.",
    "Return JSON only. No markdown, no explanations, no extra keys.",
    "All string values should be in Simplified Chinese when possible.",
    "If a field is missing, infer a reasonable non-empty value from the source content.",
    "If suggestedSectionPlan is missing or too short, create at least 6 valid sections.",
    "If additionalInformation is missing, create a concise Chinese checklist covering size, weight/capacity/power, compatible specifications, package contents, usage constraints, and safety notes. Mark uncertain values as 待用户补充 instead of inventing exact numbers.",
    `Valid section types: ${supportedSectionTypes}.`,
    "",
    "Target JSON shape:",
    requiredJsonShape,
    "",
    "Source content to repair:",
    raw,
  ].join("\n");
}