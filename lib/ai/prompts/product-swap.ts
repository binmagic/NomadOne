/**
 * [INPUT]: 依赖 generation.ts 的 buildPhysicalRealityInstruction
 * [OUTPUT]: 对外提供实拍换品 / 重新生成提示词
 * [POS]: lib/ai/prompts 的换品口径。场景图是底板，本品图只提供身份；禁止锁字体、禁止商业精修
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { buildPhysicalRealityInstruction } from "@/lib/ai/prompts/generation";

function buildCoreSwapPrompt(notes: string) {
  const extra = notes.trim()
    ? `Merchant notes about grip, orientation or product identity (follow only if they do not restyle the scene):\n${notes.trim()}`
    : "";

  return [
    "You are editing a real user-generated photograph in place. This is a product replacement, not a new commercial render and not a marketplace poster.",
    "Image 1 (base) is the scene photograph: a person using or presenting a competitor product in a real environment.",
    "Image 2 (reference) is the merchant's own product. Use it only as the identity of the object to insert.",
    "Replace ONLY the competitor product that is being held, worn, used or displayed. Do not replace the person, face, body, pose, clothing, hands, fingers, furniture, props, background, crop, camera angle, lighting, color temperature, shadows of the room, camera grain, noise, or compression artifacts.",
    "Do not beautify, restyle, relight, smooth skin, sharpen into studio photography, or turn this into e-commerce artwork.",
    "The inserted product must keep the identity of Image 2: category, silhouette, proportions, color, material, logos and markings printed on the product. Do not invent a similar object.",
    "Hands must grip the new product. Contact shadows, occlusions and reflections of the inserted product must match the scene's existing light.",
    buildPhysicalRealityInstruction(),
    "Do not add captions, headlines, badges, watermarks, QR codes, platform UI, or extra logos. Do not change text that already exists in the scene (clothing prints, posters, screens).",
    "Output exactly one still image with the same framing as Image 1.",
    extra,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildProductSwapPrompt(notes = "") {
  return buildCoreSwapPrompt(notes);
}

export function buildProductSwapRegeneratePrompt(notes = "") {
  return [
    buildCoreSwapPrompt(notes),
    "This is a regeneration of the same swap. Keep the same scene and the same product identity; only retry a more accurate product replacement and hand contact.",
  ].join("\n");
}
