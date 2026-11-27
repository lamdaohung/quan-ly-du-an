"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import type { Expense } from "@/lib/types";
import { budgetLevel, disbursementRate, errorMessage, formatDate, formatPercent, formatVND, projectBudget, todayISO } from "@/lib/format";
import { ProjectModal } from "@/components/forms";
import type { Project } from "@/lib/types";
import { BudgetBadge, EmptyState, ErrorBox, Modal, PageHeader, Spinner } from "@/components/ui";

type ModalState =
  | { kind: "none" }
  | { kind: "new" } // Admin: thêm hạng mục dự toán; Member: thêm chi phí phát sinh
  | { kind: "edit"; expense: Expense }
  | { kind: "actual"; expense: Expense }; // nhập thực chi

function rateColor(rate: number) {
  const lv = budgetLevel(rate);
  return lv === "over" ? "bg-status-critical" : lv === "warning" ? "bg-status-serious" : "bg-blue-600";
}

export default function BudgetPage() {
  const { isAdmin } = useAuth();
  const { projects, expenses, loading, error, refresh } = useData();
  const [selected, setSelected] = useState<string>("");
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [editProject, setEditProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!selected && projects.length) setSelected(projects[0].id);
  }, [projects, selected]);

  const summaries = useMemo(
    () =>
      projects.map((p) => {
        const rows = expenses.filter((e) => e.project_id === p.id);
        const itemsEst = rows.reduce((s, e) => s + e.estimated_amount, 0);
        const est = projectBudget(p.total_budget, itemsEst);
        const act = rows.reduce((s, e) => s + e.actual_amount, 0);
        const rate = disbursementRate(act, est);
        return { project: p, rows, itemsEst, est, act, rate, level: budgetLevel(rate), hasTotal: Number(p.total_budget) > 0 };
      }),
    [projects, expenses]
  );

  const current = summaries.find((s) => s.project.id === selected);
  const grand = summaries.reduce((a, s) => ({ est: a.est + s.est, act: a.act + s.act }), { est: 0, act: 0 });

  async function toggleApprove(e: Expense) {
    setActionError(null);
    const { error } = await supabase.from("expenses").update({ approved: !e.approved }).eq("id", e.id);
    if (error) setActionError(error.message);
    else refresh();
  }

  async function remove(e: Expense) {
    if (!confirm(`Xoá hạng mục "${e.item_name}"?`)) return;
    const { error } = await supabase.from("expenses").delete().eq("id", e.id);
    if (error) setActionError(error.message);
    else refresh();
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Quản lý ngân sách"
        subtitle="So sánh Dự toán và Thực chi theo từng hạng mục, theo dõi tỷ lệ giải ngân của từng dự án."
      />
      <ErrorBox message={error ?? actionError} />

      {/* Tổng quan các dự án */}
      <div className="card mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Tổng quan ngân sách các dự án</h2>
          <p className="text-xs text-slate-500">
            Tổng ngân sách <b className="text-slate-800">{formatVND(grand.est)}</b> · Tổng thực chi{" "}
            <b className="text-slate-800">{formatVND(grand.act)}</b> · Giải ngân{" "}
            <b className="text-slate-800">{formatPercent(disbursementRate(grand.act, grand.est))}</b>
          </p>
        </div>
        {summaries.length === 0 ? (
          <EmptyState text="Chưa có dự án nào." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Dự án</th>
                  <th className="th text-right">Ngân sách</th>
                  <th className="th text-right">Thực chi</th>
                  <th className="th text-right">Còn lại</th>
                  <th className="th w-56">Tỷ lệ giải ngân</th>
                  <th className="th">Cảnh báo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaries.map((s) => (
                  <tr
                    key={s.project.id}
                    onClick={() => setSelected(s.project.id)}
                    className={`cursor-pointer hover:bg-slate-50 ${selected === s.project.id ? "bg-blue-50/60" : ""}`}
                  >
                    <td className="td font-medium text-slate-900">{s.project.name}</td>
                    <td className="td text-right tabular-nums">{formatVND(s.est)}</td>
                    <td className="td text-right tabular-nums">{formatVND(s.act)}</td>
                    <td className={`td text-right tabular-nums ${s.est - s.act < 0 ? "text-red-600" : ""}`}>{formatVND(s.est - s.act)}</td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                          <div className={`h-full rounded-full ${rateColor(s.rate)}`} style={{ width: `${Math.min(100, s.rate)}%` }} />
                        </div>
                        <span className="w-14 text-right text-xs tabular-nums">{formatPercent(s.rate)}</span>
                      </div>
                    </td>
                    <td className="td"><BudgetBadge level={s.level} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Chi tiết dự án */}
      {current && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="min-w-56">
              <label className="label">Chi tiết theo hạng mục của dự án</label>
              <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <button className="btn-primary" onClick={() => setModal({ kind: "new" })}>
              {isAdmin ? "+ Thêm hạng mục dự toán" : "+ Nhập chi phí phát sinh"}
            </button>
          </div>

          {current.level !== "ok" && (
            <div
              className={`mx-4 mt-4 flex items-start gap-2 rounded-lg border p-3 text-sm ${
                current.level === "over" ? "border-red-200 bg-red-50 text-red-800" : "border-orange-200 bg-orange-50 text-orange-800"
              }`}
              role="alert"
            >
              <span aria-hidden className="mt-0.5">{current.level === "over" ? "●" : "▲"}</span>
              <span>
                {current.level === "over" ? (
                  <><b>Vượt ngân sách!</b> Thực chi đã đạt {formatPercent(current.rate)} tổng ngân sách dự án (vượt {formatVND(current.act - current.est)}).</>
                ) : (
                  <><b>Cảnh báo:</b> Thực chi đã đạt {formatPercent(current.rate)} tổng ngân sách dự án — vượt ngưỡng 80%.</>
                )}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
            <Stat
              label="Ngân sách dự án"
              value={formatVND(current.est)}
              badge={
                <span className="text-[11px] text-slate-500">
                  {current.hasTotal ? `Tổng dự toán hạng mục: ${formatVND(current.itemsEst)}` : "Tính theo tổng dự toán hạng mục"}
                  {isAdmin && (
                    <button className="ml-2 font-medium text-blue-600 hover:underline" onClick={() => setEditProject(current.project)}>
                      Sửa
                    </button>
                  )}
                </span>
              }
            />
            <Stat label="Tổng thực chi" value={formatVND(current.act)} />
            <Stat label="Còn lại" value={formatVND(current.est - current.act)} danger={current.act > current.est} />
            <Stat label="Tỷ lệ giải ngân" value={formatPercent(current.rate)} badge={<BudgetBadge level={current.level} />} />
          </div>

          {current.rows.length === 0 ? (
            <EmptyState text="Dự án chưa có hạng mục ngân sách nào." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Hạng mục</th>
                    <th className="th text-right">Dự toán</th>
                    <th className="th text-right">Thực chi</th>
                    <th className="th text-right">Chênh lệch</th>
                    <th className="th w-44">Giải ngân</th>
                    <th className="th">Duyệt</th>
                    <th className="th">Ghi chú</th>
                    <th className="th text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {current.rows.map((e) => {
                    const rate = disbursementRate(e.actual_amount, e.estimated_amount);
                    const diff = e.estimated_amount - e.actual_amount;
                    return (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="td font-medium text-slate-900">
                          {e.item_name}
                          {e.spent_date && <p className="text-[11px] font-normal text-slate-500">Ngày chi: {formatDate(e.spent_date)}</p>}
                        </td>
                        <td className="td text-right tabular-nums">{formatVND(e.estimated_amount)}</td>
                        <td className="td text-right tabular-nums">{formatVND(e.actual_amount)}</td>
                        <td className={`td text-right tabular-nums ${diff < 0 ? "font-medium text-red-600" : "text-slate-600"}`}>
                          {diff < 0 ? "−" : ""}{formatVND(Math.abs(diff))}
                        </td>
                        <td className="td">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                              <div className={`h-full rounded-full ${rateColor(rate)}`} style={{ width: `${Math.min(100, rate)}%` }} />
                            </div>
                            <span className={`w-12 text-right text-xs tabular-nums ${rate > 100 ? "font-semibold text-red-600" : rate > 80 ? "font-semibold text-orange-600" : ""}`}>
                              {formatPercent(rate)}
                            </span>
                          </div>
                        </td>
                        <td className="td">
                          {isAdmin ? (
                            <button
                              onClick={() => toggleApprove(e)}
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${e.approved ? "bg-green-50 text-green-700 ring-green-200" : "bg-slate-50 text-slate-600 ring-slate-200 hover:bg-slate-100"}`}
                              title={e.approved ? "Bấm để huỷ duyệt" : "Bấm để duyệt dự toán"}
                            >
                              {e.approved ? "✓ Đã duyệt" : "Chờ duyệt"}
                            </button>
                          ) : (
                            <span className={`text-xs ${e.approved ? "text-green-700" : "text-slate-500"}`}>{e.approved ? "✓ Đã duyệt" : "Chờ duyệt"}</span>
                          )}
                        </td>
                        <td className="td max-w-48 truncate text-slate-500" title={e.note ?? ""}>{e.note || "—"}</td>
                        <td className="td whitespace-nowrap text-right">
                          <button className="text-sm font-medium text-blue-600 hover:underline" onClick={() => setModal({ kind: "actual", expense: e })}>
                            Nhập thực chi
                          </button>
                          {isAdmin && (
                            <>
                              <button className="ml-3 text-sm font-medium text-slate-600 hover:underline" onClick={() => setModal({ kind: "edit", expense: e })}>Sửa</button>
                              <button className="ml-3 text-sm font-medium text-red-600 hover:underline" onClick={() => remove(e)}>Xoá</button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 font-semibold">
                  <tr>
                    <td className="td">Tổng cộng</td>
                    <td className="td text-right tabular-nums">{formatVND(current.itemsEst)}</td>
                    <td className="td text-right tabular-nums">{formatVND(current.act)}</td>
                    <td className={`td text-right tabular-nums ${current.act > current.itemsEst ? "text-red-600" : ""}`}>
                      {current.act > current.itemsEst ? "−" : ""}{formatVND(Math.abs(current.itemsEst - current.act))}
                    </td>
                    <td className="td text-xs">{formatPercent(disbursementRate(current.act, current.itemsEst))}</td>
                    <td className="td" colSpan={3}><BudgetBadge level={current.level} /></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      <ProjectModal open={!!editProject} project={editProject} onClose={() => setEditProject(null)} />
      <ExpenseModal state={modal} projectId={selected} onClose={() => setModal({ kind: "none" })} />
    </div>
  );
}

function Stat({ label, value, danger, badge }: { label: string; value: string; danger?: boolean; badge?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${danger ? "text-red-600" : "text-slate-900"}`}>{value}</p>
      {badge && <div className="mt-1">{badge}</div>}
    </div>
  );
}

function ExpenseModal({ state, projectId, onClose }: { state: ModalState; projectId: string; onClose: () => void }) {
  const { isAdmin } = useAuth();
  const { refresh } = useData();
  const [category, setCategory] = useState("");
  const [estimated, setEstimated] = useState("");
  const [actual, setActual] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [note, setNote] = useState("");
  const [spentDate, setSpentDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setAddAmount("");
    if (state.kind === "edit" || state.kind === "actual") {
      setCategory(state.expense.item_name);
      setEstimated(String(state.expense.estimated_amount));
      setActual(String(state.expense.actual_amount));
      setNote(state.expense.note ?? "");
      setSpentDate(state.kind === "actual" ? todayISO() : state.expense.spent_date?.slice(0, 10) ?? "");
    } else {
      setCategory("");
      setEstimated("");
      setActual("");
      setNote("");
      setSpentDate(todayISO());
    }
  }, [state]);

  if (state.kind === "none") return null;

  const toNum = (s: string) => Number(String(s).replace(/[^\d.-]/g, "")) || 0;

  async function save() {
    if (state.kind === "none") return;
    setError(null);
    let res;
    if (state.kind === "new") {
      if (!category.trim()) return setError("Vui lòng nhập tên hạng mục.");
      const payload: Partial<Expense> = isAdmin
        ? { project_id: projectId, item_name: category.trim(), estimated_amount: toNum(estimated), actual_amount: toNum(actual), note: note.trim() || null, spent_date: spentDate || null }
        : { project_id: projectId, item_name: category.trim(), estimated_amount: 0, actual_amount: toNum(actual), approved: false, note: note.trim() || null, spent_date: spentDate || null };
      if (toNum(estimated) < 0 || toNum(actual) < 0) return setError("Số tiền không được âm.");
      setBusy(true);
      res = await supabase.from("expenses").insert(payload);
    } else if (state.kind === "edit") {
      if (!category.trim()) return setError("Vui lòng nhập tên hạng mục.");
      setBusy(true);
      res = await supabase
        .from("expenses")
        .update({ item_name: category.trim(), estimated_amount: toNum(estimated), actual_amount: toNum(actual), note: note.trim() || null, spent_date: spentDate || null })
        .eq("id", state.expense.id);
    } else {
      const total = addAmount ? state.expense.actual_amount + toNum(addAmount) : toNum(actual);
      if (total < 0) return setError("Thực chi không được âm.");
      setBusy(true);
      res = await supabase.from("expenses").update({ actual_amount: total, note: note.trim() || null, spent_date: spentDate || null }).eq("id", state.expense.id);
    }
    setBusy(false);
    if (res.error) return setError(errorMessage(res.error));
    await refresh();
    onClose();
  }

  const title =
    state.kind === "new" ? (isAdmin ? "Thêm hạng mục dự toán" : "Nhập chi phí phát sinh") : state.kind === "edit" ? "Sửa hạng mục ngân sách" : `Nhập thực chi: ${state.expense.item_name}`;

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Huỷ</button>
          <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Đang lưu…" : "Lưu"}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div className="space-y-3">
        {state.kind !== "actual" && (
          <div>
            <label className="label">Hạng mục *</label>
            <input className="input" placeholder="VD: Nhân công, Thiết bị, Marketing…" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
        )}
        {state.kind !== "actual" && isAdmin && (
          <div>
            <label className="label">Dự toán (VNĐ)</label>
            <input className="input" inputMode="numeric" value={estimated} onChange={(e) => setEstimated(e.target.value)} />
          </div>
        )}
        {state.kind === "actual" ? (
          <>
            <p className="rounded-lg bg-slate-50 p-2.5 text-sm text-slate-600">
              Dự toán: <b>{formatVND(state.expense.estimated_amount)}</b> · Thực chi hiện tại: <b>{formatVND(state.expense.actual_amount)}</b>
            </p>
            <div>
              <label className="label">Cộng thêm khoản chi mới (VNĐ)</label>
              <input className="input" inputMode="numeric" placeholder="VD: 1500000" value={addAmount} onChange={(e) => setAddAmount(e.target.value)} />
              {addAmount && (
                <p className="mt-1 text-xs text-slate-500">Thực chi sau khi cộng: {formatVND(state.expense.actual_amount + toNum(addAmount))}</p>
              )}
            </div>
            <div>
              <label className="label">Hoặc sửa tổng thực chi (VNĐ)</label>
              <input className="input" inputMode="numeric" value={actual} onChange={(e) => setActual(e.target.value)} disabled={!!addAmount} />
            </div>
          </>
        ) : (
          <div>
            <label className="label">Thực chi (VNĐ)</label>
            <input className="input" inputMode="numeric" value={actual} onChange={(e) => setActual(e.target.value)} />
          </div>
        )}
        <div>
          <label className="label">Ngày chi</label>
          <input type="date" className="input" value={spentDate} onChange={(e) => setSpentDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Ghi chú</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {state.kind === "new" && !isAdmin && (
          <p className="text-xs text-slate-500">Khoản phát sinh mới sẽ có dự toán 0đ và chờ Admin duyệt.</p>
        )}
      </div>
    </Modal>
  );
}
