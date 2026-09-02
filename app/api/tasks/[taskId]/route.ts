import { withAuthedUser } from "@/lib/auth/session";
import { getOwnedTask } from "@/lib/services/task-service";
import { fail, handleRouteError, ok } from "@/lib/utils/route";

export async function GET(_request: Request, context: { params: { taskId: string } }) {
  try {
    return await withAuthedUser(async (user) => {
      const task = await getOwnedTask(context.params.taskId, user.id);
      if (!task) {
        return fail("NOT_FOUND", "Task not found.", null, 404);
      }
      return ok(task);
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
