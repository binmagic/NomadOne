/**
 * [INPUT]: 依赖 zod
 * [OUTPUT]: 对外提供 appSettingsUpdateSchema
 * [POS]: validations 的工作区设置契约，被 /api/settings PATCH 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

export const appSettingsUpdateSchema = z.object({
  allowRegister: z.boolean(),
});
