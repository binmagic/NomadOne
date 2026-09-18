/**
 * [INPUT]: 依赖 zod
 * [OUTPUT]: 对外提供 forbiddenWordValueSchema、createForbiddenWordsSchema、updateForbiddenWordSchema
 * [POS]: lib/validations 的违禁词入参闸门，被 app/api/forbidden-words/* 与表单共用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

export const forbiddenWordValueSchema = z
  .string()
  .trim()
  .min(1, "请填写违禁词")
  .max(40, "违禁词过长")
  .regex(/^[^\n\r]+$/, "违禁词不能包含换行");

export const createForbiddenWordsSchema = z
  .object({
    word: forbiddenWordValueSchema.optional(),
    words: z.array(forbiddenWordValueSchema).max(200, "一次最多添加 200 个").optional(),
  })
  .refine((value) => Boolean(value.word) || (value.words && value.words.length > 0), {
    message: "请填写违禁词",
  });

export const updateForbiddenWordSchema = z.object({
  word: forbiddenWordValueSchema,
});
