import { NextRequest } from "next/server";
import { z } from "zod";

import { withAuthedUser } from "@/lib/auth/session";
import { assertProjectOwned } from "@/lib/services/project-service";
import { readProviderCredentialsFromRequest, withProviderCredentials } from "@/lib/services/provider-runtime";
import { createTranslatePageTask } from "@/lib/services/workflow-task-service";
import { contentLanguageOptions } from "@/lib/utils/content-language";
import { handleRouteError, ok } from "@/lib/utils/route";

const requestSchema = z.object({
  targetLanguage: z.enum(contentLanguageOptions),
  referenceAssetIds: z.array(z.string()).optional().default([]),
});

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  try {
    return await withAuthedUser(async (user) => {
      await assertProjectOwned(context.params.id, user.id);
      return withProviderCredentials(request, async () => {
        const input = requestSchema.parse(await request.json().catch(() => ({})));
        const task = await createTranslatePageTask(
          {
            projectId: context.params.id,
            targetLanguage: input.targetLanguage,
            referenceAssetIds: input.referenceAssetIds,
          },
          readProviderCredentialsFromRequest(request),
          user,
        );
        return ok(task, { status: 202 });
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
