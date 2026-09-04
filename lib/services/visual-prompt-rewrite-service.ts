/**
 * [INPUT]: 依赖 Prisma、getProviderAdapter、updateSection、preview-config、visual-style-guide、visual-prompt-rewrite 提示词/schema
 * [OUTPUT]: 对外提供 rewriteSectionVisualPrompt，按当前标题/文案重写单模块双语 visualPrompt
 * [POS]: lib/services 的单模块 Prompt 重写内核。不整页规划，不把生图 Agent 的长 prompt 写回文本框
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { prisma } from "@/lib/db/prisma";
import {
  buildFallbackBilingualVisualPrompt,
  buildVisualPromptRewritePrompt,
} from "@/lib/ai/prompts/visual-prompt-rewrite";
import { visualPromptRewriteSchema } from "@/lib/ai/schemas/visual-prompt-rewrite";
import { updateSection } from "@/lib/services/planner-service";
import { getProviderAdapter } from "@/lib/services/provider-service";
import { readPreviewConfig } from "@/lib/utils/preview-config";
import {
  buildDefaultVisualStyleGuide,
  readVisualStyleGuide,
} from "@/lib/utils/visual-style-guide";

type RewriteInput = {
  title?: string;
  goal?: string;
  copy?: string;
  modelId?: string | null;
};

type ProviderModelRecord = {
  modelId: string;
  capabilities: unknown;
  isDefaultPlanning?: boolean;
  isDefaultAnalysis?: boolean;
};

function readCapabilities(model: ProviderModelRecord) {
  return (model.capabilities as Record<string, boolean> | null) ?? {};
}

function pickRewriteModel(models: ProviderModelRecord[], preferredModelId?: string | null) {
  if (preferredModelId?.trim()) {
    return preferredModelId.trim();
  }

  const textModels = models.filter((model) => readCapabilities(model).text);
  return (
    textModels.find((model) => model.isDefaultPlanning)?.modelId ??
    textModels.find((model) => model.isDefaultAnalysis)?.modelId ??
    textModels.find((model) => /gpt-4o|gpt-4\.1|gpt-5|gemini|qwen|kimi|moonshot|claude/i.test(model.modelId))?.modelId ??
    textModels[0]?.modelId ??
    null
  );
}

function shouldFallback(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /timed out|timeout|temperature|unsupported|invalid json|structured|parse|network error|fetch failed/i.test(
    error.message,
  );
}

export async function rewriteSectionVisualPrompt(projectId: string, sectionId: string, input: RewriteInput = {}) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { analysis: true },
  });
  const section = await prisma.pageSection.findUnique({
    where: { id: sectionId },
  });

  if (!project) {
    throw new Error("Project not found.");
  }

  if (!section || section.projectId !== projectId) {
    throw new Error("Section not found.");
  }

  const title = input.title?.trim() || section.title;
  const goal = input.goal?.trim() || section.goal;
  const copy = input.copy ?? section.copy;
  const previewConfig = readPreviewConfig(project.modelSnapshot);
  const visualStyleGuide =
    readVisualStyleGuide(project.modelSnapshot) ??
    buildDefaultVisualStyleGuide({
      productName: (project.analysis?.normalizedResult as { productName?: string } | null)?.productName ?? project.name,
      styleLabel: project.style,
      platformLabel: project.platform,
    });
  const aspectRatio = section.type === "HERO" ? "1:1" : previewConfig.imageAspectRatio;

  const { provider, adapter } = await getProviderAdapter();
  const model = pickRewriteModel(provider.models, input.modelId);
  if (!model) {
    throw new Error("当前没有可用的文案规划模型。");
  }

  let visualPrompt = buildFallbackBilingualVisualPrompt({
    title,
    copy,
    previousVisualPrompt: section.visualPrompt,
  });

  try {
    const result = await adapter.generateStructured({
      model,
      systemPrompt: "Return strict JSON only.",
      userPrompt: buildVisualPromptRewritePrompt({
        title,
        goal,
        copy,
        previousVisualPrompt: section.visualPrompt,
        sectionType: section.type,
        contentLanguage: previewConfig.contentLanguage,
        visualStyleGuide,
        productContext: project.analysis?.normalizedResult ?? project.modelSnapshot ?? null,
        editableData: section.editableData,
        aspectRatio,
      }),
      schema: visualPromptRewriteSchema,
      timeoutMs: 60_000,
      monitor: {
        projectId,
        sectionId,
        operation: "section_visual_prompt_rewrite",
      },
    });
    visualPrompt = result.parsed.visualPrompt;
  } catch (error) {
    if (!shouldFallback(error)) {
      throw error;
    }
  }

  const updated = await updateSection(sectionId, {
    title,
    goal,
    copy,
    visualPrompt,
  });

  return {
    visualPrompt: updated.visualPrompt,
    section: updated,
  };
}
