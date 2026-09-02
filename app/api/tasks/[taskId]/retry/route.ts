import { NextRequest } from "next/server";

import { withAuthedUser } from "@/lib/auth/session";
import { getOwnedTask } from "@/lib/services/task-service";
import { readProviderCredentialsFromRequest, withProviderCredentials } from "@/lib/services/provider-runtime";
import { retryWorkflowTask } from "@/lib/services/workflow-task-service";
import { fail, handleRouteError, ok } from "@/lib/utils/route";

export async function POST(request: NextRequest, context: { params: { taskId: string } }) {
  try {
    return await withAuthedUser(async (user) => {
      const owned = await getOwnedTask(context.params.taskId, user.id);
      if (!owned) {
        return fail("NOT_FOUND", "Task not found.", null, 404);
      }
      return withProviderCredentials(request, async () => {
        const task = await retryWorkflowTask(
          context.params.taskId,
          readProviderCredentialsFromRequest(request),
          user,
        );
        return ok(task, { status: 202 });
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
