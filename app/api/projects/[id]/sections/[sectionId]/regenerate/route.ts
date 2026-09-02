import { NextRequest } from "next/server";

import { withAuthedUser } from "@/lib/auth/session";
import { regenerateSectionImage } from "@/lib/services/generation-service";
import { assertProjectOwned } from "@/lib/services/project-service";
import { withProviderCredentials } from "@/lib/services/provider-runtime";
import { generationRequestSchema } from "@/lib/validations/generation";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function POST(
  request: NextRequest,
  context: { params: { id: string; sectionId: string } },
) {
  try {
    return await withAuthedUser(async (user) => {
      await assertProjectOwned(context.params.id, user.id);
      return withProviderCredentials(request, async () => {
        const input = generationRequestSchema.parse(await request.json().catch(() => ({})));
        const result = await regenerateSectionImage(
          context.params.id,
          context.params.sectionId,
          input.modelId,
          input.referenceAssetIds,
        );
        return ok(result);
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
