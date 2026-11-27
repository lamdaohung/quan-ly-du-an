"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import type { Project, Task } from "@/lib/types";
import { addDays, daysBetween, formatDate, isOverdue, todayISO } from "@/lib/format";
import { EmptyState, ErrorBox, PageHeader, ProgressBar, Spinner } from "@/components/ui";
import { ProjectModal, TaskModal } from "@/components/forms";

type Zoom = "day" | "week" | "month";
const PX_PER_DAY: Record<Zoom, number> = { day: 34, week: 14, month: 4.5 };
const LEFT_W = 360;
const ROW_H = 44;

interface Span {
  start: string;
  end: string;
}

function taskSpan(t: Task): Span | null {
  const s = t.start_date?.slice(0, 10) ?? t.due_date?.slice(0, 10);
  const e = t.due_date?.slice(0, 10) ?? t.start_date?.slice(0, 10);
  if (!s || !e) return null;
  return s <= e ? { start: s, end: e } : { start: e, end: s };
}

function projectSpan(p: Project, tasks: Task[]): Span | null {
  const dates: string[] = [];
  if (p.start_date) dates.push(p.start_date.slice(0, 10));
  if (p.end_date) dates.push(p.end_date.slice(0, 10));
  for (const t of tasks) {
    const s = taskSpan(t);
    if (s) dates.push(s.start, s.end);
  }
  if (!dates.length) return null;
  dates.sort();
  return {
    start: p.start_date?.slice(0, 10) ?? dates[0],
    end: p.end_date?.slice(0, 10) ?? dates[dates.length - 1],
  };
}

const MONTHS = ["Th1", "Th2", "Th3", "Th4", "Th5", "Th6", "Th7", "Th8", "Th9", "Th10", "Th11", "Th12"];

export default function TimelinePage() {
  const { isAdmin, member } = useAuth();
  const { projects, tasks, members, loading, error, memberName } = useData();
  const [projectFilter, setProjectFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [zoom, setZoom] = useState<Zoom>("week");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const [projectModal, setProjectModal] = useState<{ open: boolean; project: Project | null }>({ open: false, project: null });
  const [taskModal, setTaskModal] = useState<{ open: boolean; task: Task | null; projectId?: string }>({ open: false, task: null });

  const today = todayISO();

  const groups = useMemo(() => {
    return projects
      .filter((p) => projectFilter === "all" || p.id === projectFilter)
      .map((p) => {
        const all = tasks.filter((t) => t.project_id === p.id);
        const visible = all.filter(
          (t) =>
            (assigneeFilter === "all" ||
              (assigneeFilter === "none" ? !t.assignee_id : t.assignee_id === assigneeFilter)) &&
            (!onlyOverdue || isOverdue(t, today))
        );
        const progress = all.length ? all.reduce((s, t) => s + t.progress, 0) / all.length : 0;
        return { project: p, tasks: visible, all, progress, span: projectSpan(p, all), overdueCount: all.filter((t) => isOverdue(t, today)).length };
      })
      .filter((g) => (assigneeFilter === "all" && !onlyOverdue) || g.tasks.length > 0);
  }, [projects, tasks, projectFilter, assigneeFilter, onlyOverdue, today]);

  // Khoảng thời gian hiển thị
  const range = useMemo(() => {
    const dates: string[] = [today];
    for (const g of groups) {
      if (g.span) dates.push(g.span.start, g.span.end);
      for (const t of g.tasks) {
        const s = taskSpan(t);
        if (s) dates.push(s.start, s.end);
      }
    }
    dates.sort();
    let start = addDays(dates[0], -3);
    let end = addDays(dates[dates.length - 1], 10);
    if (zoom === "month") {
      start = start.slice(0, 8) + "01";
    }
    if (daysBetween(start, end) < 30) end = addDays(start, 30);
    return { start, end, days: daysBetween(start, end) + 1 };
  }, [groups, today, zoom]);

  const ppd = PX_PER_DAY[zoom];
  const chartW = Math.round(range.days * ppd);
  const x = (iso: string) => daysBetween(range.start, iso) * ppd;

  // Header: tháng + ô ngày/tuần
  const header = useMemo(() => {
    const months: { label: string; left: number; width: number }[] = [];
    const ticks: { label: string; left: number; width: number; weekend?: boolean; today?: boolean }[] = [];
    let cur = range.start;
    while (cur <= range.end) {
      const y = +cur.slice(0, 4);
      const m = +cur.slice(5, 7);
      const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      const endOfSeg = nextMonth > addDays(range.end, 1) ? addDays(range.end, 1) : nextMonth;
      months.push({ label: `${MONTHS[m - 1]} ${y}`, left: x(cur), width: daysBetween(cur, endOfSeg) * ppd });
      cur = nextMonth;
    }
    if (zoom === "day") {
      for (let i = 0; i < range.days; i++) {
        const d = addDays(range.start, i);
        const dow = new Date(d + "T00:00:00Z").getUTCDay();
        ticks.push({ label: String(+d.slice(8, 10)), left: i * ppd, width: ppd, weekend: dow === 0 || dow === 6, today: d === today });
      }
    } else if (zoom === "week") {
      // bắt đầu từ thứ Hai
      let i = 0;
      const dow = new Date(range.start + "T00:00:00Z").getUTCDay();
      i = (8 - dow) % 7;
      for (; i < range.days; i += 7) {
        const d = addDays(range.start, i);
        ticks.push({ label: `${+d.slice(8, 10)}/${+d.slice(5, 7)}`, left: i * ppd, width: 7 * ppd });
      }
    }
    return { months, ticks };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, zoom, ppd, today]);

  const todayX = today >= range.start && today <= range.end ? x(today) + ppd / 2 : null;

  // Tự cuộn tới khu vực "hôm nay" khi mở trang hoặc đổi thang thời gian
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el && todayX !== null) el.scrollLeft = Math.max(0, todayX - (el.clientWidth - LEFT_W) / 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, range.start, loading]);

  const stats = useMemo(() => {
    const vis = groups.flatMap((g) => g.tasks);
    return { total: vis.length, overdue: vis.filter((t) => isOverdue(t, today)).length };
  }, [groups, today]);

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Timeline dự án"
        subtitle="Biểu đồ Gantt theo dự án và đầu việc. Đầu việc quá hạn chưa hoàn thành được tô đỏ."
        actions={
          isAdmin && (
            <>
              <button className="btn-secondary" onClick={() => setTaskModal({ open: true, task: null, projectId: projectFilter !== "all" ? projectFilter : undefined })} disabled={!projects.length}>
                + Thêm đầu việc
              </button>
              <button className="btn-primary" onClick={() => setProjectModal({ open: true, project: null })}>+ Tạo dự án</button>
            </>
          )
        }
      />
      <ErrorBox message={error} />

      {/* Bộ lọc */}
      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-48 flex-1 sm:flex-none">
          <label className="label">Dự án</label>
          <select className="input" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="all">Tất cả dự án</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="min-w-48 flex-1 sm:flex-none">
          <label className="label">Người phụ trách</label>
          <select className="input" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
            <option value="all">Tất cả thành viên</option>
            {member && <option value={member.id}>Việc của tôi</option>}
            {members.filter((m) => m.id !== member?.id).map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
            <option value="none">Chưa giao</option>
          </select>
        </div>
        <div>
          <label className="label">Thang thời gian</label>
          <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
            {(["day", "week", "month"] as Zoom[]).map((z) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`rounded-md px-3 py-1.5 font-medium ${zoom === z ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {z === "day" ? "Ngày" : z === "week" ? "Tuần" : "Tháng"}
              </button>
            ))}
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 accent-red-600" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} />
          Chỉ hiện việc quá hạn
        </label>
        <div className="ml-auto flex flex-wrap items-center gap-4 pb-2 text-xs text-slate-600">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded bg-blue-600" /> Đúng tiến độ</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded bg-status-good" /> Hoàn thành</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded bg-status-critical" /> Quá hạn ({stats.overdue}/{stats.total})</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-red-500" /> Hôm nay</span>
        </div>
      </div>

      {/* Gantt */}
      <div className="card overflow-hidden">
        {groups.length === 0 ? (
          <EmptyState text={projects.length ? "Không có đầu việc phù hợp với bộ lọc." : "Chưa có dự án nào."} />
        ) : (
          <div ref={scrollRef} className="overflow-x-auto">
            <div style={{ width: LEFT_W + chartW }} className="relative">
              {/* Header */}
              <div className="sticky top-0 z-20 flex border-b border-slate-200 bg-slate-50">
                <div style={{ width: LEFT_W }} className="sticky left-0 z-30 flex shrink-0 items-end border-r border-slate-200 bg-slate-50 px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Dự án / Đầu việc
                </div>
                <div className="relative" style={{ width: chartW, height: zoom === "month" ? 30 : 52 }}>
                  {header.months.map((m) => (
                    <div key={m.left} className="absolute top-0 flex h-[26px] items-center overflow-hidden whitespace-nowrap border-l border-slate-200 px-2 text-xs font-semibold text-slate-700" style={{ left: m.left, width: m.width }}>
                      {m.label}
                    </div>
                  ))}
                  {header.ticks.map((t) => (
                    <div
                      key={t.left}
                      className={`absolute top-[26px] flex h-[26px] items-center justify-center border-l border-t border-slate-200 text-[11px] ${t.today ? "bg-red-500 font-semibold text-white" : t.weekend ? "bg-slate-100 text-slate-400" : "text-slate-500"}`}
                      style={{ left: t.left, width: t.width }}
                    >
                      {t.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Hàng */}
              <div className="relative">
                {todayX !== null && (
                  <div className="pointer-events-none absolute top-0 bottom-0 z-[5] w-0.5 bg-red-500/70" style={{ left: LEFT_W + todayX }} />
                )}
                {groups.map((g) => {
                  const isCollapsed = collapsed[g.project.id];
                  const projOverdue = !!g.span && g.span.end < today && g.progress < 100;
                  return (
                    <div key={g.project.id}>
                      {/* Hàng dự án */}
                      <div className="flex border-b border-slate-200 bg-slate-50/60" style={{ height: ROW_H }}>
                        <div style={{ width: LEFT_W }} className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-slate-200 bg-slate-50 px-3">
                          <button
                            onClick={() => setCollapsed((c) => ({ ...c, [g.project.id]: !c[g.project.id] }))}
                            className="w-5 text-slate-400 hover:text-slate-700"
                            aria-label={isCollapsed ? "Mở rộng" : "Thu gọn"}
                          >
                            {isCollapsed ? "▸" : "▾"}
                          </button>
                          <button onClick={() => setProjectModal({ open: true, project: g.project })} className="min-w-0 flex-1 text-left">
                            <p className="truncate text-sm font-semibold text-slate-900">{g.project.name}</p>
                            <p className="truncate text-[11px] text-slate-500">
                              {g.all.length} đầu việc · {Math.round(g.progress)}%
                              {g.overdueCount > 0 && <span className="font-medium text-red-600"> · {g.overdueCount} quá hạn</span>}
                            </p>
                          </button>
                        </div>
                        <div className="relative" style={{ width: chartW }}>
                          {g.span && (
                            <button
                              onClick={() => setProjectModal({ open: true, project: g.project })}
                              title={`${g.project.name}: ${formatDate(g.span.start)} → ${formatDate(g.span.end)} · ${Math.round(g.progress)}%`}
                              className={`absolute top-1/2 h-4 -translate-y-1/2 overflow-hidden rounded ${projOverdue ? "bg-red-200" : "bg-slate-300"}`}
                              style={{ left: x(g.span.start), width: Math.max(ppd, (daysBetween(g.span.start, g.span.end) + 1) * ppd) }}
                            >
                              <span className={`block h-full ${projOverdue ? "bg-status-critical" : "bg-slate-600"}`} style={{ width: `${g.progress}%` }} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Hàng đầu việc */}
                      {!isCollapsed &&
                        g.tasks.map((t) => {
                          const span = taskSpan(t);
                          const late = isOverdue(t, today);
                          const done = t.progress >= 100;
                          const mine = member?.id === t.assignee_id;
                          const barW = span ? Math.max(ppd, (daysBetween(span.start, span.end) + 1) * ppd) : 0;
                          return (
                            <div key={t.id} className={`flex border-b border-slate-100 ${late ? "bg-red-50/50" : ""}`} style={{ height: ROW_H }}>
                              <button
                                onClick={() => setTaskModal({ open: true, task: t })}
                                style={{ width: LEFT_W }}
                                className={`sticky left-0 z-10 flex shrink-0 items-center gap-3 border-r border-slate-200 px-3 pl-10 text-left hover:bg-slate-50 ${late ? "bg-red-50" : "bg-white"}`}
                              >
                                <div className="min-w-0 flex-1">
                                  <p className={`truncate text-sm ${late ? "font-medium text-red-700" : "text-slate-800"}`}>
                                    {late && <span aria-hidden>● </span>}
                                    {t.title}
                                  </p>
                                  <p className="truncate text-[11px] text-slate-500">
                                    {memberName(t.assignee_id)}
                                    {mine && <span className="text-blue-600"> (bạn)</span>} · Hạn {formatDate(t.due_date)}
                                  </p>
                                </div>
                                <div className="w-28 shrink-0"><ProgressBar value={t.progress} danger={late} /></div>
                              </button>
                              <div className="relative" style={{ width: chartW }}>
                                {span && (
                                  <button
                                    onClick={() => setTaskModal({ open: true, task: t })}
                                    title={`${t.title}\n${formatDate(span.start)} → ${formatDate(span.end)}\nTiến độ: ${t.progress}%${late ? "\n⚠ Quá hạn" : ""}`}
                                    className={`absolute top-1/2 flex h-6 -translate-y-1/2 items-center overflow-hidden rounded-md text-left ring-offset-1 hover:ring-2 ${
                                      late ? "bg-red-200 ring-red-400" : done ? "bg-green-200 ring-green-400" : "bg-blue-200 ring-blue-400"
                                    }`}
                                    style={{ left: x(span.start), width: barW }}
                                  >
                                    <span
                                      className={`absolute inset-y-0 left-0 ${late ? "bg-status-critical" : done ? "bg-status-good" : "bg-blue-600"}`}
                                      style={{ width: `${t.progress}%` }}
                                    />
                                    {barW > 44 && (
                                      <span className="relative z-10 px-2 text-[11px] font-semibold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">
                                        {t.progress}%
                                      </span>
                                    )}
                                  </button>
                                )}
                                {span && (
                                  <span
                                    className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap pl-2 text-[11px] text-slate-500"
                                    style={{ left: x(span.start) + barW }}
                                  >
                                    {t.title}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      {!isCollapsed && g.tasks.length === 0 && (
                        <div className="flex border-b border-slate-100" style={{ height: 36 }}>
                          <div style={{ width: LEFT_W }} className="sticky left-0 flex items-center border-r border-slate-200 bg-white pl-10 text-xs italic text-slate-400">
                            Chưa có đầu việc
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
      {!isAdmin && (
        <p className="mt-3 text-xs text-slate-500">
          Bấm vào đầu việc được giao cho bạn để cập nhật phần trăm tiến độ. Chỉ Admin mới điều chỉnh được timeline.
        </p>
      )}

      <ProjectModal open={projectModal.open} project={projectModal.project} onClose={() => setProjectModal({ open: false, project: null })} />
      <TaskModal open={taskModal.open} task={taskModal.task} defaultProjectId={taskModal.projectId} onClose={() => setTaskModal({ open: false, task: null })} />
    </div>
  );
}
