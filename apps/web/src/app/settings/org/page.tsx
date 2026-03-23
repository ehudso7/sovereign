"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";

export default function OrgSettingsPage() {
  const { user, org, token, role, isLoading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canEdit = role === "org_owner" || role === "org_admin";

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/sign-in");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (org) setName(org.name);
  }, [org]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!org || !token) return;

    const result = await apiFetch(`/api/v1/orgs/${org.id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ name }),
    });

    if (result.ok) {
      setMessage("Organization updated.");
    } else {
      setError(result.error.message);
    }
  };

  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Organization Settings</h1>

        {message && (
          <div className="rounded bg-green-50 p-3 text-sm text-green-700">{message}</div>
        )}
        {error && (
          <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="rounded-lg border border-gray-200 p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Organization Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEdit}
                className="mt-1 block w-full max-w-md rounded border border-gray-300 px-3 py-2 disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Slug</label>
              <p className="mt-1 text-sm text-gray-500">{org?.slug}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Plan</label>
              <p className="mt-1 text-sm text-gray-500">{org?.plan}</p>
            </div>
            {canEdit && (
              <button
                type="submit"
                className="rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-700"
              >
                Save Changes
              </button>
            )}
          </form>
        </div>
      </div>
    </AppShell>
  );
}
