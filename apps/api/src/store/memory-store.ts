// ---------------------------------------------------------------------------
// In-memory store for local/dev mode
// ---------------------------------------------------------------------------
// This store is used when no PostgreSQL is available. It is NOT for production.
// All data is ephemeral and lost on process restart.

import { randomUUID } from "node:crypto";
import {
  toOrgId,
  toUserId,
  toProjectId,
  toSessionId,
  toMembershipId,
  toInvitationId,
  toAuditEventId,
  toISODateString,
} from "@sovereign/core";
import type {
  OrgId,
  UserId,
  ProjectId,
  SessionId,
  MembershipId,
  User,
  Organization,
  Membership,
  Invitation,
  Session,
  Project,
  AuditEvent,
  OrgRole,
  EmitAuditEventInput,
} from "@sovereign/core";

// ---------------------------------------------------------------------------
// Store state
// ---------------------------------------------------------------------------

interface StoreState {
  users: Map<string, User & { passwordHash?: string }>;
  organizations: Map<string, Organization>;
  memberships: Map<string, Membership>;
  invitations: Map<string, Invitation>;
  sessions: Map<string, Session & { tokenHash: string }>;
  projects: Map<string, Project>;
  auditEvents: AuditEvent[];
}

function createState(): StoreState {
  return {
    users: new Map(),
    organizations: new Map(),
    memberships: new Map(),
    invitations: new Map(),
    sessions: new Map(),
    projects: new Map(),
    auditEvents: [],
  };
}

let state: StoreState = createState();

export function resetStore(): void {
  state = createState();
}

export function getState(): Readonly<StoreState> {
  return state;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now(): string {
  return toISODateString(new Date());
}

function uuid(): string {
  return randomUUID();
}

// ---------------------------------------------------------------------------
// User store
// ---------------------------------------------------------------------------

export const userStore = {
  create(input: {
    email: string;
    name: string;
    avatarUrl?: string;
    workosUserId?: string;
    passwordHash?: string;
  }): User {
    const existing = Array.from(state.users.values()).find(
      (u) => u.email === input.email
    );
    if (existing) throw new Error(`User with email ${input.email} already exists`);

    const id = toUserId(uuid());
    const timestamp = now();
    const user: User & { passwordHash?: string } = {
      id,
      email: input.email,
      name: input.name,
      avatarUrl: input.avatarUrl,
      workosUserId: input.workosUserId,
      passwordHash: input.passwordHash,
      createdAt: toISODateString(timestamp),
      updatedAt: toISODateString(timestamp),
    };
    state.users.set(id, user);
    return user;
  },

  getById(id: UserId): (User & { passwordHash?: string }) | undefined {
    return state.users.get(id);
  },

  getByEmail(email: string): (User & { passwordHash?: string }) | undefined {
    return Array.from(state.users.values()).find((u) => u.email === email);
  },

  update(id: UserId, input: Partial<{ name: string; avatarUrl: string }>): User | undefined {
    const user = state.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...input, updatedAt: toISODateString(now()) };
    state.users.set(id, updated);
    return updated;
  },
};

// ---------------------------------------------------------------------------
// Organization store
// ---------------------------------------------------------------------------

export const orgStore = {
  create(input: { name: string; slug: string }): Organization {
    const existing = Array.from(state.organizations.values()).find(
      (o) => o.slug === input.slug
    );
    if (existing) throw new Error(`Organization with slug ${input.slug} already exists`);

    const id = toOrgId(uuid());
    const timestamp = now();
    const org: Organization = {
      id,
      name: input.name,
      slug: input.slug,
      plan: "free",
      settings: {},
      createdAt: toISODateString(timestamp),
      updatedAt: toISODateString(timestamp),
    };
    state.organizations.set(id, org);
    return org;
  },

  getById(id: OrgId): Organization | undefined {
    return state.organizations.get(id);
  },

  getBySlug(slug: string): Organization | undefined {
    return Array.from(state.organizations.values()).find((o) => o.slug === slug);
  },

  update(id: OrgId, input: { name?: string; settings?: Record<string, unknown> }): Organization | undefined {
    const org = state.organizations.get(id);
    if (!org) return undefined;
    const updated: Organization = {
      ...org,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.settings !== undefined ? { settings: input.settings } : {}),
      updatedAt: toISODateString(now()),
    };
    state.organizations.set(id, updated);
    return updated;
  },

  list(): Organization[] {
    return Array.from(state.organizations.values());
  },
};

// ---------------------------------------------------------------------------
// Membership store
// ---------------------------------------------------------------------------

export const membershipStore = {
  create(input: {
    orgId: OrgId;
    userId: UserId;
    role: OrgRole;
    invitedBy?: UserId;
    accepted?: boolean;
  }): Membership {
    const existing = Array.from(state.memberships.values()).find(
      (m) => m.orgId === input.orgId && m.userId === input.userId
    );
    if (existing) throw new Error("Membership already exists");

    const id = toMembershipId(uuid());
    const membership: Membership = {
      id,
      orgId: input.orgId,
      userId: input.userId,
      role: input.role,
      invitedBy: input.invitedBy,
      acceptedAt: input.accepted ? toISODateString(now()) : undefined,
      createdAt: toISODateString(now()),
    };
    state.memberships.set(id, membership);
    return membership;
  },

  getForUser(orgId: OrgId, userId: UserId): Membership | undefined {
    return Array.from(state.memberships.values()).find(
      (m) => m.orgId === orgId && m.userId === userId
    );
  },

  listForOrg(orgId: OrgId): Membership[] {
    return Array.from(state.memberships.values()).filter(
      (m) => m.orgId === orgId
    );
  },

  listForUser(userId: UserId): Membership[] {
    return Array.from(state.memberships.values()).filter(
      (m) => m.userId === userId
    );
  },

  updateRole(id: MembershipId, role: OrgRole): Membership | undefined {
    const membership = state.memberships.get(id);
    if (!membership) return undefined;
    const updated: Membership = { ...membership, role };
    state.memberships.set(id, updated);
    return updated;
  },

  delete(orgId: OrgId, userId: UserId): boolean {
    const membership = Array.from(state.memberships.entries()).find(
      ([, m]) => m.orgId === orgId && m.userId === userId
    );
    if (!membership) return false;
    state.memberships.delete(membership[0]);
    return true;
  },
};

// ---------------------------------------------------------------------------
// Invitation store
// ---------------------------------------------------------------------------

export const invitationStore = {
  create(input: {
    orgId: OrgId;
    email: string;
    role: OrgRole;
    invitedBy: UserId;
    expiresAt: string;
  }): Invitation {
    const id = toInvitationId(uuid());
    const invitation: Invitation = {
      id,
      orgId: input.orgId,
      email: input.email,
      role: input.role,
      invitedBy: input.invitedBy,
      expiresAt: toISODateString(input.expiresAt),
      createdAt: toISODateString(now()),
    };
    state.invitations.set(id, invitation);
    return invitation;
  },

  getById(id: string): Invitation | undefined {
    return state.invitations.get(id);
  },

  listForOrg(orgId: OrgId): Invitation[] {
    return Array.from(state.invitations.values()).filter(
      (i) => i.orgId === orgId && !i.acceptedAt
    );
  },

  accept(id: string): Invitation | undefined {
    const invitation = state.invitations.get(id);
    if (!invitation) return undefined;
    const updated: Invitation = {
      ...invitation,
      acceptedAt: toISODateString(now()),
    };
    state.invitations.set(id, updated);
    return updated;
  },

  delete(id: string): boolean {
    return state.invitations.delete(id);
  },
};

// ---------------------------------------------------------------------------
// Session store
// ---------------------------------------------------------------------------

export const sessionStore = {
  create(input: {
    userId: UserId;
    orgId: OrgId;
    role: OrgRole;
    tokenHash: string;
    expiresAt: string;
    ipAddress?: string;
    userAgent?: string;
  }): Session {
    const id = toSessionId(uuid());
    const session: Session & { tokenHash: string } = {
      id,
      userId: input.userId,
      orgId: input.orgId,
      role: input.role,
      tokenHash: input.tokenHash,
      expiresAt: toISODateString(input.expiresAt),
      createdAt: toISODateString(now()),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    };
    state.sessions.set(id, session);
    return session;
  },

  getById(id: SessionId): (Session & { tokenHash: string }) | undefined {
    return state.sessions.get(id);
  },

  getByTokenHash(tokenHash: string): (Session & { tokenHash: string }) | undefined {
    return Array.from(state.sessions.values()).find(
      (s) => s.tokenHash === tokenHash
    );
  },

  listForUser(orgId: OrgId, userId: UserId): Session[] {
    return Array.from(state.sessions.values()).filter(
      (s) => s.orgId === orgId && s.userId === userId
    );
  },

  delete(id: SessionId): boolean {
    return state.sessions.delete(id);
  },

  deleteExpired(): number {
    const nowMs = Date.now();
    let count = 0;
    for (const [id, session] of state.sessions) {
      if (new Date(session.expiresAt).getTime() < nowMs) {
        state.sessions.delete(id);
        count++;
      }
    }
    return count;
  },
};

// ---------------------------------------------------------------------------
// Project store
// ---------------------------------------------------------------------------

export const projectStore = {
  create(input: {
    orgId: OrgId;
    name: string;
    slug: string;
    description?: string;
  }): Project {
    const existing = Array.from(state.projects.values()).find(
      (p) => p.orgId === input.orgId && p.slug === input.slug
    );
    if (existing) throw new Error(`Project with slug ${input.slug} already exists in this org`);

    const id = toProjectId(uuid());
    const timestamp = now();
    const project: Project = {
      id,
      orgId: input.orgId,
      name: input.name,
      slug: input.slug,
      description: input.description,
      settings: {},
      createdAt: toISODateString(timestamp),
      updatedAt: toISODateString(timestamp),
    };
    state.projects.set(id, project);
    return project;
  },

  getById(id: ProjectId): Project | undefined {
    return state.projects.get(id);
  },

  listForOrg(orgId: OrgId): Project[] {
    return Array.from(state.projects.values()).filter(
      (p) => p.orgId === orgId
    );
  },

  update(id: ProjectId, input: {
    name?: string;
    slug?: string;
    description?: string;
    settings?: Record<string, unknown>;
  }): Project | undefined {
    const project = state.projects.get(id);
    if (!project) return undefined;
    const updated: Project = {
      ...project,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.settings !== undefined ? { settings: input.settings } : {}),
      updatedAt: toISODateString(now()),
    };
    state.projects.set(id, updated);
    return updated;
  },

  delete(id: ProjectId): boolean {
    return state.projects.delete(id);
  },
};

// ---------------------------------------------------------------------------
// Audit event store
// ---------------------------------------------------------------------------

export const auditStore = {
  emit(input: EmitAuditEventInput): AuditEvent {
    const event: AuditEvent = {
      id: toAuditEventId(uuid()),
      orgId: input.orgId,
      actorId: input.actorId,
      actorType: input.actorType,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata: input.metadata ?? {},
      ipAddress: input.ipAddress,
      createdAt: toISODateString(now()),
    };
    state.auditEvents.push(event);
    return event;
  },

  query(orgId: OrgId, params?: {
    action?: string;
    resourceType?: string;
    resourceId?: string;
    actorId?: UserId;
    limit?: number;
  }): AuditEvent[] {
    let events = state.auditEvents.filter((e) => e.orgId === orgId);
    if (params?.action) events = events.filter((e) => e.action === params.action);
    if (params?.resourceType) events = events.filter((e) => e.resourceType === params.resourceType);
    if (params?.resourceId) events = events.filter((e) => e.resourceId === params.resourceId);
    if (params?.actorId) events = events.filter((e) => e.actorId === params.actorId);
    events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return events.slice(0, params?.limit ?? 100);
  },
};
