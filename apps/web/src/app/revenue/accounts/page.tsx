"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface Account {
  id: string; name: string; domain: string | null; industry: string | null;
  status: string; ownerId: string | null; createdAt: string;
}

export default function AccountsPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!isLoading && !user) router.push("/auth/sign-in"); }, [isLoading, user, router]);
  useEffect(() => {
    if (!token) return;
    apiFetch<Account[]>("/api/v1/revenue/accounts", { token }).then((r) => {
      if (r.ok) setAccounts(r.data); else setError(r.error.message);
      setLoading(false);
    });
  }, [token]);

  if (isLoading || !user) return null;
  const canCreate = role === "org_owner" || role === "org_admin" || role === "org_member";

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Accounts</h1>
            <p className="text-gray-500"><Link href="/revenue" className="text-blue-600 hover:underline">Revenue</Link> / Accounts</p>
          </div>
          {canCreate && (
            <Link href="/revenue/accounts/new" className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700">New Account</Link>
          )}
        </div>
        {error && <div className="rounded bg-red-100 p-4 text-red-700">{error}</div>}
        {loading ? <div className="text-gray-500">Loading...</div> : accounts.length === 0 ? (
          <div className="text-gray-500">No accounts yet</div>
        ) : (
          <div className="overflow-hidden rounded border border-gray-200">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Domain</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Industry</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4"><Link href={`/revenue/accounts/${a.id}`} className="text-blue-600 hover:underline">{a.name}</Link></td>
                    <td className="px-6 py-4 text-sm text-gray-600">{a.domain || "-"}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{a.industry || "-"}</td>
                    <td className="px-6 py-4 text-sm"><span className={`rounded px-2 py-1 text-xs ${a.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{a.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
