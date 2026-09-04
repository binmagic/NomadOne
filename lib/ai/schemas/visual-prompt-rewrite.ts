/**
 * [INPUT]: 依赖 zod
 * [OUTPUT]: 对外提供 visualPromptRewriteSchema，约束单模块双语 visualPrompt 重写出口
 * [POS]: lib/ai/schemas 的规划旁路 schema，与 visual-prompt.ts 的生图 Agent 长 prompt 不是同一层
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { z } from "zod";

export const visualPromptRewriteSchema = z.object({
  visualPrompt: z.string().min(20),
});

export type VisualPromptRewriteResult = z.infer<typeof visualPromptRewriteSchema>;
