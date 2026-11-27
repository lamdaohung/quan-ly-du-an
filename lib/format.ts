import type { Task } from "./types";

const vnd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

export const formatVND = (n: number | null | undefined) => vnd.format(Number(n ?? 0));
export const formatNumber = (n: number) => num.format(n);
export const formatPercent = (n: number) => `${num.format(n)}%`;

/** "2026-11-27" -> "27/11/2026" */
export function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

export function todayISO() {
  const t = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

/** Số ngày giữa 2 chuỗi ngày ISO (b - a) */
export function daysBetween(a: string, b: string) {
  const da = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const db = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((db - da) / 86400000);
}

export function addDays(iso: string, n: number) {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n));
  return d.toISOString().slice(0, 10);
}

/** Đầu việc quá hạn: đã qua due_date mà progress < 100 */
export function isOverdue(t: Pick<Task, "due_date" | "progress">, today = todayISO()) {
  return !!t.due_date && t.due_date.slice(0, 10) < today && Number(t.progress) < 100;
}

export function clampProgress(n: number) {
  return Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
}

/** Tỷ lệ giải ngân (%) */
export function disbursementRate(actual: number, estimated: number) {
  if (!estimated) return actual > 0 ? 100 : 0;
  return (actual / estimated) * 100;
}

export type BudgetLevel = "ok" | "warning" | "over";
export function budgetLevel(rate: number): BudgetLevel {
  if (rate > 100) return "over";
  if (rate > 80) return "warning";
  return "ok";
}

export function errorMessage(e: unknown) {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Đã xảy ra lỗi không xác định";
}
