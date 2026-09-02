import { NextRequest } from "next/server";
import { z } from "zod";

import { xiaohongshuPlanSchema } from "@/lib/ai/schemas/xiaohongshu";
import { withAuthedUser } from "@/lib/auth/session";
import { readProviderCredentialsFromRequest, withProviderCredentials } from "@/lib/services/provider-runtime";
import { createXiaohongshuGenerateTask } from "@/lib/services/workflow-task-service";
import { handleRouteError, ok } from "@/lib/utils/route";

const requestSchema = z.object({
  plan: xiaohongshuPlanSchema,
  imageAspectRatio: z.enum(["1:1", "3:4", "9:16"]).default("3:4"),
  referenceImages: z
    .preprocess((value) => {
      if (!Array.isArray(value)) return [];
      return value
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && "dataUrl" in item) {
            return String((item as { dataUrl?: unknown }).dataUrl ?? "");
          }
          return "";
        })
        .filter(Boolean);
    }, z.array(z.string().min(1)).max(4))
    .default([]),
});

export async function POST(request: NextRequest) {
  try {
    return await withAuthedUser(async (user) => {
      return withProviderCredentials(request, async () => {
        const input = requestSchema.parse(await request.json());
        const task = await createXiaohongshuGenerateTask(input, readProviderCredentialsFromRequest(request), user);
        return ok(task, { status: 202 });
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
