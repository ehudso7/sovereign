"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";

interface MemberWithUser {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

const ROLES = ["org_owner", "org_admin", "org_member", "org_billing_admin", "org_security_admin"];

export default function MembersPage() {
  const { user, org, token, role, isLoading } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [error, setError] = useState("");
  const canManage = role === "org_owner" || role === "org_admin";

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/sign-in");
  }, [isLoading, user, router]);

  const loadMembers = useCallback(async () => {
    if (!org || !token) return;
    const result = await apiFetch<MemberWithUser[]>(
      `/api/v1/orgs/${org.id}/members`,
      { token },
    );
    if (result.ok) setMembers(result.data);
  }, [org, token]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!org || !token) return;
    setError("");

    const result = await apiFetch(`/api/v1/orgs/${org.id}/members/${userId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ role: newRole }),
    });

    if (result.ok) {
      loadMembers();
    } else {
      setError(result.error.message);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!org || !token) return;
    setError("");

    const result = await apiFetch(`/api/v1/orgs/${org.id}/members/${userId}`, {
      method: "DELETE",
      token,
    });

    if (result.ok) {
      loadMembers();
    } else {
      setError(result.error.message);
    }
  };

  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Members</h1>
          {canManage && (
            <a
              href="/settings/invite"
              className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700"
            >
              Invite Member
            </a>
          )}
        </div>

        {error && (
          <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="rounded-lg border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                {canManage && <th className="px-4 py-3 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-gray-100">
                  <td className="px-4 py-3">{member.user.name}</td>
                  <td className="px-4 py-3 text-gray-500">{member.user.email}</td>
                  <td className="px-4 py-3">
                    {canManage && member.userId !== user?.id ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r.replace("org_", "")}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-gray-500">
                        {member.role.replace("org_", "")}
                      </span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      {member.userId !== user?.id && (
                        <button
                          onClick={() => handleRemove(member.userId)}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
