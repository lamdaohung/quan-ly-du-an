# Quản lý Dự án

Ứng dụng web quản lý dự án cho team 9 người, viết bằng **Next.js (App Router) + Tailwind CSS + Supabase**. Giao diện hoàn toàn bằng tiếng Việt.

## Các màn hình

| Đường dẫn | Chức năng |
|---|---|
| `/login` | Đăng nhập bằng email (mật khẩu hoặc liên kết gửi qua email) qua Supabase Auth |
| `/dashboard` | Báo cáo tiến độ: KPI (tổng dự án, tỷ lệ hoàn thành TB, số việc đúng hạn/trễ hạn), biểu đồ cột Dự toán vs Thực chi, xuất **CSV** / **Excel** |
| `/timeline` | Biểu đồ Gantt theo dự án và đầu việc. Việc quá `due_date` mà `progress < 100` được tô đỏ. Lọc theo dự án, người phụ trách, thang Ngày/Tuần/Tháng |
| `/ngan-sach` | So sánh Dự toán (`estimated_amount`) và Thực chi (`actual_amount`) theo hạng mục, tỷ lệ giải ngân. Cảnh báo **cam** khi trên 80% và **đỏ** khi trên 100% tổng ngân sách dự án |

## Phân quyền

| Thao tác | Admin | Member |
|---|:-:|:-:|
| Tạo / sửa / xoá dự án | ✓ | |
| Điều chỉnh timeline, thêm / giao đầu việc | ✓ | |
| Thêm hạng mục, sửa và duyệt ngân sách dự toán | ✓ | |
| Cập nhật % tiến độ **task được giao cho mình** | ✓ | ✓ |
| Nhập chi phí thực tế phát sinh | ✓ | ✓ |
| Xem Dashboard, Timeline, Ngân sách | ✓ | ✓ |

Quyền được kiểm tra ở **giao diện** và ở **database** (Row Level Security và trigger trong `supabase/schema.sql`), nên Member không thể vượt quyền dù gọi API trực tiếp.

## Cài đặt

1. **Cài thư viện**
   ```bash
   npm install
   ```
2. **Cấu hình biến môi trường**: sao chép `.env.local.example` thành `.env.local` rồi điền:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```
3. **Chuẩn bị database**: mở Supabase Dashboard → SQL Editor, chạy file `supabase/schema.sql`.
   Script này an toàn với 4 bảng đã có sẵn: nó chỉ thêm các cột còn thiếu (`add column if not exists`), rồi bật RLS và tạo trigger phân quyền.
4. **Thêm thành viên** vào bảng `members` (email phải trùng với email đăng nhập, `role` là `Admin` hoặc `Member`):
   ```sql
   insert into public.members (email, full_name, role) values
     ('truongnhom@congty.vn', 'Nguyễn Văn A', 'Admin'),
     ('thanhvien1@congty.vn', 'Trần Thị B', 'Member');
   ```
   Tạo tài khoản đăng nhập trong **Authentication → Users** (hoặc để người dùng đăng nhập bằng liên kết email).
   Nếu dùng đăng nhập bằng liên kết, hãy thêm URL của ứng dụng vào **Authentication → URL Configuration → Redirect URLs**.
5. **Chạy ứng dụng**
   ```bash
   npm run dev
   ```
   Mở http://localhost:3000.

> Không bắt buộc: bật **Realtime** cho 4 bảng (Database → Replication) để màn hình của cả team tự cập nhật khi có người thay đổi dữ liệu.

## Cấu trúc cột mà ứng dụng sử dụng

- `members`: `id, user_id, email, full_name, role`
- `projects`: `id, name, description, start_date, end_date, status, total_budget`
- `tasks`: `id, project_id, title, assignee_id → members.id, start_date, due_date, progress (0–100)`
- `expenses`: `id, project_id, item_name, estimated_amount, actual_amount, spent_date, approved, note` (mỗi dòng là một hạng mục ngân sách)

Ngân sách dự án = `projects.total_budget` nếu Admin đã nhập; nếu để trống thì bằng tổng `estimated_amount` của các hạng mục.
Nếu bảng của bạn dùng tên cột khác, hãy sửa trong `lib/types.ts` và các câu truy vấn tương ứng.

## Cấu trúc thư mục

```
app/
  login/              Đăng nhập
  (app)/layout.tsx    Khung ứng dụng (sidebar, bảo vệ đăng nhập, tải dữ liệu)
  (app)/dashboard/    Báo cáo tiến độ
  (app)/timeline/     Biểu đồ Gantt
  (app)/ngan-sach/    Quản lý ngân sách
components/           UI dùng chung, form dự án / đầu việc
lib/                  Supabase client, auth, dữ liệu, định dạng, xuất báo cáo
supabase/schema.sql   Cấu trúc bảng + RLS + trigger phân quyền
```
