import { withAuthedUser } from "@/lib/auth/session";
import { deleteAssetRecord } from "@/lib/storage/asset-manager";
import { assertAssetOwned } from "@/lib/services/project-service";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  try {
    return await withAuthedUser(async (user) => {
      await assertAssetOwned(context.params.id, user.id);
      const asset = await deleteAssetRecord(context.params.id);
      return ok(asset);
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
