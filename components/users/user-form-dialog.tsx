/**
 * [INPUT]: 依赖门户弹层、ui/button input label、validations/user 与 auth 的字段契约
 * [OUTPUT]: 对外提供 UserFormDialog，覆盖新建与编辑成员；提交前按字段拦截空值与格式
 * [POS]: components/users 的表单入口，被 UserManagementList 打开；字段错误停在输入旁，不把空表单打到 API
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, UserPlus } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordSchema } from "@/lib/validations/auth";
import { displayNameSchema, userCreateSchema } from "@/lib/validations/user";

export type UserFormValues = {
  username: string;
  displayName: string;
  password: string;
};

type FieldKey = keyof UserFormValues;
type FieldErrors = Partial<Record<FieldKey, string>>;

const userEditFormSchema = z.object({
  displayName: displayNameSchema,
  password: z.union([z.literal(""), passwordSchema]),
});

function readFieldErrors(error: z.ZodError): FieldErrors {
  const flattened = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  return {
    username: flattened.username?.[0],
    displayName: flattened.displayName?.[0],
    password: flattened.password?.[0],
  };
}

function validateUserForm(mode: "create" | "edit", values: UserFormValues): FieldErrors | null {
  const parsed = mode === "create" ? userCreateSchema.safeParse(values) : userEditFormSchema.safeParse(values);
  if (parsed.success) {
    return null;
  }

  const errors = readFieldErrors(parsed.error);
  if (mode === "create" && !values.username.trim()) {
    errors.username = "请输入用户名";
  }
  if (!values.displayName.trim()) {
    errors.displayName = "请输入显示名称";
  }
  if (mode === "create" && !values.password) {
    errors.password = "请输入密码";
  }
  return errors;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p id={id} className="text-sm text-rose-600 dark:text-rose-300">
      {message}
    </p>
  );
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-rose-500">
      *
    </span>
  );
}

export function UserFormDialog({
  open,
  mode,
  loading,
  initialValues,
  error,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  loading: boolean;
  initialValues: UserFormValues;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: UserFormValues) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setFieldErrors({});
    }
  }, [open, initialValues]);

  if (!mounted || !open) {
    return null;
  }

  const isCreate = mode === "create";
  const Icon = isCreate ? UserPlus : Pencil;

  const updateField = (field: FieldKey) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="关闭用户表单"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={() => {
          if (!loading) {
            onCancel();
          }
        }}
      />
      <form
        noValidate
        className="relative z-[121] w-full max-w-lg rounded-[28px] border border-border bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)] dark:border-white/10 dark:bg-[#111214]"
        onSubmit={(event) => {
          event.preventDefault();
          const nextErrors = validateUserForm(mode, values);
          if (nextErrors) {
            setFieldErrors(nextErrors);
            return;
          }
          onSubmit(values);
        }}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-900 dark:bg-white/8 dark:text-slate-100">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
              {isCreate ? "新增用户" : "编辑用户"}
            </h3>
            <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
              {isCreate
                ? "创建普通成员。系统初始化的管理员不会出现在此表单中。"
                : "可修改显示名称和密码。用户名创建后不可更改。"}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-username">
              用户名
              {isCreate ? <RequiredMark /> : null}
            </Label>
            <Input
              id="user-username"
              value={values.username}
              disabled={!isCreate || loading}
              placeholder="例如 operator_01"
              autoComplete="off"
              aria-invalid={Boolean(fieldErrors.username)}
              aria-describedby={fieldErrors.username ? "user-username-error" : undefined}
              className={fieldErrors.username ? "border-rose-400 focus-visible:ring-rose-400" : undefined}
              onChange={updateField("username")}
            />
            <FieldError id="user-username-error" message={fieldErrors.username} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-display-name">
              显示名称
              <RequiredMark />
            </Label>
            <Input
              id="user-display-name"
              value={values.displayName}
              disabled={loading}
              placeholder="例如 运营同学"
              aria-invalid={Boolean(fieldErrors.displayName)}
              aria-describedby={fieldErrors.displayName ? "user-display-name-error" : undefined}
              className={fieldErrors.displayName ? "border-rose-400 focus-visible:ring-rose-400" : undefined}
              onChange={updateField("displayName")}
            />
            <FieldError id="user-display-name-error" message={fieldErrors.displayName} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-password">
              {isCreate ? "密码" : "新密码"}
              {isCreate ? <RequiredMark /> : null}
            </Label>
            <Input
              id="user-password"
              type="password"
              value={values.password}
              disabled={loading}
              placeholder={isCreate ? "至少 8 位" : "留空则不修改密码"}
              autoComplete="new-password"
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "user-password-error" : undefined}
              className={fieldErrors.password ? "border-rose-400 focus-visible:ring-rose-400" : undefined}
              onChange={updateField("password")}
            />
            <FieldError id="user-password-error" message={fieldErrors.password} />
          </div>
          {error ? <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading} className="rounded-xl">
            取消
          </Button>
          <Button type="submit" disabled={loading} className="rounded-xl">
            {loading ? "保存中..." : isCreate ? "创建用户" : "保存修改"}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
