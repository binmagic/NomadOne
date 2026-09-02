import { withAuthedUser } from "@/lib/auth/session";
import { buildImageArchive } from "@/lib/services/export-service";
import { assertProjectOwned } from "@/lib/services/project-service";
import { handleRouteError } from "@/lib/utils/route";

export async function GET(_request: Request, context: { params: { id: string } }) {
  try {
    return await withAuthedUser(async (user) => {
      await assertProjectOwned(context.params.id, user.id);
      const stream = await buildImageArchive(context.params.id);
      return new Response(stream as never, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${context.params.id}-detail-page-images.zip"`,
        },
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
