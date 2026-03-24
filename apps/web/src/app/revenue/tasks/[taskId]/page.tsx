"use client";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface Task { id: string; title: string; description: string | null; status: string; priority: string; dueAt: string | null; linkedEntityType: string | null; linkedEntityId: string | null; }

export default function TaskDetailPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter(); const params = useParams();
  const taskId = params.taskId as string;
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true);

  useEffect(() => { if (!isLoading && !user) router.push("/auth/sign-in"); }, [isLoading, user, router]);
  useEffect(() => { if (!token) return; apiFetch<Task>(`/api/v1/revenue/tasks/${taskId}`, { token }).then((r) => { if (r.ok) setTask(r.data); else setError(r.error.message); setLoading(false); }); }, [token, taskId]);
  if (isLoading || !user) return null;
  const canEdit = role === "org_owner" || role === "org_admin" || role === "org_member";

  const updateStatus = async (status: string) => {
    const result = await apiFetch<Task>(`/api/v1/revenue/tasks/${taskId}`, { method: "PATCH", token: token ?? undefined, body: JSON.stringify({ status }) });
    if (result.ok) setTask(result.data); else setError(result.error.message);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <p className="text-gray-500"><Link href="/revenue/tasks" className="text-blue-600 hover:underline">Tasks</Link> / Detail</p>
        {error && <div className="rounded bg-red-100 p-4 text-red-700">{error}</div>}
        {loading ? <div className="text-gray-500">Loading...</div> : !task ? <div>Not found</div> : (
          <>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">{task.title}</h1>
              <div className="flex gap-2">
                <span className={`rounded px-2 py-1 text-xs ${task.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{task.status}</span>
                <span className={`rounded px-2 py-1 text-xs ${task.priority === "urgent" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>{task.priority}</span>
              </div>
            </div>
            {task.description && <p className="text-gray-600">{task.description}</p>}
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-sm text-gray-500">Due</span><div>{task.dueAt ? new Date(task.dueAt).toLocaleString() : "-"}</div></div>
              {task.linkedEntityType && <div><span className="text-sm text-gray-500">Linked</span><div>{task.linkedEntityType}: {task.linkedEntityId}</div></div>}
            </div>
            {canEdit && task.status !== "completed" && (
              <div className="flex gap-2">
                {task.status === "open" && <button onClick={() => updateStatus("in_progress")} className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50">Start</button>}
                <button onClick={() => updateStatus("completed")} className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700">Complete</button>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
