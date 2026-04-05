"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { IconConnectors, IconSearch, IconChevronRight } from "@/components/icons";
import Link from "next/link";

interface Connector {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  trustTier: string;
  authMode: string;
  status: string;
}

interface ConnectorInstall {
  connectorId: string;
}

export default function AddConnectorPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);

  const canInstall = role === "org_owner" || role === "org_admin";

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiFetch<Connector[]>("/api/v1/connectors", { token }),
      apiFetch<ConnectorInstall[]>("/api/v1/connectors/installed", { token }),
    ]).then(([catalogResult, installedResult]) => {
      if (catalogResult.ok) setConnectors(catalogResult.data);
      if (installedResult.ok) {
        setInstalled(new Set(installedResult.data.map((i) => i.connectorId)));
      }
      setLoading(false);
    });
  }, [token]);

  const handleInstall = async (connectorId: string) => {
    if (!token) return;
    setInstalling(connectorId);
    setError(null);
    const result = await apiFetch<{ id: string }>(
      `/api/v1/connectors/${connectorId}/install`,
      { method: "POST", token, body: JSON.stringify({ grantedScopes: [] }) },
    );
    if (result.ok) {
      setInstalled((prev) => new Set([...prev, connectorId]));
      router.push(`/connectors/${connectorId}`);
    } else {
      setError(result.error.message);
    }
    setInstalling(null);
  };

  if (isLoading || !user) return null;

  const available = connectors.filter((c) => !installed.has(c.id));
  const filtered = searchQuery.trim()
    ? available.filter((c) => {
        const q = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q)
        );
      })
    : available;

  return (
    <AppShell>
      <div className="space-y-6">
        <nav className="breadcrumb">
          <Link href="/connectors">Connectors</Link>
          <IconChevronRight size={12} className="breadcrumb-separator" />
          <span className="text-[rgb(var(--color-text-primary))]">Add Connector</span>
        </nav>

        <div className="page-header">
          <h1 className="page-title">Add Connector</h1>
          <p className="page-description">
            Browse available connectors and install them to extend your agents
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-[rgb(var(--color-error)/0.3)] bg-[rgb(var(--color-error-bg))] px-4 py-3 text-sm text-[rgb(var(--color-error))]">
            {error}
          </div>
        )}

        <div className="relative max-w-sm">
          <IconSearch
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-tertiary))]"
          />
          <input
            type="text"
            placeholder="Search available connectors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9"
          />
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="card space-y-3 p-5">
                <div className="skeleton h-5 w-32" />
                <div className="skeleton h-3 w-full" />
                <div className="skeleton h-3 w-2/3" />
                <div className="skeleton h-8 w-20 rounded-md" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <IconConnectors size={48} className="empty-state-icon" />
            <p className="empty-state-title">
              {searchQuery ? "No connectors match your search" : "All connectors are installed"}
            </p>
            <p className="empty-state-description">
              {searchQuery
                ? "Try adjusting your search query."
                : "You have installed all available connectors."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((connector) => (
              <div key={connector.id} className="card space-y-3 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">
                      {connector.name}
                    </h3>
                    <p className="text-xs text-[rgb(var(--color-text-tertiary))]">
                      {connector.slug}
                    </p>
                  </div>
                  <span className="badge-neutral text-[10px]">{connector.category}</span>
                </div>
                <p className="line-clamp-2 text-xs text-[rgb(var(--color-text-secondary))]">
                  {connector.description}
                </p>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] ${connector.trustTier === "verified" ? "badge-success" : "badge-neutral"}`}>
                    {connector.trustTier}
                  </span>
                  <span className="badge-neutral text-[10px]">{connector.authMode}</span>
                </div>
                {canInstall && (
                  <button
                    onClick={() => handleInstall(connector.id)}
                    disabled={installing === connector.id}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[rgb(var(--color-brand))] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[rgb(var(--color-brand-dark))] disabled:opacity-50"
                  >
                    {installing === connector.id ? "Installing..." : "Install"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
