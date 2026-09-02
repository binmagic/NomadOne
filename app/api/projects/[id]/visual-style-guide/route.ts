import { NextRequest } from "next/server";
import { z } from "zod";

import { withAuthedUser } from "@/lib/auth/session";
import { regenerateVisualStyleGuide } from "@/lib/services/planner-service";
import { assertProjectOwned } from "@/lib/services/project-service";
import { withProviderCredentials } from "@/lib/services/provider-runtime";
import { handleRouteError, ok } from "@/lib/utils/route";

const requestSchema = z.object({
  modelId: z.string().optional().nullable(),
});

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  try {
    return await withAuthedUser(async (user) => {
      await assertProjectOwned(context.params.id, user.id);
      return withProviderCredentials(request, async () => {
        const input = requestSchema.parse(await request.json().catch(() => ({})));
        const result = await regenerateVisualStyleGuide(context.params.id, input.modelId);
        return ok(result);
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
