import { NextRequest } from "next/server";

import { withAuthedUser } from "@/lib/auth/session";
import { createSection } from "@/lib/services/planner-service";
import { assertProjectOwned } from "@/lib/services/project-service";
import { sectionInputSchema } from "@/lib/validations/section";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  try {
    return await withAuthedUser(async (user) => {
      await assertProjectOwned(context.params.id, user.id);
      const input = sectionInputSchema.parse(await request.json());
      const section = await createSection(context.params.id, input);
      return ok(section, { status: 201 });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
