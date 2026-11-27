"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import type { Project, Task } from "@/lib/types";
import { clampProgress, errorMessage, formatDate, formatVND, isOverdue } from "@/lib/format";
import { ErrorBox, Modal } from "./ui";

const PROJECT_STATUSES = ["Lên kế hoạch", "Đang triển khai", "Tạm dừng", "Hoàn thành"];

/* ------------------------------------------------------------------ */
/*  Dự án: chỉ Admin được tạo / sửa timeline / xoá                     */
/* ------------------------------------------------------------------ */
export function ProjectModal({
  open,
  project,
  onClose,
}: {
  open: boolean;
  project: Project | null; // null = tạo mới
  onClose: () => void;
}) {
  const { isAdmin } = useAuth();
  const { refresh } = useData();
  const [form, setForm] = useState({ name: "", description: "", start_date: "", end_date: "", status: "Đang triển khai", total_budget: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm({
      name: project?.name ?? "",
      description: project?.description ?? "",
      start_date: project?.start_date?.slice(0, 10) ?? "",
      end_date: project?.end_date?.slice(0, 10) ?? "",
      status: project?.status ?? "Đang triển khai",
      total_budget: project?.total_budget ? String(project.total_budget) : "",
    });
  }, [open, project]);

  const readOnly = !isAdmin;

  async function save() {
    if (!form.name.trim()) return setError("Vui lòng nhập tên dự án.");
    if (!form.start_date || !form.end_date) return setError("Vui lòng nhập ngày bắt đầu và ngày kết thúc.");
    if (form.end_date < form.start_date) return setError("Ngày kết thúc phải sau ngày bắt đầu.");
    const budget = Number(form.total_budget.replace(/[^\d]/g, "")) || 0;
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      start_date: form.start_date,
      end_date: form.end_date,
      status: form.status,
      total_budget: budget,
    };
    const { error } = project
      ? await supabase.from("projects").update(payload).eq("id", project.id)
      : await supabase.from("projects").insert(payload);
    setBusy(false);
    if (error) return setError(error.message);
    await refresh();
    onClose();
  }

  async function remove() {
    if (!project || !confirm(`Xoá dự án "${project.name}" cùng toàn bộ đầu việc và chi phí?`)) return;
    setBusy(true);
    const { error } = await supabase.from("projects").delete().eq("id", project.id);
    setBusy(false);
    if (error) return setError(error.message);
    await refresh();
    onClose();
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={project ? (readOnly ? "Thông tin dự án" : "Chỉnh sửa dự án") : "Tạo dự án mới"}
      footer={
        readOnly ? (
          <button className="btn-secondary" onClick={onClose}>Đóng</button>
        ) : (
          <>
            {project && (
              <button className="btn-danger mr-auto" onClick={remove} disabled={busy}>Xoá dự án</button>
            )}
            <button className="btn-secondary" onClick={onClose}>Huỷ</button>
            <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Đang lưu…" : "Lưu"}</button>
          </>
        )
      }
    >
      <ErrorBox message={error} />
      <div className="space-y-3">
        <div>
          <label className="label">Tên dự án *</label>
          <input className="input" value={form.name} onChange={set("name")} disabled={readOnly} />
        </div>
        <div>
          <label className="label">Mô tả</label>
          <textarea className="input min-h-20" value={form.description} onChange={set("description")} disabled={readOnly} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Ngày bắt đầu *</label>
            <input type="date" className="input" value={form.start_date} onChange={set("start_date")} disabled={readOnly} />
          </div>
          <div>
            <label className="label">Ngày kết thúc *</label>
            <input type="date" className="input" value={form.end_date} onChange={set("end_date")} disabled={readOnly} />
          </div>
        </div>
        <div>
          <label className="label">Tổng ngân sách được duyệt (VNĐ)</label>
          <input
            className="input"
            inputMode="numeric"
            placeholder="Để trống = tính theo tổng dự toán các hạng mục"
            value={form.total_budget}
            onChange={set("total_budget")}
            disabled={readOnly}
          />
          {Number(form.total_budget.replace(/[^\d]/g, "")) > 0 && (
            <p className="mt-1 text-xs text-slate-500">{formatVND(Number(form.total_budget.replace(/[^\d]/g, "")))}</p>
          )}
        </div>
        <div>
          <label className="label">Trạng thái</label>
          <select className="input" value={form.status} onChange={set("status")} disabled={readOnly}>
            {[...new Set([...PROJECT_STATUSES, form.status])].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Đầu việc: Admin sửa toàn bộ; Member chỉ sửa % tiến độ task của mình */
/* ------------------------------------------------------------------ */
export function TaskModal({
  open,
  task,
  defaultProjectId,
  onClose,
}: {
  open: boolean;
  task: Task | null; // null = tạo mới (chỉ Admin)
  defaultProjectId?: string;
  onClose: () => void;
}) {
  const { isAdmin, member } = useAuth();
  const { projects, members, refresh, memberName } = useData();
  const [form, setForm] = useState({ title: "", project_id: "", assignee_id: "", start_date: "", due_date: "", progress: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm({
      title: task?.title ?? "",
      project_id: task?.project_id ?? defaultProjectId ?? projects[0]?.id ?? "",
      assignee_id: task?.assignee_id ?? "",
      start_date: task?.start_date?.slice(0, 10) ?? "",
      due_date: task?.due_date?.slice(0, 10) ?? "",
      progress: task?.progress ?? 0,
    });
  }, [open, task, defaultProjectId, projects]);

  const isAssignee = !!task && !!member && task.assignee_id === member.id;
  const canEditAll = isAdmin;
  const canEditProgress = isAdmin || isAssignee;

  async function save() {
    setError(null);
    let payload: Partial<Task>;
    if (canEditAll) {
      if (!form.title.trim()) return setError("Vui lòng nhập tên đầu việc.");
      if (!form.project_id) return setError("Vui lòng chọn dự án.");
      if (!form.start_date || !form.due_date) return setError("Vui lòng nhập ngày bắt đầu và hạn hoàn thành.");
      if (form.due_date < form.start_date) return setError("Hạn hoàn thành phải sau ngày bắt đầu.");
      payload = {
        title: form.title.trim(),
        project_id: form.project_id,
        assignee_id: form.assignee_id || null,
        start_date: form.start_date,
        due_date: form.due_date,
        progress: clampProgress(form.progress),
      };
    } else {
      payload = { progress: clampProgress(form.progress) };
    }
    setBusy(true);
    const { error } = task
      ? await supabase.from("tasks").update(payload).eq("id", task.id)
      : await supabase.from("tasks").insert(payload);
    setBusy(false);
    if (error) return setError(errorMessage(error));
    await refresh();
    onClose();
  }

  async function remove() {
    if (!task || !confirm(`Xoá đầu việc "${task.title}"?`)) return;
    setBusy(true);
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    setBusy(false);
    if (error) return setError(error.message);
    await refresh();
    onClose();
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: k === "progress" ? Number(e.target.value) : e.target.value }));

  const overdue = task && isOverdue({ due_date: form.due_date || null, progress: form.progress });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? (canEditAll ? "Chỉnh sửa đầu việc" : canEditProgress ? "Cập nhật tiến độ" : "Chi tiết đầu việc") : "Thêm đầu việc"}
      footer={
        canEditProgress ? (
          <>
            {task && canEditAll && (
              <button className="btn-danger mr-auto" onClick={remove} disabled={busy}>Xoá</button>
            )}
            <button className="btn-secondary" onClick={onClose}>Huỷ</button>
            <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Đang lưu…" : "Lưu"}</button>
          </>
        ) : (
          <button className="btn-secondary" onClick={onClose}>Đóng</button>
        )
      }
    >
      <ErrorBox message={error} />
      {overdue && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
          ● Đầu việc đã quá hạn ({formatDate(form.due_date)}) nhưng chưa hoàn thành.
        </div>
      )}
      {!canEditProgress && task && (
        <p className="mb-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">
          Bạn chỉ có thể cập nhật tiến độ các đầu việc được giao cho mình.
        </p>
      )}
      <div className="space-y-3">
        <div>
          <label className="label">Tên đầu việc *</label>
          <input className="input" value={form.title} onChange={set("title")} disabled={!canEditAll} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Dự án *</label>
            <select className="input" value={form.project_id} onChange={set("project_id")} disabled={!canEditAll}>
              <option value="">— Chọn dự án —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Người phụ trách</label>
            {canEditAll ? (
              <select className="input" value={form.assignee_id} onChange={set("assignee_id")}>
                <option value="">— Chưa giao —</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
              </select>
            ) : (
              <input className="input" value={memberName(form.assignee_id || null)} disabled />
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Ngày bắt đầu *</label>
            <input type="date" className="input" value={form.start_date} onChange={set("start_date")} disabled={!canEditAll} />
          </div>
          <div>
            <label className="label">Hạn hoàn thành (due date) *</label>
            <input type="date" className="input" value={form.due_date} onChange={set("due_date")} disabled={!canEditAll} />
          </div>
        </div>
        <div>
          <label className="label">Tiến độ: <span className="font-semibold text-slate-900">{form.progress}%</span></label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={form.progress}
              onChange={set("progress")}
              disabled={!canEditProgress}
              className="w-full accent-blue-600"
            />
            <input
              type="number"
              min={0}
              max={100}
              className="input w-20"
              value={form.progress}
              onChange={set("progress")}
              disabled={!canEditProgress}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
