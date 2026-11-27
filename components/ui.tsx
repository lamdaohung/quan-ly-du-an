"use client";

import { useEffect } from "react";
import type { BudgetLevel } from "@/lib/format";

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`card max-h-[90vh] w-full overflow-y-auto ${wide ? "max-w-2xl" : "max-w-lg"}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Đóng">
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</div>;
}

export function ProgressBar({ value, danger }: { value: number; danger?: boolean }) {
  const color = danger ? "bg-status-critical" : value >= 100 ? "bg-status-good" : "bg-blue-600";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full min-w-10 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-600">{Math.round(value)}%</span>
    </div>
  );
}

const levelStyle: Record<BudgetLevel, { cls: string; icon: string; text: string }> = {
  ok: { cls: "bg-green-50 text-green-700 ring-green-200", icon: "✓", text: "An toàn" },
  warning: { cls: "bg-orange-50 text-orange-700 ring-orange-200", icon: "▲", text: "Vượt 80%" },
  over: { cls: "bg-red-50 text-red-700 ring-red-200", icon: "●", text: "Vượt ngân sách" },
};

export function BudgetBadge({ level }: { level: BudgetLevel }) {
  const s = levelStyle[level];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${s.cls}`}>
      <span aria-hidden>{s.icon}</span>
      {s.text}
    </span>
  );
}

export function Spinner({ label = "Đang tải dữ liệu…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
      {label}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="py-12 text-center text-sm text-slate-500">{text}</div>;
}
