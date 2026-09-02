/**
 * [INPUT]: 依赖 Prisma、OpenAICompatibleAdapter、capability-detector、model-matcher、provider-runtime ALS、AppSettings 模型超时
 * [OUTPUT]: 对外提供连接测试、模型发现、配置保存/激活与 getProviderAdapter
 * [POS]: lib/services 的 Provider 内核；发现列表与用户手填 ID 在保存时合并，自定义模型按 capabilities.__source 保留
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { prisma } from "@/lib/db/prisma";
import { OpenAICompatibleAdapter } from "@/lib/ai/adapters/openai-compatible";
import {
  applyDeclaredModelType,
  declareCustomModel,
  detectModelRoles,
  isCustomSourcedModel,
  normalizeDetectedModels,
  type DeclaredModelType,
} from "@/lib/ai/capability-detector";
import { recommendDefaultModels } from "@/lib/ai/model-matcher";
import { encryptSecret } from "@/lib/utils/crypto";
import { getRequestUserId } from "@/lib/auth/request-user";
import { getModelTimeoutMs } from "@/lib/services/app-settings";
import { getRequestProviderCredentials, resolveEffectiveBaseUrl } from "@/lib/services/provider-runtime";
import type {
  CapabilityMap,
  ModelDetectionResult,
  ModelRoleMap,
  ProviderConnectionInput,
} from "@/types/domain";

type RuntimeProviderModel = {
  id: string;
  providerConfigId: string;
  modelId: string;
  label: string;
  capabilities: Record<string, unknown>;
  roles: Record<string, unknown>;
  quality: string | null;
  latency: string | null;
  cost: string | null;
  isAvailable: boolean;
  isDefaultAnalysis: boolean;
  isDefaultPlanning: boolean;
  isDefaultHeroImage: boolean;
  isDefaultDetailImage: boolean;
  isDefaultImageEdit: boolean;
  createdAt: Date;
  updatedAt: Date;
  endpointSupport: {
    imageGeneration: string;
    imageEdit: string;
    note: string | null;
  };
};

type ProviderAdapterContext = {
  provider: {
    id: string;
    name: string;
    baseUrl: string;
    apiKeyEncrypted: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    models: RuntimeProviderModel[];
  };
  apiKey: string;
  adapter: OpenAICompatibleAdapter;
};

type ProviderModelSnapshot = {
  modelId: string;
  label: string;
  capabilities: Record<string, unknown>;
  roles: Record<string, unknown>;
  quality?: string | null;
  latency?: string | null;
  cost?: string | null;
  isAvailable: boolean;
  endpointSupport?: {
    imageGeneration: string;
    imageEdit: string;
    note?: string | null;
  };
};

type DiscoveredProviderModel = {
  id: string;
  label?: string;
  type?: string | null;
  category?: string | null;
  modalities?: string[];
};

const OPENAI_TEXT_MODEL_PRESETS: DiscoveredProviderModel[] = [
  { id: "gpt-5-mini", label: "gpt-5-mini", type: "text", category: "chat" },
  { id: "gpt-5-nano", label: "gpt-5-nano", type: "text", category: "chat" },
  { id: "gpt-4.1-mini", label: "gpt-4.1-mini", type: "text", category: "chat" },
  { id: "gpt-4.1-nano", label: "gpt-4.1-nano", type: "text", category: "chat" },
  { id: "gpt-4o-mini", label: "gpt-4o-mini", type: "text", category: "chat" },
  { id: "gpt-4o", label: "gpt-4o", type: "text", category: "chat", modalities: ["text", "vision"] },
  { id: "gpt-4.1", label: "gpt-4.1", type: "text", category: "chat", modalities: ["text", "vision"] },
];

const OPENAI_IMAGE_MODEL_PRESETS: DiscoveredProviderModel[] = [
  { id: "gpt-image-2-2026-04-21", label: "gpt-image-2-2026-04-21", type: "image", category: "image" },
  { id: "gpt-image-2", label: "gpt-image-2", type: "image", category: "image" },
  { id: "gpt-image-1.5", label: "gpt-image-1.5", type: "image", category: "image" },
  { id: "gpt-image-1.5-2025-12-16", label: "gpt-image-1.5-2025-12-16", type: "image", category: "image" },
  { id: "gpt-image-1-mini", label: "gpt-image-1-mini", type: "image", category: "image" },
  { id: "gpt-image-1", label: "gpt-image-1", type: "image", category: "image" },
  { id: "dall-e-3", label: "dall-e-3", type: "image", category: "image" },
  { id: "dall-e-2", label: "dall-e-2", type: "image", category: "image" },
];

function maskApiKey(apiKey: string) {
  const trimmed = apiKey.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 10) {
    return `${trimmed.slice(0, 3)}***${trimmed.slice(-2)}`;
  }
  return `${trimmed.slice(0, 6)}***${trimmed.slice(-4)}`;
}

function readEndpointSupport(capabilities: Record<string, unknown> | null | undefined) {
  return {
    imageGeneration: (capabilities?.__imageGenerationStatus as string | undefined) ?? "unknown",
    imageEdit: (capabilities?.__imageEditStatus as string | undefined) ?? "unknown",
    note: (capabilities?.__probeNote as string | undefined) ?? null,
  };
}

function hydrateProviderModels<T extends { capabilities: any }>(models: T[]) {
  return models.map((model) => ({
    ...model,
    endpointSupport: readEndpointSupport(model.capabilities as Record<string, unknown> | undefined),
  }));
}

function shouldIncludeOpenAiImagePresets(baseUrl: string, models: Array<{ modelId?: string; id?: string }>) {
  const text = `${baseUrl} ${models.map((model) => model.modelId ?? model.id ?? "").join(" ")}`.toLowerCase();
  return /openai|chatgpt|gpt-|(^|[^a-z])o[1345](?:[^a-z]|$)|dall[-_\s]?e/.test(text);
}

function mergeDiscoveredModels(baseUrl: string, models: DiscoveredProviderModel[]) {
  if (!shouldIncludeOpenAiImagePresets(baseUrl, models)) {
    return models;
  }

  const seen = new Set(models.map((model) => model.id.toLowerCase()));
  const presets = [...OPENAI_TEXT_MODEL_PRESETS, ...OPENAI_IMAGE_MODEL_PRESETS];
  const missingPresets = presets.filter((model) => !seen.has(model.id.toLowerCase()));
  return [...models, ...missingPresets];
}

function mergeHydratedProviderModels<T extends RuntimeProviderModel>(
  providerId: string,
  baseUrl: string,
  models: T[],
) {
  if (!shouldIncludeOpenAiImagePresets(baseUrl, models)) {
    return models;
  }

  const seen = new Set(models.map((model) => model.modelId.toLowerCase()));
  const missingPresets = [...OPENAI_TEXT_MODEL_PRESETS, ...OPENAI_IMAGE_MODEL_PRESETS].filter((model) => !seen.has(model.id.toLowerCase()));
  if (missingPresets.length === 0) {
    return models;
  }

  const now = new Date();
  const supplemental = enrichModelEndpointSupport(normalizeDetectedModels(missingPresets)).map((model) => ({
    id: `${providerId}:preset:${model.modelId}`,
    providerConfigId: providerId,
    modelId: model.modelId,
    label: model.label,
    capabilities: model.capabilities as Record<string, unknown>,
    roles: model.roles as Record<string, unknown>,
    quality: model.quality ?? null,
    latency: model.latency ?? null,
    cost: model.cost ?? null,
    isAvailable: model.isAvailable,
    isDefaultAnalysis: false,
    isDefaultPlanning: false,
    isDefaultHeroImage: false,
    isDefaultDetailImage: false,
    isDefaultImageEdit: false,
    createdAt: now,
    updatedAt: now,
    endpointSupport: model.endpointSupport ?? {
      imageGeneration: "unknown",
      imageEdit: "unknown",
      note: PASSIVE_IMAGE_CAPABILITY_NOTE,
    },
  })) as T[];

  return [...models, ...supplemental];
}

const PASSIVE_IMAGE_CAPABILITY_NOTE =
  "Passive capability detection only; no real image endpoint probe is called during model discovery.";

function enrichModelEndpointSupport(models: ProviderModelSnapshot[]) {
  return models.map((model) => {
    const capabilities = { ...(model.capabilities as Record<string, unknown>) };
    delete capabilities.real_image_gen;
    delete capabilities.real_image_edit;

    const hasImageGeneration = Boolean(capabilities.image_gen);
    const hasImageEdit = Boolean(capabilities.image_edit);
    const endpointSupport = {
      imageGeneration: hasImageGeneration ? ("unknown" as const) : ("not_applicable" as const),
      imageEdit: hasImageEdit ? ("unknown" as const) : ("not_applicable" as const),
      note: hasImageGeneration || hasImageEdit ? PASSIVE_IMAGE_CAPABILITY_NOTE : null,
    };

    capabilities.__imageGenerationStatus = endpointSupport.imageGeneration;
    capabilities.__imageEditStatus = endpointSupport.imageEdit;
    capabilities.__probeNote = endpointSupport.note;

    return {
      ...model,
      capabilities: capabilities as CapabilityMap,
      roles: { ...model.roles } as ModelRoleMap,
      endpointSupport,
    };
  }) satisfies ModelDetectionResult[];
}

type ProviderDefaultAssignments = {
  analysisModelId?: string | null;
  planningModelId?: string | null;
  heroImageModelId?: string | null;
  detailImageModelId?: string | null;
  imageEditModelId?: string | null;
};

const ASSIGNMENT_MODEL_TYPES: Array<{ key: keyof ProviderDefaultAssignments; type: DeclaredModelType }> = [
  { key: "analysisModelId", type: "vision" },
  { key: "planningModelId", type: "text" },
  { key: "heroImageModelId", type: "image_gen" },
  { key: "detailImageModelId", type: "image_gen" },
  { key: "imageEditModelId", type: "image_edit" },
];

function assignedModelIds(defaults: ProviderDefaultAssignments) {
  return new Set(
    ASSIGNMENT_MODEL_TYPES.map(({ key }) => defaults[key]?.trim()).filter((id): id is string => Boolean(id)),
  );
}

function toModelSnapshot(model: {
  modelId: string;
  label: string;
  capabilities: unknown;
  roles: unknown;
  quality?: string | null;
  latency?: string | null;
  cost?: string | null;
  isAvailable: boolean;
}): ProviderModelSnapshot {
  return {
    modelId: model.modelId,
    label: model.label,
    capabilities: (model.capabilities ?? {}) as Record<string, unknown>,
    roles: (model.roles ?? {}) as Record<string, unknown>,
    quality: model.quality ?? null,
    latency: model.latency ?? null,
    cost: model.cost ?? null,
    isAvailable: model.isAvailable,
  };
}

function mergeAssignedModels(models: ProviderModelSnapshot[], defaults: ProviderDefaultAssignments, existingCustom: ProviderModelSnapshot[] = []) {
  const byId = new Map<string, ProviderModelSnapshot>();

  for (const model of [...existingCustom, ...models]) {
    byId.set(model.modelId, toModelSnapshot(model));
  }

  for (const { key, type } of ASSIGNMENT_MODEL_TYPES) {
    const modelId = defaults[key]?.trim();
    if (!modelId) continue;

    const existing = byId.get(modelId);
    if (existing) {
      const capabilities = applyDeclaredModelType(existing.capabilities as CapabilityMap, type);
      byId.set(modelId, {
        ...existing,
        capabilities: capabilities as Record<string, unknown>,
        roles: detectModelRoles(capabilities) as Record<string, unknown>,
      });
      continue;
    }

    const declared = declareCustomModel(modelId, type);
    byId.set(modelId, toModelSnapshot(declared));
  }

  return [...byId.values()];
}

async function replaceProviderModels(
  providerConfigId: string,
  models: Awaited<ReturnType<typeof discoverProviderModels>>["models"],
  defaults: ProviderDefaultAssignments,
) {
  const normalizedDefaults: ProviderDefaultAssignments = {
    analysisModelId: defaults.analysisModelId?.trim() || null,
    planningModelId: defaults.planningModelId?.trim() || null,
    heroImageModelId: defaults.heroImageModelId?.trim() || null,
    detailImageModelId: defaults.detailImageModelId?.trim() || null,
    imageEditModelId: defaults.imageEditModelId?.trim() || null,
  };
  const existing = await prisma.modelProfile.findMany({
    where: { providerConfigId },
  });
  const incomingIds = new Set(models.map((model) => model.modelId));
  const assignedIds = assignedModelIds(normalizedDefaults);
  const existingCustom = existing
    .filter((model) => isCustomSourcedModel(model.capabilities) && !incomingIds.has(model.modelId) && assignedIds.has(model.modelId))
    .map((model) => toModelSnapshot(model));
  const merged = mergeAssignedModels(models, normalizedDefaults, existingCustom);

  await prisma.modelProfile.deleteMany({
    where: { providerConfigId },
  });

  await prisma.modelProfile.createMany({
    data: merged.map((model) => ({
      providerConfigId,
      modelId: model.modelId,
      label: model.label,
      capabilities: model.capabilities as CapabilityMap,
      roles: model.roles as ModelRoleMap,
      quality: model.quality ?? null,
      latency: model.latency ?? null,
      cost: model.cost ?? null,
      isAvailable: model.isAvailable,
      isDefaultAnalysis: normalizedDefaults.analysisModelId === model.modelId,
      isDefaultPlanning: normalizedDefaults.planningModelId === model.modelId,
      isDefaultHeroImage: normalizedDefaults.heroImageModelId === model.modelId,
      isDefaultDetailImage: normalizedDefaults.detailImageModelId === model.modelId,
      isDefaultImageEdit: normalizedDefaults.imageEditModelId === model.modelId,
    })),
  });
}

export async function testProviderConnection(input: ProviderConnectionInput) {
  const adapter = new OpenAICompatibleAdapter(resolveEffectiveBaseUrl(input.baseUrl), input.apiKey);
  return adapter.testConnection();
}

export async function resolveProviderConnectionInput(
  input: Omit<ProviderConnectionInput, "apiKey"> & { apiKey?: string | null; id?: string | null },
): Promise<ProviderConnectionInput> {
  const runtimeCredentials = getRequestProviderCredentials();
  const apiKey = input.apiKey?.trim() || runtimeCredentials.apiKey?.trim() || "";
  const baseUrl = resolveEffectiveBaseUrl(input.baseUrl || runtimeCredentials.baseUrl);

  if (!apiKey) {
    throw new Error("API Key is not configured in this browser. Configure it in Provider settings first.");
  }

  if (!baseUrl) {
    throw new Error("Provider baseURL is not configured. Set it in the UI or LOCK_BASE_URL.");
  }

  return {
    name: input.name,
    baseUrl,
    apiKey,
  };
}

export async function discoverProviderModels(input: ProviderConnectionInput) {
  const baseUrl = resolveEffectiveBaseUrl(input.baseUrl);
  const adapter = new OpenAICompatibleAdapter(baseUrl, input.apiKey);
  const models = await adapter.listModels();
  const normalized = enrichModelEndpointSupport(normalizeDetectedModels(mergeDiscoveredModels(baseUrl, models)));
  return {
    models: normalized,
    recommendations: recommendDefaultModels(normalized),
  };
}

export async function saveProviderConfig(
  input: ProviderConnectionInput & {
    id?: string | null;
    isActive?: boolean;
    discoveredModels?: ProviderModelSnapshot[];
    defaultAssignments?: {
      analysisModelId?: string | null;
      planningModelId?: string | null;
      heroImageModelId?: string | null;
      detailImageModelId?: string | null;
      imageEditModelId?: string | null;
    };
  },
  userId: string,
) {
  const baseUrl = resolveEffectiveBaseUrl(input.baseUrl);
  const discoveredModels = input.discoveredModels?.length
    ? enrichModelEndpointSupport(input.discoveredModels)
    : (await discoverProviderModels({ ...input, baseUrl })).models;
  const discovered = {
    models: discoveredModels,
    recommendations: recommendDefaultModels(discoveredModels),
  };
  const nextIsActive = input.isActive ?? true;

  if (input.id) {
    const existing = await prisma.providerConfig.findFirst({
      where: { id: input.id, userId },
      select: { id: true },
    });
    if (!existing) {
      throw new Error("未找到要更新的服务配置。");
    }
  }

  if (nextIsActive) {
    await prisma.providerConfig.updateMany({
      where: { userId },
      data: { isActive: false },
    });
  }

  const provider = input.id
    ? await prisma.providerConfig.update({
        where: { id: input.id },
        data: {
          name: input.name,
          baseUrl,
          apiKeyEncrypted: encryptSecret(""),
          isActive: nextIsActive,
        },
      })
    : await prisma.providerConfig.create({
        data: {
          name: input.name,
          baseUrl,
          apiKeyEncrypted: encryptSecret(""),
          isActive: nextIsActive,
          userId,
        },
      });

  const defaults = {
    ...discovered.recommendations,
    ...(input.defaultAssignments ?? {}),
  };

  await replaceProviderModels(provider.id, discovered.models, defaults);
  return provider.id;
}

export async function getAllProviderConfigs(userId: string) {
  const providers = await prisma.providerConfig.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      models: {
        orderBy: { modelId: "asc" },
      },
    },
  });

  return providers.map((provider) => {
    const effectiveBaseUrl = resolveEffectiveBaseUrl(provider.baseUrl);
    return {
      ...provider,
      baseUrl: effectiveBaseUrl,
      apiKey: "",
      maskedApiKey: "",
      models: mergeHydratedProviderModels(
        provider.id,
        effectiveBaseUrl,
        hydrateProviderModels(provider.models) as RuntimeProviderModel[],
      ),
    };
  });
}

export async function getActiveProviderConfig(userId?: string) {
  const ownerId = userId ?? getRequestUserId();
  if (!ownerId) {
    return null;
  }
  const provider = await prisma.providerConfig.findFirst({
    where: { isActive: true, userId: ownerId },
    include: {
      models: {
        orderBy: { modelId: "asc" },
      },
    },
  });

  if (!provider) return null;

  const effectiveBaseUrl = resolveEffectiveBaseUrl(provider.baseUrl);
  return {
    ...provider,
    baseUrl: effectiveBaseUrl,
    apiKey: "",
    maskedApiKey: "",
    models: mergeHydratedProviderModels(
      provider.id,
      effectiveBaseUrl,
      hydrateProviderModels(provider.models) as RuntimeProviderModel[],
    ),
  };
}

export async function activateProviderConfig(providerId: string, userId: string) {
  const provider = await prisma.providerConfig.findFirst({
    where: { id: providerId, userId },
  });

  if (!provider) {
    throw new Error("未找到要切换的历史服务配置。");
  }

  await prisma.$transaction([
    prisma.providerConfig.updateMany({
      where: { userId },
      data: { isActive: false },
    }),
    prisma.providerConfig.update({
      where: { id: providerId },
      data: { isActive: true },
    }),
  ]);

  return getAllProviderConfigs(userId);
}

export async function getProviderAdapter(providerId?: string): Promise<ProviderAdapterContext> {
  const userId = getRequestUserId();
  if (!userId) {
    throw new Error("No active provider config found.");
  }
  const provider =
    (providerId
      ? await prisma.providerConfig.findFirst({
          where: { id: providerId, userId },
          include: { models: true },
        })
      : await prisma.providerConfig.findFirst({
          where: { isActive: true, userId },
          include: { models: true },
        })) ?? null;

  if (!provider) {
    throw new Error("No active provider config found.");
  }

  const runtimeCredentials = getRequestProviderCredentials();
  const apiKey = runtimeCredentials.apiKey?.trim() ?? "";
  if (!apiKey) {
    throw new Error("API Key is not configured in this browser. Configure it in Provider settings first.");
  }
  const baseUrl = resolveEffectiveBaseUrl(runtimeCredentials.baseUrl ?? provider.baseUrl);
  const runtimeModels = hydrateProviderModels(provider.models) as unknown as RuntimeProviderModel[];
  const defaultTimeoutMs = await getModelTimeoutMs();

  return {
    provider: {
      ...provider,
      baseUrl,
      models: runtimeModels,
    },
    apiKey,
    adapter: new OpenAICompatibleAdapter(baseUrl, apiKey, defaultTimeoutMs),
  };
}
