/**
 * [INPUT]: 依赖 prisma AppSettings 单行
 * [OUTPUT]: 对外提供 isRegisterAllowed / getAppSettings / getModelTimeoutMs / resolveModelTimeoutMs / updateAppSettings
 * [POS]: 工作区级开关。开放注册与模型超时都写在这一行；公开注册读这里，OWNER 后台写这里，适配器读超时
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { prisma } from "@/lib/db/prisma";
import { MODEL_TIMEOUT_MS_DEFAULT } from "@/lib/validations/settings";

const SETTINGS_ID = "default";

export async function getAppSettings() {
  const existing = await prisma.appSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  if (existing) {
    return existing;
  }

  return prisma.appSettings.create({
    data: {
      id: SETTINGS_ID,
      allowRegister: false,
      modelTimeoutMs: MODEL_TIMEOUT_MS_DEFAULT,
    },
  });
}

export async function isRegisterAllowed() {
  const settings = await getAppSettings();
  return settings.allowRegister;
}

export async function getModelTimeoutMs() {
  const settings = await getAppSettings();
  return settings.modelTimeoutMs;
}

export async function resolveModelTimeoutMs(override?: number) {
  const configured = await getModelTimeoutMs();
  if (typeof override === "number" && Number.isFinite(override) && override > 0) {
    return Math.max(override, configured);
  }
  return configured;
}

export async function updateAppSettings(patch: { allowRegister?: boolean; modelTimeoutMs?: number }) {
  return prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      allowRegister: patch.allowRegister ?? false,
      modelTimeoutMs: patch.modelTimeoutMs ?? MODEL_TIMEOUT_MS_DEFAULT,
    },
    update: patch,
  });
}
