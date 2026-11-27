export type Role = "Admin" | "Member";

export interface Member {
  id: string;
  user_id: string | null;
  email: string | null;
  full_name: string | null;
  role: Role;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  total_budget: number | null;
  created_at?: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  assignee_id: string | null;
  start_date: string | null;
  due_date: string | null;
  progress: number;
}

export interface Expense {
  id: string;
  project_id: string;
  item_name: string;
  task_id: string | null;
  spent_date: string | null;
  estimated_amount: number;
  actual_amount: number;
  approved: boolean | null;
  note: string | null;
}
