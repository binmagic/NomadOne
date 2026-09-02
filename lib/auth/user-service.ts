/**
 * [INPUT]: 依赖 prisma User/Project/ProviderConfig，依赖 scrypt 哈希与 AuthError
 * [OUTPUT]: 对外提供用户计数、创建 OWNER/MEMBER、登录校验、管理员增删改查与启停、孤儿数据归户
 * [POS]: lib/auth 的用户仓储。首个账号即 OWNER 且不可改；管理员可创建成员，无需开放注册
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

export type ManagedUser = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toManaged(user: {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ManagedUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    isEnabled: user.isEnabled,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function assertNotOwner(user: { role: UserRole }) {
  if (user.role === "OWNER") {
    throw new AuthError("SYSTEM_USER_LOCKED", "系统初始化用户不允许修改", 403);
  }
}

async function getManagedOrThrow(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AuthError("NOT_FOUND", "用户不存在", 404);
  }
  return user;
}

async function insertMember(input: { username: string; displayName?: string; password: string }) {
  const username = normalizeUsername(input.username);
  const occupied = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (occupied) {
    throw new AuthError("USERNAME_TAKEN", "用户名已被占用", 409);
  }

  const { salt, hash } = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      username,
      displayName: input.displayName?.trim() || username,
      passwordHash: hash,
      passwordSalt: salt,
      role: "MEMBER",
      isEnabled: true,
    },
  });
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

  const user = await insertMember(input);
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

  if (!user.isEnabled) {
    throw new AuthError("ACCOUNT_DISABLED", "该账号已被禁用", 403);
  }

  return toProfile(user);
}

export async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: [{ createdAt: "asc" }],
  });
  return users
    .map(toManaged)
    .sort((left, right) => Number(right.role === "OWNER") - Number(left.role === "OWNER"));
}

export async function createManagedUser(input: { username: string; displayName?: string; password: string }) {
  if ((await countUsers()) === 0) {
    throw new AuthError("SETUP_REQUIRED", "请先创建管理员账号", 409);
  }

  const user = await insertMember(input);
  return toManaged(user);
}

export async function updateManagedUser(
  id: string,
  input: { displayName?: string; password?: string; isEnabled?: boolean },
) {
  const user = await getManagedOrThrow(id);
  assertNotOwner(user);

  let passwordHash = user.passwordHash;
  let passwordSalt = user.passwordSalt;
  if (input.password) {
    const hashed = await hashPassword(input.password);
    passwordHash = hashed.hash;
    passwordSalt = hashed.salt;
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.password ? { passwordHash, passwordSalt } : {}),
      ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
    },
  });
  return toManaged(updated);
}

export async function deleteManagedUser(id: string) {
  const user = await getManagedOrThrow(id);
  assertNotOwner(user);
  await prisma.user.delete({ where: { id } });
  return toManaged(user);
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
