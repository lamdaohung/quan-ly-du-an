"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useData } from "@/lib/data-context";
import { buildReport, exportCSV, exportExcel } from "@/lib/report";
import { budgetLevel, disbursementRate, errorMessage, formatPercent, formatVND } from "@/lib/format";
import { BudgetBadge, EmptyState, ErrorBox, PageHeader, ProgressBar, Spinner } from "@/components/ui";

const COLOR_EST = "#257de0";
const COLOR_ACT = "#f47230";

const compactVND = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ`;
  if (a >= 1e6) return `${(n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;
  if (a >= 1e3) return `${(n / 1e3).toLocaleString("vi-VN", { maximumFractionDigits: 0 })} N`;
  return String(n);
};

export default function DashboardPage() {
  const { projects, tasks, expenses, members, loading, error } = useData();
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showTable, setShowTable] = useState(false);

  const { rows, kpi } = useMemo(() => buildReport(projects, tasks, expenses), [projects, tasks, expenses]);

  const chartData = rows.map((r) => ({
    name: r.project.name.length > 18 ? r.project.name.slice(0, 17) + "…" : r.project.name,
    fullName: r.project.name,
    "Ngân sách": r.estimated,
    "Thực chi": r.actual,
  }));

  async function onExcel() {
    setExportError(null);
    setExporting(true);
    try {
      await exportExcel(rows, kpi, projects, tasks, expenses, members);
    } catch (e) {
      setExportError(errorMessage(e));
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <Spinner />;

  const onTimePct = kpi.taskCount ? (kpi.onTime / kpi.taskCount) * 100 : 0;
  const totalRate = disbursementRate(kpi.actual, kpi.estimated);

  return (
    <div>
      <PageHeader
        title="Báo cáo tiến độ"
        subtitle={`Tổng hợp nhanh tình hình ${kpi.projectCount} dự án của team.`}
        actions={
          <>
            <button className="btn-secondary" onClick={() => exportCSV(rows)} disabled={!rows.length}>⬇ Xuất CSV</button>
            <button className="btn-primary" onClick={onExcel} disabled={!rows.length || exporting}>
              {exporting ? "Đang xuất…" : "⬇ Xuất Excel"}
            </button>
          </>
        }
      />
      <ErrorBox message={error ?? exportError} />

      {/* KPI */}
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="Tổng số dự án" value={String(kpi.projectCount)} sub={`${kpi.taskCount} đầu việc`} />
        <Kpi label="Tỷ lệ hoàn thành TB" value={formatPercent(kpi.avgProgress)} sub={`${kpi.done}/${kpi.taskCount} đầu việc đã xong`}>
          <div className="mt-2"><ProgressBar value={kpi.avgProgress} /></div>
        </Kpi>
        <Kpi label="Đầu việc đúng hạn" value={String(kpi.onTime)} sub={`${formatPercent(onTimePct)} tổng số đầu việc`} tone="good" />
        <Kpi label="Đầu việc trễ hạn" value={String(kpi.late)} sub="Quá hạn nhưng chưa xong 100%" tone={kpi.late ? "bad" : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Biểu đồ ngân sách */}
        <div className="card p-4 xl:col-span-3">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">So sánh ngân sách theo dự án</h2>
              <p className="text-xs text-slate-500">
                Tổng ngân sách {formatVND(kpi.estimated)} · Thực chi {formatVND(kpi.actual)} ({formatPercent(totalRate)})
              </p>
            </div>
            <button className="text-xs font-medium text-blue-600 hover:underline" onClick={() => setShowTable((v) => !v)}>
              {showTable ? "Xem biểu đồ" : "Xem dạng bảng"}
            </button>
          </div>
          {rows.length === 0 ? (
            <EmptyState text="Chưa có dữ liệu ngân sách." />
          ) : showTable ? (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr><th className="th">Dự án</th><th className="th text-right">Ngân sách</th><th className="th text-right">Thực chi</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.project.id}>
                    <td className="td">{r.project.name}</td>
                    <td className="td text-right tabular-nums">{formatVND(r.estimated)}</td>
                    <td className="td text-right tabular-nums">{formatVND(r.actual)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} interval={0} />
                  <YAxis tickFormatter={compactVND} tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} width={64} />
                  <Tooltip
                    cursor={{ fill: "rgba(148,163,184,0.12)" }}
                    formatter={(v) => formatVND(Number(v))}
                    labelFormatter={(_, p) => (p?.[0]?.payload as { fullName?: string } | undefined)?.fullName ?? ""}
                    contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 13 }}
                  />
                  <Legend iconType="square" wrapperStyle={{ fontSize: 13, color: "#334155" }} />
                  <Bar dataKey="Ngân sách" fill={COLOR_EST} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="Thực chi" fill={COLOR_ACT} radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Trạng thái đúng hạn / trễ hạn */}
        <div className="card p-4 xl:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">Tình trạng đầu việc</h2>
          <p className="mb-4 text-xs text-slate-500">Tỷ lệ đúng hạn và trễ hạn trên toàn bộ {kpi.taskCount} đầu việc</p>
          {kpi.taskCount === 0 ? (
            <EmptyState text="Chưa có đầu việc." />
          ) : (
            <>
              <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full">
                <div className="bg-status-good" style={{ width: `${(kpi.done / kpi.taskCount) * 100}%` }} title="Hoàn thành" />
                <div className="bg-blue-600" style={{ width: `${((kpi.onTime - kpi.done) / kpi.taskCount) * 100}%` }} title="Đang làm, đúng hạn" />
                <div className="bg-status-critical" style={{ width: `${(kpi.late / kpi.taskCount) * 100}%` }} title="Trễ hạn" />
              </div>
              <ul className="mt-4 space-y-2.5 text-sm">
                <Legendish color="bg-status-good" label="Đã hoàn thành" value={kpi.done} total={kpi.taskCount} />
                <Legendish color="bg-blue-600" label="Đang làm, còn trong hạn" value={kpi.onTime - kpi.done} total={kpi.taskCount} />
                <Legendish color="bg-status-critical" label="Trễ hạn" value={kpi.late} total={kpi.taskCount} />
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Bảng tiến độ dự án */}
      <div className="card mt-6 overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Tiến độ chi tiết từng dự án</h2>
        </div>
        {rows.length === 0 ? (
          <EmptyState text="Chưa có dự án nào." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Dự án</th>
                  <th className="th">Trạng thái</th>
                  <th className="th w-48">Tiến độ</th>
                  <th className="th text-center">Đầu việc</th>
                  <th className="th text-center">Đúng hạn</th>
                  <th className="th text-center">Trễ hạn</th>
                  <th className="th text-right">Giải ngân</th>
                  <th className="th">Ngân sách</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.project.id} className="hover:bg-slate-50">
                    <td className="td font-medium text-slate-900">{r.project.name}</td>
                    <td className="td text-slate-500">{r.project.status || "—"}</td>
                    <td className="td"><ProgressBar value={r.progress} danger={r.late > 0 && r.progress < 100} /></td>
                    <td className="td text-center tabular-nums">{r.taskCount}</td>
                    <td className="td text-center tabular-nums text-green-700">{r.onTime}</td>
                    <td className={`td text-center tabular-nums ${r.late ? "font-semibold text-red-600" : ""}`}>{r.late}</td>
                    <td className="td text-right tabular-nums">{formatPercent(r.rate)}</td>
                    <td className="td"><BudgetBadge level={budgetLevel(r.rate)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone, children }: { label: string; value: string; sub?: string; tone?: "good" | "bad"; children?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums sm:text-3xl ${tone === "bad" ? "text-red-600" : tone === "good" ? "text-green-700" : "text-slate-900"}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
      {children}
    </div>
  );
}

function Legendish({ color, label, value, total }: { color: string; label: string; value: number; total: number }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-sm ${color}`} />
      <span className="flex-1 text-slate-700">{label}</span>
      <span className="tabular-nums font-medium text-slate-900">{value}</span>
      <span className="w-14 text-right text-xs tabular-nums text-slate-500">{formatPercent(total ? (value / total) * 100 : 0)}</span>
    </li>
  );
}
