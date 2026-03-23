"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";

const ROLES = ["org_member", "org_admin", "org_billing_admin", "org_security_admin"];

export default function InvitePage() {
  const { user, org, token, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("org_member");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/sign-in");
  }, [isLoading, user, router]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!org || !token) return;

    const result = await apiFetch(`/api/v1/orgs/${org.id}/invitations`, {
      method: "POST",
      token,
      body: JSON.stringify({ email, role }),
    });

    if (result.ok) {
      setMessage(`Invitation sent to ${email}`);
      setEmail("");
    } else {
      setError(result.error.message);
    }
  };

  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Invite Member</h1>

        {message && (
          <div className="rounded bg-green-50 p-3 text-sm text-green-700">{message}</div>
        )}
        {error && (
          <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="rounded-lg border border-gray-200 p-6">
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 block w-full max-w-md rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 block w-full max-w-md rounded border border-gray-300 px-3 py-2"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.replace("org_", "")}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-700"
              >
                Send Invitation
              </button>
              <button
                type="button"
                onClick={() => router.push("/settings/members")}
                className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
