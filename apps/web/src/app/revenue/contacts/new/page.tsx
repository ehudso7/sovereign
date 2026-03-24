"use client";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

export default function NewContactPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [firstName, setFirstName] = useState(""); const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(""); const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null); const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (!isLoading && !user) router.push("/auth/sign-in"); }, [isLoading, user, router]);
  if (isLoading || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSubmitting(true);
    const result = await apiFetch("/api/v1/revenue/contacts", { method: "POST", token: token ?? undefined, body: JSON.stringify({ firstName, lastName, email: email || undefined, title: title || undefined }) });
    setSubmitting(false);
    if (result.ok) router.push("/revenue/contacts"); else setError(result.error.message);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">New Contact</h1><p className="text-gray-500"><Link href="/revenue/contacts" className="text-blue-600 hover:underline">Contacts</Link> / New</p></div>
        {error && <div className="rounded bg-red-100 p-4 text-red-700">{error}</div>}
        <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
          <div><label className="mb-1 block text-sm font-medium">First Name *</label><input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></div>
          <div><label className="mb-1 block text-sm font-medium">Last Name *</label><input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></div>
          <div><label className="mb-1 block text-sm font-medium">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></div>
          <div><label className="mb-1 block text-sm font-medium">Title</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></div>
          <button type="submit" disabled={submitting} className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50">{submitting ? "Creating..." : "Create Contact"}</button>
        </form>
      </div>
    </AppShell>
  );
}
