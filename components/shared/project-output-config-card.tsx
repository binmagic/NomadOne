"use client";

/**
 * [INPUT]: 依赖 preview-config 的张数边界与读取、content-language、项目 PATCH API
 * [OUTPUT]: 对外提供 ProjectOutputConfigCard；分析页可编辑，规划/编辑/导出页只读
 * [POS]: components/shared 的输出配置入口，详情页数量允许 0 张
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useMemo, useState } from "react";
import { Loader2, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  contentLanguageLabels,
  contentLanguageOptions,
  normalizeContentLanguage,
} from "@/lib/utils/content-language";
import {
  clampDetailSectionCount,
  clampHeroImageCount,
  detailSectionCountOptions,
  heroImageCountOptions,
  readPreviewConfig,
  type PreviewConfig,
} from "@/lib/utils/preview-config";

type ProjectConfigCardProject = {
  id: string;
  modelSnapshot: unknown;
} | null;

function OutputConfigSummary({ config }: { config: PreviewConfig }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge variant="default">
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-slate-500" />
          内容语言：{contentLanguageLabels[config.contentLanguage]}
        </Badge>
        <Badge variant="success">
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
          头图：{config.heroImageCount} 张
        </Badge>
        <Badge variant="warning">
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
          详情页：{config.detailSectionCount} 张
        </Badge>
        <Badge variant="outline">
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-sky-500" />
          详情图比例：{config.imageAspectRatio}
        </Badge>
      </div>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-sky-500" />
        这份配置会同时影响页面规划文案、图像中的文字语言，以及后续导出结果。
      </p>
    </div>
  );
}

export function ProjectOutputConfigCard({
  project,
  editable = false,
}: {
  project: ProjectConfigCardProject;
  editable?: boolean;
}) {
  const router = useRouter();
  const initialConfig = useMemo(() => readPreviewConfig(project?.modelSnapshot), [project?.modelSnapshot]);
  const [formState, setFormState] = useState<PreviewConfig>(initialConfig);
  const [saving, setSaving] = useState(false);

  if (!project) {
    return null;
  }

  const hasChanges =
    formState.heroImageCount !== initialConfig.heroImageCount ||
    formState.detailSectionCount !== initialConfig.detailSectionCount ||
    formState.imageAspectRatio !== initialConfig.imageAspectRatio ||
    formState.contentLanguage !== initialConfig.contentLanguage;

  const saveConfig = async () => {
    try {
      setSaving(true);
      const snapshot = ((project.modelSnapshot as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelSnapshot: {
            ...snapshot,
            previewConfig: {
              ...((snapshot.previewConfig as Record<string, unknown> | null) ?? {}),
              heroImageCount: formState.heroImageCount,
              detailSectionCount: formState.detailSectionCount,
              imageAspectRatio: formState.imageAspectRatio,
              contentLanguage: formState.contentLanguage,
            },
          },
        }),
      });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error?.message ?? "输出配置保存失败");
      }

      toast.success("输出配置已保存");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "输出配置保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (!editable) {
    return (
      <Card className="border-dashed bg-muted/30 dark:bg-white/[0.03]">
        <CardContent className="p-4">
          <OutputConfigSummary config={initialConfig} />
        </CardContent>
      </Card>
    );
  }

  return (
      <Card className="border-dashed bg-muted/30 dark:bg-white/[0.03]">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="h-4 w-4 text-sky-600" />
          输出配置
        </CardTitle>
        <CardDescription>这里调整的语言、头图数量、详情页数量和比例，会直接影响后续规划、生成与导出。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>内容语言</Label>
            <select
              className="flex h-10 w-full rounded-xl border border-input bg-white px-3 text-sm dark:bg-black/30 dark:text-slate-100"
              value={formState.contentLanguage}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  contentLanguage: normalizeContentLanguage(event.target.value),
                }))
              }
            >
              {contentLanguageOptions.map((option) => (
                <option key={option} value={option}>
                  {contentLanguageLabels[option]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>头图数量</Label>
            <select
              className="flex h-10 w-full rounded-xl border border-input bg-white px-3 text-sm dark:bg-black/30 dark:text-slate-100"
              value={String(formState.heroImageCount)}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  heroImageCount: clampHeroImageCount(event.target.value),
                }))
              }
            >
              {heroImageCountOptions.map((count) => (
                <option key={count} value={count}>
                  {count} 张
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>详情页数量</Label>
            <select
              className="flex h-10 w-full rounded-xl border border-input bg-white px-3 text-sm dark:bg-black/30 dark:text-slate-100"
              value={String(formState.detailSectionCount)}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  detailSectionCount: clampDetailSectionCount(event.target.value),
                }))
              }
            >
              {detailSectionCountOptions.map((count) => (
                <option key={count} value={count}>
                  {count} 张
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">设为 0 张时只保留头图，不规划、不生成、不导出详情页。</p>
          </div>
          <div className="space-y-2">
            <Label>详情图比例</Label>
            <select
              className="flex h-10 w-full rounded-xl border border-input bg-white px-3 text-sm dark:bg-black/30 dark:text-slate-100"
              value={formState.imageAspectRatio}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  imageAspectRatio: event.target.value === "3:4" ? "3:4" : "9:16",
                }))
              }
            >
              <option value="9:16">9:16</option>
              <option value="3:4">3:4</option>
            </select>
          </div>
        </div>

        <OutputConfigSummary config={formState} />

        <div className="flex justify-end">
          <Button onClick={saveConfig} disabled={saving || !hasChanges} className="rounded-xl">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            保存输出配置
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
