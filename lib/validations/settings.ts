/**
 * [INPUT]: 依赖 zod
 * [OUTPUT]: 对外提供 appSettingsUpdateSchema 与模型超时常量
 * [POS]: validations 的工作区设置契约，被 /api/settings PATCH 消费；超时单位毫秒，界面再换成秒
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

export const MODEL_TIMEOUT_MS_DEFAULT = 120_000;
export const MODEL_TIMEOUT_MS_MIN = 15_000;
export const MODEL_TIMEOUT_MS_MAX = 600_000;

export const appSettingsUpdateSchema = z
  .object({
    allowRegister: z.boolean().optional(),
    modelTimeoutMs: z
      .number()
      .int("超时时间必须是整数")
      .min(MODEL_TIMEOUT_MS_MIN, "模型超时至少 15 秒")
      .max(MODEL_TIMEOUT_MS_MAX, "模型超时最多 10 分钟")
      .optional(),
  })
  .refine((value) => value.allowRegister !== undefined || value.modelTimeoutMs !== undefined, {
    message: "请至少提供一项设置",
  });
