import { NextRequest } from "next/server";
import { z } from "zod";

import { xiaohongshuPlanSchema } from "@/lib/ai/schemas/xiaohongshu";
import { withAuthedUser } from "@/lib/auth/session";
import { generateXiaohongshuImages } from "@/lib/services/xiaohongshu-service";
import { withProviderCredentials } from "@/lib/services/provider-runtime";
import { handleRouteError, ok } from "@/lib/utils/route";

export const maxDuration = 180;

const requestSchema = z.object({
  plan: xiaohongshuPlanSchema,
  imageAspectRatio: z.enum(["1:1", "3:4", "9:16"]).default("3:4"),
  pageNumber: z.coerce.number().int().min(1).optional(),
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
    return await withAuthedUser(async () => {
      return withProviderCredentials(request, async () => {
        const input = requestSchema.parse(await request.json());
        const images = await generateXiaohongshuImages(input.plan, input.referenceImages ?? [], {
          imageAspectRatio: input.imageAspectRatio,
          pageNumber: input.pageNumber,
        });
        return ok(images);
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
