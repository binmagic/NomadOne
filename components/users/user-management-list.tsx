/**
 * [INPUT]: 依赖 /api/users、UserFormDialog 与 ConfirmDialog
 * [OUTPUT]: 对外提供 UserManagementList，完成成员增删改与启停
 * [POS]: components/users 的主工作台，自带卡片标题行与新增按钮，被 settings/users 页面挂进 Card
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

"use client";

import { useMemo, useState } from "react";
import { Ban, Lock, Pencil, Plus, ShieldCheck, Trash2, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserFormDialog, type UserFormValues } from "@/components/users/user-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { UserRole } from "@/types/domain";

export type ManagedUser = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  isEnabled: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type FormState = {
  mode: "create" | "edit";
  userId?: string;
  values: UserFormValues;
};

const emptyFormValues: UserFormValues = {
  username: "",
  displayName: "",
  password: "",
};

export function UserManagementList({ initialUsers }: { initialUsers: ManagedUser[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [formState, setFormState] = useState<FormState | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDisable, setPendingDisable] = useState<ManagedUser | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ManagedUser | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const sortedUsers = useMemo(
    () => [...users].sort((left, right) => Number(right.role === "OWNER") - Number(left.role === "OWNER")),
    [users],
  );

  const upsertUser = (user: ManagedUser) => {
    setUsers((current) => {
      const exists = current.some((item) => item.id === user.id);
      if (!exists) {
        return [user, ...current];
      }
      return current.map((item) => (item.id === user.id ? user : item));
    });
  };

  const handleSubmit = async (values: UserFormValues) => {
    if (!formState) {
      return;
    }

    setFormLoading(true);
    setFormError(null);

    try {
      if (formState.mode === "create") {
        const response = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: values.username,
            displayName: values.displayName,
            password: values.password,
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error?.message ?? "用户创建失败");
        }
        upsertUser(payload.data.user);
        toast.success("用户已创建");
      } else if (formState.userId) {
        const response = await fetch(`/api/users/${formState.userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: values.displayName,
            ...(values.password ? { password: values.password } : {}),
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error?.message ?? "用户更新失败");
        }
        upsertUser(payload.data.user);
        toast.success("用户已更新");
      }

      setFormState(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (!pendingDisable) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/users/${pendingDisable.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !pendingDisable.isEnabled }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "更新用户状态失败");
      }
      upsertUser(payload.data.user);
      toast.success(pendingDisable.isEnabled ? "用户已禁用" : "用户已启用");
      setPendingDisable(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新用户状态失败");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/users/${pendingDelete.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "删除用户失败");
      }
      setUsers((current) => current.filter((item) => item.id !== pendingDelete.id));
      toast.success("用户已删除");
      setPendingDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除用户失败");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <CardHeader className="flex-row items-center justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>用户列表</CardTitle>
          <CardDescription>系统用户优先展示，其余按创建时间排列。</CardDescription>
        </div>
        <Button
          className="shrink-0"
          onClick={() => {
            setFormError(null);
            setFormState({ mode: "create", values: emptyFormValues });
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          新增用户
        </Button>
      </CardHeader>

      <CardContent>
      {sortedUsers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-8 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]">
          还没有用户。请先完成系统初始化。
        </div>
      ) : (
        <div className="space-y-3">
          {sortedUsers.map((user) => {
            const isOwner = user.role === "OWNER";
            return (
              <article
                key={user.id}
                className="flex flex-col gap-4 rounded-[24px] border border-border bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04] md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-950 dark:text-white">{user.displayName}</h3>
                    <span className="text-sm text-slate-500 dark:text-slate-400">@{user.username}</span>
                    {isOwner ? (
                      <Badge variant="outline" className="gap-1">
                        <Lock className="h-3 w-3" />
                        系统用户
                      </Badge>
                    ) : (
                      <Badge variant="outline">成员</Badge>
                    )}
                    <Badge variant={user.isEnabled ? "success" : "destructive"}>
                      {user.isEnabled ? "已启用" : "已禁用"}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">创建于 {formatDate(user.createdAt)}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isOwner ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500">系统初始化用户不允许修改</p>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFormError(null);
                          setFormState({
                            mode: "edit",
                            userId: user.id,
                            values: {
                              username: user.username,
                              displayName: user.displayName,
                              password: "",
                            },
                          });
                        }}
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        编辑
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setPendingDisable(user)}>
                        {user.isEnabled ? (
                          <>
                            <Ban className="mr-1.5 h-3.5 w-3.5" />
                            禁用
                          </>
                        ) : (
                          <>
                            <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                            启用
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-300 dark:hover:bg-rose-500/10"
                        onClick={() => setPendingDelete(user)}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        删除
                      </Button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      </CardContent>

      <UserFormDialog
        open={Boolean(formState)}
        mode={formState?.mode ?? "create"}
        loading={formLoading}
        initialValues={formState?.values ?? emptyFormValues}
        error={formError}
        onCancel={() => {
          if (!formLoading) {
            setFormState(null);
            setFormError(null);
          }
        }}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(pendingDisable)}
        loading={actionLoading}
        title={pendingDisable?.isEnabled ? "禁用这个用户？" : "重新启用这个用户？"}
        description={
          pendingDisable?.isEnabled
            ? `禁用后，${pendingDisable.displayName} 将无法登录工作区。系统初始化用户不受此操作影响。`
            : `启用后，${pendingDisable?.displayName ?? "该用户"} 可重新登录工作区。`
        }
        confirmText={pendingDisable?.isEnabled ? "确认禁用" : "确认启用"}
        cancelText="取消"
        destructive={Boolean(pendingDisable?.isEnabled)}
        icon={pendingDisable?.isEnabled ? <Ban className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
        onCancel={() => {
          if (!actionLoading) {
            setPendingDisable(null);
          }
        }}
        onConfirm={handleToggleEnabled}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        loading={actionLoading}
        title="删除这个用户？"
        description={`将永久删除 ${pendingDelete?.displayName ?? "该用户"}，此操作不可恢复。系统初始化用户不能删除。`}
        confirmText="确认删除"
        cancelText="取消"
        destructive
        icon={<Trash2 className="h-5 w-5" />}
        onCancel={() => {
          if (!actionLoading) {
            setPendingDelete(null);
          }
        }}
        onConfirm={handleDelete}
      />
    </>
  );
}
