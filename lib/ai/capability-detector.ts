/**
 * [INPUT]: 依赖 @/types/domain 的 CapabilityMap / ModelRoleMap / ModelDetectionResult
 * [OUTPUT]: 对外提供能力启发式、OpenAI 图像协议判定（isOpenAiCompatibleImageModel）、自定义模型声明与来源判定
 * [POS]: lib/ai 的模型能力层，被发现流、设置页与 openai-compatible 生图协议分流共用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { CapabilityMap, ModelDetectionResult, ModelRoleMap } from "@/types/domain";

export const CUSTOM_MODEL_SOURCE = "custom";

export type DeclaredModelType = "text" | "vision" | "image_gen" | "image_edit";

export function isOpenAiCompatibleImageModel(modelId: string) {
  return /(?:^|[-_\s])(?:gpt|tt)[-_\s]?image(?:[-_\s]?(?:\d+(?:\.\d+)?|mini|token|guan))?|chatgpt-image/i.test(modelId);
}

type DetectedModelInput = {
  id: string;
  label?: string;
  type?: string | null;
  category?: string | null;
  modalities?: string[];
};

const emptyCapabilityMap = (): CapabilityMap => ({
  text: false,
  vision: false,
  image_gen: false,
  image_edit: false,
  structured_output: false,
  fast: false,
  cheap: false,
  high_quality: false,
});

const emptyRoleMap = (): ModelRoleMap => ({
  analysis: false,
  planning: false,
  hero_image: false,
  detail_image: false,
  image_edit: false,
});

function modelText(model: string | DetectedModelInput) {
  if (typeof model === "string") {
    return model.toLowerCase();
  }

  return [
    model.id,
    model.label,
    model.type,
    model.category,
    ...(model.modalities ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function detectModelCapabilities(model: string | DetectedModelInput): CapabilityMap {
  const id = (typeof model === "string" ? model : model.id).toLowerCase();
  const text = modelText(model);
  const map = emptyCapabilityMap();
  const isGptImageModel = isOpenAiCompatibleImageModel(id);
  const isDallE2 = /dall[-_\s]?e[-_\s]?2/.test(id);
  const isImageTyped = /(^|\b)(image|images|image_generation|image-gen|image_gen)(\b|$)/.test(text);
  const isImageEditTyped = /(image_edit|image-edit|edit|edits|inpaint|mask|retouch)/.test(text);
  const isVisionTyped = /(vision|visual|multimodal|image_input|image-input)/.test(text);
  const isTextTyped = /(^|\b)(text|chat|llm|language|completion|completions)(\b|$)/.test(text);
  const isUtilityModel = /(embedding|embed|rerank|ranker|moderation|whisper|tts|speech|transcrib|audio|sora|video)/.test(id);

  if (
    (/(^|[-_])o[134](?:[-_]|$)|gpt|gemini|claude|qwen|qwq|qvq|glm|deepseek|chat|instruct|command|llama|mistral|mixtral|moonshot|kimi|yi-|ernie|hunyuan|spark|doubao|minimax|abab|grok|reka|cohere|sonar/.test(id) ||
      isTextTyped) &&
    !isUtilityModel &&
    !isImageTyped
  ) {
    map.text = true;
    map.structured_output = true;
  }

  if (/(vision|vl|4o|omni|gemini|multimodal|qwen-vl|qvq|pixtral|llava|visual|claude-3|claude-sonnet|claude-opus|gpt-4\.1|gpt-5)/.test(id) || isVisionTyped) {
    map.vision = true;
    map.text = true;
    map.structured_output = true;
  }

  if (/(image|imagen|flux|sdxl|stable-diffusion|stable.?image|banana|nano-banana|recraft|dall[-_ ]?e|seedream|jimeng|midjourney|mj-|ideogram|hidream|kolors|wanx|cogview|playground|leonardo)/.test(id) || isImageTyped) {
    map.image_gen = true;
    map.high_quality = true;
  }

  if (/(edit|inpaint|mask|kontext|retouch|erase|remove.?background)/.test(id) || isImageEditTyped) {
    map.image_edit = true;
  }

  if (isGptImageModel) {
    map.image_gen = true;
    map.image_edit = true;
    map.high_quality = true;
  }

  if (isDallE2) {
    map.image_edit = true;
  }

  if (/(flash|mini|nano|lite|turbo|instant)/.test(id)) {
    map.fast = true;
    map.cheap = true;
  }

  if (/(pro|ultra|4\\.1|opus|quality|max)/.test(id)) {
    map.high_quality = true;
  }

  if (!Object.values(map).some(Boolean) && !isUtilityModel) {
    map.text = true;
  }

  return map;
}

export function detectModelRoles(capabilities: CapabilityMap): ModelRoleMap {
  const roles = emptyRoleMap();

  if (capabilities.text) {
    roles.analysis = true;
    roles.planning = true;
  }

  if (capabilities.image_gen) {
    roles.hero_image = true;
    roles.detail_image = true;
  }

  if (capabilities.image_edit) {
    roles.image_edit = true;
  }

  return roles;
}

export function normalizeDetectedModels(
  models: DetectedModelInput[],
): ModelDetectionResult[] {
  return models.map((model) => toDetectionResult(model.id, model.label ?? model.id, detectModelCapabilities(model)));
}

export function isCustomSourcedModel(capabilities: unknown) {
  return Boolean(
    capabilities &&
      typeof capabilities === "object" &&
      (capabilities as Record<string, unknown>).__source === CUSTOM_MODEL_SOURCE,
  );
}

export function applyDeclaredModelType<T extends CapabilityMap>(capabilities: T, type: DeclaredModelType): T {
  const map = { ...capabilities };

  if (type === "text") {
    map.text = true;
    map.structured_output = true;
  } else if (type === "vision") {
    map.vision = true;
    map.text = true;
    map.structured_output = true;
  } else if (type === "image_gen") {
    map.image_gen = true;
    map.high_quality = true;
  } else {
    map.image_edit = true;
    map.image_gen = true;
    map.high_quality = true;
  }

  return map;
}

export function declareCustomModel(modelId: string, type: DeclaredModelType): ModelDetectionResult {
  const id = modelId.trim();
  const capabilities = applyDeclaredModelType(detectModelCapabilities(id), type) as CapabilityMap & {
    __source?: string;
  };
  capabilities.__source = CUSTOM_MODEL_SOURCE;
  return toDetectionResult(id, id, capabilities);
}

function toDetectionResult(modelId: string, label: string, capabilities: CapabilityMap): ModelDetectionResult {
  return {
    modelId,
    label,
    capabilities,
    roles: detectModelRoles(capabilities),
    quality: capabilities.high_quality ? "high" : capabilities.fast ? "balanced" : "standard",
    latency: capabilities.fast ? "fast" : "standard",
    cost: capabilities.cheap ? "low" : capabilities.high_quality ? "high" : "medium",
    isAvailable: true,
  };
}
