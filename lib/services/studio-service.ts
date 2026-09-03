/**
 * [INPUT]: 依赖 getProviderAdapter、adapter.generateImage/editImage、studio 落盘、Prisma StudioConversation、用户/凭证 ALS
 * [OUTPUT]: 对外提供会话 CRUD 与 enqueueStudioMessage；出图在进程内后台跑完，页面只轮询
 * [POS]: lib/services 的对话生图内核。不碰 Project/Section；PENDING 消息即任务状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ImageGenerationResult } from "@/lib/ai/provider-client";
import { withUser } from "@/lib/auth/request-user";
import { prisma } from "@/lib/db/prisma";
import { getProviderAdapter } from "@/lib/services/provider-service";
import { runWithProviderCredentials, type RequestProviderCredentials } from "@/lib/services/provider-runtime";
import { runTaskInBackground } from "@/lib/services/task-service";
import { deleteStudioConversationFiles, saveStudioFile, storagePathToDataUrl } from "@/lib/storage/asset-manager";
import { relativeStorageUrl } from "@/lib/utils/files";
import type {
  StudioAspectRatio,
  StudioConversationSummary,
  StudioConversationView,
  StudioMessageView,
  UserProfile,
} from "@/types/domain";

type ProviderContext = Awaited<ReturnType<typeof getProviderAdapter>>["provider"];

const defaultTitle = "新对话";
const pendingTimeoutMs = 10 * 60 * 1000;

function runAuthedBackground(user: UserProfile, credentials: RequestProviderCredentials, handler: () => Promise<void>) {
  runTaskInBackground(async () => {
    await withUser(user, () => runWithProviderCredentials(credentials, handler));
  });
}

function unique(values: Array<string | null | undefined>) {
  return values.filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index);
}

function getImageGenerationModels(provider: ProviderContext) {
  return unique([
    provider.models.find((item) => item.isDefaultHeroImage)?.modelId,
    provider.models.find((item) => item.isDefaultDetailImage)?.modelId,
    provider.models.find((item) => Boolean((item.capabilities as Record<string, boolean>).image_gen))?.modelId,
  ]);
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

function titleFromPrompt(prompt: string) {
  const compact = prompt.replace(/\s+/g, " ").trim();
  if (!compact) return defaultTitle;
  return compact.length > 24 ? `${compact.slice(0, 24)}…` : compact;
}

function readReferencePaths(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function toMessageView(message: {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  imagePath: string | null;
  referencePaths: unknown;
  aspectRatio: string | null;
  modelId: string | null;
  errorMessage: string | null;
  createdAt: Date;
}): StudioMessageView {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    status: message.status,
    imageUrl: message.imagePath ? relativeStorageUrl(message.imagePath) : null,
    referenceUrls: readReferencePaths(message.referencePaths).map((item) => relativeStorageUrl(item)),
    aspectRatio: message.aspectRatio === "3:4" || message.aspectRatio === "9:16" || message.aspectRatio === "1:1" ? message.aspectRatio : null,
    modelId: message.modelId,
    errorMessage: message.errorMessage,
    createdAt: message.createdAt.toISOString(),
  };
}

function toSummary(conversation: {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Array<{ imagePath: string | null }>;
}): StudioConversationSummary {
  const previewPath = conversation.messages.find((item) => item.imagePath)?.imagePath ?? null;
  return {
    id: conversation.id,
    title: conversation.title,
    previewUrl: previewPath ? relativeStorageUrl(previewPath) : null,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

async function assertConversationOwned(conversationId: string, userId: string) {
  const conversation = await prisma.studioConversation.findFirst({
    where: { id: conversationId, userId },
  });
  if (!conversation) {
    throw new Error("Conversation not found.");
  }
  return conversation;
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

function persistImageSource(result: ImageGenerationResult) {
  return {
    b64Json: result.b64Json,
    url: result.url,
  };
}

function buildGeneratePrompt(prompt: string, aspectRatio: StudioAspectRatio) {
  return [
    `生成一张高质量 ${aspectRatio} 图片。严格按用户要求，不要添加用户没要的水印或乱码文字。`,
    "",
    `用户要求：${prompt}`,
  ].join("\n");
}

function buildEditPrompt(prompt: string) {
  return [`按用户要求修改当前图片，未提及的部分保持不变。`, "", `用户要求：${prompt}`].join("\n");
}

export async function listStudioConversations(userId: string): Promise<StudioConversationSummary[]> {
  const rows = await prisma.studioConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        where: { role: "ASSISTANT", status: "SUCCESS", imagePath: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { imagePath: true },
      },
    },
  });
  return rows.map(toSummary);
}

async function expireStalePending(conversationId: string) {
  const cutoff = new Date(Date.now() - pendingTimeoutMs);
  await prisma.studioMessage.updateMany({
    where: {
      conversationId,
      role: "ASSISTANT",
      status: "PENDING",
      createdAt: { lt: cutoff },
    },
    data: {
      status: "FAILED",
      content: "这一轮没有完成。",
      errorMessage: "出图超时，请重试。",
    },
  });
}

export async function getStudioConversation(conversationId: string, userId: string): Promise<StudioConversationView> {
  await expireStalePending(conversationId);
  const conversation = await prisma.studioConversation.findFirst({
    where: { id: conversationId, userId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!conversation) {
    throw new Error("Conversation not found.");
  }

  const previewPath =
    [...conversation.messages].reverse().find((item) => item.role === "ASSISTANT" && item.status === "SUCCESS" && item.imagePath)
      ?.imagePath ?? null;

  return {
    id: conversation.id,
    title: conversation.title,
    previewUrl: previewPath ? relativeStorageUrl(previewPath) : null,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    messages: conversation.messages.map(toMessageView),
  };
}

export async function createStudioConversation(userId: string, title?: string): Promise<StudioConversationView> {
  const conversation = await prisma.studioConversation.create({
    data: {
      userId,
      title: title?.trim() || defaultTitle,
    },
  });

  return {
    id: conversation.id,
    title: conversation.title,
    previewUrl: null,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    messages: [],
  };
}

export async function deleteStudioConversation(conversationId: string, userId: string) {
  await assertConversationOwned(conversationId, userId);
  await deleteStudioConversationFiles(userId, conversationId);
  await prisma.studioConversation.delete({ where: { id: conversationId } });
  return { id: conversationId };
}

async function runStudioTurn(pendingMessageId: string, userId: string, preferredModelId?: string | null) {
  const pending = await prisma.studioMessage.findFirst({
    where: { id: pendingMessageId, status: "PENDING", conversation: { userId } },
  });
  if (!pending) {
    return;
  }

  const userTurn = await prisma.studioMessage.findFirst({
    where: {
      conversationId: pending.conversationId,
      role: "USER",
      createdAt: { lte: pending.createdAt },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!userTurn) {
    await prisma.studioMessage.update({
      where: { id: pending.id },
      data: {
        status: "FAILED",
        content: "这一轮没有完成。",
        errorMessage: "找不到对应的用户消息。",
      },
    });
    return;
  }

  const attachedPaths = readReferencePaths(userTurn.referencePaths);
  const lastResult = await prisma.studioMessage.findFirst({
    where: {
      conversationId: pending.conversationId,
      role: "ASSISTANT",
      status: "SUCCESS",
      imagePath: { not: null },
      createdAt: { lt: pending.createdAt },
    },
    orderBy: { createdAt: "desc" },
  });

  let mode: "generate" | "edit" = attachedPaths.length > 0 ? (lastResult ? "edit" : "generate") : lastResult ? "edit" : "generate";
  let sourceImage: string | undefined;
  let referenceImages: string[] = [];

  if (attachedPaths.length > 0) {
    const attachedDataUrls = await Promise.all(attachedPaths.map((item) => storagePathToDataUrl(item)));
    if (mode === "edit") {
      sourceImage = attachedDataUrls[0];
      referenceImages = attachedDataUrls.slice(1);
    } else {
      referenceImages = attachedDataUrls;
    }
  } else if (lastResult?.imagePath) {
    sourceImage = await storagePathToDataUrl(lastResult.imagePath);
  }

  if (mode === "edit" && !sourceImage) {
    mode = "generate";
  }

  const aspectRatio: StudioAspectRatio =
    pending.aspectRatio === "3:4" || pending.aspectRatio === "9:16" || pending.aspectRatio === "1:1"
      ? pending.aspectRatio
      : "1:1";

  try {
    const { provider, adapter } = await getProviderAdapter();
    const preferred = preferredModelId?.trim() || "";
    const models =
      mode === "edit"
        ? unique([preferred, ...getImageEditModels(provider)])
        : unique([preferred, ...getImageGenerationModels(provider)]);

    const generated = await runImageModel(
      models,
      (model) =>
        mode === "edit"
          ? adapter.editImage({
              model,
              prompt: buildEditPrompt(userTurn.content),
              image: sourceImage ?? "",
              size: getOutputSize(aspectRatio),
              aspectRatio,
              referenceImages,
              monitor: { operation: "studio_image_edit" },
            })
          : adapter.generateImage({
              model,
              prompt: buildGeneratePrompt(userTurn.content, aspectRatio),
              size: getOutputSize(aspectRatio),
              aspectRatio,
              referenceImages,
              monitor: { operation: "studio_image_generate" },
            }),
      mode === "edit" ? "当前没有可用的图像编辑模型。" : "当前没有可用的图像生成模型。",
    );

    const saved = await saveStudioFile({
      userId,
      conversationId: pending.conversationId,
      source: persistImageSource(generated.result),
    });

    await prisma.studioMessage.update({
      where: { id: pending.id },
      data: {
        content: mode === "edit" ? "已按你的要求改好。" : "已生成。",
        status: "SUCCESS",
        imagePath: saved.relativePath,
        modelId: generated.model,
      },
    });
  } catch (error) {
    await prisma.studioMessage.update({
      where: { id: pending.id },
      data: {
        status: "FAILED",
        content: "这一轮没有完成。",
        errorMessage: error instanceof Error ? error.message : "未知错误",
      },
    });
  }

  await prisma.studioConversation.update({
    where: { id: pending.conversationId },
    data: { updatedAt: new Date() },
  });
}

export async function enqueueStudioMessage(
  conversationId: string,
  user: UserProfile,
  input: {
    prompt: string;
    images?: string[];
    aspectRatio?: StudioAspectRatio;
    modelId?: string | null;
  },
  credentials: RequestProviderCredentials,
): Promise<StudioConversationView> {
  const conversation = await assertConversationOwned(conversationId, user.id);
  await expireStalePending(conversationId);

  const inflight = await prisma.studioMessage.findFirst({
    where: { conversationId, role: "ASSISTANT", status: "PENDING" },
  });
  if (inflight) {
    throw new Error("上一轮还在出图，请稍后再发送。");
  }

  const prompt = input.prompt.trim();
  const aspectRatio = input.aspectRatio ?? "1:1";
  const attachedImages = (input.images ?? []).filter((item) => item.startsWith("data:"));

  const referencePaths: string[] = [];
  for (const dataUrl of attachedImages) {
    const saved = await saveStudioFile({
      userId: user.id,
      conversationId,
      source: { dataUrl },
    });
    referencePaths.push(saved.relativePath);
  }

  await prisma.studioMessage.create({
    data: {
      conversationId,
      role: "USER",
      content: prompt,
      status: "SUCCESS",
      referencePaths,
      aspectRatio,
    },
  });

  const pending = await prisma.studioMessage.create({
    data: {
      conversationId,
      role: "ASSISTANT",
      content: "正在出图，关闭页面也可以稍后再来看。",
      status: "PENDING",
      aspectRatio,
    },
  });

  await prisma.studioConversation.update({
    where: { id: conversationId },
    data: { title: conversation.title === defaultTitle ? titleFromPrompt(prompt) : conversation.title },
  });

  runAuthedBackground(user, credentials, () => runStudioTurn(pending.id, user.id, input.modelId));

  return getStudioConversation(conversationId, user.id);
}
