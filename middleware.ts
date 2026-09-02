/**
 * [INPUT]: 依赖 HMAC 会话 cookie 与 APP_SECRET
 * [OUTPUT]: 未登录页面 302 /login，未登录 API 401；放行 setup/login/register 与静态资源
 * [POS]: 全局门禁。不查库、不算用户数；空库由 /login RSC 转到 /setup
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { NextResponse, type NextRequest } from "next/server";

import { getAppSecret } from "@/lib/auth/secret";
import { SESSION_COOKIE_NAME, verifySessionCookie } from "@/lib/auth/session-cookie";

const PUBLIC_PAGES = ["/login", "/register", "/setup"];
const PUBLIC_APIS = ["/api/auth/login", "/api/auth/register", "/api/auth/setup", "/api/auth/logout"];

function isPublicPath(pathname: string) {
  if (PUBLIC_PAGES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }
  return PUBLIC_APIS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const payload = token ? await verifySessionCookie(token, getAppSecret()) : null;
    if (payload) {
      return NextResponse.next();
    }
  } catch {
    // 密钥缺失或 HMAC 异常一律视为未登录，避免桌面端 GET / 500
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: "UNAUTHORIZED", message: "请先登录" },
      },
      { status: 401 },
    );
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand-icon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
