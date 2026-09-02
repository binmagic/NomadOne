import { NextRequest } from "next/server";

import { withAuthedUser } from "@/lib/auth/session";
import { updateAnalysis } from "@/lib/services/analysis-service";
import { assertProjectOwned } from "@/lib/services/project-service";
import { analysisPatchSchema } from "@/lib/validations/analysis";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  try {
    return await withAuthedUser(async (user) => {
      await assertProjectOwned(context.params.id, user.id);
      const input = analysisPatchSchema.parse(await request.json());
      const analysis = await updateAnalysis(context.params.id, input.normalizedResult);
      return ok(analysis);
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
