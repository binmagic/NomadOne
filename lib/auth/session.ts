/**
 * [INPUT]: 依赖 next/headers cookies、prisma User、HMAC cookie 与 ALS
 * [OUTPUT]: 对外提供 getSessionUser / requireUser / withAuthedUser / 写清会话 cookie
 * [POS]: lib/auth 的 Node 会话门面。Middleware 只验 HMAC；这里再查库，删用户立即失效
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { buildClearSessionCookieOptions, buildSessionCookieOptions } from "@/lib/auth/cookie-options";
import { AuthError } from "@/lib/auth/errors";
import { withUser } from "@/lib/auth/request-user";
import { getAppSecret } from "@/lib/auth/secret";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  createSessionCookieValue,
  verifySessionCookie,
} from "@/lib/auth/session-cookie";
import { prisma } from "@/lib/db/prisma";
import type { UserProfile, UserRole } from "@/types/domain";

function toProfile(user: { id: string; username: string; displayName: string; role: UserRole }): UserProfile {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  };
}

export async function getSessionUser(): Promise<UserProfile | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const payload = await verifySessionCookie(token, getAppSecret());
  if (!payload) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, username: true, displayName: true, role: true },
  });
  if (!user) {
    return null;
  }

  return toProfile(user);
}

export async function requireUser(): Promise<UserProfile> {
  const user = await getSessionUser();
  if (!user) {
    throw new AuthError("UNAUTHORIZED", "请先登录", 401);
  }
  return user;
}

export async function withAuthedUser<T>(handler: (user: UserProfile) => Promise<T>) {
  const user = await requireUser();
  return withUser(user, () => handler(user));
}

export async function applySessionCookie(response: NextResponse, user: UserProfile, request: NextRequest) {
  const value = await createSessionCookieValue(
    {
      v: 1,
      userId: user.id,
      username: user.username,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    },
    getAppSecret(),
  );
  response.cookies.set(SESSION_COOKIE_NAME, value, buildSessionCookieOptions(request));
  return response;
}

export function clearSessionCookie(response: NextResponse, request: NextRequest) {
  response.cookies.set(SESSION_COOKIE_NAME, "", buildClearSessionCookieOptions(request));
  return response;
}
