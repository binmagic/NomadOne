import fs from "fs/promises";
import path from "path";

import { prisma } from "@/lib/db/prisma";
import { assetPublicUrl, deleteAssetRecord } from "@/lib/storage/asset-manager";
import { env } from "@/lib/utils/env";

function readPreviewConfig(snapshot: unknown) {
  const data = (snapshot as Record<string, unknown> | null) ?? {};
  const previewConfig = (data.previewConfig as Record<string, unknown> | null) ?? {};

  return {
    heroImageCount: Math.min(5, Math.max(3, Number(previewConfig.heroImageCount ?? 4))),
    detailSectionCount: Math.min(10, Math.max(4, Number(previewConfig.detailSectionCount ?? 6))),
  };
}

async function deleteAssetIfUnreferenced(assetId: string | null | undefined) {
  if (!assetId) {
    return;
  }

  const versionRefCount = await prisma.sectionVersion.count({
    where: { imageAssetId: assetId },
  });
  const currentRefCount = await prisma.pageSection.count({
    where: { currentImageAssetId: assetId },
  });

  if (versionRefCount === 0 && currentRefCount === 0) {
    await deleteAssetRecord(assetId);
  }
}

async function normalizeSectionOrder(projectId: string) {
  const sections = await prisma.pageSection.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
    select: { id: true },
  });

  await prisma.$transaction(
    sections.map((section, index) =>
      prisma.pageSection.update({
        where: { id: section.id },
        data: { order: index },
      }),
    ),
  );
}

async function pruneProjectToPreviewConfig(projectId: string, snapshot: unknown) {
  const previewConfig = readPreviewConfig(snapshot);
  const sections = await prisma.pageSection.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        include: {
          imageAsset: true,
        },
      },
      generatedAssets: true,
    },
  });

  const removableSections = [
    ...sections.filter((section) => section.type === "HERO").slice(previewConfig.heroImageCount),
    ...sections.filter((section) => section.type !== "HERO").slice(previewConfig.detailSectionCount),
  ];

  for (const section of removableSections) {
    const assetIds = [
      ...new Set(
        [
          section.currentImageAssetId,
          ...section.versions.map((version) => version.imageAssetId),
          ...section.generatedAssets.map((asset) => asset.id),
        ].filter(Boolean),
      ),
    ] as string[];

    await prisma.pageSection.delete({
      where: { id: section.id },
    });

    for (const assetId of assetIds) {
      await deleteAssetIfUnreferenced(assetId);
    }
  }

  if (removableSections.length > 0) {
    await normalizeSectionOrder(projectId);
  }
}

export async function assertProjectOwned(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) {
    throw new Error("Project not found.");
  }
  return project;
}

export async function assertAssetOwned(assetId: string, userId: string) {
  const asset = await prisma.productAsset.findFirst({
    where: { id: assetId, project: { userId } },
    select: { id: true, projectId: true },
  });
  if (!asset) {
    throw new Error("Asset not found.");
  }
  return asset;
}

export async function listProjects(userId: string) {
  const projects = await prisma.project.findMany({
    where: { userId, platform: { not: "__mxpage_system_task__" } },
    orderBy: { updatedAt: "desc" },
    include: {
      assets: {
        orderBy: { sortOrder: "asc" },
        take: 1,
      },
      sections: true,
    },
  });

  return projects.map((project) => ({
    ...project,
    coverImageUrl: assetPublicUrl(project.assets[0]),
    sectionCount: project.sections.length,
  }));
}

export async function createProject(
  input: {
    name: string;
    platform: string;
    style: string;
    description?: string | null;
  },
  userId: string,
) {
  return prisma.project.create({
    data: {
      ...input,
      userId,
    },
  });
}

export async function getProjectDetail(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    include: {
      assets: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      analysis: true,
      sections: {
        orderBy: { order: "asc" },
        include: {
          currentImageAsset: true,
          versions: {
            orderBy: { versionNumber: "desc" },
            include: {
              imageAsset: true,
            },
          },
        },
      },
      tasks: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!project) {
    return null;
  }

  return {
    ...project,
    assets: project.assets.map((asset) => ({
      ...asset,
      url: assetPublicUrl(asset),
    })),
    sections: project.sections.map((section) => ({
      ...section,
      imageUrl: assetPublicUrl(section.currentImageAsset),
      versions: section.versions.map((version) => ({
        ...version,
        imageUrl: assetPublicUrl(version.imageAsset),
      })),
    })),
  };
}

export async function updateProject(projectId: string, userId: string, input: Record<string, unknown>) {
  const owned = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!owned) {
    return null;
  }

  await prisma.project.update({
    where: { id: projectId },
    data: input,
  });

  if ("modelSnapshot" in input) {
    await pruneProjectToPreviewConfig(projectId, input.modelSnapshot);
  }

  return getProjectDetail(projectId, userId);
}

export async function deleteProject(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    return null;
  }

  await prisma.project.delete({
    where: { id: projectId },
  });

  const storageRoot = path.resolve(process.cwd(), env.STORAGE_ROOT);
  await Promise.all([
    fs.rm(path.join(storageRoot, "uploads", projectId), { recursive: true, force: true }),
    fs.rm(path.join(storageRoot, "generated", projectId), { recursive: true, force: true }),
    fs.rm(path.join(storageRoot, "exports", projectId), { recursive: true, force: true }),
  ]);

  return project;
}
