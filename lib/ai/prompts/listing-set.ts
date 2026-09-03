/**
 * [INPUT]: 依赖 types/domain 的套图槽位目录、content-language 的语种名
 * [OUTPUT]: 对外提供套图规划/卖点扩写提示词，以及槽位视觉模板
 * [POS]: lib/ai/prompts 的 Listing 套图口径。主图禁止图内字；详情页生图提示词不得覆盖这条
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { contentLanguageNamesForPrompt, type ContentLanguage } from "@/lib/utils/content-language";
import {
  listingSetMarketLabels,
  listingSetSlotCatalog,
  platformLabels,
  type ListingSetMarket,
  type ListingSetSlotKey,
  type PlatformOption,
} from "@/types/domain";

export const listingSetVisualTemplates: Record<ListingSetSlotKey, string> = {
  hero_white:
    "Marketplace-compliant square product hero on a seamless pure white (#FFFFFF) or very light gray studio sweep. Product centered, occupying 60-75% of the frame, three-quarter or true front view matching the reference. Soft even studio lighting, crisp contact shadow only. No props, no lifestyle, no model, no reflections of a room, no text, no badges, no watermarks, no logos other than those printed on the product itself, no promotional stickers. Keep product geometry, color, material and proportions identical to the uploaded source.",
  scene:
    "Lifestyle scene photograph of the SAME product in a real, commercially tasteful environment that matches the target market. Product is the hero, clearly recognizable, naturally placed (not floating). Ambient light, shallow depth, no text overlays, no UI chrome, no fake logos. Preserve product identity from the reference.",
  model:
    "Lifestyle photograph with a real person naturally using, wearing, holding or presenting the SAME product. Pose must be physically possible. Hands, grip, cable routing and product orientation must respect real mechanics. No text overlays. Model appearance and interior should fit the target market. Do not replace the product.",
  detail:
    "Premium product detail board: 1 hero close-up plus 2-3 callout annotations pointing at REAL parts visible on the reference (seams, buttons, fabric weave, ports, stitching, coating). Short labels in the target language, designed as commercial typography, not as a screenshot of a website. White or soft studio ground.",
  selling:
    "High-conversion selling-point infographic built around a large, accurate product render. 3-4 short benefit lines in the target language, clear hierarchy, generous margins, no medical/legal guaranteed claims, no 'No.1' or competitor comparison unless asked. Product identity locked to the reference.",
  specs:
    "Clean specification visual: product on one side, structured spec rows on the other (size, material, weight, contents, compatibility) in the target language. Do not invent certifications. Keep numbers conservative if unknown; prefer qualitative facts from the photos.",
  usage:
    "In-use moment of the SAME product in a typical scenario. Action should match how the object actually works (airflow direction, opening direction, wearing orientation). No text unless a tiny tasteful caption is necessary. No impossible physics.",
  comparison:
    "Tasteful before/after or this-vs-common-alternative board. Do not name competing brands. Keep the product identical to the reference. Short labels in the target language.",
  material:
    "Macro material and craftsmanship frame: texture, stitching, coating, grain, knit, metal finish. Optionally 1-2 short material labels in the target language. Match the real material in the reference; do not upgrade plastic to metal.",
};

type ListingSetPromptContext = {
  platform: PlatformOption;
  market: ListingSetMarket;
  contentLanguage: ContentLanguage;
  sellingPoints: string;
  structureMode: "smart" | "custom";
  slotKeys: ListingSetSlotKey[];
  analyzeViralStyle: boolean;
  generateListingCopy: boolean;
};

function platformCompliance(platform: PlatformOption, market: ListingSetMarket) {
  const marketLabel = listingSetMarketLabels[market];
  const platformLabel = platformLabels[platform];
  return [
    `Target marketplace: ${platformLabel}. Target market: ${marketLabel}.`,
    "First image (hero_white) must pass typical main-image compliance: white/clean background, product fully visible, no promotional text, no watermarks, no QR codes, no platform UI.",
    "Do not invent medical, financial, ranking or 'guaranteed' claims.",
    "Do not add competitor brand names or fake certifications.",
    market === "cn"
      ? "Scenes, interiors and people should feel natural for mainland China e-commerce."
      : market === "sea"
        ? "Scenes should feel at home in Southeast Asian indoor/outdoor mixed living, without stereotyping."
        : "Scenes and people should feel natural for Western e-commerce listing photography.",
  ].join(" ");
}

export function buildListingSetPlanPrompt(input: ListingSetPromptContext) {
  const language = contentLanguageNamesForPrompt[input.contentLanguage];
  const slotList = input.slotKeys
    .map((key, index) => `${index + 1}. ${key} — ${listingSetSlotCatalog[key].label}`)
    .join("\n");

  return [
    "You are a senior marketplace listing art director. Return one strict JSON object only.",
    "Plan a product listing image set (carousel / 主图套图), NOT a long detail page.",
    platformCompliance(input.platform, input.market),
    `User-facing copy inside images (where allowed) and listing copy must be in ${language}.`,
    input.sellingPoints.trim()
      ? `Merchant notes / selling points:\n${input.sellingPoints.trim()}`
      : "Merchant notes were empty; infer honest selling points from the product photos only.",
    "",
    input.structureMode === "custom"
      ? `Use exactly these slots in this order:\n${slotList}`
      : `Choose ${input.slotKeys.length} slots. Prefer this default order unless the product clearly needs a swap (for example fashion may keep two model frames and drop specs):\n${slotList}`,
    "slots[].slotKey must be one of the provided keys. Do not invent keys.",
    "visualPrompt must be 180-420 characters, bilingual if helpful, and lock product identity to the uploaded photos.",
    "hero_white / scene / model / usage prompts must forbid overlay text.",
    "detail / selling / specs / comparison / material prompts should design short typography into the frame.",
    input.generateListingCopy
      ? "listingCopy must include a marketplace title, 3-6 short selling points, a 60-120 word description, and a few search keywords. No fake discounts."
      : "Still fill listingCopy with conservative factual copy inferred from the photos.",
    input.analyzeViralStyle
      ? "viralStyle is required. Infer high-converting listing tropes for this category and marketplace from the photos: lighting, crop, color temperature, prop language, model energy, typography density on allowed slots. Apply those tropes inside every visualPrompt. hero_white must stay white-background and text-free even when tropes are applied. Do not copy a competitor brand."
      : "viralStyle must be null. Do not chase a viral look; keep the set clean and product-true.",
    "JSON shape: { productName, slots: [{ slotKey, title, goal, copy, visualPrompt }], listingCopy: { productName, listingTitle, sellingPoints, description, keywords }, viralStyle: { summary, visualTropes, colorMood, avoid } | null }",
  ].join("\n");
}

export function buildListingSetCopyAssistPrompt(input: {
  notes: string;
  platform: PlatformOption;
  market: ListingSetMarket;
  contentLanguage: ContentLanguage;
}) {
  const language = contentLanguageNamesForPrompt[input.contentLanguage];
  return [
    "You are a conversion copywriter for marketplace listings. Return one strict JSON object only: { sellingPointsText }.",
    `Write in ${language}.`,
    platformCompliance(input.platform, input.market),
    "Expand the merchant notes into a compact brief the image model can follow.",
    "Include, as numbered lines: 1 product name 2 core selling points 3 audience 4 usage scenes 5 expected specs if visible.",
    "Do not invent certifications, rankings, or medical claims.",
    input.notes.trim() ? `Merchant notes:\n${input.notes.trim()}` : "Merchant notes were empty; infer from the attached photos.",
    "sellingPointsText should be 8-16 short lines, ready to paste back into a form.",
  ].join("\n");
}

export function buildListingSetViralAssistPrompt(input: {
  notes: string;
  platform: PlatformOption;
  market: ListingSetMarket;
  contentLanguage: ContentLanguage;
}) {
  const language = contentLanguageNamesForPrompt[input.contentLanguage];
  return [
    "You are a marketplace listing art director. Return one strict JSON object only: { summary, visualTropes, colorMood, avoid }.",
    `Write in ${language}.`,
    platformCompliance(input.platform, input.market),
    "Infer high-converting listing tropes for this product category from the photos.",
    "summary: 2-3 sentences on the winning look.",
    "visualTropes: 3-5 short tropes (crop, lighting, props, model energy, typography density).",
    "colorMood: one short phrase.",
    "avoid: 2-4 things not to copy from cheap viral templates (fake rankings, competitor brands, medical claims).",
    "Do not invent a different product. hero images must remain white-background and text-free.",
    input.notes.trim() ? `Merchant notes:\n${input.notes.trim()}` : "Merchant notes were empty; infer from the attached photos.",
  ].join("\n");
}

export function buildFallbackSlotPrompt(slotKey: ListingSetSlotKey, productName: string, sellingPoints: string) {
  const catalog = listingSetSlotCatalog[slotKey];
  const notes = sellingPoints.trim() ? ` Merchant notes: ${sellingPoints.trim().slice(0, 280)}` : "";
  return `${catalog.label} for ${productName || "the product"}. ${listingSetVisualTemplates[slotKey]}${notes}`;
}
