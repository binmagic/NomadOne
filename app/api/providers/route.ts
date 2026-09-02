import { z } from "zod";
import { NextRequest } from "next/server";

import { withAuthedUser } from "@/lib/auth/session";
import {
  activateProviderConfig,
  getAllProviderConfigs,
  resolveProviderConnectionInput,
  saveProviderConfig,
} from "@/lib/services/provider-service";
import {
  getLockedBaseUrl,
  isBaseUrlLocked,
  withProviderCredentials,
} from "@/lib/services/provider-runtime";
import { providerSaveSchema } from "@/lib/validations/provider";
import { handleRouteError, ok } from "@/lib/utils/route";

const providerActivateSchema = z.object({
  providerId: z.string().min(1, "请选择要切换的历史服务"),
});

function providerRuntimeConfig() {
  return {
    baseUrlLocked: isBaseUrlLocked(),
    lockedBaseUrl: getLockedBaseUrl() || null,
  };
}

export async function GET() {
  try {
    return await withAuthedUser(async (user) => {
      const providers = await getAllProviderConfigs(user.id);
      return ok({ providers, runtime: providerRuntimeConfig() });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return await withAuthedUser(async (user) => {
      return withProviderCredentials(request, async () => {
        const parsed = providerSaveSchema.parse(await request.json());
        const resolved = await resolveProviderConnectionInput(parsed);
        const savedProviderId = await saveProviderConfig(
          {
            ...parsed,
            baseUrl: resolved.baseUrl,
            apiKey: resolved.apiKey,
          },
          user.id,
        );
        const providers = await getAllProviderConfigs(user.id);
        return ok({
          savedProviderId,
          providers,
          runtime: providerRuntimeConfig(),
        });
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    return await withAuthedUser(async (user) => {
      const parsed = providerActivateSchema.parse(await request.json());
      const providers = await activateProviderConfig(parsed.providerId, user.id);
      return ok({ providers, runtime: providerRuntimeConfig() });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
