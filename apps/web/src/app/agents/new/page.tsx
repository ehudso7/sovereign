"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  slug: string;
}

export default function CreateAgentPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canCreate = role === "org_owner" || role === "org_admin";

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
    if (!isLoading && user && !canCreate) {
      router.push("/agents");
    }
  }, [isLoading, user, canCreate, router]);

  useEffect(() => {
    if (token) {
      apiFetch<Project[]>("/api/v1/projects", { token }).then((result) => {
        if (result.ok) {
          setProjects(result.data);
          if (result.data.length > 0) setProjectId(result.data[0]!.id);
        }
      });
    }
  }, [token]);

  const handleNameChange = (value: string) => {
    setName(value);
    setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !projectId) return;

    setSubmitting(true);
    setError(null);

    const result = await apiFetch<{ id: string }>("/api/v1/agents", {
      method: "POST",
      token,
      body: JSON.stringify({ name, slug, description: description || undefined, projectId }),
    });

    if (result.ok) {
      router.push(`/agents/${result.data.id}`);
    } else {
      setError(result.error.message);
      setSubmitting(false);
    }
  };

  if (isLoading || !user) return null;

  if (!canCreate) {
    return (
      <AppShell>
        <div className="rounded border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-700">Forbidden</p>
          <p className="text-sm text-red-600">You do not have permission to create agents.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link href="/agents" className="text-sm text-gray-500 hover:text-gray-700">
            &larr; Back to Agents
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Create Agent</h1>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              required
            >
              {projects.length === 0 && <option value="">No projects available</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              required
              maxLength={255}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              required
              maxLength={63}
              pattern="[a-z0-9-]+"
            />
            <p className="mt-1 text-xs text-gray-400">Lowercase letters, numbers, and hyphens only</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              rows={3}
              maxLength={2000}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !projectId || !name || !slug}
            className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Agent"}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
