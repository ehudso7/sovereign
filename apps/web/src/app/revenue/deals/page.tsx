"use client";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface Deal { id: string; name: string; stage: string; valueCents: number | null; currency: string; probability: number | null; }

export default function DealsPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true);

  useEffect(() => { if (!isLoading && !user) router.push("/auth/sign-in"); }, [isLoading, user, router]);
  useEffect(() => { if (!token) return; apiFetch<Deal[]>("/api/v1/revenue/deals", { token }).then((r) => { if (r.ok) setDeals(r.data); else setError(r.error.message); setLoading(false); }); }, [token]);
  if (isLoading || !user) return null;
  const canCreate = role === "org_owner" || role === "org_admin" || role === "org_member";

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold">Deals</h1><p className="text-gray-500"><Link href="/revenue" className="text-blue-600 hover:underline">Revenue</Link> / Deals</p></div>
          {canCreate && <Link href="/revenue/deals/new" className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700">New Deal</Link>}
        </div>
        {error && <div className="rounded bg-red-100 p-4 text-red-700">{error}</div>}
        {loading ? <div className="text-gray-500">Loading...</div> : deals.length === 0 ? <div className="text-gray-500">No deals yet</div> : (
          <div className="overflow-hidden rounded border border-gray-200">
            <table className="w-full"><thead className="border-b border-gray-200 bg-gray-50"><tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Name</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Stage</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Value</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Probability</th>
            </tr></thead><tbody>
              {deals.map((d) => (<tr key={d.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-4"><Link href={`/revenue/deals/${d.id}`} className="text-blue-600 hover:underline">{d.name}</Link></td>
                <td className="px-6 py-4 text-sm"><span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700">{d.stage}</span></td>
                <td className="px-6 py-4 text-sm text-gray-600">{d.valueCents ? `$${(d.valueCents / 100).toLocaleString()}` : "-"}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{d.probability !== null ? `${d.probability}%` : "-"}</td>
              </tr>))}
            </tbody></table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
