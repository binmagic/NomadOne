import { NextRequest } from "next/server";
import { z } from "zod";

import { withAuthedUser } from "@/lib/auth/session";
import { analyzeProject } from "@/lib/services/analysis-service";
import { assertProjectOwned } from "@/lib/services/project-service";
import { withProviderCredentials } from "@/lib/services/provider-runtime";
import { handleRouteError, ok } from "@/lib/utils/route";

const analyzeRequestSchema = z.object({
  modelId: z.string().optional().nullable(),
});

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  try {
    return await withAuthedUser(async (user) => {
      await assertProjectOwned(context.params.id, user.id);
      return withProviderCredentials(request, async () => {
        const input = analyzeRequestSchema.parse(await request.json().catch(() => ({})));
        const analysis = await analyzeProject(context.params.id, input.modelId);
        return ok(analysis);
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
