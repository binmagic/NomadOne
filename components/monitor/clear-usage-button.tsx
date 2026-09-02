/**
 * [INPUT]: 依赖 ConfirmDialog 与 DELETE /api/monitor/usage
 * [OUTPUT]: 对外提供 ClearUsageButton
 * [POS]: monitor 的清空入口，只清当前登录用户自己的记录
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";

export function ClearUsageButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleClear = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/monitor/usage", {
        method: "DELETE",
      });
      const payload = await response.json();

      if (!payload.success) {
        throw new Error(payload.error?.message ?? "删除调用记录失败");
      }

      toast.success("你的调用记录已清空");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除调用记录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="h-10 rounded-xl">
        <Trash2 className="mr-2 h-4 w-4" />
        清空调用记录
      </Button>
      <ConfirmDialog
        open={open}
        loading={loading}
        title="清空你的调用记录？"
        description="只会删除你自己的 API 监控记录，不影响其他用户。操作不可恢复。"
        confirmText="确认清空"
        cancelText="暂不清空"
        destructive
        icon={<Trash2 className="h-5 w-5" />}
        onCancel={() => {
          if (!loading) {
            setOpen(false);
          }
        }}
        onConfirm={handleClear}
      />
    </>
  );
}
