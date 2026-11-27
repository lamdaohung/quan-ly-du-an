"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Member } from "./types";

interface AuthState {
  session: Session | null;
  member: Member | null;
  loading: boolean;
  isAdmin: boolean;
  memberError: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function findMember(session: Session): Promise<{ member: Member | null; error: string | null }> {
  const email = session.user.email?.toLowerCase() ?? "";
  let { data, error } = await supabase.from("members").select("*").eq("user_id", session.user.id).limit(1).maybeSingle();
  if (!error && !data && email) {
    const escaped = email.replace(/[\\%_]/g, (c) => `\\${c}`);
    ({ data, error } = await supabase.from("members").select("*").ilike("email", escaped).limit(1).maybeSingle());
  }
  if (error) return { member: null, error: error.message };
  if (!data) return { member: null, error: "Tài khoản của bạn chưa có trong danh sách thành viên. Vui lòng liên hệ Admin." };
  const member = data as Member;
  // Liên kết user_id ở lần đăng nhập đầu tiên (bỏ qua lỗi nếu RLS không cho phép)
  if (!member.user_id) {
    await supabase.from("members").update({ user_id: session.user.id }).eq("id", member.id);
  }
  member.role = String(member.role).toLowerCase() === "admin" ? "Admin" : "Member";
  return { member, error: null };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) {
      setMember(null);
      setMemberError(null);
      setLoading(false);
      return;
    }
    const { member, error } = await findMember(s);
    setMember(member);
    setMemberError(error);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        // tránh gọi supabase đồng bộ bên trong callback
        setTimeout(() => load(s), 0);
      } else {
        setSession(s);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, member, loading, memberError, isAdmin: member?.role === "Admin", signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải nằm trong AuthProvider");
  return ctx;
}
