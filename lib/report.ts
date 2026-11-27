import type { Expense, Member, Project, Task } from "./types";
import { disbursementRate, formatDate, isOverdue, todayISO } from "./format";

export interface ProjectReport {
  project: Project;
  taskCount: number;
  done: number;
  onTime: number;
  late: number;
  progress: number;
  estimated: number;
  actual: number;
  rate: number;
}

export function buildReport(projects: Project[], tasks: Task[], expenses: Expense[], today = todayISO()) {
  const rows: ProjectReport[] = projects.map((p) => {
    const ts = tasks.filter((t) => t.project_id === p.id);
    const es = expenses.filter((e) => e.project_id === p.id);
    const late = ts.filter((t) => isOverdue(t, today)).length;
    const estimated = es.reduce((s, e) => s + e.estimated_amount, 0);
    const actual = es.reduce((s, e) => s + e.actual_amount, 0);
    return {
      project: p,
      taskCount: ts.length,
      done: ts.filter((t) => t.progress >= 100).length,
      onTime: ts.length - late,
      late,
      progress: ts.length ? ts.reduce((s, t) => s + t.progress, 0) / ts.length : 0,
      estimated,
      actual,
      rate: disbursementRate(actual, estimated),
    };
  });
  const late = tasks.filter((t) => isOverdue(t, today)).length;
  const kpi = {
    projectCount: projects.length,
    avgProgress: rows.length ? rows.reduce((s, r) => s + r.progress, 0) / rows.length : 0,
    taskCount: tasks.length,
    done: tasks.filter((t) => t.progress >= 100).length,
    onTime: tasks.length - late,
    late,
    estimated: rows.reduce((s, r) => s + r.estimated, 0),
    actual: rows.reduce((s, r) => s + r.actual, 0),
  };
  return { rows, kpi };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function projectSheet(rows: ProjectReport[]) {
  return rows.map((r) => ({
    "Dự án": r.project.name,
    "Trạng thái": r.project.status ?? "",
    "Ngày bắt đầu": formatDate(r.project.start_date),
    "Ngày kết thúc": formatDate(r.project.end_date),
    "Số đầu việc": r.taskCount,
    "Hoàn thành": r.done,
    "Đúng hạn": r.onTime,
    "Trễ hạn": r.late,
    "Tiến độ TB (%)": round1(r.progress),
    "Dự toán (VNĐ)": r.estimated,
    "Thực chi (VNĐ)": r.actual,
    "Tỷ lệ giải ngân (%)": round1(r.rate),
  }));
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(v: unknown) {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCSV(rows: ProjectReport[]) {
  const data = projectSheet(rows);
  const headers = Object.keys(data[0] ?? { "Dự án": "" });
  const lines = [headers.map(csvCell).join(","), ...data.map((r) => headers.map((h) => csvCell(r[h as keyof typeof r])).join(","))];
  // BOM để Excel đọc đúng tiếng Việt (UTF-8)
  download(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `bao-cao-tien-do-${todayISO()}.csv`);
}

export async function exportExcel(
  rows: ProjectReport[],
  kpi: ReturnType<typeof buildReport>["kpi"],
  projects: Project[],
  tasks: Task[],
  expenses: Expense[],
  members: Member[]
) {
  const XLSX = await import("xlsx");
  const today = todayISO();
  const pname = (id: string) => projects.find((p) => p.id === id)?.name ?? "";
  const mname = (id: string | null) => {
    const m = members.find((x) => x.id === id);
    return m?.full_name || m?.email || "Chưa giao";
  };

  const wb = XLSX.utils.book_new();
  const overview = XLSX.utils.aoa_to_sheet([
    ["BÁO CÁO TIẾN ĐỘ DỰ ÁN"],
    ["Ngày xuất", formatDate(today)],
    [],
    ["Chỉ số", "Giá trị"],
    ["Tổng số dự án", kpi.projectCount],
    ["Tỷ lệ hoàn thành trung bình (%)", round1(kpi.avgProgress)],
    ["Tổng số đầu việc", kpi.taskCount],
    ["Đầu việc đã hoàn thành", kpi.done],
    ["Đầu việc đúng hạn", kpi.onTime],
    ["Đầu việc trễ hạn", kpi.late],
    ["Tổng dự toán (VNĐ)", kpi.estimated],
    ["Tổng thực chi (VNĐ)", kpi.actual],
    ["Tỷ lệ giải ngân (%)", round1(disbursementRate(kpi.actual, kpi.estimated))],
  ]);
  overview["!cols"] = [{ wch: 34 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, overview, "Tổng quan");

  const ps = XLSX.utils.json_to_sheet(projectSheet(rows));
  ps["!cols"] = [{ wch: 30 }, { wch: 16 }, { wch: 13 }, { wch: 13 }, { wch: 11 }, { wch: 11 }, { wch: 10 }, { wch: 9 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ps, "Dự án");

  const ts = XLSX.utils.json_to_sheet(
    tasks.map((t) => ({
      "Dự án": pname(t.project_id),
      "Đầu việc": t.title,
      "Người phụ trách": mname(t.assignee_id),
      "Ngày bắt đầu": formatDate(t.start_date),
      "Hạn hoàn thành": formatDate(t.due_date),
      "Tiến độ (%)": t.progress,
      "Tình trạng": t.progress >= 100 ? "Hoàn thành" : isOverdue(t, today) ? "Trễ hạn" : "Đang thực hiện",
    }))
  );
  ts["!cols"] = [{ wch: 28 }, { wch: 36 }, { wch: 22 }, { wch: 13 }, { wch: 15 }, { wch: 11 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ts, "Đầu việc");

  const es = XLSX.utils.json_to_sheet(
    expenses.map((e) => ({
      "Dự án": pname(e.project_id),
      "Hạng mục": e.category,
      "Dự toán (VNĐ)": e.estimated_amount,
      "Thực chi (VNĐ)": e.actual_amount,
      "Chênh lệch (VNĐ)": e.estimated_amount - e.actual_amount,
      "Giải ngân (%)": round1(disbursementRate(e.actual_amount, e.estimated_amount)),
      "Đã duyệt": e.approved ? "Có" : "Chưa",
      "Ghi chú": e.note ?? "",
    }))
  );
  es["!cols"] = [{ wch: 28 }, { wch: 26 }, { wch: 16 }, { wch: 16 }, { wch: 17 }, { wch: 13 }, { wch: 9 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, es, "Ngân sách");

  XLSX.writeFile(wb, `bao-cao-tien-do-${today}.xlsx`);
}
