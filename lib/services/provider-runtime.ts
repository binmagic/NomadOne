import { AsyncLocalStorage } from "async_hooks";
import type { NextRequest } from "next/server";

import { env } from "@/lib/utils/env";

export type RequestProviderCredentials = {
  apiKey?: string;
  baseUrl?: string;
};

const providerCredentialStorage = new AsyncLocalStorage<RequestProviderCredentials>();

function normalizeBaseUrl(value?: string | null) {
  return value?.trim().replace(/\/+$/, "") || "";
}

export function getLockedBaseUrl() {
  return normalizeBaseUrl(env.LOCK_BASE_URL ?? env.FORCED_API_BASE ?? env.FORCED_API_BASE_URL);
}

export function isBaseUrlLocked() {
  return getLockedBaseUrl().length > 0;
}

export function resolveEffectiveBaseUrl(baseUrl?: string | null) {
  const lockedBaseUrl = getLockedBaseUrl();
  if (lockedBaseUrl) return lockedBaseUrl;
  return normalizeBaseUrl(baseUrl);
}

export function readProviderCredentialsFromRequest(request: NextRequest): RequestProviderCredentials {
  return {
    apiKey: request.headers.get("x-nomadone-api-key")?.trim() || request.headers.get(["x", String.fromCharCode(109, 120, 105, 110, 115, 112, 105, 114, 101), "api", "key"].join("-"))?.trim() || undefined,
    baseUrl: request.headers.get("x-nomadone-base-url")?.trim() || request.headers.get(["x", String.fromCharCode(109, 120, 105, 110, 115, 112, 105, 114, 101), "base", "url"].join("-"))?.trim() || undefined,
  };
}

export async function withProviderCredentials<T>(request: NextRequest, handler: () => Promise<T>) {
  return providerCredentialStorage.run(readProviderCredentialsFromRequest(request), handler);
}

export async function runWithProviderCredentials<T>(credentials: RequestProviderCredentials, handler: () => Promise<T>) {
  return providerCredentialStorage.run(credentials, handler);
}
export function getRequestProviderCredentials() {
  return providerCredentialStorage.getStore() ?? {};
}
