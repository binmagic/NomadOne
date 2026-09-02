"use client";

import type { XiaohongshuPlan } from "@/lib/ai/schemas/xiaohongshu";

export type XiaohongshuGeneratedImage = {
  pageNumber: number;
  title: string;
  prompt: string;
  model: string;
  imageUrl: string;
  imageStorageKey?: string;
  revisedPrompt?: string;
  updatedAt: string;
};

export type XiaohongshuReferenceImage = {
  fileName: string;
  mimeType: string;
  dataUrl: string;
  dataStorageKey?: string;
};

export type XiaohongshuImageAspectRatio = "1:1" | "3:4" | "9:16";

export type XiaohongshuConfig = {
  imageCount: number;
  imageAspectRatio: XiaohongshuImageAspectRatio;
};

export type XiaohongshuDraft = {
  topic: string;
  config: XiaohongshuConfig;
  referenceImages: XiaohongshuReferenceImage[];
  plan: XiaohongshuPlan | null;
  images: XiaohongshuGeneratedImage[];
  updatedAt: string;
};

const storageKey = "nomadone:xiaohongshu-flow:v1";
const legacyBrandPrefix = String.fromCharCode(98, 97, 110, 97, 110, 97, 45, 109, 97, 108, 108);
const legacyStorageKey = `${legacyBrandPrefix}:xiaohongshu-flow:v1`;
const imageDbName = "nomadone:xiaohongshu-assets:v1";
const legacyImageDbName = `${legacyBrandPrefix}:xiaohongshu-assets:v1`;
const imageStoreName = "assets";

export const defaultXiaohongshuConfig: XiaohongshuConfig = {
  imageCount: 5,
  imageAspectRatio: "3:4",
};

export function normalizeXiaohongshuConfig(config?: Partial<XiaohongshuConfig> | null): XiaohongshuConfig {
  const imageCount = Number.isFinite(config?.imageCount)
    ? Math.min(8, Math.max(3, Math.round(Number(config?.imageCount))))
    : defaultXiaohongshuConfig.imageCount;
  const imageAspectRatio =
    config?.imageAspectRatio === "1:1" || config?.imageAspectRatio === "3:4" || config?.imageAspectRatio === "9:16"
      ? config.imageAspectRatio
      : defaultXiaohongshuConfig.imageAspectRatio;

  return { imageCount, imageAspectRatio };
}

export function createEmptyXiaohongshuDraft(): XiaohongshuDraft {
  return {
    topic: "",
    config: defaultXiaohongshuConfig,
    referenceImages: [],
    plan: null,
    images: [],
    updatedAt: new Date().toISOString(),
  };
}

function canUseIndexedDb() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function isInlineImagePayload(value?: string | null) {
  return typeof value === "string" && value.startsWith("data:image/");
}

function openAssetDb(dbName = imageDbName) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error("IndexedDB is not available."));
      return;
    }

    const request = window.indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(imageStoreName)) {
        db.createObjectStore(imageStoreName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
  });
}

async function writeAsset(key: string, value: string) {
  const db = await openAssetDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(imageStoreName, "readwrite");
    transaction.objectStore(imageStoreName).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Failed to write image asset."));
  });
  db.close();
}

async function readAssetFromDb(dbName: string, key: string) {
  const db = await openAssetDb(dbName);
  const value = await new Promise<string | null>((resolve, reject) => {
    const transaction = db.transaction(imageStoreName, "readonly");
    const request = transaction.objectStore(imageStoreName).get(key);
    request.onsuccess = () => resolve(typeof request.result === "string" ? request.result : null);
    request.onerror = () => reject(request.error ?? new Error("Failed to read image asset."));
  });
  db.close();
  return value;
}

async function readAsset(key: string) {
  const currentValue = await readAssetFromDb(imageDbName, key).catch(() => null);
  if (currentValue) return currentValue;
  return readAssetFromDb(legacyImageDbName, key).catch(() => null);
}

function assetKey(prefix: string, stablePart: string | number) {
  return `${prefix}:${stablePart}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

async function stripLargeAssets(draft: XiaohongshuDraft): Promise<XiaohongshuDraft> {
  const referenceImages = await Promise.all(
    draft.referenceImages.map(async (image, index) => {
      if (!isInlineImagePayload(image.dataUrl)) return image;
      const key = image.dataStorageKey ?? assetKey("reference", index + 1);
      await writeAsset(key, image.dataUrl);
      return { ...image, dataUrl: "", dataStorageKey: key };
    }),
  );

  const images = await Promise.all(
    draft.images.map(async (image) => {
      if (!isInlineImagePayload(image.imageUrl)) return image;
      const key = image.imageStorageKey ?? assetKey("generated", image.pageNumber);
      await writeAsset(key, image.imageUrl);
      return { ...image, imageUrl: "", imageStorageKey: key };
    }),
  );

  return { ...draft, referenceImages, images };
}

async function hydrateLargeAssets(draft: XiaohongshuDraft): Promise<XiaohongshuDraft> {
  const referenceImages = await Promise.all(
    draft.referenceImages.map(async (image) => {
      if (image.dataUrl || !image.dataStorageKey) return image;
      const dataUrl = await readAsset(image.dataStorageKey).catch(() => null);
      return dataUrl ? { ...image, dataUrl } : image;
    }),
  );

  const images = await Promise.all(
    draft.images.map(async (image) => {
      if (image.imageUrl || !image.imageStorageKey) return image;
      const imageUrl = await readAsset(image.imageStorageKey).catch(() => null);
      return imageUrl ? { ...image, imageUrl } : image;
    }),
  );

  return { ...draft, referenceImages, images };
}

export function loadXiaohongshuDraft(): XiaohongshuDraft {
  if (typeof window === "undefined") return createEmptyXiaohongshuDraft();

  const raw = window.localStorage.getItem(storageKey) ?? window.localStorage.getItem(legacyStorageKey);
  if (!raw) return createEmptyXiaohongshuDraft();

  try {
    const parsed = JSON.parse(raw) as Partial<XiaohongshuDraft>;
    return {
      ...createEmptyXiaohongshuDraft(),
      ...parsed,
      config: normalizeXiaohongshuConfig(parsed.config),
    };
  } catch {
    return createEmptyXiaohongshuDraft();
  }
}

export async function loadXiaohongshuDraftWithAssets(): Promise<XiaohongshuDraft> {
  return hydrateLargeAssets(loadXiaohongshuDraft());
}

export async function saveXiaohongshuDraft(draft: XiaohongshuDraft) {
  if (typeof window === "undefined") return;
  const persistableDraft = canUseIndexedDb() ? await stripLargeAssets(draft) : draft;
  window.localStorage.setItem(
    storageKey,
    JSON.stringify({
      ...persistableDraft,
      config: normalizeXiaohongshuConfig(persistableDraft.config),
      updatedAt: new Date().toISOString(),
    }),
  );
}

export function buildDefaultImagePrompt(
  plan: XiaohongshuPlan,
  page: XiaohongshuPlan["pages"][number],
  config?: XiaohongshuConfig,
) {
  const aspectRatio = normalizeXiaohongshuConfig(config).imageAspectRatio;
  return [
    `小红书 ${aspectRatio} 图文第 ${page.pageNumber} 页。`,
    `整组选题：${plan.topic}`,
    `页面标题：${page.title}`,
    page.subtitle ? `副标题：${page.subtitle}` : "",
    `正文要点：${page.body}`,
    `画面描述：${page.visualDirection}`,
    `版式：${page.layout}`,
    page.negativePrompt ? `禁止出现：${page.negativePrompt}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildXiaohongshuMarkdown(plan: XiaohongshuPlan) {
  return [
    `# ${plan.coverTitle}`,
    plan.coverSubtitle,
    "",
    `选题：${plan.topic}`,
    `人群：${plan.audience}`,
    `洞察：${plan.coreInsight}`,
    "",
    "## 标题备选",
    ...plan.titleOptions.map((title, index) => `${index + 1}. ${title}`),
    "",
    "## 分页脚本",
    ...plan.pages.flatMap((page) => [
      `### ${page.pageNumber}. ${page.title}`,
      page.subtitle ? `副标题：${page.subtitle}` : "",
      `正文：${page.body}`,
      `提示词：${page.imagePrompt || buildDefaultImagePrompt(plan, page)}`,
      page.negativePrompt ? `避免：${page.negativePrompt}` : "",
      "",
    ]),
    "## 发布文案",
    plan.caption,
    "",
    plan.hashtags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" "),
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
