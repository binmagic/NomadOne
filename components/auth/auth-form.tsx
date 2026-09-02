/**
 * [INPUT]: 依赖 Card/Input/Label/Button、sonner、/api/auth/*
 * [OUTPUT]: 对外提供 LoginForm / SetupForm / RegisterForm
 * [POS]: components/auth 的登录表单岛，被 (auth) 页面消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthFormMode = "login" | "setup" | "register";

const copy: Record<AuthFormMode, { title: string; description: string; submit: string; endpoint: string }> = {
  login: {
    title: "登录 MxPage",
    description: "使用本地账号进入你的商品图文工作台。",
    submit: "登录",
    endpoint: "/api/auth/login",
  },
  setup: {
    title: "创建管理员账号",
    description: "这是此工作区的第一个账号，将接管现有项目与配置。",
    submit: "完成初始化",
    endpoint: "/api/auth/setup",
  },
  register: {
    title: "注册账号",
    description: "创建你自己的工作区。项目与 AI 配置与其他用户隔离。",
    submit: "注册并进入",
    endpoint: "/api/auth/register",
  },
};

export function AuthForm({ mode, allowRegister = false }: { mode: AuthFormMode; allowRegister?: boolean }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const meta = copy[mode];

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const body: Record<string, string> = { username, password };
      if (mode !== "login") {
        body.displayName = displayName;
        body.confirmPassword = confirmPassword;
      }
      const response = await fetch(meta.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error?.message ?? `${meta.submit}失败`);
      }
      toast.success(mode === "login" ? "已登录" : "账号已就绪");
      router.push("/");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `${meta.submit}失败`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <p className="text-xs font-medium uppercase tracking-[0.26em] text-slate-500">MxPage</p>
        <CardTitle className="text-3xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
          {meta.title}
        </CardTitle>
        <CardDescription>{meta.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>
          {mode !== "login" ? (
            <div className="space-y-2">
              <Label htmlFor="displayName">显示名（可选）</Label>
              <Input
                id="displayName"
                autoComplete="nickname"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {mode !== "login" ? (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </div>
          ) : null}
          <Button type="submit" className="h-11 w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {meta.submit}
          </Button>
          {mode === "login" && allowRegister ? (
            <p className="text-center text-sm text-slate-500">
              还没有账号？{" "}
              <a href="/register" className="font-medium text-slate-900 underline-offset-4 hover:underline dark:text-white">
                注册
              </a>
            </p>
          ) : null}
          {mode === "register" ? (
            <p className="text-center text-sm text-slate-500">
              已有账号？{" "}
              <a href="/login" className="font-medium text-slate-900 underline-offset-4 hover:underline dark:text-white">
                登录
              </a>
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
