import { NextRequest } from "next/server";
import { z } from "zod";

import { withAuthedUser } from "@/lib/auth/session";
import { planXiaohongshuPost } from "@/lib/services/xiaohongshu-service";
import { withProviderCredentials } from "@/lib/services/provider-runtime";
import { handleRouteError, ok } from "@/lib/utils/route";

const requestSchema = z.object({
  topic: z.coerce.string().trim().min(1),
  imageCount: z.coerce.number().int().min(3).max(8).default(5),
  imageAspectRatio: z.enum(["1:1", "3:4", "9:16"]).default("3:4"),
  images: z
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
        const plan = await planXiaohongshuPost(input);
        return ok(plan);
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
