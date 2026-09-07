/**
 * [INPUT]: 依赖 Prisma Project(kind=PRODUCT_SWAP)、adapter.editImage、product-swap prompt、用户/凭证 ALS
 * [OUTPUT]: 对外提供 enqueueProductSwapGenerate、enqueueProductSwapRegenerate、runProductSwapGenerateTask、list/get 视图
 * [POS]: lib/services 的实拍换品内核。场景图走 editImage.image，本品图走 referenceImages；不经 generateSectionImage / Visual Prompt Agent / SVG
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Prisma } from "@prisma/client";

import type { ImageGenerationResult } from "@/lib/ai/provider-client";
import { buildProductSwapPrompt, buildProductSwapRegeneratePrompt } from "@/lib/ai/prompts/product-swap";
import { withUser } from "@/lib/auth/request-user";
import { prisma } from "@/lib/db/prisma";
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
} from "@/lib/services/task-service";
import { assetPublicUrl, readStorageFile, saveGeneratedImage, saveUploadAsset } from "@/lib/storage/asset-manager";
import { stripDataUrlPrefix } from "@/lib/utils/base64-upload";
import type { ProductSwapGenerateInput } from "@/lib/validations/product-swap";
import type {
  ProductSwapProjectSummary,
  ProductSwapView,
  StudioAspectRatio,
  UserProfile,
} from "@/types/domain";

type ProviderContext = Awaited<ReturnType<typeof getProviderAdapter>>["provider"];

function runAuthedBackground(user: UserProfile, credentials: RequestProviderCredentials, handler: () => Promise<void>) {
  runTaskInBackground(async () => {
    await withUser(user, () => runWithProviderCredentials(credentials, handler));
  });
}

function unique(values: Array<string | null | undefined>) {
  return values.filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index);
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

function getImageEditModels(provider: ProviderContext) {
  return unique([
    provider.models.find((item) => item.isDefaultImageEdit)?.modelId,
    provider.models.find((item) => Boolean((item.capabilities as Record<string, boolean>).image_edit))?.modelId,
    provider.models.find((item) => item.isDefaultHeroImage)?.modelId,
  ]);
}

function getOutputSize(aspectRatio: StudioAspectRatio) {
  return aspectRatio === "1:1" ? "1024x1024" : "1024x1536";
}

function readSnapshot(snapshot: unknown) {
  return (snapshot as Record<string, unknown> | null) ?? {};
}

function readProductSwapMeta(snapshot: unknown): { aspectRatio: StudioAspectRatio; notes: string } {
  const data = readSnapshot(snapshot);
  const productSwap = (data.productSwap as Record<string, unknown> | null) ?? {};
  const aspectRatio = productSwap.aspectRatio;
  return {
    aspectRatio: aspectRatio === "1:1" || aspectRatio === "3:4" || aspectRatio === "9:16" ? aspectRatio : "3:4",
    notes: typeof productSwap.notes === "string" ? productSwap.notes : "",
  };
}

function toSwapEditArgs(sceneDataUrl: string, productDataUrl: string) {
  return {
    image: sceneDataUrl,
    referenceImages: [productDataUrl],
  };
}

async function assetToDataUrl(asset: { filePath: string; mimeType: string | null }) {
  const buffer = await readStorageFile(asset.filePath);
  const mimeType = asset.mimeType ?? "image/png";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function persistImageSource(result: ImageGenerationResult) {
  return {
    b64Json: result.b64Json,
    url: result.url,
  };
}

async function runImageModel<T>(models: string[], runner: (model: string) => Promise<T>, emptyMessage: string) {
  const errors: string[] = [];

  for (const model of models) {
    try {
      return { model, result: await runner(model) };
    } catch (error) {
      errors.push(`${model}: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }

  throw new Error(models.length === 0 ? emptyMessage : errors.join(" | "));
}

function toImageView(asset: { id: string; filePath: string; fileName: string } | null | undefined) {
  if (!asset) return null;
  return {
    id: asset.id,
    url: assetPublicUrl(asset) ?? "",
    fileName: asset.fileName,
  };
}

async function assertNoInflightSwap(projectId: string) {
  const inflight = await prisma.generationTask.findFirst({
    where: {
      projectId,
      taskType: "PRODUCT_SWAP_GENERATE",
      status: { in: ["PENDING", "RUNNING"] },
    },
  });
  if (inflight) {
    throw new Error("上一轮还在出图，请稍后再试。");
  }
}

async function enqueueSwapTask(
  projectId: string,
  user: UserProfile,
  credentials: RequestProviderCredentials,
  regenerate: boolean,
) {
  await assertNoInflightSwap(projectId);

  const task = await createTask({
    projectId,
    taskType: "PRODUCT_SWAP_GENERATE",
    status: "PENDING",
    inputPayload: { projectId, regenerate },
    outputPayload: {
      currentStep: "queued",
      totalItems: 1,
      completedItems: 0,
      failedItems: 0,
    },
  });

  runAuthedBackground(user, credentials, () => runProductSwapGenerateTask(task.id));
  return {
    taskId: task.id,
    projectId,
    task: await getTask(task.id),
  };
}

export async function enqueueProductSwapGenerate(
  input: ProductSwapGenerateInput,
  user: UserProfile,
  credentials: RequestProviderCredentials,
) {
  const notes = input.notes?.trim() ?? "";
  const project = await prisma.project.create({
    data: {
      name: `实拍换品-${nowStamp()}`,
      platform: "general_ecommerce",
      style: "generic_clean",
      kind: "PRODUCT_SWAP",
      description: notes || null,
      userId: user.id,
      modelSnapshot: {
        kind: "product_swap",
        generationSettings: {
          uniformAspectRatio: true,
          allowSvgFallback: false,
          preserveHeroTypographyFromReference: false,
        },
        productSwap: {
          aspectRatio: input.aspectRatio,
          notes,
        },
      },
    },
  });

  await saveUploadAsset({
    projectId: project.id,
    type: "REFERENCE",
    fileName: input.sceneImage.fileName,
    mimeType: input.sceneImage.mimeType ?? "image/png",
    fileBuffer: Buffer.from(stripDataUrlPrefix(input.sceneImage.base64Data), "base64"),
    sortOrder: 0,
    isMain: false,
  });

  await saveUploadAsset({
    projectId: project.id,
    type: "MAIN",
    fileName: input.productImage.fileName,
    mimeType: input.productImage.mimeType ?? "image/png",
    fileBuffer: Buffer.from(stripDataUrlPrefix(input.productImage.base64Data), "base64"),
    sortOrder: 1,
    isMain: true,
  });

  return enqueueSwapTask(project.id, user, credentials, false);
}

export async function enqueueProductSwapRegenerate(
  projectId: string,
  user: UserProfile,
  credentials: RequestProviderCredentials,
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id, kind: "PRODUCT_SWAP" },
    select: { id: true },
  });
  if (!project) {
    throw new Error("Project not found.");
  }

  return enqueueSwapTask(project.id, user, credentials, true);
}

export async function listProductSwapProjects(userId: string): Promise<ProductSwapProjectSummary[]> {
  const projects = await prisma.project.findMany({
    where: { userId, kind: "PRODUCT_SWAP" },
    orderBy: { updatedAt: "desc" },
    take: 30,
    include: {
      assets: { orderBy: { createdAt: "desc" } },
      tasks: {
        where: { taskType: "PRODUCT_SWAP_GENERATE" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return projects.map((project) => {
    const cover =
      project.assets.find((asset) => asset.type === "GENERATED") ??
      project.assets.find((asset) => asset.type === "REFERENCE") ??
      project.assets[0] ??
      null;
    return {
      id: project.id,
      name: project.name,
      updatedAt: project.updatedAt.toISOString(),
      coverImageUrl: assetPublicUrl(cover),
      status: project.status,
      latestTaskId: project.tasks[0]?.id ?? null,
      latestTaskStatus: project.tasks[0]?.status ?? null,
    };
  });
}

export async function getProductSwapView(projectId: string, userId: string): Promise<ProductSwapView | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, kind: "PRODUCT_SWAP" },
    include: {
      assets: { orderBy: { createdAt: "asc" } },
      tasks: {
        where: { taskType: "PRODUCT_SWAP_GENERATE" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!project) return null;

  const meta = readProductSwapMeta(project.modelSnapshot);
  const latestTask = project.tasks[0] ?? null;
  const scene = project.assets.find((asset) => asset.type === "REFERENCE") ?? null;
  const product = project.assets.find((asset) => asset.type === "MAIN") ?? project.assets.find((asset) => asset.isMain) ?? null;
  const generated = [...project.assets].reverse().find((asset) => asset.type === "GENERATED") ?? null;

  return {
    id: project.id,
    name: project.name,
    status: project.status,
    aspectRatio: meta.aspectRatio,
    notes: meta.notes,
    sceneImage: toImageView(scene),
    productImage: toImageView(product),
    resultImageUrl: assetPublicUrl(generated),
    latestTaskId: latestTask?.id ?? null,
    latestTaskStatus: latestTask?.status ?? null,
    errorMessage: latestTask?.status === "FAILED" ? latestTask.errorMessage : null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export async function runProductSwapGenerateTask(taskId: string) {
  const task = await getTask(taskId);
  if (!task) {
    throw new Error("Task not found.");
  }

  const input = (task.inputPayload ?? {}) as Record<string, unknown>;
  const regenerate = input.regenerate === true;
  const projectId = task.projectId;

  await startTask(taskId, { currentStep: "editing", totalItems: 1, completedItems: 0, failedItems: 0 });

  try {
    await assertTaskNotCanceled(taskId);
    const project = await prisma.project.findFirst({
      where: { id: projectId, kind: "PRODUCT_SWAP" },
      include: { assets: { orderBy: { sortOrder: "asc" } } },
    });
    if (!project) {
      throw new Error("Project not found.");
    }

    const scene = project.assets.find((asset) => asset.type === "REFERENCE");
    const product = project.assets.find((asset) => asset.type === "MAIN") ?? project.assets.find((asset) => asset.isMain);
    if (!scene || !product) {
      throw new Error("缺少场景实拍或本品图。");
    }

    const meta = readProductSwapMeta(project.modelSnapshot);
    const prompt = regenerate ? buildProductSwapRegeneratePrompt(meta.notes) : buildProductSwapPrompt(meta.notes);
    const sceneDataUrl = await assetToDataUrl(scene);
    const productDataUrl = await assetToDataUrl(product);
    const editArgs = toSwapEditArgs(sceneDataUrl, productDataUrl);

    const { provider, adapter } = await getProviderAdapter();
    const models = getImageEditModels(provider);
    const generated = await runImageModel(
      models,
      (model) =>
        adapter.editImage({
          model,
          prompt,
          image: editArgs.image,
          referenceImages: editArgs.referenceImages,
          size: getOutputSize(meta.aspectRatio),
          aspectRatio: meta.aspectRatio,
          monitor: { projectId, operation: "product_swap" },
        }),
      "当前没有可用的图像编辑模型。实拍换品需要 gpt-image / nano-banana 一类改图模型。",
    );

    const saved = await saveGeneratedImage({
      projectId,
      prompt,
      source: persistImageSource(generated.result),
      metadata: {
        usedModel: generated.model,
        sourceReferenceAssetIds: [scene.id, product.id],
        editMode: "product_swap",
      },
    });

    const snapshot = readSnapshot(project.modelSnapshot);
    const productSwap = {
      ...((snapshot.productSwap as Record<string, unknown> | null) ?? {}),
      modelId: generated.model,
    };

    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: "EDITING",
        modelSnapshot: {
          ...snapshot,
          productSwap,
        } as Prisma.InputJsonValue,
      },
    });

    await completeTask(taskId, {
      currentStep: "finished",
      totalItems: 1,
      completedItems: 1,
      failedItems: 0,
      imageUrl: assetPublicUrl(saved),
      assetId: saved.id,
      modelId: generated.model,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Task canceled.") return;
    await failTask(taskId, error instanceof Error ? error.message : "换品生成失败", {
      currentStep: "failed",
      totalItems: 1,
      completedItems: 0,
      failedItems: 1,
    });
  }
}
