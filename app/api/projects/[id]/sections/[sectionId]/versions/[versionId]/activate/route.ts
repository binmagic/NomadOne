import { withAuthedUser } from "@/lib/auth/session";
import { activateSectionVersion } from "@/lib/services/generation-service";
import { assertProjectOwned } from "@/lib/services/project-service";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function PATCH(
  _request: Request,
  context: { params: { id: string; sectionId: string; versionId: string } },
) {
  try {
    return await withAuthedUser(async (user) => {
      await assertProjectOwned(context.params.id, user.id);
      const version = await activateSectionVersion(context.params.sectionId, context.params.versionId);
      return ok(version);
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
