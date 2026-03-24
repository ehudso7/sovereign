"use client";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface Task { id: string; title: string; status: string; priority: string; dueAt: string | null; }

export default function TasksPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true);

  useEffect(() => { if (!isLoading && !user) router.push("/auth/sign-in"); }, [isLoading, user, router]);
  useEffect(() => { if (!token) return; apiFetch<Task[]>("/api/v1/revenue/tasks", { token }).then((r) => { if (r.ok) setTasks(r.data); else setError(r.error.message); setLoading(false); }); }, [token]);
  if (isLoading || !user) return null;
  const canCreate = role === "org_owner" || role === "org_admin" || role === "org_member";

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold">Tasks</h1><p className="text-gray-500"><Link href="/revenue" className="text-blue-600 hover:underline">Revenue</Link> / Tasks</p></div>
          {canCreate && <Link href="/revenue/tasks/new" className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700">New Task</Link>}
        </div>
        {error && <div className="rounded bg-red-100 p-4 text-red-700">{error}</div>}
        {loading ? <div className="text-gray-500">Loading...</div> : tasks.length === 0 ? <div className="text-gray-500">No tasks yet</div> : (
          <div className="overflow-hidden rounded border border-gray-200">
            <table className="w-full"><thead className="border-b border-gray-200 bg-gray-50"><tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Title</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Priority</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Due</th>
            </tr></thead><tbody>
              {tasks.map((t) => (<tr key={t.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-4"><Link href={`/revenue/tasks/${t.id}`} className="text-blue-600 hover:underline">{t.title}</Link></td>
                <td className="px-6 py-4 text-sm"><span className={`rounded px-2 py-1 text-xs ${t.status === "completed" ? "bg-green-100 text-green-700" : t.status === "open" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>{t.status}</span></td>
                <td className="px-6 py-4 text-sm"><span className={`rounded px-2 py-1 text-xs ${t.priority === "urgent" ? "bg-red-100 text-red-700" : t.priority === "high" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}>{t.priority}</span></td>
                <td className="px-6 py-4 text-sm text-gray-600">{t.dueAt ? new Date(t.dueAt).toLocaleDateString() : "-"}</td>
              </tr>))}
            </tbody></table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
