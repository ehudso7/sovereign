"use client";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface Contact { id: string; firstName: string; lastName: string; email: string | null; title: string | null; phone: string | null; status: string; externalCrmId: string | null; }
interface Note { id: string; title: string | null; content: string; noteType: string; createdAt: string; }

export default function ContactDetailPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter(); const params = useParams();
  const contactId = params.contactId as string;
  const [contact, setContact] = useState<Contact | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");

  useEffect(() => { if (!isLoading && !user) router.push("/auth/sign-in"); }, [isLoading, user, router]);
  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiFetch<Contact>(`/api/v1/revenue/contacts/${contactId}`, { token }),
      apiFetch<Note[]>(`/api/v1/revenue/notes?linkedEntityType=contact&linkedEntityId=${contactId}`, { token }),
    ]).then(([cRes, nRes]) => {
      if (cRes.ok) setContact(cRes.data); else setError(cRes.error.message);
      if (nRes.ok) setNotes(nRes.data);
      setLoading(false);
    });
  }, [token, contactId]);

  if (isLoading || !user) return null;
  const canEdit = role === "org_owner" || role === "org_admin" || role === "org_member";

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    const result = await apiFetch<Note>("/api/v1/revenue/notes", { method: "POST", token: token ?? undefined, body: JSON.stringify({ linkedEntityType: "contact", linkedEntityId: contactId, content: newNote }) });
    if (result.ok) { setNotes([result.data, ...notes]); setNewNote(""); } else setError(result.error.message);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <p className="text-gray-500"><Link href="/revenue/contacts" className="text-blue-600 hover:underline">Contacts</Link> / Detail</p>
        {error && <div className="rounded bg-red-100 p-4 text-red-700">{error}</div>}
        {loading ? <div className="text-gray-500">Loading...</div> : !contact ? <div>Not found</div> : (
          <>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">{contact.firstName} {contact.lastName}</h1>
              <div className="flex gap-2">
                <span className={`rounded px-2 py-1 text-xs ${contact.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{contact.status}</span>
                {contact.externalCrmId && <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700">Synced</span>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-sm text-gray-500">Email</span><div>{contact.email || "-"}</div></div>
              <div><span className="text-sm text-gray-500">Title</span><div>{contact.title || "-"}</div></div>
              <div><span className="text-sm text-gray-500">Phone</span><div>{contact.phone || "-"}</div></div>
            </div>
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Notes</h2>
              {canEdit && <div className="flex gap-2"><input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note..." className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm" /><button onClick={handleAddNote} className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700">Add</button></div>}
              {notes.map((n) => (<div key={n.id} className="rounded border border-gray-200 p-3"><div className="text-xs text-gray-500">{n.noteType} - {new Date(n.createdAt).toLocaleString()}</div><p className="mt-1 text-sm">{n.content}</p></div>))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
