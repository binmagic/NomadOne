/**
 * [INPUT]: 依赖 Prisma Project(kind=LISTING_SET)、generateSectionImage、ProviderAdapter、套图 prompt/schema
 * [OUTPUT]: 对外提供 enqueueListingSetGenerate、runListingSetGenerateTask、assistListingSetCopy、list/get 视图
 * [POS]: lib/services 的 Listing 套图内核。复用 PageSection 出图，不另起生图通道；任务挂在套图项目上
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Prisma, type PageSection } from "@prisma/client";

import {
  buildFallbackSlotPrompt,
  buildListingSetCopyAssistPrompt,
  buildListingSetPlanPrompt,
  buildListingSetViralAssistPrompt,
  listingSetVisualTemplates,
} from "@/lib/ai/prompts/listing-set";
import {
  listingSetCopyAssistOutputSchema,
  listingSetPlanSchema,
  listingSetViralStyleSchema,
  type ListingSetPlan,
} from "@/lib/ai/schemas/listing-set";
import { withUser } from "@/lib/auth/request-user";
import { prisma } from "@/lib/db/prisma";
import { generateSectionImage } from "@/lib/services/generation-service";
import { getProviderAdapter } from "@/lib/services/provider-service";
import { runWithProviderCredentials, type RequestProviderCredentials } from "@/lib/services/provider-runtime";
import {
  assertTaskNotCanceled,
  completeTask,
  createTask,
  failTask,
  getTask,
  runTaskInBackground,
  startTask,
  updateTaskProgress,
} from "@/lib/services/task-service";
import { assetPublicUrl, readStorageFile, saveUploadAsset } from "@/lib/storage/asset-manager";
import { stripDataUrlPrefix } from "@/lib/utils/base64-upload";
import { normalizeContentLanguage } from "@/lib/utils/content-language";
import type { ListingSetGenerateInput, ListingSetCopyAssistInput, ListingSetViralAssistInput } from "@/lib/validations/listing-set";
import {
  defaultListingSetGroupCounts,
  defaultListingSetSlotKeys,
  expandListingSetGroupCounts,
  listingSetSlotCatalog,
  listingSetSlotKeys,
  type ListingSetCopy,
  type ListingSetMarket,
  type ListingSetProjectSummary,
  type ListingSetSlotKey,
  type ListingSetSlotView,
  type ListingSetView,
  type ListingSetViralStyle,
  type PlatformOption,
  type StudioAspectRatio,
  type UserProfile,
} from "@/types/domain";

const sectionTypeMap: Record<string, PageSection["type"]> = {
  hero: "HERO",
  selling_points: "SELLING_POINTS",
  scenario: "SCENARIO",
  detail_closeup: "DETAIL_CLOSEUP",
  specs: "SPECS",
  material: "MATERIAL",
  comparison: "COMPARISON",
  gift_scene: "GIFT_SCENE",
  brand_trust: "BRAND_TRUST",
  summary: "SUMMARY",
  custom: "CUSTOM",
};

type SlotProgress = {
  key: string;
  slotKey: ListingSetSlotKey;
  title: string;
  state: "pending" | "running" | "done" | "failed";
  message: string;
  sectionId?: string | null;
  imageUrl?: string | null;
};

function runAuthedBackground(user: UserProfile, credentials: RequestProviderCredentials, handler: () => Promise<void>) {
  runTaskInBackground(async () => {
    await withUser(user, () => runWithProviderCredentials(credentials, handler));
  });
}

function isListingSlotKey(value: string): value is ListingSetSlotKey {
  return (listingSetSlotKeys as readonly string[]).includes(value);
}

function expandSlotKeys(
  counts: Partial<Record<"white" | "scene" | "selling" | "other", number>> | undefined,
  mode: "smart" | "custom",
) {
  if (mode !== "custom") {
    return [...defaultListingSetSlotKeys];
  }
  const keys = expandListingSetGroupCounts({ ...defaultListingSetGroupCounts, ...counts });
  return keys.length ? keys : [...defaultListingSetSlotKeys];
}

function nowStamp() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
  ].join("");
}

function hasCapability(model: { capabilities: unknown }, key: string) {
  const capabilities = (model.capabilities ?? {}) as Record<string, boolean>;
  return Boolean(capabilities[key]);
}

function pickTextVisionModel(provider: Awaited<ReturnType<typeof getProviderAdapter>>["provider"]) {
  const vision = provider.models.filter((item) => hasCapability(item, "text") && hasCapability(item, "vision"));
  const text = provider.models.filter((item) => hasCapability(item, "text"));
  return (
    vision.find((item) => item.isDefaultAnalysis)?.modelId ??
    vision.find((item) => /gemini|gpt-4o|gpt-5|claude/i.test(item.modelId))?.modelId ??
    vision[0]?.modelId ??
    text.find((item) => item.isDefaultPlanning)?.modelId ??
    text[0]?.modelId ??
    null
  );
}

async function assetToDataUrl(asset: { filePath: string; mimeType: string | null }) {
  const buffer = await readStorageFile(asset.filePath);
  const mimeType = asset.mimeType ?? "image/png";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function readSnapshot(snapshot: unknown) {
  return (snapshot as Record<string, unknown> | null) ?? {};
}

function readListingSetMeta(snapshot: unknown) {
  const data = readSnapshot(snapshot);
  const listingSet = (data.listingSet as Record<string, unknown> | null) ?? {};
  const preview = (data.previewConfig as Record<string, unknown> | null) ?? {};
  const listingCopy = (data.listingCopy as ListingSetCopy | null) ?? null;
  const slotKeys = Array.isArray(listingSet.slotKeys)
    ? listingSet.slotKeys.filter((item): item is ListingSetSlotKey => typeof item === "string" && isListingSlotKey(item))
    : [...defaultListingSetSlotKeys];

  return {
    market: (listingSet.market === "sea" || listingSet.market === "west" ? listingSet.market : "cn") as ListingSetMarket,
    structureMode: listingSet.structureMode === "custom" ? ("custom" as const) : ("smart" as const),
    sellingPoints: typeof listingSet.sellingPoints === "string" ? listingSet.sellingPoints : "",
    generateListingCopy: listingSet.generateListingCopy !== false,
    analyzeViralStyle: listingSet.analyzeViralStyle === true,
    slotKeys,
    aspectRatio: preview.imageAspectRatio === "3:4" || preview.imageAspectRatio === "9:16" ? preview.imageAspectRatio : "1:1",
    contentLanguage: normalizeContentLanguage(preview.contentLanguage),
    listingCopy: listingSet.generateListingCopy === false ? null : listingCopy,
    viralStyle: (data.viralStyle as ListingSetViralStyle | null) ?? null,
  };
}

function fallbackPlan(productName: string, slotKeys: ListingSetSlotKey[], sellingPoints: string): ListingSetPlan {
  const name = productName.trim() || "商品";
  return {
    productName: name,
    slots: slotKeys.map((slotKey) => {
      const catalog = listingSetSlotCatalog[slotKey];
      return {
        slotKey,
        title: catalog.label,
        goal: catalog.hint,
        copy: sellingPoints.trim() || catalog.hint,
        visualPrompt: buildFallbackSlotPrompt(slotKey, name, sellingPoints),
      };
    }),
    listingCopy: {
      productName: name,
      listingTitle: name,
      sellingPoints: sellingPoints
        .split(/\n+/)
        .map((line) => line.replace(/^\d+[\.、]\s*/, "").trim())
        .filter(Boolean)
        .slice(0, 5)
        .concat(sellingPoints.trim() ? [] : ["按实物拍摄，细节清晰", "材质与结构忠实还原", "适合日常使用场景"]),
      description: sellingPoints.trim() || `${name}商品套图，含白底主图、场景、细节与卖点说明。`,
      keywords: [name],
    },
    viralStyle: null,
  };
}

async function planListingSet(projectId: string): Promise<ListingSetPlan> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { assets: { orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }] } },
  });
  if (!project) {
    throw new Error("Project not found.");
  }

  const meta = readListingSetMeta(project.modelSnapshot);
  const { provider, adapter } = await getProviderAdapter();
  const model = pickTextVisionModel(provider);
  const images = await Promise.all(project.assets.slice(0, 4).map((asset) => assetToDataUrl(asset)));

  if (!model) {
    return fallbackPlan(project.name.replace(/套图$/, ""), meta.slotKeys, meta.sellingPoints);
  }

  try {
    const planned = await adapter.generateStructured({
      model,
      systemPrompt: "Return one strict JSON object only. No markdown.",
      userPrompt: buildListingSetPlanPrompt({
        platform: project.platform as PlatformOption,
        market: meta.market,
        contentLanguage: meta.contentLanguage,
        sellingPoints: meta.sellingPoints,
        structureMode: meta.structureMode,
        slotKeys: meta.slotKeys,
        analyzeViralStyle: meta.analyzeViralStyle,
        generateListingCopy: meta.generateListingCopy,
      }),
      schema: listingSetPlanSchema,
      images,
      monitor: { projectId, operation: "listing_set_plan" },
    });

    const slots =
      meta.structureMode === "custom"
        ? meta.slotKeys.map((slotKey, index) => {
            const match = planned.parsed.slots.find((item, itemIndex) => item.slotKey === slotKey && itemIndex >= index) ?? planned.parsed.slots.find((item) => item.slotKey === slotKey);
            return {
              slotKey,
              title: match?.title ?? listingSetSlotCatalog[slotKey].label,
              goal: match?.goal ?? listingSetSlotCatalog[slotKey].hint,
              copy: match?.copy ?? meta.sellingPoints ?? listingSetSlotCatalog[slotKey].hint,
              visualPrompt: match?.visualPrompt ?? `${listingSetVisualTemplates[slotKey]} ${meta.sellingPoints}`.trim(),
            };
          })
        : planned.parsed.slots.filter((item) => isListingSlotKey(item.slotKey)).slice(0, 10);

    const normalizedSlots = (slots.length >= 7 ? slots : fallbackPlan(planned.parsed.productName, meta.slotKeys, meta.sellingPoints).slots).map((item) => ({
      ...item,
      slotKey: isListingSlotKey(item.slotKey) ? item.slotKey : "scene",
    }));
    const viralStyle = meta.analyzeViralStyle ? planned.parsed.viralStyle ?? null : null;
    const tropes = viralStyle?.visualTropes?.length
      ? ` Viral listing tropes: ${viralStyle.visualTropes.join("; ")}. Color mood: ${viralStyle.colorMood}. Avoid: ${(viralStyle.avoid ?? []).join(", ") || "fake rankings and competitor brands"}.`
      : "";

    return {
      productName: planned.parsed.productName,
      slots: tropes
        ? normalizedSlots.map((slot) => ({
            ...slot,
            visualPrompt: `${slot.visualPrompt}${tropes}`.trim(),
          }))
        : normalizedSlots,
      listingCopy: planned.parsed.listingCopy,
      viralStyle,
    };
  } catch {
    return fallbackPlan(project.name.replace(/套图$/, ""), meta.slotKeys, meta.sellingPoints);
  }
}

async function persistPlan(projectId: string, plan: ListingSetPlan) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { sections: true },
  });
  if (!project) {
    throw new Error("Project not found.");
  }

  if (project.sections.length === 0) {
    await prisma.$transaction(
      plan.slots.map((slot, index) => {
        const catalog = listingSetSlotCatalog[slot.slotKey];
        const occurrence = plan.slots.slice(0, index + 1).filter((item) => item.slotKey === slot.slotKey).length;
        return prisma.pageSection.create({
          data: {
            projectId,
            sectionKey: `${slot.slotKey}_${String(occurrence).padStart(2, "0")}`,
            type: sectionTypeMap[catalog.sectionType] ?? "CUSTOM",
            title: slot.title,
            goal: slot.goal,
            copy: slot.copy,
            visualPrompt: slot.visualPrompt,
            order: index,
            status: "QUEUED",
            editableData: {
              slotKey: slot.slotKey,
              noTextInImage: catalog.noTextInImage,
              listingSet: true,
            },
          },
        });
      }),
    );
  }

  const snapshot = readSnapshot(project.modelSnapshot);
  await prisma.project.update({
    where: { id: projectId },
    data: {
      name: `${plan.productName}套图`.slice(0, 40),
      status: "PLANNED",
      modelSnapshot: {
        ...snapshot,
        listingCopy: ((snapshot.listingSet as Record<string, unknown> | null) ?? {}).generateListingCopy === false ? null : plan.listingCopy,
        viralStyle: plan.viralStyle ?? null,
        listingSet: {
          ...((snapshot.listingSet as Record<string, unknown> | null) ?? {}),
          slotKeys: plan.slots.map((slot) => slot.slotKey),
        },
      } as Prisma.InputJsonValue,
    },
  });
}

function toSlotView(section: {
  id: string;
  sectionKey: string;
  title: string;
  goal: string;
  status: string;
  order: number;
  editableData: unknown;
  imageUrl?: string | null;
}): ListingSetSlotView {
  const data = (section.editableData as Record<string, unknown> | null) ?? {};
  const slotKey = typeof data.slotKey === "string" && isListingSlotKey(data.slotKey) ? data.slotKey : "scene";
  const statusMap: Record<string, ListingSetSlotView["status"]> = {
    IDLE: "idle",
    QUEUED: "queued",
    GENERATING: "generating",
    SUCCESS: "success",
    FAILED: "failed",
  };

  return {
    key: section.sectionKey,
    slotKey,
    sectionId: section.id,
    order: section.order,
    label: listingSetSlotCatalog[slotKey].label,
    title: section.title,
    goal: section.goal,
    status: statusMap[section.status] ?? "idle",
    imageUrl: section.imageUrl ?? null,
    errorMessage: null,
  };
}

export async function getListingSetView(projectId: string, userId: string): Promise<ListingSetView | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, kind: "LISTING_SET" },
    include: {
      assets: { orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }] },
      sections: {
        orderBy: { order: "asc" },
        include: { currentImageAsset: true },
      },
      tasks: {
        where: { taskType: "LISTING_SET_GENERATE" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!project) return null;

  const meta = readListingSetMeta(project.modelSnapshot);
  const latestTask = project.tasks[0] ?? null;

  return {
    id: project.id,
    name: project.name,
    platform: project.platform,
    status: project.status,
    aspectRatio: meta.aspectRatio as StudioAspectRatio,
    contentLanguage: meta.contentLanguage,
    market: meta.market,
    sellingPoints: meta.sellingPoints,
    listingCopy: meta.generateListingCopy ? meta.listingCopy : null,
    viralStyle: meta.viralStyle,
    sourceImages: project.assets.map((asset) => ({
      id: asset.id,
      url: assetPublicUrl(asset) ?? "",
      fileName: asset.fileName,
    })),
    slots: project.sections.map((section) =>
      toSlotView({
        ...section,
        imageUrl: assetPublicUrl(section.currentImageAsset),
      }),
    ),
    latestTaskId: latestTask?.id ?? null,
    latestTaskStatus: latestTask?.status ?? null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export async function listListingSetProjects(userId: string): Promise<ListingSetProjectSummary[]> {
  const projects = await prisma.project.findMany({
    where: { userId, kind: "LISTING_SET" },
    orderBy: { updatedAt: "desc" },
    take: 30,
    include: {
      assets: { orderBy: { sortOrder: "asc" }, take: 1 },
      sections: {
        orderBy: { order: "asc" },
        include: { currentImageAsset: true },
      },
      tasks: {
        where: { taskType: "LISTING_SET_GENERATE" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return projects.map((project) => {
    const cover =
      project.sections.find((section) => section.currentImageAsset)?.currentImageAsset ?? project.assets[0] ?? null;
    return {
      id: project.id,
      name: project.name,
      platform: project.platform,
      updatedAt: project.updatedAt.toISOString(),
      coverImageUrl: assetPublicUrl(cover),
      slotCount: project.sections.length,
      status: project.status,
      latestTaskId: project.tasks[0]?.id ?? null,
      latestTaskStatus: project.tasks[0]?.status ?? null,
    };
  });
}

export async function runListingSetGenerateTask(taskId: string) {
  const task = await getTask(taskId);
  if (!task) {
    throw new Error("Task not found.");
  }

  const projectId = task.projectId;
  let items: SlotProgress[] = [];
  let successCount = 0;
  let failedCount = 0;

  await startTask(taskId, { currentStep: "planning", items: [], completedItems: 0, failedItems: 0 });

  try {
    await assertTaskNotCanceled(taskId);
    const plan = await planListingSet(projectId);
    await persistPlan(projectId, plan);
    const plannedMeta = readListingSetMeta(
      (await prisma.project.findUnique({ where: { id: projectId }, select: { modelSnapshot: true } }))?.modelSnapshot,
    );
    const listingCopy = plannedMeta.generateListingCopy ? plan.listingCopy : null;

    const sections = await prisma.pageSection.findMany({
      where: { projectId },
      orderBy: { order: "asc" },
    });

    items = sections.map((section) => {
      const data = (section.editableData as Record<string, unknown> | null) ?? {};
      const slotKey = typeof data.slotKey === "string" && isListingSlotKey(data.slotKey) ? data.slotKey : "scene";
      return {
        key: section.sectionKey,
        slotKey,
        title: section.title,
        state: "pending" as const,
        message: "等待生成",
        sectionId: section.id,
        imageUrl: null,
      };
    });

    await updateTaskProgress(taskId, {
      currentStep: "generating",
      totalItems: items.length,
      items,
      listingCopy,
      productName: plan.productName,
      viralStyle: plan.viralStyle ?? null,
    });

    for (let index = 0; index < sections.length; index += 1) {
      await assertTaskNotCanceled(taskId);
      const section = sections[index];
      items[index] = { ...items[index], state: "running", message: "正在出图" };
      await prisma.pageSection.update({ where: { id: section.id }, data: { status: "GENERATING" } });
      await updateTaskProgress(taskId, { currentStep: `slot_${index + 1}`, items });

      try {
        await generateSectionImage(projectId, section.id);
        const refreshed = await prisma.pageSection.findUnique({
          where: { id: section.id },
          include: { currentImageAsset: true },
        });
        successCount += 1;
        items[index] = {
          ...items[index],
          state: "done",
          message: "已生成",
          imageUrl: assetPublicUrl(refreshed?.currentImageAsset),
        };
      } catch (error) {
        failedCount += 1;
        items[index] = {
          ...items[index],
          state: "failed",
          message: error instanceof Error ? error.message : "生成失败",
        };
      }

      await updateTaskProgress(taskId, {
        totalItems: sections.length,
        completedItems: successCount,
        failedItems: failedCount,
        items,
      });
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { status: failedCount && !successCount ? "DRAFT" : "EDITING" },
    });

    if (!successCount) {
      await failTask(taskId, items.find((item) => item.state === "failed")?.message ?? "套图生成失败", {
        currentStep: "failed",
        items,
        completedItems: successCount,
        failedItems: failedCount,
      });
      return;
    }

    await completeTask(taskId, {
      currentStep: "finished",
      items,
      completedItems: successCount,
      failedItems: failedCount,
      listingCopy,
      viralStyle: plan.viralStyle ?? null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Task canceled.") return;
    await failTask(taskId, error instanceof Error ? error.message : "套图生成失败", {
      currentStep: "failed",
      items,
      completedItems: successCount,
      failedItems: failedCount,
    });
  }
}

export async function enqueueListingSetGenerate(
  input: ListingSetGenerateInput,
  user: UserProfile,
  credentials: RequestProviderCredentials,
) {
  const slotKeys = expandSlotKeys(input.groupCounts, input.structureMode);
  const project = await prisma.project.create({
    data: {
      name: `商品套图-${nowStamp()}`,
      platform: input.platform,
      style: "conversion_focused",
      kind: "LISTING_SET",
      description: input.sellingPoints || null,
      userId: user.id,
      modelSnapshot: {
        kind: "listing_set",
        generationSettings: {
          uniformAspectRatio: true,
          allowSvgFallback: false,
        },
        previewConfig: {
          heroImageCount: 5,
          detailSectionCount: 10,
          imageAspectRatio: input.aspectRatio,
          contentLanguage: input.contentLanguage,
        },
        listingSet: {
          market: input.market,
          structureMode: input.structureMode,
          slotKeys,
          sellingPoints: input.sellingPoints,
          generateListingCopy: input.generateListingCopy,
          analyzeViralStyle: input.analyzeViralStyle,
        },
      },
    },
  });

  await Promise.all(
    input.images.map((image, index) =>
      saveUploadAsset({
        projectId: project.id,
        type: index === 0 ? "MAIN" : "ANGLE",
        fileName: image.fileName,
        mimeType: image.mimeType ?? "image/png",
        fileBuffer: Buffer.from(stripDataUrlPrefix(image.base64Data), "base64"),
        sortOrder: index,
        isMain: index === 0,
      }),
    ),
  );

  const task = await createTask({
    projectId: project.id,
    taskType: "LISTING_SET_GENERATE",
    status: "PENDING",
    inputPayload: { projectId: project.id },
    outputPayload: {
      currentStep: "queued",
      totalItems: slotKeys.length,
      completedItems: 0,
      failedItems: 0,
      items: [],
    },
  });

  runAuthedBackground(user, credentials, () => runListingSetGenerateTask(task.id));
  return {
    taskId: task.id,
    projectId: project.id,
    task: await getTask(task.id),
  };
}

export async function assistListingSetCopy(input: ListingSetCopyAssistInput) {
  const { provider, adapter } = await getProviderAdapter();
  const model = pickTextVisionModel(provider);
  if (!model) {
    throw new Error("当前 Provider 没有可用于卖点扩写的文本模型。");
  }

  const result = await adapter.generateStructured({
    model,
    systemPrompt: "Return one strict JSON object only.",
    userPrompt: buildListingSetCopyAssistPrompt({
      notes: input.notes,
      platform: input.platform,
      market: input.market,
      contentLanguage: input.contentLanguage,
    }),
    schema: listingSetCopyAssistOutputSchema,
    images: input.images.slice(0, 4),
    monitor: { operation: "listing_set_copy_assist" },
  });

  return result.parsed;
}

export async function assistListingSetViralStyle(input: ListingSetViralAssistInput) {
  const { provider, adapter } = await getProviderAdapter();
  const model = pickTextVisionModel(provider);
  if (!model) {
    throw new Error("当前 Provider 没有可用于爆款风格分析的文本模型。");
  }

  const result = await adapter.generateStructured({
    model,
    systemPrompt: "Return one strict JSON object only.",
    userPrompt: buildListingSetViralAssistPrompt({
      notes: input.notes,
      platform: input.platform,
      market: input.market,
      contentLanguage: input.contentLanguage,
    }),
    schema: listingSetViralStyleSchema,
    images: input.images.slice(0, 4),
    monitor: { operation: "listing_set_viral_assist" },
  });

  return result.parsed;
}
