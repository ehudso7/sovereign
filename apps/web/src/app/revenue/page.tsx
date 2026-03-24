"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface RevenueOverview {
  accountCount: number;
  contactCount: number;
  dealCount: number;
  taskCount: number;
  openDealValueCents: number;
  dealsByStage: Record<string, number>;
  openTaskCount: number;
  recentSyncCount: number;
}

export default function RevenueOverviewPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [overview, setOverview] = useState<RevenueOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/sign-in");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    apiFetch<RevenueOverview>("/api/v1/revenue/overview", { token }).then((r) => {
      if (r.ok) setOverview(r.data);
      else setError(r.error.message);
      setLoading(false);
    });
  }, [token]);

  if (isLoading || !user) return null;

  const canWrite = role === "org_owner" || role === "org_admin" || role === "org_member";

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Revenue Workspace</h1>
            <p className="text-gray-500">Manage accounts, contacts, deals, and tasks</p>
          </div>
        </div>

        {error && <div className="rounded bg-red-100 p-4 text-red-700">{error}</div>}

        {loading ? (
          <div className="text-gray-500">Loading...</div>
        ) : overview ? (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Link href="/revenue/accounts" className="rounded border border-gray-200 p-4 hover:bg-gray-50">
                <div className="text-2xl font-bold">{overview.accountCount}</div>
                <div className="text-sm text-gray-500">Accounts</div>
              </Link>
              <Link href="/revenue/contacts" className="rounded border border-gray-200 p-4 hover:bg-gray-50">
                <div className="text-2xl font-bold">{overview.contactCount}</div>
                <div className="text-sm text-gray-500">Contacts</div>
              </Link>
              <Link href="/revenue/deals" className="rounded border border-gray-200 p-4 hover:bg-gray-50">
                <div className="text-2xl font-bold">{overview.dealCount}</div>
                <div className="text-sm text-gray-500">Deals</div>
              </Link>
              <Link href="/revenue/tasks" className="rounded border border-gray-200 p-4 hover:bg-gray-50">
                <div className="text-2xl font-bold">{overview.taskCount}</div>
                <div className="text-sm text-gray-500">Tasks ({overview.openTaskCount} open)</div>
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded border border-gray-200 p-4">
                <h2 className="mb-2 text-lg font-semibold">Pipeline Value</h2>
                <div className="text-3xl font-bold">${(overview.openDealValueCents / 100).toLocaleString()}</div>
                <div className="mt-2 space-y-1">
                  {Object.entries(overview.dealsByStage).map(([stage, count]) => (
                    <div key={stage} className="flex justify-between text-sm">
                      <span className="text-gray-600">{stage}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded border border-gray-200 p-4">
                <h2 className="mb-2 text-lg font-semibold">Quick Actions</h2>
                <div className="space-y-2">
                  {canWrite && (
                    <>
                      <Link href="/revenue/accounts/new" className="block rounded bg-gray-900 px-4 py-2 text-center text-sm text-white hover:bg-gray-700">
                        New Account
                      </Link>
                      <Link href="/revenue/deals/new" className="block rounded border border-gray-300 px-4 py-2 text-center text-sm hover:bg-gray-50">
                        New Deal
                      </Link>
                      <Link href="/revenue/outreach" className="block rounded border border-gray-300 px-4 py-2 text-center text-sm hover:bg-gray-50">
                        Generate Outreach
                      </Link>
                    </>
                  )}
                  <div className="text-xs text-gray-400">Sync operations: {overview.recentSyncCount}</div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
