/**
 * [INPUT]: 依赖 validations/auth 的 username/password 契约
 * [OUTPUT]: 对外提供 userCreateSchema、userUpdateSchema
 * [POS]: validations 的管理员用户契约，被 /api/users 消费；注册仍走 auth.ts
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

import { passwordSchema, usernameSchema } from "@/lib/validations/auth";

export const displayNameSchema = z.string().trim().min(1, "请输入显示名称").max(48, "显示名称最多 48 个字符");

export const userCreateSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
});

export const userUpdateSchema = z.object({
  displayName: displayNameSchema.optional(),
  password: passwordSchema.optional(),
  isEnabled: z.boolean().optional(),
});
