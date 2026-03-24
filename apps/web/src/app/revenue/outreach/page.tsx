"use client";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface OutreachDraft { id: string; channel: string; subject: string | null; body: string; approvalStatus: string; linkedEntityType: string | null; createdAt: string; }

export default function OutreachPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [drafts, setDrafts] = useState<OutreachDraft[]>([]);
  const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [contactName, setContactName] = useState(""); const [accountName, setAccountName] = useState("");
  const [context, setContext] = useState(""); const [channel, setChannel] = useState("email");

  useEffect(() => { if (!isLoading && !user) router.push("/auth/sign-in"); }, [isLoading, user, router]);
  useEffect(() => { if (!token) return; apiFetch<OutreachDraft[]>("/api/v1/revenue/outreach-drafts", { token }).then((r) => { if (r.ok) setDrafts(r.data); else setError(r.error.message); setLoading(false); }); }, [token]);
  if (isLoading || !user) return null;
  const canGenerate = role === "org_owner" || role === "org_admin" || role === "org_member";

  const handleGenerate = async () => {
    setGenerating(true); setError(null);
    const result = await apiFetch<OutreachDraft>("/api/v1/revenue/outreach-drafts/generate", {
      method: "POST", token: token ?? undefined, body: JSON.stringify({ channel, contactName: contactName || undefined, accountName: accountName || undefined, context: context || undefined }),
    });
    setGenerating(false);
    if (result.ok) setDrafts([result.data, ...drafts]); else setError(result.error.message);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">Outreach Drafts</h1><p className="text-gray-500"><Link href="/revenue" className="text-blue-600 hover:underline">Revenue</Link> / Outreach</p></div>
        {error && <div className="rounded bg-red-100 p-4 text-red-700">{error}</div>}
        {canGenerate && (
          <div className="rounded border border-gray-200 p-4 space-y-3">
            <h2 className="text-lg font-semibold">Generate Draft</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="mb-1 block text-sm font-medium">Contact Name</label><input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-sm font-medium">Account Name</label><input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></div>
            </div>
            <div><label className="mb-1 block text-sm font-medium">Context</label><textarea value={context} onChange={(e) => setContext(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" rows={2} placeholder="Additional context for AI generation..." /></div>
            <div className="flex gap-2">
              <select value={channel} onChange={(e) => setChannel(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-sm"><option value="email">Email</option><option value="linkedin">LinkedIn</option></select>
              <button onClick={handleGenerate} disabled={generating} className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50">{generating ? "Generating..." : "Generate"}</button>
            </div>
          </div>
        )}
        {loading ? <div className="text-gray-500">Loading...</div> : drafts.length === 0 ? <div className="text-gray-500">No drafts yet</div> : (
          <div className="space-y-4">
            {drafts.map((d) => (
              <div key={d.id} className="rounded border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex gap-2 text-xs">
                    <span className="rounded bg-blue-100 px-2 py-1 text-blue-700">{d.channel}</span>
                    <span className={`rounded px-2 py-1 ${d.approvalStatus === "approved" ? "bg-green-100 text-green-700" : d.approvalStatus === "pending_approval" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>{d.approvalStatus}</span>
                  </div>
                  <span className="text-xs text-gray-500">{new Date(d.createdAt).toLocaleString()}</span>
                </div>
                {d.subject && <div className="mb-1 font-medium">{d.subject}</div>}
                <pre className="whitespace-pre-wrap text-sm text-gray-700">{d.body}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
