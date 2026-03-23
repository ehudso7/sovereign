// ---------------------------------------------------------------------------
// Phase 2 domain entities — Organization, User, Membership, Project
// ---------------------------------------------------------------------------

import type {
  OrgId,
  UserId,
  ProjectId,
  ISODateString,
} from "./types.js";
import type { MembershipId, InvitationId, OrgRole } from "./auth.js";

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export interface User {
  readonly id: UserId;
  readonly email: string;
  readonly name: string;
  readonly avatarUrl?: string;
  readonly workosUserId?: string;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

export interface CreateUserInput {
  readonly email: string;
  readonly name: string;
  readonly avatarUrl?: string;
  readonly workosUserId?: string;
}

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

export interface Organization {
  readonly id: OrgId;
  readonly name: string;
  readonly slug: string;
  readonly plan: string;
  readonly settings: Record<string, unknown>;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

export interface CreateOrgInput {
  readonly name: string;
  readonly slug: string;
}

export interface UpdateOrgInput {
  readonly name?: string;
  readonly settings?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

export interface Membership {
  readonly id: MembershipId;
  readonly orgId: OrgId;
  readonly userId: UserId;
  readonly role: OrgRole;
  readonly invitedBy?: UserId;
  readonly acceptedAt?: ISODateString;
  readonly createdAt: ISODateString;
}

export interface CreateMembershipInput {
  readonly orgId: OrgId;
  readonly userId: UserId;
  readonly role: OrgRole;
  readonly invitedBy?: UserId;
}

// ---------------------------------------------------------------------------
// Invitation
// ---------------------------------------------------------------------------

export interface Invitation {
  readonly id: InvitationId;
  readonly orgId: OrgId;
  readonly email: string;
  readonly role: OrgRole;
  readonly invitedBy: UserId;
  readonly expiresAt: ISODateString;
  readonly acceptedAt?: ISODateString;
  readonly createdAt: ISODateString;
}

export interface CreateInvitationInput {
  readonly orgId: OrgId;
  readonly email: string;
  readonly role: OrgRole;
  readonly invitedBy: UserId;
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export interface Project {
  readonly id: ProjectId;
  readonly orgId: OrgId;
  readonly name: string;
  readonly slug: string;
  readonly description?: string;
  readonly settings: Record<string, unknown>;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

export interface CreateProjectInput {
  readonly orgId: OrgId;
  readonly name: string;
  readonly slug: string;
  readonly description?: string;
}

export interface UpdateProjectInput {
  readonly name?: string;
  readonly slug?: string;
  readonly description?: string;
  readonly settings?: Record<string, unknown>;
}
