import { withAuthedUser } from "@/lib/auth/session";
import { cancelTask, getOwnedTask } from "@/lib/services/task-service";
import { fail, handleRouteError, ok } from "@/lib/utils/route";

export async function POST(_request: Request, context: { params: { taskId: string } }) {
  try {
    return await withAuthedUser(async (user) => {
      const owned = await getOwnedTask(context.params.taskId, user.id);
      if (!owned) {
        return fail("NOT_FOUND", "Task not found.", null, 404);
      }
      const task = await cancelTask(context.params.taskId);
      return ok(task);
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
