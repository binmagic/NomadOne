import { NextRequest } from "next/server";
import { z } from "zod";

import { xiaohongshuPageSchema } from "@/lib/ai/schemas/xiaohongshu";
import { withAuthedUser } from "@/lib/auth/session";
import { editXiaohongshuImage } from "@/lib/services/xiaohongshu-service";
import { withProviderCredentials } from "@/lib/services/provider-runtime";
import { handleRouteError, ok } from "@/lib/utils/route";

export const maxDuration = 180;

const requestSchema = z.object({
  imageUrl: z.string().min(1),
  prompt: z.string().min(2),
  imageAspectRatio: z.enum(["1:1", "3:4", "9:16"]).default("3:4"),
  page: xiaohongshuPageSchema.optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    return await withAuthedUser(async () => {
      return withProviderCredentials(request, async () => {
        const input = requestSchema.parse(await request.json());
        const image = await editXiaohongshuImage(input);
        return ok(image);
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
