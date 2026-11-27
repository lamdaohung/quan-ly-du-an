"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "./ui";

const NAV = [
  { href: "/dashboard", label: "Báo cáo tiến độ", icon: "▦" },
  { href: "/timeline", label: "Timeline (Gantt)", icon: "▤" },
  { href: "/ngan-sach", label: "Quản lý ngân sách", icon: "₫" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, member, loading, memberError, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  useEffect(() => setMenuOpen(false), [pathname]);

  if (loading || !session) return <Spinner label="Đang kiểm tra đăng nhập…" />;

  if (!member) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="card max-w-md p-6 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Không có quyền truy cập</h1>
          <p className="mt-2 text-sm text-slate-600">{memberError}</p>
          <p className="mt-1 text-xs text-slate-500">Email: {session.user.email}</p>
          <button className="btn-secondary mt-5" onClick={signOut}>Đăng xuất</button>
        </div>
      </div>
    );
  }

  const nav = (
    <nav className="space-y-1">
      {NAV.map((n) => {
        const active = pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <span className="w-5 text-center text-base" aria-hidden>{n.icon}</span>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  const userBox = (
    <div className="border-t border-slate-200 pt-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
          {(member.full_name || member.email || "?").trim().charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{member.full_name || member.email}</p>
          <span
            className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${
              isAdmin ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            {isAdmin ? "Quản trị (Admin)" : "Thành viên (Member)"}
          </span>
        </div>
      </div>
      <button onClick={signOut} className="btn-secondary mt-3 w-full">Đăng xuất</button>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-r border-slate-200 bg-white p-4 lg:flex">
        <div>
          <div className="mb-6 flex items-center gap-2 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">DA</div>
            <span className="font-semibold text-slate-900">Quản lý Dự án</span>
          </div>
          {nav}
        </div>
        {userBox}
      </aside>

      {/* Topbar mobile */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <span className="font-semibold text-slate-900">Quản lý Dự án</span>
        <button className="btn-secondary px-2.5 py-1.5" onClick={() => setMenuOpen((v) => !v)} aria-label="Mở menu">☰</button>
      </header>
      {menuOpen && (
        <div className="border-b border-slate-200 bg-white p-4 lg:hidden">
          {nav}
          <div className="mt-4">{userBox}</div>
        </div>
      )}

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
