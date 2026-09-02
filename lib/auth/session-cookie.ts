/**
 * [INPUT]: 依赖 Web Crypto 的 HMAC-SHA256，不依赖 prisma / node:crypto / env.ts
 * [OUTPUT]: 对外提供会话 cookie 名、TTL、签发与校验
 * [POS]: lib/auth 的 Edge 可用会话核，middleware 与 Node 路由共用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { UserRole } from "@/types/domain";

export const SESSION_COOKIE_NAME = "nomadone_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export type SessionPayload = {
  v: 1;
  userId: string;
  username: string;
  role: UserRole;
  exp: number;
};

function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < arr.length; i += 1) {
    binary += String.fromCharCode(arr[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function utf8ToBase64Url(text: string) {
  return bytesToBase64Url(new TextEncoder().encode(text));
}

function base64UrlToUtf8(value: string) {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

async function importHmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSessionCookieValue(payload: SessionPayload, secret: string) {
  const body = utf8ToBase64Url(JSON.stringify(payload));
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${bytesToBase64Url(signature)}`;
}

export async function verifySessionCookie(value: string, secret: string): Promise<SessionPayload | null> {
  const [body, signature] = value.split(".");
  if (!body || !signature) {
    return null;
  }

  try {
    const key = await importHmacKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signature),
      new TextEncoder().encode(body),
    );
    if (!valid) {
      return null;
    }

    const payload = JSON.parse(base64UrlToUtf8(body)) as SessionPayload;
    if (payload.v !== 1 || typeof payload.userId !== "string" || typeof payload.username !== "string") {
      return null;
    }
    if (payload.role !== "OWNER" && payload.role !== "MEMBER") {
      return null;
    }
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
