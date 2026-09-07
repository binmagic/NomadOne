/**
 * [INPUT]: 无运行时依赖，只读 Project.modelSnapshot.generationSettings
 * [OUTPUT]: 对外提供 GenerationSettings、defaultGenerationSettings、readGenerationSettings
 * [POS]: lib/utils 的生图设置契约，与 preview-config 并列。第一张头图锁参考图标题字体走这里，不进 previewConfig
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export type GenerationSettings = {
  allowSvgFallback: boolean;
  uniformAspectRatio: boolean;
  preserveHeroTypographyFromReference: boolean;
};

export const defaultGenerationSettings: GenerationSettings = {
  allowSvgFallback: false,
  uniformAspectRatio: false,
  preserveHeroTypographyFromReference: false,
};

function readFlag(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function readGenerationSettings(snapshot: unknown): GenerationSettings {
  const data = (snapshot as Record<string, unknown> | null) ?? {};
  const settings = (data.generationSettings as Record<string, unknown> | null) ?? {};

  return {
    allowSvgFallback: readFlag(settings.allowSvgFallback, defaultGenerationSettings.allowSvgFallback),
    uniformAspectRatio: readFlag(settings.uniformAspectRatio, defaultGenerationSettings.uniformAspectRatio),
    preserveHeroTypographyFromReference: readFlag(
      settings.preserveHeroTypographyFromReference,
      defaultGenerationSettings.preserveHeroTypographyFromReference,
    ),
  };
}
