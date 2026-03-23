"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.push("/dashboard");
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center">
        <p className="text-lg text-gray-500">Loading...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-8">
        <h1 className="text-6xl font-bold tracking-widest">SOVEREIGN</h1>
        <p className="text-lg text-gray-500">Multi-tenant agent operating system</p>
        <div className="flex gap-4">
          <a
            href="/auth/sign-in"
            className="rounded-lg bg-gray-900 px-6 py-3 text-white hover:bg-gray-700"
          >
            Sign In
          </a>
        </div>
      </main>
    );
  }

  return null;
}
