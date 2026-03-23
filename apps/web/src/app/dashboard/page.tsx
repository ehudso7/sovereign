"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";

interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export default function DashboardPage() {
  const { user, org, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (token) {
      apiFetch<Project[]>("/api/v1/projects", { token }).then((result) => {
        if (result.ok) setProjects(result.data);
      });
    }
  }, [token]);

  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500">
            {org?.name} &mdash; {role}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="font-medium">User</h3>
            <p className="text-sm text-gray-500">{user.email}</p>
            <p className="text-sm text-gray-500">{user.name}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="font-medium">Organization</h3>
            <p className="text-sm text-gray-500">{org?.name ?? "None"}</p>
            <p className="text-sm text-gray-500">{org?.slug ?? ""}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="font-medium">Projects</h3>
            <p className="text-sm text-gray-500">{projects.length} projects</p>
          </div>
        </div>

        {projects.length > 0 && (
          <div>
            <h2 className="mb-3 text-lg font-semibold">Projects</h2>
            <div className="space-y-2">
              {projects.map((p) => (
                <div key={p.id} className="rounded border border-gray-200 p-3">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-gray-500">{p.slug}</p>
                  {p.description && (
                    <p className="text-sm text-gray-400">{p.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
