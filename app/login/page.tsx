"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { errorMessage } from "@/lib/format";

type Mode = "password" | "magic";

export default function LoginPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) router.replace("/dashboard");
  }, [loading, session, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "password") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: `${window.location.origin}/dashboard`, shouldCreateUser: true },
        });
        if (error) throw error;
        setInfo("Đã gửi liên kết đăng nhập. Vui lòng kiểm tra hộp thư email của bạn.");
      }
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg.includes("Invalid login credentials") ? "Email hoặc mật khẩu không đúng." : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white">
            DA
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Quản lý Dự án</h1>
          <p className="mt-1 text-sm text-slate-500">Đăng nhập để tiếp tục làm việc cùng team</p>
        </div>

        <div className="card p-6">
          {!isSupabaseConfigured && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              Chưa cấu hình <code>NEXT_PUBLIC_SUPABASE_URL</code> và <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> trong
              file <code>.env.local</code>.
            </div>
          )}

          <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm">
            {(["password", "magic"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-md py-1.5 font-medium transition ${
                  mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {m === "password" ? "Email & mật khẩu" : "Liên kết qua email"}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className="input"
                placeholder="ten@congty.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {mode === "password" && (
              <div>
                <label className="label" htmlFor="password">Mật khẩu</label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}

            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {info && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{info}</p>}

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? "Đang xử lý…" : mode === "password" ? "Đăng nhập" : "Gửi liên kết đăng nhập"}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          Chỉ thành viên có trong danh sách team mới truy cập được dữ liệu.
        </p>
      </div>
    </div>
  );
}
