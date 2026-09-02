/**
 * [INPUT]: 依赖 async_hooks 的 AsyncLocalStorage，依赖 UserProfile
 * [OUTPUT]: 对外提供 withUser / getRequestUser / getRequestUserId
 * [POS]: lib/auth 的请求用户上下文。生成栈通过 ALS 取当前用户，避免逐层改签名
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { AsyncLocalStorage } from "async_hooks";

import type { UserProfile } from "@/types/domain";

const userStorage = new AsyncLocalStorage<UserProfile>();

export function withUser<T>(user: UserProfile, handler: () => T | Promise<T>) {
  return userStorage.run(user, handler);
}

export function getRequestUser() {
  return userStorage.getStore();
}

export function getRequestUserId() {
  return userStorage.getStore()?.id;
}
