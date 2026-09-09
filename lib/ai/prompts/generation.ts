/**
 * [INPUT]: 依赖 Prisma PageSection/ProductAsset、content-language
 * [OUTPUT]: 对外提供详情页生图/重绘/增强/翻译/SVG 布局提示词，以及 buildPhysicalRealityInstruction、buildNoActButtonInstruction
 * [POS]: lib/ai/prompts 的出图口径。默认图内字以 title/copy 为准；第一张头图可锁参考图标题字体，此时 title/copy 让路；禁止把参考图换成全局例子商品；禁止图内 ACT 购买按钮
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { PageSection, ProductAsset } from "@prisma/client";

import {
  contentLanguageNamesForPrompt,
  normalizeContentLanguage,
  type ContentLanguage,
} from "@/lib/utils/content-language";

function readNoTextInImage(section: Pick<PageSection, "editableData">) {
  const data = (section.editableData as Record<string, unknown> | null) ?? {};
  return data.noTextInImage === true;
}

function buildReferenceText(referenceAssets: ProductAsset[]) {
  if (!referenceAssets.length) {
    return "No reference images were provided.";
  }

  return `Reference images: ${referenceAssets.map((item) => item.fileName).join(" / ")}`;
}

function buildMainImageInstruction(referenceAssets: ProductAsset[]) {
  if (!referenceAssets.length) {
    return "If no product image reference is provided, infer the product carefully from the structured analysis and keep the same product identity across all generated sections.";
  }

  return [
    "The uploaded main product image is the source of truth for product identity.",
    "Keep the same product category, shape, material, color family, proportions, grid/layer structure, moving parts, and key recognisable details across every generated hero image and detail image.",
    "Do not invent a different product.",
    "Use the provided image as the visual anchor, then change composition, scene, angle, crop, lighting, and selling-point emphasis according to the section goal. Never replace the product with a similar-looking object or a generic prop.",
  ].join(" ");
}

function buildAspectInstruction(aspectRatio: "1:1" | "3:4" | "9:16") {
  if (aspectRatio === "1:1") {
    return "The final image must be a square 1:1 e-commerce hero composition, optimized for tappable product gallery covers.";
  }

  return aspectRatio === "3:4"
    ? "The final image must be a vertical 3:4 marketplace poster composition."
    : "The final image must be a vertical 9:16 long-form mobile commerce composition.";
}

function buildTargetLanguageInstruction(contentLanguage: ContentLanguage) {
  const targetLanguage = contentLanguageNamesForPrompt[normalizeContentLanguage(contentLanguage)];

  return [
    `All user-facing marketing copy that appears inside the image must be written in ${targetLanguage}.`,
    `The section title, key selling points, short supporting copy, and disclaimers should all be in ${targetLanguage} when they appear in the image.`,
    "Do not mix in Simplified Chinese unless the target language is Simplified Chinese.",
    "Keep the typography native, polished, and commercially readable for the target language.",
  ].join(" ");
}

export function buildPhysicalRealityInstruction() {
  return [
    "Respect product physics and product-specific mechanical logic.",
    "Infer how the product actually works from the uploaded image and section goal: cable exit points, vents, nozzles, hinges, openings, drawers, buttons, handles, gravity, shadows, reflections, support surfaces, airflow, liquid flow, and user interaction direction.",
    "Do not create impossible physical effects: reversed airflow, cords disappearing into furniture, floating unsupported products, hands passing through solid parts, liquids flowing upward, disconnected shadows, impossible reflections, text crossing through product geometry, or parts bending in a way the material cannot.",
    "The attached product photo is the only allowed product. Ignore any example object, toy, appliance, or SKU mentioned in generic instructions that is not this product.",
    "For hair dryers specifically, airflow must leave the front nozzle, the rear intake must not emit wind, and the power cord must connect naturally from the handle/base instead of merging into a desk or wall.",
  ].join(" ");
}

export function buildNoActButtonInstruction() {
  return [
    "NO ACT/CTA BUTTONS — hard visual constraint. Overrides title, copy, visual prompt, style guide, and typography lock.",
    "The image must not contain any call-to-action purchase button, pill, shop bar, or tap-target control.",
    "Forbidden labels include: 立即抢购, 立即购买, 马上抢, 马上购买, 立即下单, 点击购买, 加入购物车, 限时抢购, 马上抢购, Buy Now, Shop Now, Order Now, Add to Cart, Get it now, and any similar purchase or urgency ACT.",
    "Do not draw button chrome: rounded rectangles with drop shadows, filled pills that look tappable, fake marketplace buy bars, or platform UI.",
    "If title, copy, or a locked reference poster contains those words, omit them from the artwork. Do not keep them as plain text either.",
    "Titles, selling-point labels, spec rows, and informational badges remain allowed. Purchase ACT buttons are not.",
  ].join(" ");
}

function buildTypographyLockInstruction() {
  return [
    "TYPOGRAPHY LOCK — highest priority for overlay wording, except ACT/CTA purchase buttons which must still be omitted.",
    "The first attached reference image is a finished marketplace poster whose overlay text must be transplanted unchanged.",
    "Copy every visible title, subtitle, selling-point line, informational badge, price, and disclaimer character-for-character, including misspellings if any. Do not transplant ACT/CTA purchase buttons.",
    "Keep the exact typeface, weight, size, color, tracking, outline, shadow, alignment, rotation, and pixel placement of all text.",
    "Do not translate, rewrite, restyle, resample, or move any letter. Do not replace overlay text with the section title or section copy.",
    "Only replace the product/object in the scene with the main product photo. Background, layout grid, decorative shapes, color blocks, and lighting stay as in the typography reference.",
  ].join(" ");
}

export type SectionImagePromptOptions = {
  lockTypographyFromReference?: boolean;
};

export function buildSectionImagePrompt(
  section: PageSection,
  referenceAssets: ProductAsset[] = [],
  aspectRatio: "1:1" | "3:4" | "9:16" = "9:16",
  contentLanguage: ContentLanguage = "zh-CN",
  options?: SectionImagePromptOptions,
) {
  const lockTypography = options?.lockTypographyFromReference === true;

  return [
    "You are a senior e-commerce key-visual designer creating marketplace-ready product artwork.",
    `Section type: ${section.type}`,
    `Section title: ${section.title}`,
    `Section goal: ${section.goal}`,
    `Section copy: ${section.copy}`,
    `Visual prompt guidance: ${section.visualPrompt}`,
    lockTypography
      ? buildTypographyLockInstruction()
      : "In-image wording source of truth is the section title and section copy. If visual prompt guidance contains different headlines or selling points, discard those words and use title/copy. Drop any ACT/CTA purchase slogans even if they appear in title/copy.",
    buildReferenceText(referenceAssets),
    buildMainImageInstruction(referenceAssets),
    buildAspectInstruction(aspectRatio),
    lockTypography ? "" : buildTargetLanguageInstruction(contentLanguage),
    buildPhysicalRealityInstruction(),
    buildNoActButtonInstruction(),
    "Generate one high-conversion mobile e-commerce visual for this section.",
    "The image should emphasize product clarity, composition hierarchy, material texture, and marketplace aesthetics.",
    lockTypography
      ? "Overlay text is already locked from the reference poster except ACT/CTA purchase buttons, which must be omitted. Do not add extra captions, watermarks, QR codes, or platform UI."
      : readNoTextInImage(section)
        ? "This frame is a marketplace-compliant photograph. Do not render any captions, headlines, badges, watermarks, promotional stickers, QR codes, platform UI, extra logos, or ACT/CTA purchase buttons. Product only, plus real environment if the section requires it."
        : "The headline, selling points, and supporting copy should be visually designed inside the image rather than left for later DOM text insertion. Do not add ACT/CTA purchase buttons.",
    "Make the result feel like finished commercial artwork, not a blank template.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildRegenerationPrompt(
  section: PageSection,
  referenceAssets: ProductAsset[] = [],
  aspectRatio: "1:1" | "3:4" | "9:16" = "9:16",
  contentLanguage: ContentLanguage = "zh-CN",
  options?: SectionImagePromptOptions,
) {
  return [
    buildSectionImagePrompt(section, referenceAssets, aspectRatio, contentLanguage, options),
    options?.lockTypographyFromReference
      ? "This is a regeneration task. Keep the locked overlay typography identical to the reference poster and only improve product identity, lighting, and commercial polish."
      : "This is a regeneration task. Keep the same product identity and selling-point direction, but improve composition accuracy, completion quality, and conversion appeal.",
  ].join("\n");
}

export function buildImageEditPrompt(
  section: PageSection,
  referenceAssets: ProductAsset[] = [],
  mode: "repaint" | "enhance" | "translate" = "repaint",
  aspectRatio: "1:1" | "3:4" | "9:16" = "9:16",
  contentLanguage: ContentLanguage = "zh-CN",
) {
  const targetLanguage = contentLanguageNamesForPrompt[normalizeContentLanguage(contentLanguage)];
  const modeInstruction =
    mode === "translate"
      ? `This is an in-image translation task. Use the current image as the base and translate every visible user-facing word, headline, selling point, label, informational badge, note, and disclaimer into ${targetLanguage}. Remove ACT/CTA purchase buttons such as 立即购买 / 立即抢购 / Buy Now instead of translating them. Preserve the original product, layout, composition, typography hierarchy, colors, lighting, and commercial style as much as possible. Do not add new claims or redesign the image except where text length requires natural typographic fitting. Remove the original-language text after replacing it with ${targetLanguage}.`
      : mode === "enhance"
        ? "This is an enhancement task. Use the current image as the base, preserve the overall framing, and improve realism, texture, lighting, clarity, edge quality, and commercial polish."
        : "This is a repaint task. Use the current image as the base, keep the same product identity, and redesign the composition, atmosphere, styling, and conversion emphasis according to the section goal.";

  return [
    buildSectionImagePrompt(section, referenceAssets, aspectRatio, contentLanguage),
    modeInstruction,
    "The current section image must be treated as the editable base image.",
    "Keep the product identical to the uploaded main product image and do not replace it with a different item.",
    mode === "translate"
      ? "Only change the in-image language. Do not translate invisible metadata, do not add subtitles outside the artwork, and do not leave bilingual duplicates unless the original design intentionally uses bilingual branding."
      : "",
    "Output one marketplace-ready mobile e-commerce image only.",
  ]
    .filter(Boolean)
    .join("\n");
}
export function buildSectionSvgLayoutPrompt(
  section: PageSection,
  referenceAssets: ProductAsset[] = [],
  aspectRatio: "1:1" | "3:4" | "9:16" = "9:16",
  contentLanguage: ContentLanguage = "zh-CN",
) {
  const targetLanguage = contentLanguageNamesForPrompt[normalizeContentLanguage(contentLanguage)];

  return [
    "You are designing a mobile e-commerce section poster that will be rendered as SVG.",
    "Return one strict JSON object only.",
    `All user-facing copy must be written in ${targetLanguage}.`,
    `Section type: ${section.type}`,
    `Section title: ${section.title}`,
    `Section goal: ${section.goal}`,
    `Section copy: ${section.copy}`,
    `Visual prompt guidance: ${section.visualPrompt}`,
    "In-image wording source of truth is the section title and section copy. If visual prompt guidance contains different headlines or selling points, discard those words and use title/copy.",
    buildNoActButtonInstruction(),
    `Target aspect ratio: ${aspectRatio}`,
    buildReferenceText(referenceAssets),
    "Use the main uploaded product image as the product identity reference when composing the layout.",
    "Target JSON shape:",
    `{
  "headline": "string",
  "subheadline": "string",
  "badge": "string",
  "highlights": ["string", "string", "string"],
  "backgroundColor": "#F5E9D8",
  "accentColor": "#A85A2A",
  "panelColor": "#FFF8F0"
}`,
    "Keep the headline concise and commercial.",
    "highlights should contain 2 to 4 short selling points.",
  ].join("\n");
}
