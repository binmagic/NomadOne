/**
 * [INPUT]: 依赖 prisma AppSettings 单行
 * [OUTPUT]: 对外提供 isRegisterAllowed / getAppSettings / setAllowRegister
 * [POS]: 工作区级开关，取代 ALLOW_REGISTER 环境变量；公开注册读这里，OWNER 后台写这里
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { prisma } from "@/lib/db/prisma";

const SETTINGS_ID = "default";

export async function getAppSettings() {
  const existing = await prisma.appSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  if (existing) {
    return existing;
  }

  return prisma.appSettings.create({
    data: { id: SETTINGS_ID, allowRegister: false },
  });
}

export async function isRegisterAllowed() {
  const settings = await getAppSettings();
  return settings.allowRegister;
}

export async function setAllowRegister(allowRegister: boolean) {
  return prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, allowRegister },
    update: { allowRegister },
  });
}
