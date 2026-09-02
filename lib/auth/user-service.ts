/**
 * [INPUT]: 依赖 prisma User/Project/ProviderConfig，依赖 scrypt 哈希与 AuthError
 * [OUTPUT]: 对外提供用户计数、创建 OWNER/MEMBER、登录校验、孤儿数据归户
 * [POS]: lib/auth 的用户仓储。首个账号即 OWNER，后续默认禁止注册
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { AuthError } from "@/lib/auth/errors";
import { prisma } from "@/lib/db/prisma";
import { isRegisterAllowed } from "@/lib/utils/env";
import type { UserProfile, UserRole } from "@/types/domain";

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function toProfile(user: { id: string; username: string; displayName: string; role: UserRole }): UserProfile {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  };
}

export async function countUsers() {
  return prisma.user.count();
}

export async function createOwner(input: { username: string; displayName?: string; password: string }) {
  const existing = await countUsers();
  if (existing > 0) {
    throw new AuthError("SETUP_COMPLETE", "已完成初始化，请直接登录", 409);
  }

  const username = normalizeUsername(input.username);
  const { salt, hash } = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      username,
      displayName: input.displayName?.trim() || username,
      passwordHash: hash,
      passwordSalt: salt,
      role: "OWNER",
    },
  });

  await backfillOrphans(user.id);
  return toProfile(user);
}

export async function createMember(input: { username: string; displayName?: string; password: string }) {
  if ((await countUsers()) === 0) {
    throw new AuthError("SETUP_REQUIRED", "请先创建管理员账号", 409);
  }
  if (!isRegisterAllowed()) {
    throw new AuthError("REGISTER_DISABLED", "当前未开放注册", 403);
  }

  const username = normalizeUsername(input.username);
  const occupied = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (occupied) {
    throw new AuthError("USERNAME_TAKEN", "用户名已被占用", 409);
  }

  const { salt, hash } = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      username,
      displayName: input.displayName?.trim() || username,
      passwordHash: hash,
      passwordSalt: salt,
      role: "MEMBER",
    },
  });
  return toProfile(user);
}

export async function authenticate(username: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { username: normalizeUsername(username) },
  });
  if (!user) {
    throw new AuthError("INVALID_CREDENTIALS", "用户名或密码错误", 401);
  }

  const matched = await verifyPassword(password, user.passwordSalt, user.passwordHash);
  if (!matched) {
    throw new AuthError("INVALID_CREDENTIALS", "用户名或密码错误", 401);
  }

  return toProfile(user);
}

export async function backfillOrphans(ownerId: string) {
  await prisma.$transaction([
    prisma.project.updateMany({
      where: { userId: null },
      data: { userId: ownerId },
    }),
    prisma.providerConfig.updateMany({
      where: { userId: null },
      data: { userId: ownerId },
    }),
  ]);
}
