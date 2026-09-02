import { NextRequest } from "next/server";
import { z } from "zod";

import { withAuthedUser } from "@/lib/auth/session";
import { normalizeDetectedModels } from "@/lib/ai/capability-detector";
import { discoverProviderModels } from "@/lib/services/provider-service";
import { withProviderCredentials } from "@/lib/services/provider-runtime";
import { providerInputSchema } from "@/lib/validations/provider";
import { handleRouteError, ok } from "@/lib/utils/route";

const detectSchema = z.union([
  providerInputSchema,
  z.object({
    models: z.array(
      z.object({
        id: z.string(),
        label: z.string().optional(),
      }),
    ),
  }),
]);

export async function POST(request: NextRequest) {
  try {
    return await withAuthedUser(async () => {
      return withProviderCredentials(request, async () => {
        const input = detectSchema.parse(await request.json());
        const result =
          "models" in input
            ? { models: normalizeDetectedModels(input.models) }
            : await discoverProviderModels(input);
        return ok(result);
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
