import { NextRequest } from "next/server";
import { z } from "zod";

import { withAuthedUser } from "@/lib/auth/session";
import { readProviderCredentialsFromRequest, withProviderCredentials } from "@/lib/services/provider-runtime";
import { createBatchCreateTask } from "@/lib/services/workflow-task-service";
import { handleRouteError, ok } from "@/lib/utils/route";

const batchFileSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  base64Data: z.string().min(1),
});

const requestSchema = z.object({
  files: z.array(batchFileSchema).min(1).max(30),
  autoGenerateImages: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    return await withAuthedUser(async (user) => {
      return withProviderCredentials(request, async () => {
        const input = requestSchema.parse(await request.json());
        const task = await createBatchCreateTask(input, readProviderCredentialsFromRequest(request), user);
        return ok(task, { status: 202 });
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
