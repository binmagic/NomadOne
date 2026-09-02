import fs from "fs/promises";
import path from "path";
import { Prisma } from "@prisma/client";

import type { XiaohongshuPlan } from "@/lib/ai/schemas/xiaohongshu";
import { withUser, getRequestUserId } from "@/lib/auth/request-user";
import { prisma } from "@/lib/db/prisma";
import { analyzeProject } from "@/lib/services/analysis-service";
import { editSectionImage, generateSectionImage } from "@/lib/services/generation-service";
import { planSections } from "@/lib/services/planner-service";
import { createProject } from "@/lib/services/project-service";
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
import { generateXiaohongshuImages, type XiaohongshuImageAspectRatio } from "@/lib/services/xiaohongshu-service";
import { saveUploadAsset } from "@/lib/storage/asset-manager";
import { normalizeContentLanguage, type ContentLanguage } from "@/lib/utils/content-language";
import { env } from "@/lib/utils/env";
import { sanitizeFileName } from "@/lib/utils/files";
import type { UserProfile } from "@/types/domain";

export type BatchCreateFileInput = {
  fileName: string;
  mimeType: string;
  base64Data: string;
};

export type BatchCreateTaskInput = {
  files: BatchCreateFileInput[];
  autoGenerateImages?: boolean;
};

export type XiaohongshuGenerateTaskInput = {
  plan: XiaohongshuPlan;
  imageAspectRatio?: XiaohongshuImageAspectRatio;
  referenceImages?: string[];
};

export type TranslatePageTaskInput = {
  projectId: string;
  targetLanguage: ContentLanguage;
  referenceAssetIds?: string[];
};

type StoredBatchFile = {
  fileName: string;
  mimeType: string;
  filePath: string;
};

type BatchItemStatus = {
  fileName: string;
  state: "pending" | "running" | "done" | "failed";
  message: string;
  projectId?: string | null;
};

const systemProjectPlatform = "__nomadone_system_task__";

function requireTaskUserId() {
  const userId = getRequestUserId();
  if (!userId) {
    throw new Error("Missing user context.");
  }
  return userId;
}

function runAuthedBackground(user: UserProfile, credentials: RequestProviderCredentials, handler: () => Promise<void>) {
  runTaskInBackground(async () => {
    await withUser(user, () => runWithProviderCredentials(credentials, handler));
  });
}

function storageRoot() {
  return path.resolve(process.cwd(), env.STORAGE_ROOT);
}

function taskInputDir(taskId: string) {
  return path.join(storageRoot(), "task-inputs", taskId);
}

async function ensureSystemTaskProject(userId: string) {
  const existing = await prisma.project.findFirst({
    where: { platform: systemProjectPlatform, userId },
    orderBy: { createdAt: "asc" },
  });

  if (existing) return existing;

  return prisma.project.create({
    data: {
      name: "NomadOne 系统任务",
      platform: systemProjectPlatform,
      style: "system",
      description: "内部后台任务占位项目，不在历史记录中展示。",
      userId,
    },
  });
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

function buildBatchProjectName(fileName: string, index: number) {
  const baseName = fileName.replace(/\.[^.]+$/, "").trim() || `批量商品-${index + 1}`;
  return `${baseName}-${nowStamp()}`;
}

function batchStatuses(files: Array<{ fileName: string }>): BatchItemStatus[] {
  return files.map((file) => ({
    fileName: file.fileName,
    state: "pending",
    message: "等待处理",
    projectId: null,
  }));
}

function patchBatchStatus(items: BatchItemStatus[], index: number, patch: Partial<BatchItemStatus>) {
  return items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
}

async function persistBatchFiles(taskId: string, files: BatchCreateFileInput[]) {
  const dir = taskInputDir(taskId);
  await fs.mkdir(dir, { recursive: true });

  const stored: StoredBatchFile[] = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const safeName = `${String(index + 1).padStart(2, "0")}-${sanitizeFileName(file.fileName)}`;
    const absolutePath = path.join(dir, safeName);
    await fs.writeFile(absolutePath, Buffer.from(file.base64Data, "base64"));
    stored.push({
      fileName: file.fileName,
      mimeType: file.mimeType,
      filePath: path.relative(storageRoot(), absolutePath),
    });
  }

  return stored;
}

async function readStoredBatchFile(file: StoredBatchFile) {
  return fs.readFile(path.join(storageRoot(), file.filePath));
}

async function runBatchCreateTask(taskId: string, files: StoredBatchFile[], autoGenerateImages: boolean) {
  let items = batchStatuses(files);
  let successCount = 0;
  let failedCount = 0;
  const projectIds: string[] = [];

  await startTask(taskId, {
    totalItems: files.length,
    completedItems: 0,
    failedItems: 0,
    currentStep: "batch_create_started",
    items,
  });

  try {
    for (let index = 0; index < files.length; index += 1) {
      await assertTaskNotCanceled(taskId);
      const file = files[index];
      items = patchBatchStatus(items, index, { state: "running", message: "正在创建项目" });
      await updateTaskProgress(taskId, { currentStep: "creating_project", items });

      try {
        const project = await createProject(
          {
            name: buildBatchProjectName(file.fileName, index),
            platform: "general_ecommerce",
            style: "generic_clean",
            description: "由批量创建自动生成",
          },
          requireTaskUserId(),
        );
        projectIds.push(project.id);
        items = patchBatchStatus(items, index, { projectId: project.id, message: "正在上传主商品图" });
        await updateTaskProgress(taskId, { currentStep: "uploading_asset", items, projectIds });

        const fileBuffer = await readStoredBatchFile(file);
        await saveUploadAsset({
          projectId: project.id,
          type: "MAIN",
          fileName: file.fileName,
          mimeType: file.mimeType,
          fileBuffer,
          sortOrder: 0,
          isMain: true,
        });

        items = patchBatchStatus(items, index, { message: "正在分析商品信息" });
        await updateTaskProgress(taskId, { currentStep: "analyzing_project", items, projectIds });
        await analyzeProject(project.id);

        items = patchBatchStatus(items, index, { message: "正在规划详情页结构" });
        await updateTaskProgress(taskId, { currentStep: "planning_sections", items, projectIds });
        await planSections(project.id, { autoDecideCounts: true });

        if (autoGenerateImages) {
          const sections = await prisma.pageSection.findMany({
            where: { projectId: project.id },
            orderBy: { order: "asc" },
          });

          for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
            await assertTaskNotCanceled(taskId);
            const section = sections[sectionIndex];
            items = patchBatchStatus(items, index, {
              message: `正在生成图片 ${sectionIndex + 1}/${sections.length}${section.title ? `：${section.title}` : ""}`,
            });
            await updateTaskProgress(taskId, {
              currentStep: "generating_images",
              items,
              projectIds,
              estimatedImageCount: sections.length,
            });
            await generateSectionImage(project.id, section.id, null, []);
          }
        }

        successCount += 1;
        items = patchBatchStatus(items, index, {
          state: "done",
          message: autoGenerateImages ? "已完成分析、规划与图片生成" : "已完成分析与详情页规划",
          projectId: project.id,
        });
      } catch (error) {
        failedCount += 1;
        items = patchBatchStatus(items, index, {
          state: "failed",
          message: error instanceof Error ? error.message : "处理失败",
        });
      }

      await updateTaskProgress(taskId, {
        currentStep: "batch_item_finished",
        totalItems: files.length,
        completedItems: successCount,
        failedItems: failedCount,
        items,
        projectIds,
      });
    }

    await completeTask(taskId, {
      currentStep: "batch_create_finished",
      totalItems: files.length,
      completedItems: successCount,
      failedItems: failedCount,
      items,
      projectIds,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Task canceled.") {
      return;
    }
    await failTask(taskId, error instanceof Error ? error.message : "Batch create failed", {
      currentStep: "batch_create_failed",
      totalItems: files.length,
      completedItems: successCount,
      failedItems: failedCount,
      items,
      projectIds,
    });
  }
}

export async function createBatchCreateTask(
  input: BatchCreateTaskInput,
  credentials: RequestProviderCredentials,
  user: UserProfile,
) {
  const systemProject = await ensureSystemTaskProject(user.id);
  const filesMeta = input.files.map((file) => ({ fileName: file.fileName, mimeType: file.mimeType }));
  const task = await createTask({
    projectId: systemProject.id,
    taskType: "BATCH_CREATE",
    status: "PENDING",
    inputPayload: {
      files: filesMeta,
      autoGenerateImages: input.autoGenerateImages === true,
    },
    outputPayload: {
      totalItems: input.files.length,
      completedItems: 0,
      failedItems: 0,
      currentStep: "queued",
      items: batchStatuses(filesMeta),
    },
  });
  const storedFiles = await persistBatchFiles(task.id, input.files);
  await prisma.generationTask.update({
    where: { id: task.id },
    data: {
      inputPayload: {
        files: storedFiles,
        autoGenerateImages: input.autoGenerateImages === true,
      } as Prisma.InputJsonValue,
    },
  });

  runAuthedBackground(user, credentials, () => runBatchCreateTask(task.id, storedFiles, input.autoGenerateImages === true));
  return getTask(task.id);
}

async function runTranslatePageTask(taskId: string, input: TranslatePageTaskInput) {
  const targetLanguage = normalizeContentLanguage(input.targetLanguage);
  const sections = await prisma.pageSection.findMany({
    where: {
      projectId: input.projectId,
      currentImageAssetId: { not: null },
    },
    orderBy: { order: "asc" },
  });
  let successCount = 0;
  let failedCount = 0;
  const items = sections.map((section) => ({
    sectionId: section.id,
    title: section.title,
    state: "pending",
    message: "等待转换",
  }));

  await startTask(taskId, {
    totalItems: sections.length,
    completedItems: 0,
    failedItems: 0,
    targetLanguage,
    currentStep: "translate_started",
    items,
  });

  try {
    for (let index = 0; index < sections.length; index += 1) {
      await assertTaskNotCanceled(taskId);
      const section = sections[index];
      items[index] = { ...items[index], state: "running", message: "正在转换图内文字" };
      await updateTaskProgress(taskId, { currentStep: "translating_section", items });

      try {
        const result = await editSectionImage(input.projectId, section.id, {
          referenceAssetIds: input.referenceAssetIds ?? [],
          editMode: "translate",
          targetLanguage,
        });
        successCount += 1;
        items[index] = {
          ...items[index],
          state: "done",
          message: "已转换",
          imageAssetId: result.imageAsset.id,
        } as never;
      } catch (error) {
        failedCount += 1;
        items[index] = {
          ...items[index],
          state: "failed",
          message: error instanceof Error ? error.message : "转换失败",
        };
      }

      await updateTaskProgress(taskId, {
        currentStep: "translate_item_finished",
        totalItems: sections.length,
        completedItems: successCount,
        failedItems: failedCount,
        targetLanguage,
        items,
      });
    }

    await completeTask(taskId, {
      currentStep: "translate_finished",
      totalItems: sections.length,
      completedItems: successCount,
      failedItems: failedCount,
      targetLanguage,
      items,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Task canceled.") return;
    await failTask(taskId, error instanceof Error ? error.message : "Translate page failed", {
      currentStep: "translate_failed",
      totalItems: sections.length,
      completedItems: successCount,
      failedItems: failedCount,
      targetLanguage,
      items,
    });
  }
}

export async function createTranslatePageTask(
  input: TranslatePageTaskInput,
  credentials: RequestProviderCredentials,
  user: UserProfile,
) {
  const task = await createTask({
    projectId: input.projectId,
    taskType: "TRANSLATE_PAGE",
    status: "PENDING",
    inputPayload: {
      projectId: input.projectId,
      targetLanguage: normalizeContentLanguage(input.targetLanguage),
      referenceAssetIds: input.referenceAssetIds ?? [],
    },
    outputPayload: {
      totalItems: 0,
      completedItems: 0,
      failedItems: 0,
      currentStep: "queued",
      targetLanguage: normalizeContentLanguage(input.targetLanguage),
    },
  });

  runAuthedBackground(user, credentials, () => runTranslatePageTask(task.id, input));
  return getTask(task.id);
}

async function runXiaohongshuGenerateTask(taskId: string, input: XiaohongshuGenerateTaskInput) {
  const imageAspectRatio = input.imageAspectRatio ?? "3:4";
  const pages = input.plan.pages;
  let images: unknown[] = [];
  let successCount = 0;
  let failedCount = 0;
  const items = pages.map((page) => ({
    pageNumber: page.pageNumber,
    title: page.title,
    state: "pending",
    message: "等待生成",
  }));

  await startTask(taskId, {
    totalItems: pages.length,
    completedItems: 0,
    failedItems: 0,
    estimatedImageCount: pages.length,
    currentStep: "xiaohongshu_generate_started",
    items,
    images: [],
  });

  try {
    for (let index = 0; index < pages.length; index += 1) {
      await assertTaskNotCanceled(taskId);
      const page = pages[index];
      items[index] = { ...items[index], state: "running", message: "正在生成图片" };
      await updateTaskProgress(taskId, { currentStep: "generating_xhs_page", items, images });

      try {
        const pageImages = await generateXiaohongshuImages(input.plan, input.referenceImages ?? [], {
          imageAspectRatio,
          pageNumber: page.pageNumber,
        });
        images = [
          ...images.filter((image) => (image as { pageNumber?: number }).pageNumber !== page.pageNumber),
          ...pageImages,
        ].sort((left, right) => Number((left as { pageNumber?: number }).pageNumber ?? 0) - Number((right as { pageNumber?: number }).pageNumber ?? 0));
        successCount += pageImages.length;
        items[index] = { ...items[index], state: "done", message: "已生成" };
      } catch (error) {
        failedCount += 1;
        items[index] = {
          ...items[index],
          state: "failed",
          message: error instanceof Error ? error.message : "生成失败",
        };
      }

      await updateTaskProgress(taskId, {
        currentStep: "xiaohongshu_page_finished",
        totalItems: pages.length,
        completedItems: successCount,
        failedItems: failedCount,
        estimatedImageCount: pages.length,
        items,
        images,
      });
    }

    await completeTask(taskId, {
      currentStep: "xiaohongshu_generate_finished",
      totalItems: pages.length,
      completedItems: successCount,
      failedItems: failedCount,
      estimatedImageCount: pages.length,
      items,
      images,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Task canceled.") return;
    await failTask(taskId, error instanceof Error ? error.message : "Xiaohongshu generation failed", {
      currentStep: "xiaohongshu_generate_failed",
      totalItems: pages.length,
      completedItems: successCount,
      failedItems: failedCount,
      estimatedImageCount: pages.length,
      items,
      images,
    });
  }
}

export async function createXiaohongshuGenerateTask(
  input: XiaohongshuGenerateTaskInput,
  credentials: RequestProviderCredentials,
  user: UserProfile,
) {
  const systemProject = await ensureSystemTaskProject(user.id);
  const imageAspectRatio = input.imageAspectRatio ?? "3:4";
  const task = await createTask({
    projectId: systemProject.id,
    taskType: "XHS_GENERATE",
    status: "PENDING",
    inputPayload: {
      plan: input.plan,
      imageAspectRatio,
      referenceImages: input.referenceImages ?? [],
    },
    outputPayload: {
      totalItems: input.plan.pages.length,
      completedItems: 0,
      failedItems: 0,
      estimatedImageCount: input.plan.pages.length,
      currentStep: "queued",
      items: input.plan.pages.map((page) => ({ pageNumber: page.pageNumber, title: page.title, state: "pending", message: "等待生成" })),
      images: [],
    },
  });

  runAuthedBackground(user, credentials, () => runXiaohongshuGenerateTask(task.id, input));
  return getTask(task.id);
}

export async function retryWorkflowTask(
  taskId: string,
  credentials: RequestProviderCredentials,
  user: UserProfile,
) {
  const task = await prisma.generationTask.findFirst({
    where: { id: taskId, project: { userId: user.id } },
  });
  if (!task) {
    throw new Error("Task not found.");
  }
  if (task.status === "RUNNING") {
    throw new Error("Task is already running.");
  }

  const input = (task.inputPayload ?? {}) as Record<string, unknown>;
  await prisma.generationTask.update({
    where: { id: taskId },
    data: {
      status: "PENDING",
      errorMessage: null,
      completedAt: null,
      outputPayload: {
        ...((task.outputPayload as Record<string, unknown> | null) ?? {}),
        currentStep: "retry_queued",
      } as Prisma.InputJsonValue,
    },
  });

  if (task.taskType === "BATCH_CREATE") {
    const files = Array.isArray(input.files) ? (input.files as StoredBatchFile[]) : [];
    const autoGenerateImages = input.autoGenerateImages === true;
    runAuthedBackground(user, credentials, () => runBatchCreateTask(taskId, files, autoGenerateImages));
    return getTask(taskId);
  }

  if (task.taskType === "TRANSLATE_PAGE") {
    runAuthedBackground(user, credentials, () =>
      runTranslatePageTask(taskId, {
        projectId: String(input.projectId ?? task.projectId),
        targetLanguage: normalizeContentLanguage(input.targetLanguage),
        referenceAssetIds: Array.isArray(input.referenceAssetIds) ? (input.referenceAssetIds as string[]) : [],
      }),
    );
    return getTask(taskId);
  }

  if (task.taskType === "XHS_GENERATE") {
    runAuthedBackground(user, credentials, () =>
      runXiaohongshuGenerateTask(taskId, {
        plan: input.plan as XiaohongshuPlan,
        imageAspectRatio: input.imageAspectRatio as XiaohongshuImageAspectRatio,
        referenceImages: Array.isArray(input.referenceImages) ? (input.referenceImages as string[]) : [],
      }),
    );
    return getTask(taskId);
  }

  throw new Error("This task type does not support retry.");
}