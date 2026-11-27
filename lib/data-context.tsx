"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import type { Expense, Member, Project, Task } from "./types";
import { clampProgress } from "./format";

interface DataState {
  projects: Project[];
  members: Member[];
  tasks: Task[];
  expenses: Expense[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  memberName: (id: string | null) => string;
}

const DataContext = createContext<DataState | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [p, m, t, e] = await Promise.all([
      supabase.from("projects").select("*").order("start_date", { ascending: true, nullsFirst: false }),
      supabase.from("members").select("*").order("full_name", { ascending: true }),
      supabase.from("tasks").select("*").order("start_date", { ascending: true, nullsFirst: false }),
      supabase.from("expenses").select("*").order("item_name", { ascending: true }),
    ]);
    const firstError = p.error ?? m.error ?? t.error ?? e.error;
    setError(firstError ? firstError.message : null);
    setProjects(((p.data ?? []) as Project[]).map((x) => ({ ...x, total_budget: Number(x.total_budget ?? 0) })));
    setMembers(
      ((m.data ?? []) as Member[]).map((x) => ({
        ...x,
        role: String(x.role).toLowerCase() === "admin" ? "Admin" : "Member",
      }))
    );
    setTasks(((t.data ?? []) as Task[]).map((x) => ({ ...x, progress: clampProgress(x.progress) })));
    setExpenses(
      ((e.data ?? []) as Expense[]).map((x) => ({
        ...x,
        estimated_amount: Number(x.estimated_amount ?? 0),
        actual_amount: Number(x.actual_amount ?? 0),
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    // Cập nhật thời gian thực (cần bật Realtime cho các bảng trên Supabase; nếu chưa bật thì bỏ qua)
    let timer: ReturnType<typeof setTimeout> | undefined;
    const debounced = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 400);
    };
    const channel = supabase.channel("pm-changes");
    for (const table of ["projects", "members", "tasks", "expenses"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, debounced);
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const memberName = useCallback(
    (id: string | null) => {
      if (!id) return "Chưa giao";
      const m = members.find((x) => x.id === id);
      return m?.full_name || m?.email || "Không rõ";
    },
    [members]
  );

  const value = useMemo(
    () => ({ projects, members, tasks, expenses, loading, error, refresh, memberName }),
    [projects, members, tasks, expenses, loading, error, refresh, memberName]
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData phải nằm trong DataProvider");
  return ctx;
}
