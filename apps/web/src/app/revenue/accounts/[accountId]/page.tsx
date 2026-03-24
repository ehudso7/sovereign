"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface Account {
  id: string; name: string; domain: string | null; industry: string | null;
  status: string; notes: string | null; externalCrmId: string | null;
  createdAt: string; updatedAt: string;
}
interface Note { id: string; title: string | null; content: string; noteType: string; createdAt: string; }

export default function AccountDetailPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const accountId = params.accountId as string;
  const [account, setAccount] = useState<Account | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDomain, setEditDomain] = useState("");
  const [editIndustry, setEditIndustry] = useState("");
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("general");

  useEffect(() => { if (!isLoading && !user) router.push("/auth/sign-in"); }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiFetch<Account>(`/api/v1/revenue/accounts/${accountId}`, { token }),
      apiFetch<Note[]>(`/api/v1/revenue/notes?linkedEntityType=account&linkedEntityId=${accountId}`, { token }),
    ]).then(([accRes, notesRes]) => {
      if (accRes.ok) { setAccount(accRes.data); setEditName(accRes.data.name); setEditDomain(accRes.data.domain || ""); setEditIndustry(accRes.data.industry || ""); }
      else setError(accRes.error.message);
      if (notesRes.ok) setNotes(notesRes.data);
      setLoading(false);
    });
  }, [token, accountId]);

  if (isLoading || !user) return null;
  const canEdit = role === "org_owner" || role === "org_admin" || role === "org_member";

  const handleSave = async () => {
    const result = await apiFetch<Account>(`/api/v1/revenue/accounts/${accountId}`, {
      method: "PATCH", token: token ?? undefined, body: JSON.stringify({ name: editName, domain: editDomain || undefined, industry: editIndustry || undefined }),
    });
    if (result.ok) { setAccount(result.data); setEditing(false); }
    else setError(result.error.message);
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    const result = await apiFetch<Note>("/api/v1/revenue/notes", {
      method: "POST", token: token ?? undefined, body: JSON.stringify({ linkedEntityType: "account", linkedEntityId: accountId, content: newNote, noteType }),
    });
    if (result.ok) { setNotes([result.data, ...notes]); setNewNote(""); }
    else setError(result.error.message);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <p className="text-gray-500"><Link href="/revenue/accounts" className="text-blue-600 hover:underline">Accounts</Link> / Detail</p>
        {error && <div className="rounded bg-red-100 p-4 text-red-700">{error}</div>}
        {loading ? <div className="text-gray-500">Loading...</div> : !account ? <div className="text-gray-500">Account not found</div> : (
          <>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">{account.name}</h1>
              <div className="flex gap-2">
                {canEdit && !editing && <button onClick={() => setEditing(true)} className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50">Edit</button>}
                <span className={`rounded px-2 py-1 text-xs ${account.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{account.status}</span>
                {account.externalCrmId && <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700">Synced</span>}
              </div>
            </div>
            {editing ? (
              <div className="max-w-lg space-y-4 rounded border border-gray-200 p-4">
                <div><label className="mb-1 block text-sm font-medium">Name</label><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></div>
                <div><label className="mb-1 block text-sm font-medium">Domain</label><input type="text" value={editDomain} onChange={(e) => setEditDomain(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></div>
                <div><label className="mb-1 block text-sm font-medium">Industry</label><input type="text" value={editIndustry} onChange={(e) => setEditIndustry(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></div>
                <div className="flex gap-2"><button onClick={handleSave} className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700">Save</button><button onClick={() => setEditing(false)} className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Cancel</button></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-sm text-gray-500">Domain</span><div>{account.domain || "-"}</div></div>
                <div><span className="text-sm text-gray-500">Industry</span><div>{account.industry || "-"}</div></div>
              </div>
            )}
            {account.notes && <div className="rounded border border-gray-200 p-4"><h3 className="mb-1 text-sm font-medium text-gray-500">Account Notes</h3><p>{account.notes}</p></div>}

            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Notes</h2>
              {canEdit && (
                <div className="flex gap-2">
                  <select value={noteType} onChange={(e) => setNoteType(e.target.value)} className="rounded border border-gray-300 px-2 py-2 text-sm">
                    <option value="general">General</option><option value="meeting">Meeting</option><option value="call">Call</option><option value="email">Email</option>
                  </select>
                  <input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note..." className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm" />
                  <button onClick={handleAddNote} className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700">Add</button>
                </div>
              )}
              {notes.length === 0 ? <div className="text-sm text-gray-500">No notes yet</div> : notes.map((n) => (
                <div key={n.id} className="rounded border border-gray-200 p-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500"><span className="rounded bg-gray-100 px-1">{n.noteType}</span><span>{new Date(n.createdAt).toLocaleString()}</span></div>
                  {n.title && <div className="mt-1 font-medium">{n.title}</div>}
                  <p className="mt-1 text-sm">{n.content}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
