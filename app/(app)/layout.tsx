"use client";

import { AppShell } from "@/components/AppShell";
import { DataProvider } from "@/lib/data-context";
import { useAuth } from "@/lib/auth-context";

function Inner({ children }: { children: React.ReactNode }) {
  const { member } = useAuth();
  // Chỉ tải dữ liệu khi đã xác định được thành viên
  return member ? <DataProvider>{children}</DataProvider> : <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <Inner>{children}</Inner>
    </AppShell>
  );
}
