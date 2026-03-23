"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface Agent {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: "draft" | "published" | "archived";
  projectId: string;
  createdAt: string;
}

export default function AgentsPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const query = statusFilter ? `?status=${statusFilter}` : "";
    apiFetch<Agent[]>(`/api/v1/agents${query}`, { token }).then((result) => {
      if (result.ok) {
        setAgents(result.data);
      } else {
        setError(result.error.message);
      }
      setLoading(false);
    });
  }, [token, statusFilter]);

  if (isLoading || !user) return null;

  const canCreate = role === "org_owner" || role === "org_admin";

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-700",
      published: "bg-green-100 text-green-700",
      archived: "bg-red-100 text-red-700",
    };
    return (
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100"}`}>
        {status}
      </span>
    );
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Agents</h1>
            <p className="text-gray-500">Manage your AI agents</p>
          </div>
          {canCreate && (
            <Link
              href="/agents/new"
              className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700"
            >
              Create Agent
            </Link>
          )}
        </div>

        <div className="flex gap-2">
          {["", "draft", "published", "archived"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded px-3 py-1 text-sm ${
                statusFilter === s
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Loading agents...</p>
        ) : agents.length === 0 ? (
          <div className="rounded border border-gray-200 p-8 text-center text-gray-400">
            No agents yet.{" "}
            {canCreate && (
              <Link href="/agents/new" className="text-gray-600 underline">
                Create your first agent
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {agents.map((agent) => (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                className="block rounded border border-gray-200 p-4 hover:border-gray-300 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-sm text-gray-500">{agent.slug}</p>
                    {agent.description && (
                      <p className="mt-1 text-sm text-gray-400">{agent.description}</p>
                    )}
                  </div>
                  {statusBadge(agent.status)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
