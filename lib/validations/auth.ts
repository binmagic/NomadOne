/**
 * [INPUT]: 依赖 zod
 * [OUTPUT]: 对外提供 login / setup / register 校验模式
 * [POS]: lib/validations 的鉴权入参契约，被 /api/auth/* 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "用户名至少 3 个字符")
  .max(32, "用户名最多 32 个字符")
  .regex(/^[a-zA-Z0-9_]+$/, "用户名仅支持字母、数字和下划线");

export const passwordSchema = z.string().min(8, "密码至少 8 个字符").max(128, "密码最多 128 个字符");

export const loginSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

export const setupSchema = z
  .object({
    username: usernameSchema,
    displayName: z.string().trim().max(48).optional(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  });

export const registerSchema = setupSchema;
