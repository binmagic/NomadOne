/**
 * [INPUT]: 无业务依赖
 * [OUTPUT]: 登录/注册/初始化页的居中壳；强制动态渲染，禁止把「空库→/setup」编进静态 HTML
 * [POS]: app/(auth) 的布局。子页按用户数 redirect，静态缓存会在 setup 后与 /login 互跳把站点打挂
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
