"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const { signIn, bootstrap } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isBootstrap, setIsBootstrap] = useState(false);
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const success = await signIn(email);
    if (success) {
      router.push("/dashboard");
    } else {
      setError("Sign in failed. If this is a new installation, use the bootstrap form.");
    }
    setIsLoading(false);
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const success = await bootstrap({ email, name, orgName, orgSlug });
    if (success) {
      router.push("/dashboard");
    } else {
      setError("Bootstrap failed. Check the API server logs.");
    }
    setIsLoading(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-gray-200 p-8">
        <h1 className="text-2xl font-bold">Sign In</h1>

        {error && (
          <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {!isBootstrap ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
            <button
              type="button"
              onClick={() => setIsBootstrap(true)}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              New installation? Bootstrap first account
            </button>
          </form>
        ) : (
          <form onSubmit={handleBootstrap} className="space-y-4">
            <div>
              <label htmlFor="b-email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="b-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="b-name" className="block text-sm font-medium text-gray-700">
                Name
              </label>
              <input
                id="b-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="b-orgName" className="block text-sm font-medium text-gray-700">
                Organization Name
              </label>
              <input
                id="b-orgName"
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="b-orgSlug" className="block text-sm font-medium text-gray-700">
                Organization Slug
              </label>
              <input
                id="b-orgSlug"
                type="text"
                value={orgSlug}
                onChange={(e) => setOrgSlug(e.target.value)}
                required
                pattern="[a-z0-9-]+"
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {isLoading ? "Creating..." : "Bootstrap Account"}
            </button>
            <button
              type="button"
              onClick={() => setIsBootstrap(false)}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Already have an account? Sign in
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
