"use client";

import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">403</h1>
      <p className="text-lg text-gray-500">You do not have permission to access this resource.</p>
      <Link
        href="/dashboard"
        className="rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-700"
      >
        Back to Dashboard
      </Link>
    </main>
  );
}
