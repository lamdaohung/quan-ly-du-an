-- =====================================================================
--  Cấu trúc 4 bảng mà ứng dụng sử dụng + phân quyền (Row Level Security)
--  Script an toàn khi chạy lại: chỉ tạo bảng / thêm cột nếu chưa có.
--  Chạy trong Supabase Dashboard → SQL Editor.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- members ----------
create table if not exists public.members (
  id uuid primary key default gen_random_uuid()
);
alter table public.members add column if not exists user_id    uuid references auth.users(id) on delete set null;
alter table public.members add column if not exists email      text;
alter table public.members add column if not exists full_name  text;
alter table public.members add column if not exists role       text not null default 'Member';
alter table public.members add column if not exists created_at timestamptz not null default now();
create unique index if not exists members_email_key on public.members (lower(email));

-- ---------- projects ----------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid()
);
alter table public.projects add column if not exists name        text not null default 'Dự án mới';
alter table public.projects add column if not exists description text;
alter table public.projects add column if not exists start_date  date;
alter table public.projects add column if not exists end_date    date;
alter table public.projects add column if not exists status      text not null default 'Đang thực hiện';
alter table public.projects add column if not exists created_at  timestamptz not null default now();

-- ---------- tasks ----------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid()
);
alter table public.tasks add column if not exists project_id  uuid references public.projects(id) on delete cascade;
alter table public.tasks add column if not exists title       text not null default 'Đầu việc mới';
alter table public.tasks add column if not exists assignee_id uuid references public.members(id) on delete set null;
alter table public.tasks add column if not exists start_date  date;
alter table public.tasks add column if not exists due_date    date;
alter table public.tasks add column if not exists progress    integer not null default 0;
alter table public.tasks add column if not exists created_at  timestamptz not null default now();

-- ---------- expenses (mỗi dòng = một hạng mục ngân sách) ----------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid()
);
alter table public.expenses add column if not exists project_id       uuid references public.projects(id) on delete cascade;
alter table public.expenses add column if not exists category         text not null default 'Khác';
alter table public.expenses add column if not exists estimated_amount numeric not null default 0;
alter table public.expenses add column if not exists actual_amount    numeric not null default 0;
alter table public.expenses add column if not exists approved         boolean not null default false;
alter table public.expenses add column if not exists note             text;
alter table public.expenses add column if not exists created_at       timestamptz not null default now();

-- =====================================================================
--  Hàm trợ giúp: thành viên hiện tại & quyền Admin
-- =====================================================================
create or replace function public.current_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.members
  where user_id = auth.uid() or lower(email) = lower(auth.jwt() ->> 'email')
  limit 1
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members
    where (user_id = auth.uid() or lower(email) = lower(auth.jwt() ->> 'email'))
      and role = 'Admin'
  )
$$;

-- =====================================================================
--  RLS
-- =====================================================================
alter table public.members  enable row level security;
alter table public.projects enable row level security;
alter table public.tasks    enable row level security;
alter table public.expenses enable row level security;

-- Mọi người đã đăng nhập đều được xem
drop policy if exists "read members"  on public.members;
drop policy if exists "read projects" on public.projects;
drop policy if exists "read tasks"    on public.tasks;
drop policy if exists "read expenses" on public.expenses;
create policy "read members"  on public.members  for select to authenticated using (true);
create policy "read projects" on public.projects for select to authenticated using (true);
create policy "read tasks"    on public.tasks    for select to authenticated using (true);
create policy "read expenses" on public.expenses for select to authenticated using (true);

-- members: chỉ Admin thêm/sửa/xoá
drop policy if exists "admin write members" on public.members;
create policy "admin write members" on public.members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- projects: chỉ Admin
drop policy if exists "admin write projects" on public.projects;
create policy "admin write projects" on public.projects for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- tasks: Admin toàn quyền; Member chỉ UPDATE task được giao (cột bị giới hạn bởi trigger bên dưới)
drop policy if exists "admin write tasks"  on public.tasks;
drop policy if exists "member update task" on public.tasks;
create policy "admin write tasks" on public.tasks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "member update task" on public.tasks for update to authenticated
  using (assignee_id = public.current_member_id())
  with check (assignee_id = public.current_member_id());

-- expenses: Admin toàn quyền; Member được thêm khoản phát sinh & cập nhật thực chi
drop policy if exists "admin write expenses"  on public.expenses;
drop policy if exists "member insert expense" on public.expenses;
drop policy if exists "member update expense" on public.expenses;
create policy "admin write expenses" on public.expenses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "member insert expense" on public.expenses for insert to authenticated
  with check (public.current_member_id() is not null and estimated_amount = 0 and approved = false);
create policy "member update expense" on public.expenses for update to authenticated
  using (public.current_member_id() is not null) with check (public.current_member_id() is not null);

-- =====================================================================
--  Trigger: Member chỉ được đổi đúng các cột cho phép
-- =====================================================================
create or replace function public.guard_member_task_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if new.title is distinct from old.title
     or new.project_id is distinct from old.project_id
     or new.assignee_id is distinct from old.assignee_id
     or new.start_date is distinct from old.start_date
     or new.due_date is distinct from old.due_date then
    raise exception 'Thành viên chỉ được cập nhật phần trăm tiến độ';
  end if;
  new.progress := greatest(0, least(100, new.progress));
  return new;
end $$;
drop trigger if exists trg_guard_member_task_update on public.tasks;
create trigger trg_guard_member_task_update before update on public.tasks
  for each row execute function public.guard_member_task_update();

create or replace function public.guard_member_expense_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if new.estimated_amount is distinct from old.estimated_amount
     or new.approved is distinct from old.approved
     or new.project_id is distinct from old.project_id
     or new.category is distinct from old.category then
    raise exception 'Thành viên chỉ được nhập chi phí thực tế';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_member_expense_update on public.expenses;
create trigger trg_guard_member_expense_update before update on public.expenses
  for each row execute function public.guard_member_expense_update();

-- =====================================================================
--  Ví dụ thêm thành viên (sửa email cho đúng team của bạn)
-- =====================================================================
-- insert into public.members (email, full_name, role) values
--   ('admin@congty.vn', 'Nguyễn Văn A', 'Admin'),
--   ('thanhvien1@congty.vn', 'Trần Thị B', 'Member');
