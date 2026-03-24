"use client";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

export default function NewDealPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(""); const [stage, setStage] = useState("discovery");
  const [valueCents, setValueCents] = useState(""); const [probability, setProbability] = useState("");
  const [error, setError] = useState<string | null>(null); const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (!isLoading && !user) router.push("/auth/sign-in"); }, [isLoading, user, router]);
  if (isLoading || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSubmitting(true);
    const result = await apiFetch("/api/v1/revenue/deals", { method: "POST", token: token ?? undefined, body: JSON.stringify({
      name, stage, valueCents: valueCents ? parseInt(valueCents, 10) : undefined,
      probability: probability ? parseInt(probability, 10) : undefined,
    }) });
    setSubmitting(false);
    if (result.ok) router.push("/revenue/deals"); else setError(result.error.message);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">New Deal</h1><p className="text-gray-500"><Link href="/revenue/deals" className="text-blue-600 hover:underline">Deals</Link> / New</p></div>
        {error && <div className="rounded bg-red-100 p-4 text-red-700">{error}</div>}
        <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
          <div><label className="mb-1 block text-sm font-medium">Name *</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></div>
          <div><label className="mb-1 block text-sm font-medium">Stage</label>
            <select value={stage} onChange={(e) => setStage(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm">
              <option value="discovery">Discovery</option><option value="qualification">Qualification</option><option value="proposal">Proposal</option><option value="negotiation">Negotiation</option><option value="closed_won">Closed Won</option><option value="closed_lost">Closed Lost</option>
            </select></div>
          <div><label className="mb-1 block text-sm font-medium">Value (cents)</label><input type="number" value={valueCents} onChange={(e) => setValueCents(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></div>
          <div><label className="mb-1 block text-sm font-medium">Probability (%)</label><input type="number" min="0" max="100" value={probability} onChange={(e) => setProbability(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></div>
          <button type="submit" disabled={submitting} className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50">{submitting ? "Creating..." : "Create Deal"}</button>
        </form>
      </div>
    </AppShell>
  );
}
