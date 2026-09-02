import { NextRequest } from "next/server";
import { z } from "zod";

import { withAuthedUser } from "@/lib/auth/session";
import { planSections } from "@/lib/services/planner-service";
import { assertProjectOwned } from "@/lib/services/project-service";
import { withProviderCredentials } from "@/lib/services/provider-runtime";
import { contentLanguageOptions } from "@/lib/utils/content-language";
import { handleRouteError, ok } from "@/lib/utils/route";

const planRequestSchema = z.object({
  modelId: z.string().optional().nullable(),
  autoDecideCounts: z.boolean().optional(),
  previewConfig: z
    .object({
      heroImageCount: z.number().int().min(3).max(5),
      detailSectionCount: z.number().int().min(4).max(10),
      imageAspectRatio: z.enum(["3:4", "9:16"]),
      contentLanguage: z.enum(contentLanguageOptions),
    })
    .optional(),
});

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  try {
    return await withAuthedUser(async (user) => {
      await assertProjectOwned(context.params.id, user.id);
      return withProviderCredentials(request, async () => {
        const input = planRequestSchema.parse(await request.json().catch(() => ({})));
        const result = await planSections(context.params.id, {
          modelId: input.modelId,
          autoDecideCounts: input.autoDecideCounts,
          previewConfig: input.previewConfig,
        });
        return ok(result);
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
